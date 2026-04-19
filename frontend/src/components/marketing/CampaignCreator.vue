<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="800px" persistent>
    <v-card class="rounded-lg overflow-hidden">
      <v-card-title class="pa-4 bg-primary text-white d-flex align-center">
        <v-icon icon="mdi-bullhorn" class="mr-2" />
        Tạo chiến dịch Marketing
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" color="white" @click="$emit('update:modelValue', false)" />
      </v-card-title>

      <v-card-text class="pa-0">
        <div class="stepper-header d-flex border-b pa-4 bg-grey-lighten-4">
            <div 
                v-for="s in [1,2,3]" :key="s" 
                class="step-item d-flex align-center mr-6 cursor-pointer" 
                :class="{ 'text-primary': step >= s, 'opacity-50': step < s }"
                @click="goToStep(s)"
            >
                <v-avatar size="24" :color="step >= s ? 'primary' : 'grey'" class="mr-2 text-white text-caption font-weight-bold">{{ s }}</v-avatar>
                <span class="text-subtitle-2 font-weight-bold">
                    {{ s === 1 ? 'Tên chiến dịch' : s === 2 ? 'Lọc khách hàng' : 'Cấu hình tin nhắn' }}
                </span>
            </div>
        </div>

        <div class="pa-6" style="min-height: 400px;">
          <!-- Step 1: Name -->
          <div v-if="step === 1" class="animate-fade-in">
            <div class="text-subtitle-2 font-weight-bold mb-2">Tên chiến dịch</div>
            <v-text-field
              v-model="form.name"
              placeholder="Ví dụ: Chăm sóc khách hàng cũ tháng 4"
              variant="outlined"
              density="comfortable"
              hide-details
              class="mb-6"
            />
            <div class="text-caption text-disabled">Đặt tên dễ nhớ để phân biệt giữa các chiến dịch khác nhau.</div>
          </div>

          <!-- Step 2: Filtering -->
          <div v-if="step === 2" class="animate-fade-in">
            <v-row>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 font-weight-bold mb-2">Nguồn khách hàng</div>
                <v-select
                  v-model="form.filters.source"
                  :items="SOURCE_OPTIONS"
                  item-title="text"
                  item-value="value"
                  placeholder="Tất cả nguồn"
                  variant="outlined"
                  density="comfortable"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 font-weight-bold mb-2">Trạng thái</div>
                <v-select
                  v-model="form.filters.status"
                  :items="STATUS_OPTIONS"
                  item-title="text"
                  item-value="value"
                  placeholder="Tất cả trạng thái"
                  variant="outlined"
                  density="comfortable"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 font-weight-bold mb-2">Tag (Nhãn)</div>
                <v-text-field
                  v-model="form.filters.tag"
                  placeholder="Nhập 1 tag để lọc"
                  variant="outlined"
                  density="comfortable"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 font-weight-bold mb-2">Gửi từ tài khoản</div>
                <v-select
                  v-model="form.filters.zaloAccountId"
                  :items="chatStore.zaloAccounts"
                  item-title="displayName"
                  item-value="id"
                  placeholder="Tự động chọn"
                  variant="outlined"
                  density="comfortable"
                  clearable
                />
              </v-col>
            </v-row>

            <div class="text-subtitle-2 font-weight-bold mb-2 mt-4">Danh sách khách hàng khớp bộ lọc ({{ previewContacts.length }})</div>
            <div class="preview-list border rounded-lg overflow-y-auto" style="max-height: 200px;">
                <v-table density="compact">
                    <thead>
                        <tr>
                            <th class="text-left">Họ tên</th>
                            <th class="text-left">Loại</th>
                            <th class="text-left">SĐT</th>
                            <th class="text-left">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="c in previewContacts" :key="c.id">
                            <td>
                                <div class="d-flex align-center">
                                    <v-avatar size="24" class="mr-2"><v-img :src="c.avatarUrl" /></v-avatar>
                                    {{ c.fullName }}
                                </div>
                            </td>
                            <td>
                                <v-chip size="x-small" :color="c.metadata?.isGroup ? 'info' : 'grey'" variant="tonal">
                                    {{ c.metadata?.isGroup ? 'Nhóm' : 'Cá nhân' }}
                                </v-chip>
                            </td>
                            <td>{{ c.phone || '—' }}</td>
                            <td><v-chip size="x-small" variant="tonal">{{ c.status }}</v-chip></td>
                        </tr>
                        <tr v-if="previewContacts.length === 0">
                            <td colspan="4" class="text-center py-4 text-disabled">Không có khách hàng nào khớp bộ lọc</td>
                        </tr>
                    </tbody>
                </v-table>
            </div>

            <div class="bg-blue-lighten-5 pa-4 rounded-lg mt-4 d-flex align-center">
                <v-icon icon="mdi-account-search" color="primary" class="mr-3" />
                <div class="text-caption text-primary">Chiến dịch sẽ tự động quét tất cả khách hàng khớp với bộ lọc trên.</div>
            </div>
          </div>

          <!-- Step 3: Message Content -->
          <div v-if="step === 3" class="animate-fade-in">
            <div class="text-subtitle-2 font-weight-bold mb-2">Nội dung tin nhắn</div>
            <v-textarea
              v-model="form.messageConfig.text"
              placeholder="Nhập nội dung tin nhắn..."
              variant="outlined"
              rows="5"
              counter
            />

            <!-- Attachments -->
            <div class="d-flex gap-4 mt-2">
              <v-btn 
                variant="outlined" prepend-icon="mdi-image" size="small" class="text-none"
                @click="$refs.imageInput.click()"
                :loading="uploading === 'image'"
              >Đính kèm ảnh</v-btn>
              <v-btn 
                variant="outlined" prepend-icon="mdi-file-outline" size="small" class="text-none"
                @click="$refs.fileInput.click()"
                :loading="uploading === 'file'"
              >Đính kèm tệp</v-btn>

              <input type="file" ref="imageInput" hidden accept="image/*" @change="onFileChange($event, 'image')">
              <input type="file" ref="fileInput" hidden @change="onFileChange($event, 'file')">
            </div>

            <div v-if="form.messageConfig.attachments.length > 0" class="mt-4 d-flex flex-wrap gap-2">
                <v-chip
                    v-for="(file, idx) in form.messageConfig.attachments"
                    :key="idx"
                    closable
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-paperclip"
                    @click:close="removeAttachment(idx)"
                >
                    {{ file.originalName }}
                </v-chip>
            </div>
            
            <div class="text-caption text-disabled mt-4">
                Lưu ý: Bạn nên sử dụng các biến như {fullName} để tin nhắn mang tính cá nhân hơn (tính năng đang phát triển).
            </div>

            <div class="text-subtitle-2 font-weight-bold mb-2 mt-8">Cài đặt thời gian gửi (Giây)</div>
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="form.messageConfig.minDelay"
                  label="Tối thiểu"
                  type="number"
                  variant="outlined"
                  density="compact"
                  suffix="s"
                  hide-details
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="form.messageConfig.maxDelay"
                  label="Tối đa"
                  type="number"
                  variant="outlined"
                  density="compact"
                  suffix="s"
                  hide-details
                />
              </v-col>
            </v-row>
            <div class="text-caption text-warning mt-2">
              Khuyến nghị: 10s - 30s để đảm bảo an toàn cho tài khoản.
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4 bg-grey-lighten-4">
        <v-btn v-if="step > 1" variant="text" @click="step--" prepend-icon="mdi-chevron-left">Quay lại</v-btn>
        <v-spacer />
        <v-btn v-if="step < 3" color="primary" @click="step++" append-icon="mdi-chevron-right" :disabled="!isStepValid">Tiếp tục</v-btn>
        <v-btn v-else color="success" @click="save" :loading="saving" prepend-icon="mdi-check">Hoàn tất & Lưu nháp</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { SOURCE_OPTIONS, STATUS_OPTIONS } from '@/composables/use-contacts';
