<template>
  <div class="h-100 d-flex flex-column overflow-hidden bg-grey-lighten-4">
    <!-- Header (Desktop only) -->
    <div v-if="!mobile" class="d-flex align-center pa-4 bg-white border-b">
      <h1 class="text-h4 font-weight-bold">Block tin nhắn</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" rounded="lg" @click="openAddGroup">Thêm nhóm mới</v-btn>
    </div>

    <v-row class="flex-grow-1 overflow-hidden ma-0">
      <!-- Left Column: Groups & Blocks -->
      <v-col 
        v-if="!mobile || !selectedBlock"
        cols="12" md="4" lg="3" 
        class="h-100 overflow-y-auto pa-0 border-r bg-white"
      >
        <div v-if="mobile" class="pa-4 d-flex align-center justify-space-between border-b">
           <h1 class="text-h5 font-weight-bold">Kịch bản</h1>
           <v-btn icon="mdi-plus" color="primary" variant="flat" size="small" @click="openAddGroup" />
        </div>

        <v-list v-model:opened="openedGroups" open-strategy="multiple" class="pa-0">
          <v-list-group v-for="group in groups" :key="group.id" :value="group.id">
            <template #activator="{ props }">
              <v-list-item v-bind="props" :title="group.name" class="font-weight-bold py-3">
                <template #append>
                   <v-menu location="bottom end">
                    <template v-slot:activator="{ props: menuProps }">
                      <v-btn icon="mdi-dots-vertical" variant="text" size="small" v-bind="menuProps" @click.stop />
                    </template>
                    <v-list density="compact" rounded="lg">
                      <v-list-item title="Thêm Block" prepend-icon="mdi-plus" @click="openAddBlock(group)" />
                      <v-list-item title="Xóa nhóm" prepend-icon="mdi-delete" base-color="error" @click="deleteGroup(group.id)" />
                    </v-list>
                  </v-menu>
                </template>
              </v-list-item>
            </template>

            <v-list-item
              v-for="block in group.blocks"
              :key="block.id"
              :title="block.name"
              :active="selectedBlock?.id === block.id"
              prepend-icon="mdi-robot-outline"
              class="pl-8"
              @click="selectBlock(block)"
            >
              <template #append>
                <v-btn icon="mdi-delete-outline" variant="text" size="x-small" color="grey" @click.stop="deleteBlock(block.id)" />
              </template>
            </v-list-item>

            <div v-if="!group.blocks?.length" class="pl-8 py-2 text-caption text-grey">
              Chưa có block nào
            </div>
          </v-list-group>
        </v-list>
        
        <div v-if="!groups.length && !loading" class="text-center pa-8 text-grey">
           Chưa có dữ liệu. Hãy tạo nhóm kịch bản đầu tiên!
        </div>
      </v-col>

      <!-- Right Column: Block Editor -->
      <v-col 
        v-if="!mobile || selectedBlock"
        cols="12" md="8" lg="9" 
        class="h-100 overflow-y-auto pa-4"
      >
        <div v-if="selectedBlock" class="max-width-800 mx-auto">
          <!-- Editor Header -->
          <v-card class="mb-4 pa-4 rounded-xl shadow-sm border-0">
            <div class="d-flex align-center">
              <v-btn v-if="mobile" icon="mdi-arrow-left" variant="text" class="mr-2" @click="selectedBlock = null" />
              <v-icon icon="mdi-robot-outline" color="primary" size="32" class="mr-4" />
              <div class="overflow-hidden">
                <h2 class="text-h6 font-weight-bold text-truncate">{{ selectedBlock.name }}</h2>
                <span class="text-caption text-grey">Chi tiết kịch bản tin nhắn</span>
              </div>
              <v-spacer />
              <v-btn :color="mobile ? 'primary' : 'primary'" :icon="mobile ? 'mdi-send' : undefined" :prepend-icon="!mobile ? 'mdi-send' : undefined" @click="testSendBlock">
                <template v-if="!mobile">Gửi thử</template>
              </v-btn>
            </div>
          </v-card>

          <!-- Block Items -->
          <div v-for="(item, index) in items" :key="item.id" class="mb-6 position-relative">
             <!-- Connector Line -->
            <div v-if="index < items.length - 1" class="item-connector"></div>

            <v-card class="item-card rounded-lg border-0 shadow-sm">
              <v-card-text>
                <div class="d-flex align-center mb-4">
                  <v-chip size="small" color="primary" variant="flat" class="mr-2">Tin nhắn {{ index + 1 }}</v-chip>
                  <v-select
                    v-model="item.type"
                    :items="[{ title: 'Văn bản', value: 'text' }, { title: 'Hình ảnh', value: 'image' }, { title: 'Tệp tin', value: 'file' }]"
                    density="compact"
                    hide-details
                    variant="plain"
                    class="type-select"
                    style="max-width: 120px;"
                    @update:model-value="updateItem(item)"
                  />
                  <v-spacer />
                  <v-btn icon="mdi-close" variant="text" size="small" color="grey" @click="removeItem(item.id)" />
                </div>

                <!-- Text Content -->
                <v-textarea
                  v-if="item.type === 'text'"
                  v-model="item.content"
                  placeholder="Nhập nội dung tin nhắn..."
                  auto-grow
                  rows="3"
                  variant="filled"
                  density="comfortable"
                  hide-details
                  bg-color="white"
                  @change="updateItem(item)"
                  @blur="updateItem(item)"
                />

                <!-- Image/File Content -->
                <div v-else class="pa-4 bg-white rounded border d-flex align-center">
                  <v-icon :icon="item.type === 'image' ? 'mdi-image' : 'mdi-file'" class="mr-4" />
                  <v-text-field
                    v-model="item.fileUrl"
                    :placeholder="item.type === 'image' ? 'Dán link ảnh vào đây...' : 'Dán link file vào đây...'"
                    hide-details
                    variant="plain"
                    class="flex-grow-1"
                    @change="updateItem(item)"
                    @blur="updateItem(item)"
                  />
                  <v-btn icon="mdi-upload" variant="text" color="primary" />
                </div>

                <!-- Delay -->
                <div class="mt-4 d-flex align-center text-caption text-grey">
                   <v-icon icon="mdi-clock-outline" size="16" class="mr-1" />
                   <span>Hiển thị "typing...", thời gian trễ:</span>
                   <v-text-field
                    v-model.number="item.delay"
                    type="number"
                    density="compact"
                    hide-details
                    variant="outlined"
                    class="mx-2 delay-input"
                    style="max-width: 60px;"
                    @change="updateItem(item)"
                    @blur="updateItem(item)"
                   />
                   <span>giây (Min: 5s)</span>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <v-btn
            block
            variant="dashed"
            color="primary"
            prepend-icon="mdi-plus"
            class="mt-4 py-8 rounded-lg"
            @click="addItem"
          >
            Thêm tin nhắn mới
          </v-btn>
        </div>

        <div v-else class="h-100 d-flex flex-column align-center justify-center text-grey">
          <v-icon icon="mdi-robot-outline" size="64" class="mb-4 opacity-20" />
          <p class="text-h6">Chọn một block bên trái để bắt đầu chỉnh sửa</p>
        </div>
      </v-col>
    </v-row>

    <!-- Dialogs -->
    <v-dialog v-model="showGroupDialog" max-width="400">
      <v-card>
        <v-card-title>Thêm nhóm kịch bản mới</v-card-title>
        <v-card-text>
          <v-text-field v-model="groupName" label="Tên nhóm" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showGroupDialog = false">Hủy</v-btn>
          <v-btn color="primary" @click="handleAddGroup">Tạo</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showBlockDialog" max-width="400">
      <v-card>
        <v-card-title>Thêm Block mới</v-card-title>
        <v-card-text>
          <v-text-field v-model="blockName" label="Tên Block" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showBlockDialog = false">Hủy</v-btn>
          <v-btn color="primary" @click="handleAddBlock">Tạo</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- Snackbar for notifications -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="2000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDisplay } from 'vuetify';
