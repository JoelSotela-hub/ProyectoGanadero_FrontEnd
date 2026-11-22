/**
 * Gestor centralizado del tema visual de GuateGanado (claro / oscuro).
 *
 * - Lee la preferencia guardada en `localStorage` (`gg_theme`); si no existe,
 *   respeta `prefers-color-scheme: dark` del sistema operativo.
 * - Aplica en `<html>` las marcas de tema oscuro: clases `ion-palette-dark` y
 *   `gg-dark`, atributo `data-theme="dark"` y `color-scheme` (controles nativos).
 * - Persiste cada cambio del usuario en `localStorage`.
 *
 * El estado vive a nivel de módulo (singleton reactivo, sin Pinia) para poder
 * aplicarse en `main.ts` antes de montar la app y evitar parpadeos.
 * Todas las APIs del navegador se consultan con guardas para que funcione en
 * SSR/tests (`jsdom` no implementa `matchMedia`).
 */
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

/** Preferencia explícita guardada por el usuario o `null` si nunca eligió. */
export function leerTemaGuardado(): Tema | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const valor = localStorage.getItem(CLAVE_TEMA);
    return esTemaValido(valor) ? valor : null;
  } catch {
    // Modo privado / almacenamiento bloqueado.
    return null;
  }
}

function guardarTema(tema: Tema): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // La preferencia sigue vigente en memoria.
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

/** Tema del sistema operativo; `light` como respaldo seguro (jsdom, navegadores antiguos). */
export function detectarTemaSistema(): Tema {
  return consultaSistema()?.matches ? 'dark' : 'light';
}

/** Tema con el que debe arrancar la app: preferencia guardada > sistema > claro. */
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

/**
 * Aplica el tema en `document.documentElement`.
 * Con `animar` añade temporalmente `gg-theme-transition` para un fundido suave
 * de colores (se omite si el usuario prefiere menos movimiento).
 */
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

/** Sigue al sistema mientras el usuario no haya elegido un tema explícito. */
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

/**
 * Resuelve y aplica el tema inicial. Se invoca en `main.ts` antes de montar la
 * app (idempotente: llamadas posteriores solo devuelven el tema vigente).
 */
export function inicializarTema(opciones: { forzar?: boolean } = {}): Tema {
  if (inicializado && !opciones.forzar) return temaActual.value;
  temaActual.value = resolverTemaInicial();
  aplicarTema(temaActual.value);
  escucharCambiosDelSistema();
  inicializado = true;
  return temaActual.value;
}

/** Cambia el tema, lo aplica con transición y lo persiste en `localStorage`. */
export function establecerTema(tema: Tema): void {
  if (!esTemaValido(tema)) return;
  temaActual.value = tema;
  aplicarTema(tema, { animar: true });
  guardarTema(tema);
}

/** Alterna claro ↔ oscuro y devuelve el nuevo tema. */
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

/** Acceso reactivo al tema desde componentes (sidebar, login, etc.). */
export function useTheme(): UseTheme {
  if (!inicializado) inicializarTema();
  return {
    tema: readonly(temaActual),
    esOscuro: computed<boolean>(() => temaActual.value === 'dark'),
    establecerTema,
    alternarTema,
  };
}
