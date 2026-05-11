<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRecordStore } from '@/stores/recordStore';
import { useClusterStore } from '@/stores/clusterStore';
import { exportAllData, importData, clearAllData, saveRecord } from '@/utils/storage';
import { getApiKey, setApiKey, hasApiKey } from '@/utils/ai';

const userStore = useUserStore();
const recordStore = useRecordStore();
const clusterStore = useClusterStore();

const currentPage = ref<'main' | 'category' | 'ai'>('main');
const newCategoryName = ref('');
const showAddCategory = ref(false);
const showClearConfirm = ref(false);
const isExporting = ref(false);
const isImporting = ref(false);
const apiKeyInput = ref(getApiKey() || '');
const showApiKeyInput = ref(false);
const categoryTab = ref<'active' | 'completed'>('active');

const editingCategoryId = ref<string | null>(null);
const editingCategoryName = ref('');

const activeCategories = computed(() => userStore.categories.filter(c => !c.isCompleted));
const completedCategories = computed(() => userStore.categories.filter(c => c.isCompleted));

function goToCategoryPage() {
  currentPage.value = 'category';
}

function goToAiPage() {
  currentPage.value = 'ai';
}

function goBack() {
  currentPage.value = 'main';
}

function addCategory() {
  const name = newCategoryName.value.trim();
  if (name) {
    userStore.addCategory(name);
    newCategoryName.value = '';
    showAddCategory.value = false;
  }
}

function startEditCategory(id: string, name: string) {
  editingCategoryId.value = id;
  editingCategoryName.value = name;
}

function cancelEditCategory() {
  editingCategoryId.value = null;
  editingCategoryName.value = '';
}

async function saveCategory() {
  if (!editingCategoryId.value || !editingCategoryName.value.trim()) return;
  
  const oldCategory = userStore.categories.find(c => c.id === editingCategoryId.value);
  const newName = editingCategoryName.value.trim();
  
  if (oldCategory && oldCategory.name !== newName) {
    const oldName = oldCategory.name;
    userStore.updateCategory(editingCategoryId.value, { name: newName });
    
    const recordsToUpdate = recordStore.records.filter(r => r.categoryId === editingCategoryId.value);
    for (const record of recordsToUpdate) {
      const recordCopy = JSON.parse(JSON.stringify(record));
      recordCopy.summary = recordCopy.summary.replace(oldName, newName);
      await saveRecord(recordCopy);
    }
    await recordStore.loadRecords();
    
    alert(`已将 "${oldName}" 相关的 ${recordsToUpdate.length} 条记录更新为 "${newName}"`);
  }
  
  editingCategoryId.value = null;
  editingCategoryName.value = '';
}

function toggleCategoryCompleted(id: string) {
  const category = userStore.categories.find(c => c.id === id);
  if (category) {
    userStore.updateCategory(id, { isCompleted: !category.isCompleted });
  }
}

function deleteCategory(id: string) {
  if (confirm('确定要删除这个类别吗？删除后，相关记录将变为待标注状态。')) {
    const recordsToUpdate = recordStore.records.filter(r => r.categoryId === id);
    for (const record of recordsToUpdate) {
      const recordCopy = JSON.parse(JSON.stringify(record));
      recordCopy.categoryId = null;
      recordCopy.annotationStatus = 'pending';
      saveRecord(recordCopy);
    }
    userStore.deleteCategory(id);
    recordStore.loadRecords();
  }
}

async function handleExport() {
  isExporting.value = true;
  try {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worktime-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } finally {
    isExporting.value = false;
  }
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    isImporting.value = true;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      await userStore.resetConfig();
      await recordStore.loadRecords();
      await clusterStore.loadClusters();
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败，请检查文件格式');
    } finally {
      isImporting.value = false;
    }
  };
  input.click();
}

function handleClearData() {
  clearAllData();
  window.location.reload();
}

function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (key) {
    setApiKey(key);
    showApiKeyInput.value = false;
    alert('API Key 已保存');
  }
}

