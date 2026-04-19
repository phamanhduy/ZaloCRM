/**
 * chat-routes.ts — REST API for conversations and messages.
 * All routes require JWT auth and are scoped to the user's org.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../shared/database/db.js';
import { conversations, messages, contacts, zaloAccounts, zaloAccountAccess } from '../../shared/database/schema.js';
import { eq, and, or, like, desc, count, inArray, gt } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireZaloAccess } from '../zalo/zalo-access-middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { zaloPool } from '../zalo/zalo-pool.js';
import { zaloRateLimiter } from '../zalo/zalo-rate-limiter.js';
import { logger } from '../../shared/utils/logger.js';
import type { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

type QueryParams = Record<string, string>;

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ── List conversations (paginated) ──────────────────────────────────────
  app.get('/api/v1/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { page = '1', limit = '50', search = '', accountId = '', unread = '', status = '' } = request.query as any;

    let filters = eq(conversations.orgId, user.orgId);

    if (accountId && accountId !== '') {
      filters = and(filters, eq(conversations.zaloAccountId, accountId)) as any;
    }

    if (unread === 'true' || unread === true) {
      filters = and(filters, gt(conversations.unreadCount, 0)) as any;
    }

    const hasSearch = search && search.trim() !== '';
    const hasStatus = status && status.trim() !== '';

    if (hasSearch || hasStatus) {
      const contactFilters = [eq(contacts.orgId, user.orgId)];
      if (hasSearch) {
        contactFilters.push(or(like(contacts.fullName, `%${search}%`), like(contacts.phone, `%${search}%`)) as any);
      }
      if (hasStatus) {
        contactFilters.push(eq(contacts.status, status) as any);
      }

      const matchedContacts = await db.query.contacts.findMany({
        where: and(...contactFilters),
        columns: { id: true }
      });

      const contactIds = matchedContacts.map(c => c.id);
      if (contactIds.length > 0) {
        filters = and(filters, inArray(conversations.contactId, contactIds)) as any;
      } else {
        return { conversations: [], total: 0, page: parseInt(page), limit: parseInt(limit) };
      }
    }

    // Members can only see conversations from Zalo accounts they have access to
    if (user.role === 'member') {
      const accessibleAccounts = await db.query.zaloAccountAccess.findMany({
        where: eq(zaloAccountAccess.userId, user.id),
        columns: { zaloAccountId: true },
      });
      const accIds = accessibleAccounts.map((a) => a.zaloAccountId);
      if (accIds.length > 0) {
        filters = and(filters, inArray(conversations.zaloAccountId, accIds)) as any;
      } else {
        return { conversations: [], total: 0, page: parseInt(page), limit: parseInt(limit) };
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [convs, totalResult] = await Promise.all([
      db.query.conversations.findMany({
        where: filters,
        with: {
          contact: true,
          zaloAccount: {
            columns: { id: true, displayName: true, zaloUid: true }
          },
          messages: {
            limit: 1,
            orderBy: [desc(messages.sentAt)],
            columns: { content: true, contentType: true, senderType: true, sentAt: true, isDeleted: true },
          },
        },
        orderBy: [desc(conversations.lastMessageAt)],
        offset: (pageNum - 1) * limitNum,
        limit: limitNum,
      }),
      db.select({ value: count() }).from(conversations).where(filters),
    ]);

    return {
      conversations: convs,
      total: totalResult[0].value,
      page: pageNum,
      limit: limitNum
    };
  });

  // ── Get single conversation ──────────────────────────────────────────────
  app.get('/api/v1/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
      with: {
        contact: true,
        zaloAccount: {
          columns: { id: true, displayName: true, zaloUid: true, status: true }
        },
      },
    });
    if (!conversation) return reply.status(404).send({ error: 'Not found' });

    return conversation;
  });

  // ── List messages for a conversation (paginated, newest first) ──────────
  app.get('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('read') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { page = '1', limit = '50' } = request.query as QueryParams;

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
      columns: { id: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [msgs, totalResult] = await Promise.all([
      db.query.messages.findMany({
        where: eq(messages.conversationId, id),
        orderBy: [desc(messages.sentAt)],
        offset: (pageNum - 1) * limitNum,
        limit: limitNum,
      }),
      db.select({ value: count() }).from(messages).where(eq(messages.conversationId, id)),
    ]);

    return {
      messages: msgs.reverse(),
      total: totalResult[0].value,
      page: pageNum,
      limit: limitNum
    };
  });

  // ── Send message ─────────────────────────────────────────────────────────
  app.post('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('chat') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { content, contentType = 'text', attachments = [] } = request.body as {
      content: string;
      contentType?: string;
      attachments?: any[]; // Array of { path, fileName, type }
    };

    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      return reply.status(400).send({ error: 'Content or attachments required' });
    }

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
      with: { zaloAccount: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });

    const instance = zaloPool.getInstance(conversation.zaloAccountId);
    if (!instance?.api) return reply.status(400).send({ error: 'Zalo account not connected' });

    // Rate limit check
    const limits = zaloRateLimiter.checkLimits(conversation.zaloAccountId);
    if (!limits.allowed) {
      return reply.status(429).send({ error: limits.reason });
    }

    try {
      const threadId = conversation.externalThreadId || '';
      const threadType = conversation.threadType === 'group' ? 1 : 0;

      zaloRateLimiter.recordSend(conversation.zaloAccountId);

      // Prepare message for zca-js
      const msgData: any = { msg: content || '' };
      if (attachments && attachments.length > 0) {
        msgData.attachments = await Promise.all(attachments.map(async (a: any) => {
          const buffer = fs.readFileSync(a.path);
          const baseName = path.basename(a.path);

          const meta: any = { totalSize: buffer.length };
          if (a.type?.includes('image') || contentType === 'image') {
            try {
              const size = sizeOf(buffer);
              meta.width = size.width;
              meta.height = size.height;
            } catch (err) {
              logger.warn('[chat] Failed to get image size from buffer:', err);
            }
          }

          return {
            data: buffer,
            filename: baseName,
            metadata: meta
          };
        }));
        logger.info('[chat] Sending with attachments (buffers):', attachments.length);
      }

      try {
        await instance.api.sendMessage(msgData, threadId, threadType);
      } catch (zcaErr: any) {
        logger.error('[chat] zca-js sendMessage error:', zcaErr.message);
        throw new Error(`Zalo API error: ${zcaErr.message}`);
      }

      const msgId = uuidv4();
      await db.insert(messages).values({
        id: msgId,
        conversationId: id,
        senderType: 'self',
        senderUid: conversation.zaloAccount.zaloUid || '',
        senderName: conversation.zaloAccount.displayName || 'Nhân viên',
        senderAvatar: conversation.zaloAccount.avatarUrl || null,
        content: content || '',
        contentType: contentType,
        attachments: attachments,
        sentAt: new Date(),
        repliedByUserId: user.id,
      });

      const message = await db.query.messages.findFirst({
        where: eq(messages.id, msgId)
      });

      await db.update(conversations)
        .set({
          lastMessageAt: new Date(),
          isReplied: true,
          unreadCount: 0
        })
        .where(eq(conversations.id, id));

      const io = (app as any).io as Server;
      io?.emit('chat:message', { accountId: conversation.zaloAccountId, message, conversationId: id });

      return message;
    } catch (err: any) {
      logger.error('[chat] Send message error details:', err);
      return reply.status(500).send({ error: err.message || 'Failed to send message' });
    }
  });

  // ── Accept Friend Request ──────────────────────────────────────────────────
  app.post('/api/v1/conversations/:id/accept-friend', { preHandler: requireZaloAccess('chat') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
      with: { zaloAccount: true },
    });

    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });
    if (!conversation.isFriendRequest) return reply.status(400).send({ error: 'Not a friend request' });

    const instance = zaloPool.getInstance(conversation.zaloAccountId);
    if (!instance?.api) return reply.status(400).send({ error: 'Zalo account not connected' });

    try {
      // Assuming zca-js has acceptFriendRequest or similar
      // We use the externalThreadId as the Zalo UID for user chats
      const zaloUid = conversation.externalThreadId;
      if (!zaloUid) throw new Error('No Zalo UID found for this conversation');

      // Call Zalo API to accept
      await (instance.api as any).acceptFriendRequest(zaloUid);

      // Update conversation status in DB
      await db.update(conversations)
        .set({ isFriendRequest: false, friendRequestMessage: null })
        .where(eq(conversations.id, id));

      return { success: true };
    } catch (err: any) {
      logger.error('[chat] Accept friend request error:', err.message);
      reply.status(500).send({ error: err.message || 'Failed to accept friend request' });
    }
  });

  // ── Mark conversation as read ────────────────────────────────────────────
  app.post('/api/v1/conversations/:id/mark-read', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    await db.update(conversations)
      .set({ unreadCount: 0 })
      .where(and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)));

    return { success: true };
  });
}
