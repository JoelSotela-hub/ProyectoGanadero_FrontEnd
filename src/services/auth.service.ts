/**
 * Servicio de autenticacion (Persona 3).
 *
 * El backend es Laravel con Sanctum:
 *   POST /api/v1/auth/login   -> { message, token }   (no devuelve el usuario)
 *   GET  /api/user            -> { data: { id, name, email, role } }
 *   POST /api/v1/auth/logout  -> 204
 *
 * Como el login solo entrega el token, se consulta el perfil inmediatamente
 * despues para armar el `AuthSession` que espera el store de Pinia.
 */
import { ApiError, desenvolver, http } from './http';

import type { AuthSession, AuthUser, LoginCredentials } from '@/models/auth.model';

interface RespuestaLogin {
  message?: string;
  token: string;
}

export const authService = {
  /**
   * Inicia sesion y devuelve la sesion completa (token + usuario).
   * No adjunta token saliente ni dispara el manejador de 401: un 401 aqui
   * significa credenciales incorrectas, no sesion expirada.
   */
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

  /**
   * Obtiene el usuario autenticado. Acepta un token explicito porque durante
   * el login todavia no se ha guardado en el store.
   */
  async perfil(tokenExplicito?: string): Promise<AuthUser> {
    // Ojo: esta ruta vive fuera del prefijo /api/v1, por eso lleva /api completo.
    const cuerpo = await http.get<unknown>('/api/user', {
      rutaCompleta: true,
      tokenManual: tokenExplicito,
    });
    return desenvolver<AuthUser>(cuerpo);
  },

  /**
   * Cierra la sesion en el servidor, revocando el token personal.
   * Si falla no se propaga: la sesion local se limpia igual.
   */
  async logout(): Promise<void> {
    try {
      await http.post<void>('/auth/logout');
    } catch {
      // El token pudo haber expirado; el cierre local ocurre de todos modos.
    }
  },
};
