/**
 * Servicio de potreros (Fase 2) con soporte de caché offline (`@capacitor/preferences`).
 *
 * Endpoints consumidos (ver Docs/contrato-api-frontend.md, Sección 3):
 *   GET    /api/v1/potreros?page=&per_page=&nombre=&estado_pasto=&sort_by=&order=
 *   GET    /api/v1/potreros/{potrero}
 *   POST   /api/v1/potreros
 *   PUT    /api/v1/potreros/{potrero}
 *   DELETE /api/v1/potreros/{potrero}
 *   GET    /api/v1/potreros/{potrero}/animales?page=&per_page=
 */
import { Preferences } from '@capacitor/preferences';

import { mapearAnimal, type AnimalApi } from './animal.service';
import { ApiError, http, type ApiLinks, type ApiMeta } from './http';
import { networkService } from './network.service';

import type { AnimalItem } from '@/models/auth.model';

export const CACHE_POTREROS_KEY = 'guateganado_potreros_cache_v1';

export type EstadoPasto = 'Excelente' | 'Bueno' | 'Regular';
export const ESTADOS_PASTO: readonly EstadoPasto[] = ['Excelente', 'Bueno', 'Regular'];

export type CampoOrdenPotrero = 'nombre' | 'hectareas_de_extension' | 'capacidad_maxima' | 'potrero_id';

/** Forma exacta en que la API devuelve un potrero (PotreroResource). */
export interface Potrero {
  potrero_id: number;
  nombre: string;
  codigo_qr: string;
  hectareas_de_extension: number;
  capacidad_maxima: number;
  estado_pasto: string | null;
  created_at?: string;
  updated_at?: string;
}

