/**
 * Catálogos para los selectores (razas y potreros): se comparten entre el
 * listado, el formulario de animales y los filtros.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { catalogoService, type OpcionCatalogo } from '@/services';

export const useCatalogosStore = defineStore('catalogos', () => {
  const razas = ref<OpcionCatalogo[]>([]);
  const potreros = ref<OpcionCatalogo[]>([]);
  const cargados = ref<boolean>(false);
  const error = ref<boolean>(false);

  async function cargar(forzar = false): Promise<void> {
    if (cargados.value && !forzar) return;
    error.value = false;
    try {
      const [listaRazas, listaPotreros] = await Promise.all([catalogoService.razas(), catalogoService.potreros()]);
      razas.value = listaRazas;
      potreros.value = listaPotreros;
      cargados.value = true;
    } catch {
      // Los catálogos son auxiliares: sin ellos los selectores quedan en "Todos".
      error.value = true;
    }
  }

  function limpiar(): void {
    razas.value = [];
    potreros.value = [];
    cargados.value = false;
  }

  return { razas, potreros, cargados, error, cargar, limpiar };
});
