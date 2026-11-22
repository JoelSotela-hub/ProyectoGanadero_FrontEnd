/**
 * Servicio de Sanidad: Catálogo de Tratamientos y Aplicaciones Sanitarias
 * (Contrato API Secciones 5 y 6).
 *
 *   GET  /api/v1/tratamientos?per_page=100
 *   GET  /api/v1/animales/{animal}/tratamientos
 *   POST /api/v1/tratamientos-aplicaciones
 *
 * CRÍTICO POR ROL:
 * Los endpoints de TratamientoAnimal (`/animales/{animal}/tratamientos` y
 * `/tratamientos-aplicaciones`) están autorizados únicamente para `admin` y
 * `veterinario` (`TratamientoAnimalPolicy`). El rol `operario` recibe `403`.
 */
import type { ApiEnvelope, ApiLinks, ApiMeta } from './http';
import { http } from './http';

export interface TratamientoCatalogo {
  tratamiento_id: number;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  created_at?: string;
  updated_at?: string;
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
  tratamiento_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  sort_by?: 'fecha_aplicacion' | 'dosis_ml' | 'tratamiento_animal_id' | 'id_animal' | 'tratamiento_id';
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
}

const META_POR_DEFECTO: ApiMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
};

const LINKS_POR_DEFECTO: ApiLinks = {
  first: null,
  last: null,
  prev: null,
  next: null,
};

export function mapearTratamientoAplicacion(raw: TratamientoAplicacionApi): TratamientoAplicacion {
  return {
    tratamiento_animal_id: raw.tratamiento_animal_id,
    id_animal: raw.id_animal,
    tratamiento_id: raw.tratamiento_id,
    fecha_aplicacion: raw.fecha_aplicacion,
    dosis_ml: Number(raw.dosis_ml),
    observaciones: raw.observaciones ?? null,
    animal: raw.animal ?? null,
    tratamiento: raw.tratamiento ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const tratamientoService = {
  /**
   * Catálogo sanitario para el selector del modal "Aplicar tratamiento".
   * GET /api/v1/tratamientos?per_page=100
   */
  async listarCatalogo(
    params: { page?: number; per_page?: number; buscar?: string; tipo?: string } = {},
  ): Promise<RespuestaPaginadaCatalogoTratamientos> {
    const respuesta = await http.get<ApiEnvelope<TratamientoCatalogo[]>>('/tratamientos', {
      query: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 100,
        buscar: params.buscar,
        tipo: params.tipo,
      },
    });

    const data = respuesta.data ?? [];
    return {
      data,
      meta: respuesta.meta ?? { ...META_POR_DEFECTO, per_page: params.per_page ?? 100, total: data.length },
      links: respuesta.links ?? LINKS_POR_DEFECTO,
    };
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
      links: respuesta.links ?? LINKS_POR_DEFECTO,
    };
  },

  /**
   * Registra una nueva aplicación sanitaria.
   * POST /api/v1/tratamientos-aplicaciones (solo admin y veterinario).
   * Nota del contrato: store() devuelve 201 sin eager-loading de `tratamiento`,
   * por lo que el store de Pinia debe recargar el historial tras crear.
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
};