import { useChatStore } from '@/stores/chat';
import { api } from '@/api';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [val: boolean], 'created': [] }>();

const chatStore = useChatStore();
const step = ref(1);
const saving = ref(false);
const uploading = ref<string | null>(null);
const previewContacts = ref<any[]>([]);

const imageInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const form = reactive({
  name: '',
  filters: {
    source: null,
    status: null,
    tag: '',
    zaloAccountId: null,
  },
  messageConfig: {
    text: '',
    attachments: [] as any[],
    minDelay: 10,
    maxDelay: 20,
  }
});

// Upload logic
async function onFileChange(event: Event, type: string) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    uploading.value = type;
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        form.messageConfig.attachments.push({
            ...res.data,
            type: type === 'image' ? 'image' : 'file'
        });
    } catch (err) {
        console.error('Upload failed', err);
        alert('Tải lên thất bại');
    } finally {
        uploading.value = null;
        target.value = ''; // Reset input
    }
}

function removeAttachment(idx: number) {
    form.messageConfig.attachments.splice(idx, 1);
}

// Watch filters to update preview
watch(() => form.filters, async () => {
    try {
        const res = await api.post('/marketing/preview', form.filters);
        previewContacts.value = res.data;
    } catch (err) {
        console.error('Failed to preview contacts', err);
    }
}, { deep: true, immediate: true });

const isStepValid = computed(() => {
  if (step.value === 1) return form.name.trim().length > 0;
  if (step.value === 2) return true; // Filters can be empty (send to all)
  return true;
});

async function save() {
  if (!form.name || !form.messageConfig.text) return;
  
  saving.value = true;
  try {
    await api.post('/marketing/campaigns', form);
    emit('created');
    emit('update:modelValue', false);
    // Reset form
    form.name = '';
    form.messageConfig.text = '';
    step.value = 1;
  } catch (err) {
    console.error('Failed to save campaign', err);
  } finally {
    saving.value = false;
  }
}

function goToStep(s: number) {
    // Only allow going back or going forward if current step is valid
    if (s < step.value || isStepValid.value) {
        step.value = s;
    }
}
</script>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
