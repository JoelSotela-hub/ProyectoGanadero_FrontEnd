import { Preferences } from '@capacitor/preferences';

import type { Paginacion } from './animal.service';

import type { AnimalItem } from '@/models/auth.model';

export const CACHE_LISTADO_KEY = 'guateganado_animales_cache_v1';

export interface CacheListadoAnimales {
  items: AnimalItem[];
  paginacion: Paginacion;
  updatedAt: string;
}

export interface CacheDetalleAnimal {
  item: AnimalItem;
  updatedAt: string;
}

export function formatearMarcaDeTiempo(isoString: string | null | undefined): string {
  if (!isoString) return 'Sin registro previo';
  const fecha = new Date(isoString);
  if (Number.isNaN(fecha.getTime())) return isoString;

  return fecha.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const cacheService = {
  async guardarListado(items: AnimalItem[], paginacion: Paginacion): Promise<string> {
    const updatedAt = new Date().toISOString();

    const payload: CacheListadoAnimales = {
      items,
      paginacion,
      updatedAt,
    };

    try {
      await Preferences.set({
        key: CACHE_LISTADO_KEY,
        value: JSON.stringify(payload),
      });
    } catch {
      return updatedAt;
    }

    return updatedAt;
  },

  async obtenerListado(): Promise<CacheListadoAnimales | null> {
    try {
      const { value } = await Preferences.get({ key: CACHE_LISTADO_KEY });
      if (!value) return null;

      const parsed = JSON.parse(value) as CacheListadoAnimales;
      if (!parsed || !Array.isArray(parsed.items)) return null;

      return parsed;
    } catch {
      return null;
    }
  },

  async guardarDetalleAnimal(animal: AnimalItem): Promise<string> {
    const actual = await this.obtenerListado();
    const updatedAt = new Date().toISOString();

    const listaBase = actual?.items ?? [];
    const indice = listaBase.findIndex((item) => Number(item.id) === Number(animal.id));
    const nuevosItems =
      indice >= 0 ? listaBase.map((item, i) => (i === indice ? animal : item)) : [animal, ...listaBase];

    const paginacion: Paginacion = actual?.paginacion ?? {
      paginaActual: 1,
      ultimaPagina: 1,
      porPagina: nuevosItems.length || 15,
      total: nuevosItems.length,
    };

    try {
      await Preferences.set({
        key: CACHE_LISTADO_KEY,
        value: JSON.stringify({
          items: nuevosItems,
          paginacion,
          updatedAt: actual?.updatedAt ?? updatedAt,
        } satisfies CacheListadoAnimales),
      });
    } catch {
      return actual?.updatedAt ?? updatedAt;
    }

    return actual?.updatedAt ?? updatedAt;
  },

  async obtenerAnimalPorId(id: number | string): Promise<CacheDetalleAnimal | null> {
    const cache = await this.obtenerListado();
    if (!cache) return null;

    const encontrado = cache.items.find((item) => String(item.id) === String(id));
    if (!encontrado) return null;

    return {
      item: encontrado,
      updatedAt: cache.updatedAt,
    };
  },

  async limpiar(): Promise<void> {
    try {
      await Preferences.remove({ key: CACHE_LISTADO_KEY });
    } catch {
      return;
    }
  },
};
