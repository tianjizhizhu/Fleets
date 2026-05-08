<script setup lang="ts">
import { RouterView } from 'vue-router';
import BottomNav from '@/components/common/BottomNav.vue';
import HeaderBar from '@/components/common/HeaderBar.vue';
import OnboardingModal from '@/components/common/OnboardingModal.vue';
import { useUserStore } from '@/stores/userStore';
import { ref, onMounted } from 'vue';

const userStore = useUserStore();
const showOnboarding = ref(false);

onMounted(() => {
  if (!userStore.hasCompletedOnboarding) {
    showOnboarding.value = true;
  }
});
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
    <OnboardingModal v-model="showOnboarding" />
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
