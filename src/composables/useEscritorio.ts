/** Reporta si el viewport es de escritorio (>= 992px, 62rem) y reacciona a cambios. */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

const CONSULTA = '(min-width: 992px)';

export function useEscritorio(): { esEscritorio: Ref<boolean> } {
  const esEscritorio = ref<boolean>(typeof window !== 'undefined' ? window.matchMedia(CONSULTA).matches : false);
  let lista: MediaQueryList | null = null;

  const actualizar = (evento: MediaQueryListEvent): void => {
    esEscritorio.value = evento.matches;
  };

  onMounted(() => {
    lista = window.matchMedia(CONSULTA);
    esEscritorio.value = lista.matches;
    lista.addEventListener('change', actualizar);
  });

  onBeforeUnmount(() => {
    lista?.removeEventListener('change', actualizar);
  });

  return { esEscritorio };
}
