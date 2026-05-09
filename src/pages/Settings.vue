<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRecordStore } from '@/stores/recordStore';
import { useClusterStore } from '@/stores/clusterStore';
import { exportAllData, importData, clearAllData } from '@/utils/storage';
import { getApiKey, setApiKey, hasApiKey } from '@/utils/ai';

const userStore = useUserStore();
const recordStore = useRecordStore();
const clusterStore = useClusterStore();

const newCategoryName = ref('');
const showAddCategory = ref(false);
const showClearConfirm = ref(false);
const isExporting = ref(false);
const isImporting = ref(false);
const apiKeyInput = ref(getApiKey() || '');
const showApiKeyInput = ref(false);

function addCategory() {
  const name = newCategoryName.value.trim();
  if (name) {
    userStore.addCategory(name);
    newCategoryName.value = '';
    showAddCategory.value = false;
  }
}

function deleteCategory(id: string) {
  userStore.deleteCategory(id);
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
  <div class="page-content py-4">
    <div class="mb-6">
      <h3 class="section-title">工作类别管理</h3>

      <div class="space-y-3">
        <div
          v-for="category in userStore.categories"
          :key="category.id"
          class="card p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-gray-900">{{ category.name }}</div>
              <div class="text-sm text-gray-500">
                已使用 {{ category.usageCount }} 次
              </div>
            </div>
            <button
              @click="deleteCategory(category.id)"
              class="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <button
          v-if="!showAddCategory"
          @click="showAddCategory = true"
          class="w-full card p-4 border-dashed border-2 border-gray-200 hover:border-primary hover:text-primary transition-colors text-gray-500"
        >
          <div class="flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>添加新类别</span>
          </div>
        </button>

        <div v-else class="card p-4">
          <div class="flex gap-2">
            <input
              v-model="newCategoryName"
              @keydown.enter="addCategory"
              type="text"
              placeholder="输入类别名称"
              class="input flex-1"
            />
            <button
              @click="addCategory"
              class="btn btn-primary"
            >
              添加
            </button>
            <button
              @click="showAddCategory = false; newCategoryName = ''"
              class="btn btn-secondary"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="section-title">AI 服务配置</h3>

      <div class="card p-4">
        <div class="flex items-start gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="font-medium text-gray-900 mb-1">硅基流动 API Key</div>
            <div class="text-sm text-gray-500">
              {{ hasApiKey() ? '已配置 API Key，可正常使用 AI 分析功能' : '未配置 API Key，使用基础分析模式' }}
            </div>
          </div>
        </div>

        <div v-if="!showApiKeyInput">
          <button
            @click="showApiKeyInput = true"
            class="w-full btn btn-secondary py-2"
          >
            {{ hasApiKey() ? '修改 API Key' : '配置 API Key' }}
          </button>
        </div>

        <div v-else class="space-y-3">
          <input
            v-model="apiKeyInput"
            type="password"
            class="input"
            placeholder="输入您的硅基流动 API Key"
          />
          <div class="flex gap-2">
            <button
              @click="saveApiKey"
              :disabled="!apiKeyInput.trim()"
              class="flex-1 btn btn-primary py-2"
            >
              保存
            </button>
            <button
              @click="showApiKeyInput = false"
              class="flex-1 btn btn-secondary py-2"
            >
              取消
            </button>
          </div>
          <button
            v-if="hasApiKey()"
            @click="clearApiKey"
            class="w-full text-sm text-red-500 hover:text-red-600"
          >
            清除已保存的 API Key
          </button>
        </div>

        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-500">
            <strong>如何获取 API Key：</strong><br />
            1. 访问 <a href="https://account.siliconflow.cn" target="_blank" class="text-primary hover:underline">硅基流动官网</a><br />
            2. 注册/登录账号<br />
            3. 在个人中心获取 API Key<br />
            4. 粘贴到上方输入框中保存
          </p>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="section-title">数据管理</h3>

      <div class="space-y-3">
        <button
          @click="handleExport"
          :disabled="isExporting"
          class="w-full card p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-gray-900">导出数据</div>
              <div class="text-sm text-gray-500">将所有记录导出为 JSON 文件</div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          @click="handleImport"
          :disabled="isImporting"
          class="w-full card p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-gray-900">导入数据</div>
              <div class="text-sm text-gray-500">从 JSON 文件恢复数据</div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          v-if="!showClearConfirm"
          @click="showClearConfirm = true"
          class="w-full card p-4 flex items-center justify-between hover:bg-red-50 transition-colors border-red-100"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-red-600">清空所有数据</div>
              <div class="text-sm text-red-400">删除所有记录和设置</div>
            </div>
          </div>
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div v-else class="card p-4 bg-red-50 border border-red-200">
          <p class="text-red-700 mb-4">确定要清空所有数据吗？此操作不可恢复。</p>
          <div class="flex gap-2">
            <button
              @click="showClearConfirm = false"
              class="flex-1 btn btn-secondary"
            >
              取消
            </button>
            <button
              @click="handleClearData"
              class="flex-1 btn btn-danger"
            >
              确认清空
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center text-sm text-gray-400 py-8">
      <p>智能工时 v1.0.0</p>
      <p class="mt-1">让工作记录更简单</p>
    </div>
  </div>
</template>
