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
        return;
      }
    });
  }
}

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
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => actualizarEstado({ connected: true, connectionType: 'wifi' }));
      window.addEventListener('offline', () => actualizarEstado({ connected: false, connectionType: 'none' }));
    }
  }
}

export const networkService = {
  isOnline: readonly(isOnline),
  connectionType: readonly(connectionType),

  async verificarConectividad(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      actualizarEstado(status);
      return isOnline.value;
    } catch {
      return isOnline.value;
    }
  },

  suscribirCambioDeRed(callback: ListenerCambioRed): () => void {
    suscriptores.add(callback);
    return () => {
      suscriptores.delete(callback);
    };
  },

  establecerEstadoParaPruebas(conectado: boolean, tipo: ConnectionStatus['connectionType'] = 'wifi'): void {
    actualizarEstado({ connected: conectado, connectionType: tipo });
  },
};
