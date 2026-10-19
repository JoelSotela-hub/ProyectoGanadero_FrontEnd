/**
 * Sesión y autenticación (Laboratorio 9 - Rol 6)
 *
 * Responsabilidades:
 * - Iniciar y cerrar sesión contra Laravel Sanctum (POST /auth/login, /auth/logout).
 * - Recordar a qué página volver después de iniciar sesión.
 * - Proteger las páginas privadas: sin token -> login.html.
 * - Reaccionar a un 401 global emitido por el ApiClient (token expirado/revocado).
 */
import { apiClient } from '../../core/api/ApiClient.js';
import { ENDPOINTS } from '../../core/api/endpoints.js';
import {
  STORAGE_KEYS,
  setStorageItem,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
  removeStorageItem,
} from '../../core/utils/storage.js';

const LOGIN_PAGE = 'login.html';
const DEFAULT_HOME = 'dashboard.html';

/** Nombre del archivo HTML actual + query string (ej. "registro-animal.html?id=3"). */
const currentPage = () => {
  const file = window.location.pathname.split('/').pop() || DEFAULT_HOME;
  return `${file}${window.location.search}`;
};

/** Evita redirecciones abiertas: solo se aceptan páginas .html relativas del propio sitio. */
const isSafeRedirect = (target) =>
  typeof target === 'string' && /^[\w-]+\.html(\?[^#]*)?$/.test(target) && !target.startsWith(LOGIN_PAGE);

/**
 * Guarda la página actual y envía al usuario al login.
 * @param {Object} [options]
 * @param {'expired'|'required'} [options.reason] - Motivo que se muestra en el login.
 */
export function redirectToLogin({ reason = 'required' } = {}) {
  setSessionItem(STORAGE_KEYS.POST_LOGIN_REDIRECT, currentPage());
  window.location.assign(`${LOGIN_PAGE}?motivo=${encodeURIComponent(reason)}`);
}

/** Devuelve (y consume) la página a la que se debe volver tras el login. */
export function consumePostLoginRedirect() {
  const target = getSessionItem(STORAGE_KEYS.POST_LOGIN_REDIRECT, null);
  removeSessionItem(STORAGE_KEYS.POST_LOGIN_REDIRECT);
  return isSafeRedirect(target) ? target : DEFAULT_HOME;
}

/**
 * Inicia sesión y guarda el Bearer Token.
 * El backend responde: { message, token }.
 * @throws {ApiException} 401 credenciales incorrectas, 422 validación, 429 demasiados intentos.
 */
export async function login({ email, password }, { signal } = {}) {
  const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, { email, password }, { signal });

  if (!response?.token) {
    throw new Error('El servidor no devolvió un token de acceso.');
  }

  apiClient.setToken(response.token);
  return response;
}

/**
 * Obtiene el usuario autenticado (GET /api/user, fuera del prefijo /v1).
 * @returns {Promise<{id:number,name:string,email:string,role:string|null}>}
 */
export async function fetchCurrentUser({ signal } = {}) {
  const userUrl = `${apiClient.getBaseUrl().replace(/\/v\d+$/, '')}/user`;
  const user = await apiClient.get(userUrl, { signal });
  setStorageItem(STORAGE_KEYS.AUTH_USER, user);
  return user;
}

/** Revoca el token en el servidor (si aún es válido) y limpia la sesión local. */
export async function logout() {
  try {
    if (apiClient.hasToken()) {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT, {}, { skipUnauthorizedHook: true });
    }
  } catch (error) {
    // Si el token ya expiró, el servidor responde 401: igual cerramos la sesión local.
    console.warn('[authSession] Logout remoto no completado:', error?.message ?? error);
  } finally {
    apiClient.clearToken();
    removeStorageItem(STORAGE_KEYS.AUTH_USER);
    window.location.assign(LOGIN_PAGE);
  }
}

let guardInstalled = false;

/**
 * Protege una página privada:
 * 1. Si no hay token, redirige al login antes de pedir datos.
 * 2. Si cualquier petición recibe un 401, redirige al login con motivo "expired".
 *    (draftRecovery.js también escucha este 401 y guarda el formulario antes de salir).
 * @returns {boolean} true si la página puede continuar cargando.
 */
export function requireAuth() {
  if (!guardInstalled) {
    apiClient.onUnauthorized(() => redirectToLogin({ reason: 'expired' }));
    guardInstalled = true;
  }

  if (!apiClient.hasToken()) {
    redirectToLogin({ reason: 'required' });
    return false;
  }

  return true;
}
