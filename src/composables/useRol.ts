/**
 * Rol del usuario autenticado (Persona 5).
 * El backend entrega `role` como 'admin' | 'veterinario' | 'operario'.
 */
import { computed, type ComputedRef } from 'vue';

import { useAuthStore } from '@/stores/auth';

export interface UsoRol {
  rol: ComputedRef<string>;
  esAdmin: ComputedRef<boolean>;
  esOperario: ComputedRef<boolean>;
}

export function useRol(): UsoRol {
  const authStore = useAuthStore();

  const rol = computed<string>(() => (authStore.user?.role ?? '').toLowerCase());
  const esAdmin = computed<boolean>(() => rol.value === 'admin');
  const esOperario = computed<boolean>(() => rol.value === 'operario');

  return { rol, esAdmin, esOperario };
}

