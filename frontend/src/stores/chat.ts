import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/index';
import { io, Socket } from 'socket.io-client';
import type { Contact } from '@/composables/use-contacts';

let socket: Socket | null = null;

interface ZaloAccount {
  id: string;
  displayName: string | null;
}

export interface AiSentiment {
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
  reason: string;
}

export interface Conversation {
  id: string;
  threadType: 'user' | 'group';
  contact: Contact | null;
  zaloAccount: ZaloAccount | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isReplied: boolean;
  isFriendRequest: boolean;
  friendRequestMessage: string | null;
  lastMessage?: Message | null;
  messages?: Message[];
}

export interface Message {
  id: string;
  content: string | null;
  contentType: string;
  senderType: string;
  senderName: string | null;
  sentAt: string;
  isDeleted: boolean;
  zaloMsgId: string | null;
  senderAvatar?: string | null;
  attachments?: any[];
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([]);
  const selectedConvId = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const loadingConvs = ref(false);
  const loadingMsgs = ref(false);
  const sendingMsg = ref(false);
  const searchQuery = ref('');
  const accountFilter = ref<string | null>(null);

  const zaloAccounts = ref<any[]>([]);

  const aiSuggestion = ref('');
  const aiSuggestionLoading = ref(false);
  const aiSuggestionError = ref('');
  const aiSummary = ref('');
  const aiSummaryLoading = ref(false);
  const aiSentiment = ref<AiSentiment | null>(null);
  const aiSentimentLoading = ref(false);

  const unreadFilter = ref(false);
  const statusFilter = ref<string | null>(null);

  const selectedConv = computed(() =>
    conversations.value.find(c => c.id === selectedConvId.value) || null,
  );

  async function fetchAccounts() {
    try {
      const res = await api.get('/zalo-accounts');
      zaloAccounts.value = res.data;
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }

  async function fetchConversations() {
    loadingConvs.value = true;
    try {
      const res = await api.get('/conversations', {
        params: {
          limit: 100,
          search: searchQuery.value,
          accountId: accountFilter.value || undefined,
          unread: unreadFilter.value || undefined,
          status: statusFilter.value || undefined
        },
      });
      conversations.value = res.data.conversations;
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      loadingConvs.value = false;
    }
  }

  async function fetchMessages(convId: string) {
    loadingMsgs.value = true;
    try {
      const res = await api.get(`/conversations/${convId}/messages`, {
        params: { limit: 100 },
      });
      messages.value = res.data.messages;
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      loadingMsgs.value = false;
    }
  }

  async function selectConversation(convId: string) {
    selectedConvId.value = convId;
    aiSuggestion.value = '';
    aiSuggestionError.value = '';
    aiSummary.value = '';
    aiSentiment.value = null;

    await fetchMessages(convId);

    try {
      await api.post(`/conversations/${convId}/mark-read`);
      const conv = conversations.value.find(c => c.id === convId);
      if (conv) conv.unreadCount = 0;
    } catch { }

    generateAiSummary();
    generateAiSentiment();
  }

  async function sendMessage(content: string) {
    if (!selectedConvId.value || !content.trim()) return;
    sendingMsg.value = true;
    try {
      const res = await api.post(`/conversations/${selectedConvId.value}/messages`, { content });
      if (!messages.value.find(m => m.id === res.data.id)) {
        messages.value.push(res.data);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      sendingMsg.value = false;
    }
  }

  async function generateAiSuggestion() {
    if (!selectedConvId.value) return;
    aiSuggestionLoading.value = true;
    aiSuggestionError.value = '';
    try {
      const res = await api.post('/ai/suggest', { conversationId: selectedConvId.value });
      aiSuggestion.value = res.data.content || '';
    } catch (err: any) {
      aiSuggestionError.value = err.response?.data?.error || 'Lỗi tạo gợi ý AI';
    } finally {
      aiSuggestionLoading.value = false;
    }
  }

  async function generateAiSummary() {
    if (!selectedConvId.value) return;
    aiSummaryLoading.value = true;
    try {
      const res = await api.post(`/ai/summarize/${selectedConvId.value}`);
      aiSummary.value = res.data.content || '';
    } catch { } finally { aiSummaryLoading.value = false; }
  }

  async function generateAiSentiment() {
    if (!selectedConvId.value) return;
    aiSentimentLoading.value = true;
    try {
      const res = await api.post(`/ai/sentiment/${selectedConvId.value}`);
      aiSentiment.value = res.data;
    } catch { } finally { aiSentimentLoading.value = false; }
  }

  const isSocketConnected = ref(false);

  function initSocket() {
    if (socket?.connected) return;

    const token = localStorage.getItem('token');
    socket = io({
      transports: ['websocket'],
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
      isSocketConnected.value = true;
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      isSocketConnected.value = false;
    });

    socket.on('chat:message', (data: { message: Message; conversationId: string }) => {
      if (data.conversationId === selectedConvId.value) {
        if (!messages.value.find(m => m.id === data.message.id)) {
          messages.value.push(data.message);
        }
      }
      fetchConversations();
    });

    socket.on('chat:deleted', (data: { msgId: string }) => {
      const msg = messages.value.find(m => m.zaloMsgId === data.msgId);
      if (msg) msg.isDeleted = true;
    });

    socket.on('chat:refresh-conversations', () => {
      fetchConversations();
    });
  }

  function destroySocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
      isSocketConnected.value = false;
    }
  }

  return {
    conversations, selectedConvId, selectedConv, messages,
    loadingConvs, loadingMsgs, sendingMsg, searchQuery, accountFilter, zaloAccounts,
    aiSuggestion, aiSuggestionLoading, aiSuggestionError,
    aiSummary, aiSummaryLoading, aiSentiment, aiSentimentLoading,
    isSocketConnected,
    fetchConversations, fetchAccounts, selectConversation, sendMessage,
    generateAiSuggestion, generateAiSummary, generateAiSentiment,
    initSocket, destroySocket
  };
});
