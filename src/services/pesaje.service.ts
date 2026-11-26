import { crearCacheListado, LINKS_VACIOS, listarConRespaldo, type ListadoPaginado } from './cacheListado';
import type { ApiEnvelope, ApiLinks, ApiMeta } from './http';
import { http } from './http';

export const CACHE_PESAJES_KEY = 'guateganado_pesajes_cache_v1';

export type CampoOrdenPesaje = 'fecha_pesaje' | 'peso_kg' | 'pesaje_id' | 'id_animal';

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
  sort_by?: CampoOrdenPesaje;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export interface FiltrosPesajesGlobal extends FiltrosPesajesAnimal {
  id_animal?: number | string;
}

export interface NuevoPesajeAnimal {
  peso_kg: number;
  fecha_pesaje: string;
  observaciones?: string | null;
}

export interface PesajePayload {
  id_animal: number;
  peso_kg: number;
  fecha_pesaje: string;
  observaciones?: string | null;
}

export interface RespuestaPaginadaPesajes {
  data: PesajeAnimal[];
  meta: ApiMeta;
  links: ApiLinks;
}

export type ListadoPesajesGlobal = ListadoPaginado<PesajeAnimal>;

const META_POR_DEFECTO: ApiMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
};

const cachePesajes = crearCacheListado<PesajeAnimal>(CACHE_PESAJES_KEY);

export function mapearPesajeAnimal(raw: PesajeAnimalApi): PesajeAnimal {
  return {
    pesaje_id: Number(raw.pesaje_id),
    id_animal: Number(raw.id_animal),
    peso_kg: Number(raw.peso_kg),
    fecha_pesaje: raw.fecha_pesaje,
    observaciones: raw.observaciones ?? null,
    animal: raw.animal ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const pesajeService = {
  async listar(filtros: FiltrosPesajesGlobal = {}): Promise<ListadoPesajesGlobal> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const sinFiltros =
      !filtros.id_animal &&
      !filtros.fecha_desde &&
      !filtros.fecha_hasta &&
      filtros.peso_min === undefined &&
      filtros.peso_max === undefined;

    return listarConRespaldo<PesajeAnimal, PesajeAnimalApi>({
      ruta: '/pesajes',
      query: {
        page: pagina,
        per_page: porPagina,
        id_animal: filtros.id_animal,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        peso_min: filtros.peso_min,
        peso_max: filtros.peso_max,
        sort_by: filtros.sort_by ?? 'fecha_pesaje',
        order: filtros.order ?? 'desc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearPesajeAnimal,
      clave: (item) => item.pesaje_id,
      cache: cachePesajes,
    });
  },

  async crear(datos: PesajePayload): Promise<PesajeAnimal> {
    const respuesta = await http.post<{ data: PesajeAnimalApi }>('/pesajes', {
      id_animal: Number(datos.id_animal),
      peso_kg: Number(datos.peso_kg),
      fecha_pesaje: datos.fecha_pesaje,
      observaciones: datos.observaciones?.trim() ? datos.observaciones.trim() : null,
    });
    return mapearPesajeAnimal(respuesta.data);
  },

  async actualizar(id: number | string, datos: Partial<PesajePayload>): Promise<PesajeAnimal> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.id_animal !== undefined) cuerpo.id_animal = Number(datos.id_animal);
    if (datos.peso_kg !== undefined) cuerpo.peso_kg = Number(datos.peso_kg);
    if (datos.fecha_pesaje !== undefined) cuerpo.fecha_pesaje = datos.fecha_pesaje;
    if (datos.observaciones !== undefined) {
      cuerpo.observaciones = datos.observaciones?.trim() ? datos.observaciones.trim() : null;
    }
    const respuesta = await http.put<{ data: PesajeAnimalApi }>(`/pesajes/${id}`, cuerpo);
    return mapearPesajeAnimal(respuesta.data);
  },

  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/pesajes/${id}`);
  },

  async limpiarCache(): Promise<void> {
    await cachePesajes.limpiar();
  },

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
      links: respuesta.links ?? LINKS_VACIOS,
    };
  },

  async crearParaAnimal(idAnimal: number | string, datos: NuevoPesajeAnimal): Promise<PesajeAnimal> {
    const respuesta = await http.post<{ data: PesajeAnimalApi }>(`/animales/${idAnimal}/pesajes`, {
      peso_kg: datos.peso_kg,
      fecha_pesaje: datos.fecha_pesaje,
      observaciones: datos.observaciones?.trim() ? datos.observaciones.trim() : null,
    });
    return mapearPesajeAnimal(respuesta.data);
  },
};
