<template>
  <div class="marketing-view">
    <div class="d-flex align-center mb-6">
      <h1 class="text-h5 font-weight-bold">Auto Marketing</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreator = true">Tạo chiến dịch</v-btn>
    </div>

    <v-row v-if="loading">
      <v-col v-for="i in 3" :key="i" cols="12" md="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="campaigns.length > 0">
      <v-col v-for="camp in campaigns" :key="camp.id" cols="12" md="4">
        <v-card class="rounded-lg border shadow-sm" hover @click="viewStats(camp)">
          <v-card-item>
            <div class="d-flex align-center mb-2">
              <v-chip :color="statusColor(camp.status)" size="x-small" variant="flat" class="mr-2">
                {{ statusLabel(camp.status) }}
              </v-chip>
              <span class="text-caption text-disabled">{{ formatDate(camp.createdAt) }}</span>
            </div>
            <v-card-title class="px-0 pt-0">{{ camp.name }}</v-card-title>
          </v-card-item>

          <v-card-text>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-caption">Tiến độ</span>
              <span class="text-caption font-weight-bold">{{ camp.stats.sent }} / {{ camp.stats.total }}</span>
            </div>
            <v-progress-linear
              :model-value="(camp.stats.sent / (camp.stats.total || 1)) * 100"
              color="primary"
              height="8"
              rounded
            />
            
            <div class="d-flex gap-4 mt-4">
              <div class="text-center flex-grow-1 pa-2 rounded bg-grey-lighten-4">
                <div class="text-h6 font-weight-bold">{{ camp.stats.sent }}</div>
                <div class="text-tiny text-uppercase opacity-60">Đã gửi</div>
              </div>
              <div class="text-center flex-grow-1 pa-2 rounded bg-grey-lighten-4">
                <div class="text-h6 font-weight-bold text-error">{{ camp.stats.error }}</div>
                <div class="text-tiny text-uppercase opacity-60">Lỗi</div>
              </div>
            </div>
          </v-card-text>

          <v-divider />
          <v-card-actions class="pa-4">
            <v-btn 
                v-if="camp.status === 'draft' || camp.status === 'paused' || camp.status === 'failed'"
                variant="tonal" color="primary" block prepend-icon="mdi-play"
                @click.stop="startCampaign(camp.id)"
            >Bắt đầu</v-btn>
            <v-btn v-else variant="text" color="primary" block prepend-icon="mdi-eye-outline">Xem chi tiết</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <div v-else class="pa-12 text-center text-disabled">
      <v-icon icon="mdi-bullhorn-outline" size="64" class="mb-4 opacity-20" />
      <div class="text-h6">Chưa có chiến dịch nào</div>
      <div class="text-body-2 mb-4">Tạo chiến dịch đầu tiên để chăm sóc khách hàng tự động</div>
      <v-btn color="primary" @click="showCreator = true">Tạo ngay</v-btn>
    </div>

    <!-- Campaign Creator -->
    <CampaignCreator v-model="showCreator" @created="fetchCampaigns" />

    <!-- Campaign Stats -->
    <CampaignStatsDialog v-model="showStats" :campaign="selectedCampaign" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { api } from '@/api';
import CampaignCreator from '@/components/marketing/CampaignCreator.vue';
import CampaignStatsDialog from '@/components/marketing/CampaignStatsDialog.vue';

const campaigns = ref<any[]>([]);
const loading = ref(true);
const showCreator = ref(false);
const showStats = ref(false);
const selectedCampaign = ref<any | null>(null);

async function fetchCampaigns() {
  loading.value = true;
  try {
    const res = await api.get('/marketing/campaigns');
    campaigns.value = res.data;
  } catch (err) {
    console.error('Failed to fetch campaigns', err);
  } finally {
    loading.value = false;
  }
}

async function startCampaign(id: string) {
    try {
        await api.post(`/marketing/campaigns/${id}/start`);
        fetchCampaigns();
    } catch (err) {
        alert('Không thể bắt đầu chiến dịch');
    }
}

function statusColor(status: string) {
  const map: any = {
    draft: 'grey',
    running: 'primary',
    paused: 'warning',
    completed: 'success',
    failed: 'error'
  };
  return map[status] || 'grey';
}

function statusLabel(status: string) {
  const map: any = {
    draft: 'Nháp',
    running: 'Đang chạy',
    paused: 'Tạm dừng',
    completed: 'Hoàn thành',
    failed: 'Lỗi'
  };
  return map[status] || status;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function viewStats(camp: any) {
    selectedCampaign.value = camp;
    showStats.value = true;
}

onMounted(fetchCampaigns);
</script>

<style scoped>
.text-tiny {
    font-size: 10px;
}
</style>
