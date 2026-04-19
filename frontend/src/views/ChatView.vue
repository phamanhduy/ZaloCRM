<template>
  <MobileChatView v-if="isMobile" />
  <div v-else class="chat-container h-100 d-flex overflow-hidden">
    <!-- Message thread — flexible center -->
    <MessageThread
      :conversation="chatStore.selectedConv"
      :messages="chatStore.messages"
      :loading="chatStore.loadingMsgs"
      :sending="chatStore.sendingMsg"
      :ai-suggestion="chatStore.aiSuggestion"
      :ai-suggestion-loading="chatStore.aiSuggestionLoading"
      :ai-suggestion-error="chatStore.aiSuggestionError"
      @send="chatStore.sendMessage"
      @ask-ai="chatStore.generateAiSuggestion"
      @toggle-contact-panel="showContactPanel = !showContactPanel"
      :show-contact-panel="showContactPanel"
      class="flex-grow-1 h-100"
    />

    <!-- Contact panel — resizable -->
    <div v-if="showContactPanel && chatStore.selectedConv?.contact" class="chat-panel-right h-100 border-l" :style="{ width: rightWidth + 'px' }">
      <div class="resize-handle resize-handle-left" @mousedown="startResize($event)" />
      <ChatContactPanel
        :contact-id="chatStore.selectedConv.contact.id"
        :contact="chatStore.selectedConv.contact"
        :ai-summary="chatStore.aiSummary"
        :ai-summary-loading="chatStore.aiSummaryLoading"
        :ai-sentiment="chatStore.aiSentiment"
        :ai-sentiment-loading="chatStore.aiSentimentLoading"
        @refresh-ai-summary="chatStore.generateAiSummary"
        @refresh-ai-sentiment="chatStore.generateAiSentiment"
        @close="showContactPanel = false"
        @saved="chatStore.fetchConversations"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MessageThread from '@/components/chat/MessageThread.vue';
import ChatContactPanel from '@/components/chat/ChatContactPanel.vue';
import { useChatStore } from '@/stores/chat';
import MobileChatView from '@/views/MobileChatView.vue';
import { useMobile } from '@/composables/use-mobile';

const { isMobile } = useMobile();
const chatStore = useChatStore();

const showContactPanel = ref(true);

// Resizable panel widths
const rightWidth = ref(parseInt(localStorage.getItem('chat-right-width') || '340'));

let startX = 0;
let startWidth = 0;

function startResize(e: MouseEvent) {
  startX = e.clientX;
  startWidth = rightWidth.value;
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onResize(e: MouseEvent) {
  const diff = e.clientX - startX;
  rightWidth.value = Math.max(300, Math.min(600, startWidth - diff));
}

function stopResize() {
  localStorage.setItem('chat-right-width', String(rightWidth.value));
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}
</script>

<style scoped>
.chat-container {
  background-color: var(--z-main-bg);
}

.chat-panel-right {
  position: relative;
  flex-shrink: 0;
  background-color: var(--z-main-bg);
  border-left: 1px solid var(--z-border);
}

.resize-handle {
  position: absolute;
  top: 0;
  left: -2px;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.2s;
}

.resize-handle:hover,
.resize-handle:active {
  background: rgba(var(--v-theme-primary), 0.3);
}
</style>
