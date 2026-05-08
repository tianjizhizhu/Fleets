<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecordStore } from '@/stores/recordStore';

const route = useRoute();
const router = useRouter();
const recordStore = useRecordStore();

const tabs = [
  {
    name: 'home',
    path: '/',
    label: '首页',
    icon: 'home'
  },
  {
    name: 'records',
    path: '/records',
    label: '记录',
    icon: 'list'
  },
  {
    name: 'annotation',
    path: '/annotation',
    label: '标注',
    icon: 'tag'
  },
  {
    name: 'workbench',
    path: '/workbench',
    label: '工作台',
    icon: 'chart'
  },
  {
    name: 'settings',
    path: '/settings',
    label: '设置',
    icon: 'settings'
  }
];

const currentTab = computed(() => route.name);

const pendingCount = computed(() => recordStore.pendingRecords.length);

function navigateTo(path: string) {
  router.push(path);
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-bottom">
    <div class="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        @click="navigateTo(tab.path)"
        :class="[
          'relative flex flex-col items-center justify-center w-16 h-full transition-colors',
          currentTab === tab.name ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
        ]"
      >
        <div class="relative">
          <svg v-if="tab.icon === 'home'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <svg v-else-if="tab.icon === 'list'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <svg v-else-if="tab.icon === 'tag'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <svg v-else-if="tab.icon === 'chart'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <svg v-else-if="tab.icon === 'settings'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span
            v-if="tab.name === 'annotation' && pendingCount > 0"
            class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-xs font-medium text-white bg-red-500 rounded-full"
          >
            {{ pendingCount > 99 ? '99+' : pendingCount }}
          </span>
        </div>
        <span class="text-[10px] mt-1">{{ tab.label }}</span>
      </button>
    </div>
  </nav>
</template>
