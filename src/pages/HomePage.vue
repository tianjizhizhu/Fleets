<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRecordStore } from '@/stores/recordStore';
import { useAudioRecorder } from '@/composables/useAudioRecorder';
import { analyzeText } from '@/utils/ai';
import { generateId } from '@/utils/storage';
import { formatRecordingTime, formatTime, formatDuration } from '@/utils/time';
import type { WorkRecord, AIAnalysisResult } from '@/types';
import RecordButton from '@/components/record/RecordButton.vue';
import RecordCard from '@/components/record/RecordCard.vue';
import TranscriptView from '@/components/record/TranscriptView.vue';

const userStore = useUserStore();
const recordStore = useRecordStore();

const {
  state,
  transcript,
  startRecording,
  stopRecording,
  cancelRecording,
  resetState
} = useAudioRecorder();

const generatedRecord = ref<WorkRecord | null>(null);
const analysisResult = ref<AIAnalysisResult | null>(null);
const isAnalyzing = ref(false);
const showEditModal = ref(false);

const editForm = ref({
  startTime: '',
  endTime: '',
  summary: '',
  categoryId: null as string | null
});

const displayTranscript = computed(() => {
  if (state.value.status === 'recording' || state.value.transcript) {
    return state.value.transcript || transcript.value;
  }
  return '';
});

watch(() => transcript.value, (newVal) => {
  if (newVal && state.value.status === 'recording') {
    state.value.transcript = newVal;
  }
});

async function handleStartRecording() {
  await startRecording();
}

async function handleStopRecording() {
  const { transcript: finalTranscript } = await stopRecording();

  if (!finalTranscript && !transcript.value) {
    resetState();
    return;
  }

  isAnalyzing.value = true;
  state.value.status = 'processing';

  try {
    const result = await analyzeText(finalTranscript || transcript.value, userStore.categories);
    analysisResult.value = result;

    editForm.value = {
      startTime: formatTime(result.startTime),
      endTime: formatTime(result.endTime),
      summary: result.summary,
      categoryId: result.suggestedCategoryId
    };

    state.value.status = 'done';
  } catch (error) {
    console.error('Analysis failed:', error);
    state.value.status = 'error';
  } finally {
    isAnalyzing.value = false;
  }
}

function handleCancel() {
  cancelRecording();
  generatedRecord.value = null;
  analysisResult.value = null;
  resetState();
}

function openEditModal() {
  if (analysisResult.value) {
    editForm.value = {
      startTime: formatTime(analysisResult.value.startTime),
      endTime: formatTime(analysisResult.value.endTime),
      summary: analysisResult.value.summary,
      categoryId: analysisResult.value.suggestedCategoryId
    };
  }
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
    rawText: transcript.value || state.value.transcript,
    summary: analysisResult.value.summary,
    categoryId: editForm.value.categoryId,
    clusterId: null,
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
  resetState();
  state.value.status = 'done';

  setTimeout(() => {
    generatedRecord.value = null;
    analysisResult.value = null;
    resetState();
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
    suggestedCategoryId: editForm.value.categoryId
  };

  showEditModal.value = false;
  confirmRecord();
}

onMounted(() => {
  recordStore.loadRecords();
});
</script>

<template>
  <div class="page-content py-6">
    <div class="flex flex-col items-center">
      <RecordButton
        :status="state.status"
        :is-recording="state.isRecording"
        :duration="state.duration"
        :audio-level="state.audioLevel"
        @start="handleStartRecording"
        @stop="handleStopRecording"
      />

      <div class="mt-8 text-center">
        <p class="text-sm text-gray-500">
          <template v-if="state.status === 'idle'">
            点击按钮开始录音
          </template>
          <template v-else-if="state.status === 'recording'">
            录音中 · {{ formatRecordingTime(state.duration) }}
          </template>
          <template v-else-if="state.status === 'processing'">
            AI 分析中...
          </template>
          <template v-else-if="state.status === 'done'">
            记录已保存
          </template>
          <template v-else-if="state.status === 'error'">
            发生错误，请重试
          </template>
        </p>
      </div>

      <TranscriptView
        v-if="state.status === 'recording' || state.status === 'done'"
        :transcript="displayTranscript"
        :is-recording="state.isRecording"
        class="mt-6 w-full"
      />

      <div
        v-if="state.status === 'done' && analysisResult && !generatedRecord"
        class="mt-6 w-full space-y-4 animate-slide-up"
      >
        <RecordCard
          :record="{
            id: 'preview',
            startTime: analysisResult.startTime,
            endTime: analysisResult.endTime,
            duration: analysisResult.duration,
            summary: analysisResult.summary,
            categoryId: analysisResult.suggestedCategoryId,
            confidence: analysisResult.confidence
          }"
          :categories="userStore.categories"
          :is-preview="true"
        />

        <div class="flex gap-3">
          <button
            @click="openEditModal"
            class="flex-1 btn btn-secondary py-3"
          >
            编辑
          </button>
          <button
            @click="confirmRecord"
            class="flex-1 btn btn-primary py-3"
          >
            确认保存
          </button>
        </div>

        <button
          @click="handleCancel"
          class="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          取消
        </button>
      </div>

      <div
        v-if="generatedRecord"
        class="mt-6 w-full animate-slide-up"
      >
        <div class="card p-4 bg-green-50 border-green-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-green-800">记录已保存</p>
              <p class="text-sm text-green-600">{{ formatDuration(generatedRecord.duration) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="state.status === 'error'"
        class="mt-6 w-full animate-slide-up"
      >
        <div class="card p-4 bg-red-50 border-red-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-red-800">录音失败</p>
              <p class="text-sm text-red-600">请检查麦克风权限后重试</p>
            </div>
          </div>
        </div>
        <button
          @click="handleCancel"
          class="mt-3 w-full btn btn-secondary py-2"
        >
          重试
        </button>
      </div>
    </div>

    <div
      v-if="recordStore.pendingRecords.length > 0"
      class="mt-8 pt-8 border-t border-gray-200"
    >
      <h3 class="section-title">待标注记录</h3>
      <div class="space-y-3">
        <RecordCard
          v-for="record in recordStore.pendingRecords.slice(0, 3)"
          :key="record.id"
          :record="record"
          :categories="userStore.categories"
        />
        <router-link
          v-if="recordStore.pendingRecords.length > 3"
          to="/annotation"
          class="block text-center text-sm text-primary hover:text-primary-dark transition-colors"
        >
          查看全部 {{ recordStore.pendingRecords.length }} 条待标注记录 →
        </router-link>
      </div>
    </div>

    <div
      v-if="state.status === 'idle' && recordStore.records.length === 0"
      class="mt-12 empty-state"
    >
      <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <p class="text-gray-500 mb-2">还没有任何记录</p>
      <p class="text-sm text-gray-400">点击上方按钮开始记录你的工作时间</p>
    </div>

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
                  <label class="block text-sm font-medium text-gray-700 mb-1">工作分类</label>
                  <select
                    v-model="editForm.categoryId"
                    class="input"
                  >
                    <option :value="null">待标注</option>
                    <option
                      v-for="category in userStore.categories"
                      :key="category.id"
                      :value="category.id"
                    >
                      {{ category.name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  @click="showEditModal = false"
                  class="flex-1 btn btn-secondary py-3"
                >
                  取消
                </button>
                <button
                  @click="saveEditedRecord"
                  class="flex-1 btn btn-primary py-3"
                >
                  保存
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
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
