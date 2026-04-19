<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="900px">
    <v-card v-if="campaign" class="rounded-lg overflow-hidden">
      <v-card-title class="pa-4 bg-grey-lighten-4 d-flex align-center">
        <div>
          <div class="text-h6 font-weight-bold">{{ campaign.name }}</div>
          <div class="text-caption text-disabled">Chi tiết chiến dịch - {{ formatDate(campaign.createdAt) }}</div>
        </div>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-card-title>

      <v-card-text class="pa-6">
        <v-row>
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="primary" class="text-center pa-4">
              <div class="text-h4 font-weight-bold">{{ campaign.stats.total }}</div>
              <div class="text-caption">Tổng khách hàng</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="success" class="text-center pa-4">
              <div class="text-h4 font-weight-bold">{{ campaign.stats.sent }}</div>
              <div class="text-caption">Đã gửi thành công</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="error" class="text-center pa-4">
              <div class="text-h4 font-weight-bold">{{ campaign.stats.error }}</div>
              <div class="text-caption">Gửi lỗi</div>
            </v-card>
          </v-col>
        </v-row>

        <div class="text-subtitle-1 font-weight-bold mt-8 mb-4">Nhật ký gửi tin</div>
        
        <v-data-table
          :headers="headers"
          :items="logs"
          :loading="loading"
          density="compact"
          class="border rounded-lg"
        >
          <template #item.contact="{ item }">
            <div class="d-flex align-center py-1">
              <v-avatar size="24" class="mr-2">
                <v-img :src="item.contact?.avatarUrl" />
              </v-avatar>
              <div>
                <div class="text-caption font-weight-bold">{{ item.contact?.fullName || 'N/A' }}</div>
                <div class="text-tiny text-disabled">{{ item.contact?.phone || '' }}</div>
              </div>
            </div>
          </template>
          <template #item.status="{ item }">
            <v-chip
              :color="item.status === 'sent' ? 'success' : 'error'"
              size="x-small"
              variant="flat"
            >
              {{ item.status === 'sent' ? 'Thành công' : 'Lỗi' }}
            </v-chip>
          </template>
          <template #item.sentAt="{ item }">
            <span class="text-caption">{{ item.sentAt ? formatTime(item.sentAt) : '—' }}</span>
          </template>
          <template #item.errorMessage="{ item }">
            <span class="text-caption text-error">{{ item.errorMessage || '—' }}</span>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@/api';

const props = defineProps<{
  modelValue: boolean;
  campaign: any | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>();

const logs = ref<any[]>([]);
const loading = ref(false);

const headers = [
  { title: 'Thời gian', key: 'sentAt', width: '130px' },
  { title: 'Khách hàng', key: 'contact', width: '200px' },
  { title: 'Trạng thái', key: 'status', width: '100px' },
  { title: 'Ghi chú / Lỗi', key: 'errorMessage' },
];

async function fetchLogs() {
  if (!props.campaign) return;
  loading.value = true;
  try {
    const res = await api.get(`/marketing/campaigns/${props.campaign.id}/stats`);
    logs.value = res.data.recentLogs;
  } catch (err) {
    console.error('Failed to fetch campaign logs', err);
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue, (val) => {
  if (val) fetchLogs();
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>

<style scoped>
.text-tiny {
  font-size: 10px;
}
</style>

