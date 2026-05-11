import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorkRecord, DateFilter } from '@/types';
import { getAllRecords, saveRecord, deleteRecord as deleteFromDB, initDB } from '@/utils/storage';
import { getDateRange, groupByDate, isSameDay } from '@/utils/time';

export const useRecordStore = defineStore('record', () => {
  const records = ref<WorkRecord[]>([]);
  const currentRecord = ref<WorkRecord | null>(null);
  const isLoading = ref(false);
  const dateFilter = ref<DateFilter>('all');

  const sortedRecords = computed(() => {
    return [...records.value].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  const filteredRecords = computed(() => {
    if (dateFilter.value === 'all') {
      return sortedRecords.value;
    }

    const { start, end } = getDateRange(dateFilter.value as 'today' | 'week' | 'month');
    return sortedRecords.value.filter(record => {
      const createdAt = new Date(record.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  });

  const recordsByDate = computed(() => {
    return groupByDate(filteredRecords.value);
  });

  const pendingRecords = computed(() => {
    return records.value.filter(r => r.annotationStatus === 'pending');
  });

  const annotatedRecords = computed(() => {
    return records.value.filter(r => r.annotationStatus !== 'pending');
  });

  const annotationProgress = computed(() => {
    const total = records.value.length;
    const annotated = records.value.filter(r => r.annotationStatus !== 'pending').length;
    return {
      total,
      annotated,
      percentage: total > 0 ? Math.round((annotated / total) * 100) : 0
    };
  });

  async function loadRecords() {
    isLoading.value = true;
    try {
      await initDB();
      records.value = await getAllRecords();
    } finally {
      isLoading.value = false;
    }
  }

  async function addRecord(record: WorkRecord) {
    records.value.push(record);
    await saveRecord(record);
  }

  async function updateRecord(id: string, updates: Partial<WorkRecord>) {
    const index = records.value.findIndex(r => r.id === id);
    if (index !== -1) {
      records.value[index] = {
        ...records.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await saveRecord(records.value[index]);

      if (currentRecord.value?.id === id) {
        currentRecord.value = records.value[index];
      }
    }
  }

  async function deleteRecord(id: string) {
    records.value = records.value.filter(r => r.id !== id);
    await deleteFromDB(id);

    if (currentRecord.value?.id === id) {
      currentRecord.value = null;
    }
  }

  function setCurrentRecord(record: WorkRecord | null) {
    currentRecord.value = record;
  }

  function setDateFilter(filter: DateFilter) {
    dateFilter.value = filter;
  }

  function getRecordsByCategory(categoryId: string): WorkRecord[] {
    return records.value.filter(r => r.categoryId === categoryId);
  }

  function getRecordsByCluster(clusterId: string): WorkRecord[] {
    return records.value.filter(r => r.clusterId === clusterId);
  }

  return {
    records,
    currentRecord,
    isLoading,
    dateFilter,
    sortedRecords,
    filteredRecords,
    recordsByDate,
    pendingRecords,
    annotatedRecords,
    annotationProgress,
    loadRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    setCurrentRecord,
    setDateFilter,
    getRecordsByCategory,
    getRecordsByCluster
  };
});
