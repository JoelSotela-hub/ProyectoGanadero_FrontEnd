export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  role?: 'admin' | 'veterinario' | 'operario' | string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'admin' | 'veterinario' | 'operario';
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AnimalItem {
  id: number;
  id_animal?: number;
  arete: string;
  nombre: string;
  raza: string;
  sexo: 'Macho' | 'Hembra' | string;
  potrero: string;
  peso: number | null;
  estado: 'Activo' | 'Tratamiento' | 'Vendido' | string;
  fechaNacimiento?: string;
  observaciones?: string;
  razaId?: number;
  potreroId?: number;
  ubicacionLat?: number;
  ubicacionLng?: number;
  codigoQr?: string;
  codigo_qr?: string;
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
