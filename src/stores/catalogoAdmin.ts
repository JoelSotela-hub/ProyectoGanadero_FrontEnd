/**
 * Store de Pinia para el Hub Administrativo de Catálogos (Fase 4 — Secciones 9, 10 y 11):
 *   - Segmento 1: Razas (`/api/v1/razas`) — RN-05 (409 si tiene animales asociados)
 *   - Segmento 2: Categorías (`/api/v1/categorias`) — RN-04 (409 si tiene insumos asociados)
 *   - Segmento 3: Unidades de Medida (`/api/v1/unidades-medida`) — RN-07 (409 si tiene insumos asociados)
 *
 * Seguridad por rol:
 *   - Exclusivo para `admin` (`meta.roles: ['admin']`).
 *   - Sincroniza `useCatalogosStore` inmediatamente tras crear, editar o eliminar en cualquiera
 *     de los 3 catálogos para mantener actualizados los selectores de Animales e Insumos.
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import {
  ApiError,
  categoriaService,
  formatearMarcaDeTiempo,
  mensajeDeError,
  networkService,
  razaService,
  sanitizarOrdenUnidadMedida,
  unidadMedidaService,
  type ApiLinks,
  type ApiMeta,
  type CampoOrdenCategoria,
  type CampoOrdenRaza,
  type CampoOrdenUnidadMedida,
  type Categoria,
  type CategoriaPayload,
  type Raza,
  type RazaPayload,
  type UnidadMedida,
  type UnidadMedidaPayload,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useCatalogosStore } from '@/stores/catalogos';

export type SegmentoCatalogo = 'razas' | 'categorias' | 'unidades';

export type CampoFormRaza = 'nombre';
export type CampoFormCategoria = 'nombre' | 'tipo';
export type CampoFormUnidad = 'nombre' | 'apertura';

export const OPCIONES_ORDEN_RAZA: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenRaza;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'raza_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'raza_id', order: 'asc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  { clave: 'created_at|desc', etiqueta: 'Más recientes primero', sort_by: 'created_at', order: 'desc' },
];

export const OPCIONES_ORDEN_CATEGORIA: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenCategoria;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'categoria_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'categoria_id', order: 'asc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  { clave: 'tipo|asc', etiqueta: 'Tipo (A–Z)', sort_by: 'tipo', order: 'asc' },
];

/**
 * Opciones de ordenamiento seguras para `UnidadMedida` (Sección 11.2).
 * Excluye explícitamente `abreviatura` para evitar el error SQL 500 del backend.
 */
export const OPCIONES_ORDEN_UNIDAD_MEDIDA: {
  clave: string;
  etiqueta: string;
  sort_by: CampoOrdenUnidadMedida;
  order: 'asc' | 'desc';
}[] = [
  { clave: 'unidad_medida_id|asc', etiqueta: 'Orden de registro (asc)', sort_by: 'unidad_medida_id', order: 'asc' },
  { clave: 'nombre|asc', etiqueta: 'Nombre (A–Z)', sort_by: 'nombre', order: 'asc' },
  { clave: 'nombre|desc', etiqueta: 'Nombre (Z–A)', sort_by: 'nombre', order: 'desc' },
  { clave: 'created_at|desc', etiqueta: 'Más recientes primero', sort_by: 'created_at', order: 'desc' },
];

const POR_PAGINA = 15;
const RETARDO_BUSQUEDA_MS = 300;

