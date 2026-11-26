import { Preferences } from '@capacitor/preferences';

import { ApiError, http, type ApiEnvelope, type ApiLinks, type ApiMeta } from './http';
import { networkService } from './network.service';

export interface ListadoPaginado<T> {
  data: T[];
  meta: ApiMeta;
  links: ApiLinks;
  hayMas: boolean;
  desdeCache: boolean;
  ultimaActualizacion: string | null;
}

interface CacheListado<T> {
  items: T[];
  meta: ApiMeta;
  updatedAt: string;
}

export interface CacheDeListado<T> {
  leer: () => Promise<CacheListado<T> | null>;
  guardar: (items: T[], meta: ApiMeta) => Promise<string>;
  limpiar: () => Promise<void>;
}

export const LINKS_VACIOS: ApiLinks = { first: null, last: null, prev: null, next: null };

export function crearCacheListado<T>(key: string): CacheDeListado<T> {
  return {
    async leer() {
      try {
        const { value } = await Preferences.get({ key });
        if (!value) return null;
        const parsed = JSON.parse(value) as CacheListado<T>;
        return parsed && Array.isArray(parsed.items) ? parsed : null;
      } catch {
        return null;
      }
    },
    async guardar(items, meta) {
      const updatedAt = new Date().toISOString();
      try {
        await Preferences.set({ key, value: JSON.stringify({ items, meta, updatedAt } satisfies CacheListado<T>) });
      } catch {
        return updatedAt;
      }
      return updatedAt;
    },
    async limpiar() {
      try {
        await Preferences.remove({ key });
      } catch {
        return;
      }
    },
  };
}

export interface OpcionesListarConRespaldo<T, A> {
  ruta: string;
  query: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  pagina: number;
  porPagina: number;
  sinFiltros: boolean;
  mapear: (raw: A) => T;
  clave: (item: T) => number | string;
  cache: CacheDeListado<T>;
}

async function desdeCache<T>(cache: CacheDeListado<T>): Promise<ListadoPaginado<T> | null> {
  const guardado = await cache.leer();
  if (!guardado) return null;
  return {
    data: guardado.items,
    meta: { current_page: 1, last_page: 1, per_page: guardado.items.length || 15, total: guardado.items.length },
    links: LINKS_VACIOS,
    hayMas: false,
    desdeCache: true,
    ultimaActualizacion: guardado.updatedAt,
  };
}

export async function listarConRespaldo<T, A>(op: OpcionesListarConRespaldo<T, A>): Promise<ListadoPaginado<T>> {
  const conectado = await networkService.verificarConectividad();
  if (!conectado) {
    const guardado = await desdeCache(op.cache);
    if (guardado) return guardado;
  }

  try {
    const respuesta = await http.get<ApiEnvelope<A[]>>(op.ruta, { query: op.query, signal: op.signal });
    const items = (respuesta.data ?? []).map(op.mapear);
    const meta: ApiMeta = {
      current_page: respuesta.meta?.current_page ?? op.pagina,
      last_page: respuesta.meta?.last_page ?? 1,
      per_page: respuesta.meta?.per_page ?? op.porPagina,
      total: respuesta.meta?.total ?? items.length,
    };

    let updatedAt: string;
    if (op.sinFiltros) {
      const previo = op.pagina > 1 ? await op.cache.leer() : null;
      const combinados = previo
        ? [...previo.items, ...items.filter((n) => !previo.items.some((a) => op.clave(a) === op.clave(n)))]
        : items;
      updatedAt = await op.cache.guardar(combinados, meta);
    } else {
      const previo = await op.cache.leer();
      updatedAt = previo?.updatedAt ?? (await op.cache.guardar(items, meta));
    }

    return {
      data: items,
      meta,
      links: respuesta.links ?? LINKS_VACIOS,
      hayMas: meta.current_page < meta.last_page,
      desdeCache: false,
      ultimaActualizacion: updatedAt,
    };
  } catch (error) {
    if (error instanceof ApiError && error.esDeRed) {
      const guardado = await desdeCache(op.cache);
      if (guardado) return guardado;
    }
    throw error;
  }
}
