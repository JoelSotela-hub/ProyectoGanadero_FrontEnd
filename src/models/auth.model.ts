export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  role?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AnimalItem {
  id: number;
  /** Alias directo al identificador primario del backend (`id_animal`). */
  id_animal?: number;
  arete: string;
  nombre: string;
  raza: string;
  sexo: 'Macho' | 'Hembra' | string;
  potrero: string;
  /** La API no expone un peso directo: sale del ultimo pesaje, y puede faltar. */
  peso: number | null;
  estado: 'Activo' | 'Tratamiento' | 'Vendido' | string;
  fechaNacimiento?: string;
  observaciones?: string;
  /** Identificadores reales que exige la API al crear o editar. */
  razaId?: number;
  potreroId?: number;
  ubicacionLat?: number;
  ubicacionLng?: number;
  fotoUrl?: string;
  /** Codigo del QR del animal (ej. VACA-001). */
  codigoQr?: string;
  codigo_qr?: string;
  /** Historial de pesajes y tratamientos; solo viene en el detalle y en la consulta por QR. */
  pesajes?: PesajeItem[];
  tratamientos?: TratamientoItem[];
}

export interface PesajeItem {
  id: number;
  pesoKg: number;
  fecha: string | null;
  observaciones?: string | null;
}

export interface TratamientoItem {
  id: number;
  nombre: string;
  tipo?: string | null;
  fechaAplicacion?: string | null;
  dosisMl?: number | string | null;
  observaciones?: string | null;
}
