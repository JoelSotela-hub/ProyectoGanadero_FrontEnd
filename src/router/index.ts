import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { rolesDeModulo, rolPermitido } from '@/config/roles';
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
    meta: { requiresAuth: false, guestOnly: true },
  },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/dashboard' },
      {
        path: 'dashboard',
        name: 'Dashboard',
        alias: ['tab1'],
        component: () => import('@/views/Dashboard.vue'),
        meta: { requiresAuth: true, isRootScreen: true },
      },
      {
        path: 'animales',
        name: 'AnimalList',
        alias: ['tab2', '/items'],
        component: () => import('@/views/Animal.vue'),
        meta: { requiresAuth: true, isRootScreen: true, roles: rolesDeModulo('animales') },
      },
      {
        path: 'registro',
        name: 'AnimalRegistration',
        alias: ['tab3', '/items/new'],
        component: () => import('@/views/AnimalRegistration.vue'),
        meta: { requiresAuth: true, roles: ['admin'] },
      },
      {
        path: 'potreros',
        name: 'PotreroList',
        component: () => import('@/views/Potreros.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('potreros'),
        },
      },
      {
        path: 'pesajes',
        name: 'PesajeList',
        component: () => import('@/views/Pesajes.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('pesajes'),
        },
      },
      {
        path: 'tratamientos',
        name: 'TratamientoList',
        component: () => import('@/views/Tratamientos.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('tratamientos'),
        },
      },
      {
        path: 'rondas',
        name: 'RondaList',
        component: () => import('@/views/Rondas.vue'),
        meta: { requiresAuth: true, isRootScreen: true, roles: rolesDeModulo('rondas') },
      },
      {
        path: 'insumos',
        name: 'InsumoList',
        component: () => import('@/views/Insumos.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('insumos'),
        },
      },
      {
        path: 'catalogos',
        name: 'CatalogoList',
        component: () => import('@/views/Catalogos.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('catalogos'),
        },
      },
      {
        path: 'usuarios',
        name: 'UsuarioList',
        component: () => import('@/views/Usuarios.vue'),
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('usuarios'),
        },
      },
      {
        path: '/potreros/:id',
        name: 'PotreroDetail',
        alias: ['/tabs/potreros/:id'],
        component: () => import('@/views/PotreroDetail.vue'),
        meta: { requiresAuth: true, roles: rolesDeModulo('potreros') },
      },
      {
        path: '/rondas/:id',
        name: 'RondaDetalle',
        component: () => import('@/views/RondaDetalle.vue'),
        meta: { requiresAuth: true, roles: rolesDeModulo('rondas') },
      },
      {
        path: '/detalle/:id',
        name: 'AnimalDetail',
        alias: ['/items/:id', '/tabs/animales/:id'],
        component: () => import('@/views/AnimalDetail.vue'),
        meta: { requiresAuth: true, roles: rolesDeModulo('animales') },
      },
    ],
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

const RUTAS_LISTADO_PREFIJOS = [
  '/tabs/animales',
  '/tabs/tab2',
  '/items',
  '/tabs/potreros',
  '/tabs/pesajes',
  '/tabs/tratamientos',
  '/tabs/insumos',
  '/tabs/catalogos',
  '/tabs/usuarios',
];

let ultimaRutaListado = '/tabs/animales';

export function esRutaDeListado(ruta?: string | null): boolean {
  if (!ruta) return false;
  return RUTAS_LISTADO_PREFIJOS.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}?`));
}

export function obtenerRutaListadoAnterior(): string {
  return ultimaRutaListado || '/tabs/animales';
}

router.afterEach((to) => {
  if (esRutaDeListado(to.fullPath)) {
    ultimaRutaListado = to.fullPath;
  }
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.initialized) {
    await authStore.restoreSession();
  }

  const requiresAuth = to.matched.some((record) => Boolean(record.meta.requiresAuth));
  const guestOnly = to.matched.some((record) => Boolean(record.meta.guestOnly));

  if (requiresAuth && !authStore.isAuthenticated) {
    return { path: '/login', replace: true };
  }

  if (guestOnly && authStore.isAuthenticated) {
    return { path: '/tabs/dashboard', replace: true };
  }

  if (requiresAuth) {
    const rol = (authStore.user?.role ?? '').toLowerCase();
    const permitido = to.matched.every((record) => rolPermitido(rol, record.meta.roles as string[] | undefined));
    if (!permitido) {
      return { path: '/tabs/dashboard', replace: true };
    }
  }

  return true;
});

export default router;
