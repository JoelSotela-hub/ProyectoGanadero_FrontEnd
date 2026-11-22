/**
 * Catalogos para los selectores del formulario (Persona 3).
 *
 * El registro de un animal exige `raza_id` y `potrero_id`, asi que el
 * formulario necesita las listas reales en lugar de texto libre.
 *   GET /api/v1/razas
 *   GET /api/v1/potreros
 */
import { http } from './http';

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

interface RazaApi {
  raza_id: number;
  nombre: string;
}

interface PotreroApi {
  potrero_id: number;
  nombre: string;
  capacidad_maxima?: number;
}

interface RespuestaCatalogo<T> {
  data: T[];
}

export const catalogoService = {
  async razas(): Promise<OpcionCatalogo[]> {
    const respuesta = await http.get<RespuestaCatalogo<RazaApi>>('/razas', {
      query: { per_page: 100, sort_by: 'nombre' },
    });
    return (respuesta.data ?? []).map((raza) => ({ id: raza.raza_id, nombre: raza.nombre }));
  },

  async potreros(): Promise<OpcionCatalogo[]> {
    const respuesta = await http.get<RespuestaCatalogo<PotreroApi>>('/potreros', {
      query: { per_page: 100 },
    });
    return (respuesta.data ?? []).map((potrero) => ({
      id: potrero.potrero_id,
      nombre: potrero.nombre,
    }));
  },
};
