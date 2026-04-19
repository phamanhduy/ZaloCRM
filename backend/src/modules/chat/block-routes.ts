import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../shared/database/db.js';
import { messageGroups, messageBlocks, messageBlockItems, conversations } from '../../shared/database/schema.js';
import { eq, and, asc, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { zaloPool } from '../zalo/zalo-pool.js';
import { handleIncomingMessage } from './message-handler.js';
import { logger } from '../../shared/utils/logger.js';

export async function blockRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // ── Groups ───────────────────────────────────────────────────────────────

  app.get('/api/v1/message-groups', async (request) => {
    const user = request.user!;
    return db.query.messageGroups.findMany({
      where: eq(messageGroups.orgId, user.orgId),
      with: {
        blocks: {
            orderBy: [asc(messageBlocks.order)]
        }
      },
      orderBy: [asc(messageGroups.order)],
    });
  });

  app.post('/api/v1/message-groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { name } = request.body as { name: string };
    const id = uuidv4();

    logger.info(`[block:create-group] Creating group "${name}" for org ${user.orgId}`);

    await db.insert(messageGroups).values({
      id,
      orgId: user.orgId,
      name,
    });

    return reply.status(201).send({ id, name });
  });

  app.delete('/api/v1/message-groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    await db.delete(messageGroups).where(and(eq(messageGroups.id, id), eq(messageGroups.orgId, user.orgId)));
    return reply.status(204).send();
  });

  // ── Blocks ───────────────────────────────────────────────────────────────

  app.get('/api/v1/message-blocks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const block = await db.query.messageBlocks.findFirst({
        where: eq(messageBlocks.id, id),
        with: {
            items: {
                orderBy: [asc(messageBlockItems.order)]
            }
        }
    });
    if (!block) return reply.status(404).send({ error: 'Block not found' });
    return block;
  });

  app.post('/api/v1/message-blocks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId, name } = request.body as { groupId: string, name: string };
    const id = uuidv4();

    logger.info(`[block:create-block] Creating block "${name}" in group ${groupId}`);

    await db.insert(messageBlocks).values({
      id,
      groupId,
      name,
    });

    return reply.status(201).send({ id, name, groupId });
  });

  app.delete('/api/v1/message-blocks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await db.delete(messageBlocks).where(eq(messageBlocks.id, id));
    return reply.status(204).send();
  });

  // ── Items ────────────────────────────────────────────────────────────────

  app.post('/api/v1/message-block-items', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const id = uuidv4();

    await db.insert(messageBlockItems).values({
      id,
      blockId: body.blockId,
      type: body.type,
      content: body.content,
      fileUrl: body.fileUrl,
      delay: body.delay || 5,
      order: body.order || 0,
    });

    return reply.status(201).send({ id, ...body });
  });

  app.put('/api/v1/message-block-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    logger.info(`[block:update-item] Updating item ${id}. Content length: ${body.content?.length || 0}, Delay: ${body.delay}`);

    try {
        await db.update(messageBlockItems)
          .set({
            type: body.type,
            content: body.content,
            fileUrl: body.fileUrl,
            delay: body.delay,
            order: body.order,
            updatedAt: new Date()
          })
          .where(eq(messageBlockItems.id, id));

        return { success: true };
    } catch (err: any) {
        logger.error(`[block:update-item] Failed to update item ${id}:`, err);
        return reply.status(500).send({ error: 'Failed to update message item' });
    }
  });

  app.delete('/api/v1/message-block-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await db.delete(messageBlockItems).where(eq(messageBlockItems.id, id));
    return reply.status(204).send();
  });

  // ── Execute Block (Send) ─────────────────────────────────────────────────

  app.post('/api/v1/chat/send-block', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { conversationId, blockId } = request.body as { conversationId: string, blockId: string };

    const conv = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, conversationId), eq(conversations.orgId, user.orgId))
    });
    if (!conv) return reply.status(404).send({ error: 'Conversation not found' });

    const block = await db.query.messageBlocks.findFirst({
        where: eq(messageBlocks.id, blockId),
        with: {
            items: {
                orderBy: [asc(messageBlockItems.order)]
            }
        }
    });
    if (!block) return reply.status(404).send({ error: 'Block not found' });

    const instance = zaloPool.getInstance(conv.zaloAccountId);
    if (!instance?.api) return reply.status(400).send({ error: 'Zalo account not connected' });

    // Background execution to not block the response
    (async () => {
        try {
            const threadId = conv.externalThreadId;
            const isGroup = conv.threadType === 'group';

            for (const item of block.items) {
                const delayMs = Math.max(5, item.delay || 5) * 1000;
                await new Promise(resolve => setTimeout(resolve, delayMs));

                logger.info(`[block:send] Sending item ${item.id} (type: ${item.type}) to thread: "${threadId}"`);

                if (item.type === 'text' && item.content) {
                    logger.info(`[block:send] Text content: "${item.content.substring(0, 50)}..."`);
                    const msgData = { msg: item.content, cliMsgId: String(Date.now()) };
                    const threadType = conv.threadType === 'group' ? 1 : 0;
                    await instance.api.sendMessage(msgData, threadId, threadType);
                } else if (item.type === 'image' && item.fileUrl) {
                    logger.info(`[block:send] Processing image from URL: ${item.fileUrl}`);
                    const axios = (await import('axios')).default;
                    const response = await axios.get(item.fileUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);
                    
                    const msgData = {
                        msg: '',
                        cliMsgId: String(Date.now()),
                        attachments: [{
                            data: buffer,
                            filename: 'image.jpg',
                            metadata: { totalSize: buffer.length }
                        }]
                    };
                    await instance.api.sendMessage(msgData, threadId, conv.threadType === 'group' ? 1 : 0);
                } else if (item.type === 'file' && item.fileUrl) {
                    logger.info(`[block:send] Processing file from URL: ${item.fileUrl}`);
                    const axios = (await import('axios')).default;
                    const response = await axios.get(item.fileUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);

                    const msgData = {
                        msg: '',
                        cliMsgId: String(Date.now()),
                        attachments: [{
                            data: buffer,
                            filename: item.fileUrl.split('/').pop() || 'file.dat',
                            metadata: { totalSize: buffer.length }
                        }]
                    };
                    await instance.api.sendMessage(msgData, threadId, conv.threadType === 'group' ? 1 : 0);
                }
            }
        } catch (err: any) {
            logger.error(`[block:send] Error sending block ${blockId}:`, err);
        }
    })();

    return { success: true, message: 'Block sending initiated' };
  });
}
