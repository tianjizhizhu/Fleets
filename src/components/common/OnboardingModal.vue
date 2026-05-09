<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUserStore } from '@/stores/userStore';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const userStore = useUserStore();
const step = ref<'welcome' | 'categories'>('welcome');
const categoriesInput = ref('');
const categories = ref<string[]>([]);
const isLoading = ref(false);

const canProceed = computed(() => {
  return categories.value.length > 0;
});

function addCategory() {
  const trimmed = categoriesInput.value.trim();
  if (trimmed && !categories.value.includes(trimmed)) {
    categories.value.push(trimmed);
    categoriesInput.value = '';
  }
}

function removeCategory(index: number) {
  categories.value.splice(index, 1);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCategory();
  }
}

async function completeOnboarding() {
  if (categories.value.length === 0) return;

  isLoading.value = true;
  try {
    await userStore.completeOnboarding(categories.value);
    emit('update:modelValue', false);
  } finally {
    isLoading.value = false;
  }
}

function skip() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="skip"
        />
        <div class="relative w-full sm:max-w-md sm:rounded-2xl bg-white shadow-xl overflow-hidden animate-slide-up">
          <div class="p-6 sm:p-8">
            <Transition name="fade" mode="out-in">
              <div v-if="step === 'welcome'" key="welcome">
                <div class="text-center mb-8">
                  <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 class="text-2xl font-bold text-gray-900 mb-2">欢迎使用时间去哪了</h2>
                  <p class="text-gray-500">用最自然的方式记录你的工作时间</p>
                </div>

                <div class="space-y-4 mb-8">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">说话即记录</h3>
                      <p class="text-sm text-gray-500">用语音描述你的工作，系统自动识别时间和内容</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">智能分类</h3>
                      <p class="text-sm text-gray-500">AI 自动学习你的工作模式，智能归类统计</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">可视化统计</h3>
                      <p class="text-sm text-gray-500">清晰了解你的时间都花在了哪里</p>
                    </div>
                  </div>
                </div>

                <button
                  @click="step = 'categories'"
                  class="w-full btn btn-primary py-3"
                >
                  开始设置
                </button>
              </div>

              <div v-else key="categories">
                <div class="text-center mb-6">
                  <h2 class="text-xl font-bold text-gray-900 mb-2">告诉我你都做哪些工作</h2>
                  <p class="text-sm text-gray-500">用简单的词语描述你的工作类型，比如：项目A、客户B、日常事务等</p>
                </div>

                <div class="space-y-3 mb-4">
                  <div
                    v-for="(category, index) in categories"
                    :key="index"
                    class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg animate-fade-in"
                  >
                    <span class="text-gray-900">{{ category }}</span>
                    <button
                      @click="removeCategory(index)"
                      class="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="flex gap-2 mb-6">
                  <input
                    v-model="categoriesInput"
                    @keydown="handleKeydown"
                    type="text"
                    placeholder="输入工作类型后按回车添加"
                    class="input flex-1"
                  />
                  <button
                    @click="addCategory"
                    class="btn btn-secondary px-4"
                  >
                    添加
                  </button>
                </div>

                <div class="flex gap-3">
                  <button
                    @click="step = 'welcome'"
                    class="flex-1 btn btn-secondary py-3"
                  >
                    上一步
                  </button>
                  <button
                    @click="completeOnboarding"
                    :disabled="!canProceed || isLoading"
                    :class="[
                      'flex-1 btn py-3',
                      canProceed ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    ]"
                  >
                    {{ isLoading ? '保存中...' : '完成设置' }}
                  </button>
                </div>

                <button
                  @click="skip"
                  class="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  稍后再说
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
