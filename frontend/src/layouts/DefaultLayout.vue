<template>
  <v-app>
    <!-- Combined Navigation: Rail + Sidebar in a single drawer to prevent overlap/alignment issues -->
    <div
      v-show="drawerVisible"
      class="z-combined-sidebar shadow-lg"
      :style="{ 
        width: drawerWidth + 'px', 
        position: 'fixed', 
        left: 0, 
        top: 0, 
        bottom: 0, 
        zIndex: 100,
        backgroundColor: '#fff',
        display: 'flex',
        overflow: 'hidden',
        borderRight: '1px solid rgba(0,0,0,0.05)'
      }"
    >
      <div class="d-flex h-100 overflow-hidden flex-grow-1">
        <!-- Part 1: Rail (Blue column) -->
        <div class="z-rail-part h-100 d-flex flex-column flex-shrink-0" style="width: 64px; background-color: #0068ff !important;">
          <div class="mb-4 mt-2 d-flex justify-center pa-2">
            <div 
              class="cursor-pointer d-flex align-center justify-center" 
              style="width: 42px; height: 42px; border: 2px solid rgba(255,255,255,0.2); border-radius: 50%; overflow: hidden; background-color: rgba(255,255,255,0.1);"
            >
              <img 
                :src="authStore.user?.avatarUrl || 'https://randomuser.me/api/portraits/men/32.jpg'" 
                referrerpolicy="no-referrer" 
                style="width: 100%; height: 100%; object-fit: cover;"
              />
            </div>
          </div>

          <div class="flex-grow-1">
            <div
              v-for="item in railItems"
              :key="item.path"
              class="d-flex justify-center py-3 rail-item-wrapper cursor-pointer position-relative"
              :class="{ 'rail-item-active': route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path)) }"
              @click="router.push(item.path)"
            >
              <v-badge
                v-if="item.badge"
                color="error"
                :content="item.badge"
                location="top right"
                offset-x="-5"
                offset-y="-5"
              >
                <v-icon :icon="item.icon" size="28" :color="(route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path))) ? 'white' : 'rgba(255,255,255,0.5)'" />
              </v-badge>
              <v-icon v-else :icon="item.icon" size="28" :color="(route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path))) ? 'white' : 'rgba(255,255,255,0.5)'" />
            </div>
          </div>
          
          <div class="mt-auto">
            <div 
              class="d-flex justify-center py-3 rail-item-wrapper cursor-pointer" 
              :class="{ 'rail-item-active': isSettingsFlow }"
              @click="router.push('/settings')"
            >
              <v-icon icon="mdi-cog-outline" :color="isSettingsFlow ? 'white' : 'rgba(255,255,255,0.7)'" size="28" />
            </div>
            <div class="d-flex justify-center py-3 rail-item-wrapper cursor-pointer" @click="logout">
              <v-icon icon="mdi-logout" color="rgba(255,255,255,0.7)" size="28" />
            </div>
          </div>
        </div>

        <!-- Part 2: Sidebar Content (Conditional) -->
        <div 
          v-if="showSidebar"
          class="z-sidebar-part h-100 d-flex flex-column border-l" 
          :style="{ 
            backgroundColor: '#ffffff', 
            borderLeft: '1px solid rgba(0,0,0,0.05) !important', 
            width: isChatFlow ? '340px' : '240px' 
          }"
        >
          <!-- Chat specific content -->
          <template v-if="isChatFlow">
            <div class="pa-4 pb-2">
              <!-- Zalo Account Selector -->
              <v-select
                v-model="chatStore.accountFilter"
                :items="[{ displayName: 'Tất cả', id: null }, ...chatStore.zaloAccounts]"
                item-title="displayName"
                item-value="id"
                placeholder="Chọn tài khoản Zalo"
                persistent-placeholder
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                class="mb-2 z-account-select"
                @update:model-value="chatStore.fetchConversations"
              />

              <div class="d-flex align-center gap-2">
                <v-text-field
                  v-model="chatStore.searchQuery"
                  placeholder="Tìm kiếm"
                  prepend-inner-icon="mdi-magnify"
                  hide-details
                  bg-color="rgba(0,0,0,0.05)"
                  density="compact"
                  variant="solo"
                  flat
                  class="z-search-field flex-grow-1"
                  @update:model-value="chatStore.fetchConversations"
                />
                <v-btn icon="mdi-account-plus-outline" variant="text" size="small" class="opacity-70" />
                <v-btn icon="mdi-account-group-outline" variant="text" size="small" class="opacity-70" />
              </div>
            </div>
            
            <div class="px-4 py-1 d-flex align-center">
              <v-btn 
                variant="text" size="small" 
                class="px-2 font-weight-bold" 
                :color="(!chatStore.unreadFilter && !chatStore.statusFilter) ? 'primary' : 'grey-darken-1'"
                @click="() => { chatStore.unreadFilter = false; chatStore.statusFilter = null; chatStore.fetchConversations(); }"
              >Tất cả</v-btn>

              <v-spacer />
              
              <v-btn
                v-if="chatStore.statusFilter"
                variant="text" size="small"
                class="px-1 text-error"
                @click="() => { chatStore.statusFilter = null; chatStore.fetchConversations(); }"
              >
                Xóa lọc
              </v-btn>
              
              <v-menu offset-y>
                <template v-slot:activator="{ props }">
                  <v-btn 
                    variant="text" size="small" 
                    class="px-1" 
                    :color="chatStore.statusFilter ? 'primary' : 'grey-darken-1'"
                    v-bind="props"
                  >
                    {{ statuses.find(s => s.value === chatStore.statusFilter)?.label || 'Phân loại' }} 
                    <v-icon size="small">mdi-chevron-down</v-icon>
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item 
                    v-for="st in statuses" 
                    :key="st.value" 
                    @click="() => { chatStore.statusFilter = st.value; chatStore.fetchConversations(); }"
                  >
                    <v-list-item-title>{{ st.label }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>

            <v-divider class="opacity-10" />
            
            <div class="flex-grow-1 overflow-y-auto z-conv-list">
              <v-progress-linear v-if="chatStore.loadingConvs" indeterminate color="primary" height="2" />
              
              <div v-for="conv in chatStore.conversations" :key="conv.id"
                class="conv-item d-flex align-center px-4 py-3 cursor-pointer"
                :class="{ 'conv-item-active': conv.id === chatStore.selectedConvId }"
                @click="selectConv(conv.id)"
              >
                <v-avatar size="48" class="mr-3 flex-shrink-0" style="border: 1px solid rgba(128, 128, 128, 0.2); background-color: #f0f2f5;">
                  <v-img 
                    v-if="conv.contact?.avatarUrl" 
                    :src="conv.contact.avatarUrl" 
                    referrerpolicy="no-referrer" 
                    style="width: 100%; height: 100%; object-fit: cover;"
                  >
                    <template #placeholder>
                      <v-icon :icon="conv.threadType === 'group' ? 'mdi-account-group' : 'mdi-account'" color="grey-darken-1" />
                    </template>
                  </v-img>
                  <v-icon v-else :icon="conv.threadType === 'group' ? 'mdi-account-group' : 'mdi-account'" color="grey-darken-1" />
                </v-avatar>

                <div class="flex-grow-1 overflow-hidden">
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-subtitle-2 font-weight-bold text-truncate" style="max-width: 180px; color: var(--z-text-primary);">
                      {{ conv.contact?.fullName || 'Người dùng Zalo' }}
                    </span>
                    <span class="text-tiny" style="color: var(--z-text-secondary); font-weight: 500;">{{ formatTime(conv.lastMessageAt) }}</span>
                  </div>
                  <div class="d-flex align-center justify-space-between mt-1">
                    <span class="text-caption text-truncate" style="max-width: 215px; color: var(--z-text-secondary);">
                      {{ lastMessageText(conv) }}
                    </span>
                    <v-badge
                      v-if="conv.unreadCount > 0"
                      color="error"
                      :content="conv.unreadCount"
                      inline
                      class="ml-2"
                    />
                  </div>
                </div>
              </div>

              <div v-if="!chatStore.loadingConvs && chatStore.conversations.length === 0" class="pa-8 text-center text-disabled">
                Không tìm thấy hội thoại
              </div>
            </div>
          </template>

          <!-- Settings "DANH MỤC" content -->
          <div v-else-if="isSettingsFlow" class="h-100 d-flex flex-column pa-0">
            <div class="pa-6 pb-2 font-weight-bold text-subtitle-2 mb-2 text-disabled">DANH MỤC</div>
            <div
              v-for="item in sidebarItems"
              :key="item.path"
              class="sidebar-item d-flex align-center px-6 py-3 cursor-pointer"
              :class="{ 'sidebar-item-active': route.path === item.path || (item.path !== '/settings' && route.path.startsWith(item.path)) }"
              @click="router.push(item.path)"
            >
              <v-icon :icon="item.icon" size="20" class="mr-4" :color="(route.path === item.path || (item.path !== '/settings' && route.path.startsWith(item.path))) ? 'primary' : 'rgba(0,0,0,0.54)'" />
              <span class="text-body-2" :class="(route.path === item.path || (item.path !== '/settings' && route.path.startsWith(item.path))) ? 'text-primary font-weight-bold' : 'text-grey-darken-1'">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Column 3: Main Content -->
    <v-main 
      class="z-main h-100 overflow-hidden" 
      :class="{ 'pa-6': !isChatFlow }"
      :style="{ paddingLeft: (drawerVisible ? (drawerWidth + (isChatFlow ? 0 : 24)) : 24) + 'px !important' }"
    >
      <slot />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useChatStore, type Conversation } from '@/stores/chat';
