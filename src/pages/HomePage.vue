<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRecordStore } from '@/stores/recordStore';
import { analyzeWorkText, type AnalysisResult } from '@/utils/ai';
import { generateId } from '@/utils/storage';
import { formatTime, formatDuration } from '@/utils/time';
import type { WorkRecord, WorkMode } from '@/types';
import RecordCard from '@/components/record/RecordCard.vue';

const userStore = useUserStore();
const recordStore = useRecordStore();

const manualInputText = ref('');
const generatedRecord = ref<WorkRecord | null>(null);
const analysisResult = ref<AnalysisResult | null>(null);
const isAnalyzing = ref(false);
const showEditModal = ref(false);
const showConfirmModal = ref(false);

const editForm = ref({
  startTime: '',
  endTime: '',
  summary: '',
  categoryId: null as string | null,
  workMode: 'SOLO' as WorkMode,
});

const showNewCategoryPrompt = ref(false);
const pendingNewCategoryName = ref('');

const todayRecords = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return recordStore.records.filter((r) => {
    const recordDate = new Date(r.startTime);
    recordDate.setHours(0, 0, 0, 0);
    return recordDate.getTime() === today.getTime();
  });
});

const todayTotalMinutes = computed(() => {
  return todayRecords.value.reduce((sum, r) => sum + r.duration, 0);
});

const todayCategoryStats = computed(() => {
  const stats: Record<string, number> = {};
  todayRecords.value.forEach((r) => {
    if (r.categoryId) {
      stats[r.categoryId] = (stats[r.categoryId] || 0) + r.duration;
    }
  });
  return stats;
});

