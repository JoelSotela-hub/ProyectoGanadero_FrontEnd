import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import {
  ApiError,
  formatearMarcaDeTiempo,
  insumoService,
  mensajeDeError,
  networkService,
  type ApiLinks,
  type ApiMeta,
  type CampoOrdenInsumo,
  type Categoria,
  type Insumo,
  type InsumoPayload,
  type UnidadMedida,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useCatalogosStore } from '@/stores/catalogos';

export interface FiltrosListadoInsumos {
  buscar: string;
  categoria_id: string;
  unidad_medida_id: string;
  precio_min: string;
  precio_max: string;
  sort_by: CampoOrdenInsumo;
  order: 'asc' | 'desc';
}

export type CampoFormInsumo = 'nombre' | 'categoria_id' | 'precio' | 'unidad_medida_id';

export const OPCIONES_ORDEN_INSUMO: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenInsumo;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'insumo_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'insumo_id', order: 'asc' },
  { clave: 'insumo_id|desc', etiqueta: 'Más recientes primero', sort_by: 'insumo_id', order: 'desc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  { clave: 'precio|desc', etiqueta: 'Precio (mayor a menor)', sort_by: 'precio', order: 'desc' },
  { clave: 'precio|asc', etiqueta: 'Precio (menor a mayor)', sort_by: 'precio', order: 'asc' },
  { clave: 'categoria_id|asc', etiqueta: 'Categoría (ascendente)', sort_by: 'categoria_id', order: 'asc' },
];

const POR_PAGINA = 15;
const RETARDO_FILTRO_MS = 300;

function filtrosIniciales(): FiltrosListadoInsumos {
  return {
    buscar: '',
    categoria_id: '',
    unidad_medida_id: '',
    precio_min: '',
    precio_max: '',
    sort_by: 'insumo_id',
    order: 'asc',
  };
}

