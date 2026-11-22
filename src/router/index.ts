import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { rolesDeModulo, rolPermitido } from '@/config/roles';
import { useAuthStore } from '@/stores/auth';

/** Módulos de fases 1–4 que aún no tienen vista propia: comparten un marcador de posición. */
const proximamente = () => import('@/views/ModuloProximamente.vue');

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
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterPage.vue'),
    meta: { requiresAuth: false, guestOnly: true },
  },
  {
    // Shell autenticado: ion-split-pane (escritorio) + drawer y tabs (móvil)
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
        // Sin `roles`: es el destino de las redirecciones por rol, no debe bloquearse (evita bucles)
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
        // Solo el admin crea/edita animales (AnimalPolicy)
        meta: { requiresAuth: true, roles: ['admin'] },
      },
      {
        path: 'potreros',
        name: 'PotreroList',
        component: proximamente,
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('potreros'),
          titulo: 'Potreros',
          descripcion: 'Gestión de potreros, capacidad y ocupación.',
        },
      },
      {
        path: 'pesajes',
        name: 'PesajeList',
        component: proximamente,
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('pesajes'),
          titulo: 'Pesajes',
          descripcion: 'Historial y registro de pesajes del hato.',
        },
      },
      {
        path: 'tratamientos',
        name: 'TratamientoList',
        component: proximamente,
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('tratamientos'),
          titulo: 'Tratamientos',
          descripcion: 'Catálogo sanitario y aplicaciones a los animales.',
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
        component: proximamente,
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('insumos'),
          titulo: 'Insumos',
          descripcion: 'Inventario de insumos de la finca.',
        },
      },
      {
        path: 'catalogos',
        name: 'CatalogoList',
        component: proximamente,
        meta: {
          requiresAuth: true,
          isRootScreen: true,
          roles: rolesDeModulo('catalogos'),
          titulo: 'Catálogos',
          descripcion: 'Razas, categorías y unidades de medida.',
        },
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

/**
 * Guardián de navegación:
 *  1. Consulta el estado reactivo de la sesión en Pinia (`authStore.isAuthenticated`).
 *  2. Aplica la matriz de roles (`meta.roles`): quien no tenga el rol vuelve al inicio.
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
    return { path: '/login', replace: true };
  }

  // Si ya tiene sesión activa e intenta ir a /login o /register, redirige reemplazando historial
  if (guestOnly && authStore.isAuthenticated) {
    return { path: '/tabs/dashboard', replace: true };
  }

  // Matriz de roles: todas las rutas coincidentes deben permitir el rol actual
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
