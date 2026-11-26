import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AnimalItem } from '@/models/auth.model';
import { animalService, ApiError, formatearMarcaDeTiempo, mensajeDeError, networkService } from '@/services';

export interface FiltrosListadoAnimales {
  search: string;
  raza_id: string;
  potrero_id: string;
  sexo: string;
  estado: string;
  sort_by: string;
  order: 'asc' | 'desc';
}

export const OPCIONES_ORDEN: { clave: string; etiqueta: string; sort_by: string; order: 'asc' | 'desc' }[] = [
  { clave: 'numero_arete|asc', etiqueta: 'Arete (A–Z)', sort_by: 'numero_arete', order: 'asc' },
  { clave: 'numero_arete|desc', etiqueta: 'Arete (Z–A)', sort_by: 'numero_arete', order: 'desc' },
  { clave: 'id_animal|desc', etiqueta: 'Registro más reciente', sort_by: 'id_animal', order: 'desc' },
  { clave: 'fecha_nacimiento|asc', etiqueta: 'Nacimiento (más antiguo)', sort_by: 'fecha_nacimiento', order: 'asc' },
  { clave: 'fecha_nacimiento|desc', etiqueta: 'Nacimiento (más reciente)', sort_by: 'fecha_nacimiento', order: 'desc' },
  { clave: 'estado|asc', etiqueta: 'Estado', sort_by: 'estado', order: 'asc' },
];

const POR_PAGINA = 15;
const RETARDO_BUSQUEDA_MS = 300;

function filtrosIniciales(): FiltrosListadoAnimales {
  return { search: '', raza_id: '', potrero_id: '', sexo: '', estado: '', sort_by: 'numero_arete', order: 'asc' };
}

export const useAnimalesStore = defineStore('animales', () => {
  const items = ref<AnimalItem[]>([]);
  const filtros = ref<FiltrosListadoAnimales>(filtrosIniciales());

  const loading = ref<boolean>(true);
  const cargandoMas = ref<boolean>(false);
  const error = ref<boolean>(false);
  const mensajeError = ref<string>('');

  const paginaActual = ref<number>(1);
  const hayMas = ref<boolean>(false);
  const total = ref<number>(0);

  const desdeCache = ref<boolean>(false);
  const ultimaActualizacion = ref<string | null>(null);

  let controlador: AbortController | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const hayFiltrosActivos = computed<boolean>(() =>
    Boolean(
      filtros.value.search.trim() ||
      filtros.value.raza_id ||
      filtros.value.potrero_id ||
      filtros.value.sexo ||
      filtros.value.estado,
    ),
  );

  const claveOrden = computed<string>(() => `${filtros.value.sort_by}|${filtros.value.order}`);

  const mostrandoAvisoOffline = computed<boolean>(
    () => desdeCache.value || (!networkService.isOnline.value && items.value.length > 0),
  );
  const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

  function cancelarPendiente(): void {
    if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }
    controlador?.abort();
    controlador = null;
  }

  async function cargar(pagina = 1, anexar = false): Promise<void> {
    controlador?.abort();
    const actual = new AbortController();
    controlador = actual;

    mensajeError.value = '';
    if (anexar) {
      cargandoMas.value = true;
    } else {
      loading.value = true;
      error.value = false;
    }

    const f = filtros.value;
    try {
      const resultado = await animalService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        search: f.search.trim() || undefined,
        raza_id: f.raza_id || undefined,
        potrero_id: f.potrero_id || undefined,
        sexo: f.sexo || undefined,
        estado: f.estado || undefined,
        sort_by: f.sort_by,
        order: f.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      items.value = anexar ? [...items.value, ...resultado.items] : resultado.items;
      paginaActual.value = resultado.paginacion.paginaActual;
      total.value = resultado.paginacion.total;
      hayMas.value = resultado.hayMas;
      desdeCache.value = Boolean(resultado.desdeCache);
      ultimaActualizacion.value = resultado.ultimaActualizacion ?? ultimaActualizacion.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeError.value = mensajeDeError(err, 'No se pudieron cargar más animales.');
      } else {
        error.value = true;
        mensajeError.value = mensajeDeError(err, 'No se pudo obtener el listado de animales.');
        items.value = [];
        hayMas.value = false;
      }
    } finally {
      if (controlador === actual) {
        loading.value = false;
        cargandoMas.value = false;
      }
    }
  }

  async function recargar(): Promise<void> {
    await cargar(1, false);
  }

  async function cargarMas(): Promise<void> {
    if (!hayMas.value || cargandoMas.value || loading.value) return;
    await cargar(paginaActual.value + 1, true);
  }

  function buscar(texto: string): void {
    filtros.value.search = texto;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      void recargar();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerFiltro(campo: 'raza_id' | 'potrero_id' | 'sexo' | 'estado', valor: string): void {
    filtros.value[campo] = valor;
    void recargar();
  }

  function establecerOrden(clave: string): void {
    const opcion = OPCIONES_ORDEN.find((o) => o.clave === clave);
    if (!opcion) return;
    filtros.value.sort_by = opcion.sort_by;
    filtros.value.order = opcion.order;
    void recargar();
  }

  function limpiarFiltros(): void {
    filtros.value = filtrosIniciales();
    void recargar();
  }

  function marcarSinConexion(): void {
    if (items.value.length > 0) desdeCache.value = true;
  }

  return {
    items,
    filtros,
    loading,
    cargandoMas,
    error,
    mensajeError,
    paginaActual,
    hayMas,
    total,
    desdeCache,
    ultimaActualizacion,
    hayFiltrosActivos,
    claveOrden,
    mostrandoAvisoOffline,
    ultimaActualizacionTexto,
    cargar,
    recargar,
    cargarMas,
    buscar,
    establecerFiltro,
    establecerOrden,
    limpiarFiltros,
    cancelarPendiente,
    marcarSinConexion,
  };
});