function getTodayDateDisplay() {
  const today = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${today.getMonth() + 1}月${today.getDate()}日 ${weekdays[today.getDay()]}`;
}

async function performAnalysis(inputText: string) {
  const activeCategories = userStore.categories.filter((c) => !c.isCompleted);
  const result = await analyzeWorkText(inputText, activeCategories);
  analysisResult.value = result;

  if (result.suggestedNewCategory && result.suggestedNewCategory.trim()) {
    pendingNewCategoryName.value = result.suggestedNewCategory.trim();
    showNewCategoryPrompt.value = true;
  } else if (!result.suggestedCategoryId && activeCategories.length > 0) {
    editForm.value = {
      startTime: formatTime(result.startTime),
      endTime: formatTime(result.endTime),
      summary: result.summary,
      categoryId: null,
      workMode: result.workMode,
    };
    showConfirmModal.value = true;
  } else if (activeCategories.length === 0) {
    pendingNewCategoryName.value = result.summary.substring(0, 15);
    showNewCategoryPrompt.value = true;
  } else {
    editForm.value = {
      startTime: formatTime(result.startTime),
      endTime: formatTime(result.endTime),
      summary: result.summary,
      categoryId: result.suggestedCategoryId,
      workMode: result.workMode,
    };
    showConfirmModal.value = true;
  }
}

async function handleManualSubmit() {
  if (!manualInputText.value.trim()) return;

  isAnalyzing.value = true;

  try {
    await performAnalysis(manualInputText.value);
  } catch (error) {
    console.error('Analysis failed:', error);
  } finally {
    isAnalyzing.value = false;
  }
}

async function handleReAnalyze() {
  showConfirmModal.value = false;
  isAnalyzing.value = true;

  try {
    await performAnalysis(manualInputText.value);
  } catch (error) {
    console.error('Re-analysis failed:', error);
  } finally {
    isAnalyzing.value = false;
  }
}

function handleCancel() {
  generatedRecord.value = null;
  analysisResult.value = null;
  manualInputText.value = '';
  showNewCategoryPrompt.value = false;
  pendingNewCategoryName.value = '';
  showConfirmModal.value = false;
}

function openNewCategoryFromConfirm() {
  showConfirmModal.value = false;
  if (analysisResult.value) {
    pendingNewCategoryName.value = analysisResult.value.summary.substring(0, 15);
    showNewCategoryPrompt.value = true;
  }
}

function confirmNewCategory() {
  if (pendingNewCategoryName.value && analysisResult.value) {
    userStore.addCategory(pendingNewCategoryName.value);
    const newCategory = userStore.categories.find((c) => c.name === pendingNewCategoryName.value);
    if (newCategory) {
      editForm.value = {
        startTime: formatTime(analysisResult.value.startTime),
        endTime: formatTime(analysisResult.value.endTime),
        summary: analysisResult.value.summary,
        categoryId: newCategory.id,
        workMode: analysisResult.value.workMode,
      };
    }
  }
  showNewCategoryPrompt.value = false;
  pendingNewCategoryName.value = '';
  showConfirmModal.value = true;
}

function rejectNewCategory() {
  showNewCategoryPrompt.value = false;
  pendingNewCategoryName.value = '';
  if (analysisResult.value) {
    editForm.value = {
      startTime: formatTime(analysisResult.value.startTime),
      endTime: formatTime(analysisResult.value.endTime),
      summary: analysisResult.value.summary,
      categoryId: null,
      workMode: analysisResult.value.workMode,
    };
    showConfirmModal.value = true;
  }
}

function openEditModal() {
  showConfirmModal.value = false;
  showEditModal.value = true;
}

async function confirmRecord() {
  if (!analysisResult.value) return;

  const now = new Date();
  const startDate = new Date(analysisResult.value.startTime);
  const endDate = new Date(analysisResult.value.endTime);

  const record: WorkRecord = {
    id: generateId(),
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    duration: analysisResult.value.duration,
    rawText: manualInputText.value,
    summary: analysisResult.value.summary,
    categoryId: editForm.value.categoryId,
    clusterId: null,
    workMode: editForm.value.workMode,
    confidence: analysisResult.value.confidence,
    annotationStatus: editForm.value.categoryId ? 'confirmed' : 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await recordStore.addRecord(record);

  if (editForm.value.categoryId) {
    userStore.incrementCategoryUsage(editForm.value.categoryId);
  }

  userStore.updateAnnotationProgress(
    recordStore.records.length,
    recordStore.annotatedRecords.length
  );

  generatedRecord.value = record;
  manualInputText.value = '';
  analysisResult.value = null;
  showConfirmModal.value = false;

  setTimeout(() => {
    generatedRecord.value = null;
  }, 2500);
}

function saveEditedRecord() {
  if (!analysisResult.value) return;

  const [startHours, startMins] = editForm.value.startTime.split(':').map(Number);
  const [endHours, endMins] = editForm.value.endTime.split(':').map(Number);

  const today = new Date();
  const startDate = new Date(today);
  startDate.setHours(startHours, startMins, 0, 0);

  const endDate = new Date(today);
  endDate.setHours(endHours, endMins, 0, 0);

  if (endDate <= startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  analysisResult.value = {
    ...analysisResult.value,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    duration: Math.round((endDate.getTime() - startDate.getTime()) / 60000),
    summary: editForm.value.summary,
    suggestedCategoryId: editForm.value.categoryId,
    workMode: editForm.value.workMode,
  };

  showEditModal.value = false;
  showConfirmModal.value = true;
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-8">
    <!-- 输入区域 - 顶部突出显示 -->
    <div class="w-full mb-10 animate-float-in">
      <div class="bg-white rounded-3xl border border-paper-3 shadow-medium p-6">
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-ink mb-3 font-display">
              记录今天的工作
            </label>
            <textarea
              v-model="manualInputText"
              :disabled="isAnalyzing"
              class="input min-h-[130px] resize-none text-base"
              placeholder="例如：从上午9点到11点在做清洁机器人项目"
            />
          </div>

          <button
            @click="handleManualSubmit"
            :disabled="!manualInputText.trim() || isAnalyzing"
            :class="[
              'w-full btn py-4 text-base font-medium',
              manualInputText.trim() && !isAnalyzing
                ? 'btn-primary'
                : 'bg-paper-2 text-ink-faint cursor-not-allowed shadow-none',
            ]"
          >
            <span class="flex items-center justify-center gap-2">
              <svg
                v-if="isAnalyzing"
                class="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ isAnalyzing ? 'AI 分析中...' : '记录工作' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 今日概览 -->
    <div class="w-full mb-10">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-semibold text-ink font-display">
          {{ getTodayDateDisplay() }}
        </h2>
        <div
          v-if="todayRecords.length > 0"
          class="text-ink-muted text-sm"
        >
          共 {{ todayRecords.length }} 条记录
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-4 mb-7">
        <div class="bg-white rounded-2xl border border-paper-3 shadow-soft p-5">
          <div class="text-3xl font-bold text-accent mb-1.5 font-display">
            {{ formatDuration(todayTotalMinutes) }}
          </div>
          <div class="text-sm text-ink-muted">总工作时长</div>
        </div>
        <div class="bg-white rounded-2xl border border-paper-3 shadow-soft p-5">
          <div class="text-3xl font-bold text-ink mb-1.5 font-display">
            {{ todayRecords.length }}
          </div>
          <div class="text-sm text-ink-muted">今日记录数</div>
        </div>
      </div>

      <!-- 项目投入分布 -->
      <div
        v-if="Object.keys(todayCategoryStats).length > 0"
        class="bg-white rounded-2xl border border-paper-3 shadow-soft p-5"
      >
        <div class="text-sm font-medium text-ink-muted mb-4 font-display">
          项目投入
        </div>
        <div class="space-y-4">
          <div
            v-for="[categoryId, minutes] in Object.entries(todayCategoryStats)"
            :key="categoryId"
          >
            <div class="flex justify-between text-sm mb-1.5">
              <span class="text-ink">
                {{ userStore.categories.find((c) => c.id === categoryId)?.name || '待标注' }}
              </span>
              <span class="text-ink font-medium">{{ formatDuration(minutes) }}</span>
            </div>
            <div class="h-2 bg-paper-2 rounded-full overflow-hidden">
              <div
                class="h-full bg-accent rounded-full transition-all duration-700"
                :style="{
                  width: `${
                    todayTotalMinutes > 0 ? (minutes / todayTotalMinutes) * 100 : 0
                  }%`,
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 今日记录列表 -->
    <div v-if="todayRecords.length > 0" class="w-full">
      <div class="text-sm font-medium text-ink-muted mb-4 font-display">
        今日记录
      </div>
      <div class="space-y-4">
        <RecordCard
          v-for="(record, index) in [...todayRecords].reverse()"
          :key="record.id"
          :record="record"
          :categories="userStore.categories"
          :style="{ animationDelay: `${index * 50}ms` }"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="todayRecords.length === 0"
      class="empty-state"
    >
      <svg
        class="empty-state-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p class="empty-state-text">还没有记录，开始记录今天的第一件工作吧</p>
    </div>

    <!-- 保存成功提示 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="generatedRecord"
          class="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-float-in"
        >
          <div class="bg-white rounded-2xl border border-paper-3 shadow-medium px-5 py-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <svg
                class="w-5 h-5 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p class="font-medium text-ink text-sm">记录已保存</p>
              <p class="text-ink-muted text-xs">{{ formatDuration(generatedRecord.duration) }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 新工作项目提示 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showNewCategoryPrompt"
          class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-5"
        >
          <div
            class="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            @click="handleCancel"
          ></div>
          <div
            class="modal-content relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-lg overflow-hidden"
          >
            <div class="p-6 sm:p-7">
              <div class="text-center mb-6">
                <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <svg
                    class="w-8 h-8 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <h3 class="text-xl font-semibold text-ink mb-2 font-display">
                  发现新的工作项目
                </h3>
                <p class="text-sm text-ink-muted">
                  看起来这是一个新的项目，可以修改名称后创建：
                </p>
              </div>

              <div class="space-y-5">
                <div>
                  <label class="block text-sm font-medium text-ink mb-2">
                    项目名称
                  </label>
                  <input
                    v-model="pendingNewCategoryName"
                    type="text"
                    class="input"
                    placeholder="输入项目名称"
                    autofocus
                  />
                </div>

                <div class="space-y-3">
                  <button
                    @click="confirmNewCategory"
                    :disabled="!pendingNewCategoryName.trim()"
                    class="w-full btn btn-primary py-3.5"
                  >
                    创建「{{ pendingNewCategoryName }}」
                  </button>
                  <button
                    @click="rejectNewCategory"
                    class="w-full btn btn-secondary py-3.5"
                  >
                    不创建，继续
                  </button>
                  <button
                    @click="handleCancel"
                    class="w-full text-sm text-ink-muted hover:text-ink transition-colors py-2"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 记录确认弹出框 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showConfirmModal"
          class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-5"
        >
          <div
            class="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            @click="handleCancel"
          ></div>
          <div
            class="modal-content relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-lg overflow-hidden"
          >
            <div class="p-6 sm:p-7">
              <h3 class="text-xl font-semibold text-ink mb-5 font-display">
                确认记录
              </h3>

              <div class="mb-6">
                <RecordCard
                  :record="{
                    id: 'preview',
                    startTime: analysisResult?.startTime || '',
                    endTime: analysisResult?.endTime || '',
                    duration: analysisResult?.duration || 0,
                    summary: analysisResult?.summary || '',
                    categoryId: editForm.categoryId,
                    workMode: editForm.workMode,
                    confidence: analysisResult?.confidence,
                  }"
                  :categories="userStore.categories"
                  :is-preview="true"
                />
              </div>

              <div class="grid grid-cols-2 gap-3 mb-4">
                <button
                  @click="handleReAnalyze"
                  :disabled="isAnalyzing"
                  class="btn btn-secondary py-3"
                >
                  {{ isAnalyzing ? '分析中...' : '重新分析' }}
                </button>
                <button
                  @click="openEditModal"
                  class="btn btn-secondary py-3"
                >
                  编辑
                </button>
              </div>
              <div class="grid grid-cols-2 gap-3 mb-4">
                <button
                  @click="openNewCategoryFromConfirm"
                  class="btn btn-secondary py-3"
                >
                  创建项目
                </button>
                <button
                  @click="confirmRecord"
                  class="btn btn-primary py-3"
                >
                  保存
                </button>
              </div>
              <button
                @click="handleCancel"
                class="w-full text-sm text-ink-muted hover:text-ink transition-colors py-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 编辑记录弹出框 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showEditModal"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-5"
        >
          <div
            class="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            @click="showEditModal = false"
          ></div>
          <div
            class="modal-content relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-lg overflow-hidden"
          >
            <div class="p-6 sm:p-7">
              <h3 class="text-xl font-semibold text-ink mb-5 font-display">
                编辑记录
              </h3>

              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-ink mb-2">
                      开始时间
                    </label>
                    <input
                      v-model="editForm.startTime"
                      type="time"
                      class="input"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-ink mb-2">
                      结束时间
                    </label>
                    <input
                      v-model="editForm.endTime"
                      type="time"
                      class="input"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-ink mb-2">
                    工作内容
                  </label>
                  <input
                    v-model="editForm.summary"
                    type="text"
                    class="input"
                    placeholder="描述你的工作内容"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-ink mb-2">
                    工作项目
                  </label>
                  <select
                    v-model="editForm.categoryId"
                    class="input"
                  >
                    <option :value="null">待标注</option>
                    <option
                      v-for="category in userStore.categories.filter((c) => !c.isCompleted)"
                      :key="category.id"
                      :value="category.id"
                    >
                      {{ category.name }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-ink mb-2">
                    工作方式
                  </label>
                  <select
                    v-model="editForm.workMode"
                    class="input"
                  >
                    <option value="SOLO">SOLO - 独自工作</option>
                    <option value="会议">会议 - 多人讨论</option>
                    <option value="调研">调研 - 外出考察</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 mt-6">
                <button
                  @click="showEditModal = false; showConfirmModal = true"
                  class="btn btn-secondary py-3"
                >
                  返回
                </button>
                <button
                  @click="saveEditedRecord"
                  class="btn btn-primary py-3"
                >
                  保存编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