export const useCatalogoAdminStore = defineStore('catalogoAdmin', () => {
  const authStore = useAuthStore();
  const catalogosStore = useCatalogosStore();

  const esAdmin = computed<boolean>(() => (authStore.user?.role ?? '').toLowerCase() === 'admin');

  // ==================== 1. RAZAS ====================
  const razas = ref<Raza[]>([]);
  const filtrosRazas = ref<{ buscar: string; sort_by: CampoOrdenRaza; order: 'asc' | 'desc' }>({
    buscar: '',
    sort_by: 'raza_id',
    order: 'asc',
  });
  const loadingRazas = ref<boolean>(false);
  const cargandoMasRazas = ref<boolean>(false);
  const errorRazas = ref<boolean>(false);
  const mensajeErrorRazas = ref<string>('');
  const metaRazas = ref<ApiMeta | null>(null);
  const linksRazas = ref<ApiLinks | null>(null);
  const paginaRazas = ref<number>(1);
  const totalRazas = ref<number>(0);
  const hayMasRazas = ref<boolean>(false);
  const desdeCacheRazas = ref<boolean>(false);
  const ultimaActualizacionRazas = ref<string | null>(null);

  let ctrlRazas: AbortController | null = null;
  let timerRazas: ReturnType<typeof setTimeout> | null = null;

  const hayFiltrosRazas = computed<boolean>(() => Boolean(filtrosRazas.value.buscar.trim()));
  const claveOrdenRazas = computed<string>(() => `${filtrosRazas.value.sort_by}|${filtrosRazas.value.order}`);
  const mostrandoAvisoOfflineRazas = computed<boolean>(
    () => desdeCacheRazas.value || (!networkService.isOnline.value && razas.value.length > 0),
  );
  const ultimaActualizacionRazasTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacionRazas.value));

  async function cargarRazas(pagina = 1, anexar = false): Promise<void> {
    if (!esAdmin.value) return;

    ctrlRazas?.abort();
    const actual = new AbortController();
    ctrlRazas = actual;

    mensajeErrorRazas.value = '';
    if (anexar) {
      cargandoMasRazas.value = true;
    } else {
      loadingRazas.value = true;
      errorRazas.value = false;
    }

    try {
      const res = await razaService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        buscar: filtrosRazas.value.buscar.trim() || undefined,
        sort_by: filtrosRazas.value.sort_by,
        order: filtrosRazas.value.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      razas.value = anexar ? [...razas.value, ...res.data] : res.data;
      metaRazas.value = res.meta;
      linksRazas.value = res.links;
      paginaRazas.value = res.meta.current_page;
      totalRazas.value = res.meta.total;
      hayMasRazas.value = res.hayMas;
      desdeCacheRazas.value = res.desdeCache;
      ultimaActualizacionRazas.value = res.ultimaActualizacion ?? ultimaActualizacionRazas.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeErrorRazas.value = mensajeDeError(err, 'No se pudieron cargar más razas.');
      } else {
        errorRazas.value = true;
        mensajeErrorRazas.value = mensajeDeError(err, 'No se pudo obtener el catálogo de razas.');
        razas.value = [];
        hayMasRazas.value = false;
      }
    } finally {
      if (ctrlRazas === actual) {
        loadingRazas.value = false;
        cargandoMasRazas.value = false;
      }
    }
  }

  async function recargarRazas(): Promise<void> {
    await cargarRazas(1, false);
  }

  async function cargarMasRazas(): Promise<void> {
    if (!hayMasRazas.value || cargandoMasRazas.value || loadingRazas.value) return;
    await cargarRazas(paginaRazas.value + 1, true);
  }

  function buscarRazas(texto: string): void {
    filtrosRazas.value.buscar = texto;
    if (timerRazas) clearTimeout(timerRazas);
    timerRazas = setTimeout(() => {
      timerRazas = null;
      void recargarRazas();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerOrdenRazas(clave: string): void {
    const op = OPCIONES_ORDEN_RAZA.find((o) => o.clave === clave);
    if (!op) return;
    filtrosRazas.value.sort_by = op.sort_by;
    filtrosRazas.value.order = op.order;
    void recargarRazas();
  }

  function limpiarFiltrosRazas(): void {
    if (timerRazas) {
      clearTimeout(timerRazas);
      timerRazas = null;
    }
    filtrosRazas.value = { buscar: '', sort_by: 'raza_id', order: 'asc' };
    void recargarRazas();
  }

  // Formulario Raza
  const editandoRazaId = ref<number | null>(null);
  const esEdicionRaza = computed<boolean>(() => editandoRazaId.value !== null);
  const formRaza = reactive({ nombre: '' });
  const erroresRaza = reactive<Record<CampoFormRaza, string>>({ nombre: '' });
  const errorNegocioRaza = ref<string>('');
  const errorGeneralRaza = ref<string>('');
  const guardandoRaza = ref<boolean>(false);
  const eliminandoRazaId = ref<number | null>(null);

  function limpiarErroresRaza(): void {
    erroresRaza.nombre = '';
    errorNegocioRaza.value = '';
    errorGeneralRaza.value = '';
  }

  function prepararNuevaRaza(): void {
    editandoRazaId.value = null;
    formRaza.nombre = '';
    limpiarErroresRaza();
  }

  function prepararEdicionRaza(item: Raza): void {
    editandoRazaId.value = item.raza_id;
    formRaza.nombre = item.nombre;
    limpiarErroresRaza();
  }

  function validarFormularioRaza(): boolean {
    limpiarErroresRaza();
    const nombreLimpio = formRaza.nombre.trim();
    if (!nombreLimpio) {
      erroresRaza.nombre = 'El nombre de la raza es obligatorio.';
    } else if (nombreLimpio.length > 100) {
      erroresRaza.nombre = 'El nombre no puede superar los 100 caracteres.';
    }
    return !erroresRaza.nombre;
  }

  async function guardarRaza(): Promise<Raza | null> {
    if (!esAdmin.value) {
      errorGeneralRaza.value = 'No tienes permiso para gestionar razas.';
      return null;
    }
    if (!validarFormularioRaza()) return null;

    const payload: RazaPayload = { nombre: formRaza.nombre.trim() };
    guardandoRaza.value = true;
    try {
      const res =
        editandoRazaId.value !== null
          ? await razaService.actualizar(editandoRazaId.value, payload)
          : await razaService.crear(payload);

      await recargarRazas();
      await catalogosStore.sincronizar('razas');
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          if (porCampo.nombre) erroresRaza.nombre = porCampo.nombre;
          errorGeneralRaza.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioRaza.value = err.message;
        } else {
          errorGeneralRaza.value = err.message;
        }
      } else {
        errorGeneralRaza.value = mensajeDeError(err, 'No se pudo guardar la raza.');
      }
      return null;
    } finally {
      guardandoRaza.value = false;
    }
  }

  async function eliminarRaza(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!esAdmin.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar razas.' };
    }
    eliminandoRazaId.value = id;
    try {
      await razaService.eliminar(id);
      razas.value = razas.value.filter((r) => r.raza_id !== id);
      totalRazas.value = Math.max(0, totalRazas.value - 1);
      await catalogosStore.sincronizar('razas');
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Raza eliminada correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return { ok: false, esReglaDeNegocio: false, mensaje: mensajeDeError(err, 'No se pudo eliminar la raza.') };
    } finally {
      eliminandoRazaId.value = null;
    }
  }

  // ==================== 2. CATEGORÍAS ====================
  const categorias = ref<Categoria[]>([]);
  const filtrosCategorias = ref<{
    buscar: string;
    tipo: string;
    sort_by: CampoOrdenCategoria;
    order: 'asc' | 'desc';
  }>({
    buscar: '',
    tipo: '',
    sort_by: 'categoria_id',
    order: 'asc',
  });
  const loadingCategorias = ref<boolean>(false);
  const cargandoMasCategorias = ref<boolean>(false);
  const errorCategorias = ref<boolean>(false);
  const mensajeErrorCategorias = ref<string>('');
  const metaCategorias = ref<ApiMeta | null>(null);
  const linksCategorias = ref<ApiLinks | null>(null);
  const paginaCategorias = ref<number>(1);
  const totalCategorias = ref<number>(0);
  const hayMasCategorias = ref<boolean>(false);
  const desdeCacheCategorias = ref<boolean>(false);
  const ultimaActualizacionCategorias = ref<string | null>(null);

  let ctrlCategorias: AbortController | null = null;
  let timerCategorias: ReturnType<typeof setTimeout> | null = null;

  const hayFiltrosCategorias = computed<boolean>(() =>
    Boolean(filtrosCategorias.value.buscar.trim() || filtrosCategorias.value.tipo.trim()),
  );
  const claveOrdenCategorias = computed<string>(
    () => `${filtrosCategorias.value.sort_by}|${filtrosCategorias.value.order}`,
  );
  const mostrandoAvisoOfflineCategorias = computed<boolean>(
    () => desdeCacheCategorias.value || (!networkService.isOnline.value && categorias.value.length > 0),
  );
  const ultimaActualizacionCategoriasTexto = computed<string>(() =>
    formatearMarcaDeTiempo(ultimaActualizacionCategorias.value),
  );

  async function cargarCategorias(pagina = 1, anexar = false): Promise<void> {
    if (!esAdmin.value) return;

    ctrlCategorias?.abort();
    const actual = new AbortController();
    ctrlCategorias = actual;

    mensajeErrorCategorias.value = '';
    if (anexar) {
      cargandoMasCategorias.value = true;
    } else {
      loadingCategorias.value = true;
      errorCategorias.value = false;
    }

    try {
      const res = await categoriaService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        buscar: filtrosCategorias.value.buscar.trim() || undefined,
        tipo: filtrosCategorias.value.tipo.trim() || undefined,
        sort_by: filtrosCategorias.value.sort_by,
        order: filtrosCategorias.value.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      categorias.value = anexar ? [...categorias.value, ...res.data] : res.data;
      metaCategorias.value = res.meta;
      linksCategorias.value = res.links;
      paginaCategorias.value = res.meta.current_page;
      totalCategorias.value = res.meta.total;
      hayMasCategorias.value = res.hayMas;
      desdeCacheCategorias.value = res.desdeCache;
      ultimaActualizacionCategorias.value = res.ultimaActualizacion ?? ultimaActualizacionCategorias.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeErrorCategorias.value = mensajeDeError(err, 'No se pudieron cargar más categorías.');
      } else {
        errorCategorias.value = true;
        mensajeErrorCategorias.value = mensajeDeError(err, 'No se pudo obtener el catálogo de categorías.');
        categorias.value = [];
        hayMasCategorias.value = false;
      }
    } finally {
      if (ctrlCategorias === actual) {
        loadingCategorias.value = false;
        cargandoMasCategorias.value = false;
      }
    }
  }

  async function recargarCategorias(): Promise<void> {
    await cargarCategorias(1, false);
  }

  async function cargarMasCategorias(): Promise<void> {
    if (!hayMasCategorias.value || cargandoMasCategorias.value || loadingCategorias.value) return;
    await cargarCategorias(paginaCategorias.value + 1, true);
  }

  function buscarCategorias(texto: string): void {
    filtrosCategorias.value.buscar = texto;
    if (timerCategorias) clearTimeout(timerCategorias);
    timerCategorias = setTimeout(() => {
      timerCategorias = null;
      void recargarCategorias();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerTipoCategoria(valor: string): void {
    filtrosCategorias.value.tipo = valor;
    void recargarCategorias();
  }

  function establecerOrdenCategorias(clave: string): void {
    const op = OPCIONES_ORDEN_CATEGORIA.find((o) => o.clave === clave);
    if (!op) return;
    filtrosCategorias.value.sort_by = op.sort_by;
    filtrosCategorias.value.order = op.order;
    void recargarCategorias();
  }

  function limpiarFiltrosCategorias(): void {
    if (timerCategorias) {
      clearTimeout(timerCategorias);
      timerCategorias = null;
    }
    filtrosCategorias.value = { buscar: '', tipo: '', sort_by: 'categoria_id', order: 'asc' };
    void recargarCategorias();
  }

  // Formulario Categoría
  const editandoCategoriaId = ref<number | null>(null);
  const esEdicionCategoria = computed<boolean>(() => editandoCategoriaId.value !== null);
  const formCategoria = reactive({ nombre: '', tipo: '' });
  const erroresCategoria = reactive<Record<CampoFormCategoria, string>>({ nombre: '', tipo: '' });
  const errorNegocioCategoria = ref<string>('');
  const errorGeneralCategoria = ref<string>('');
  const guardandoCategoria = ref<boolean>(false);
  const eliminandoCategoriaId = ref<number | null>(null);

  function limpiarErroresCategoria(): void {
    erroresCategoria.nombre = '';
    erroresCategoria.tipo = '';
    errorNegocioCategoria.value = '';
    errorGeneralCategoria.value = '';
  }

  function prepararNuevaCategoria(): void {
    editandoCategoriaId.value = null;
    formCategoria.nombre = '';
    formCategoria.tipo = '';
    limpiarErroresCategoria();
  }

  function prepararEdicionCategoria(item: Categoria): void {
    editandoCategoriaId.value = item.categoria_id;
    formCategoria.nombre = item.nombre;
    formCategoria.tipo = item.tipo ?? '';
    limpiarErroresCategoria();
  }

  function validarFormularioCategoria(): boolean {
    limpiarErroresCategoria();
    const nombreLimpio = formCategoria.nombre.trim();
    if (!nombreLimpio) {
      erroresCategoria.nombre = 'El nombre de la categoría es obligatorio.';
    } else if (nombreLimpio.length > 100) {
      erroresCategoria.nombre = 'El nombre no puede superar los 100 caracteres.';
    }
    if (formCategoria.tipo.trim().length > 50) {
      erroresCategoria.tipo = 'El tipo no puede superar los 50 caracteres.';
    }
    return !erroresCategoria.nombre && !erroresCategoria.tipo;
  }

  async function guardarCategoria(): Promise<Categoria | null> {
    if (!esAdmin.value) {
      errorGeneralCategoria.value = 'No tienes permiso para gestionar categorías.';
      return null;
    }
    if (!validarFormularioCategoria()) return null;

    const payload: CategoriaPayload = {
      nombre: formCategoria.nombre.trim(),
      tipo: formCategoria.tipo.trim() || null,
    };
    guardandoCategoria.value = true;
    try {
      const res =
        editandoCategoriaId.value !== null
          ? await categoriaService.actualizar(editandoCategoriaId.value, payload)
          : await categoriaService.crear(payload);

      await recargarCategorias();
      await catalogosStore.sincronizar('categorias');
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          if (porCampo.nombre) erroresCategoria.nombre = porCampo.nombre;
          if (porCampo.tipo) erroresCategoria.tipo = porCampo.tipo;
          errorGeneralCategoria.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioCategoria.value = err.message;
        } else {
          errorGeneralCategoria.value = err.message;
        }
      } else {
        errorGeneralCategoria.value = mensajeDeError(err, 'No se pudo guardar la categoría.');
      }
      return null;
    } finally {
      guardandoCategoria.value = false;
    }
  }

  async function eliminarCategoria(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!esAdmin.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar categorías.' };
    }
    eliminandoCategoriaId.value = id;
    try {
      await categoriaService.eliminar(id);
      categorias.value = categorias.value.filter((c) => c.categoria_id !== id);
      totalCategorias.value = Math.max(0, totalCategorias.value - 1);
      await catalogosStore.sincronizar('categorias');
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Categoría eliminada correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return { ok: false, esReglaDeNegocio: false, mensaje: mensajeDeError(err, 'No se pudo eliminar la categoría.') };
    } finally {
      eliminandoCategoriaId.value = null;
    }
  }

  // ==================== 3. UNIDADES DE MEDIDA ====================
  const unidades = ref<UnidadMedida[]>([]);
  const filtrosUnidades = ref<{
    buscar: string;
    sort_by: CampoOrdenUnidadMedida;
    order: 'asc' | 'desc';
  }>({
    buscar: '',
    sort_by: 'unidad_medida_id',
    order: 'asc',
  });
  const loadingUnidades = ref<boolean>(false);
  const cargandoMasUnidades = ref<boolean>(false);
  const errorUnidades = ref<boolean>(false);
  const mensajeErrorUnidades = ref<string>('');
  const metaUnidades = ref<ApiMeta | null>(null);
  const linksUnidades = ref<ApiLinks | null>(null);
  const paginaUnidades = ref<number>(1);
  const totalUnidades = ref<number>(0);
  const hayMasUnidades = ref<boolean>(false);
  const desdeCacheUnidades = ref<boolean>(false);
  const ultimaActualizacionUnidades = ref<string | null>(null);

  let ctrlUnidades: AbortController | null = null;
  let timerUnidades: ReturnType<typeof setTimeout> | null = null;

  const hayFiltrosUnidades = computed<boolean>(() => Boolean(filtrosUnidades.value.buscar.trim()));
  const claveOrdenUnidades = computed<string>(() => `${filtrosUnidades.value.sort_by}|${filtrosUnidades.value.order}`);
  const mostrandoAvisoOfflineUnidades = computed<boolean>(
    () => desdeCacheUnidades.value || (!networkService.isOnline.value && unidades.value.length > 0),
  );
  const ultimaActualizacionUnidadesTexto = computed<string>(() =>
    formatearMarcaDeTiempo(ultimaActualizacionUnidades.value),
  );

  async function cargarUnidades(pagina = 1, anexar = false): Promise<void> {
    if (!esAdmin.value) return;

    ctrlUnidades?.abort();
    const actual = new AbortController();
    ctrlUnidades = actual;

    mensajeErrorUnidades.value = '';
    if (anexar) {
      cargandoMasUnidades.value = true;
    } else {
      loadingUnidades.value = true;
      errorUnidades.value = false;
    }

    try {
      const sortSeguro = sanitizarOrdenUnidadMedida(filtrosUnidades.value.sort_by);
      const res = await unidadMedidaService.listar({
        page: pagina,
        per_page: POR_PAGINA,
        buscar: filtrosUnidades.value.buscar.trim() || undefined,
        sort_by: sortSeguro,
        order: filtrosUnidades.value.order,
        signal: actual.signal,
      });

      if (actual.signal.aborted) return;

      unidades.value = anexar ? [...unidades.value, ...res.data] : res.data;
      metaUnidades.value = res.meta;
      linksUnidades.value = res.links;
      paginaUnidades.value = res.meta.current_page;
      totalUnidades.value = res.meta.total;
      hayMasUnidades.value = res.hayMas;
      desdeCacheUnidades.value = res.desdeCache;
      ultimaActualizacionUnidades.value = res.ultimaActualizacion ?? ultimaActualizacionUnidades.value;
    } catch (err) {
      if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
      if (anexar) {
        mensajeErrorUnidades.value = mensajeDeError(err, 'No se pudieron cargar más unidades de medida.');
      } else {
        errorUnidades.value = true;
        mensajeErrorUnidades.value = mensajeDeError(err, 'No se pudo obtener el catálogo de unidades de medida.');
        unidades.value = [];
        hayMasUnidades.value = false;
      }
    } finally {
      if (ctrlUnidades === actual) {
        loadingUnidades.value = false;
        cargandoMasUnidades.value = false;
      }
    }
  }

  async function recargarUnidades(): Promise<void> {
    await cargarUnidades(1, false);
  }

  async function cargarMasUnidades(): Promise<void> {
    if (!hayMasUnidades.value || cargandoMasUnidades.value || loadingUnidades.value) return;
    await cargarUnidades(paginaUnidades.value + 1, true);
  }

  function buscarUnidades(texto: string): void {
    filtrosUnidades.value.buscar = texto;
    if (timerUnidades) clearTimeout(timerUnidades);
    timerUnidades = setTimeout(() => {
      timerUnidades = null;
      void recargarUnidades();
    }, RETARDO_BUSQUEDA_MS);
  }

  function establecerOrdenUnidades(clave: string): void {
    const op = OPCIONES_ORDEN_UNIDAD_MEDIDA.find((o) => o.clave === clave);
    if (!op) return;
    filtrosUnidades.value.sort_by = sanitizarOrdenUnidadMedida(op.sort_by);
    filtrosUnidades.value.order = op.order;
    void recargarUnidades();
  }

  function limpiarFiltrosUnidades(): void {
    if (timerUnidades) {
      clearTimeout(timerUnidades);
      timerUnidades = null;
    }
    filtrosUnidades.value = { buscar: '', sort_by: 'unidad_medida_id', order: 'asc' };
    void recargarUnidades();
  }

  // Formulario Unidad de Medida (usa `apertura` según StoreUnidadMedidaRequest / UpdateUnidadMedidaRequest)
  const editandoUnidadId = ref<number | null>(null);
  const esEdicionUnidad = computed<boolean>(() => editandoUnidadId.value !== null);
  const formUnidad = reactive({ nombre: '', apertura: '' });
  const erroresUnidad = reactive<Record<CampoFormUnidad, string>>({ nombre: '', apertura: '' });
  const errorNegocioUnidad = ref<string>('');
  const errorGeneralUnidad = ref<string>('');
  const guardandoUnidad = ref<boolean>(false);
  const eliminandoUnidadId = ref<number | null>(null);

  function limpiarErroresUnidad(): void {
    erroresUnidad.nombre = '';
    erroresUnidad.apertura = '';
    errorNegocioUnidad.value = '';
    errorGeneralUnidad.value = '';
  }

  function prepararNuevaUnidad(): void {
    editandoUnidadId.value = null;
    formUnidad.nombre = '';
    formUnidad.apertura = '';
    limpiarErroresUnidad();
  }

  function prepararEdicionUnidad(item: UnidadMedida): void {
    editandoUnidadId.value = item.unidad_medida_id;
    formUnidad.nombre = item.nombre;
    formUnidad.apertura = item.apertura ?? item.abreviatura ?? '';
    limpiarErroresUnidad();
  }

  function validarFormularioUnidad(): boolean {
    limpiarErroresUnidad();
    const nombreLimpio = formUnidad.nombre.trim();
    if (!nombreLimpio) {
      erroresUnidad.nombre = 'El nombre de la unidad de medida es obligatorio.';
    } else if (nombreLimpio.length > 100) {
      erroresUnidad.nombre = 'El nombre no puede superar los 100 caracteres.';
    }
    if (formUnidad.apertura.trim().length > 20) {
      erroresUnidad.apertura = 'La abreviatura no puede superar los 20 caracteres.';
    }
    return !erroresUnidad.nombre && !erroresUnidad.apertura;
  }

  async function guardarUnidad(): Promise<UnidadMedida | null> {
    if (!esAdmin.value) {
      errorGeneralUnidad.value = 'No tienes permiso para gestionar unidades de medida.';
      return null;
    }
    if (!validarFormularioUnidad()) return null;

    const payload: UnidadMedidaPayload = {
      nombre: formUnidad.nombre.trim(),
      apertura: formUnidad.apertura.trim() || null,
    };
    guardandoUnidad.value = true;
    try {
      const res =
        editandoUnidadId.value !== null
          ? await unidadMedidaService.actualizar(editandoUnidadId.value, payload)
          : await unidadMedidaService.crear(payload);

      await recargarUnidades();
      await catalogosStore.sincronizar('unidades');
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          if (porCampo.nombre) erroresUnidad.nombre = porCampo.nombre;
          if (porCampo.apertura || porCampo.abreviatura) {
            erroresUnidad.apertura = porCampo.apertura ?? porCampo.abreviatura;
          }
          errorGeneralUnidad.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioUnidad.value = err.message;
        } else {
          errorGeneralUnidad.value = err.message;
        }
      } else {
        errorGeneralUnidad.value = mensajeDeError(err, 'No se pudo guardar la unidad de medida.');
      }
      return null;
    } finally {
      guardandoUnidad.value = false;
    }
  }

  async function eliminarUnidad(id: number): Promise<{ ok: boolean; esReglaDeNegocio: boolean; mensaje: string }> {
    if (!esAdmin.value) {
      return { ok: false, esReglaDeNegocio: false, mensaje: 'No tienes permiso para eliminar unidades de medida.' };
    }
    eliminandoUnidadId.value = id;
    try {
      await unidadMedidaService.eliminar(id);
      unidades.value = unidades.value.filter((u) => u.unidad_medida_id !== id);
      totalUnidades.value = Math.max(0, totalUnidades.value - 1);
      await catalogosStore.sincronizar('unidades');
      return { ok: true, esReglaDeNegocio: false, mensaje: 'Unidad de medida eliminada correctamente.' };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, esReglaDeNegocio: err.esReglaDeNegocio, mensaje: err.message };
      }
      return {
        ok: false,
        esReglaDeNegocio: false,
        mensaje: mensajeDeError(err, 'No se pudo eliminar la unidad de medida.'),
      };
    } finally {
      eliminandoUnidadId.value = null;
    }
  }

  // ==================== UTILIDADES TRANSVERSALES ====================
  function cancelarPendiente(): void {
    if (timerRazas) {
      clearTimeout(timerRazas);
      timerRazas = null;
    }
    if (timerCategorias) {
      clearTimeout(timerCategorias);
      timerCategorias = null;
    }
    if (timerUnidades) {
      clearTimeout(timerUnidades);
      timerUnidades = null;
    }
    ctrlRazas?.abort();
    ctrlRazas = null;
    ctrlCategorias?.abort();
    ctrlCategorias = null;
    ctrlUnidades?.abort();
    ctrlUnidades = null;
  }

  function marcarSinConexion(): void {
    if (razas.value.length > 0) desdeCacheRazas.value = true;
    if (categorias.value.length > 0) desdeCacheCategorias.value = true;
    if (unidades.value.length > 0) desdeCacheUnidades.value = true;
  }

  function limpiarEstado(): void {
    cancelarPendiente();

    razas.value = [];
    filtrosRazas.value = { buscar: '', sort_by: 'raza_id', order: 'asc' };
    metaRazas.value = null;
    linksRazas.value = null;
    paginaRazas.value = 1;
    totalRazas.value = 0;
    hayMasRazas.value = false;
    desdeCacheRazas.value = false;
    ultimaActualizacionRazas.value = null;

    categorias.value = [];
    filtrosCategorias.value = { buscar: '', tipo: '', sort_by: 'categoria_id', order: 'asc' };
    metaCategorias.value = null;
    linksCategorias.value = null;
    paginaCategorias.value = 1;
    totalCategorias.value = 0;
    hayMasCategorias.value = false;
    desdeCacheCategorias.value = false;
    ultimaActualizacionCategorias.value = null;

    unidades.value = [];
    filtrosUnidades.value = { buscar: '', sort_by: 'unidad_medida_id', order: 'asc' };
    metaUnidades.value = null;
    linksUnidades.value = null;
    paginaUnidades.value = 1;
    totalUnidades.value = 0;
    hayMasUnidades.value = false;
    desdeCacheUnidades.value = false;
    ultimaActualizacionUnidades.value = null;

    prepararNuevaRaza();
    prepararNuevaCategoria();
    prepararNuevaUnidad();
  }

  return {
    esAdmin,
    cancelarPendiente,
    marcarSinConexion,
    limpiarEstado,

    // Segmento 1: Razas
    razas,
    filtrosRazas,
    loadingRazas,
    cargandoMasRazas,
    errorRazas,
    mensajeErrorRazas,
    metaRazas,
    linksRazas,
    paginaRazas,
    totalRazas,
    hayMasRazas,
    desdeCacheRazas,
    ultimaActualizacionRazas,
    hayFiltrosRazas,
    claveOrdenRazas,
    mostrandoAvisoOfflineRazas,
    ultimaActualizacionRazasTexto,
    cargarRazas,
    recargarRazas,
    cargarMasRazas,
    buscarRazas,
    establecerOrdenRazas,
    limpiarFiltrosRazas,
    editandoRazaId,
    esEdicionRaza,
    formRaza,
    erroresRaza,
    errorNegocioRaza,
    errorGeneralRaza,
    guardandoRaza,
    eliminandoRazaId,
    limpiarErroresRaza,
    prepararNuevaRaza,
    prepararEdicionRaza,
    validarFormularioRaza,
    guardarRaza,
    eliminarRaza,

    // Segmento 2: Categorías
    categorias,
    filtrosCategorias,
    loadingCategorias,
    cargandoMasCategorias,
    errorCategorias,
    mensajeErrorCategorias,
    metaCategorias,
    linksCategorias,
    paginaCategorias,
    totalCategorias,
    hayMasCategorias,
    desdeCacheCategorias,
    ultimaActualizacionCategorias,
    hayFiltrosCategorias,
    claveOrdenCategorias,
    mostrandoAvisoOfflineCategorias,
    ultimaActualizacionCategoriasTexto,
    cargarCategorias,
    recargarCategorias,
    cargarMasCategorias,
    buscarCategorias,
    establecerTipoCategoria,
    establecerOrdenCategorias,
    limpiarFiltrosCategorias,
    editandoCategoriaId,
    esEdicionCategoria,
    formCategoria,
    erroresCategoria,
    errorNegocioCategoria,
    errorGeneralCategoria,
    guardandoCategoria,
    eliminandoCategoriaId,
    limpiarErroresCategoria,
    prepararNuevaCategoria,
    prepararEdicionCategoria,
    validarFormularioCategoria,
    guardarCategoria,
    eliminarCategoria,

    // Segmento 3: Unidades de Medida
    unidades,
    filtrosUnidades,
    loadingUnidades,
    cargandoMasUnidades,
    errorUnidades,
    mensajeErrorUnidades,
    metaUnidades,
    linksUnidades,
    paginaUnidades,
    totalUnidades,
    hayMasUnidades,
    desdeCacheUnidades,
    ultimaActualizacionUnidades,
    hayFiltrosUnidades,
    claveOrdenUnidades,
    mostrandoAvisoOfflineUnidades,
    ultimaActualizacionUnidadesTexto,
    cargarUnidades,
    recargarUnidades,
    cargarMasUnidades,
    buscarUnidades,
    establecerOrdenUnidades,
    limpiarFiltrosUnidades,
    editandoUnidadId,
    esEdicionUnidad,
    formUnidad,
    erroresUnidad,
    errorNegocioUnidad,
    errorGeneralUnidad,
    guardandoUnidad,
    eliminandoUnidadId,
    limpiarErroresUnidad,
    prepararNuevaUnidad,
    prepararEdicionUnidad,
    validarFormularioUnidad,
    guardarUnidad,
    eliminarUnidad,
  };
});