import { useRouter, useRoute } from 'vue-router';

const theme = useTheme();
const authStore = useAuthStore();
const chatStore = useChatStore();
const router = useRouter();
const route = useRoute();

const drawerVisible = ref(true);

const statuses = [
  { value: 'new', label: 'Mới' },
  { value: 'contacted', label: 'Đã liên hệ' },
  { value: 'interested', label: 'Quan tâm' },
  { value: 'converted', label: 'Chuyển đổi' },
  { value: 'lost', label: 'Mất' }
];

onMounted(() => {
  console.log('DefaultLayout: onMounted started');
  
  // Safe theme change
  try {
    if (theme.global.name.value !== 'light') {
      theme.global.name.value = 'light';
    }
  } catch (e) {
    console.warn('Theme change failed', e);
  }
  
  // Call APIs in background without awaiting to prevent blocking the UI
  console.log('DefaultLayout: Fetching accounts...');
  chatStore.fetchAccounts().then(() => {
    console.log('DefaultLayout: Accounts fetched');
  }).catch(err => {
    console.error('DefaultLayout: Fetch accounts failed', err);
  });

  console.log('DefaultLayout: Fetching conversations...');
  chatStore.fetchConversations().then(() => {
    console.log('DefaultLayout: Conversations fetched');
  }).catch(err => {
    console.error('DefaultLayout: Fetch conversations failed', err);
  });

  chatStore.initSocket();
  console.log('DefaultLayout: onMounted finished');
});

