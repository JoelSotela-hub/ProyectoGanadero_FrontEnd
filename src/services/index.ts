/**
 * Punto de entrada de la capa de servicios (Persona 3 + Persona 4).
 *
 * `inicializarServicios` conecta:
 *   1. El adaptador de almacenamiento cifrado (`@aparajita/capacitor-secure-storage`)
 *      con el store de sesion en Pinia antes de que el router resuelva la primera ruta.
 *   2. El monitor de conectividad (`@capacitor/network`) para detectar cambios de red.
 *   3. El cliente HTTP con el proveedor de token y el manejador de 401.
 */
import type { Router } from 'vue-router';

import { registrarManejadorNoAutorizado, registrarProveedorDeToken } from './http';
import { inicializarMonitorDeRed } from './network.service';
import { conectarAlmacenamientoSeguro } from './secureStorage.service';

import { useAuthStore } from '@/stores/auth';

export * from './http';
export * from './auth.service';
export * from './animal.service';
export * from './catalogo.service';
export * from './secureStorage.service';
export * from './cache.service';
export * from './network.service';

export function inicializarServicios(router: Router): void {
  // 1. Conectar almacenamiento seguro cifrado para el token (Persona 4 -> Puente de Abraham)
  conectarAlmacenamientoSeguro();

  // 2. Inicializar monitoreo de red con @capacitor/network (Persona 4)
  void inicializarMonitorDeRed();

  const authStore = useAuthStore();

  // 3. De donde sale el token que se adjunta a cada peticion (Persona 3)
  registrarProveedorDeToken(() => authStore.token);

  // 4. Que hacer cuando la API responde 401 en cualquier peticion (Persona 3)
  registrarManejadorNoAutorizado(async () => {
    await authStore.logout();
    if (router.currentRoute.value.path !== '/login') {
      await router.replace('/login');
    }
  });
}
