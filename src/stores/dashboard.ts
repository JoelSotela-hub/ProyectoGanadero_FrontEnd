/**
 * Store del panel de control: todo proviene de la API y respeta el rol para no
 * disparar 403 (tratamientos e insumos solo para admin y veterinario).
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  dashboardService,
  mensajeDeError,
  type AnimalReciente,
  type ConteosPanel,
  type PesajeReciente,
  type PotreroCapacidad,
} from '@/services';

export type TipoActividad = 'pesajes' | 'animales';

export const useDashboardStore = defineStore('dashboard', () => {
  const conteos = ref<ConteosPanel>({
    animales: null,
    potreros: null,
    tratamientos: null,
    pesajes: null,
    insumos: null,
  });
  const potreros = ref<PotreroCapacidad[]>([]);
  const pesajes = ref<PesajeReciente[]>([]);
  const animales = ref<AnimalReciente[]>([]);
  const tipoActividad = ref<TipoActividad>('pesajes');

  const cargando = ref<boolean>(true);
  const error = ref<boolean>(false);
  const mensajeError = ref<string>('');

  let controlador: AbortController | null = null;

  const hayDatos = computed<boolean>(() => Object.values(conteos.value).some((valor) => valor !== null));

  async function cargar(permisos: { tratamientos: boolean; insumos: boolean }): Promise<void> {
    controlador?.abort();
    const actual = new AbortController();
    controlador = actual;

    cargando.value = true;
    error.value = false;
    mensajeError.value = '';

    try {
      const [resumen, listaPotreros, listaPesajes] = await Promise.all([
        dashboardService.conteos(permisos, actual.signal),
        dashboardService.potrerosCapacidad(actual.signal).catch(() => [] as PotreroCapacidad[]),
        dashboardService.pesajesRecientes(actual.signal).catch(() => null),
      ]);

      if (actual.signal.aborted) return;

      conteos.value = resumen;
      potreros.value = listaPotreros;

      if (listaPesajes && listaPesajes.length > 0) {
        pesajes.value = listaPesajes;
        tipoActividad.value = 'pesajes';
        animales.value = [];
      } else {
        // Sin pesajes todavía: se muestran los últimos animales registrados.
        tipoActividad.value = 'animales';
        pesajes.value = [];
        animales.value = await dashboardService.animalesRecientes(actual.signal).catch(() => []);
      }

      if (!hayDatos.value) {
        error.value = true;
        mensajeError.value = 'No se obtuvo respuesta del servidor. Revisa tu conexión e inténtalo de nuevo.';
      }
    } catch (err) {
      if (actual.signal.aborted) return;
      error.value = true;
      mensajeError.value = mensajeDeError(err, 'No se pudieron cargar las métricas.');
    } finally {
      if (controlador === actual) cargando.value = false;
    }
  }

  function cancelar(): void {
    controlador?.abort();
    controlador = null;
  }

  return {
    conteos,
    potreros,
    pesajes,
    animales,
    tipoActividad,
    cargando,
    error,
    mensajeError,
    hayDatos,
    cargar,
    cancelar,
  };
});
