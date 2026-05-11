<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  transcript: string;
  isRecording: boolean;
}>();

const displayText = computed(() => {
  if (!props.transcript) {
    return props.isRecording ? '正在聆听...' : '';
  }
  return props.transcript;
});
</script>

<template>
  <div class="card p-4 min-h-[120px]">
    <div class="flex items-start gap-3">
      <div
        :class="[
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isRecording ? 'bg-red-100' : 'bg-gray-100'
        ]"
      >
        <div
          :class="[
            'w-2 h-2 rounded-full',
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
          ]"
        />
      </div>
      <div class="flex-1">
        <p
          :class="[
            'text-gray-900 leading-relaxed whitespace-pre-wrap',
            !transcript && 'text-gray-400 italic'
          ]"
        >
          {{ displayText || '等待语音输入...' }}
        </p>
        <div v-if="isRecording" class="mt-2 flex items-center gap-1">
          <span class="w-2 h-2 bg-red-500 rounded-full animate-bounce" style="animation-delay: 0ms" />
          <span class="w-2 h-2 bg-red-500 rounded-full animate-bounce" style="animation-delay: 150ms" />
          <span class="w-2 h-2 bg-red-500 rounded-full animate-bounce" style="animation-delay: 300ms" />
        </div>
      </div>
    </div>
  </div>
</template>
