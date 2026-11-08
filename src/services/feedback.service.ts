/**
 * Mensajes al usuario (Persona 5): toasts y lectura uniforme de errores.
 *
 * Los errores de la API llegan como `ApiError` (cliente HTTP unico). Su
 * `message` ya contiene el campo `mensaje` del backend, por ejemplo el de un
 * 409 de regla de negocio: { error: 'Regla de Negocio', mensaje: '...' }.
 */
import { toastController } from '@ionic/vue';

import { ApiError } from './http';

export function mensajeDeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  if (error instanceof ApiError) {
    return error.primerErrorDeValidacion && error.status === 422 ? error.primerErrorDeValidacion : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return porDefecto;
}

export type ColorToast = 'success' | 'danger' | 'warning' | 'medium';

export async function mostrarToast(mensaje: string, color: ColorToast = 'medium', duracion = 3500): Promise<void> {
  const toast = await toastController.create({ message: mensaje, color, duration: duracion, position: 'top' });
  await toast.present();
}

export async function mostrarError(error: unknown, porDefecto?: string): Promise<void> {
  await mostrarToast(mensajeDeError(error, porDefecto), 'danger', 5000);
}

