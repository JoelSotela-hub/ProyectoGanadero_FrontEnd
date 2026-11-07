import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tabs/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: {
      requiresAuth: false,
      guestOnly: true,
    },
  },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage.vue'),
    meta: {
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        redirect: '/tabs/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        alias: ['tab1'],
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
        },
      },
      {
        path: 'animales',
        name: 'AnimalList',
        alias: ['tab2', '/items'],
        component: () => import('@/views/Animal.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
        },
      },
      {
        path: 'registro',
        name: 'AnimalRegistration',
        alias: ['tab3', '/items/new'],
        component: () => import('@/views/AnimalResgistration.vue'),
        meta: {
          requiresAuth: true,
        },
      },
    ],
  },
  {
    path: '/detalle/:id',
    name: 'AnimalDetail',
    alias: ['/items/:id', '/tabs/animales/:id'],
    component: () => import('@/views/AnimalDetail.vue'),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/tabs/dashboard',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

/**
 * Guardián de navegación (Persona 2):
 * Consulta el estado reactivo de la sesión en Pinia (`authStore.isAuthenticated`)
 * y no el almacenamiento directamente.
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // Asegura que se haya intentado restaurar la sesión al arrancar antes de resolver la ruta
  if (!authStore.initialized) {
    await authStore.restoreSession();
  }

  const requiresAuth = to.matched.some((record) => Boolean(record.meta.requiresAuth));
  const guestOnly = to.matched.some((record) => Boolean(record.meta.guestOnly));

  // Bloquea acceso a cualquier ruta privada si no hay sesión activa
  if (requiresAuth && !authStore.isAuthenticated) {
    return {
      path: '/login',
      replace: true,
    };
  }

  // Si ya tiene sesión activa e intenta ir a /login, redirige a la pantalla principal reemplazando historial
  if (guestOnly && authStore.isAuthenticated) {
    return {
      path: '/tabs/dashboard',
      replace: true,
    };
  }

  return true;
});

export default router;
