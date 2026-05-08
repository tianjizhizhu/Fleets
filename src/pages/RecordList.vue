<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRecordStore } from '@/stores/recordStore';
import { useUserStore } from '@/stores/userStore';
import { formatDate, formatTime, formatDuration } from '@/utils/time';
import type { DateFilter } from '@/types';
import RecordCard from '@/components/record/RecordCard.vue';

const recordStore = useRecordStore();
const userStore = useUserStore();

const searchQuery = ref('');
const selectedDateFilter = ref<DateFilter>('all');

const filterOptions: { label: string; value: DateFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
];

const filteredRecords = computed(() => {
  let records = recordStore.filteredRecords;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    records = records.filter(r =>
      r.summary.toLowerCase().includes(query) ||
      r.rawText.toLowerCase().includes(query)
    );
  }

  return records;
});

const groupedRecords = computed(() => {
  const groups = new Map<string, typeof filteredRecords.value>();

  filteredRecords.value.forEach(record => {
    const date = new Date(record.createdAt).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(record);
  });

  return groups;
});

function setFilter(filter: DateFilter) {
  selectedDateFilter.value = filter;
  recordStore.setDateFilter(filter);
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-4">
    <div class="mb-4">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索记录内容..."
          class="input pl-10"
        />
      </div>
    </div>

    <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        @click="setFilter(option.value)"
        :class="[
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
          selectedDateFilter === option.value
            ? 'bg-primary text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
        ]"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="filteredRecords.length === 0" class="empty-state">
      <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p class="text-gray-500 mb-2">暂无记录</p>
      <p class="text-sm text-gray-400">点击首页按钮开始记录</p>
    </div>

    <div v-else class="space-y-6">
      <div v-for="[date, records] in groupedRecords" :key="date">
        <div class="flex items-center gap-3 mb-3">
          <h3 class="text-sm font-medium text-gray-500">{{ date }}</h3>
          <div class="flex-1 h-px bg-gray-200" />
          <span class="text-xs text-gray-400">{{ records.length }} 条记录</span>
        </div>
        <div class="space-y-3">
          <RecordCard
            v-for="record in records"
            :key="record.id"
            :record="record"
            :categories="userStore.categories"
          />
        </div>
      </div>
    </div>
  </div>
</template>
