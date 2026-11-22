/**
 * Servicio de Sanidad: Catálogo de Tratamientos y Aplicaciones Sanitarias
 * (Contrato API Secciones 5 y 6).
 *
 *   GET|POST|PUT|DELETE /api/v1/tratamientos
 *   GET|POST|PUT|DELETE /api/v1/tratamientos-aplicaciones
 *   GET                 /api/v1/animales/{animal}/tratamientos
 *
 * CRÍTICO POR ROL:
 * Los endpoints de TratamientoAnimal (`/animales/{animal}/tratamientos` y
 * `/tratamientos-aplicaciones`) están autorizados únicamente para `admin` y
 * `veterinario` (`TratamientoAnimalPolicy`). El rol `operario` recibe `403`.
 */
import { crearCacheListado, LINKS_VACIOS, listarConRespaldo, type ListadoPaginado } from './cacheListado';
import type { ApiEnvelope, ApiLinks, ApiMeta } from './http';
import { http } from './http';

export const CACHE_APLICACIONES_KEY = 'guateganado_tratamientos_aplicaciones_cache_v1';
export const CACHE_CATALOGO_TRATAMIENTOS_KEY = 'guateganado_tratamientos_catalogo_cache_v1';

export const TIPOS_TRATAMIENTO_REFERENCIA = ['Vacuna', 'Desparasitante', 'Vitamina'] as const;

export type CampoOrdenAplicacion =
  | 'fecha_aplicacion'
  | 'dosis_ml'
  | 'tratamiento_animal_id'
  | 'id_animal'
  | 'tratamiento_id';

export type CampoOrdenCatalogoTratamiento = 'nombre' | 'tipo' | 'tratamiento_id' | 'created_at';

