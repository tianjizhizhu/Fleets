<script setup lang="ts">
import { RouterView } from 'vue-router';
import BottomNav from '@/components/common/BottomNav.vue';
import HeaderBar from '@/components/common/HeaderBar.vue';
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <HeaderBar />
    <main class="flex-1 pb-20 pt-16">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
    <BottomNav />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
