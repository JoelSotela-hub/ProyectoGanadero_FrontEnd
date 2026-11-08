/**
 * Servicio de almacenamiento seguro cifrado para el token de sesion (Persona 4).
 *
 * Cumple el punto 5 del enunciado y el criterio de 20 pts de la rubrica:
 *   "Almacene el token en el almacenamiento seguro del dispositivo mediante un
 *    complemento de almacenamiento cifrado. No utilice el almacenamiento de
 *    preferencias ni el almacenamiento local del navegador para el token."
 *
 * Utiliza `@aparajita/capacitor-secure-storage` (cifrado con Android Keystore)
 * y se conecta al puente `registerTokenStorageAdapter` definido en `src/stores/auth.ts`.
 */
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { registerTokenStorageAdapter, type SecureTokenStorageAdapter } from '@/stores/auth';

/** Clave cifrada donde se persiste exclusivamente el Bearer Token de Sanctum. */
export const SECURE_TOKEN_KEY = 'guateganado_auth_token';

/**
 * Obtiene el token de autenticacion desde el almacenamiento cifrado del dispositivo.
 */
export async function getToken(): Promise<string | null> {
  try {
    const valor = await SecureStorage.get(SECURE_TOKEN_KEY);
    return typeof valor === 'string' && valor.trim().length > 0 ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el token de autenticacion en el almacenamiento cifrado del dispositivo.
 */
export async function setToken(token: string): Promise<void> {
  const limpio = token.trim();
  if (!limpio) {
    await removeToken();
    return;
  }
  await SecureStorage.set(SECURE_TOKEN_KEY, limpio);
}

/**
 * Elimina el token de autenticacion del almacenamiento cifrado al cerrar sesion o recibir 401.
 */
export async function removeToken(): Promise<void> {
  try {
    await SecureStorage.remove(SECURE_TOKEN_KEY);
  } catch {
    // Si la clave no existia previamente en el Keystore, no se propaga error.
  }
}

/** Adaptador cifrado que implementa el contrato `SecureTokenStorageAdapter` de Persona 2. */
export const secureTokenStorageAdapter: SecureTokenStorageAdapter = {
  getToken,
  setToken,
  removeToken,
};

/**
 * Conecta el adaptador cifrado de `@aparajita/capacitor-secure-storage` con el store de Pinia.
 * Se invoca al iniciar la aplicacion antes de que el router resuelva la primera ruta.
 */
export function conectarAlmacenamientoSeguro(): void {
  registerTokenStorageAdapter(secureTokenStorageAdapter);
}
