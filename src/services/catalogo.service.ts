/**
 * Catalogos para los selectores del formulario (Persona 3).
 *
 * El registro de un animal exige `raza_id` y `potrero_id`, asi que el
 * formulario necesita las listas reales en lugar de texto libre.
 *   GET /api/v1/razas
 *   GET /api/v1/potreros
 */
import type { ApiMeta } from './http';
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

/** Totales para las tarjetas del panel principal. */
export interface ConteosPanel {
  animales: number | null;
  potreros: number | null;
  tratamientos: number | null;
  insumos: number | null;
}

/**
 * Pide una sola fila de cada recurso y lee `meta.total`: es la forma barata
 * de obtener los totales sin descargar los listados completos.
 */
async function total(ruta: string): Promise<number | null> {
  try {
    const respuesta = await http.get<{ meta?: ApiMeta }>(ruta, { query: { per_page: 1 } });
    return respuesta.meta?.total ?? null;
  } catch {
    return null;
  }
}

export const panelService = {
  async conteos(): Promise<ConteosPanel> {
    const [animales, potreros, tratamientos, insumos] = await Promise.all([
      total('/animales'),
      total('/potreros'),
      total('/tratamientos'),
      total('/insumos'),
    ]);
    return { animales, potreros, tratamientos, insumos };
  },
};
