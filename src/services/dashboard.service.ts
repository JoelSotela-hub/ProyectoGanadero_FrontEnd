import type { ApiMeta } from './http';
import { http } from './http';

export interface ConteosPanel {
  animales: number | null;
  potreros: number | null;
  tratamientos: number | null;
  pesajes: number | null;
  insumos: number | null;
}

export interface OpcionesConteos {
  tratamientos: boolean;
  insumos: boolean;
}

export interface PotreroCapacidad {
  id: number;
  nombre: string;
  capacidad: number;
  ocupados: number | null;
  porcentaje: number;
}

export interface PesajeReciente {
  id: number;
  idAnimal: number;
  arete: string;
  pesoKg: number;
  fecha: string | null;
  observaciones: string | null;
}

export interface AnimalReciente {
  id: number;
  arete: string;
  raza: string;
  potrero: string;
  estado: string;
  sexo: string;
}

interface Listado<T> {
  data?: T[];
  meta?: ApiMeta;
}

async function total(ruta: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const respuesta = await http.get<Listado<unknown>>(ruta, { query: { per_page: 1 }, signal });
    return respuesta.meta?.total ?? null;
  } catch {
    return null;
  }
}

export const dashboardService = {
  async conteos(opciones: OpcionesConteos, signal?: AbortSignal): Promise<ConteosPanel> {
    const [animales, potreros, tratamientos, pesajes, insumos] = await Promise.all([
      total('/animales', signal),
      total('/potreros', signal),
      opciones.tratamientos ? total('/tratamientos-aplicaciones', signal) : Promise.resolve(null),
      total('/pesajes', signal),
      opciones.insumos ? total('/insumos', signal) : Promise.resolve(null),
    ]);
    return { animales, potreros, tratamientos, pesajes, insumos };
  },

  async potrerosCapacidad(signal?: AbortSignal): Promise<PotreroCapacidad[]> {
    const respuesta = await http.get<
      Listado<{
        potrero_id: number;
        nombre: string;
        capacidad_maxima: number | string;
        ocupacion_actual?: number | null;
      }>
    >('/potreros', { query: { per_page: 3, sort_by: 'capacidad_maxima', order: 'desc' }, signal });

    return Promise.all(
      (respuesta.data ?? []).map(async (potrero) => {
        const capacidad = Number(potrero.capacidad_maxima) || 0;
        const tieneOcupacionDirecta =
          typeof potrero.ocupacion_actual === 'number' && Number.isFinite(potrero.ocupacion_actual);
        const ocupados = tieneOcupacionDirecta
          ? Math.max(0, potrero.ocupacion_actual!)
          : await total(`/potreros/${potrero.potrero_id}/animales`, signal);
        const porcentaje =
          ocupados !== null && capacidad > 0 ? Math.min(100, Math.round((ocupados / capacidad) * 100)) : 0;
        return { id: potrero.potrero_id, nombre: potrero.nombre, capacidad, ocupados, porcentaje };
      }),
    );
  },

  async pesajesRecientes(signal?: AbortSignal): Promise<PesajeReciente[]> {
    const respuesta = await http.get<
      Listado<{
        pesaje_id: number;
        id_animal: number;
        peso_kg: number | string;
        fecha_pesaje: string | null;
        observaciones?: string | null;
        animal?: { numero_arete: string } | null;
      }>
    >('/pesajes', { query: { per_page: 5 }, signal });

    return (respuesta.data ?? []).map((pesaje) => ({
      id: pesaje.pesaje_id,
      idAnimal: pesaje.id_animal,
      arete: pesaje.animal?.numero_arete ?? `#${pesaje.id_animal}`,
      pesoKg: Number(pesaje.peso_kg),
      fecha: pesaje.fecha_pesaje,
      observaciones: pesaje.observaciones ?? null,
    }));
  },

  async animalesRecientes(signal?: AbortSignal): Promise<AnimalReciente[]> {
    const respuesta = await http.get<
      Listado<{
        id_animal: number;
        numero_arete: string;
        sexo: string;
        estado: string | null;
        raza?: { nombre: string } | null;
        potrero?: { nombre: string } | null;
      }>
    >('/animales', { query: { per_page: 5, sort_by: 'id_animal', order: 'desc' }, signal });

    return (respuesta.data ?? []).map((animal) => ({
      id: animal.id_animal,
      arete: animal.numero_arete,
      raza: animal.raza?.nombre ?? '—',
      potrero: animal.potrero?.nombre ?? '—',
      estado: animal.estado ?? 'Activo',
      sexo: animal.sexo,
    }));
  },
};
