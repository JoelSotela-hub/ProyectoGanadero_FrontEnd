import { cacheService } from './cache.service';
import type { ApiLinks, ApiMeta } from './http';
import { ApiError, http } from './http';
import { networkService } from './network.service';

import type { AnimalItem } from '@/models/auth.model';

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
  pesajes?: {
    pesaje_id: number;
    peso_kg: number | string;
    fecha_pesaje: string | null;
    observaciones?: string | null;
  }[];
  codigo_qr?: string | null;
  tratamientos?: {
    tratamiento_id: number;
    nombre: string;
    descripcion?: string | null;
    tipo?: string | null;
    aplicacion?: {
      tratamiento_animal_id?: number;
      fecha_aplicacion?: string | null;
      dosis_ml?: number | string | null;
      observaciones?: string | null;
    };
    pivot?: { fecha_aplicacion?: string | null; dosis_ml?: number | string | null; observaciones?: string | null };
  }[];
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
  hayMas: boolean;
  desdeCache?: boolean;
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
  signal?: AbortSignal;
}

export interface NuevoAnimal {
  numero_arete: string;
  codigo_qr?: string | null;
  raza_id: number;
  potrero_id: number;
  sexo: 'Macho' | 'Hembra';
  fecha_nacimiento?: string | null;
  estado?: string | null;
}

function ultimoPeso(animal: AnimalApi): number | null {
  if (!animal.pesajes?.length) return null;
  const ordenados = [...animal.pesajes].sort((a, b) =>
    String(b.fecha_pesaje ?? '').localeCompare(String(a.fecha_pesaje ?? '')),
  );
  const peso = Number(ordenados[0]?.peso_kg);
  return Number.isFinite(peso) ? peso : null;
}

export function mapearAnimal(animal: AnimalApi): AnimalItem {
  const codigoQrNormalizado = animal.codigo_qr ?? `VACA-${animal.numero_arete}`;
  return {
    id: animal.id_animal,
    id_animal: animal.id_animal,
    arete: animal.numero_arete,
    nombre: animal.numero_arete,
    raza: animal.raza?.nombre ?? `Raza ${animal.raza_id}`,
    sexo: animal.sexo,
    potrero: animal.potrero?.nombre ?? `Potrero ${animal.potrero_id}`,
    peso: ultimoPeso(animal),
    estado: animal.estado ?? 'Activo',
    fechaNacimiento: animal.fecha_nacimiento ?? undefined,
    razaId: animal.raza_id,
    potreroId: animal.potrero_id,
    codigoQr: codigoQrNormalizado,
    codigo_qr: codigoQrNormalizado,
    pesajes: animal.pesajes?.map((p) => ({
      id: p.pesaje_id,
      pesoKg: Number(p.peso_kg),
      fecha: p.fecha_pesaje,
      observaciones: p.observaciones ?? null,
    })),
    tratamientos: animal.tratamientos?.map((t) => ({
      id: t.aplicacion?.tratamiento_animal_id ?? t.tratamiento_id,
      nombre: t.nombre,
      tipo: t.tipo ?? null,
      fechaAplicacion: t.aplicacion?.fecha_aplicacion ?? t.pivot?.fecha_aplicacion ?? null,
      dosisMl: t.aplicacion?.dosis_ml ?? t.pivot?.dosis_ml ?? null,
      observaciones: t.aplicacion?.observaciones ?? t.pivot?.observaciones ?? null,
    })),
  };
}

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
        signal: filtros.signal,
      });

      const meta = respuesta.meta;
      const items = (respuesta.data ?? []).map(mapearAnimal);
      const paginacion: Paginacion = {
        paginaActual: meta?.current_page ?? 1,
        ultimaPagina: meta?.last_page ?? 1,
        porPagina: meta?.per_page ?? items.length,
        total: meta?.total ?? items.length,
      };

      const sinFiltrosActivos =
        !filtros.search && !filtros.sexo && !filtros.estado && !filtros.raza_id && !filtros.potrero_id;

      let updatedAt: string;
      if (sinFiltrosActivos) {
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
      if (error instanceof ApiError && error.esDeRed) {
        const desdeCache = await servirListadoDesdeCache(filtros);
        if (desdeCache) return desdeCache;
      }
      throw error;
    }
  },

  async obtener(id: number | string): Promise<AnimalItem> {
    const resultado = await this.obtenerConCache(id);
    return resultado.item;
  },

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

  async obtenerPorQr(codigoQr: string): Promise<AnimalItem> {
    const respuesta = await http.get<{ data: AnimalApi }>(`/animales/qr/${encodeURIComponent(codigoQr.trim())}`);
    const mapeado = mapearAnimal(respuesta.data);
    await cacheService.guardarDetalleAnimal(mapeado);
    return mapeado;
  },

  async crear(datos: NuevoAnimal): Promise<AnimalItem> {
    const respuesta = await http.post<{ data: AnimalApi }>('/animales', datos);
    const creado = mapearAnimal(respuesta.data);
    await cacheService.guardarDetalleAnimal(creado);
    return creado;
  },

  async registrarPesaje(idAnimal: number | string, pesoKg: number, observaciones?: string): Promise<void> {
    await http.post(`/animales/${idAnimal}/pesajes`, {
      peso_kg: pesoKg,
      fecha_pesaje: new Date().toISOString().slice(0, 10),
      observaciones: observaciones || null,
    });
  },

  async actualizar(id: number | string, datos: Partial<NuevoAnimal>): Promise<AnimalItem> {
    const respuesta = await http.put<{ data: AnimalApi }>(`/animales/${id}`, datos);
    const actualizado = mapearAnimal(respuesta.data);
    await cacheService.guardarDetalleAnimal(actualizado);
    return actualizado;
  },
};
