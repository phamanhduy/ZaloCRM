/**
 * zalo-listener-factory.ts — sets up zca-js listener events for one Zalo account.
 * Handles message routing, user-info caching, group detection, and undo events.
 * Extracted from ZaloAccountPool to keep zalo-pool.ts under 200 lines.
 */
import type { Server } from 'socket.io';
import { logger } from '../../shared/utils/logger.js';
import { handleIncomingMessage, handleMessageUndo } from '../chat/message-handler.js';
import { detectContentType, updateContactAvatar } from './zalo-message-helpers.js';

// Cached user info entry with 5-minute TTL
export interface UserInfoCacheEntry {
  zaloName: string;
  avatar: string;
  phone?: string;
  cachedAt: number;
}

const USER_INFO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch zaloName + avatar from API with a per-pool in-memory cache
async function resolveZaloName(
  api: any,
  uid: string,
  cache: Map<string, UserInfoCacheEntry>,
): Promise<{ zaloName: string; avatar: string }> {
  const cached = cache.get(uid);
  if (cached && Date.now() - cached.cachedAt < USER_INFO_CACHE_TTL_MS) {
    return { zaloName: cached.zaloName, avatar: cached.avatar };
  }

  try {
    const result = await api.getUserInfo(uid);
    const profiles = result?.changed_profiles || {};
    const profile = profiles[uid] || profiles[`${uid}_0`];
    if (profile) {
      const entry: UserInfoCacheEntry = {
        zaloName:
          profile.zaloName ||
          profile.zalo_name ||
          profile.displayName ||
          profile.display_name ||
          '',
        avatar: profile.avatar || '',
        phone: profile.phoneNumber || '',
        cachedAt: Date.now(),
      };
      cache.set(uid, entry);
      return { zaloName: entry.zaloName, avatar: entry.avatar };
    }
  } catch (err) {
    logger.warn(`[zalo] getUserInfo failed for ${uid}:`, err);
  }
  return { zaloName: '', avatar: '' };
}

// Fetch group info from the zca-js API
async function resolveGroupInfo(api: any, groupId: string): Promise<{ name: string; avatar: string }> {
  try {
    const result = await api.getGroupInfo(groupId);
    const info = result?.gridInfoMap?.[groupId];
    return { name: info?.name || '', avatar: info?.avatar || '' };
  } catch (err) {
    logger.warn(`[zalo] getGroupInfo failed for ${groupId}:`, err);
    return { name: '', avatar: '' };
  }
}

export interface ListenerContext {
  accountId: string;
  api: any;
  io: Server | null;
  userInfoCache: Map<string, UserInfoCacheEntry>;
  onDisconnected: (accountId: string) => void;
}

/**
 * Attach all zca-js listener events for the given account.
 * Calls listener.start() with retryOnClose at the end.
 */
export function attachZaloListener(ctx: ListenerContext): void {
  const { accountId, api, io, userInfoCache, onDisconnected } = ctx;
  const listener = api.listener;

  listener.on('connected', () => {
    logger.info(`[zalo:${accountId}] Listener connected`);
  });

  listener.on('message', async (message: any) => {
    try {
      // ThreadType in zca-js: 0 = User, 1 = Group
      const isGroup = message.type === 1;
      const senderUid = String(message.data?.uidFrom || '');

      // Resolve display name — prefer zaloName from API over dName
      let senderName: string = message.data?.dName || '';
      if (!message.isSelf && senderUid && api.getUserInfo) {
        const userInfo = await resolveZaloName(api, senderUid, userInfoCache);
        if (userInfo.zaloName) senderName = userInfo.zaloName;
        if (userInfo.avatar) updateContactAvatar(senderUid, userInfo.avatar);
      }

      // Resolve group info for group threads
      let groupName: string | undefined;
      if (isGroup && message.threadId) {
        const groupInfo = await resolveGroupInfo(api, message.threadId);
        groupName = groupInfo.name;
        if (groupInfo.avatar) updateContactAvatar(message.threadId, groupInfo.avatar);
      }

      const rawContent = message.data?.content;
      const content =
        typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || '');
      const contentType = detectContentType(message.data?.msgType, rawContent);

      const groupInfo = isGroup && message.threadId ? await resolveGroupInfo(api, message.threadId) : null;
      let senderAvatar = '';
      if (!message.isSelf && senderUid) {
        const userInfo = await resolveZaloName(api, senderUid, userInfoCache);
        if (userInfo.zaloName) senderName = userInfo.zaloName;
        senderAvatar = userInfo.avatar;
      }

      const result = await handleIncomingMessage({
        accountId,
        senderUid,
        senderName,
        content,
        contentType,
        msgId: String(message.data?.msgId || ''),
        timestamp: parseInt(message.data?.ts || String(Date.now())),
        isSelf: message.isSelf || false,
        threadId: message.threadId || '',
        threadType: isGroup ? 'group' : 'user',
        groupName: groupInfo?.name,
        avatarUrl: senderAvatar,
        groupAvatar: groupInfo?.avatar,
        attachments: [],
      });

      if (result) {
        io?.emit('chat:message', {
          accountId,
          message: result.message,
          conversationId: result.conversationId,
        });
      }
    } catch (err) {
      logger.error(`[zalo:${accountId}] Message handler error:`, err);
    }
  });

  listener.on('undo', async (data: any) => {
    const msgId = data.data?.msgId || data.msgId;
    if (msgId) {
      await handleMessageUndo(accountId, String(msgId));
      io?.emit('chat:deleted', { accountId, msgId: String(msgId) });
    }
  });

  listener.on('friend_event', async (data: any) => {
    try {
        logger.info(`[zalo:${accountId}] >>> RECEIVED FRIEND EVENT:`, JSON.stringify(data, null, 2));
        // Type 2 is usually incoming friend request with message
        if (data.type === 2 || data.data?.message) {
          const { handleFriendRequest } = await import('../chat/message-handler.js');
          await handleFriendRequest(accountId, data.data || data);
          io?.emit('chat:refresh-conversations', { accountId });
        }
    } catch (err) {
        logger.error(`[zalo:${accountId}] Friend event handler error:`, err);
    }
  });

  // Catch-all listener for debugging unknown events
  const originalEmit = listener.emit;
  listener.emit = function(event: string, ...args: any[]) {
      logger.info(`[zalo:${accountId}] EVENT: "${event}"`, JSON.stringify(args, null, 2));
      return originalEmit.apply(this, [event, ...args]);
  };

  listener.on('closed', (code: number, reason: string) => {
    logger.warn(`[zalo:${accountId}] Listener closed: ${code} ${reason}`);
    onDisconnected(accountId);
    io?.emit('zalo:disconnected', { accountId, code, reason });
  });

  listener.on('error', (err: any) => {
    logger.error(`[zalo:${accountId}] Listener error:`, err);
  });

  listener.start({ retryOnClose: true });
}
