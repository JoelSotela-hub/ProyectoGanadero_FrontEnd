import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

import { registerTokenStorageAdapter, type SecureTokenStorageAdapter } from '@/stores/auth';

export const SECURE_TOKEN_KEY = 'guateganado_auth_token';

let webMemoryToken: string | null = null;

function leerTokenWebFallback(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const valor = window.sessionStorage.getItem(SECURE_TOKEN_KEY);
      if (valor && valor.trim().length > 0) return valor;
    }
  } catch {
    return webMemoryToken;
  }
  return webMemoryToken;
}

function guardarTokenWebFallback(token: string): void {
  webMemoryToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(SECURE_TOKEN_KEY, token);
    }
  } catch {
    return;
  }
}

function borrarTokenWebFallback(): void {
  webMemoryToken = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SECURE_TOKEN_KEY);
    }
  } catch {
    return;
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const valor = await SecureStorage.get(SECURE_TOKEN_KEY);
    if (typeof valor === 'string' && valor.trim().length > 0) {
      return valor;
    }
  } catch {
    return !Capacitor.isNativePlatform() ? leerTokenWebFallback() : null;
  }

  return !Capacitor.isNativePlatform() ? leerTokenWebFallback() : null;
}

export async function setToken(token: string): Promise<void> {
  const limpio = token.trim();
  if (!limpio) {
    await removeToken();
    return;
  }

  try {
    await SecureStorage.set(SECURE_TOKEN_KEY, limpio);
  } catch {
    if (!Capacitor.isNativePlatform()) {
      guardarTokenWebFallback(limpio);
    }
  }
}

export async function removeToken(): Promise<void> {
  try {
    await SecureStorage.remove(SECURE_TOKEN_KEY);
  } catch {
    return;
  } finally {
    if (!Capacitor.isNativePlatform()) {
      borrarTokenWebFallback();
    }
  }
}

export const secureTokenStorageAdapter: SecureTokenStorageAdapter = {
  getToken,
  setToken,
  removeToken,
};

export function conectarAlmacenamientoSeguro(): void {
  registerTokenStorageAdapter(secureTokenStorageAdapter);
}