import { api } from '@/api/index';

const { mobile } = useDisplay();

interface BlockItem {
  id: string;
  type: string;
  content: string;
  fileUrl: string;
  delay: number;
  order: number;
}

interface Block {
  id: string;
  name: string;
  items?: BlockItem[];
}

interface Group {
  id: string;
  name: string;
  blocks: Block[];
}

const groups = ref<Group[]>([]);
const loading = ref(false);
const saving = ref(false);
const openedGroups = ref<string[]>([]);
const selectedBlock = ref<Block | null>(null);
const items = ref<BlockItem[]>([]);

const showGroupDialog = ref(false);
const groupName = ref('');
const showBlockDialog = ref(false);
const blockName = ref('');
const currentGroupId = ref('');

const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

function showNotify(text: string, color = 'success') {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
}

async function fetchGroups() {
  loading.value = true;
  try {
    const res = await api.get('/message-groups');
    groups.value = res.data;
  } catch (err) {
    console.error('Fetch groups failed:', err);
  } finally {
    loading.value = false;
  }
}

async function selectBlock(block: Block) {
  selectedBlock.value = block;
  try {
    const res = await api.get(`/message-blocks/${block.id}`);
    items.value = res.data.items || [];
  } catch (err) {
    console.error('Fetch block details failed:', err);
  }
}

