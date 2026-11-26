import { computed, type ComputedRef } from 'vue';

import { MODULOS, rolPermitido, type ModuloNavegacion } from '@/config/roles';
import { useAuthStore } from '@/stores/auth';

export interface UsoRol {
  rol: ComputedRef<string>;
  esAdmin: ComputedRef<boolean>;
  esVeterinario: ComputedRef<boolean>;
  esOperario: ComputedRef<boolean>;
  modulosVisibles: ComputedRef<ModuloNavegacion[]>;
  puedeVer: (clave: string) => boolean;
}

export function useRol(): UsoRol {
  const authStore = useAuthStore();

  const rol = computed<string>(() => (authStore.user?.role ?? '').toLowerCase());
  const esAdmin = computed<boolean>(() => rol.value === 'admin');
  const esVeterinario = computed<boolean>(() => rol.value === 'veterinario');
  const esOperario = computed<boolean>(() => rol.value === 'operario');

  const modulosVisibles = computed<ModuloNavegacion[]>(() =>
    MODULOS.filter((modulo) => rolPermitido(rol.value, modulo.roles)),
  );

  function puedeVer(clave: string): boolean {
    return modulosVisibles.value.some((modulo) => modulo.clave === clave);
  }

  return { rol, esAdmin, esVeterinario, esOperario, modulosVisibles, puedeVer };
}
