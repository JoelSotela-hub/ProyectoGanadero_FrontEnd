import { authService } from './auth.service';
import { desenvolver, http } from './http';

import type { AuthUser, RegisterPayload } from '@/models/auth.model';

export const usuarioService = {
  async listar(): Promise<AuthUser[]> {
    const cuerpo = await http.get<unknown>('/users');
    const desenvuelto = desenvolver<unknown>(cuerpo);
    return Array.isArray(desenvuelto) ? (desenvuelto as AuthUser[]) : [];
  },

  async crear(datos: RegisterPayload): Promise<AuthUser> {
    return authService.registrar(datos);
  },
};
