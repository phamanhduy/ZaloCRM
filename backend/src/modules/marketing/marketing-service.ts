import { db } from '../../shared/database/db.js';
import { marketingCampaigns, marketingLogs, contacts, conversations, messages, zaloAccounts } from '../../shared/database/schema.js';
import { eq, and, or, inArray, like, sql } from 'drizzle-orm';
import { zaloPool } from '../zalo/zalo-pool.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

export class MarketingService {
  private activeJobs = new Set<string>();

  async runCampaign(campaignId: string) {
    if (this.activeJobs.has(campaignId)) return;
    this.activeJobs.add(campaignId);

    try {
      const campaign = await db.query.marketingCampaigns.findFirst({
        where: eq(marketingCampaigns.id, campaignId),
      });

      if (!campaign) {
        logger.error(`[marketing] Campaign ${campaignId} not found`);
        return;
      }

      // Update status to running
      await db.update(marketingCampaigns)
        .set({ status: 'running', lastRunAt: new Date() })
        .where(eq(marketingCampaigns.id, campaignId));

      // 1. Filter contacts
      const filteredContacts = await this.getFilteredContacts(campaign.orgId, campaign.filters);
      
      const stats = { total: filteredContacts.length, sent: 0, error: 0 };
      await db.update(marketingCampaigns)
        .set({ stats })
        .where(eq(marketingCampaigns.id, campaignId));

      // 2. Process each contact
      for (const contact of filteredContacts) {
        // Stop if status changed (paused/cancelled)
        const currentCampaign = await db.query.marketingCampaigns.findFirst({
          where: eq(marketingCampaigns.id, campaignId),
          columns: { status: true },
        });
        if (currentCampaign?.status !== 'running') break;

        try {
          await this.sendMessageToContact(campaign, contact);
          stats.sent++;
        } catch (err: any) {
          logger.error(`[marketing] Failed to send to ${contact.id}:`, err.message);
          stats.error++;
          
          await db.insert(marketingLogs).values({
            id: uuidv4(),
            campaignId,
            contactId: contact.id,
            zaloAccountId: 'unknown',
            status: 'failed',
            errorMessage: err.message,
          });
        }

        // Update stats every 5 messages or at the end
        if (stats.sent % 5 === 0 || stats.sent + stats.error === stats.total) {
          await db.update(marketingCampaigns)
            .set({ stats })
            .where(eq(marketingCampaigns.id, campaignId));
        }

        // 3. Human-like delay
        if (stats.sent + stats.error < stats.total) {
          const { minDelay = 10, maxDelay = 20 } = (campaign.messageConfig as any);
          const delayMs = (Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      await db.update(marketingCampaigns)
        .set({ status: 'completed' })
        .where(eq(marketingCampaigns.id, campaignId));

    } catch (err) {
      logger.error(`[marketing] Campaign ${campaignId} crashed:`, err);
      await db.update(marketingCampaigns)
        .set({ status: 'failed' })
        .where(eq(marketingCampaigns.id, campaignId));
    } finally {
      this.activeJobs.delete(campaignId);
    }
  }

  public async getFilteredContacts(orgId: string, filters: any) {
    const conditions: any[] = [eq(contacts.orgId, orgId)];

    if (filters.status) conditions.push(eq(contacts.status, filters.status));
    if (filters.source) conditions.push(eq(contacts.source, filters.source));
    if (filters.zaloUid) conditions.push(eq(contacts.zaloUid, filters.zaloUid));
    
    // Simple tag filtering (tags is a JSON array)
    if (filters.tag) {
        conditions.push(sql`json_extract(${contacts.tags}, '$') LIKE ${`%"${filters.tag}"%`}`);
    }

    return await db.query.contacts.findMany({
      where: and(...conditions),
    });
  }

  private async sendMessageToContact(campaign: any, contact: any) {
    if (!contact.zaloUid) throw new Error('Contact has no Zalo UID');

    // Find a Zalo account to send from (either specified in filter or first available)
    const filters = campaign.filters || {};
    let zaloAccountId = filters.zaloAccountId;

    if (!zaloAccountId) {
      // Find a conversation with this contact to see which account was used last
      const lastConv = await db.query.conversations.findFirst({
        where: eq(conversations.contactId, contact.id),
        columns: { zaloAccountId: true },
      });
      zaloAccountId = lastConv?.zaloAccountId;
    }

    if (!zaloAccountId) {
       // Fallback: use first connected account in the org
       const firstAcc = await db.query.zaloAccounts.findFirst({
         where: and(eq(zaloAccounts.orgId, campaign.orgId), eq(zaloAccounts.status, 'connected')),
       });
       zaloAccountId = firstAcc?.id;
    }

    if (!zaloAccountId) throw new Error('No Zalo account available to send from');

    const instance = zaloPool.getInstance(zaloAccountId);
    if (!instance?.api) throw new Error('Zalo account disconnected');

    const { text, attachments = [] } = campaign.messageConfig;

    // Prepare message
    const msgData: any = { msg: text || '' };
    
    if (attachments && attachments.length > 0) {
      msgData.attachments = await Promise.all(attachments.map(async (a: any) => {
        if (!fs.existsSync(a.path)) {
          logger.warn(`[marketing] Attachment file not found: ${a.path}`);
          return null;
        }
        
        const buffer = fs.readFileSync(a.path);
        const baseName = path.basename(a.path);
        const meta: any = { totalSize: buffer.length };

        if (a.type === 'image') {
          try {
            const size = sizeOf(buffer);
            meta.width = size.width;
            meta.height = size.height;
          } catch (err) {
            logger.warn('[marketing] Failed to get image size:', err);
          }
        }

        return {
          data: buffer,
          filename: baseName,
          metadata: meta
        };
      }));
      // Filter out nulls if any files were missing
      msgData.attachments = msgData.attachments.filter((a: any) => a !== null);
    }

    await instance.api.sendMessage(msgData, contact.zaloUid, 0);

    // Record log
    await db.insert(marketingLogs).values({
      id: uuidv4(),
      campaignId: campaign.id,
      contactId: contact.id,
      zaloAccountId,
      status: 'sent',
      sentAt: new Date(),
    });

    // Also persist to messages table for chat history
    let conv = await db.query.conversations.findFirst({
        where: and(eq(conversations.zaloAccountId, zaloAccountId), eq(conversations.contactId, contact.id))
    });

    if (!conv) {
        const convId = uuidv4();
        await db.insert(conversations).values({
            id: convId,
            orgId: campaign.orgId,
            zaloAccountId,
            contactId: contact.id,
            threadType: 'user',
            externalThreadId: contact.zaloUid,
            lastMessageAt: new Date(),
        });
        conv = { id: convId } as any;
    }

    await db.insert(messages).values({
        id: uuidv4(),
        conversationId: conv!.id,
        senderType: 'self',
        senderUid: zaloAccountId,
        content: text || '',
        contentType: attachments?.length > 0 ? attachments[0].type : 'text',
        attachments: JSON.stringify(attachments),
        sentAt: new Date(),
    });
  }
}

export const marketingService = new MarketingService();
