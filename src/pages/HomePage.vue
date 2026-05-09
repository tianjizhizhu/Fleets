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
  workMode: 'SOLO' as WorkMode
});

const showNewCategoryPrompt = ref(false);
const pendingNewCategoryName = ref('');

const todayRecords = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return recordStore.records.filter(r => {
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
  todayRecords.value.forEach(r => {
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
  const activeCategories = userStore.categories.filter(c => !c.isCompleted);
  const result = await analyzeWorkText(inputText, activeCategories);
  analysisResult.value = result;
  console.log('AI分析结果:', result);
  console.log('suggestedNewCategory:', result.suggestedNewCategory);
  console.log('suggestedCategoryId:', result.suggestedCategoryId);
  console.log('activeCategories:', activeCategories);

  // 如果有建议的新项目名称，或者没有匹配到任何已有项目，就尝试让用户选择
  if (result.suggestedNewCategory && result.suggestedNewCategory.trim()) {
    console.log('显示新项目提示框');
    pendingNewCategoryName.value = result.suggestedNewCategory.trim();
    showNewCategoryPrompt.value = true;
  } else if (!result.suggestedCategoryId && activeCategories.length > 0) {
    // 没有匹配到项目，但用户有项目，也可以让用户选择是否要建新项
    console.log('没有匹配到已有项目，直接显示确认框');
    editForm.value = {
      startTime: formatTime(result.startTime),
      endTime: formatTime(result.endTime),
      summary: result.summary,
      categoryId: null,
      workMode: result.workMode
    };
    showConfirmModal.value = true;
  } else if (activeCategories.length === 0) {
    // 用户没有任何项目，必须创建新项目
    console.log('用户没有任何项目，显示新项目提示框，用摘要作为默认名称');
    pendingNewCategoryName.value = result.summary.substring(0, 15);
    showNewCategoryPrompt.value = true;
  } else {
    console.log('显示普通确认框');
    editForm.value = {
      startTime: formatTime(result.startTime),
      endTime: formatTime(result.endTime),
      summary: result.summary,
      categoryId: result.suggestedCategoryId,
      workMode: result.workMode
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
    const newCategory = userStore.categories.find(c => c.name === pendingNewCategoryName.value);
    if (newCategory) {
      editForm.value = {
        startTime: formatTime(analysisResult.value.startTime),
        endTime: formatTime(analysisResult.value.endTime),
        summary: analysisResult.value.summary,
        categoryId: newCategory.id,
        workMode: analysisResult.value.workMode
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
      workMode: analysisResult.value.workMode
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
    updatedAt: now.toISOString()
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
  }, 2000);
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
    workMode: editForm.value.workMode
  };

  showEditModal.value = false;
  showConfirmModal.value = true;
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-6">
    <!-- 输入区域 -->
    <div class="w-full max-w-lg mx-auto mb-8">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              输入工作内容
            </label>
            <textarea
              v-model="manualInputText"
              :disabled="isAnalyzing"
              class="input min-h-[120px] resize-none"
              placeholder="例如：从上午9点到11点在做清洁机器人项目"
            />
          </div>

          <button
            @click="handleManualSubmit"
            :disabled="!manualInputText.trim() || isAnalyzing"
            :class="[
              'w-full btn py-3',
              manualInputText.trim() && !isAnalyzing
                ? 'btn-primary'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]"
          >
            {{ isAnalyzing ? '分析中...' : '提交' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 今日数据 -->
    <div class="w-full max-w-lg mx-auto">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ getTodayDateDisplay() }}</h2>
      
      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div class="text-2xl font-bold text-indigo-600 mb-1">
            {{ formatDuration(todayTotalMinutes) }}
          </div>
          <div class="text-xs text-gray-500">今日工作时长</div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div class="text-2xl font-bold text-purple-600 mb-1">
            {{ todayRecords.length }}
          </div>
          <div class="text-xs text-gray-500">今日记录条数</div>
        </div>
      </div>

      <!-- 项目分布 -->
      <div v-if="Object.keys(todayCategoryStats).length > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div class="text-sm font-medium text-gray-700 mb-3">项目投入</div>
        <div class="space-y-2">
          <div
            v-for="[categoryId, minutes] in Object.entries(todayCategoryStats)"
            :key="categoryId"
          >
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-600">{{ userStore.categories.find(c => c.id === categoryId)?.name || '待标注' }}</span>
              <span class="text-gray-800 font-medium">{{ formatDuration(minutes) }}</span>
            </div>
            <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                class="h-full bg-indigo-500 rounded-full transition-all duration-500"
                :style="{ width: `${todayTotalMinutes > 0 ? (minutes / todayTotalMinutes) * 100 : 0}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 今日记录列表 -->
      <div v-if="todayRecords.length > 0" class="space-y-3">
        <div class="text-sm font-medium text-gray-700">今日记录</div>
        <RecordCard
          v-for="record in [...todayRecords].reverse()"
          :key="record.id"
          :record="record"
          :categories="userStore.categories"
        />
      </div>
    </div>

    <!-- 保存成功提示 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="generatedRecord"
          class="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
            <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-green-800 text-sm">记录已保存</p>
              <p class="text-xs text-green-600">{{ formatDuration(generatedRecord.duration) }}</p>
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
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="handleCancel"
          />
          <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-scale-in">
            <div class="p-6">
              <div class="text-center mb-6">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">
                  检测到新工作项目
                </h3>
                <p class="text-sm text-gray-500">
                  您提到的工作似乎是一个新的项目，可以手动修改名称：
                </p>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    工作项目名称
                  </label>
                  <input
                    v-model="pendingNewCategoryName"
                    type="text"
                    class="input"
                    placeholder="请输入工作项目名称"
                  />
                </div>

                <div class="space-y-3">
                  <button
                    @click="confirmNewCategory"
                    :disabled="!pendingNewCategoryName.trim()"
                    class="w-full btn btn-primary py-3"
                  >
                    创建"{{ pendingNewCategoryName }}"项目
                  </button>
                  <button
                    @click="rejectNewCategory"
                    class="w-full btn btn-secondary py-3"
                  >
                    不创建，继续
                  </button>
                  <button
                    @click="handleCancel"
                    class="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
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
          class="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="handleCancel"
          />
          <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-scale-in">
            <div class="p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">确认记录</h3>
              
              <div class="mb-4">
                <RecordCard
                  :record="{
                    id: 'preview',
                    startTime: analysisResult?.startTime || '',
                    endTime: analysisResult?.endTime || '',
                    duration: analysisResult?.duration || 0,
                    summary: analysisResult?.summary || '',
                    categoryId: editForm.categoryId,
                    workMode: editForm.workMode,
                    confidence: analysisResult?.confidence
                  }"
                  :categories="userStore.categories"
                  :is-preview="true"
                />
              </div>

              <div class="flex gap-3 mb-3">
                <button
                  @click="handleReAnalyze"
                  :disabled="isAnalyzing"
                  class="flex-1 btn btn-secondary py-3"
                >
                  {{ isAnalyzing ? '重新分析中...' : '重新分析' }}
                </button>
                <button
                  @click="openEditModal"
                  class="flex-1 btn btn-secondary py-3"
                >
                  编辑
                </button>
              </div>
              <div class="flex gap-3 mb-3">
                <button
                  @click="openNewCategoryFromConfirm"
                  class="flex-1 bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  创建新项目
                </button>
                <button
                  @click="confirmRecord"
                  class="flex-1 btn btn-primary py-3"
                >
                  保存
                </button>
              </div>
              <button
                @click="handleCancel"
                class="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
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
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showEditModal = false"
          />
          <div class="relative w-full sm:max-w-md sm:rounded-2xl bg-white shadow-xl overflow-hidden animate-slide-up">
            <div class="p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">编辑记录</h3>

              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <input
                      v-model="editForm.startTime"
                      type="time"
                      class="input"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <input
                      v-model="editForm.endTime"
                      type="time"
                      class="input"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">工作内容</label>
                  <input
                    v-model="editForm.summary"
                    type="text"
                    class="input"
                    placeholder="描述你的工作内容"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">工作项目</label>
                  <select
                    v-model="editForm.categoryId"
                    class="input"
                  >
                    <option :value="null">待标注</option>
                    <option
                      v-for="category in userStore.categories.filter(c => !c.isCompleted)"
                      :key="category.id"
                      :value="category.id"
                    >
                      {{ category.name }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">工作方式</label>
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

              <div class="flex gap-3 mt-6">
                <button
                  @click="showEditModal = false; showConfirmModal = true"
                  class="flex-1 btn btn-secondary py-3"
                >
                  返回
                </button>
                <button
                  @click="saveEditedRecord"
                  class="flex-1 btn btn-primary py-3"
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

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