interface PotreroApi {
  potrero_id: number;
  nombre: string;
  codigo_qr?: string | null;
  hectareas_de_extension: number | string;
  capacidad_maxima: number | string;
  estado_pasto?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PotreroPayload {
  nombre: string;
  hectareas_de_extension: number;
  capacidad_maxima: number;
  estado_pasto?: string | null;
  codigo_qr?: string | null;
}

export interface FiltrosPotreros {
  page?: number;
  per_page?: number;
  nombre?: string;
  estado_pasto?: string;
  sort_by?: CampoOrdenPotrero;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export interface FiltrosAnimalesPotrero {
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
}

export interface ListadoPotreros {
  data: Potrero[];
  meta: ApiMeta;
  links: ApiLinks;
  hayMas: boolean;
  desdeCache: boolean;
  ultimaActualizacion: string | null;
}

export interface DetallePotreroResultado {
  item: Potrero;
  desdeCache: boolean;
  ultimaActualizacion: string | null;
}

export interface ListadoAnimalesPotrero {
  items: AnimalItem[];
  meta: ApiMeta;
  links: ApiLinks;
  hayMas: boolean;
}

interface RespuestaListadoPotreros {
  message?: string;
  data: PotreroApi[];
  meta?: ApiMeta;
  links?: ApiLinks;
}

interface RespuestaListadoAnimalesPotrero {
  message?: string;
  data: AnimalApi[];
  meta?: ApiMeta;
  links?: ApiLinks;
}

interface CacheListadoPotreros {
  items: Potrero[];
  meta: ApiMeta;
  updatedAt: string;
}

const LINKS_VACIOS: ApiLinks = { first: null, last: null, prev: null, next: null };

function normalizarPotrero(raw: PotreroApi): Potrero {
  return {
    potrero_id: Number(raw.potrero_id),
    nombre: raw.nombre,
    codigo_qr: raw.codigo_qr ?? '',
    hectareas_de_extension: Number(raw.hectareas_de_extension),
    capacidad_maxima: Number(raw.capacidad_maxima),
    estado_pasto: raw.estado_pasto ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normalizarMeta(meta: ApiMeta | undefined, cantidad: number, pagina = 1, porPagina = 15): ApiMeta {
  return {
    current_page: meta?.current_page ?? pagina,
    last_page: meta?.last_page ?? 1,
    per_page: meta?.per_page ?? porPagina,
    total: meta?.total ?? cantidad,
  };
}

async function leerCachePotreros(): Promise<CacheListadoPotreros | null> {
  try {
    const { value } = await Preferences.get({ key: CACHE_POTREROS_KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as CacheListadoPotreros;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function guardarCachePotreros(items: Potrero[], meta: ApiMeta): Promise<string> {
  const updatedAt = new Date().toISOString();
  try {
    await Preferences.set({
      key: CACHE_POTREROS_KEY,
      value: JSON.stringify({ items, meta, updatedAt } satisfies CacheListadoPotreros),
    });
  } catch {
    // Si falla por cuota o restricciones del navegador, no interrumpe el flujo.
  }
  return updatedAt;
}

async function actualizarItemEnCache(potrero: Potrero): Promise<string> {
  const actual = await leerCachePotreros();
  const updatedAt = new Date().toISOString();
  const base = actual?.items ?? [];
  const indice = base.findIndex((p) => p.potrero_id === potrero.potrero_id);
  const nuevos = indice >= 0 ? base.map((p, i) => (i === indice ? potrero : p)) : [potrero, ...base];
  const meta: ApiMeta = actual?.meta ?? {
    current_page: 1,
    last_page: 1,
    per_page: nuevos.length || 15,
    total: nuevos.length,
  };
  try {
    await Preferences.set({
      key: CACHE_POTREROS_KEY,
      value: JSON.stringify({
        items: nuevos,
        meta: { ...meta, total: Math.max(meta.total, nuevos.length) },
        updatedAt: actual?.updatedAt ?? updatedAt,
      } satisfies CacheListadoPotreros),
    });
  } catch {
    // Ignorar errores de cuota
  }
  return actual?.updatedAt ?? updatedAt;
}

async function eliminarItemDeCache(id: number | string): Promise<void> {
  const actual = await leerCachePotreros();
  if (!actual) return;
  const restantes = actual.items.filter((p) => String(p.potrero_id) !== String(id));
  try {
    await Preferences.set({
      key: CACHE_POTREROS_KEY,
      value: JSON.stringify({
        items: restantes,
        meta: { ...actual.meta, total: Math.max(0, actual.meta.total - 1) },
        updatedAt: actual.updatedAt,
      } satisfies CacheListadoPotreros),
    });
  } catch {
    // Ignorar errores de cuota
  }
}

function filtrarYOrdenarEnCache(items: Potrero[], filtros: FiltrosPotreros): Potrero[] {
  const termino = filtros.nombre?.trim().toLowerCase() ?? '';
  const filtrados = items.filter((p) => {
    if (termino && !p.nombre.toLowerCase().includes(termino)) return false;
    if (filtros.estado_pasto && p.estado_pasto !== filtros.estado_pasto) return false;
    return true;
  });

  const campo = filtros.sort_by ?? 'potrero_id';
  const dir = filtros.order === 'desc' ? -1 : 1;

  return [...filtrados].sort((a, b) => {
    if (campo === 'nombre') return a.nombre.localeCompare(b.nombre) * dir;
    if (campo === 'hectareas_de_extension') return (a.hectareas_de_extension - b.hectareas_de_extension) * dir;
    if (campo === 'capacidad_maxima') return (a.capacidad_maxima - b.capacidad_maxima) * dir;
    return (a.potrero_id - b.potrero_id) * dir;
  });
}

async function servirListadoDesdeCache(filtros: FiltrosPotreros): Promise<ListadoPotreros | null> {
  const cache = await leerCachePotreros();
  if (!cache) return null;
  const filtrados = filtrarYOrdenarEnCache(cache.items, filtros);
  return {
    data: filtrados,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: filtrados.length || cache.meta.per_page || 15,
      total: filtrados.length,
    },
    links: LINKS_VACIOS,
    hayMas: false,
    desdeCache: true,
    ultimaActualizacion: cache.updatedAt,
  };
}

export const potreroService = {
  /** GET /api/v1/potreros con filtros, ordenamiento, paginación y respaldo offline. */
  async listar(filtros: FiltrosPotreros = {}): Promise<ListadoPotreros> {
    const conectado = await networkService.verificarConectividad();

    if (!conectado) {
      const desdeCache = await servirListadoDesdeCache(filtros);
      if (desdeCache) return desdeCache;
    }

    try {
      const respuesta = await http.get<RespuestaListadoPotreros>('/potreros', {
        query: {
          page: filtros.page ?? 1,
          per_page: filtros.per_page ?? 15,
          nombre: filtros.nombre,
          estado_pasto: filtros.estado_pasto,
          sort_by: filtros.sort_by,
          order: filtros.order,
        },
        signal: filtros.signal,
      });

      const items = (respuesta.data ?? []).map(normalizarPotrero);
      const meta = normalizarMeta(respuesta.meta, items.length, filtros.page ?? 1, filtros.per_page ?? 15);
      const links = respuesta.links ?? LINKS_VACIOS;

      const sinFiltrosActivos = !filtros.nombre && !filtros.estado_pasto;
      let updatedAt: string;
      if (sinFiltrosActivos) {
        const previo = (filtros.page ?? 1) > 1 ? await leerCachePotreros() : null;
        const combinados = previo
          ? [
              ...previo.items,
              ...items.filter((nuevo) => !previo.items.some((ant) => ant.potrero_id === nuevo.potrero_id)),
            ]
          : items;
        updatedAt = await guardarCachePotreros(combinados, meta);
      } else {
        const previo = await leerCachePotreros();
        updatedAt = previo?.updatedAt ?? (await guardarCachePotreros(items, meta));
      }

      return {
        data: items,
        meta,
        links,
        hayMas: meta.current_page < meta.last_page,
        desdeCache: false,
        ultimaActualizacion: updatedAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.esDeRed) {
        const desdeCache = await servirListadoDesdeCache(filtros);
        if (desdeCache) return desdeCache;
      }
      throw error;
    }
  },

  /** GET /api/v1/potreros/{potrero} con respaldo offline desde la caché local. */
  async obtenerConCache(id: number | string): Promise<DetallePotreroResultado> {
    const conectado = await networkService.verificarConectividad();

    if (!conectado) {
      const cache = await leerCachePotreros();
      const encontrado = cache?.items.find((p) => String(p.potrero_id) === String(id));
      if (encontrado && cache) {
        return {
          item: encontrado,
          desdeCache: true,
          ultimaActualizacion: cache.updatedAt,
        };
      }
    }

    try {
      const respuesta = await http.get<{ data: PotreroApi }>(`/potreros/${id}`);
      const item = normalizarPotrero(respuesta.data);
      const updatedAt = await actualizarItemEnCache(item);
      return {
        item,
        desdeCache: false,
        ultimaActualizacion: updatedAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.esDeRed) {
        const cache = await leerCachePotreros();
        const encontrado = cache?.items.find((p) => String(p.potrero_id) === String(id));
        if (encontrado && cache) {
          return {
            item: encontrado,
            desdeCache: true,
            ultimaActualizacion: cache.updatedAt,
          };
        }
      }
      throw error;
    }
  },

  /** GET /api/v1/potreros/{potrero} */
  async obtener(id: number | string): Promise<Potrero> {
    const res = await this.obtenerConCache(id);
    return res.item;
  },

  /** POST /api/v1/potreros (solo admin). */
  async crear(payload: PotreroPayload): Promise<Potrero> {
    const respuesta = await http.post<{ data: PotreroApi }>('/potreros', payload);
    const creado = normalizarPotrero(respuesta.data);
    await actualizarItemEnCache(creado);
    return creado;
  },

  /** PUT /api/v1/potreros/{potrero} (solo admin). */
  async actualizar(id: number | string, payload: Partial<PotreroPayload>): Promise<Potrero> {
    const respuesta = await http.put<{ data: PotreroApi }>(`/potreros/${id}`, payload);
    const actualizado = normalizarPotrero(respuesta.data);
    await actualizarItemEnCache(actualizado);
    return actualizado;
  },

  /** DELETE /api/v1/potreros/{potrero} (solo admin; 409 RN-02 si tiene animales). */
  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/potreros/${id}`);
    await eliminarItemDeCache(id);
  },

  /** GET /api/v1/potreros/{potrero}/animales (PaginacionUniforme; `meta.total` da la ocupación real). */
  async listarAnimales(
    potreroId: number | string,
    filtros: FiltrosAnimalesPotrero = {},
  ): Promise<ListadoAnimalesPotrero> {
    const respuesta = await http.get<RespuestaListadoAnimalesPotrero>(`/potreros/${potreroId}/animales`, {
      query: {
        page: filtros.page ?? 1,
        per_page: filtros.per_page ?? 15,
      },
      signal: filtros.signal,
    });

    const items = (respuesta.data ?? []).map(mapearAnimal);
    const meta = normalizarMeta(respuesta.meta, items.length, filtros.page ?? 1, filtros.per_page ?? 15);
    const links = respuesta.links ?? LINKS_VACIOS;

    return {
      items,
      meta,
      links,
      hayMas: meta.current_page < meta.last_page,
    };
  },

  /** Limpia la caché local de potreros. */
  async limpiarCache(): Promise<void> {
    try {
      await Preferences.remove({ key: CACHE_POTREROS_KEY });
    } catch {
      // Ignorar si no existe
    }
  },
};
