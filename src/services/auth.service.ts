import { ApiError, desenvolver, http } from './http';

import type { AuthSession, AuthUser, LoginCredentials, RegisterPayload } from '@/models/auth.model';

interface RespuestaLogin {
  message?: string;
  token: string;
}

export interface RespuestaRegistroUsuario {
  message?: string;
  usuario: AuthUser;
}

export const authService = {
  async registrar(datos: RegisterPayload): Promise<AuthUser> {
    const payload: RegisterPayload = {
      ...datos,
      name: datos.name.trim(),
      email: datos.email.trim().toLowerCase(),
    };

    const respuesta = await http.post<RespuestaRegistroUsuario>('/auth/register', payload);
    const usuario = respuesta?.usuario ?? desenvolver<AuthUser>(respuesta);

    if (!usuario || typeof usuario !== 'object' || !('email' in usuario)) {
      throw new ApiError(500, 'El servidor no devolvió los datos del usuario creado.');
    }

    return usuario;
  },

  async login(credenciales: LoginCredentials): Promise<AuthSession> {
    const respuesta = await http.post<RespuestaLogin>(
      '/auth/login',
      { email: credenciales.email.trim(), password: credenciales.password },
      { sinAutenticacion: true },
    );

    if (!respuesta?.token) {
      throw new ApiError(500, 'El servidor no devolvio un token de acceso.');
    }

    const usuario = await this.perfil(respuesta.token);

    return { token: respuesta.token, user: usuario };
  },

  async perfil(tokenExplicito?: string): Promise<AuthUser> {
    const cuerpo = await http.get<unknown>('/api/user', {
      rutaCompleta: true,
      tokenManual: tokenExplicito,
    });
    return desenvolver<AuthUser>(cuerpo);
  },

  async logout(): Promise<void> {
    try {
      await http.post<void>('/auth/logout');
    } catch {
      return;
    }
  },
};
