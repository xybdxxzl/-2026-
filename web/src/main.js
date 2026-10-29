import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import OverviewView from './components/OverviewView.vue';
import FarmView from './components/FarmView.vue';
import SkyView from './components/SundialView.vue';
import AncientView from './components/AncientView.vue';
import DetailView from './components/DetailView.vue';
import AboutView from './components/AboutView.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView },
    { path: '/farm', name: 'farm', component: FarmView },
    { path: '/sky', name: 'sky', component: SkyView },
    { path: '/ancient', name: 'ancient', component: AncientView },
    { path: '/term', name: 'detail', component: DetailView },
    { path: '/sources', name: 'sources', component: AboutView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || (to.path === from.path ? false : { top: 0 });
  },
});

createApp(App).use(router).mount('#app');
