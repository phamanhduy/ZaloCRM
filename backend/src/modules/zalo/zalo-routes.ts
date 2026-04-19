/**
 * Zalo account management routes.
 * All endpoints require authentication via authMiddleware.
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { zaloPool } from './zalo-pool.js';
import { db } from '../../shared/database/db.js';
import { zaloAccounts } from '../../shared/database/schema.js';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function zaloRoutes(app: FastifyInstance): Promise<void> {
  // All routes in this plugin require auth
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/zalo-accounts — list accounts with live status from pool
  app.get('/api/v1/zalo-accounts', async (request) => {
    const user = request.user!;
    const accounts = await db.query.zaloAccounts.findMany({
      where: eq(zaloAccounts.orgId, user.orgId),
      with: {
        owner: {
          columns: { id: true, fullName: true, email: true }
        }
      },
      orderBy: [asc(zaloAccounts.createdAt)],
    });

    // Merge live status from pool
    return accounts.map((a) => ({
      ...a,
      liveStatus: zaloPool.getStatus(a.id),
    }));
  });

  // POST /api/v1/zalo-accounts — create a new account record
  app.post<{ Body: { displayName?: string } }>(
    '/api/v1/zalo-accounts',
    async (request, reply) => {
      const user = request.user!;
      const { displayName } = request.body ?? {};

      const id = uuidv4();
      await db.insert(zaloAccounts).values({
        id,
        orgId: user.orgId,
        ownerUserId: user.id,
        displayName: displayName ?? null,
        status: 'qr_pending',
      });

      const account = await db.query.zaloAccounts.findFirst({
        where: eq(zaloAccounts.id, id)
      });

      return reply.status(201).send(account);
    },
  );

  // POST /api/v1/zalo-accounts/:id/login — initiate QR login
  app.post<{ Params: { id: string } }>(
    '/api/v1/zalo-accounts/:id/login',
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const account = await db.query.zaloAccounts.findFirst({
        where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
      });
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      // Fire-and-forget — QR delivered via Socket.IO
      zaloPool.loginQR(id).catch(() => {
        // errors are emitted via socket; no need to crash here
      });

      return { message: 'QR login initiated — subscribe to account:' + id + ' socket room' };
    },
  );

  // POST /api/v1/zalo-accounts/:id/reconnect — force reconnect using saved session
  app.post<{ Params: { id: string } }>(
    '/api/v1/zalo-accounts/:id/reconnect',
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const account = await db.query.zaloAccounts.findFirst({
        where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
      });
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      const session = account.sessionData as {
        cookie: any;
        imei: string;
        userAgent: string;
      } | null;

      if (!session?.imei) {
        return reply.status(400).send({ error: 'No saved session — please login with QR first' });
      }

      // Fire-and-forget — result emitted via Socket.IO
      zaloPool.reconnect(id, session).catch(() => {});

      return { message: 'Reconnect initiated' };
    },
  );

  // DELETE /api/v1/zalo-accounts/:id — disconnect and delete record
  app.delete<{ Params: { id: string }, Querystring: { keepHistory?: string } }>(
    '/api/v1/zalo-accounts/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { keepHistory = 'false' } = request.query;
      const user = request.user!;
      const shouldKeep = keepHistory === 'true';

      const account = await db.query.zaloAccounts.findFirst({
        where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
      });
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      zaloPool.disconnect(id);

      if (shouldKeep) {
          // Detach history instead of deleting it
          const { conversations } = await import('../../shared/database/schema.js');
          await db.update(conversations)
            .set({ zaloAccountId: null })
            .where(eq(conversations.zaloAccountId, id));
      } else {
          // Manual cleanup since cascade is removed
          const { conversations, messages } = await import('../../shared/database/schema.js');
          const convs = await db.query.conversations.findMany({
              where: eq(conversations.zaloAccountId, id),
              columns: { id: true }
          });
          const convIds = convs.map(c => c.id);
          if (convIds.length > 0) {
              await db.delete(messages).where(inArray(messages.conversationId, convIds));
              await db.delete(conversations).where(eq(conversations.zaloAccountId, id));
          }
      }

      await db.delete(zaloAccounts).where(eq(zaloAccounts.id, id));

      return reply.status(204).send();
    },
  );

  // GET /api/v1/zalo-accounts/:id/status — live status from pool
  app.get<{ Params: { id: string } }>(
    '/api/v1/zalo-accounts/:id/status',
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const account = await db.query.zaloAccounts.findFirst({
        where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
        columns: { id: true, status: true },
      });
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      return { accountId: id, liveStatus: zaloPool.getStatus(id) };
    },
  );
}
