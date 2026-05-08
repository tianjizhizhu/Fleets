<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: 'idle' | 'recording' | 'processing' | 'done' | 'error';
  isRecording: boolean;
  duration: number;
  audioLevel: number;
}>();

const emit = defineEmits<{
  (e: 'start'): void;
  (e: 'stop'): void;
}>();

const buttonClass = computed(() => {
  const base = 'relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300';

  if (props.isRecording) {
    return `${base} bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 animate-pulse-recording`;
  }

  if (props.status === 'processing') {
    return `${base} bg-gradient-to-br from-primary to-secondary cursor-wait`;
  }

  return `${base} bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40`;
});

const innerSize = computed(() => {
  if (props.isRecording && props.audioLevel > 0) {
    return 60 + props.audioLevel * 20;
  }
  return props.isRecording ? 50 : 60;
});
</script>

<template>
  <button
    :class="buttonClass"
    :disabled="status === 'processing'"
    @click="isRecording ? emit('stop') : emit('start')"
  >
    <div
      v-if="isRecording"
      class="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20"
    />

    <div
      v-if="isRecording"
      class="w-6 h-6 bg-white rounded-sm"
    />
    <svg
      v-else-if="status === 'processing'"
      class="w-8 h-8 text-white animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <svg
      v-else
      class="w-10 h-10 text-white"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  </button>
</template>