function clearApiKey() {
  apiKeyInput.value = '';
  localStorage.removeItem('worktime_api_key');
  alert('API Key 已清除');
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-8">
    <template v-if="currentPage === 'main'">
      <section class="mb-6">
        <button
          @click="goToCategoryPage"
          class="w-full card card-hover flex items-center justify-between p-5"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-ink">工作项目管理</div>
              <div class="text-sm text-ink-muted mt-0.5">
                {{ activeCategories.length }}个进行中 · {{ completedCategories.length }}个已完成
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      <section class="mb-6">
        <button
          @click="goToAiPage"
          class="w-full card card-hover flex items-center justify-between p-5"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-ink">AI 服务配置</div>
              <div class="text-sm text-ink-muted mt-0.5">
                {{ hasApiKey() ? '已配置 API Key' : '未配置，使用基础分析模式' }}
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      <section class="mb-6">
        <div class="card overflow-hidden">
          <button
            @click="handleExport"
            :disabled="isExporting"
            class="w-full flex items-center gap-4 p-5 hover:bg-paper-2 transition-colors border-b border-paper-3"
          >
            <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-ink">导出数据</div>
              <div class="text-sm text-ink-muted">将所有记录导出为 JSON 文件</div>
            </div>
          </button>

          <button
            @click="handleImport"
            :disabled="isImporting"
            class="w-full flex items-center gap-4 p-5 hover:bg-paper-2 transition-colors border-b border-paper-3"
          >
            <div class="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-ink">导入数据</div>
              <div class="text-sm text-ink-muted">从 JSON 文件恢复数据</div>
            </div>
          </button>

          <div v-if="!showClearConfirm">
            <button
              @click="showClearConfirm = true"
              class="w-full flex items-center gap-4 p-5 hover:bg-error/5 transition-colors"
            >
              <div class="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div class="flex-1 text-left">
                <div class="font-medium text-error">清空所有数据</div>
                <div class="text-sm text-error/70">删除所有记录和设置</div>
              </div>
            </button>
          </div>

          <div v-else class="p-5 bg-error/5">
            <p class="text-error text-sm mb-4">确定要清空所有数据吗？此操作不可恢复。</p>
            <div class="flex gap-3">
              <button
                @click="showClearConfirm = false"
                class="flex-1 py-3 px-4 bg-white border border-paper-3 rounded-xl text-ink font-medium hover:bg-paper-2 transition-colors"
              >
                取消
              </button>
              <button
                @click="handleClearData"
                class="flex-1 py-3 px-4 bg-error text-white rounded-xl font-medium hover:bg-error/90 transition-colors"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="text-center text-sm text-ink-faint py-6">
        <p>时间去哪了 v1.0.0</p>
      </div>
    </template>

    <template v-else-if="currentPage === 'category'">
      <div class="flex items-center justify-between mb-6">
        <button
          @click="goBack"
          class="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="font-medium">返回</span>
        </button>
      </div>

      <h2 class="text-xl font-semibold text-ink font-display mb-6">工作项目管理</h2>

      <div class="flex gap-2 mb-6">
        <button
          @click="categoryTab = 'active'"
          :class="[
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
            categoryTab === 'active'
              ? 'bg-accent text-white shadow-medium'
              : 'bg-paper-2 text-ink-muted hover:bg-paper-3'
          ]"
        >
          进行中 ({{ activeCategories.length }})
        </button>
        <button
          @click="categoryTab = 'completed'"
          :class="[
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
            categoryTab === 'completed'
              ? 'bg-accent text-white shadow-medium'
              : 'bg-paper-2 text-ink-muted hover:bg-paper-3'
          ]"
        >
          已完成 ({{ completedCategories.length }})
        </button>
      </div>

      <div class="space-y-3 mb-6">
        <template v-if="categoryTab === 'active'">
          <div
            v-for="category in activeCategories"
            :key="category.id"
            class="card p-5"
          >
            <template v-if="editingCategoryId === category.id">
              <div class="flex gap-2">
                <input
                  v-model="editingCategoryName"
                  @keydown.enter="saveCategory"
                  type="text"
                  class="flex-1 input"
                  placeholder="输入项目名称"
                />
                <button
                  @click="saveCategory"
                  class="btn btn-primary py-3 px-4"
                >
                  保存
                </button>
                <button
                  @click="cancelEditCategory"
                  class="btn btn-secondary py-3 px-4"
                >
                  取消
                </button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-ink">{{ category.name }}</div>
                  <div class="text-sm text-ink-muted mt-1">
                    已使用 {{ category.usageCount }} 次
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    @click="startEditCategory(category.id, category.name)"
                    class="p-2 text-ink-faint hover:text-accent hover:bg-paper-2 rounded-xl transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="toggleCategoryCompleted(category.id)"
                    class="p-2 text-ink-faint hover:text-success hover:bg-paper-2 rounded-xl transition-colors"
                    title="标记为已完成"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    @click="deleteCategory(category.id)"
                    class="p-2 text-ink-faint hover:text-error hover:bg-paper-2 rounded-xl transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>

          <button
            v-if="!showAddCategory"
            @click="showAddCategory = true"
            class="w-full card p-5 border-2 border-dashed border-paper-3 text-ink-faint hover:border-accent/50 hover:text-accent transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="font-medium">添加新项目</span>
          </button>

          <div v-else class="card p-5">
            <div class="flex gap-2">
              <input
                v-model="newCategoryName"
                @keydown.enter="addCategory"
                type="text"
                class="flex-1 input"
                placeholder="输入项目名称"
              />
              <button
                @click="addCategory"
                class="btn btn-primary py-3 px-4"
              >
                添加
              </button>
              <button
                @click="showAddCategory = false; newCategoryName = ''"
                class="btn btn-secondary py-3 px-4"
              >
                取消
              </button>
            </div>
          </div>

          <div v-if="activeCategories.length === 0 && !showAddCategory" class="text-center py-12 text-ink-faint">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p>暂无进行中的工作项目</p>
            <p class="text-sm mt-1">点击上方按钮添加新项目</p>
          </div>
        </template>

        <template v-else>
          <div
            v-for="category in completedCategories"
            :key="category.id"
            class="card p-5"
          >
            <template v-if="editingCategoryId === category.id">
              <div class="flex gap-2">
                <input
                  v-model="editingCategoryName"
                  @keydown.enter="saveCategory"
                  type="text"
                  class="flex-1 input"
                  placeholder="输入项目名称"
                />
                <button
                  @click="saveCategory"
                  class="btn btn-primary py-3 px-4"
                >
                  保存
                </button>
                <button
                  @click="cancelEditCategory"
                  class="btn btn-secondary py-3 px-4"
                >
                  取消
                </button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-ink-faint line-through">{{ category.name }}</div>
                  <div class="text-sm text-ink-faint mt-1">
                    已使用 {{ category.usageCount }} 次
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    @click="startEditCategory(category.id, category.name)"
                    class="p-2 text-ink-faint hover:text-accent hover:bg-paper-2 rounded-xl transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="toggleCategoryCompleted(category.id)"
                    class="p-2 text-ink-faint hover:text-accent hover:bg-paper-2 rounded-xl transition-colors"
                    title="恢复为进行中"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button
                    @click="deleteCategory(category.id)"
                    class="p-2 text-ink-faint hover:text-error hover:bg-paper-2 rounded-xl transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>

          <div v-if="completedCategories.length === 0" class="text-center py-12 text-ink-faint">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
            </svg>
            <p>暂无已完成的工作项目</p>
            <p class="text-sm mt-1">点击项目旁的复选标记可将其标记为已完成</p>
          </div>
        </template>
      </div>
    </template>

    <template v-else-if="currentPage === 'ai'">
      <div class="flex items-center justify-between mb-6">
        <button
          @click="goBack"
          class="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="font-medium">返回</span>
        </button>
      </div>

      <h2 class="text-xl font-semibold text-ink font-display mb-6">AI 服务配置</h2>

      <div class="card p-6 mb-6">
        <div class="flex items-start gap-4 mb-6">
          <div class="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg class="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div class="font-semibold text-ink mb-1">硅基流动 API</div>
            <div class="text-sm text-ink-muted">
              {{ hasApiKey() ? '已配置 API Key，可正常使用 AI 分析功能' : '未配置 API Key，使用基础分析模式' }}
            </div>
          </div>
        </div>

        <div v-if="!showApiKeyInput">
          <button
            @click="showApiKeyInput = true"
            class="w-full btn btn-primary"
          >
            {{ hasApiKey() ? '修改 API Key' : '配置 API Key' }}
          </button>
        </div>

        <div v-else class="space-y-4">
          <input
            v-model="apiKeyInput"
            type="password"
            class="w-full input"
            placeholder="输入您的硅基流动 API Key"
          />
          <div class="flex gap-3">
            <button
              @click="saveApiKey"
              :disabled="!apiKeyInput.trim()"
              class="flex-1 btn btn-primary"
            >
              保存
            </button>
            <button
              @click="showApiKeyInput = false"
              class="flex-1 btn btn-secondary"
            >
              取消
            </button>
          </div>
          <button
            v-if="hasApiKey()"
            @click="clearApiKey"
            class="w-full text-sm text-error hover:text-error/80 transition-colors"
          >
            清除已保存的 API Key
          </button>
        </div>
      </div>

      <div class="card p-5 bg-accent/5 border-accent/20">
        <h3 class="font-medium text-ink mb-4">如何获取 API Key</h3>
        <ol class="text-sm text-ink-muted space-y-2">
          <li class="flex gap-2">
            <span class="font-medium text-ink">1.</span>
            <span>访问 <a href="https://account.siliconflow.cn" target="_blank" class="text-accent underline hover:no-underline">硅基流动官网</a></span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium text-ink">2.</span>
            <span>注册/登录账号</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium text-ink">3.</span>
            <span>在个人中心获取 API Key</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium text-ink">4.</span>
            <span>粘贴到上方输入框中保存</span>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
