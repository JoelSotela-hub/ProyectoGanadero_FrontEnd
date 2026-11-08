/**
 * Servicio de Rondas de Inspeccion (Persona 5).
 *
 *   GET   /api/v1/rondas?page=&per_page=        Operario: propias | Admin: todas
 *   POST  /api/v1/rondas                        Inicia ronda (409 si ya hay una activa)
 *   GET   /api/v1/rondas/{id}                   Detalle con operador y puntos
 *   POST  /api/v1/rondas/{id}/puntos            Registra un potrero visitado
 *   PATCH /api/v1/rondas/{id}/finalizar         Cierra la ronda
 *
 * Reutiliza el cliente HTTP unico (`http.ts`): el token Bearer y el 401 se
 * gestionan alli. Los errores 409 llegan como `ApiError` cuyo `message` ya es
 * el campo `mensaje` del backend.
 */
import type { ApiMeta } from './http';
import { http } from './http';

import type { NuevoPuntoRonda, PuntoRonda, Ronda } from '@/models/ronda.model';

export interface ListadoRondas {
  items: Ronda[];
  paginaActual: number;
  ultimaPagina: number;
  total: number;
  hayMas: boolean;
}

interface RespuestaRondas {
  data: Ronda[];
  meta?: ApiMeta;
}

export const rondaService = {
  async listar(pagina = 1, porPagina = 15): Promise<ListadoRondas> {
    const respuesta = await http.get<RespuestaRondas>('/rondas', {
      query: { page: pagina, per_page: porPagina },
    });
    const meta = respuesta.meta;
    const paginaActual = meta?.current_page ?? pagina;
    const ultimaPagina = meta?.last_page ?? 1;
    return {
      items: respuesta.data ?? [],
      paginaActual,
      ultimaPagina,
      total: meta?.total ?? respuesta.data?.length ?? 0,
      hayMas: paginaActual < ultimaPagina,
    };
  },

  async obtener(id: number | string): Promise<Ronda> {
    const respuesta = await http.get<{ data: Ronda }>(`/rondas/${id}`);
    return respuesta.data;
  },

  /** Inicia una ronda. Lanza ApiError 409 si el operario ya tiene una en progreso. */
  async iniciar(observaciones?: string): Promise<Ronda> {
    const respuesta = await http.post<{ data: Ronda }>('/rondas', observaciones ? { observaciones } : {});
    return respuesta.data;
  },

  async registrarPunto(idRonda: number | string, punto: NuevoPuntoRonda): Promise<PuntoRonda> {
    const respuesta = await http.post<{ data: PuntoRonda }>(`/rondas/${idRonda}/puntos`, punto);
    return respuesta.data;
  },

  async finalizar(idRonda: number | string, observaciones?: string): Promise<Ronda> {
    const respuesta = await http.patch<{ data: Ronda }>(
      `/rondas/${idRonda}/finalizar`,
      observaciones ? { observaciones } : {},
    );
    return respuesta.data;
  },

  /**
   * Busca la ronda activa del operario autenticado (la primera `en_progreso`
   * del listado), para llevarlo a ella en lugar de crear otra.
   */
  async buscarActiva(): Promise<Ronda | null> {
    const listado = await this.listar(1, 50);
    return listado.items.find((ronda) => ronda.estado === 'en_progreso') ?? null;
  },
};

