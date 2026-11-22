/**
 * Store de Pinia para el módulo Potreros (Fase 2).
 *
 * Centraliza:
 *   - Listado paginado con filtros reales (`nombre`, `estado_pasto`, `sort_by`, `order`),
 *     debounce de 300 ms + `AbortController` y caché offline con marca de tiempo.
 *   - Formulario Crear / Editar Potrero (solo `admin`) con validación real, mapeo de
 *     errores `422` por campo y manejo de reglas de negocio `409`.
 *   - Eliminación con manejo de `409` (RN-02: potrero con animales asignados).
 *   - Detalle de potrero + listado paginado de animales asignados (`GET /potreros/{id}/animales`)
 *     con cálculo de ocupación real (`meta.total / capacidad_maxima`).
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import type { AnimalItem } from '@/models/auth.model';
import {
  ApiError,
  formatearMarcaDeTiempo,
  mensajeDeError,
  networkService,
  potreroService,
  type ApiLinks,
  type ApiMeta,
  type CampoOrdenPotrero,
  type Potrero,
  type PotreroPayload,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useCatalogosStore } from '@/stores/catalogos';

export interface FiltrosListadoPotreros {
  nombre: string;
  estado_pasto: string;
  sort_by: CampoOrdenPotrero;
  order: 'asc' | 'desc';
}

export type CampoFormPotrero = 'nombre' | 'hectareas_de_extension' | 'capacidad_maxima' | 'estado_pasto' | 'codigo_qr';

export const OPCIONES_ORDEN_POTRERO: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenPotrero;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'potrero_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'potrero_id', order: 'asc' },
  { clave: 'potrero_id|desc', etiqueta: 'Más recientes primero', sort_by: 'potrero_id', order: 'desc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  {
    clave: 'hectareas_de_extension|desc',
    etiqueta: 'Extensión (mayor a menor)',
    sort_by: 'hectareas_de_extension',
    order: 'desc',
  },
  {
    clave: 'hectareas_de_extension|asc',
    etiqueta: 'Extensión (menor a mayor)',
    sort_by: 'hectareas_de_extension',
    order: 'asc',
  },
  { clave: 'capacidad_maxima|desc', etiqueta: 'Capacidad (mayor a menor)', sort_by: 'capacidad_maxima', order: 'desc' },
  { clave: 'capacidad_maxima|asc', etiqueta: 'Capacidad (menor a mayor)', sort_by: 'capacidad_maxima', order: 'asc' },
];

export interface ResumenOcupacionPotrero {
  ocupados: number;
  capacidad: number;
  disponibles: number;
  porcentajeBarra: number;
  porcentajeReal: number;
  nivel: 'normal' | 'warning' | 'danger';
}

const POR_PAGINA = 15;
const RETARDO_BUSQUEDA_MS = 300;

function filtrosIniciales(): FiltrosListadoPotreros {
  return { nombre: '', estado_pasto: '', sort_by: 'potrero_id', order: 'asc' };
}

export const usePotreroStore = defineStore('potrero', () => {
  const authStore = useAuthStore();
  const catalogosStore = useCatalogosStore();

  // ---------------- 1. Listado ----------------
  const items = ref<Potrero[]>([]);
  const filtros = ref<FiltrosListadoPotreros>(filtrosIniciales());

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

  const hayFiltrosActivos = computed<boolean>(() => Boolean(filtros.value.nombre.trim() || filtros.value.estado_pasto));

  const claveOrden = computed<string>(() => `${filtros.value.sort_by}|${filtros.value.order}`);

  const mostrandoAvisoOffline = computed<boolean>(
    () => desdeCache.value || (!networkService.isOnline.value && items.value.length > 0),
  );

  const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

  function esAdmin(): boolean {
    return (authStore.user?.role ?? '').toLowerCase() === 'admin';
  }

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
      const resultado = await potreroService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        nombre: f.nombre.trim() || undefined,
        estado_pasto: f.estado_pasto || undefined,
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
        mensajeError.value = mensajeDeError(err, 'No se pudieron cargar más potreros.');
      } else {
        error.value = true;
        mensajeError.value = mensajeDeError(err, 'No se pudo obtener el listado de potreros.');
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
    filtros.value.nombre = texto;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      void recargar();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerEstadoPasto(valor: string): void {
    filtros.value.estado_pasto = valor;
    void recargar();
  }

  function establecerOrden(clave: string): void {
    const opcion = OPCIONES_ORDEN_POTRERO.find((o) => o.clave === clave);
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

  // ---------------- 2. Formulario Crear / Editar (solo admin) ----------------
  const editandoId = ref<number | null>(null);
  const esEdicion = computed<boolean>(() => editandoId.value !== null);

  const form = reactive({
    nombre: '',
    hectareas_de_extension: '',
    capacidad_maxima: '',
    estado_pasto: '',
    codigo_qr: '',
  });

  const errores = reactive<Record<CampoFormPotrero, string>>({
    nombre: '',
    hectareas_de_extension: '',
    capacidad_maxima: '',
    estado_pasto: '',
    codigo_qr: '',
  });

  const errorNegocio = ref<string>('');
  const errorGeneral = ref<string>('');
  const guardando = ref<boolean>(false);
  const eliminandoId = ref<number | null>(null);

  function limpiarErroresFormulario(): void {
    errores.nombre = '';
    errores.hectareas_de_extension = '';
    errores.capacidad_maxima = '';
    errores.estado_pasto = '';
    errores.codigo_qr = '';
    errorNegocio.value = '';
    errorGeneral.value = '';
  }

  function prepararNuevo(): void {
    editandoId.value = null;
    form.nombre = '';
    form.hectareas_de_extension = '';
    form.capacidad_maxima = '';
    form.estado_pasto = '';
    form.codigo_qr = '';
    limpiarErroresFormulario();
  }

  function prepararEdicion(potrero: Potrero): void {
    editandoId.value = potrero.potrero_id;
    form.nombre = potrero.nombre;
    form.hectareas_de_extension = String(potrero.hectareas_de_extension);
    form.capacidad_maxima = String(potrero.capacidad_maxima);
    form.estado_pasto = potrero.estado_pasto ?? '';
    form.codigo_qr = potrero.codigo_qr ?? '';
    limpiarErroresFormulario();
  }

  function validarFormulario(): boolean {
    limpiarErroresFormulario();

    const nombreLimpio = form.nombre.trim();
    if (!nombreLimpio) {
      errores.nombre = 'El nombre del potrero es obligatorio.';
    } else if (nombreLimpio.length > 100) {
      errores.nombre = 'El nombre no puede superar los 100 caracteres.';
    }

    const textoHa = String(form.hectareas_de_extension ?? '').trim();
    const ha = Number(textoHa);
    if (!textoHa) {
      errores.hectareas_de_extension = 'La extensión en hectáreas es obligatoria.';
    } else if (!Number.isFinite(ha) || ha < 0 || ha > 999999.99) {
      errores.hectareas_de_extension = 'Ingresa una extensión válida (número mayor o igual a 0).';
    }

    const textoCap = String(form.capacidad_maxima ?? '').trim();
    const cap = Number(textoCap);
    if (!textoCap) {
      errores.capacidad_maxima = 'La capacidad máxima es obligatoria.';
    } else if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap < 0) {
      errores.capacidad_maxima = 'Ingresa un número entero mayor o igual a 0.';
    }

    const qrLimpio = form.codigo_qr.trim();
    if (qrLimpio.length > 100) {
      errores.codigo_qr = 'El código QR no puede superar los 100 caracteres.';
    }

    return (
      !errores.nombre &&
      !errores.hectareas_de_extension &&
      !errores.capacidad_maxima &&
      !errores.estado_pasto &&
      !errores.codigo_qr
    );
  }

  async function guardar(): Promise<Potrero | null> {
    if (!esAdmin()) {
      errorGeneral.value = 'No tienes permiso para crear o editar potreros.';
      return null;
    }
    if (!validarFormulario()) return null;

    const payload: PotreroPayload = {
      nombre: form.nombre.trim(),
      hectareas_de_extension: Number(form.hectareas_de_extension),
      capacidad_maxima: Number(form.capacidad_maxima),
      estado_pasto: form.estado_pasto.trim() || null,
      codigo_qr: form.codigo_qr.trim() || null,
    };

    guardando.value = true;
    try {
      const resultado =
        editandoId.value !== null
          ? await potreroService.actualizar(editandoId.value, payload)
          : await potreroService.crear(payload);

      if (detalle.value && detalle.value.potrero_id === resultado.potrero_id) {
        detalle.value = resultado;
      }

      if (catalogosStore.cargados) {
        void catalogosStore.cargar(true);
      }

      return resultado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(errores) as CampoFormPotrero[]).forEach((campo) => {
            if (porCampo[campo]) errores[campo] = porCampo[campo];
          });
          errorGeneral.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocio.value = err.message;
        } else {
          errorGeneral.value = err.message;
        }
      } else {
        errorGeneral.value = mensajeDeError(err, 'No se pudo guardar el potrero.');
      }
      return null;
    } finally {
      guardando.value = false;
    }
  }

  async function eliminar(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!esAdmin()) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar potreros.' };
    }

    eliminandoId.value = id;
    try {
      await potreroService.eliminar(id);
      items.value = items.value.filter((p) => p.potrero_id !== id);
      total.value = Math.max(0, total.value - 1);
      if (detalle.value?.potrero_id === id) {
        detalle.value = null;
      }
      if (catalogosStore.cargados) {
        void catalogosStore.cargar(true);
      }
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Potrero eliminado correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return {
          ok: false,
          esReglaDeNegocio: err.esReglaDeNegocio,
          mensaje: err.message,
        };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar el potrero.'),
      };
    } finally {
      eliminandoId.value = null;
    }
  }

  // ---------------- 3. Detalle y Animales Asignados ----------------
  const detalle = ref<Potrero | null>(null);
  const cargandoDetalle = ref<boolean>(false);
  const errorDetalle = ref<boolean>(false);
  const mensajeErrorDetalle = ref<string>('');
  const detalleDesdeCache = ref<boolean>(false);
  const detalleUltimaActualizacion = ref<string | null>(null);

  const mostrandoAvisoOfflineDetalle = computed<boolean>(
    () => Boolean(detalle.value) && (detalleDesdeCache.value || !networkService.isOnline.value),
  );
  const detalleUltimaActualizacionTexto = computed<string>(() =>
    formatearMarcaDeTiempo(detalleUltimaActualizacion.value),
  );

  const animalesPotrero = ref<AnimalItem[]>([]);
  const animalesMeta = ref<ApiMeta | null>(null);
  const animalesLinks = ref<ApiLinks | null>(null);
  const cargandoAnimales = ref<boolean>(false);
  const cargandoMasAnimales = ref<boolean>(false);
  const errorAnimales = ref<boolean>(false);
  const mensajeErrorAnimales = ref<string>('');
  const animalesPotreroId = ref<string | null>(null);

  const hayMasAnimales = computed<boolean>(() => {
    if (!animalesMeta.value) return false;
    return animalesMeta.value.current_page < animalesMeta.value.last_page;
  });

  /**
   * Ocupación real del potrero calculada con `meta.total / capacidad_maxima`
   * (ya que `PotreroResource` no incluye contador de ocupación).
   */
  const ocupacion = computed<ResumenOcupacionPotrero>(() => {
    const ocupados = animalesMeta.value?.total ?? animalesPotrero.value.length;
    const capacidad = detalle.value?.capacidad_maxima ?? 0;
    const disponibles = Math.max(0, capacidad - ocupados);

    if (capacidad <= 0) {
      const porcentaje = ocupados > 0 ? 100 : 0;
      return {
        ocupados,
        capacidad,
        disponibles: 0,
        porcentajeBarra: porcentaje,
        porcentajeReal: porcentaje,
        nivel: ocupados > 0 ? 'danger' : 'normal',
      };
    }

    const porcentajeReal = Math.round((ocupados / capacidad) * 100);
    const porcentajeBarra = Math.min(100, Math.max(0, porcentajeReal));
    let nivel: ResumenOcupacionPotrero['nivel'] = 'normal';
    if (porcentajeReal >= 90 || ocupados >= capacidad) {
      nivel = 'danger';
    } else if (porcentajeReal >= 75) {
      nivel = 'warning';
    }

    return {
      ocupados,
      capacidad,
      disponibles,
      porcentajeBarra,
      porcentajeReal,
      nivel,
    };
  });

  async function cargarDetalle(id: number | string): Promise<void> {
    const idStr = String(id);
    if (animalesPotreroId.value && animalesPotreroId.value !== idStr) {
      animalesPotrero.value = [];
      animalesMeta.value = null;
      animalesLinks.value = null;
      animalesPotreroId.value = null;
      errorAnimales.value = false;
      mensajeErrorAnimales.value = '';
    }

    cargandoDetalle.value = true;
    errorDetalle.value = false;
    mensajeErrorDetalle.value = '';

    try {
      const resultado = await potreroService.obtenerConCache(idStr);
      detalle.value = resultado.item;
      detalleDesdeCache.value = resultado.desdeCache;
      detalleUltimaActualizacion.value = resultado.ultimaActualizacion;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        detalle.value = null;
      } else {
        errorDetalle.value = true;
        mensajeErrorDetalle.value = mensajeDeError(err, 'No se pudo cargar el detalle del potrero.');
      }
    } finally {
      cargandoDetalle.value = false;
    }
  }

  async function cargarAnimalesPotrero(potreroId: number | string, pagina = 1, anexar = false): Promise<void> {
    const idStr = String(potreroId);
    if (!idStr) return;

    mensajeErrorAnimales.value = '';
    if (anexar) {
      cargandoMasAnimales.value = true;
    } else {
      cargandoAnimales.value = true;
      errorAnimales.value = false;
    }

    try {
      const respuesta = await potreroService.listarAnimales(idStr, {
        page: pagina,
        per_page: POR_PAGINA,
      });

      animalesPotrero.value = anexar ? [...animalesPotrero.value, ...respuesta.items] : respuesta.items;
      animalesMeta.value = respuesta.meta;
      animalesLinks.value = respuesta.links;
      animalesPotreroId.value = idStr;
    } catch (err) {
      if (anexar) {
        mensajeErrorAnimales.value = mensajeDeError(err, 'No se pudieron cargar más animales del potrero.');
      } else {
        errorAnimales.value = true;
        mensajeErrorAnimales.value = mensajeDeError(err, 'No se pudieron cargar los animales asignados.');
        animalesPotrero.value = [];
      }
    } finally {
      cargandoAnimales.value = false;
      cargandoMasAnimales.value = false;
    }
  }

  async function cargarMasAnimalesPotrero(potreroId: number | string): Promise<void> {
    if (!hayMasAnimales.value || cargandoMasAnimales.value || cargandoAnimales.value) return;
    const siguiente = (animalesMeta.value?.current_page ?? 1) + 1;
    await cargarAnimalesPotrero(potreroId, siguiente, true);
  }

  function marcarDetalleSinConexion(): void {
    if (detalle.value) detalleDesdeCache.value = true;
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
    cargar,
    recargar,
    cargarMas,
    buscar,
    establecerEstadoPasto,
    establecerOrden,
    limpiarFiltros,
    cancelarPendiente,
    marcarSinConexion,

    // Formulario CRUD (solo admin)
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

    // Detalle y animales asignados
    detalle,
    cargandoDetalle,
    errorDetalle,
    mensajeErrorDetalle,
    detalleDesdeCache,
    detalleUltimaActualizacion,
    mostrandoAvisoOfflineDetalle,
    detalleUltimaActualizacionTexto,
    animalesPotrero,
    animalesMeta,
    animalesLinks,
    cargandoAnimales,
    cargandoMasAnimales,
    errorAnimales,
    mensajeErrorAnimales,
    animalesPotreroId,
    hayMasAnimales,
    ocupacion,
    cargarDetalle,
    cargarAnimalesPotrero,
    cargarMasAnimalesPotrero,
    marcarDetalleSinConexion,
  };
});
