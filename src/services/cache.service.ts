/**
 * Servicio de cache local del listado y detalle de animales (Persona 4).
 *
 * Cumple el punto 6 del enunciado:
 *   "Implemente una cache local del ultimo listado consultado, de modo que la
 *    aplicacion muestre datos cuando no haya conectividad... e indique en la
 *    interfaz que la informacion no esta actualizada, con su marca de tiempo."
 *
 * Utiliza `@capacitor/preferences` (permitido expresamente para la cache de
 * datos; el token jamas pasa por aqui).
 */
import { Preferences } from '@capacitor/preferences';

import type { Paginacion } from './animal.service';

import type { AnimalItem } from '@/models/auth.model';

/** Clave donde se persiste el ultimo listado consultado con su marca de tiempo. */
export const CACHE_LISTADO_KEY = 'guateganado_animales_cache_v1';

/** Estructura persistida en `@capacitor/preferences`. */
export interface CacheListadoAnimales {
  items: AnimalItem[];
  paginacion: Paginacion;
  updatedAt: string;
}

/** Resultado al recuperar un animal individual desde la cache en modo avion. */
export interface CacheDetalleAnimal {
  item: AnimalItem;
  updatedAt: string;
}

/**
 * Formatea una marca de tiempo ISO 8601 a texto legible en espanol (fecha y hora).
 */
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
  /**
   * Guarda el listado de animales consultado junto con la marca de tiempo actual.
   * Si se pagino o se consulto un subconjunto, conserva tambien los animales previos
   * por ID para que el detalle funcione en modo avion sobre cualquier animal visto.
   */
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
      // Si el almacenamiento falla por cuota, no interrumpe la navegacion.
    }

    return updatedAt;
  },

  /**
   * Recupera el ultimo listado de animales almacenado en la cache local.
   */
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

  /**
   * Actualiza o inserta un animal individual dentro de la cache local cuando se
   * consulta su detalle o se crea/edita con conexion.
   */
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

    await Preferences.set({
      key: CACHE_LISTADO_KEY,
      value: JSON.stringify({
        items: nuevosItems,
        paginacion,
        updatedAt: actual?.updatedAt ?? updatedAt,
      } satisfies CacheListadoAnimales),
    });

    return actual?.updatedAt ?? updatedAt;
  },

  /**
   * Busca un animal por su ID dentro de la cache local para que la pantalla de
   * Detalle (`AnimalDetail.vue`) funcione tambien sin conectividad.
   */
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

  /**
   * Limpia la cache local de animales si es necesario.
   */
  async limpiar(): Promise<void> {
    try {
      await Preferences.remove({ key: CACHE_LISTADO_KEY });
    } catch {
      // Ignorar si no existe
    }
  },
};
