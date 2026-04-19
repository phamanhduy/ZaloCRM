import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../shared/database/db.js';
import { marketingCampaigns, marketingLogs, contacts } from '../../shared/database/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { marketingService } from './marketing-service.js';

export async function marketingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List campaigns
  app.get('/api/v1/marketing/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const campaigns = await db.query.marketingCampaigns.findMany({
      where: eq(marketingCampaigns.orgId, user.orgId),
      orderBy: [desc(marketingCampaigns.createdAt)],
    });
    return campaigns;
  });

  // Create campaign
  app.post('/api/v1/marketing/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const body = request.body as any;

    const id = uuidv4();
    await db.insert(marketingCampaigns).values({
      id,
      orgId: user.orgId,
      name: body.name,
      filters: body.filters || {},
      messageConfig: body.messageConfig || {},
      status: 'draft',
    });

    return { id };
  });

  // Preview filtered contacts
  app.post('/api/v1/marketing/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const filters = request.body as any;

    const filteredContacts = await marketingService.getFilteredContacts(user.orgId, filters);
    return filteredContacts;
  });

  // Start campaign
  app.post('/api/v1/marketing/campaigns/:id/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const campaign = await db.query.marketingCampaigns.findFirst({
      where: and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.orgId, user.orgId)),
    });

    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    if (campaign.status === 'running') return reply.status(400).send({ error: 'Campaign already running' });

    // Start in background
    void marketingService.runCampaign(campaign.id);

    return { success: true };
  });

  // Get campaign stats
  app.get('/api/v1/marketing/campaigns/:id/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const campaign = await db.query.marketingCampaigns.findFirst({
      where: and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.orgId, user.orgId)),
    });

    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const logs = await db.query.marketingLogs.findMany({
      where: eq(marketingLogs.campaignId, id),
      with: {
        contact: {
          columns: { fullName: true, avatarUrl: true, phone: true }
        }
      },
      limit: 100,
      orderBy: [desc(marketingLogs.createdAt)],
    });

    return { campaign, recentLogs: logs };
  });
}
