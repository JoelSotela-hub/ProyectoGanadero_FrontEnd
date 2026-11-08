/**
 * Modelos de las Rondas de Inspeccion (Persona 5).
 * Reflejan exactamente `RondaResource` del backend. Ojo con las claves:
 * la ronda y sus puntos usan `id`, el potrero usa `potrero_id`.
 */

export type EstadoRonda = 'en_progreso' | 'completada';
export type EstadoPotrero = 'bueno' | 'regular' | 'requiere_atencion';

export interface PotreroRonda {
  potrero_id: number;
  nombre: string;
  codigo_qr?: string | null;
  hectareas_de_extension?: number | string | null;
  capacidad_maxima?: number | null;
  estado_pasto?: string | null;
}

export interface PuntoRonda {
  id: number;
  ronda_id: number;
  potrero_id: number;
  latitud: number | string;
  longitud: number | string;
  estado_potrero: EstadoPotrero;
  observacion: string | null;
  registrado_en: string;
  potrero?: PotreroRonda | null;
}

export interface OperadorRonda {
  id: number;
  name: string;
  email: string;
  role?: string | null;
}

export interface Ronda {
  id: number;
  user_id: number;
  operador?: OperadorRonda | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: EstadoRonda;
  observaciones: string | null;
  total_puntos: number;
  puntos?: PuntoRonda[];
}

/** Payload de POST /rondas/{ronda}/puntos. */
export interface NuevoPuntoRonda {
  codigo_qr: string;
  latitud: number;
  longitud: number;
  estado_potrero: EstadoPotrero;
  observacion?: string;
}

export const ETIQUETA_ESTADO_POTRERO: Record<EstadoPotrero, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  requiere_atencion: 'Requiere atención',
};

