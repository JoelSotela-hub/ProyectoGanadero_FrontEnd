/**
 * Servicio del módulo Insumo (Contrato API Sección 7).
 *
 *   GET    /api/v1/insumos?page=&per_page=&buscar=&categoria_id=&unidad_medida_id=&precio_min=&precio_max=&sort_by=&order=
 *   GET    /api/v1/insumos/{insumo}
 *   POST   /api/v1/insumos
 *   PUT    /api/v1/insumos/{insumo}
 *   DELETE /api/v1/insumos/{insumo}
 *   GET    /api/v1/categorias/{categoria}/insumos
 *
 * Nota del contrato:
 *   - `InsumoResource` NO tiene campo `stock` ni `cantidad`.
 *   - `store()` devuelve `201 Created` sin relaciones anidadas (`categoria`, `unidad_medida`),
 *     por lo que el store de Pinia refresca el listado tras crear o editar.
 */
import { crearCacheListado, listarConRespaldo, type ListadoPaginado } from './cacheListado';
import {
  mapearCategoria,
  mapearUnidadMedida,
  type Categoria,
  type CategoriaApi,
  type UnidadMedida,
  type UnidadMedidaApi,
} from './catalogo.service';
import { http } from './http';

export const CACHE_INSUMOS_KEY = 'guateganado_insumos_cache_v1';

export const CAMPOS_ORDEN_INSUMO = ['nombre', 'precio', 'insumo_id', 'categoria_id'] as const;
export type CampoOrdenInsumo = (typeof CAMPOS_ORDEN_INSUMO)[number];

export interface InsumoApi {
  insumo_id: number;
  nombre: string;
  categoria_id: number;
  precio: number | string;
  unidad_medida_id: number;
  categoria?: CategoriaApi | null;
  unidad_medida?: UnidadMedidaApi | null;
  created_at?: string;
  updated_at?: string;
}

export interface Insumo {
  insumo_id: number;
  nombre: string;
  categoria_id: number;
  precio: number;
  unidad_medida_id: number;
  categoria: Categoria | null;
  unidad_medida: UnidadMedida | null;
  created_at?: string;
  updated_at?: string;
}

export interface InsumoPayload {
  nombre: string;
  categoria_id: number;
  precio: number;
  unidad_medida_id: number;
}

export interface FiltrosInsumos {
  page?: number;
  per_page?: number;
  buscar?: string;
  nombre?: string;
  categoria_id?: number | string;
  unidad_medida_id?: number | string;
  precio_min?: number;
  precio_max?: number;
  sort_by?: CampoOrdenInsumo;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export type ListadoInsumos = ListadoPaginado<Insumo>;

const cacheInsumos = crearCacheListado<Insumo>(CACHE_INSUMOS_KEY);

export function mapearInsumo(raw: InsumoApi): Insumo {
  return {
    insumo_id: Number(raw.insumo_id),
    nombre: raw.nombre,
    categoria_id: Number(raw.categoria_id),
    precio: Number(raw.precio),
    unidad_medida_id: Number(raw.unidad_medida_id),
    categoria: raw.categoria ? mapearCategoria(raw.categoria) : null,
    unidad_medida: raw.unidad_medida ? mapearUnidadMedida(raw.unidad_medida) : null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const insumoService = {
  /**
   * Listado paginado de insumos en formato PaginacionUniforme con respaldo offline.
   * GET /api/v1/insumos
   */
  async listar(filtros: FiltrosInsumos = {}): Promise<ListadoInsumos> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const termino = filtros.buscar?.trim() || filtros.nombre?.trim() || '';
    const sinFiltros =
      !termino &&
      !filtros.categoria_id &&
      !filtros.unidad_medida_id &&
      filtros.precio_min === undefined &&
      filtros.precio_max === undefined;

    return listarConRespaldo<Insumo, InsumoApi>({
      ruta: '/insumos',
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: termino || undefined,
        categoria_id: filtros.categoria_id || undefined,
        unidad_medida_id: filtros.unidad_medida_id || undefined,
        precio_min: filtros.precio_min,
        precio_max: filtros.precio_max,
        sort_by: filtros.sort_by ?? 'insumo_id',
        order: filtros.order ?? 'asc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearInsumo,
      clave: (item) => item.insumo_id,
      cache: cacheInsumos,
    });
  },

  /**
   * Listado paginado de insumos pertenecientes a una categoría específica.
   * GET /api/v1/categorias/{categoria}/insumos
   */
  async listarPorCategoria(
    categoriaId: number | string,
    filtros: Omit<FiltrosInsumos, 'categoria_id'> = {},
  ): Promise<ListadoInsumos> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const termino = filtros.buscar?.trim() || filtros.nombre?.trim() || '';

    return listarConRespaldo<Insumo, InsumoApi>({
      ruta: `/categorias/${categoriaId}/insumos`,
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: termino || undefined,
        unidad_medida_id: filtros.unidad_medida_id || undefined,
        precio_min: filtros.precio_min,
        precio_max: filtros.precio_max,
        sort_by: filtros.sort_by ?? 'insumo_id',
        order: filtros.order ?? 'asc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros: false,
      mapear: mapearInsumo,
      clave: (item) => item.insumo_id,
      cache: cacheInsumos,
    });
  },

  /** GET /api/v1/insumos/{insumo} */
  async obtener(id: number | string): Promise<Insumo> {
    const respuesta = await http.get<{ data: InsumoApi }>(`/insumos/${id}`);
    return mapearInsumo(respuesta.data);
  },

  /**
   * POST /api/v1/insumos (UI restringida a admin).
   * Nota: el backend devuelve 201 sin eager-loading de `categoria` y `unidad_medida`.
   */
  async crear(datos: InsumoPayload): Promise<Insumo> {
    const respuesta = await http.post<{ data: InsumoApi }>('/insumos', {
      nombre: datos.nombre.trim(),
      categoria_id: Number(datos.categoria_id),
      precio: Number(datos.precio),
      unidad_medida_id: Number(datos.unidad_medida_id),
    });
    return mapearInsumo(respuesta.data);
  },

  /** PUT /api/v1/insumos/{insumo} (UI restringida a admin). */
  async actualizar(id: number | string, datos: Partial<InsumoPayload>): Promise<Insumo> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.nombre !== undefined) cuerpo.nombre = datos.nombre.trim();
    if (datos.categoria_id !== undefined) cuerpo.categoria_id = Number(datos.categoria_id);
    if (datos.precio !== undefined) cuerpo.precio = Number(datos.precio);
    if (datos.unidad_medida_id !== undefined) cuerpo.unidad_medida_id = Number(datos.unidad_medida_id);

    const respuesta = await http.put<{ data: InsumoApi }>(`/insumos/${id}`, cuerpo);
    return mapearInsumo(respuesta.data);
  },

  /** DELETE /api/v1/insumos/{insumo} (UI restringida a admin). */
  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/insumos/${id}`);
  },

  /** Limpia la caché offline de insumos (usado al cerrar sesión). */
  async limpiarCache(): Promise<void> {
    await cacheInsumos.limpiar();
  },
};
