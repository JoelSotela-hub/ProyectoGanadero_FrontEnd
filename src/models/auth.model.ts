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
}
