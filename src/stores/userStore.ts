import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserConfig, WorkCategory } from '@/types';
import { getConfig, saveConfig, generateId } from '@/utils/storage';

export const useUserStore = defineStore('user', () => {
  const config = ref<UserConfig | null>(getConfig());
  const hasCompletedOnboarding = computed(() => config.value?.hasCompletedOnboarding ?? false);
  const categories = computed(() => config.value?.categories ?? []);

  function initConfig() {
    if (!config.value) {
      config.value = {
        hasCompletedOnboarding: false,
        categories: [],
        firstUseDate: new Date().toISOString(),
        totalRecords: 0,
        annotationProgress: {
          total: 0,
          annotated: 0
        }
      };
      saveConfig(config.value);
    }
  }

  function completeOnboarding(userCategories: string[]) {
    if (!config.value) {
      initConfig();
    }

    config.value!.categories = userCategories.map(name => ({
      id: generateId(),
      name,
      description: '',
      keywords: [],
      usageCount: 0,
      createdAt: new Date().toISOString()
    }));
    config.value!.hasCompletedOnboarding = true;
    saveConfig(config.value);
  }

  function addCategory(name: string, description = '') {
    if (!config.value) return;

    const exists = config.value.categories.some(c => c.name === name);
    if (exists) return;

    config.value.categories.push({
      id: generateId(),
      name,
      description,
      keywords: [],
      usageCount: 0,
      createdAt: new Date().toISOString()
    });
    saveConfig(config.value);
  }

  function updateCategory(id: string, updates: Partial<WorkCategory>) {
    if (!config.value) return;

    const index = config.value.categories.findIndex(c => c.id === id);
    if (index !== -1) {
      config.value.categories[index] = {
        ...config.value.categories[index],
        ...updates
      };
      saveConfig(config.value);
    }
  }

  function deleteCategory(id: string) {
    if (!config.value) return;

    config.value.categories = config.value.categories.filter(c => c.id !== id);
    saveConfig(config.value);
  }

  function incrementCategoryUsage(id: string) {
    if (!config.value) return;

    const category = config.value.categories.find(c => c.id === id);
    if (category) {
      category.usageCount++;
      saveConfig(config.value);
    }
  }

  function updateAnnotationProgress(total: number, annotated: number) {
    if (!config.value) return;

    config.value.annotationProgress = { total, annotated };
    config.value.totalRecords = total;
    saveConfig(config.value);
  }

  function resetConfig() {
    config.value = null;
    localStorage.removeItem('worktime_config');
    initConfig();
  }

  initConfig();

  return {
    config,
    hasCompletedOnboarding,
    categories,
    completeOnboarding,
    addCategory,
    updateCategory,
    deleteCategory,
    incrementCategoryUsage,
    updateAnnotationProgress,
    resetConfig
  };
});
