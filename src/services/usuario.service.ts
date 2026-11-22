/**
 * Servicio de Gestión de Usuarios (Fase 5 — exclusivo para `admin`).
 *
 * Contrato Back-End en producción:
 *   - GET  /api/v1/users         -> 200 { data: UserResource[] } o UserResource[]
 *                                   ({ id, name, email, role, created_at, updated_at })
 *   - POST /api/v1/auth/register -> 201 { message, usuario: { id, name, email, role } } (SIN token)
 *
 * Ambos endpoints requieren `Authorization: Bearer <token>` y rol `admin`.
 */
import { authService } from './auth.service';
import { desenvolver, http } from './http';

import type { AuthUser, RegisterPayload } from '@/models/auth.model';

export const usuarioService = {
  /**
   * Lista los usuarios registrados en el sistema (`GET /api/v1/users`).
   * Soporta tanto respuesta envuelta en `{ data: AuthUser[] }` como arreglo directo `AuthUser[]`.
   */
  async listar(): Promise<AuthUser[]> {
    const cuerpo = await http.get<unknown>('/users');
    const desenvuelto = desenvolver<unknown>(cuerpo);
    return Array.isArray(desenvuelto) ? (desenvuelto as AuthUser[]) : [];
  },

  /**
   * Crea un nuevo usuario (`POST /api/v1/auth/register`) autenticado como `admin`.
   * Normaliza `name.trim()` y `email.trim().toLowerCase()`, y retorna el `AuthUser` creado
   * sin alterar la sesión actual del administrador.
   */
  async crear(datos: RegisterPayload): Promise<AuthUser> {
    return authService.registrar(datos);
  },
};
