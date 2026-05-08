import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';
import RecordList from '@/pages/RecordList.vue';
import Annotation from '@/pages/Annotation.vue';
import Workbench from '@/pages/Workbench.vue';
import Settings from '@/pages/Settings.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },
    {
      path: '/records',
      name: 'records',
      component: RecordList
    },
    {
      path: '/annotation',
      name: 'annotation',
      component: Annotation
    },
    {
      path: '/workbench',
      name: 'workbench',
      component: Workbench
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings
    }
  ]
});

export default router;
