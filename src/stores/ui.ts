/**
 * Preferencias de interfaz (estado reactivo): menú lateral minimizado.
 * Se persiste en @capacitor/preferences (NO es información sensible).
 */
import { Preferences } from '@capacitor/preferences';
import { defineStore } from 'pinia';
import { ref } from 'vue';

const CLAVE_SIDEBAR = 'guateganado_sidebar_colapsado';

export const useUiStore = defineStore('ui', () => {
  const sidebarColapsado = ref<boolean>(false);

  async function cargarPreferencias(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: CLAVE_SIDEBAR });
      sidebarColapsado.value = value === 'true';
    } catch {
      // Sin almacenamiento: se usa el valor por defecto (expandido).
    }
  }

  async function establecerSidebarColapsado(valor: boolean): Promise<void> {
    sidebarColapsado.value = valor;
    try {
      await Preferences.set({ key: CLAVE_SIDEBAR, value: String(valor) });
    } catch {
      // La preferencia sigue vigente en memoria.
    }
  }

  async function alternarSidebar(): Promise<void> {
    await establecerSidebarColapsado(!sidebarColapsado.value);
  }

  return { sidebarColapsado, cargarPreferencias, establecerSidebarColapsado, alternarSidebar };
});
