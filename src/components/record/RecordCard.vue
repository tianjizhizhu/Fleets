<script setup lang="ts">
import { computed } from 'vue';
import { formatTime, formatDuration } from '@/utils/time';
import type { WorkRecord, WorkCategory } from '@/types';
import { useRecordStore } from '@/stores/recordStore';

const props = defineProps<{
  record: Partial<WorkRecord> & {
    id: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    summary?: string;
    categoryId?: string | null;
    confidence?: number;
  };
  categories: WorkCategory[];
  isPreview?: boolean;
}>();

const recordStore = useRecordStore();

const category = computed(() => {
  if (!props.record.categoryId) return null;
  return props.categories.find(c => c.id === props.record.categoryId) || null;
});

const timeRange = computed(() => {
  if (props.record.startTime && props.record.endTime) {
    return `${formatTime(props.record.startTime)} - ${formatTime(props.record.endTime)}`;
  }
  return '';
});

const duration = computed(() => {
  return props.record.duration || 0;
});

const confidenceClass = computed(() => {
  const confidence = props.record.confidence || 0;
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
});

async function handleCategorySelect(categoryId: string) {
  if (props.isPreview) return;

  await recordStore.updateRecord(props.record.id, {
    categoryId,
    annotationStatus: 'confirmed'
  });
}

async function handleDelete() {
  if (props.isPreview) return;
  await recordStore.deleteRecord(props.record.id);
}
</script>

<template>
  <div :class="['card p-4', !isPreview && 'card-hover cursor-pointer']">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span v-if="timeRange" class="font-mono">{{ timeRange }}</span>
          <span v-if="duration" class="tag tag-primary">
            {{ formatDuration(duration) }}
          </span>
        </div>

        <p class="text-gray-900 font-medium mb-2">
          {{ record.summary || '未描述工作内容' }}
        </p>

        <div class="flex items-center gap-2">
          <template v-if="category">
            <span
              :class="[
                'tag',
                isPreview ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'
              ]"
            >
              {{ category.name }}
            </span>
          </template>
          <template v-else>
            <span class="tag bg-gray-100 text-gray-500">待标注</span>
          </template>

          <span
            v-if="record.confidence !== undefined && !isPreview"
            :class="['text-xs', confidenceClass]"
          >
            置信度 {{ Math.round(record.confidence * 100) }}%
          </span>
        </div>
      </div>

      <div v-if="!isPreview" class="flex items-center gap-2">
        <div class="flex flex-col gap-1">
          <button
            @click.stop="handleDelete"
            class="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!isPreview && categories.length > 0"
      class="mt-3 pt-3 border-t border-gray-100"
      @click.stop
    >
      <p class="text-xs text-gray-400 mb-2">快速标注</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="handleCategorySelect(cat.id)"
          :class="[
            'px-3 py-1 text-sm rounded-full transition-all',
            record.categoryId === cat.id
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>
  </div>
</template>
