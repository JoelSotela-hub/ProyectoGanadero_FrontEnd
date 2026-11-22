/**
 * Store de Pinia para el módulo de Tratamientos (Fase 3):
 *   - Segmento 1: Aplicaciones (`/api/v1/tratamientos-aplicaciones`)
 *   - Segmento 2: Catálogo de Tratamientos (`/api/v1/tratamientos`)
 *
 * Seguridad por rol:
 *   - Módulo bloqueado para `operario` (evita 403 en backend).
 *   - `admin` y `veterinario` ven, crean y editan aplicaciones y catálogo.
 *   - Solo `admin` elimina aplicaciones y tratamientos del catálogo (409 RN-06).
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
  tratamientoService,
  type ApiLinks,
  type ApiMeta,
  type CampoOrdenAplicacion,
  type CampoOrdenCatalogoTratamiento,
  type NuevaAplicacionTratamiento,
  type TratamientoAplicacion,
  type TratamientoCatalogo,
  type TratamientoCatalogoPayload,
} from '@/services';
import { useAuthStore } from '@/stores/auth';

export type SegmentoTratamientos = 'aplicaciones' | 'catalogo';

export interface FiltrosListadoAplicaciones {
  id_animal: string;
  tratamiento_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  sort_by: CampoOrdenAplicacion;
  order: 'asc' | 'desc';
}

export interface FiltrosListadoCatalogo {
  buscar: string;
  tipo: string;
  sort_by: CampoOrdenCatalogoTratamiento;
  order: 'asc' | 'desc';
}

export type CampoFormAplicacion = 'id_animal' | 'tratamiento_id' | 'fecha_aplicacion' | 'dosis_ml' | 'observaciones';
export type CampoFormCatalogo = 'nombre' | 'tipo' | 'descripcion';

export const OPCIONES_ORDEN_APLICACION: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenAplicacion;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'fecha_aplicacion|desc', etiqueta: 'Fecha (más recientes)', sort_by: 'fecha_aplicacion', order: 'desc' },
  { clave: 'fecha_aplicacion|asc', etiqueta: 'Fecha (más antiguas)', sort_by: 'fecha_aplicacion', order: 'asc' },
  { clave: 'dosis_ml|desc', etiqueta: 'Dosis (mayor a menor)', sort_by: 'dosis_ml', order: 'desc' },
  { clave: 'dosis_ml|asc', etiqueta: 'Dosis (menor a mayor)', sort_by: 'dosis_ml', order: 'asc' },
  {
    clave: 'tratamiento_animal_id|desc',
    etiqueta: 'ID (descendente)',
    sort_by: 'tratamiento_animal_id',
    order: 'desc',
  },
  { clave: 'id_animal|asc', etiqueta: 'Animal (ascendente)', sort_by: 'id_animal', order: 'asc' },
  { clave: 'tratamiento_id|asc', etiqueta: 'Tratamiento (ascendente)', sort_by: 'tratamiento_id', order: 'asc' },
];

export const OPCIONES_ORDEN_CATALOGO: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenCatalogoTratamiento;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'tratamiento_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'tratamiento_id', order: 'asc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  { clave: 'tipo|asc', etiqueta: 'Tipo (A–Z)', sort_by: 'tipo', order: 'asc' },
  { clave: 'created_at|desc', etiqueta: 'Más recientes primero', sort_by: 'created_at', order: 'desc' },
];

const POR_PAGINA = 15;
const RETARDO_BUSQUEDA_MS = 300;

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function extraerFechaInput(valor: string | null | undefined): string {
  if (!valor) return hoyIso();
  const match = valor.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : hoyIso();
}

function filtrosAplicacionesIniciales(): FiltrosListadoAplicaciones {
  return {
    id_animal: '',
    tratamiento_id: '',
    fecha_desde: '',
    fecha_hasta: '',
    sort_by: 'fecha_aplicacion',
    order: 'desc',
  };
}

function filtrosCatalogoIniciales(): FiltrosListadoCatalogo {
  return {
    buscar: '',
    tipo: '',
    sort_by: 'tratamiento_id',
    order: 'asc',
  };
}

export const useTratamientoStore = defineStore('tratamiento', () => {
  const authStore = useAuthStore();

  const rolActual = computed<string>(() => (authStore.user?.role ?? '').toLowerCase());
  const puedeGestionar = computed<boolean>(() => rolActual.value === 'admin' || rolActual.value === 'veterinario');
  const puedeEliminar = computed<boolean>(() => rolActual.value === 'admin');

  // ---------------- Selectores compartidos ----------------
  const animales = ref<AnimalItem[]>([]);
  const cargandoAnimales = ref<boolean>(false);
  const animalesCargados = ref<boolean>(false);

  const catalogoOpciones = ref<TratamientoCatalogo[]>([]);
  const cargandoCatalogoOpciones = ref<boolean>(false);
  const catalogoOpcionesCargado = ref<boolean>(false);

  async function cargarSelectores(forzar = false): Promise<void> {
    const tareas: Promise<void>[] = [];

    if (!animalesCargados.value || forzar) {
      tareas.push(
        (async () => {
          cargandoAnimales.value = true;
          try {
            const res = await animalService.listar({ page: 1, per_page: 100 });
            animales.value = res.items;
            animalesCargados.value = true;
          } catch {
            // Reintentar en la siguiente apertura
          } finally {
            cargandoAnimales.value = false;
          }
        })(),
      );
    }

    if (!catalogoOpcionesCargado.value || forzar) {
      tareas.push(
        (async () => {
          cargandoCatalogoOpciones.value = true;
          try {
            const res = await tratamientoService.listarCatalogo({ page: 1, per_page: 100 });
            catalogoOpciones.value = res.data;
            catalogoOpcionesCargado.value = true;
          } catch {
            // Reintentar en la siguiente apertura
          } finally {
            cargandoCatalogoOpciones.value = false;
          }
        })(),
      );
    }

    await Promise.all(tareas);
  }

  // ---------------- Segmento 1: Aplicaciones ----------------
  const aplicaciones = ref<TratamientoAplicacion[]>([]);
  const filtrosAplicaciones = ref<FiltrosListadoAplicaciones>(filtrosAplicacionesIniciales());
  const loadingAplicaciones = ref<boolean>(false);
  const cargandoMasAplicaciones = ref<boolean>(false);
  const errorAplicaciones = ref<boolean>(false);
  const mensajeErrorAplicaciones = ref<string>('');
  const metaAplicaciones = ref<ApiMeta | null>(null);
  const linksAplicaciones = ref<ApiLinks | null>(null);
  const paginaAplicaciones = ref<number>(1);
  const totalAplicaciones = ref<number>(0);
  const hayMasAplicaciones = ref<boolean>(false);
  const desdeCacheAplicaciones = ref<boolean>(false);
  const ultimaActualizacionAplicaciones = ref<string | null>(null);

  let controladorAplicaciones: AbortController | null = null;

  const hayFiltrosAplicaciones = computed<boolean>(() =>
    Boolean(
      filtrosAplicaciones.value.id_animal ||
      filtrosAplicaciones.value.tratamiento_id ||
      filtrosAplicaciones.value.fecha_desde ||
      filtrosAplicaciones.value.fecha_hasta,
    ),
  );

  const claveOrdenAplicaciones = computed<string>(
    () => `${filtrosAplicaciones.value.sort_by}|${filtrosAplicaciones.value.order}`,
  );

  const mostrandoAvisoOfflineAplicaciones = computed<boolean>(
    () => desdeCacheAplicaciones.value || (!networkService.isOnline.value && aplicaciones.value.length > 0),
  );

  const ultimaActualizacionAplicacionesTexto = computed<string>(() =>
    formatearMarcaDeTiempo(ultimaActualizacionAplicaciones.value),
  );

  async function cargarAplicaciones(pagina = 1, anexar = false): Promise<void> {
    if (!puedeGestionar.value) return;

    controladorAplicaciones?.abort();
    const actual = new AbortController();
    controladorAplicaciones = actual;

    mensajeErrorAplicaciones.value = '';
    if (anexar) {
      cargandoMasAplicaciones.value = true;
    } else {
      loadingAplicaciones.value = true;
      errorAplicaciones.value = false;
    }

    const f = filtrosAplicaciones.value;
    try {
      const resultado = await tratamientoService.listarAplicaciones({
        page: pagina,
        per_page: POR_PAGINA,
        id_animal: f.id_animal || undefined,
        tratamiento_id: f.tratamiento_id || undefined,
        fecha_desde: f.fecha_desde || undefined,
        fecha_hasta: f.fecha_hasta || undefined,
        sort_by: f.sort_by,
        order: f.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      aplicaciones.value = anexar ? [...aplicaciones.value, ...resultado.data] : resultado.data;
      metaAplicaciones.value = resultado.meta;
      linksAplicaciones.value = resultado.links;
      paginaAplicaciones.value = resultado.meta.current_page;
      totalAplicaciones.value = resultado.meta.total;
      hayMasAplicaciones.value = resultado.hayMas;
      desdeCacheAplicaciones.value = resultado.desdeCache;
      ultimaActualizacionAplicaciones.value = resultado.ultimaActualizacion ?? ultimaActualizacionAplicaciones.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeErrorAplicaciones.value = mensajeDeError(err, 'No se pudieron cargar más aplicaciones.');
      } else {
        errorAplicaciones.value = true;
        mensajeErrorAplicaciones.value = mensajeDeError(err, 'No se pudo obtener el listado de aplicaciones.');
        aplicaciones.value = [];
        hayMasAplicaciones.value = false;
      }
    } finally {
      if (controladorAplicaciones === actual) {
        loadingAplicaciones.value = false;
        cargandoMasAplicaciones.value = false;
      }
    }
  }

  async function recargarAplicaciones(): Promise<void> {
    await cargarAplicaciones(1, false);
  }

  async function cargarMasAplicaciones(): Promise<void> {
    if (!hayMasAplicaciones.value || cargandoMasAplicaciones.value || loadingAplicaciones.value) return;
    await cargarAplicaciones(paginaAplicaciones.value + 1, true);
  }

  function establecerAnimalFiltro(valor: string): void {
    filtrosAplicaciones.value.id_animal = valor;
    void recargarAplicaciones();
  }

  function establecerTratamientoFiltro(valor: string): void {
    filtrosAplicaciones.value.tratamiento_id = valor;
    void recargarAplicaciones();
  }

  function establecerFechaDesdeFiltro(valor: string): void {
    filtrosAplicaciones.value.fecha_desde = valor;
    void recargarAplicaciones();
  }

  function establecerFechaHastaFiltro(valor: string): void {
    filtrosAplicaciones.value.fecha_hasta = valor;
    void recargarAplicaciones();
  }

  function establecerOrdenAplicaciones(clave: string): void {
    const opcion = OPCIONES_ORDEN_APLICACION.find((o) => o.clave === clave);
    if (!opcion) return;
    filtrosAplicaciones.value.sort_by = opcion.sort_by;
    filtrosAplicaciones.value.order = opcion.order;
    void recargarAplicaciones();
  }

  function limpiarFiltrosAplicaciones(): void {
    filtrosAplicaciones.value = filtrosAplicacionesIniciales();
    void recargarAplicaciones();
  }

  // Formulario Aplicaciones (Crear / Editar)
  const editandoAplicacionId = ref<number | null>(null);
  const esEdicionAplicacion = computed<boolean>(() => editandoAplicacionId.value !== null);

  const formAplicacion = reactive({
    id_animal: '',
    tratamiento_id: '',
    fecha_aplicacion: hoyIso(),
    dosis_ml: '',
    observaciones: '',
  });

  const erroresAplicacion = reactive<Record<CampoFormAplicacion, string>>({
    id_animal: '',
    tratamiento_id: '',
    fecha_aplicacion: '',
    dosis_ml: '',
    observaciones: '',
  });

  const errorNegocioAplicacion = ref<string>('');
  const errorGeneralAplicacion = ref<string>('');
  const guardandoAplicacion = ref<boolean>(false);
  const eliminandoAplicacionId = ref<number | null>(null);

  function limpiarErroresAplicacion(): void {
    erroresAplicacion.id_animal = '';
    erroresAplicacion.tratamiento_id = '';
    erroresAplicacion.fecha_aplicacion = '';
    erroresAplicacion.dosis_ml = '';
    erroresAplicacion.observaciones = '';
    errorNegocioAplicacion.value = '';
    errorGeneralAplicacion.value = '';
  }

  function prepararNuevaAplicacion(): void {
    editandoAplicacionId.value = null;
    formAplicacion.id_animal = filtrosAplicaciones.value.id_animal || '';
    formAplicacion.tratamiento_id = filtrosAplicaciones.value.tratamiento_id || '';
    formAplicacion.fecha_aplicacion = hoyIso();
    formAplicacion.dosis_ml = '';
    formAplicacion.observaciones = '';
    limpiarErroresAplicacion();
  }

  function prepararEdicionAplicacion(item: TratamientoAplicacion): void {
    editandoAplicacionId.value = item.tratamiento_animal_id;
    formAplicacion.id_animal = String(item.id_animal);
    formAplicacion.tratamiento_id = String(item.tratamiento_id);
    formAplicacion.fecha_aplicacion = extraerFechaInput(item.fecha_aplicacion);
    formAplicacion.dosis_ml = String(item.dosis_ml);
    formAplicacion.observaciones = item.observaciones ?? '';
    limpiarErroresAplicacion();
  }

  function validarFormularioAplicacion(): boolean {
    limpiarErroresAplicacion();

    const idAnimalNum = Number(formAplicacion.id_animal);
    if (!formAplicacion.id_animal || !Number.isInteger(idAnimalNum) || idAnimalNum <= 0) {
      erroresAplicacion.id_animal = 'Selecciona un animal válido.';
    }

    const idTratNum = Number(formAplicacion.tratamiento_id);
    if (!formAplicacion.tratamiento_id || !Number.isInteger(idTratNum) || idTratNum <= 0) {
      erroresAplicacion.tratamiento_id = 'Selecciona un tratamiento del catálogo.';
    }

    if (!formAplicacion.fecha_aplicacion.trim()) {
      erroresAplicacion.fecha_aplicacion = 'La fecha de aplicación es obligatoria.';
    }

    const textoDosis = String(formAplicacion.dosis_ml ?? '').trim();
    const dosis = Number(textoDosis);
    if (!textoDosis) {
      erroresAplicacion.dosis_ml = 'La dosis en mililitros es obligatoria.';
    } else if (!Number.isFinite(dosis) || dosis < 0 || dosis > 9999.99) {
      erroresAplicacion.dosis_ml = 'Ingresa una dosis válida entre 0 y 9999.99 ml.';
    }

    return (
      !erroresAplicacion.id_animal &&
      !erroresAplicacion.tratamiento_id &&
      !erroresAplicacion.fecha_aplicacion &&
      !erroresAplicacion.dosis_ml &&
      !erroresAplicacion.observaciones
    );
  }

  async function guardarAplicacion(): Promise<TratamientoAplicacion | null> {
    if (!puedeGestionar.value) {
      errorGeneralAplicacion.value = 'No tienes permiso para gestionar aplicaciones sanitarias.';
      return null;
    }
    if (!validarFormularioAplicacion()) return null;

    const payload: NuevaAplicacionTratamiento = {
      id_animal: Number(formAplicacion.id_animal),
      tratamiento_id: Number(formAplicacion.tratamiento_id),
      fecha_aplicacion: formAplicacion.fecha_aplicacion,
      dosis_ml: Number(formAplicacion.dosis_ml),
      observaciones: formAplicacion.observaciones.trim() || null,
    };

    guardandoAplicacion.value = true;
    try {
      const resultado =
        editandoAplicacionId.value !== null
          ? await tratamientoService.actualizarAplicacion(editandoAplicacionId.value, payload)
          : await tratamientoService.aplicarTratamiento(payload);

      // Tras 201 Created, refresca el listado para mostrar `animal` y `tratamiento` anidados.
      await recargarAplicaciones();
      return resultado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(erroresAplicacion) as CampoFormAplicacion[]).forEach((campo) => {
            if (porCampo[campo]) erroresAplicacion[campo] = porCampo[campo];
          });
          errorGeneralAplicacion.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioAplicacion.value = err.message;
        } else {
          errorGeneralAplicacion.value = err.message;
        }
      } else {
        errorGeneralAplicacion.value = mensajeDeError(err, 'No se pudo guardar la aplicación.');
      }
      return null;
    } finally {
      guardandoAplicacion.value = false;
    }
  }

  async function eliminarAplicacion(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!puedeEliminar.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar aplicaciones.' };
    }

    eliminandoAplicacionId.value = id;
    try {
      await tratamientoService.eliminarAplicacion(id);
      aplicaciones.value = aplicaciones.value.filter((a) => a.tratamiento_animal_id !== id);
      totalAplicaciones.value = Math.max(0, totalAplicaciones.value - 1);
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Aplicación eliminada correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar la aplicación.'),
      };
    } finally {
      eliminandoAplicacionId.value = null;
    }
  }

  // ---------------- Segmento 2: Catálogo de Tratamientos ----------------
  const catalogo = ref<TratamientoCatalogo[]>([]);
  const filtrosCatalogo = ref<FiltrosListadoCatalogo>(filtrosCatalogoIniciales());
  const loadingCatalogo = ref<boolean>(false);
  const cargandoMasCatalogo = ref<boolean>(false);
  const errorCatalogo = ref<boolean>(false);
  const mensajeErrorCatalogo = ref<string>('');
  const metaCatalogo = ref<ApiMeta | null>(null);
  const linksCatalogo = ref<ApiLinks | null>(null);
  const paginaCatalogo = ref<number>(1);
  const totalCatalogo = ref<number>(0);
  const hayMasCatalogo = ref<boolean>(false);
  const desdeCacheCatalogo = ref<boolean>(false);
  const ultimaActualizacionCatalogo = ref<string | null>(null);

  let controladorCatalogo: AbortController | null = null;
  let temporizadorCatalogo: ReturnType<typeof setTimeout> | null = null;

  const hayFiltrosCatalogo = computed<boolean>(() =>
    Boolean(filtrosCatalogo.value.buscar.trim() || filtrosCatalogo.value.tipo.trim()),
  );

  const claveOrdenCatalogo = computed<string>(() => `${filtrosCatalogo.value.sort_by}|${filtrosCatalogo.value.order}`);

  const mostrandoAvisoOfflineCatalogo = computed<boolean>(
    () => desdeCacheCatalogo.value || (!networkService.isOnline.value && catalogo.value.length > 0),
  );

  const ultimaActualizacionCatalogoTexto = computed<string>(() =>
    formatearMarcaDeTiempo(ultimaActualizacionCatalogo.value),
  );

  function cancelarPendiente(): void {
    if (temporizadorCatalogo) {
      clearTimeout(temporizadorCatalogo);
      temporizadorCatalogo = null;
    }
    controladorAplicaciones?.abort();
    controladorAplicaciones = null;
    controladorCatalogo?.abort();
    controladorCatalogo = null;
  }

  async function cargarCatalogo(pagina = 1, anexar = false): Promise<void> {
    if (!puedeGestionar.value) return;

    controladorCatalogo?.abort();
    const actual = new AbortController();
    controladorCatalogo = actual;

    mensajeErrorCatalogo.value = '';
    if (anexar) {
      cargandoMasCatalogo.value = true;
    } else {
      loadingCatalogo.value = true;
      errorCatalogo.value = false;
    }

    const f = filtrosCatalogo.value;
    try {
      const resultado = await tratamientoService.listarCatalogo({
        page: pagina,
        per_page: POR_PAGINA,
        buscar: f.buscar.trim() || undefined,
        tipo: f.tipo.trim() || undefined,
        sort_by: f.sort_by,
        order: f.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      catalogo.value = anexar ? [...catalogo.value, ...resultado.data] : resultado.data;
      metaCatalogo.value = resultado.meta;
      linksCatalogo.value = resultado.links;
      paginaCatalogo.value = resultado.meta.current_page;
      totalCatalogo.value = resultado.meta.total;
      hayMasCatalogo.value = resultado.hayMas ?? resultado.meta.current_page < resultado.meta.last_page;
      desdeCacheCatalogo.value = resultado.desdeCache ?? false;
      ultimaActualizacionCatalogo.value = resultado.ultimaActualizacion ?? ultimaActualizacionCatalogo.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeErrorCatalogo.value = mensajeDeError(err, 'No se pudieron cargar más tratamientos.');
      } else {
        errorCatalogo.value = true;
        mensajeErrorCatalogo.value = mensajeDeError(err, 'No se pudo obtener el catálogo de tratamientos.');
        catalogo.value = [];
        hayMasCatalogo.value = false;
      }
    } finally {
      if (controladorCatalogo === actual) {
        loadingCatalogo.value = false;
        cargandoMasCatalogo.value = false;
      }
    }
  }

  async function recargarCatalogo(): Promise<void> {
    await cargarCatalogo(1, false);
  }

  async function cargarMasCatalogo(): Promise<void> {
    if (!hayMasCatalogo.value || cargandoMasCatalogo.value || loadingCatalogo.value) return;
    await cargarCatalogo(paginaCatalogo.value + 1, true);
  }

  function buscarCatalogo(texto: string): void {
    filtrosCatalogo.value.buscar = texto;
    if (temporizadorCatalogo) clearTimeout(temporizadorCatalogo);
    temporizadorCatalogo = setTimeout(() => {
      temporizadorCatalogo = null;
      void recargarCatalogo();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerTipoCatalogo(valor: string): void {
    filtrosCatalogo.value.tipo = valor;
    void recargarCatalogo();
  }

  function establecerOrdenCatalogo(clave: string): void {
    const opcion = OPCIONES_ORDEN_CATALOGO.find((o) => o.clave === clave);
    if (!opcion) return;
    filtrosCatalogo.value.sort_by = opcion.sort_by;
    filtrosCatalogo.value.order = opcion.order;
    void recargarCatalogo();
  }

  function limpiarFiltrosCatalogo(): void {
    if (temporizadorCatalogo) {
      clearTimeout(temporizadorCatalogo);
      temporizadorCatalogo = null;
    }
    filtrosCatalogo.value = filtrosCatalogoIniciales();
    void recargarCatalogo();
  }

  // Formulario Catálogo (Crear / Editar)
  const editandoCatalogoId = ref<number | null>(null);
  const esEdicionCatalogo = computed<boolean>(() => editandoCatalogoId.value !== null);

  const formCatalogo = reactive({
    nombre: '',
    tipo: '',
    descripcion: '',
  });

  const erroresCatalogo = reactive<Record<CampoFormCatalogo, string>>({
    nombre: '',
    tipo: '',
    descripcion: '',
  });

  const errorNegocioCatalogo = ref<string>('');
  const errorGeneralCatalogo = ref<string>('');
  const guardandoCatalogo = ref<boolean>(false);
  const eliminandoCatalogoId = ref<number | null>(null);

  function limpiarErroresCatalogo(): void {
    erroresCatalogo.nombre = '';
    erroresCatalogo.tipo = '';
    erroresCatalogo.descripcion = '';
    errorNegocioCatalogo.value = '';
    errorGeneralCatalogo.value = '';
  }

  function prepararNuevoCatalogo(): void {
    editandoCatalogoId.value = null;
    formCatalogo.nombre = '';
    formCatalogo.tipo = '';
    formCatalogo.descripcion = '';
    limpiarErroresCatalogo();
  }

  function prepararEdicionCatalogo(item: TratamientoCatalogo): void {
    editandoCatalogoId.value = item.tratamiento_id;
    formCatalogo.nombre = item.nombre;
    formCatalogo.tipo = item.tipo ?? '';
    formCatalogo.descripcion = item.descripcion ?? '';
    limpiarErroresCatalogo();
  }

  function validarFormularioCatalogo(): boolean {
    limpiarErroresCatalogo();

    const nombreLimpio = formCatalogo.nombre.trim();
    if (!nombreLimpio) {
      erroresCatalogo.nombre = 'El nombre del tratamiento es obligatorio.';
    } else if (nombreLimpio.length > 100) {
      erroresCatalogo.nombre = 'El nombre no puede superar los 100 caracteres.';
    }

    if (formCatalogo.tipo.trim().length > 50) {
      erroresCatalogo.tipo = 'El tipo no puede superar los 50 caracteres.';
    }

    return !erroresCatalogo.nombre && !erroresCatalogo.tipo && !erroresCatalogo.descripcion;
  }

  async function guardarCatalogo(): Promise<TratamientoCatalogo | null> {
    if (!puedeGestionar.value) {
      errorGeneralCatalogo.value = 'No tienes permiso para gestionar el catálogo de tratamientos.';
      return null;
    }
    if (!validarFormularioCatalogo()) return null;

    const payload: TratamientoCatalogoPayload = {
      nombre: formCatalogo.nombre.trim(),
      tipo: formCatalogo.tipo.trim() || null,
      descripcion: formCatalogo.descripcion.trim() || null,
    };

    guardandoCatalogo.value = true;
    try {
      const resultado =
        editandoCatalogoId.value !== null
          ? await tratamientoService.actualizarCatalogo(editandoCatalogoId.value, payload)
          : await tratamientoService.crearCatalogo(payload);

      await recargarCatalogo();
      catalogoOpcionesCargado.value = false;
      void cargarSelectores(true);
      return resultado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(erroresCatalogo) as CampoFormCatalogo[]).forEach((campo) => {
            if (porCampo[campo]) erroresCatalogo[campo] = porCampo[campo];
          });
          errorGeneralCatalogo.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioCatalogo.value = err.message;
        } else {
          errorGeneralCatalogo.value = err.message;
        }
      } else {
        errorGeneralCatalogo.value = mensajeDeError(err, 'No se pudo guardar el tratamiento.');
      }
      return null;
    } finally {
      guardandoCatalogo.value = false;
    }
  }

  async function eliminarCatalogo(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!puedeEliminar.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar tratamientos.' };
    }

    eliminandoCatalogoId.value = id;
    try {
      await tratamientoService.eliminarCatalogo(id);
      catalogo.value = catalogo.value.filter((t) => t.tratamiento_id !== id);
      totalCatalogo.value = Math.max(0, totalCatalogo.value - 1);
      catalogoOpciones.value = catalogoOpciones.value.filter((t) => t.tratamiento_id !== id);
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Tratamiento eliminado correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar el tratamiento.'),
      };
    } finally {
      eliminandoCatalogoId.value = null;
    }
  }

  function marcarSinConexion(): void {
    if (aplicaciones.value.length > 0) desdeCacheAplicaciones.value = true;
    if (catalogo.value.length > 0) desdeCacheCatalogo.value = true;
  }

  function limpiarEstado(): void {
    cancelarPendiente();
    aplicaciones.value = [];
    filtrosAplicaciones.value = filtrosAplicacionesIniciales();
    metaAplicaciones.value = null;
    linksAplicaciones.value = null;
    paginaAplicaciones.value = 1;
    totalAplicaciones.value = 0;
    hayMasAplicaciones.value = false;
    desdeCacheAplicaciones.value = false;
    ultimaActualizacionAplicaciones.value = null;

    catalogo.value = [];
    filtrosCatalogo.value = filtrosCatalogoIniciales();
    metaCatalogo.value = null;
    linksCatalogo.value = null;
    paginaCatalogo.value = 1;
    totalCatalogo.value = 0;
    hayMasCatalogo.value = false;
    desdeCacheCatalogo.value = false;
    ultimaActualizacionCatalogo.value = null;

    animales.value = [];
    animalesCargados.value = false;
    catalogoOpciones.value = [];
    catalogoOpcionesCargado.value = false;
    prepararNuevaAplicacion();
    prepararNuevoCatalogo();
  }

  return {
    puedeGestionar,
    puedeEliminar,
    animales,
    cargandoAnimales,
    catalogoOpciones,
    cargandoCatalogoOpciones,
    cargarSelectores,
    cancelarPendiente,
    marcarSinConexion,
    limpiarEstado,

    // Segmento 1: Aplicaciones
    aplicaciones,
    filtrosAplicaciones,
    loadingAplicaciones,
    cargandoMasAplicaciones,
    errorAplicaciones,
    mensajeErrorAplicaciones,
    metaAplicaciones,
    linksAplicaciones,
    paginaAplicaciones,
    totalAplicaciones,
    hayMasAplicaciones,
    desdeCacheAplicaciones,
    ultimaActualizacionAplicaciones,
    hayFiltrosAplicaciones,
    claveOrdenAplicaciones,
    mostrandoAvisoOfflineAplicaciones,
    ultimaActualizacionAplicacionesTexto,
    cargarAplicaciones,
    recargarAplicaciones,
    cargarMasAplicaciones,
    establecerAnimalFiltro,
    establecerTratamientoFiltro,
    establecerFechaDesdeFiltro,
    establecerFechaHastaFiltro,
    establecerOrdenAplicaciones,
    limpiarFiltrosAplicaciones,
    editandoAplicacionId,
    esEdicionAplicacion,
    formAplicacion,
    erroresAplicacion,
    errorNegocioAplicacion,
    errorGeneralAplicacion,
    guardandoAplicacion,
    eliminandoAplicacionId,
    limpiarErroresAplicacion,
    prepararNuevaAplicacion,
    prepararEdicionAplicacion,
    validarFormularioAplicacion,
    guardarAplicacion,
    eliminarAplicacion,

    // Segmento 2: Catálogo
    catalogo,
    filtrosCatalogo,
    loadingCatalogo,
    cargandoMasCatalogo,
    errorCatalogo,
    mensajeErrorCatalogo,
    metaCatalogo,
    linksCatalogo,
    paginaCatalogo,
    totalCatalogo,
    hayMasCatalogo,
    desdeCacheCatalogo,
    ultimaActualizacionCatalogo,
    hayFiltrosCatalogo,
    claveOrdenCatalogo,
    mostrandoAvisoOfflineCatalogo,
    ultimaActualizacionCatalogoTexto,
    cargarCatalogo,
    recargarCatalogo,
    cargarMasCatalogo,
    buscarCatalogo,
    establecerTipoCatalogo,
    establecerOrdenCatalogo,
    limpiarFiltrosCatalogo,
    editandoCatalogoId,
    esEdicionCatalogo,
    formCatalogo,
    erroresCatalogo,
    errorNegocioCatalogo,
    errorGeneralCatalogo,
    guardandoCatalogo,
    eliminandoCatalogoId,
    limpiarErroresCatalogo,
    prepararNuevoCatalogo,
    prepararEdicionCatalogo,
    validarFormularioCatalogo,
    guardarCatalogo,
    eliminarCatalogo,
  };
});
