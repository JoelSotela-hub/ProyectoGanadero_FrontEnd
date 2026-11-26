import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue';

export type Tema = 'light' | 'dark';

export const CLAVE_TEMA = 'gg_theme';
export const CLASES_TEMA_OSCURO = ['ion-palette-dark', 'gg-dark'] as const;
const CLASE_TRANSICION = 'gg-theme-transition';
const DURACION_TRANSICION_MS = 450;
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

function esTemaValido(valor: unknown): valor is Tema {
  return valor === 'light' || valor === 'dark';
}

export function leerTemaGuardado(): Tema | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const valor = localStorage.getItem(CLAVE_TEMA);
    return esTemaValido(valor) ? valor : null;
  } catch {
    return null;
  }
}

function guardarTema(tema: Tema): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    return;
  }
}

function consultaSistema(): MediaQueryList | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(CONSULTA_OSCURO);
  } catch {
    return null;
  }
}

export function detectarTemaSistema(): Tema {
  return consultaSistema()?.matches ? 'dark' : 'light';
}

export function resolverTemaInicial(): Tema {
  return leerTemaGuardado() ?? detectarTemaSistema();
}

function prefiereMenosMovimiento(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  } catch {
    return false;
  }
}

let temporizadorTransicion: ReturnType<typeof setTimeout> | null = null;

export function aplicarTema(tema: Tema, opciones: { animar?: boolean } = {}): void {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  const oscuro = tema === 'dark';

  if (opciones.animar && !prefiereMenosMovimiento()) {
    raiz.classList.add(CLASE_TRANSICION);
    if (temporizadorTransicion) clearTimeout(temporizadorTransicion);
    temporizadorTransicion = setTimeout(() => {
      raiz.classList.remove(CLASE_TRANSICION);
      temporizadorTransicion = null;
    }, DURACION_TRANSICION_MS);
  }

  for (const clase of CLASES_TEMA_OSCURO) {
    raiz.classList.toggle(clase, oscuro);
  }
  raiz.setAttribute('data-theme', tema);
  raiz.style.colorScheme = tema;
}

const temaActual = ref<Tema>('light');
let inicializado = false;
let quitarEscuchaSistema: (() => void) | null = null;

function escucharCambiosDelSistema(): void {
  quitarEscuchaSistema?.();
  quitarEscuchaSistema = null;
  const consulta = consultaSistema();
  if (!consulta || typeof consulta.addEventListener !== 'function') return;

  const alCambiar = (evento: MediaQueryListEvent): void => {
    if (leerTemaGuardado()) return;
    temaActual.value = evento.matches ? 'dark' : 'light';
    aplicarTema(temaActual.value, { animar: true });
  };
  consulta.addEventListener('change', alCambiar);
  quitarEscuchaSistema = () => consulta.removeEventListener('change', alCambiar);
}

export function inicializarTema(opciones: { forzar?: boolean } = {}): Tema {
  if (inicializado && !opciones.forzar) return temaActual.value;
  temaActual.value = resolverTemaInicial();
  aplicarTema(temaActual.value);
  escucharCambiosDelSistema();
  inicializado = true;
  return temaActual.value;
}

export function establecerTema(tema: Tema): void {
  if (!esTemaValido(tema)) return;
  temaActual.value = tema;
  aplicarTema(tema, { animar: true });
  guardarTema(tema);
}

export function alternarTema(): Tema {
  const siguiente: Tema = temaActual.value === 'dark' ? 'light' : 'dark';
  establecerTema(siguiente);
  return siguiente;
}

export interface UseTheme {
  tema: Readonly<Ref<Tema>>;
  esOscuro: ComputedRef<boolean>;
  establecerTema: (tema: Tema) => void;
  alternarTema: () => Tema;
}

export function useTheme(): UseTheme {
  if (!inicializado) inicializarTema();
  return {
    tema: readonly(temaActual),
    esOscuro: computed<boolean>(() => temaActual.value === 'dark'),
    establecerTema,
    alternarTema,
  };
}