export interface TratamientoCatalogo {
  tratamiento_id: number;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TratamientoCatalogoPayload {
  nombre: string;
  tipo?: string | null;
  descripcion?: string | null;
}

export interface TratamientoAplicacionApi {
  tratamiento_animal_id: number;
  id_animal: number;
  tratamiento_id: number;
  fecha_aplicacion: string;
  dosis_ml: number | string;
  observaciones: string | null;
  animal?: {
    id_animal: number;
    numero_arete: string;
  } | null;
  tratamiento?: TratamientoCatalogo | null;
  created_at?: string;
  updated_at?: string;
}

export interface TratamientoAplicacion {
  tratamiento_animal_id: number;
  id_animal: number;
  tratamiento_id: number;
  fecha_aplicacion: string;
  dosis_ml: number;
  observaciones: string | null;
  animal?: {
    id_animal: number;
    numero_arete: string;
  } | null;
  tratamiento?: TratamientoCatalogo | null;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosTratamientosAnimal {
  page?: number;
  per_page?: number;
  tratamiento_id?: number | string;
  fecha_desde?: string;
  fecha_hasta?: string;
  sort_by?: CampoOrdenAplicacion;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export interface FiltrosAplicacionesGlobal extends FiltrosTratamientosAnimal {
  id_animal?: number | string;
}

export interface FiltrosCatalogoTratamientos {
  page?: number;
  per_page?: number;
  buscar?: string;
  tipo?: string;
  sort_by?: CampoOrdenCatalogoTratamiento;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

/**
 * Payload de POST /api/v1/tratamientos-aplicaciones (StoreTratamientoAnimalRequest).
 * No existe POST anidado en `/animales/{animal}/tratamientos`, por lo que siempre
 * se envía `id_animal` en el cuerpo hacia `/tratamientos-aplicaciones`.
 */
export interface NuevaAplicacionTratamiento {
  id_animal: number;
  tratamiento_id: number;
  fecha_aplicacion: string;
  dosis_ml: number;
  observaciones?: string | null;
}

export interface RespuestaPaginadaTratamientosAnimal {
  data: TratamientoAplicacion[];
  meta: ApiMeta;
  links: ApiLinks;
}

export interface RespuestaPaginadaCatalogoTratamientos {
  data: TratamientoCatalogo[];
  meta: ApiMeta;
  links: ApiLinks;
  hayMas?: boolean;
  desdeCache?: boolean;
  ultimaActualizacion?: string | null;
}
export type ListadoAplicacionesGlobal = ListadoPaginado<TratamientoAplicacion>;

const META_POR_DEFECTO: ApiMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
};

const cacheAplicaciones = crearCacheListado<TratamientoAplicacion>(CACHE_APLICACIONES_KEY);
const cacheCatalogo = crearCacheListado<TratamientoCatalogo>(CACHE_CATALOGO_TRATAMIENTOS_KEY);

export function mapearTratamientoCatalogo(raw: TratamientoCatalogo): TratamientoCatalogo {
  return {
    tratamiento_id: Number(raw.tratamiento_id),
    nombre: raw.nombre,
    descripcion: raw.descripcion ?? null,
    tipo: raw.tipo ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function mapearTratamientoAplicacion(raw: TratamientoAplicacionApi): TratamientoAplicacion {
  return {
    tratamiento_animal_id: Number(raw.tratamiento_animal_id),
    id_animal: Number(raw.id_animal),
    tratamiento_id: Number(raw.tratamiento_id),
    fecha_aplicacion: raw.fecha_aplicacion,
    dosis_ml: Number(raw.dosis_ml),
    observaciones: raw.observaciones ?? null,
    animal: raw.animal ?? null,
    tratamiento: raw.tratamiento ? mapearTratamientoCatalogo(raw.tratamiento) : null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const tratamientoService = {
  /**
   * Catálogo sanitario paginado con filtros (`buscar`, `tipo`) y respaldo offline.
   * GET /api/v1/tratamientos
   */
  async listarCatalogo(params: FiltrosCatalogoTratamientos = {}): Promise<RespuestaPaginadaCatalogoTratamientos> {
    const pagina = params.page ?? 1;
    const porPagina = params.per_page ?? 100;
    const sinFiltros = !params.buscar?.trim() && !params.tipo?.trim();

    return listarConRespaldo<TratamientoCatalogo, TratamientoCatalogo>({
      ruta: '/tratamientos',
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: params.buscar?.trim() || undefined,
        tipo: params.tipo?.trim() || undefined,
        sort_by: params.sort_by,
        order: params.order,
      },
      signal: params.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearTratamientoCatalogo,
      clave: (item) => item.tratamiento_id,
      cache: cacheCatalogo,
    });
  },

  /** POST /api/v1/tratamientos (UI restringida a admin y veterinario). */
  async crearCatalogo(datos: TratamientoCatalogoPayload): Promise<TratamientoCatalogo> {
    const respuesta = await http.post<{ data: TratamientoCatalogo }>('/tratamientos', {
      nombre: datos.nombre.trim(),
      tipo: datos.tipo?.trim() ? datos.tipo.trim() : null,
      descripcion: datos.descripcion?.trim() ? datos.descripcion.trim() : null,
    });
    return mapearTratamientoCatalogo(respuesta.data);
  },

  /** PUT /api/v1/tratamientos/{tratamiento} (UI restringida a admin y veterinario). */
  async actualizarCatalogo(
    id: number | string,
    datos: Partial<TratamientoCatalogoPayload>,
  ): Promise<TratamientoCatalogo> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.nombre !== undefined) cuerpo.nombre = datos.nombre.trim();
    if (datos.tipo !== undefined) cuerpo.tipo = datos.tipo?.trim() ? datos.tipo.trim() : null;
    if (datos.descripcion !== undefined) {
      cuerpo.descripcion = datos.descripcion?.trim() ? datos.descripcion.trim() : null;
    }
    const respuesta = await http.put<{ data: TratamientoCatalogo }>(`/tratamientos/${id}`, cuerpo);
    return mapearTratamientoCatalogo(respuesta.data);
  },

  /** DELETE /api/v1/tratamientos/{tratamiento} (solo admin; 409 RN-06 si tiene aplicaciones). */
  async eliminarCatalogo(id: number | string): Promise<void> {
    await http.delete<void>(`/tratamientos/${id}`);
  },

  /**
   * Listado global de aplicaciones sanitarias con filtros y respaldo offline.
   * GET /api/v1/tratamientos-aplicaciones (solo admin y veterinario; operario -> 403).
   */
  async listarAplicaciones(filtros: FiltrosAplicacionesGlobal = {}): Promise<ListadoAplicacionesGlobal> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const sinFiltros = !filtros.id_animal && !filtros.tratamiento_id && !filtros.fecha_desde && !filtros.fecha_hasta;

    return listarConRespaldo<TratamientoAplicacion, TratamientoAplicacionApi>({
      ruta: '/tratamientos-aplicaciones',
      query: {
        page: pagina,
        per_page: porPagina,
        id_animal: filtros.id_animal,
        tratamiento_id: filtros.tratamiento_id,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        sort_by: filtros.sort_by ?? 'fecha_aplicacion',
        order: filtros.order ?? 'desc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearTratamientoAplicacion,
      clave: (item) => item.tratamiento_animal_id,
      cache: cacheAplicaciones,
    });
  },

  /**
   * Historial de tratamientos aplicados a un animal en formato PaginacionUniforme.
   * GET /api/v1/animales/{animal}/tratamientos (solo admin y veterinario).
   */
  async listarPorAnimal(
    idAnimal: number | string,
    filtros: FiltrosTratamientosAnimal = {},
  ): Promise<RespuestaPaginadaTratamientosAnimal> {
    const respuesta = await http.get<ApiEnvelope<TratamientoAplicacionApi[]>>(`/animales/${idAnimal}/tratamientos`, {
      query: {
        page: filtros.page ?? 1,
        per_page: filtros.per_page ?? 15,
        tratamiento_id: filtros.tratamiento_id,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        sort_by: filtros.sort_by ?? 'fecha_aplicacion',
        order: filtros.order ?? 'desc',
      },
      signal: filtros.signal,
    });

    const data = (respuesta.data ?? []).map(mapearTratamientoAplicacion);
    return {
      data,
      meta: respuesta.meta ?? { ...META_POR_DEFECTO, total: data.length },
      links: respuesta.links ?? LINKS_VACIOS,
    };
  },

  /**
   * Registra una nueva aplicación sanitaria.
   * POST /api/v1/tratamientos-aplicaciones (solo admin y veterinario).
   * Nota del contrato: store() devuelve 201 sin eager-loading de `animal`/`tratamiento`,
   * por lo que el store de Pinia recarga el listado tras crear.
   */
  async aplicarTratamiento(datos: NuevaAplicacionTratamiento): Promise<TratamientoAplicacion> {
    const respuesta = await http.post<{ data: TratamientoAplicacionApi }>('/tratamientos-aplicaciones', {
      id_animal: Number(datos.id_animal),
      tratamiento_id: Number(datos.tratamiento_id),
      fecha_aplicacion: datos.fecha_aplicacion,
      dosis_ml: Number(datos.dosis_ml),
      observaciones: datos.observaciones?.trim() ? datos.observaciones.trim() : null,
    });
    return mapearTratamientoAplicacion(respuesta.data);
  },

  /** PUT /api/v1/tratamientos-aplicaciones/{id} (admin y veterinario). */
  async actualizarAplicacion(
    id: number | string,
    datos: Partial<NuevaAplicacionTratamiento>,
  ): Promise<TratamientoAplicacion> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.id_animal !== undefined) cuerpo.id_animal = Number(datos.id_animal);
    if (datos.tratamiento_id !== undefined) cuerpo.tratamiento_id = Number(datos.tratamiento_id);
    if (datos.fecha_aplicacion !== undefined) cuerpo.fecha_aplicacion = datos.fecha_aplicacion;
    if (datos.dosis_ml !== undefined) cuerpo.dosis_ml = Number(datos.dosis_ml);
    if (datos.observaciones !== undefined) {
      cuerpo.observaciones = datos.observaciones?.trim() ? datos.observaciones.trim() : null;
    }
    const respuesta = await http.put<{ data: TratamientoAplicacionApi }>(`/tratamientos-aplicaciones/${id}`, cuerpo);
    return mapearTratamientoAplicacion(respuesta.data);
  },

  /** DELETE /api/v1/tratamientos-aplicaciones/{id} (solo admin). */
  async eliminarAplicacion(id: number | string): Promise<void> {
    await http.delete<void>(`/tratamientos-aplicaciones/${id}`);
  },

  /** Limpia las cachés offline del módulo de tratamientos (al cerrar sesión). */
  async limpiarCache(): Promise<void> {
    await Promise.all([cacheAplicaciones.limpiar(), cacheCatalogo.limpiar()]);
  },
};
