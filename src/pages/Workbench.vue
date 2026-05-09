<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRecordStore } from '@/stores/recordStore';
import { useUserStore } from '@/stores/userStore';
import { useClusterStore } from '@/stores/clusterStore';
import { formatDuration } from '@/utils/time';
import type { TimeGranularity, WorkMode } from '@/types';
import * as echarts from 'echarts';

const recordStore = useRecordStore();
const userStore = useUserStore();
const clusterStore = useClusterStore();

const timeGranularity = ref<TimeGranularity>('day');
const pieChartRef = ref<HTMLDivElement | null>(null);
const lineChartRef = ref<HTMLDivElement | null>(null);
const workModeChartRef = ref<HTMLDivElement | null>(null);
let pieChart: echarts.ECharts | null = null;
let lineChart: echarts.ECharts | null = null;
let workModeChart: echarts.ECharts | null = null;

const stats = computed(() => {
  return clusterStore.getClusterStats(
    recordStore.records,
    userStore.categories
  );
});

const totalDuration = computed(() => stats.value.totalDuration);
const totalRecords = computed(() => stats.value.totalRecords);

const categoryChartData = computed(() => {
  return stats.value.categoryStats.map(stat => ({
    name: stat.categoryName,
    value: stat.totalDuration,
    percentage: stat.percentage
  }));
});

const workModeData = computed(() => {
  const modeMap: Record<WorkMode, number> = { 'SOLO': 0, '会议': 0, '调研': 0 };
  recordStore.records.forEach(record => {
    if (record.workMode && modeMap[record.workMode] !== undefined) {
      modeMap[record.workMode] += record.duration;
    }
  });
  return Object.entries(modeMap)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalDuration.value > 0 ? Math.round((value / totalDuration.value) * 100) : 0
    }));
});

const workModeChartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c}分钟 ({d}%)'
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    textStyle: {
      fontSize: 12
    }
  },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: workModeData.value.length > 0
        ? workModeData.value
        : [{ name: '暂无数据', value: 1 }]
    }
  ],
  color: ['#10b981', '#3b82f6', '#f59e0b']
}));

const pieOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c}分钟 ({d}%)'
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    textStyle: {
      fontSize: 12
    }
  },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: categoryChartData.value.length > 0
        ? categoryChartData.value
        : [{ name: '暂无数据', value: 1 }]
    }
  ],
  color: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
}));

const lineOption = computed(() => {
  const dates = stats.value.dailyStats.map(s => s.date);
  const durations = stats.value.dailyStats.map(s => s.totalDuration);

  return {
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates.length > 0 ? dates : ['暂无数据'],
      axisLabel: {
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `${value}m`,
        fontSize: 10
      }
    },
    series: [
      {
        name: '工作时长',
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3
        },
        data: durations.length > 0 ? durations : [0],
        itemStyle: {
          color: '#6366f1'
        },
        areaColor: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0)' }
          ]
        }
      }
    ]
  };
});

function initCharts() {
  if (pieChartRef.value && !pieChart) {
    pieChart = echarts.init(pieChartRef.value);
  }
  if (lineChartRef.value && !lineChart) {
    lineChart = echarts.init(lineChartRef.value);
  }
  if (workModeChartRef.value && !workModeChart) {
    workModeChart = echarts.init(workModeChartRef.value);
  }
}

function updateCharts() {
  if (pieChart) {
    pieChart.setOption(pieOption.value);
  }
  if (lineChart) {
    lineChart.setOption(lineOption.value);
  }
  if (workModeChart) {
    workModeChart.setOption(workModeChartOption.value);
  }
}

async function runClusterAnalysis() {
  await clusterStore.runClusterAnalysis(
    recordStore.records,
    userStore.categories
  );
}

onMounted(async () => {
  await recordStore.loadRecords();
  await userStore.categories;
  await clusterStore.loadClusters();

  setTimeout(() => {
    initCharts();
    updateCharts();
  }, 100);

  window.addEventListener('resize', () => {
    pieChart?.resize();
    lineChart?.resize();
    workModeChart?.resize();
  });
});

watch(() => stats.value, () => {
  updateCharts();
}, { deep: true });
</script>

<template>
  <div class="page-content py-4">
    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold text-primary mb-1">
          {{ formatDuration(totalDuration) }}
        </div>
        <div class="text-sm text-gray-500">总工作时长</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold text-secondary mb-1">
          {{ totalRecords }}
        </div>
        <div class="text-sm text-gray-500">工作记录数</div>
      </div>
    </div>

    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-gray-900">工作项目分布</h3>
      </div>
      <div ref="pieChartRef" class="w-full h-64" />
    </div>

    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-gray-900">工作方式分布</h3>
      </div>
      <div ref="workModeChartRef" class="w-full h-64" />
    </div>

    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-gray-900">耗时趋势</h3>
      </div>
      <div ref="lineChartRef" class="w-full h-48" />
    </div>

    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-gray-900">聚类统计</h3>
        <button
          v-if="recordStore.annotatedRecords.length >= 5"
          @click="runClusterAnalysis"
          :disabled="clusterStore.isLoading"
          class="text-sm text-primary hover:text-primary-dark"
        >
          {{ clusterStore.isLoading ? '分析中...' : '重新分析' }}
        </button>
      </div>

      <div v-if="clusterStore.clusters.length === 0" class="text-center py-8">
        <p class="text-gray-500 mb-2">暂无聚类数据</p>
        <p class="text-sm text-gray-400">
          标注更多记录后，系统将自动分析工作模式
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="cluster in clusterStore.clusters.slice(0, 10)"
          :key="cluster.id"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <div class="font-medium text-gray-900">{{ cluster.name }}</div>
            <div class="text-xs text-gray-500">
              {{ cluster.recordIds.length }} 条记录
            </div>
          </div>
          <div class="text-right">
            <div class="font-medium text-primary">
              {{ formatDuration(cluster.totalDuration) }}
            </div>
            <div class="text-xs text-gray-400">
              {{ Math.round((cluster.totalDuration / totalDuration) * 100) || 0 }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card p-4">
      <h3 class="font-medium text-gray-900 mb-4">项目明细</h3>

      <div v-if="categoryChartData.length === 0" class="text-center py-8">
        <p class="text-gray-500 mb-2">暂无分类数据</p>
        <p class="text-sm text-gray-400">
          标注记录后即可查看分类统计
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(stat, index) in stats.categoryStats"
          :key="stat.categoryId"
          class="flex items-center gap-4"
        >
          <div
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index] }"
          />
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-gray-900">{{ stat.categoryName }}</span>
              <span class="text-sm text-gray-500">{{ formatDuration(stat.totalDuration) }}</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="{
                  width: `${stat.percentage}%`,
                  backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index]
                }"
              />
            </div>
          </div>
          <span class="text-xs text-gray-400 w-10 text-right">
            {{ stat.percentage }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
