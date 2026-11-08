/**
 * Punto de entrada de la capa de servicios (Persona 3).
 *
 * `inicializarServicios` conecta el cliente HTTP con el store de sesion y el
 * router. Se llama una sola vez desde main.ts, despues de registrar Pinia.
 * Hacerlo aqui y no dentro de http.ts evita una dependencia circular
 * (store -> servicio -> store).
 */
import type { Router } from 'vue-router';

import { registrarManejadorNoAutorizado, registrarProveedorDeToken } from './http';

import { useAuthStore } from '@/stores/auth';

export * from './http';
export * from './auth.service';
export * from './animal.service';
export * from './catalogo.service';

export function inicializarServicios(router: Router): void {
  const authStore = useAuthStore();

  // De donde sale el token que se adjunta a cada peticion.
  registrarProveedorDeToken(() => authStore.token);

  // Que hacer cuando la API responde 401 en cualquier peticion.
  registrarManejadorNoAutorizado(async () => {
    await authStore.logout();
    if (router.currentRoute.value.path !== '/login') {
      await router.replace('/login');
    }
  });
}
