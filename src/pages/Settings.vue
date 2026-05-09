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
  <div class="page-content">
    <template v-if="currentPage === 'main'">
      <section class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">项目管理</h2>
        <button
          @click="goToCategoryPage"
          class="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-gray-900">工作项目管理</div>
              <div class="text-sm text-gray-500 mt-0.5">
                {{ activeCategories.length }}个进行中 · {{ completedCategories.length }}个已完成
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">AI服务</h2>
        <button
          @click="goToAiPage"
          class="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-gray-900">AI 服务配置</div>
              <div class="text-sm text-gray-500 mt-0.5">
                {{ hasApiKey() ? '已配置 API Key' : '未配置，使用基础分析模式' }}
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">数据管理</h2>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            @click="handleExport"
            :disabled="isExporting"
            class="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-gray-900">导出数据</div>
              <div class="text-sm text-gray-500">将所有记录导出为 JSON 文件</div>
            </div>
          </button>

          <button
            @click="handleImport"
            :disabled="isImporting"
            class="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-gray-900">导入数据</div>
              <div class="text-sm text-gray-500">从 JSON 文件恢复数据</div>
            </div>
          </button>

          <div v-if="!showClearConfirm">
            <button
              @click="showClearConfirm = true"
              class="w-full flex items-center gap-4 p-4 hover:bg-red-50 transition-colors"
            >
              <div class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div class="flex-1 text-left">
                <div class="font-medium text-red-500">清空所有数据</div>
                <div class="text-sm text-red-400">删除所有记录和设置</div>
              </div>
            </button>
          </div>

          <div v-else class="p-4 bg-red-50">
            <p class="text-red-700 text-sm mb-3">确定要清空所有数据吗？此操作不可恢复。</p>
            <div class="flex gap-3">
              <button
                @click="showClearConfirm = false"
                class="flex-1 py-2 px-4 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                @click="handleClearData"
                class="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="text-center text-sm text-gray-400 py-8">
        <p>时间去哪了 v1.0.0</p>
      </div>
    </template>

    <template v-else-if="currentPage === 'category'">
      <div class="flex items-center justify-between mb-6">
        <button
          @click="goBack"
          class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="font-medium">返回</span>
        </button>
      </div>

      <h2 class="text-xl font-semibold text-gray-900 mb-6">工作项目管理</h2>

      <div class="flex gap-2 mb-6">
        <button
          @click="categoryTab = 'active'"
          :class="[
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
            categoryTab === 'active'
              ? 'bg-indigo-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          进行中 ({{ activeCategories.length }})
        </button>
        <button
          @click="categoryTab = 'completed'"
          :class="[
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
            categoryTab === 'completed'
              ? 'bg-indigo-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div class="p-4">
              <template v-if="editingCategoryId === category.id">
                <div class="flex gap-2">
                  <input
                    v-model="editingCategoryName"
                    @keydown.enter="saveCategory"
                    type="text"
                    class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    @click="saveCategory"
                    class="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    @click="cancelEditCategory"
                    class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium text-gray-900">{{ category.name }}</div>
                    <div class="text-sm text-gray-500 mt-1">
                      已使用 {{ category.usageCount }} 次
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      @click="startEditCategory(category.id, category.name)"
                      class="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      @click="toggleCategoryCompleted(category.id)"
                      class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                      title="标记为已完成"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      @click="deleteCategory(category.id)"
                      class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <button
            v-if="!showAddCategory"
            @click="showAddCategory = true"
            class="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="font-medium">添加新项目</span>
          </button>

          <div v-else class="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div class="flex gap-2">
              <input
                v-model="newCategoryName"
                @keydown.enter="addCategory"
                type="text"
                placeholder="输入项目名称"
                class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                @click="addCategory"
                class="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
              >
                添加
              </button>
              <button
                @click="showAddCategory = false; newCategoryName = ''"
                class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>

          <div v-if="activeCategories.length === 0 && !showAddCategory" class="text-center py-12 text-gray-400">
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
            class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div class="p-4">
              <template v-if="editingCategoryId === category.id">
                <div class="flex gap-2">
                  <input
                    v-model="editingCategoryName"
                    @keydown.enter="saveCategory"
                    type="text"
                    class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    @click="saveCategory"
                    class="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    @click="cancelEditCategory"
                    class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium text-gray-400 line-through">{{ category.name }}</div>
                    <div class="text-sm text-gray-400 mt-1">
                      已使用 {{ category.usageCount }} 次
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      @click="startEditCategory(category.id, category.name)"
                      class="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      @click="toggleCategoryCompleted(category.id)"
                      class="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="恢复为进行中"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      @click="deleteCategory(category.id)"
                      class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div v-if="completedCategories.length === 0" class="text-center py-12 text-gray-400">
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
          class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="font-medium">返回</span>
        </button>
      </div>

      <h2 class="text-xl font-semibold text-gray-900 mb-6">AI 服务配置</h2>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div class="flex items-start gap-4 mb-6">
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div class="font-semibold text-gray-900 mb-1">硅基流动 API</div>
            <div class="text-sm text-gray-500">
              {{ hasApiKey() ? '已配置 API Key，可正常使用 AI 分析功能' : '未配置 API Key，使用基础分析模式' }}
            </div>
          </div>
        </div>

        <div v-if="!showApiKeyInput">
          <button
            @click="showApiKeyInput = true"
            class="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
          >
            {{ hasApiKey() ? '修改 API Key' : '配置 API Key' }}
          </button>
        </div>

        <div v-else class="space-y-4">
          <input
            v-model="apiKeyInput"
            type="password"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="输入您的硅基流动 API Key"
          />
          <div class="flex gap-3">
            <button
              @click="saveApiKey"
              :disabled="!apiKeyInput.trim()"
              class="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
            <button
              @click="showApiKeyInput = false"
              class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
          <button
            v-if="hasApiKey()"
            @click="clearApiKey"
            class="w-full text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            清除已保存的 API Key
          </button>
        </div>
      </div>

      <div class="bg-indigo-50 rounded-xl p-4">
        <h3 class="font-medium text-indigo-900 mb-3">如何获取 API Key</h3>
        <ol class="text-sm text-indigo-700 space-y-2">
          <li class="flex gap-2">
            <span class="font-medium">1.</span>
            <span>访问 <a href="https://account.siliconflow.cn" target="_blank" class="underline hover:no-underline">硅基流动官网</a></span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium">2.</span>
            <span>注册/登录账号</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium">3.</span>
            <span>在个人中心获取 API Key</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium">4.</span>
            <span>粘贴到上方输入框中保存</span>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
