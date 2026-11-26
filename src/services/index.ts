import type { Router } from 'vue-router';

import { registrarManejadorNoAutorizado, registrarProveedorDeToken } from './http';
import { inicializarMonitorDeRed } from './network.service';
import { conectarAlmacenamientoSeguro } from './secureStorage.service';

import { useAuthStore } from '@/stores/auth';

export * from './http';
export * from './auth.service';
export * from './usuario.service';
export * from './animal.service';
export * from './potrero.service';
export * from './pesaje.service';
export * from './tratamiento.service';
export * from './catalogo.service';
export * from './insumo.service';
export * from './dashboard.service';
export * from './secureStorage.service';
export * from './cache.service';
export * from './network.service';
export * from './ronda.service';
export * from './permisos.service';
export * from './escaner.service';
export * from './ubicacion.service';
export * from './feedback.service';

export function inicializarServicios(router: Router): void {
  conectarAlmacenamientoSeguro();

  void inicializarMonitorDeRed();

  const authStore = useAuthStore();

  registrarProveedorDeToken(() => authStore.token);

  registrarManejadorNoAutorizado(async () => {
    await authStore.logout();
    if (router.currentRoute.value.path !== '/login') {
      await router.replace('/login');
    }
  });
}
