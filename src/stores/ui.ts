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
      return;
    }
  }

  async function establecerSidebarColapsado(valor: boolean): Promise<void> {
    sidebarColapsado.value = valor;
    try {
      await Preferences.set({ key: CLAVE_SIDEBAR, value: String(valor) });
    } catch {
      return;
    }
  }

  async function alternarSidebar(): Promise<void> {
    await establecerSidebarColapsado(!sidebarColapsado.value);
  }

  return { sidebarColapsado, cargarPreferencias, establecerSidebarColapsado, alternarSidebar };
});
