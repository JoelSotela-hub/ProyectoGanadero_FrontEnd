/**
 * Servicio de deteccion de red con `@capacitor/network` (Persona 4).
 *
 * Cumple el punto 6 del enunciado y la guia de reparto:
 *   "Deteccion de red con @capacitor/network: consultar el estado al arrancar y
 *    suscribirse a networkStatusChange... y que al recuperar la red se refresque solo."
 */
import type { ConnectionStatus } from '@capacitor/network';
import { Network } from '@capacitor/network';
import { readonly, ref } from 'vue';

const isOnline = ref<boolean>(true);
const connectionType = ref<string>('unknown');
let inicializado = false;

type ListenerCambioRed = (conectado: boolean) => void;
const suscriptores = new Set<ListenerCambioRed>();

function actualizarEstado(status: ConnectionStatus): void {
  const previo = isOnline.value;
  isOnline.value = Boolean(status.connected);
  connectionType.value = status.connectionType ?? 'unknown';

  if (previo !== isOnline.value) {
    suscriptores.forEach((fn) => {
      try {
        fn(isOnline.value);
      } catch {
        // Evitar que un suscriptor falle a los demas
      }
    });
  }
}

/**
 * Consulta el estado inicial de la red con `Network.getStatus()` y registra
 * el listener `networkStatusChange` una sola vez durante el ciclo de vida de la app.
 */
export async function inicializarMonitorDeRed(): Promise<void> {
  if (inicializado) return;
  inicializado = true;

  try {
    const estadoInicial = await Network.getStatus();
    actualizarEstado(estadoInicial);
  } catch {
    isOnline.value = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  try {
    await Network.addListener('networkStatusChange', (status) => {
      actualizarEstado(status);
    });
  } catch {
    // Respaldo para entornos de pruebas o navegadores sin bridge nativo
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => actualizarEstado({ connected: true, connectionType: 'wifi' }));
      window.addEventListener('offline', () => actualizarEstado({ connected: false, connectionType: 'none' }));
    }
  }
}

export const networkService = {
  /** Estado reactivo de solo lectura: true si hay conectividad activa. */
  isOnline: readonly(isOnline),
  /** Tipo de conexion actual ('wifi' | 'cellular' | 'none' | 'unknown'). */
  connectionType: readonly(connectionType),

  /**
   * Consulta activamente el estado actual de `@capacitor/network`.
   */
  async verificarConectividad(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      actualizarEstado(status);
      return isOnline.value;
    } catch {
      return isOnline.value;
    }
  },

  /**
   * Permite suscribirse a los cambios de conectividad (por ejemplo, para
   * refrescar automaticamente el listado o el detalle al recuperar la red).
   * Devuelve una funcion para cancelar la suscripcion al desmontar la vista.
   */
  suscribirCambioDeRed(callback: ListenerCambioRed): () => void {
    suscriptores.add(callback);
    return () => {
      suscriptores.delete(callback);
    };
  },

  /**
   * Utilidad para pruebas unitarias: permite simular cambios de estado de red.
   */
  establecerEstadoParaPruebas(conectado: boolean, tipo: ConnectionStatus['connectionType'] = 'wifi'): void {
    actualizarEstado({ connected: conectado, connectionType: tipo });
  },
};
