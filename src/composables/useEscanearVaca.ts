import { ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';

import { ApiError, escanearQr, mostrarError, mostrarToast } from '@/services';
import { useAnimalDetalleStore } from '@/stores/animalDetalle';

export interface UsoEscanearVaca {
  escaneando: Ref<boolean>;
  escanearVaca: () => Promise<void>;
}

export function useEscanearVaca(): UsoEscanearVaca {
  const router = useRouter();
  const detalleStore = useAnimalDetalleStore();
  const escaneando = ref<boolean>(false);

  async function escanearVaca(): Promise<void> {
    if (escaneando.value) return;
    escaneando.value = true;

    let codigo: string | null = null;
    try {
      codigo = await escanearQr('Escanear QR de la vaca', 'VACA-001');
      if (!codigo) return;

      const animal = await detalleStore.buscarPorQr(codigo);
      await router.push(`/detalle/${animal.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await mostrarToast(`No existe ninguna vaca con el código "${codigo}".`, 'warning');
      } else {
        await mostrarError(error, 'No se pudo escanear el código QR.');
      }
    } finally {
      escaneando.value = false;
    }
  }

  return { escaneando, escanearVaca };
}
