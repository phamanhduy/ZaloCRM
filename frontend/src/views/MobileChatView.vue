<template>
  <div class="mobile-chat h-100 bg-white">
    <v-fade-transition hide-on-leave>
      <!-- Conversation list (shown when no conversation selected) -->
      <div v-if="!chatStore.selectedConvId" class="h-100 d-flex flex-column">
        <div class="pa-4 pb-0 d-flex align-center justify-space-between">
          <h1 class="text-h5 font-weight-bold">Tin nhắn</h1>
          <v-btn icon="mdi-magnify" variant="text" />
        </div>
        
        <div class="pa-4 pt-2 flex-grow-1 overflow-y-auto">
          <v-list lines="two" class="pa-0">
             <v-list-item
              v-for="conv in chatStore.conversations"
              :key="conv.id"
              :active="conv.id === chatStore.selectedConvId"
              class="px-0 py-2 border-b"
              @click="chatStore.selectConversation(conv.id)"
            >
              <template #prepend>
                <v-avatar size="56" class="mr-3" style="border: 1px solid rgba(0,0,0,0.05)">
                  <v-img 
                    v-if="conv.contact?.avatarUrl" 
                    :src="conv.contact.avatarUrl" 
                    referrerpolicy="no-referrer"
                    cover
                  />
                  <v-icon v-else :icon="conv.threadType === 'group' ? 'mdi-account-group' : 'mdi-account'" />
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-bold">
                {{ conv.contact?.fullName || 'Người dùng Zalo' }}
              </v-list-item-title>
              
              <v-list-item-subtitle class="mt-1">
                {{ lastMessageText(conv) }}
              </v-list-item-subtitle>

              <template #append>
                <div class="d-flex flex-column align-end">
                  <span class="text-tiny text-grey mb-1">{{ formatTime(conv.lastMessageAt) }}</span>
                  <v-badge
                    v-if="conv.unreadCount > 0"
                    color="error"
                    :content="conv.unreadCount"
                    inline
                  />
                </div>
              </template>
            </v-list-item>
          </v-list>

          <div v-if="chatStore.conversations.length === 0 && !chatStore.loadingConvs" class="pa-8 text-center text-grey">
            Chưa có cuộc hội thoại nào
          </div>
        </div>
      </div>

      <!-- Message thread (shown when conversation selected) -->
      <div v-else class="h-100 d-flex flex-column">
        <!-- App Bar style header -->
        <div class="d-flex align-center px-2 py-1 border-b bg-white shadow-sm" style="z-index: 10;">
          <v-btn icon="mdi-chevron-left" variant="text" size="large" @click="chatStore.selectedConvId = null" />
          
          <v-avatar size="36" class="mx-1">
            <v-img 
              v-if="chatStore.selectedConv?.contact?.avatarUrl" 
              :src="chatStore.selectedConv.contact.avatarUrl" 
              referrerpolicy="no-referrer" 
              cover
            />
            <v-icon v-else icon="mdi-account" />
          </v-avatar>

          <div class="ml-2 overflow-hidden">
            <div class="text-subtitle-2 font-weight-bold text-truncate">
              {{ chatStore.selectedConv?.contact?.fullName || 'Chat' }}
            </div>
            <div class="text-tiny text-success d-flex align-center">
              <v-icon size="8" class="mr-1">mdi-circle</v-icon> Đang hoạt động
            </div>
          </div>
          
          <v-spacer />
          <v-btn icon="mdi-phone-outline" variant="text" size="small" />
          <v-btn icon="mdi-dots-vertical" variant="text" size="small" />
        </div>

        <MessageThread
          :conversation="chatStore.selectedConv"
          :messages="chatStore.messages"
          :loading="chatStore.loadingMsgs"
          :sending="chatStore.sendingMsg"
          :show-contact-panel="false"
          :hide-header="true"
          :ai-suggestion="(null as any)"
          :ai-suggestion-loading="false"
          :ai-suggestion-error="(null as any)"
          @send="chatStore.sendMessage"
          class="flex-grow-1"
        />
      </div>
    </v-fade-transition>
  </div>
</template>

<script setup lang="ts">
import { useChatStore, type Conversation } from '@/stores/chat';
import MessageThread from '@/components/chat/MessageThread.vue';

const chatStore = useChatStore();

function lastMessageText(conv: Conversation) {
  const msg = conv.lastMessage || (conv.messages && conv.messages.length > 0 ? conv.messages[0] : null);
  if (!msg) return 'Chưa có tin nhắn';
  if (msg.isDeleted) return 'Tin nhắn đã được thu hồi';
  if (msg.contentType === 'image') return '[Hình ảnh]';
  if (msg.contentType === 'file') return '[Tệp tin]';
  
  const content = msg.content || '';
  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      return p.title || p.text || 'Tin nhắn mới...';
    } catch { return content; }
  }
  return content;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
</script>

<style scoped>
.mobile-chat {
  position: relative;
  overflow: hidden;
}

.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
}

.text-tiny {
  font-size: 11px;
}
</style>

