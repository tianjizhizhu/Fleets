<script setup lang="ts">
import { computed } from 'vue';
import { formatTime, formatDuration } from '@/utils/time';
import type { WorkRecord, WorkCategory, WorkMode } from '@/types';
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
    workMode?: WorkMode;
  };
  categories: WorkCategory[];
  isPreview?: boolean;
}>();

const recordStore = useRecordStore();

const category = computed(() => {
  if (!props.record.categoryId) return null;
  return props.categories.find((c) => c.id === props.record.categoryId) || null;
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

const workModeClass = computed(() => {
  const mode = props.record.workMode || 'SOLO';
  if (mode === '会议') return 'bg-warning/10 text-warning';
  if (mode === '调研') return 'bg-accent/10 text-accent';
  return 'bg-success/10 text-success';
});

async function handleCategorySelect(categoryId: string) {
  if (props.isPreview) return;

  await recordStore.updateRecord(props.record.id, {
    categoryId,
    annotationStatus: 'confirmed',
  });
}

async function handleDelete() {
  if (props.isPreview) return;
  await recordStore.deleteRecord(props.record.id);
}
</script>

<template>
  <div
    :class="[
      'card p-5 animate-float-in',
      !isPreview && 'card-hover cursor-pointer',
    ]"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 text-sm text-ink-muted mb-2">
          <span
            v-if="timeRange"
            class="font-mono text-sm"
            >{{ timeRange }}</span
          >
          <span
            v-if="duration"
            class="tag tag-accent text-xs"
          >
            {{ formatDuration(duration) }}
          </span>
        </div>

        <p class="text-ink font-medium mb-3 leading-relaxed">
          {{ record.summary || '未描述工作内容' }}
        </p>

        <div class="flex items-center gap-2">
          <template v-if="category">
            <span
              :class="[
                'tag text-xs',
                isPreview ? 'bg-accent/10 text-accent' : 'bg-accent/10 text-accent',
              ]"
            >
              {{ category.name }}
            </span>
          </template>
          <template v-else>
            <span class="tag tag-ink text-xs">待标注</span>
          </template>

          <span
            v-if="record.workMode"
            :class="['tag text-xs', workModeClass]"
          >
            {{ record.workMode }}
          </span>
        </div>
      </div>

      <div v-if="!isPreview" class="flex items-center gap-1">
        <button
          @click.stop="handleDelete"
          class="p-2 text-ink-faint hover:text-error transition-colors rounded-full hover:bg-paper-2"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>

    <div
      v-if="!isPreview && categories.length > 0"
      class="mt-4 pt-4 border-t border-paper-3"
      @click.stop
    >
      <p class="text-xs text-ink-faint mb-3">快速标注</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories.filter((c) => !c.isCompleted)"
          :key="cat.id"
          @click="handleCategorySelect(cat.id)"
          :class="[
            'px-3 py-1.5 text-sm rounded-xl transition-all duration-200',
            record.categoryId === cat.id
              ? 'bg-accent text-white shadow-sm'
              : 'bg-paper-2 text-ink-muted hover:bg-paper-3',
          ]"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>
  </div>
</template>
