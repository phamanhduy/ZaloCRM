<template>
  <div
    class="chat-contact-panel d-flex flex-column h-100"
    style="background-color: var(--z-main-bg); overflow-y: auto; border-left: 1px solid #dbdbdb;"
  >
    <!-- Header -->
    <div class="pa-4 d-flex align-center border-b" style="height: 64px;">
      <span class="font-weight-bold text-subtitle-1">Thông tin khách hàng</span>
    </div>

    <!-- Content -->
    <div class="pa-4">
      <!-- Profile Header -->
      <div v-if="props.contact" class="d-flex flex-column align-center mb-6">
        <v-avatar size="80" class="mb-3">
          <v-img :src="props.contact.avatarUrl || 'https://github.com/identicons/jasonlong.png'" />
        </v-avatar>
        <div class="text-h6 font-weight-bold">{{ props.contact.fullName }}</div>
        <div class="d-flex align-center mt-1">
          <v-chip
            :color="scoreColor(props.contact.leadScore)"
            size="x-small"
            variant="flat"
            class="mr-2"
          >
            {{ props.contact.leadScore ?? 0 }} điểm
          </v-chip>
          <span v-if="props.contact.lastActivity" class="text-caption text-disabled">
            HĐ: {{ relativeTime(props.contact.lastActivity) }}
          </span>
        </div>
      </div>

      <!-- Form -->
      <div class="contact-form">
        <div class="text-caption font-weight-bold mb-1 opacity-50">THÔNG TIN CƠ BẢN</div>
        <v-text-field v-model="form.phone" label="Số điện thoại" density="compact" variant="solo-filled" flat class="mb-3" hide-details />
        <v-text-field v-model="form.email" label="Email" type="email" density="compact" variant="solo-filled" flat class="mb-3" hide-details />

        <div class="text-caption font-weight-bold mb-1 opacity-50 mt-4">PHÂN LOẠI</div>
        <v-select v-model="form.status" label="Trạng thái" :items="STATUS_OPTIONS" item-title="text" item-value="value"
          density="compact" variant="solo-filled" flat class="mb-3" hide-details />
        <v-select v-model="form.source" label="Nguồn" :items="SOURCE_OPTIONS" item-title="text" item-value="value"
          density="compact" variant="solo-filled" flat class="mb-3" hide-details />

        <div class="text-caption font-weight-bold mb-1 opacity-50 mt-4">GHI CHÚ</div>
        <v-textarea v-model="form.notes" placeholder="Nhập ghi chú khách hàng..." rows="3" auto-grow
          density="compact" variant="solo-filled" flat class="mb-4" hide-details />

        <v-btn color="primary" block flat class="font-weight-bold" :loading="saving" @click="saveContact">CẬP NHẬT</v-btn>

        <v-snackbar v-model="saveSuccess" color="success" timeout="2000">Đã cập nhật thành công!</v-snackbar>
        <v-snackbar v-model="saveError" color="error" timeout="3000">Lỗi cập nhật!</v-snackbar>
      </div>

      <v-divider class="my-6 opacity-10" />

      <!-- AI Analysis Section -->
      <div class="ai-analysis-section">
        <div class="d-flex align-center mb-3">
          <v-icon icon="mdi-robot-outline" class="mr-2" color="primary" />
          <span class="text-subtitle-2 font-weight-bold">PHÂN TÍCH AI</span>
          <v-spacer />
          <v-btn icon="mdi-refresh" variant="text" size="x-small" :loading="aiSummaryLoading || aiSentimentLoading" @click="refreshAi" />
        </div>

        <v-card variant="tonal" class="mb-4 rounded-lg overflow-hidden border">
          <div class="pa-3">
            <div class="d-flex align-center mb-2">
              <span class="text-caption font-weight-bold opacity-60">TỔNG HỢP</span>
            </div>
            <div v-if="aiSummaryLoading" class="pa-2 text-center"><v-progress-circular indeterminate size="20" /></div>
            <div v-else class="text-body-2 line-height-relaxed">{{ aiSummary || 'Chưa có tóm tắt hội thoại' }}</div>
          </div>
        </v-card>

        <v-card variant="tonal" class="rounded-lg overflow-hidden border">
          <div class="pa-3">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold opacity-60">THÁI ĐỘ</span>
              <AiSentimentBadge :sentiment="aiSentiment" />
            </div>
            <div v-if="aiSentimentLoading" class="pa-2 text-center"><v-progress-circular indeterminate size="20" /></div>
            <div v-else class="text-body-2">{{ aiSentiment?.reason || 'Chưa phân tích cảm xúc' }}</div>
          </div>
        </v-card>
      </div>

      <v-divider class="my-6 opacity-10" />

      <!-- Appointments -->
      <ChatAppointments
        v-if="props.contactId"
        :contact-id="props.contactId"
        :appointments="contactAppointments"
        @refresh="reloadAppointments"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { SOURCE_OPTIONS, STATUS_OPTIONS } from '@/composables/use-contacts';
import type { Contact } from '@/composables/use-contacts';
import type { AiSentiment } from '@/composables/use-chat';
import { useChatContactPanel } from '@/composables/use-chat-contact-panel';
import ChatAppointments from './ChatAppointments.vue';
import AiSentimentBadge from '@/components/ai/ai-sentiment-badge.vue';

const props = defineProps<{
  contactId: string | null;
  contact: Contact | null;
  aiSummary: string;
  aiSummaryLoading: boolean;
  aiSentiment: AiSentiment | null;
  aiSentimentLoading: boolean;
}>();

const emit = defineEmits<{ close: []; saved: []; 'refresh-ai-summary': []; 'refresh-ai-sentiment': [] }>();

const {
  form, saving, saveSuccess, saveError,
  contactAppointments,
  saveContact, reloadAppointments,
} = useChatContactPanel(
  () => props.contactId,
  () => props.contact,
  () => emit('saved'),
);

function refreshAi() {
  emit('refresh-ai-summary');
  emit('refresh-ai-sentiment');
}

function scoreColor(score: number) {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'error';
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}p trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  return `${days} ngày trước`;
}
</script>

<style scoped>
.line-height-relaxed {
  line-height: 1.6 !important;
}

.chat-contact-panel {
  border-left: 1px solid var(--z-border);
}

:deep(.v-field--variant-solo-filled) {
  background: var(--z-sidebar-active) !important;
  border-radius: 8px !important;
}

:deep(.v-label) {
  font-size: 13px;
  opacity: 0.7;
}
</style>
