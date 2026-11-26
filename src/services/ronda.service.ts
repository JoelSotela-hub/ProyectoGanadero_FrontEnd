import { crearCacheListado, listarConRespaldo } from './cacheListado';
import { http } from './http';

import type { EstadoRonda, NuevoPuntoRonda, PuntoRonda, Ronda } from '@/models/ronda.model';

export const CACHE_RONDAS_KEY = 'guateganado_rondas_cache_v1';

export interface FiltrosRondas {
  estado?: EstadoRonda | '';
  signal?: AbortSignal;
}

export interface ListadoRondas {
  items: Ronda[];
  paginaActual: number;
  ultimaPagina: number;
  total: number;
  hayMas: boolean;
  desdeCache: boolean;
  ultimaActualizacion: string | null;
}

const cacheRondas = crearCacheListado<Ronda>(CACHE_RONDAS_KEY);

export const rondaService = {
  async listar(pagina = 1, porPagina = 15, filtros: FiltrosRondas = {}): Promise<ListadoRondas> {
    const estado = filtros.estado || undefined;
    const resultado = await listarConRespaldo<Ronda, Ronda>({
      ruta: '/rondas',
      query: {
        page: pagina,
        per_page: porPagina,
        estado,
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros: !estado,
      mapear: (r) => r,
      clave: (r) => r.id,
      cache: cacheRondas,
    });

    return {
      items: resultado.data,
      paginaActual: resultado.meta.current_page,
      ultimaPagina: resultado.meta.last_page,
      total: resultado.meta.total,
      hayMas: resultado.hayMas,
      desdeCache: resultado.desdeCache,
      ultimaActualizacion: resultado.ultimaActualizacion,
    };
  },

  async obtener(id: number | string): Promise<Ronda> {
    const respuesta = await http.get<{ data: Ronda }>(`/rondas/${id}`);
    return respuesta.data;
  },

  async iniciar(observaciones?: string): Promise<Ronda> {
    const limpio = observaciones?.trim();
    const respuesta = await http.post<{ data: Ronda }>('/rondas', limpio ? { observaciones: limpio } : {});
    return respuesta.data;
  },

  async registrarPunto(idRonda: number | string, punto: NuevoPuntoRonda): Promise<PuntoRonda> {
    const payload: NuevoPuntoRonda = {
      codigo_qr: punto.codigo_qr.trim(),
      latitud: Number(punto.latitud),
      longitud: Number(punto.longitud),
      estado_potrero: punto.estado_potrero,
      ...(punto.observacion?.trim() ? { observacion: punto.observacion.trim() } : {}),
    };
    const respuesta = await http.post<{ data: PuntoRonda }>(`/rondas/${idRonda}/puntos`, payload);
    return respuesta.data;
  },

  async finalizar(idRonda: number | string, observaciones?: string): Promise<Ronda> {
    const limpio = observaciones?.trim();
    const respuesta = await http.patch<{ data: Ronda }>(
      `/rondas/${idRonda}/finalizar`,
      limpio ? { observaciones: limpio } : {},
    );
    return respuesta.data;
  },

  async buscarActiva(): Promise<Ronda | null> {
    const listado = await this.listar(1, 50, { estado: 'en_progreso' });
    return listado.items.find((ronda) => ronda.estado === 'en_progreso') ?? null;
  },

  async limpiarCache(): Promise<void> {
    await cacheRondas.limpiar();
  },
};
