/**
 * Store de Pinia para el módulo global de Pesajes (Fase 3).
 *
 * Centraliza:
 *   - Listado paginado (`GET /api/v1/pesajes`) con filtros reales:
 *     `id_animal`, `fecha_desde`, `fecha_hasta`, `peso_min`, `peso_max`, `sort_by`, `order`.
 *   - Debounce (300 ms) + `AbortController` + caché offline con marca de tiempo.
 *   - Selector de animales cargado con `per_page=100`.
 *   - Creación (`admin` y `operario`), edición (`admin`) y eliminación (`admin`)
 *     con validación real, mapeo de errores `422` por campo y recarga tras `201 Created`
 *     para traer la relación `animal` completa.
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import type { AnimalItem } from '@/models/auth.model';
import {
  animalService,
  ApiError,
  formatearMarcaDeTiempo,
  mensajeDeError,
  networkService,
  pesajeService,
  type ApiLinks,
  type ApiMeta,
  type CampoOrdenPesaje,
  type PesajeAnimal,
  type PesajePayload,
} from '@/services';
import { useAuthStore } from '@/stores/auth';

export interface FiltrosListadoPesajes {
  id_animal: string;
  fecha_desde: string;
  fecha_hasta: string;
  peso_min: string;
  peso_max: string;
  sort_by: CampoOrdenPesaje;
  order: 'asc' | 'desc';
}

export type CampoFormPesaje = 'id_animal' | 'peso_kg' | 'fecha_pesaje' | 'observaciones';

export const OPCIONES_ORDEN_PESAJE: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenPesaje;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'fecha_pesaje|desc', etiqueta: 'Fecha (más recientes)', sort_by: 'fecha_pesaje', order: 'desc' },
  { clave: 'fecha_pesaje|asc', etiqueta: 'Fecha (más antiguos)', sort_by: 'fecha_pesaje', order: 'asc' },
  { clave: 'peso_kg|desc', etiqueta: 'Peso (mayor a menor)', sort_by: 'peso_kg', order: 'desc' },
  { clave: 'peso_kg|asc', etiqueta: 'Peso (menor a mayor)', sort_by: 'peso_kg', order: 'asc' },
  { clave: 'pesaje_id|desc', etiqueta: 'ID (descendente)', sort_by: 'pesaje_id', order: 'desc' },
  { clave: 'pesaje_id|asc', etiqueta: 'ID (ascendente)', sort_by: 'pesaje_id', order: 'asc' },
  { clave: 'id_animal|asc', etiqueta: 'Animal (ascendente)', sort_by: 'id_animal', order: 'asc' },
  { clave: 'id_animal|desc', etiqueta: 'Animal (descendente)', sort_by: 'id_animal', order: 'desc' },
];

const POR_PAGINA = 15;
const RETARDO_FILTRO_MS = 300;

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function extraerFechaInput(valor: string | null | undefined): string {
  if (!valor) return hoyIso();
  const match = valor.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : hoyIso();
}

function filtrosIniciales(): FiltrosListadoPesajes {
  return {
    id_animal: '',
    fecha_desde: '',
    fecha_hasta: '',
    peso_min: '',
    peso_max: '',
    sort_by: 'fecha_pesaje',
    order: 'desc',
  };
}

export const usePesajeStore = defineStore('pesaje', () => {
  const authStore = useAuthStore();

  // ---------------- 1. Listado ----------------
  const items = ref<PesajeAnimal[]>([]);
  const filtros = ref<FiltrosListadoPesajes>(filtrosIniciales());

  const loading = ref<boolean>(false);
  const cargandoMas = ref<boolean>(false);
  const error = ref<boolean>(false);
  const mensajeError = ref<string>('');

  const meta = ref<ApiMeta | null>(null);
  const links = ref<ApiLinks | null>(null);
  const paginaActual = ref<number>(1);
  const total = ref<number>(0);
  const hayMas = ref<boolean>(false);

  const desdeCache = ref<boolean>(false);
  const ultimaActualizacion = ref<string | null>(null);

  let controlador: AbortController | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  // Selector de animales (`per_page=100`)
  const animales = ref<AnimalItem[]>([]);
  const cargandoAnimales = ref<boolean>(false);
  const animalesCargados = ref<boolean>(false);

  const rolActual = computed<string>(() => (authStore.user?.role ?? '').toLowerCase());
  const puedeCrear = computed<boolean>(() => rolActual.value === 'admin' || rolActual.value === 'operario');
  const puedeEditar = computed<boolean>(() => rolActual.value === 'admin');
  const puedeEliminar = computed<boolean>(() => rolActual.value === 'admin');

  const hayFiltrosActivos = computed<boolean>(() =>
    Boolean(
      filtros.value.id_animal ||
      filtros.value.fecha_desde ||
      filtros.value.fecha_hasta ||
      filtros.value.peso_min.trim() ||
      filtros.value.peso_max.trim(),
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

  function programarRecarga(): void {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      void recargar();
    }, RETARDO_FILTRO_MS);
  }

  async function cargarAnimales(forzar = false): Promise<void> {
    if ((animalesCargados.value && !forzar) || cargandoAnimales.value) return;
    cargandoAnimales.value = true;
    try {
      const res = await animalService.listar({ page: 1, per_page: 100 });
      animales.value = res.items;
      animalesCargados.value = true;
    } catch {
      // Si falla la carga del selector, se reintentará en el próximo intento.
    } finally {
      cargandoAnimales.value = false;
    }
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
    const pesoMinNum = f.peso_min.trim() !== '' ? Number(f.peso_min) : undefined;
    const pesoMaxNum = f.peso_max.trim() !== '' ? Number(f.peso_max) : undefined;

    try {
      const resultado = await pesajeService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        id_animal: f.id_animal || undefined,
        fecha_desde: f.fecha_desde || undefined,
        fecha_hasta: f.fecha_hasta || undefined,
        peso_min: pesoMinNum !== undefined && Number.isFinite(pesoMinNum) ? pesoMinNum : undefined,
        peso_max: pesoMaxNum !== undefined && Number.isFinite(pesoMaxNum) ? pesoMaxNum : undefined,
        sort_by: f.sort_by,
        order: f.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      items.value = anexar ? [...items.value, ...resultado.data] : resultado.data;
      meta.value = resultado.meta;
      links.value = resultado.links;
      paginaActual.value = resultado.meta.current_page;
      total.value = resultado.meta.total;
      hayMas.value = resultado.hayMas;
      desdeCache.value = resultado.desdeCache;
      ultimaActualizacion.value = resultado.ultimaActualizacion ?? ultimaActualizacion.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeError.value = mensajeDeError(err, 'No se pudieron cargar más pesajes.');
      } else {
        error.value = true;
        mensajeError.value = mensajeDeError(err, 'No se pudo obtener el listado de pesajes.');
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

  function establecerAnimal(valor: string): void {
    filtros.value.id_animal = valor;
    void recargar();
  }

  function establecerFechaDesde(valor: string): void {
    filtros.value.fecha_desde = valor;
    void recargar();
  }

  function establecerFechaHasta(valor: string): void {
    filtros.value.fecha_hasta = valor;
    void recargar();
  }

  function establecerPesoMin(valor: string): void {
    filtros.value.peso_min = valor;
    programarRecarga();
  }

  function establecerPesoMax(valor: string): void {
    filtros.value.peso_max = valor;
    programarRecarga();
  }

  function establecerOrden(clave: string): void {
    const opcion = OPCIONES_ORDEN_PESAJE.find((o) => o.clave === clave);
    if (!opcion) return;
    filtros.value.sort_by = opcion.sort_by;
    filtros.value.order = opcion.order;
    void recargar();
  }

  function limpiarFiltros(): void {
    cancelarPendiente();
    filtros.value = filtrosIniciales();
    void recargar();
  }

  function marcarSinConexion(): void {
    if (items.value.length > 0) desdeCache.value = true;
  }

  // ---------------- 2. Formulario Crear / Editar ----------------
  const editandoId = ref<number | null>(null);
  const esEdicion = computed<boolean>(() => editandoId.value !== null);

  const form = reactive({
    id_animal: '',
    peso_kg: '',
    fecha_pesaje: hoyIso(),
    observaciones: '',
  });

  const errores = reactive<Record<CampoFormPesaje, string>>({
    id_animal: '',
    peso_kg: '',
    fecha_pesaje: '',
    observaciones: '',
  });

  const errorNegocio = ref<string>('');
  const errorGeneral = ref<string>('');
  const guardando = ref<boolean>(false);
  const eliminandoId = ref<number | null>(null);

  function limpiarErroresFormulario(): void {
    errores.id_animal = '';
    errores.peso_kg = '';
    errores.fecha_pesaje = '';
    errores.observaciones = '';
    errorNegocio.value = '';
    errorGeneral.value = '';
  }

  function prepararNuevo(): void {
    editandoId.value = null;
    form.id_animal = filtros.value.id_animal || '';
    form.peso_kg = '';
    form.fecha_pesaje = hoyIso();
    form.observaciones = '';
    limpiarErroresFormulario();
  }

  function prepararEdicion(pesaje: PesajeAnimal): void {
    editandoId.value = pesaje.pesaje_id;
    form.id_animal = String(pesaje.id_animal);
    form.peso_kg = String(pesaje.peso_kg);
    form.fecha_pesaje = extraerFechaInput(pesaje.fecha_pesaje);
    form.observaciones = pesaje.observaciones ?? '';
    limpiarErroresFormulario();
  }

  function validarFormulario(): boolean {
    limpiarErroresFormulario();

    const idAnimalNum = Number(form.id_animal);
    if (!form.id_animal || !Number.isInteger(idAnimalNum) || idAnimalNum <= 0) {
      errores.id_animal = 'Selecciona un animal válido.';
    }

    const textoPeso = String(form.peso_kg ?? '').trim();
    const peso = Number(textoPeso);
    if (!textoPeso) {
      errores.peso_kg = 'El peso en kilogramos es obligatorio.';
    } else if (!Number.isFinite(peso) || peso < 0 || peso > 9999.99) {
      errores.peso_kg = 'Ingresa un peso válido entre 0 y 9999.99 kg.';
    }

    if (!form.fecha_pesaje.trim()) {
      errores.fecha_pesaje = 'La fecha de pesaje es obligatoria.';
    }

    return !errores.id_animal && !errores.peso_kg && !errores.fecha_pesaje && !errores.observaciones;
  }

  async function guardar(): Promise<PesajeAnimal | null> {
    if (esEdicion.value && !puedeEditar.value) {
      errorGeneral.value = 'No tienes permiso para editar pesajes.';
      return null;
    }
    if (!esEdicion.value && !puedeCrear.value) {
      errorGeneral.value = 'No tienes permiso para registrar pesajes.';
      return null;
    }
    if (!validarFormulario()) return null;

    const payload: PesajePayload = {
      id_animal: Number(form.id_animal),
      peso_kg: Number(form.peso_kg),
      fecha_pesaje: form.fecha_pesaje,
      observaciones: form.observaciones.trim() || null,
    };

    guardando.value = true;
    try {
      const resultado =
        editandoId.value !== null
          ? await pesajeService.actualizar(editandoId.value, payload)
          : await pesajeService.crear(payload);

      // El store() del backend no devuelve `animal` anidado: se refresca el listado completo.
      await recargar();
      return resultado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(errores) as CampoFormPesaje[]).forEach((campo) => {
            if (porCampo[campo]) errores[campo] = porCampo[campo];
          });
          errorGeneral.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocio.value = err.message;
        } else {
          errorGeneral.value = err.message;
        }
      } else {
        errorGeneral.value = mensajeDeError(err, 'No se pudo guardar el pesaje.');
      }
      return null;
    } finally {
      guardando.value = false;
    }
  }

  async function eliminar(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!puedeEliminar.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar pesajes.' };
    }

    eliminandoId.value = id;
    try {
      await pesajeService.eliminar(id);
      items.value = items.value.filter((p) => p.pesaje_id !== id);
      total.value = Math.max(0, total.value - 1);
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Pesaje eliminado correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar el pesaje.'),
      };
    } finally {
      eliminandoId.value = null;
    }
  }

  function limpiarEstado(): void {
    cancelarPendiente();
    items.value = [];
    filtros.value = filtrosIniciales();
    meta.value = null;
    links.value = null;
    paginaActual.value = 1;
    total.value = 0;
    hayMas.value = false;
    desdeCache.value = false;
    ultimaActualizacion.value = null;
    animales.value = [];
    animalesCargados.value = false;
    prepararNuevo();
  }

  return {
    // Listado
    items,
    filtros,
    loading,
    cargandoMas,
    error,
    mensajeError,
    meta,
    links,
    paginaActual,
    total,
    hayMas,
    desdeCache,
    ultimaActualizacion,
    hayFiltrosActivos,
    claveOrden,
    mostrandoAvisoOffline,
    ultimaActualizacionTexto,
    animales,
    cargandoAnimales,
    puedeCrear,
    puedeEditar,
    puedeEliminar,
    cargar,
    recargar,
    cargarMas,
    cargarAnimales,
    establecerAnimal,
    establecerFechaDesde,
    establecerFechaHasta,
    establecerPesoMin,
    establecerPesoMax,
    establecerOrden,
    limpiarFiltros,
    cancelarPendiente,
    marcarSinConexion,
    limpiarEstado,

    // Formulario
    editandoId,
    esEdicion,
    form,
    errores,
    errorNegocio,
    errorGeneral,
    guardando,
    eliminandoId,
    limpiarErroresFormulario,
    prepararNuevo,
    prepararEdicion,
    validarFormulario,
    guardar,
    eliminar,
  };
});
