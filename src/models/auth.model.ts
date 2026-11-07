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
  peso: number;
  estado: 'Activo' | 'Tratamiento' | 'Vendido' | string;
  fechaNacimiento?: string;
  observaciones?: string;
  ubicacionLat?: number;
  ubicacionLng?: number;
  fotoUrl?: string;
}