function openAddGroup() {
  groupName.value = '';
  showGroupDialog.value = true;
}

async function handleAddGroup() {
  if (!groupName.value) return;
  try {
    await api.post('/message-groups', { name: groupName.value });
    showGroupDialog.value = false;
    fetchGroups();
  } catch (err) {
    console.error('Add group failed:', err);
  }
}

function openAddBlock(group: Group) {
  currentGroupId.value = group.id;
  blockName.value = '';
  showBlockDialog.value = true;
}

async function handleAddBlock() {
  if (!blockName.value) return;
  try {
    const res = await api.post('/message-blocks', {
      groupId: currentGroupId.value,
      name: blockName.value
    });
    showBlockDialog.value = false;
    
    // Ensure the group is opened so the new block is visible
    if (!openedGroups.value.includes(currentGroupId.value)) {
      openedGroups.value.push(currentGroupId.value);
    }
    
    await fetchGroups();
    
    // Select the newly created block
    if (res.data && res.data.id) {
       selectBlock(res.data);
    }
  } catch (err) {
    console.error('Add block failed:', err);
  }
}

async function addItem() {
  if (!selectedBlock.value) return;
  const newItem = {
    blockId: selectedBlock.value.id,
    type: 'text',
    content: '',
    delay: 5,
    order: items.value.length
  };
  try {
    const res = await api.post('/message-block-items', newItem);
    items.value.push(res.data);
  } catch (err) {
    console.error('Add item failed:', err);
  }
}

async function updateItem(item: BlockItem) {
  try {
    if (item.delay < 5) item.delay = 5; // Enforce minimum
    saving.value = true;
    await api.put(`/message-block-items/${item.id}`, item);
    showNotify('Đã lưu kịch bản');
  } catch (err) {
    console.error('Update item failed:', err);
    showNotify('Lỗi khi lưu kịch bản', 'error');
  } finally {
    saving.value = false;
  }
}

async function removeItem(id: string) {
  try {
    await api.delete(`/message-block-items/${id}`);
    items.value = items.value.filter(i => i.id !== id);
  } catch (err) {
    console.error('Delete item failed:', err);
  }
}

async function deleteBlock(id: string) {
  if (!confirm('Bạn có chắc muốn xóa block này?')) return;
  try {
    await api.delete(`/message-blocks/${id}`);
    if (selectedBlock.value?.id === id) selectedBlock.value = null;
    fetchGroups();
  } catch (err) {
    console.error('Delete block failed:', err);
  }
}

async function deleteGroup(id: string) {
  if (!confirm('Bạn có chắc muốn xóa toàn bộ nhóm này và các block bên trong?')) return;
  try {
    await api.delete(`/message-groups/${id}`);
    fetchGroups();
  } catch (err) {
    console.error('Delete group failed:', err);
  }
}

function testSendBlock() {
    alert('Tính năng này sẽ hoạt động trong cửa sổ Chat. Bạn có thể chọn Block để gửi trực tiếp cho khách hàng!');
}

onMounted(fetchGroups);
</script>

<style scoped>
.item-connector {
  position: absolute;
  left: 20px;
  top: 100%;
  height: 24px;
  width: 2px;
  background-color: var(--v-theme-primary);
  opacity: 0.3;
  z-index: 0;
}

.item-card {
  position: relative;
  z-index: 1;
  transition: transform 0.2s;
}

.item-card:hover {
  transform: translateY(-2px);
}

.type-select :deep(.v-field__input) {
  font-weight: bold;
  color: var(--v-theme-primary);
}

.delay-input :deep(input) {
  text-align: center;
  padding: 0 !important;
}

.max-width-800 {
  max-width: 800px;
}

.v-btn--variant-dashed {
  border: 2px dashed rgba(var(--v-theme-primary), 0.3) !important;
  background: transparent !important;
}
</style>
