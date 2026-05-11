import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Cluster, ClusterStats, WorkRecord, WorkCategory, CategoryStat, DailyStat } from '@/types';
import { getAllClusters, saveCluster, deleteCluster as deleteFromDB, generateId } from '@/utils/storage';
import { clusterWorkRecords } from '@/utils/ai';
import { formatDateShort } from '@/utils/time';

export const useClusterStore = defineStore('cluster', () => {
  const clusters = ref<Cluster[]>([]);
  const isLoading = ref(false);
  const lastRunAt = ref<string | null>(null);

  const clustersByCategory = computed(() => {
    const grouped = new Map<string, Cluster[]>();
    clusters.value.forEach(cluster => {
      const existing = grouped.get(cluster.categoryId) || [];
      existing.push(cluster);
      grouped.set(cluster.categoryId, existing);
    });
    return grouped;
  });

  async function loadClusters() {
    isLoading.value = true;
    try {
      clusters.value = await getAllClusters();
    } finally {
      isLoading.value = false;
    }
  }

  async function runClusterAnalysis(records: WorkRecord[], categories: WorkCategory[]) {
    isLoading.value = true;
    try {
      const confirmedRecords = records
        .filter(r => r.annotationStatus === 'confirmed')
        .map(r => ({
          summary: r.summary,
          categoryId: r.categoryId || '',
          duration: r.duration
        }));

      const aiClusters = await clusterWorkRecords(confirmedRecords, categories);

      const newClusters: Cluster[] = aiClusters.map(c => ({
        id: generateId(),
        categoryId: c.categoryId,
        name: c.name,
        recordIds: c.recordIndices.map(i => records[i]?.id || '').filter(Boolean),
        totalDuration: c.totalDuration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      await Promise.all([
        ...clusters.value.map(c => deleteFromDB(c.id)),
        ...newClusters.map(c => saveCluster(c))
      ]);

      clusters.value = newClusters;
      lastRunAt.value = new Date().toISOString();
    } finally {
      isLoading.value = false;
    }
  }

  async function updateCluster(id: string, updates: Partial<Cluster>) {
    const index = clusters.value.findIndex(c => c.id === id);
    if (index !== -1) {
      clusters.value[index] = {
        ...clusters.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await saveCluster(clusters.value[index]);
    }
  }

  async function deleteClusterById(id: string) {
    clusters.value = clusters.value.filter(c => c.id !== id);
    await deleteFromDB(id);
  }

  function getClusterStats(
    records: WorkRecord[],
    categories: WorkCategory[],
    startDate?: Date,
    endDate?: Date
  ): ClusterStats {
    const filteredRecords = records.filter(record => {
      const recordDate = new Date(record.createdAt);
      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
      return record.annotationStatus !== 'pending';
    });

    const totalDuration = filteredRecords.reduce((sum, r) => sum + r.duration, 0);
    const totalRecords = filteredRecords.length;

    const categoryStats: CategoryStat[] = categories.map(category => {
      const categoryRecords = filteredRecords.filter(r => r.categoryId === category.id);
      const catDuration = categoryRecords.reduce((sum, r) => sum + r.duration, 0);
      return {
        categoryId: category.id,
        categoryName: category.name,
        totalDuration: catDuration,
        recordCount: categoryRecords.length,
        percentage: totalDuration > 0 ? Math.round((catDuration / totalDuration) * 100) : 0
      };
    });

    const dailyMap = new Map<string, DailyStat>();
    filteredRecords.forEach(record => {
      const dateKey = new Date(record.createdAt).toDateString();
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: formatDateShort(record.createdAt),
          totalDuration: 0,
          categoryDurations: {}
        });
      }
      const dayStat = dailyMap.get(dateKey)!;
      dayStat.totalDuration += record.duration;

      if (record.categoryId) {
        dayStat.categoryDurations[record.categoryId] =
          (dayStat.categoryDurations[record.categoryId] || 0) + record.duration;
      }
    });

    const dailyStats = Array.from(dailyMap.values()).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return {
      totalDuration,
      totalRecords,
      categoryStats,
      dailyStats
    };
  }

  function getTopClusters(limit = 10): Cluster[] {
    return [...clusters.value]
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);
  }

  return {
    clusters,
    isLoading,
    lastRunAt,
    clustersByCategory,
    loadClusters,
    runClusterAnalysis,
    updateCluster,
    deleteClusterById,
    getClusterStats,
    getTopClusters
  };
});
