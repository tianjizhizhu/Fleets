<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRecordStore } from '@/stores/recordStore';
import { useUserStore } from '@/stores/userStore';
import { formatDuration } from '@/utils/time';
import type { WorkRecord } from '@/types';

const recordStore = useRecordStore();
const userStore = useUserStore();

const selectedRecords = ref<Set<string>>(new Set());
const isBatchMode = ref(false);

const progress = computed(() => recordStore.annotationProgress);

const pendingRecords = computed(() => recordStore.pendingRecords);
const annotatedRecords = computed(() => recordStore.annotatedRecords);

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0;
  return Math.round((progress.value.annotated / progress.value.total) * 100);
});

const totalDuration = computed(() => {
  return annotatedRecords.value.reduce((sum, r) => sum + r.duration, 0);
});

function toggleSelect(id: string) {
  if (selectedRecords.value.has(id)) {
    selectedRecords.value.delete(id);
  } else {
    selectedRecords.value.add(id);
  }
}

function selectAll() {
  pendingRecords.value.forEach(r => selectedRecords.value.add(r.id));
}

function clearSelection() {
  selectedRecords.value.clear();
}

async function batchAnnotate(categoryId: string) {
  for (const id of selectedRecords.value) {
    await recordStore.updateRecord(id, {
      categoryId,
      annotationStatus: 'confirmed'
    });
  }
  userStore.incrementCategoryUsage(categoryId);
  selectedRecords.value.clear();
  isBatchMode.value = false;

  userStore.updateAnnotationProgress(
    recordStore.records.length,
    recordStore.annotatedRecords.length
  );
}

async function annotateRecord(recordId: string, categoryId: string) {
  await recordStore.updateRecord(recordId, {
    categoryId,
    annotationStatus: 'confirmed'
  });
  userStore.incrementCategoryUsage(categoryId);

  userStore.updateAnnotationProgress(
    recordStore.records.length,
    recordStore.annotatedRecords.length
  );
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-4">
    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium text-gray-900">标注进度</h3>
        <span class="text-sm text-gray-500">
          {{ progress.annotated }}/{{ progress.total }} 条已完成
        </span>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
          :style="{ width: `${progressPercentage}%` }"
        />
      </div>
      <div class="flex justify-between mt-2 text-xs text-gray-400">
        <span>{{ progressPercentage }}% 完成</span>
        <span>已标注 {{ formatDuration(totalDuration) }}</span>
      </div>
    </div>

    <div v-if="isBatchMode && selectedRecords.size > 0" class="card p-4 mb-6 bg-primary/5 border-primary/20">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-primary">
          已选择 {{ selectedRecords.size }} 条记录
        </span>
        <div class="flex gap-2">
          <button
            @click="clearSelection"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            取消选择
          </button>
        </div>
      </div>
      <p class="text-sm text-gray-600 mb-3">批量标注到：</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="category in userStore.categories"
          :key="category.id"
          @click="batchAnnotate(category.id)"
          class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:border-primary hover:text-primary transition-colors"
        >
          {{ category.name }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between mb-4">
      <h3 class="section-title mb-0">待标注记录</h3>
      <button
        v-if="pendingRecords.length > 1"
        @click="isBatchMode = !isBatchMode"
        :class="[
          'text-sm px-3 py-1 rounded-full transition-colors',
          isBatchMode
            ? 'bg-primary text-white'
            : 'text-primary hover:bg-primary/10'
        ]"
      >
        {{ isBatchMode ? '退出批量' : '批量标注' }}
      </button>
    </div>

    <div v-if="isBatchMode && pendingRecords.length > 0" class="mb-4">
      <button
        @click="selectAll"
        class="text-sm text-primary hover:text-primary-dark"
      >
        全选
      </button>
    </div>

    <div v-if="pendingRecords.length === 0" class="empty-state">
      <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 mb-2">太棒了！</p>
      <p class="text-sm text-gray-400">所有记录都已标注完成</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="record in pendingRecords"
        :key="record.id"
        :class="[
          'card p-4 transition-all',
          selectedRecords.has(record.id) && 'ring-2 ring-primary bg-primary/5'
        ]"
      >
        <div class="flex items-start gap-3">
          <button
            v-if="isBatchMode"
            @click="toggleSelect(record.id)"
            :class="[
              'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors',
              selectedRecords.has(record.id)
                ? 'bg-primary border-primary'
                : 'border-gray-300 hover:border-primary'
            ]"
          >
            <svg
              v-if="selectedRecords.has(record.id)"
              class="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span class="font-mono">{{ record.summary || '未描述' }}</span>
              <span class="tag tag-warning">
                {{ formatDuration(record.duration) }}
              </span>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                v-for="category in userStore.categories"
                :key="category.id"
                @click="annotateRecord(record.id, category.id)"
                class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-primary hover:text-white transition-colors"
              >
                {{ category.name }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="annotatedRecords.length > 0" class="mt-8">
      <h3 class="section-title">已标注记录</h3>
      <div class="text-sm text-gray-500 mb-4">
        共 {{ annotatedRecords.length }} 条记录
      </div>
    </div>
  </div>
</template>
