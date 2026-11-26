import { Preferences } from '@capacitor/preferences';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AuthSession, AuthUser } from '@/models/auth.model';
import { authService } from '@/services/auth.service';

export interface SecureTokenStorageAdapter {
  getToken: () => Promise<string | null>;
  setToken: (token: string) => Promise<void>;
  removeToken: () => Promise<void>;
}

const CLAVE_USUARIO_LOCAL = 'guateganado_usuario';

async function guardarUsuarioLocal(usuario: AuthUser): Promise<void> {
  try {
    await Preferences.set({ key: CLAVE_USUARIO_LOCAL, value: JSON.stringify(usuario) });
  } catch {
    return;
  }
}

async function leerUsuarioLocal(): Promise<AuthUser | null> {
  try {
    const { value } = await Preferences.get({ key: CLAVE_USUARIO_LOCAL });
    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function borrarUsuarioLocal(): Promise<void> {
  try {
    await Preferences.remove({ key: CLAVE_USUARIO_LOCAL });
  } catch {
    return;
  }
}

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

  const isAuthenticated = computed<boolean>(() => Boolean(token.value));

  async function login(payload: AuthSession): Promise<boolean> {
    if (!payload?.token) {
      return false;
    }

    token.value = payload.token;
    user.value = payload.user;
    await tokenStorageAdapter.setToken(payload.token);
    await guardarUsuarioLocal(payload.user);
    return true;
  }

  async function logout(): Promise<void> {
    token.value = null;
    user.value = null;
    await tokenStorageAdapter.removeToken();
    await borrarUsuarioLocal();
  }

  async function restoreSession(): Promise<void> {
    if (initialized.value) return;
    try {
      const savedToken = await tokenStorageAdapter.getToken();
      if (savedToken) {
        token.value = savedToken;
        let primeraCarga = false;
        if (!user.value) {
          const local = await leerUsuarioLocal();
          if (local) {
            user.value = local;
          } else {
            primeraCarga = true;
          }
        }

        if (primeraCarga) {
          await refrescarPerfil(savedToken);
          user.value ??= { id: 0, name: 'Usuario GuateGanado', email: '' };
        } else {
          void refrescarPerfil(savedToken);
        }
      }
    } finally {
      initialized.value = true;
    }
  }

  async function refrescarPerfil(tokenActual: string): Promise<void> {
    try {
      const perfil = await authService.perfil(tokenActual);
      if (token.value === tokenActual) {
        user.value = perfil;
        await guardarUsuarioLocal(perfil);
      }
    } catch {
      return;
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
    refrescarPerfil,
  };
});
