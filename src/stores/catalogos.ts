/**
 * Catálogos compartidos para los selectores de formularios y filtros
 * (razas, potreros, categorías y unidades de medida).
 *
 * Se sincroniza/invalida automáticamente tras crear, editar o eliminar en el
 * módulo de Catálogos (`Catalogos.vue`) o Potreros (`Potreros.vue`), de modo que
 * los selectores de Registro de Animales e Insumos reflejen siempre los cambios al instante.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { catalogoService, type Categoria, type OpcionCatalogo, type UnidadMedida } from '@/services';

export const useCatalogosStore = defineStore('catalogos', () => {
  const razas = ref<OpcionCatalogo[]>([]);
  const potreros = ref<OpcionCatalogo[]>([]);
  const categorias = ref<Categoria[]>([]);
  const unidadesMedida = ref<UnidadMedida[]>([]);

  const cargados = ref<boolean>(false);
  const cargadosInsumos = ref<boolean>(false);
  const error = ref<boolean>(false);
  const errorInsumos = ref<boolean>(false);

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

  async function cargarCatalogosInsumos(forzar = false): Promise<void> {
    if (cargadosInsumos.value && !forzar) return;
    errorInsumos.value = false;
    try {
      const [listaCategorias, listaUnidades] = await Promise.all([
        catalogoService.categorias(),
        catalogoService.unidadesMedida(),
      ]);
      categorias.value = listaCategorias;
      unidadesMedida.value = listaUnidades;
      cargadosInsumos.value = true;
    } catch {
      errorInsumos.value = true;
    }
  }

  /** Marca los catálogos como obsoletos para forzar su recarga en la próxima lectura. */
  function invalidar(): void {
    cargados.value = false;
    cargadosInsumos.value = false;
  }

  /**
   * Invalida y refresca inmediatamente los selectores afectados tras operaciones
   * CRUD en el módulo de Catálogos.
   */
  async function sincronizar(tipo?: 'razas' | 'categorias' | 'unidades'): Promise<void> {
    if (!tipo || tipo === 'razas') {
      cargados.value = false;
      try {
        razas.value = await catalogoService.razas();
      } catch {
        error.value = true;
      }
    }
    if (!tipo || tipo === 'categorias' || tipo === 'unidades') {
      cargadosInsumos.value = false;
      await cargarCatalogosInsumos(true);
    }
  }

  function limpiar(): void {
    razas.value = [];
    potreros.value = [];
    categorias.value = [];
    unidadesMedida.value = [];
    cargados.value = false;
    cargadosInsumos.value = false;
    error.value = false;
    errorInsumos.value = false;
  }

  return {
    razas,
    potreros,
    categorias,
    unidadesMedida,
    cargados,
    cargadosInsumos,
    error,
    errorInsumos,
    cargar,
    cargarCatalogosInsumos,
    invalidar,
    sincronizar,
    limpiar,
  };
});
