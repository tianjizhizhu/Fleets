<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    home: '时间去哪了',
    records: '记录列表',
    annotation: '标注工作',
    workbench: '工作台',
    settings: '设置'
  };
  return titles[route.name as string] || '时间去哪了';
});

const showBack = computed(() => {
  return route.name !== 'home';
});

function goBack() {
  router.back();
}
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 safe-top">
    <div class="flex items-center justify-between h-14 px-4">
      <div class="flex items-center">
        <button
          v-if="showBack"
          @click="goBack"
          class="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold text-gray-900">{{ pageTitle }}</h1>
      </div>
      <div class="flex items-center">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
