/**
 * Store de Pinia para el módulo de Gestión de Usuarios (Fase 5 — exclusivo `admin`).
 *
 * Centraliza:
 *   - Listado de usuarios (`GET /api/v1/users`) con filtro reactivo por rol y búsqueda.
 *   - Creación de cuentas (`POST /api/v1/auth/register`) autenticada con el Bearer token del `admin`,
 *     esperando `{ message, usuario }` (SIN `token`) y SIN tocar `useAuthStore.login(...)`.
 *   - Manejo limpio de `ApiError` (`422` por campo, `403`, y errores generales).
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import type { Rol } from '@/config/roles';
import type { AuthUser, RegisterPayload } from '@/models/auth.model';
import { ApiError, mensajeDeError, usuarioService } from '@/services';

export type CampoFormUsuario = 'name' | 'email' | 'role' | 'password' | 'password_confirmation';

export const useUsuariosStore = defineStore('usuarios', () => {
  const usuarios = ref<AuthUser[]>([]);
  const cargando = ref<boolean>(false);
  const guardando = ref<boolean>(false);
  const error = ref<string>('');
  const filtroRol = ref<Rol | ''>('');
  const busqueda = ref<string>('');

  const errores = reactive<Record<CampoFormUsuario, string>>({
    name: '',
    email: '',
    role: '',
    password: '',
    password_confirmation: '',
  });
  const errorGeneral = ref<string>('');

  const usuariosFiltrados = computed<AuthUser[]>(() => {
    const termino = busqueda.value.trim().toLowerCase();
    const rol = filtroRol.value.trim().toLowerCase();

    return usuarios.value.filter((u) => {
      const rolUsuario = (u.role ?? '').toLowerCase();
      if (rol && rolUsuario !== rol) return false;

      if (termino) {
        const nombre = (u.name ?? '').toLowerCase();
        const correo = (u.email ?? '').toLowerCase();
        if (!nombre.includes(termino) && !correo.includes(termino) && !rolUsuario.includes(termino)) {
          return false;
        }
      }

      return true;
    });
  });

  const hayFiltrosActivos = computed<boolean>(() => Boolean(busqueda.value.trim() || filtroRol.value));

  function limpiarErrores(): void {
    errores.name = '';
    errores.email = '';
    errores.role = '';
    errores.password = '';
    errores.password_confirmation = '';
    errorGeneral.value = '';
  }

  function limpiarFiltros(): void {
    busqueda.value = '';
    filtroRol.value = '';
  }

  async function cargarUsuarios(): Promise<AuthUser[]> {
    cargando.value = true;
    error.value = '';
    try {
      const lista = await usuarioService.listar();
      usuarios.value = lista;
      return lista;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        error.value = err.message || 'No tienes permiso para consultar los usuarios.';
      } else {
        error.value = mensajeDeError(err, 'No se pudo cargar el listado de usuarios.');
      }
      usuarios.value = [];
      return [];
    } finally {
      cargando.value = false;
    }
  }

  /**
   * Crea un usuario vía `POST /api/v1/auth/register` usando el token del admin actual.
   * NUNCA llama a `authStore.login(...)` para preservar intacta la sesión del administrador.
   */
  async function crearUsuario(payload: RegisterPayload): Promise<AuthUser | null> {
    limpiarErrores();
    guardando.value = true;
    try {
      const creado = await usuarioService.crear(payload);

      const indiceExistente = usuarios.value.findIndex((u) => u.id === creado.id);
      if (indiceExistente >= 0) {
        usuarios.value.splice(indiceExistente, 1, creado);
      } else {
        usuarios.value = [creado, ...usuarios.value];
      }

      return creado;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(errores) as CampoFormUsuario[]).forEach((campo) => {
            errores[campo] = porCampo[campo] ?? '';
          });
          errorGeneral.value = err.message || 'Hay datos inválidos en el formulario.';
        } else if (err.status === 403) {
          errorGeneral.value = err.message || 'Solo un administrador puede registrar usuarios.';
        } else {
          errorGeneral.value = err.message || 'No se pudo crear el usuario.';
        }
      } else {
        errorGeneral.value = mensajeDeError(err, 'No se pudo crear el usuario.');
      }
      return null;
    } finally {
      guardando.value = false;
    }
  }

  function limpiarEstado(): void {
    usuarios.value = [];
    cargando.value = false;
    guardando.value = false;
    error.value = '';
    limpiarFiltros();
    limpiarErrores();
  }

  return {
    usuarios,
    cargando,
    guardando,
    error,
    filtroRol,
    busqueda,
    errores,
    errorGeneral,
    usuariosFiltrados,
    hayFiltrosActivos,
    limpiarErrores,
    limpiarFiltros,
    cargarUsuarios,
    crearUsuario,
    limpiarEstado,
  };
});
