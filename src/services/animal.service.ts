/**
 * Servicio de animales (Persona 3 + Caché Offline de Persona 4).
 *
 *   GET    /api/v1/animales?page=&per_page=&search=&sexo=&estado=&raza_id=&potrero_id=
 *   GET    /api/v1/animales/{id}
 *   POST   /api/v1/animales
 *   PUT    /api/v1/animales/{id}
 *
 * IMPORTANTE — traduccion de campos.
 * La API y las vistas no usan los mismos nombres. La API devuelve
 * `id_animal`, `numero_arete`, `raza_id`/`potrero_id` con objetos anidados,
 * y no tiene los campos `nombre` ni `peso`: el peso vive en los pesajes.
 * Este modulo traduce la respuesta al modelo `AnimalItem` que ya usan las
 * vistas, para no obligar a reescribirlas.
 *
 * CAPACIDAD SIN CONECTIVIDAD (Persona 4):
 * Cuando `@capacitor/network` reporta que no hay conexion o la peticion falla
 * por un error de red, `listar()` y `obtenerConCache()` sirven los datos desde
 * la cache local (`@capacitor/preferences`) indicando `desdeCache: true` y la
 * marca de tiempo `ultimaActualizacion`.
 */
import { cacheService } from './cache.service';
import type { ApiLinks, ApiMeta } from './http';
import { ApiError, http } from './http';
import { networkService } from './network.service';

import type { AnimalItem } from '@/models/auth.model';

/** Forma exacta en que la API devuelve un animal (AnimalResource). */
export interface AnimalApi {
  id_animal: number;
  numero_arete: string;
  sexo: string;
  fecha_nacimiento: string | null;
  estado: string | null;
  raza_id: number;
  potrero_id: number;
  raza?: { raza_id: number; nombre: string } | null;
  potrero?: { potrero_id: number; nombre: string } | null;
  pesajes?: { pesaje_id: number; peso_kg: number | string; fecha_pesaje: string | null }[];
  created_at?: string;
  updated_at?: string;
}

export interface RespuestaListado {
  message?: string;
  data: AnimalApi[];
  meta?: ApiMeta;
  links?: ApiLinks;
}

export interface Paginacion {
  paginaActual: number;
  ultimaPagina: number;
  porPagina: number;
  total: number;
}

export interface ListadoAnimales {
  items: AnimalItem[];
  paginacion: Paginacion;
  /** True si quedan paginas por cargar (lo usa el scroll infinito). */
  hayMas: boolean;
  /** True cuando los datos provienen de la cache local por falta de conectividad (Persona 4). */
  desdeCache?: boolean;
  /** Marca de tiempo ISO de la ultima sincronizacion con la API (Persona 4). */
  ultimaActualizacion?: string | null;
}

export interface DetalleAnimalResultado {
  item: AnimalItem;
  desdeCache: boolean;
  ultimaActualizacion: string | null;
}

