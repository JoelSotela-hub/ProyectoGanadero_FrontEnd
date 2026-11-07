import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AuthSession, AuthUser, LoginCredentials } from '@/models/auth.model';

export interface SecureTokenStorageAdapter {
  getToken: () => Promise<string | null>;
  setToken: (token: string) => Promise<void>;
  removeToken: () => Promise<void>;
}

/**
 * Adaptador de almacenamiento del token.
 * La Persona 4 puede registrar aquí el plugin de almacenamiento seguro cifrado de Capacitor
 * llamando a `registerTokenStorageAdapter(...)` sin acoplar el router ni las vistas.
 */
let tokenStorageAdapter: SecureTokenStorageAdapter = {
  getToken: async () => null,
  setToken: async () => {},
  removeToken: async () => {},
};

export function registerTokenStorageAdapter(adapter: SecureTokenStorageAdapter): void {
  tokenStorageAdapter = adapter;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const initialized = ref<boolean>(false);

  /**
   * Estado reactivo requerido por el guardián de rutas (beforeEach).
   * El guardián consulta `authStore.isAuthenticated` directamente en lugar de leer almacenamiento.
   */
  const isAuthenticated = computed<boolean>(() => Boolean(token.value));

  /**
   * Inicia sesión y actualiza el estado compartido de Pinia y el almacenamiento seguro.
   * Soporta recibir una sesión completa (de la API de Persona 3) o credenciales (modo simulado).
   */
  async function login(payload: AuthSession | LoginCredentials): Promise<boolean> {
    if ('token' in payload) {
      token.value = payload.token;
      user.value = payload.user;
      await tokenStorageAdapter.setToken(payload.token);
      return true;
    }

    // Validación simulada mientras Persona 3 conecta el endpoint real de Laravel Sanctum
    const emailNormalized = payload.email.trim().toLowerCase();
    if (
      (emailNormalized === 'usuario@guateganado.cr' && payload.password === '123456') ||
      (emailNormalized === 'admin@guateganado.cr' && payload.password === '123456')
    ) {
      const mockToken = `sanctum_token_${Date.now()}`;
      token.value = mockToken;
      user.value = {
        id: 1,
        name: 'Administrador GuateGanado',
        email: emailNormalized,
        role: 'admin',
      };
      await tokenStorageAdapter.setToken(mockToken);
      return true;
    }

    return false;
  }

  /**
   * Cierra la sesión activa: limpia el estado reactivo y borra el token del almacenamiento.
   */
  async function logout(): Promise<void> {
    token.value = null;
    user.value = null;
    await tokenStorageAdapter.removeToken();
  }

  /**
   * Restaura la sesión al arrancar la aplicación antes de resolver la primera ruta (Persona 4).
   */
  async function restoreSession(): Promise<void> {
    if (initialized.value) return;
    try {
      const savedToken = await tokenStorageAdapter.getToken();
      if (savedToken) {
        token.value = savedToken;
        if (!user.value) {
          user.value = {
            id: 1,
            name: 'Usuario GuateGanado',
            email: 'usuario@guateganado.cr',
          };
        }
      }
    } finally {
      initialized.value = true;
    }
  }

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    login,
    logout,
    restoreSession,
  };
});