const railItems = [
  { icon: 'mdi-view-dashboard-outline', path: '/', title: 'Tổng quan' },
  { icon: 'mdi-message-text-outline', path: '/chat', badge: 0, title: 'Chat' },
  { icon: 'mdi-account-group-outline', path: '/contacts', title: 'Khách hàng' },
  { icon: 'mdi-bullhorn-outline', path: '/marketing', title: 'Marketing' },
  { icon: 'mdi-chart-bar', path: '/reports', title: 'Báo cáo' },
];

// Logic for Sidebar display
const isChatFlow = computed(() => route.path.startsWith('/chat'));
const isSettingsFlow = computed(() => {
  const settingsPaths = ['/settings', '/zalo-accounts', '/appointments', '/integrations', '/automation'];
  return settingsPaths.some(p => route.path === p || route.path.startsWith(p + '/'));
});

const showSidebar = computed(() => isChatFlow.value || isSettingsFlow.value);
// Restore chat sidebar to 340px, but settings sidebar is 240px
const drawerWidth = computed(() => showSidebar.value ? (64 + (isChatFlow.value ? 340 : 240)) : 64);

const sidebarItems = computed(() => {
  return [
    { title: 'Tài khoản Zalo', icon: 'mdi-cellphone-link', path: '/zalo-accounts' },
    { title: 'Lịch hẹn', icon: 'mdi-calendar-clock', path: '/appointments' },
    { title: 'Tích hợp', icon: 'mdi-connection', path: '/integrations' },
    { title: 'Cài đặt', icon: 'mdi-cog', path: '/settings' },
  ];
});

function selectConv(id: string) {
  chatStore.selectConversation(id);
  if (route.path !== '/chat') {
    router.push('/chat');
  }
}

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
      if (p.catId && p.id && p.type === 7) return '[Nhãn dán]';
      return p.title || p.text || 'Tin nhắn mới...';
    } catch {
      return content;
    }
  }
  
  // Full emoticon decoding for preview
  const previewMap: Record<string, string> = {
    ':-~': '🥴', ':~': '🥴', ':b': '👍', ':-b': '👍', ':D': '😃', ':-D': '😃', 
    ':)': '🙂', ':-)': '🙂', ':(': '☹️', ':-(': '☹️', ';)': '😉', ';-)': '😉'
  };
  
  let previewText = content;
  for (const [key, val] of Object.entries(previewMap)) {
    if (previewText.includes(key)) {
      previewText = previewText.replaceAll(key, val);
    }
  }
  
  return previewText;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function logout() {
  chatStore.destroySocket();
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.z-combined-drawer :deep(.v-navigation-drawer__content) {
  padding: 0 !important;
  overflow: hidden !important;
}

.rail-item-wrapper {
  transition: background 0.2s;
}

.rail-item-wrapper:hover {
  background: rgba(255, 255, 255, 0.1);
}

.rail-item-active {
  background: rgba(255, 255, 255, 0.15);
}

.conv-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background 0.2s;
}

.conv-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.conv-item-active {
  background-color: #e5efff !important; /* Distinct light blue background */
  border-left: 3px solid var(--z-primary);
}

.sidebar-item {
  transition: background 0.2s;
}

.sidebar-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.sidebar-item-active {
  background: rgba(var(--v-theme-primary), 0.08);
}

.z-account-select :deep(.v-field) {
  background-color: #f0f7ff !important;
  border-radius: 8px !important;
  font-size: 13px !important;
}

.z-account-select :deep(.v-field__input) {
  min-height: 36px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.z-search-field :deep(.v-field__input) {
  min-height: 32px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  font-size: 13px !important;
}

.text-tiny {
  font-size: 10px;
}
</style>
