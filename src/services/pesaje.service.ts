/**
 * Servicio del módulo Pesaje (Contrato API Sección 4).
 *
 *   GET  /api/v1/animales/{animal}/pesajes?page=&per_page=&sort_by=fecha_pesaje&order=desc
 *   POST /api/v1/animales/{animal}/pesajes
 */
import type { ApiEnvelope, ApiLinks, ApiMeta } from './http';
import { http } from './http';

export interface PesajeAnimalApi {
  pesaje_id: number;
  id_animal: number;
  peso_kg: number | string;
  fecha_pesaje: string;
  observaciones: string | null;
  animal?: {
    id_animal: number;
    numero_arete: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface PesajeAnimal {
  pesaje_id: number;
  id_animal: number;
  peso_kg: number;
  fecha_pesaje: string;
  observaciones: string | null;
  animal?: {
    id_animal: number;
    numero_arete: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosPesajesAnimal {
  page?: number;
  per_page?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  peso_min?: number;
  peso_max?: number;
  sort_by?: 'fecha_pesaje' | 'peso_kg' | 'pesaje_id' | 'id_animal';
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

/**
 * Payload de POST /api/v1/animales/{animal}/pesajes (StorePesajeAnimalRequest).
 * No requiere `id_animal` porque el backend lo inyecta desde el parámetro `{animal}` de la URL.
 */
export interface NuevoPesajeAnimal {
  peso_kg: number;
  fecha_pesaje: string;
  observaciones?: string | null;
}

export interface RespuestaPaginadaPesajes {
  data: PesajeAnimal[];
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

export function mapearPesajeAnimal(raw: PesajeAnimalApi): PesajeAnimal {
  return {
    pesaje_id: raw.pesaje_id,
    id_animal: raw.id_animal,
    peso_kg: Number(raw.peso_kg),
    fecha_pesaje: raw.fecha_pesaje,
    observaciones: raw.observaciones ?? null,
    animal: raw.animal ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const pesajeService = {
  /**
   * Historial cronológico de pesajes de un animal en formato PaginacionUniforme.
   * GET /api/v1/animales/{animal}/pesajes (ordenado por fecha_pesaje desc por defecto).
   */
  async listarPorAnimal(
    idAnimal: number | string,
    filtros: FiltrosPesajesAnimal = {},
  ): Promise<RespuestaPaginadaPesajes> {
    const respuesta = await http.get<ApiEnvelope<PesajeAnimalApi[]>>(`/animales/${idAnimal}/pesajes`, {
      query: {
        page: filtros.page ?? 1,
        per_page: filtros.per_page ?? 15,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        peso_min: filtros.peso_min,
        peso_max: filtros.peso_max,
        sort_by: filtros.sort_by ?? 'fecha_pesaje',
        order: filtros.order ?? 'desc',
      },
      signal: filtros.signal,
    });

    const data = (respuesta.data ?? []).map(mapearPesajeAnimal);
    return {
      data,
      meta: respuesta.meta ?? { ...META_POR_DEFECTO, total: data.length },
      links: respuesta.links ?? LINKS_POR_DEFECTO,
    };
  },

  /**
   * Registra un nuevo pesaje para el animal indicado.
   * POST /api/v1/animales/{animal}/pesajes (solo admin y operario; veterinario recibe 403).
   */
  async crearParaAnimal(idAnimal: number | string, datos: NuevoPesajeAnimal): Promise<PesajeAnimal> {
    const respuesta = await http.post<{ data: PesajeAnimalApi }>(`/animales/${idAnimal}/pesajes`, {
      peso_kg: datos.peso_kg,
      fecha_pesaje: datos.fecha_pesaje,
      observaciones: datos.observaciones?.trim() ? datos.observaciones.trim() : null,
    });
    return mapearPesajeAnimal(respuesta.data);
  },
};