export interface FiltrosAnimales {
  page?: number;
  per_page?: number;
  search?: string;
  sexo?: string;
  estado?: string;
  raza_id?: number | string;
  potrero_id?: number | string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

/** Datos que acepta POST /animales (StoreAnimalRequest). */
export interface NuevoAnimal {
  numero_arete: string;
  raza_id: number;
  potrero_id: number;
  sexo: 'Macho' | 'Hembra';
  fecha_nacimiento?: string | null;
  estado?: string | null;
}

/** Ultimo peso registrado, si el animal trae pesajes cargados. */
function ultimoPeso(animal: AnimalApi): number | null {
  if (!animal.pesajes?.length) return null;
  const ordenados = [...animal.pesajes].sort((a, b) =>
    String(b.fecha_pesaje ?? '').localeCompare(String(a.fecha_pesaje ?? '')),
  );
  const peso = Number(ordenados[0]?.peso_kg);
  return Number.isFinite(peso) ? peso : null;
}

/** Traduce la respuesta de la API al modelo que consumen las vistas. */
export function mapearAnimal(animal: AnimalApi): AnimalItem {
  return {
    id: animal.id_animal,
    arete: animal.numero_arete,
    // La API no tiene un campo "nombre"; se muestra el arete como identificador.
    nombre: animal.numero_arete,
    raza: animal.raza?.nombre ?? `Raza ${animal.raza_id}`,
    sexo: animal.sexo,
    potrero: animal.potrero?.nombre ?? `Potrero ${animal.potrero_id}`,
    peso: ultimoPeso(animal),
    estado: animal.estado ?? 'Activo',
    fechaNacimiento: animal.fecha_nacimiento ?? undefined,
    razaId: animal.raza_id,
    potreroId: animal.potrero_id,
  };
}

/**
 * Aplica los filtros en memoria cuando el usuario filtra o busca sobre el
 * listado cacheado sin conexion.
 */
function filtrarEnCache(items: AnimalItem[], filtros: FiltrosAnimales): AnimalItem[] {
  const termino = filtros.search?.trim().toLowerCase() ?? '';
  return items.filter((animal) => {
    if (termino) {
      const coincideArete = animal.arete.toLowerCase().includes(termino);
      const coincideNombre = animal.nombre.toLowerCase().includes(termino);
      const coincideRaza = animal.raza.toLowerCase().includes(termino);
      if (!coincideArete && !coincideNombre && !coincideRaza) return false;
    }
    if (filtros.sexo && animal.sexo !== filtros.sexo) return false;
    if (filtros.estado && animal.estado !== filtros.estado) return false;
    if (filtros.raza_id && String(animal.razaId ?? '') !== String(filtros.raza_id)) return false;
    if (filtros.potrero_id && String(animal.potreroId ?? '') !== String(filtros.potrero_id)) {
      return false;
    }
    return true;
  });
}

/**
 * Intenta construir la respuesta del listado a partir de la cache local.
 */
async function servirListadoDesdeCache(filtros: FiltrosAnimales): Promise<ListadoAnimales | null> {
  const cache = await cacheService.obtenerListado();
  if (!cache) return null;

  const filtrados = filtrarEnCache(cache.items, filtros);
  return {
    items: filtrados,
    paginacion: {
      ...cache.paginacion,
      paginaActual: 1,
      ultimaPagina: 1,
      total: filtrados.length,
    },
    hayMas: false,
    desdeCache: true,
    ultimaActualizacion: cache.updatedAt,
  };
}

export const animalService = {
  /**
   * Listado paginado con filtros y respaldo automatico en cache local cuando
   * no hay conectividad (Persona 4).
   */
  async listar(filtros: FiltrosAnimales = {}): Promise<ListadoAnimales> {
    const conectado = await networkService.verificarConectividad();

    if (!conectado) {
      const desdeCache = await servirListadoDesdeCache(filtros);
      if (desdeCache) return desdeCache;
    }

    try {
      const respuesta = await http.get<RespuestaListado>('/animales', {
        query: {
          page: filtros.page ?? 1,
          per_page: filtros.per_page ?? 15,
          search: filtros.search,
          sexo: filtros.sexo,
          estado: filtros.estado,
          raza_id: filtros.raza_id,
          potrero_id: filtros.potrero_id,
          sort_by: filtros.sort_by,
          order: filtros.order,
        },
      });

      const meta = respuesta.meta;
      const items = (respuesta.data ?? []).map(mapearAnimal);
      const paginacion: Paginacion = {
        paginaActual: meta?.current_page ?? 1,
        ultimaPagina: meta?.last_page ?? 1,
        porPagina: meta?.per_page ?? items.length,
        total: meta?.total ?? items.length,
      };

      // Persistir en la cache local el listado consultado con su marca de tiempo
      const sinFiltrosActivos =
        !filtros.search && !filtros.sexo && !filtros.estado && !filtros.raza_id && !filtros.potrero_id;

      let updatedAt: string;
      if ((filtros.page ?? 1) === 1 || sinFiltrosActivos) {
        const previo = (filtros.page ?? 1) > 1 ? await cacheService.obtenerListado() : null;
        const combinados = previo
          ? [...previo.items, ...items.filter((nuevo) => !previo.items.some((ant) => ant.id === nuevo.id))]
          : items;
        updatedAt = await cacheService.guardarListado(combinados, paginacion);
      } else {
        const previo = await cacheService.obtenerListado();
        updatedAt = previo?.updatedAt ?? (await cacheService.guardarListado(items, paginacion));
      }

      return {
        items,
        paginacion,
        hayMas: paginacion.paginaActual < paginacion.ultimaPagina,
        desdeCache: false,
        ultimaActualizacion: updatedAt,
      };
    } catch (error) {
      // Si fallo por red (modo avion o servidor inalcanzable), servir desde la cache local
      if (error instanceof ApiError && error.esDeRed) {
        const desdeCache = await servirListadoDesdeCache(filtros);
        if (desdeCache) return desdeCache;
      }
      throw error;
    }
  },

  /** Detalle por id. Incluye raza, potrero, pesajes y tratamientos. */
  async obtener(id: number | string): Promise<AnimalItem> {
    const resultado = await this.obtenerConCache(id);
    return resultado.item;
  },

  /**
   * Detalle por id con soporte offline desde la cache local (Persona 4).
   * Permite que `AnimalDetail.vue` funcione sin conexion y muestre el aviso de
   * datos no actualizados con su marca de tiempo.
   */
  async obtenerConCache(id: number | string): Promise<DetalleAnimalResultado> {
    const conectado = await networkService.verificarConectividad();

    if (!conectado) {
      const enCache = await cacheService.obtenerAnimalPorId(id);
      if (enCache) {
        return {
          item: enCache.item,
          desdeCache: true,
          ultimaActualizacion: enCache.updatedAt,
        };
      }
    }

    try {
      const respuesta = await http.get<{ data: AnimalApi }>(`/animales/${id}`);
      const mapeado = mapearAnimal(respuesta.data);
      const updatedAt = await cacheService.guardarDetalleAnimal(mapeado);

      return {
        item: mapeado,
        desdeCache: false,
        ultimaActualizacion: updatedAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.esDeRed) {
        const enCache = await cacheService.obtenerAnimalPorId(id);
        if (enCache) {
          return {
            item: enCache.item,
            desdeCache: true,
            ultimaActualizacion: enCache.updatedAt,
          };
        }
      }
      throw error;
    }
  },

  /** Registra un animal nuevo. */
  async crear(datos: NuevoAnimal): Promise<AnimalItem> {
    const respuesta = await http.post<{ data: AnimalApi }>('/animales', datos);
    const creado = mapearAnimal(respuesta.data);
    await cacheService.guardarDetalleAnimal(creado);
    return creado;
  },

  /**
   * Registra el peso inicial del animal.
   * POST /api/v1/animales/{id}/pesajes — el backend toma id_animal de la URL.
   */
  async registrarPesaje(idAnimal: number | string, pesoKg: number, observaciones?: string): Promise<void> {
    await http.post(`/animales/${idAnimal}/pesajes`, {
      peso_kg: pesoKg,
      fecha_pesaje: new Date().toISOString().slice(0, 10),
      observaciones: observaciones || null,
    });
  },

  /** Actualiza un animal existente. */
  async actualizar(id: number | string, datos: Partial<NuevoAnimal>): Promise<AnimalItem> {
    const respuesta = await http.put<{ data: AnimalApi }>(`/animales/${id}`, datos);
    const actualizado = mapearAnimal(respuesta.data);
    await cacheService.guardarDetalleAnimal(actualizado);
    return actualizado;
  },
};
