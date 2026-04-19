<template>
  <div class="message-thread d-flex flex-column flex-grow-1" style="height: 100%; background-color: #e9ebed; position: relative;">
    <!-- Empty state -->
    <div v-if="!conversation" class="d-flex align-center justify-center flex-grow-1">
      <div class="text-center">
        <v-icon icon="mdi-chat-outline" size="120" color="grey-darken-4" />
        <p class="text-h6 mt-4 text-disabled">Chọn một cuộc trò chuyện để bắt đầu</p>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="chat-header px-4 d-flex align-center flex-shrink-0">
        <v-avatar size="40" class="mr-3">
          <v-icon v-if="conversation.threadType === 'group'" icon="mdi-account-group" />
          <v-img v-else-if="conversation.contact?.avatarUrl" :src="conversation.contact.avatarUrl" />
          <v-icon v-else icon="mdi-account" />
        </v-avatar>
        
        <div class="flex-grow-1 overflow-hidden">
          <div class="text-subtitle-1 font-weight-bold text-truncate" style="color: var(--z-text-primary);">
            {{ conversation.contact?.fullName || 'Người dùng Zalo' }}
          </div>
          <div class="text-caption d-flex align-center" style="color: var(--z-text-secondary); font-weight: 500;">
            <span v-if="conversation.threadType === 'group'">180 thành viên</span>
            <span v-else>Vừa mới truy cập</span>
          </div>
        </div>

        <div class="header-actions d-flex align-center">
          <v-btn icon="mdi-magnify" variant="text" size="small" />
          <v-btn icon="mdi-phone-outline" variant="text" size="small" />
          <v-btn icon="mdi-video-outline" variant="text" size="small" />
          <v-btn
            icon="mdi-dock-right"
            variant="text" size="small"
            :color="showContactPanel ? 'primary' : undefined"
            @click="$emit('toggle-contact-panel')"
          />
        </div>
      </div>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="flex-grow-1 overflow-y-auto pa-4 chat-messages-area">
        <div v-if="loading" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate size="24" color="primary" />
        </div>
        
        <div v-for="(msg, index) in messages" :key="msg.id" class="message-wrapper mb-4">
          <!-- Date separator -->
          <div v-if="shouldShowDate(msg, index)" class="text-center my-6">
            <v-chip size="x-small" color="rgba(0,0,0,0.1)" class="text-uppercase font-weight-bold" style="color: rgba(0,0,0,0.5) !important;">
              {{ formatDateHeader(msg.sentAt) }}
            </v-chip>
          </div>

          <div class="d-flex" :class="msg.senderType === 'self' ? 'justify-end' : 'justify-start'">
            <!-- Avatar for incoming messages -->
            <v-avatar v-if="msg.senderType !== 'self'" size="38" class="mr-3 mt-1 flex-shrink-0">
              <v-img :src="msg.senderAvatar || conversation.contact?.avatarUrl || ''" referrerpolicy="no-referrer" />
            </v-avatar>

            <div class="d-flex flex-column" :style="{ maxWidth: '75%' }">
              <!-- Sender Name for incoming -->
              <div v-if="msg.senderType !== 'self'" class="text-caption mb-1 ml-1 font-weight-medium" style="color: #4a4a4a;">
                {{ conversation.threadType === 'group' ? (msg.senderName || 'Thành viên') : conversation.contact?.fullName }}
              </div>

              <div 
                class="chat-bubble" 
                :class="msg.senderType === 'self' ? 'chat-bubble-out' : 'chat-bubble-in'"
              >
                <!-- Message Content -->
                <div v-if="msg.isDeleted" class="text-decoration-line-through font-italic opacity-50 text-caption">
                  Tin nhắn đã được thu hồi
                </div>

                <div v-else-if="getImageUrl(msg)">
                  <img :src="getImageUrl(msg)!" class="chat-image rounded-lg" @click="openPreview(getImageUrl(msg)!)" />
                </div>

                <div v-else-if="getFileInfo(msg)" class="file-card d-flex align-center pa-3 rounded-lg">
                  <v-icon size="40" color="blue-lighten-2" class="mr-3">mdi-file-document-outline</v-icon>
                  <div class="flex-grow-1 overflow-hidden">
                    <div class="text-body-2 font-weight-bold text-truncate" style="color: #000;">{{ getFileInfo(msg)!.name }}</div>
                    <div class="text-caption opacity-60">{{ getFileInfo(msg)!.size }}</div>
                  </div>
                  <v-btn icon="mdi-download" variant="text" size="small" @click="openFile(getFileInfo(msg)!.href)" />
                </div>

                <div v-else class="text-body-1" style="white-space: pre-wrap; color: #000; line-height: 1.4;">{{ parseDisplayContent(msg.content) }}</div>

                <!-- Footer (Time) -->
                <div class="d-flex justify-end mt-1">
                  <span class="text-tiny" style="color: #727272; font-size: 11px;">{{ formatMessageTime(msg.sentAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Scroll anchor -->
        <div class="pb-4" />
      </div>

      <!-- Chat Input Area -->
      <div class="chat-input-container border-t flex-shrink-0">
        <div class="input-toolbar d-flex align-center px-3 py-1">
          <!-- Emoji Picker -->
          <v-menu :close-on-content-click="false" location="top">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" icon="mdi-emoticon-outline" variant="text" size="small" style="color: #4a4a4a;" />
            </template>
            <v-card class="pa-2 emoji-picker-card" width="350" elevation="8">
              <div class="emoji-grid">
                <v-btn
                  v-for="e in emojis"
                  :key="e"
                  variant="text"
                  size="small"
                  class="emoji-btn"
                  @click="addEmoji(e)"
                >
                  {{ e }}
                </v-btn>
              </div>
            </v-card>
          </v-menu>

          <v-btn icon="mdi-image-outline" variant="text" size="small" style="color: #4a4a4a;" @click="$refs.imageInput.click()" />
          <v-btn icon="mdi-paperclip" variant="text" size="small" style="color: #4a4a4a;" @click="$refs.fileInput.click()" />
          
          <v-spacer />
          <v-btn icon="mdi-robot-outline" variant="text" size="small" color="primary" @click="$emit('ask-ai')" />

          <!-- Hidden inputs -->
          <input ref="imageInput" type="file" accept="image/*" class="d-none" @change="onFileChange($event, 'image')" />
          <input ref="fileInput" type="file" class="d-none" @change="onFileChange($event, 'file')" />
        </div>

        <div class="d-flex align-end">
          <v-textarea
            v-model="inputText"
            :placeholder="` Nhập @, tin nhắn tới ${conversation.contact?.fullName || 'Người dùng'}`"
            rows="1"
            auto-grow
            max-rows="6"
            variant="plain"
            hide-details
            class="chat-textarea flex-grow-1"
            @keydown.enter.exact.prevent="handleSend"
          />
          
          <div class="d-flex align-center ml-2 mb-1">
            <v-btn v-if="inputText.trim()" color="primary" variant="text" size="small" class="font-weight-bold" @click="handleSend">GỬI</v-btn>
            <v-btn v-else icon="mdi-thumb-up" variant="text" size="small" style="color: #4a4a4a;" @click="sendLike" />
          </div>
        </div>
      </div>
    </template>

    <v-dialog v-model="showImagePreview" max-width="90vw" width="auto">
      <v-card color="transparent" flat class="d-flex align-center justify-center">
        <v-img 
          :src="previewImageUrl" 
          max-height="90vh" 
          width="auto"
          min-width="200"
          contain 
          referrerpolicy="no-referrer"
        />
      </v-card>
    </v-dialog>
    
    <!-- Error Notification -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      location="bottom right"
      :timeout="3000"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Đóng</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import axios from 'axios';
import { api } from '@/api/index';
import { useChatStore } from '@/stores/chat';
import type { Conversation, Message } from '@/stores/chat';

const props = defineProps<{
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  showContactPanel?: boolean;
}>();

const chatStore = useChatStore();
const emit = defineEmits<{ send: [content: string]; 'toggle-contact-panel': []; 'ask-ai': [] }>();

const inputText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const previewImageUrl = ref('');
const showImagePreview = ref(false);

const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('error');

const blockedExtensions = ['.exe', '.msi', '.bat', '.sh', '.php', '.js', '.vbs', '.cmd', '.scr'];

const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😻','😼','😽','🙀','😿','😾'];

function showError(text: string) {
  snackbarText.value = text;
  snackbarColor.value = 'error';
  showSnackbar.value = true;
}

function addEmoji(emoji: string) {
  inputText.value += emoji;
}

function openPreview(url: string) {
  previewImageUrl.value = url;
  showImagePreview.value = true;
}

async function onFileChange(event: Event, type: 'image' | 'file') {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !props.conversation) return;

  // Check extension
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (blockedExtensions.includes(ext)) {
    showError(`Định dạng tệp ${ext} không được phép gửi.`);
    target.value = '';
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const { path, fileName, mimeType } = res.data;
    
    // Send message with attachment
    await api.post(`/conversations/${props.conversation!.id}/messages`, {
      content: '',
      contentType: type,
      attachments: [{
        path,
        fileName: file.name,
        type: mimeType
      }]
    });

    // Reset input
    target.value = '';
    await chatStore.fetchMessages(props.conversation!.id);
  } catch (err: any) {
    console.error('Upload failed:', err);
    const errorMsg = err.response?.data?.error || err.message || 'Lỗi không xác định';
    showError(`Gửi tệp thất bại: ${errorMsg}`);
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function handleSend() { 
  if (!inputText.value.trim() || !props.conversation) return; 
  emit('send', inputText.value); 
  inputText.value = ''; 
}

function sendLike() {
  if (!props.conversation) return;
  emit('send', '👍');
}
function formatMessageTime(d: string) { return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
function formatDateHeader(d: string) { 
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Hôm nay';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); 
}
function shouldShowDate(msg: Message, index: number) {
  if (index === 0) return true;
  const prevDate = new Date(props.messages[index-1].sentAt).toDateString();
  const currDate = new Date(msg.sentAt).toDateString();
  return prevDate !== currDate;
}
function openFile(url: string) { window.open(url, '_blank'); }

// --- Content Helpers ---
function getImageUrl(msg: Message) {
  // Check new attachments first
  if (msg.attachments && msg.attachments.length > 0) {
    const att = msg.attachments[0];
    if (msg.contentType === 'image' || att.type?.includes('image')) {
       const parts = att.path.split(/[\\/]/);
       const base = parts[parts.length - 1];
       return att.path.includes('http') ? att.path : `/uploads/${base}`;
    }
  }

  if (msg.contentType === 'image') {
    try { 
      const p = JSON.parse(msg.content!); 
      return p.href || p.thumb || msg.content; 
    } catch { return msg.content; }
  }
  return null;
}

function getFileInfo(msg: Message) {
  // Check new attachments first
  if (msg.attachments && msg.attachments.length > 0) {
    const att = msg.attachments[0];
    if (msg.contentType === 'file' || att.type) {
       const parts = att.path.split(/[\\/]/);
       const base = parts[parts.length - 1];
       return { 
         name: att.fileName || 'Tệp tin', 
         size: 'Đã tải lên', 
         href: att.path.includes('http') ? att.path : `/uploads/${base}` 
       };
    }
  }

  if (msg.contentType === 'file' || msg.content?.includes('fileSize')) {
    try {
      const p = JSON.parse(msg.content!);
      const params = typeof p.params === 'string' ? JSON.parse(p.params) : p.params;
      return { name: p.title || 'Tệp tin', size: params?.fileSize || 'Unknown', href: p.href || '' };
    } catch { return null; }
  }
  return null;
}
function isReminderMessage(msg: Message) {
  try { const p = JSON.parse(msg.content!); return p.action === 'msginfo.actionlist'; } catch { return false; }
}
function getReminderTitle(msg: Message) { try { return JSON.parse(msg.content!).title || 'Nhắc hẹn'; } catch { return 'Nhắc hẹn'; } }
const emoticonMap: Record<string, string> = {
  ":-)": "🙂", ":)": "🙂", ":-(": "☹️", ":(": "☹️", ";-)": "😉", ";)": "😉", 
  ":-P": "😛", ":P": "😛", ":-D": "😃", ":D": "😃", ":-O": "😲", ":O": "😲", 
  "8-)": "😎", "8)": "😎", ":-|": "😐", ":|": "😐", ":-/": "😕", ":/": "😕", 
  ":-x": "🤐", ":x": "🤐", "X-(": "😫", "X(": "😫", ":-!": "🤯", ":!": "🤯", 
  ":-*": "😘", ":*": "😘", ":-?": "🤔", ":?": "🤔", ":-S": "😟", ":S": "😟", 
  ":-~": "🥴", ":~": "🥴", ":b": "👍", ":-b": "👍", "0:-)": "😇", "0:)": "😇", 
  ">:-)": "😈", ">:)": "😈", ":-ss": "😟", ":ss": "😟", ":((": "😭", ":-&": "🤢", 
  ":&": "🤢", ":-$": "🤑", ":$": "🤑", ":-B": "🤓", ":B": "🤓", ":-f": "😤", 
  ":f": "😤", ":-t": "😠", ":t": "😠", ":-q": "😴", ":q": "😴", ":-w": "😜", 
  ":w": "😜", ":-e": "😱", ":e": "😱", ":-r": "😨", ":r": "😨", ":-h": "🤗", 
  ":h": "🤗", ":-g": "🙄", ":g": "🙄", ":-c": "😖", ":c": "😖", ":-v": "🤤", 
  ":v": "🤤", ":-z": "🥱", ":z": "🥱", ":-u": "🥳", ":u": "🥳"
};

function parseDisplayContent(c: string | null) {
  if (!c) return '';
  
  let text = c;
  if (!c.startsWith('{')) {
    const sortedKeys = Object.keys(emoticonMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(escapedKey, 'g'), emoticonMap[key]);
    }
  }

  if (text.startsWith('{')) {
    try {
      const p = JSON.parse(text);
      if (p.catId && p.id && p.type === 7) return '[Nhãn dán]';
      return p.title || p.text || p.desc || text;
    } catch { return text; }
  }
  return text;
}

async function syncAppointment(msg: Message) {
  emit('send', 'Tôi xác nhận lịch hẹn này.');
}

watch(() => props.messages.length, async () => { 
  await nextTick(); 
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: 'smooth' });
  }
}, { immediate: true });
</script>

<style scoped>
.chat-header {
  height: 64px;
  background-color: var(--z-main-bg);
  border-bottom: 1px solid var(--z-border);
}

.chat-messages-area {
  scroll-behavior: smooth;
}

.chat-input-container {
  background-color: var(--z-main-bg);
  border-top: 1px solid var(--z-border);
}

.chat-textarea :deep(textarea) {
  font-size: 15px !important;
  color: var(--z-text-primary) !important;
  line-height: 1.5 !important;
  padding: 15px 0 !important;
}

.chat-textarea :deep(textarea::placeholder) {
  color: #757575 !important;
  opacity: 1 !important;
}

.chat-bubble {
  border-radius: 8px !important;
  padding: 10px 14px;
}

.chat-bubble-in {
  background-color: #ffffff;
  border: 1px solid #d1d9e0;
}

.chat-bubble-out {
  background-color: #e5efff;
}

.reminder-bubble {
  background: rgba(255, 160, 0, 0.08);
  border: 1px solid rgba(255, 160, 0, 0.2);
  border-radius: 8px;
}

.file-card {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid var(--z-border);
  min-width: 240px;
}

.chat-image {
  max-width: 100%;
  max-height: 400px;
  cursor: pointer;
}

.text-tiny { font-size: 10px; }
.emoji-picker-card {
  border-radius: 8px !important;
  background-color: #fff !important;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  max-height: 250px;
  overflow-y: auto;
  gap: 2px;
}

.emoji-btn {
  min-width: 0 !important;
  width: 40px !important;
  height: 40px !important;
  padding: 0 !important;
  font-size: 20px !important;
}

.emoji-grid::-webkit-scrollbar {
  width: 4px;
}
.emoji-grid::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 4px;
}
</style>
