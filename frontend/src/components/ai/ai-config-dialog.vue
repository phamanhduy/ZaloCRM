<template>
  <v-dialog :model-value="modelValue" max-width="520" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>Cấu hình AI</v-card-title>
      <v-card-text>
        <v-select v-model="local.provider" :items="providers" label="Provider" class="mb-3" />
        <v-text-field v-model="local.model" label="Model" class="mb-3" />
        <v-text-field v-model.number="local.maxDaily" type="number" label="Quota mỗi ngày" :min="1" :rules="[v => v >= 1 || 'Tối thiểu 1']" class="mb-3" />
        <v-switch v-model="local.enabled" label="Bật AI" inset color="primary" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Đóng</v-btn>
        <v-btn color="primary" :loading="loading" @click="$emit('save', local)">Lưu</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  loading: boolean;
  config: { provider: string; model: string; maxDaily: number; enabled: boolean };
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [value: { provider: string; model: string; maxDaily: number; enabled: boolean }];
}>();

const providers = [
  { title: 'Anthropic', value: 'anthropic' },
  { title: 'Gemini', value: 'gemini' },
];

const local = reactive({ provider: 'anthropic', model: '', maxDaily: 500, enabled: true });

watch(() => props.config, (value) => {
  local.provider = value.provider;
  local.model = value.model;
  local.maxDaily = value.maxDaily;
  local.enabled = value.enabled;
}, { immediate: true, deep: true });
</script>