export const useInsumoStore = defineStore('insumo', () => {
  const authStore = useAuthStore();
  const catalogosStore = useCatalogosStore();

  const rolActual = computed<string>(() => (authStore.user?.role ?? '').toLowerCase());
  const puedeVer = computed<boolean>(() => rolActual.value === 'admin' || rolActual.value === 'veterinario');
  const puedeGestionar = computed<boolean>(() => rolActual.value === 'admin');

  const categorias = computed<Categoria[]>(() => catalogosStore.categorias);
  const unidadesMedida = computed<UnidadMedida[]>(() => catalogosStore.unidadesMedida);

  async function cargarSelectores(forzar = false): Promise<void> {
    if (!puedeVer.value) return;
    await catalogosStore.cargarCatalogosInsumos(forzar);
  }

  const items = ref<Insumo[]>([]);
  const filtros = ref<FiltrosListadoInsumos>(filtrosIniciales());

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

  const hayFiltrosActivos = computed<boolean>(() =>
    Boolean(
      filtros.value.buscar.trim() ||
      filtros.value.categoria_id ||
      filtros.value.unidad_medida_id ||
      filtros.value.precio_min.trim() ||
      filtros.value.precio_max.trim(),
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

  async function cargar(pagina = 1, anexar = false): Promise<void> {
    if (!puedeVer.value) return;

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
    const precioMinNum = f.precio_min.trim() !== '' ? Number(f.precio_min) : undefined;
    const precioMaxNum = f.precio_max.trim() !== '' ? Number(f.precio_max) : undefined;

    try {
      const resultado = await insumoService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        buscar: f.buscar.trim() || undefined,
        categoria_id: f.categoria_id || undefined,
        unidad_medida_id: f.unidad_medida_id || undefined,
        precio_min: precioMinNum !== undefined && Number.isFinite(precioMinNum) ? precioMinNum : undefined,
        precio_max: precioMaxNum !== undefined && Number.isFinite(precioMaxNum) ? precioMaxNum : undefined,
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
        mensajeError.value = mensajeDeError(err, 'No se pudieron cargar más insumos.');
      } else {
        error.value = true;
        mensajeError.value = mensajeDeError(err, 'No se pudo obtener el listado de insumos.');
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
    filtros.value.buscar = texto;
    programarRecarga();
  }

  function establecerCategoria(valor: string): void {
    filtros.value.categoria_id = valor;
    void recargar();
  }

  function establecerUnidadMedida(valor: string): void {
    filtros.value.unidad_medida_id = valor;
    void recargar();
  }

  function establecerPrecioMin(valor: string): void {
    filtros.value.precio_min = valor;
    programarRecarga();
  }

  function establecerPrecioMax(valor: string): void {
    filtros.value.precio_max = valor;
    programarRecarga();
  }

  function establecerOrden(clave: string): void {
    const opcion = OPCIONES_ORDEN_INSUMO.find((o) => o.clave === clave);
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

  const editandoId = ref<number | null>(null);
  const esEdicion = computed<boolean>(() => editandoId.value !== null);

  const form = reactive({
    nombre: '',
    categoria_id: '',
    precio: '',
    unidad_medida_id: '',
  });

  const errores = reactive<Record<CampoFormInsumo, string>>({
    nombre: '',
    categoria_id: '',
    precio: '',
    unidad_medida_id: '',
  });

  const errorNegocio = ref<string>('');
  const errorGeneral = ref<string>('');
  const guardando = ref<boolean>(false);
  const eliminandoId = ref<number | null>(null);

  function limpiarErroresFormulario(): void {
    errores.nombre = '';
    errores.categoria_id = '';
    errores.precio = '';
    errores.unidad_medida_id = '';
    errorNegocio.value = '';
    errorGeneral.value = '';
  }

  function prepararNuevo(): void {
    editandoId.value = null;
    form.nombre = '';
    form.categoria_id = filtros.value.categoria_id || '';
    form.precio = '';
    form.unidad_medida_id = filtros.value.unidad_medida_id || '';
    limpiarErroresFormulario();
  }

  function prepararEdicion(insumo: Insumo): void {
    editandoId.value = insumo.insumo_id;
    form.nombre = insumo.nombre;
    form.categoria_id = String(insumo.categoria_id);
    form.precio = String(insumo.precio);
    form.unidad_medida_id = String(insumo.unidad_medida_id);
    limpiarErroresFormulario();
  }

  function validarFormulario(): boolean {
    limpiarErroresFormulario();

    const nombreLimpio = form.nombre.trim();
    if (!nombreLimpio) {
      errores.nombre = 'El nombre del insumo es obligatorio.';
    } else if (nombreLimpio.length > 150) {
      errores.nombre = 'El nombre no puede superar los 150 caracteres.';
    }

    const catNum = Number(form.categoria_id);
    if (!form.categoria_id || !Number.isInteger(catNum) || catNum <= 0) {
      errores.categoria_id = 'Selecciona una categoría válida.';
    }

    const textoPrecio = String(form.precio ?? '').trim();
    const precioNum = Number(textoPrecio);
    if (!textoPrecio) {
      errores.precio = 'El precio del insumo es obligatorio.';
    } else if (!Number.isFinite(precioNum) || precioNum < 0 || precioNum > 99999999.99) {
      errores.precio = 'Ingresa un precio válido mayor o igual a 0.';
    }

    const unidadNum = Number(form.unidad_medida_id);
    if (!form.unidad_medida_id || !Number.isInteger(unidadNum) || unidadNum <= 0) {
      errores.unidad_medida_id = 'Selecciona una unidad de medida válida.';
    }

    return !errores.nombre && !errores.categoria_id && !errores.precio && !errores.unidad_medida_id;
  }

  async function guardar(): Promise<Insumo | null> {
    if (!puedeGestionar.value) {
      errorGeneral.value = 'No tienes permiso para crear o editar insumos.';
      return null;
    }
    if (!validarFormulario()) return null;

    const payload: InsumoPayload = {
      nombre: form.nombre.trim(),
      categoria_id: Number(form.categoria_id),
      precio: Number(form.precio),
      unidad_medida_id: Number(form.unidad_medida_id),
    };

    guardando.value = true;
    try {
      const resultado =
        editandoId.value !== null
          ? await insumoService.actualizar(editandoId.value, payload)
          : await insumoService.crear(payload);

      await recargar();
      return resultado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(errores) as CampoFormInsumo[]).forEach((campo) => {
            if (porCampo[campo]) errores[campo] = porCampo[campo];
          });
          errorGeneral.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocio.value = err.message;
        } else {
          errorGeneral.value = err.message;
        }
      } else {
        errorGeneral.value = mensajeDeError(err, 'No se pudo guardar el insumo.');
      }
      return null;
    } finally {
      guardando.value = false;
    }
  }

  async function eliminar(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!puedeGestionar.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar insumos.' };
    }

    eliminandoId.value = id;
    try {
      await insumoService.eliminar(id);
      items.value = items.value.filter((i) => i.insumo_id !== id);
      total.value = Math.max(0, total.value - 1);
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Insumo eliminado correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar el insumo.'),
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
    prepararNuevo();
  }

  return {
    puedeVer,
    puedeGestionar,
    categorias,
    unidadesMedida,
    cargarSelectores,

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
    establecerCategoria,
    establecerUnidadMedida,
    establecerPrecioMin,
    establecerPrecioMax,
    establecerOrden,
    limpiarFiltros,
    cancelarPendiente,
    marcarSinConexion,
    limpiarEstado,

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
