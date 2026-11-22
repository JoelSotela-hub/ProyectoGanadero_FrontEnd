/**
 * Cliente HTTP unico de la aplicacion (Persona 3).
 *
 * Toda llamada a la API de GuateGanado pasa por aqui. Ninguna vista debe usar
 * `fetch` directamente: este modulo es el punto unico donde se
 *
 *   1. adjunta el token de Sanctum como `Authorization: Bearer ...`
 *   2. maneja la respuesta 401 cerrando la sesion y redirigiendo al login
 *   3. normaliza los errores de la API en un objeto `ApiError`
 *
 * El token y la accion de cierre de sesion se inyectan desde fuera
 * (ver `src/services/index.ts`) para no acoplar este modulo al store de Pinia
 * ni al router, y evitar dependencias circulares.
 */

/** Respuesta estandar de la API: { message, data, meta?, links? } */
export interface ApiEnvelope<T> {
  message?: string;
  data: T;
  meta?: ApiMeta;
  links?: ApiLinks;
}

export interface ApiMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

/** Error normalizado de la API. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly esDeRed: boolean;
  /** True si la peticion se cancelo a proposito (AbortController); no es un fallo real. */
  readonly cancelada: boolean;

  constructor(
    status: number,
    message: string,
    errors: Record<string, string[]> = {},
    esDeRed = false,
    cancelada = false,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.esDeRed = esDeRed;
    this.cancelada = cancelada;
  }

  /** 409 Conflict: toda ReglaNegocioException del backend (RN-01, RN-02, RN-03...). */
  get esReglaDeNegocio(): boolean {
    return this.status === 409;
  }

  /** Primer mensaje de cada campo con error 422: { campo: 'mensaje' }. */
  get erroresPorCampo(): Record<string, string> {
    const resultado: Record<string, string> = {};
    for (const [campo, mensajes] of Object.entries(this.errors)) {
      if (mensajes?.[0]) resultado[campo] = mensajes[0];
    }
    return resultado;
  }

  /** Primer mensaje de validacion, util para mostrar en un toast. */
  get primerErrorDeValidacion(): string | null {
    const primera = Object.values(this.errors)[0];
    return primera?.[0] ?? null;
  }
}

type ProveedorDeToken = () => string | null;
type ManejadorNoAutorizado = () => void | Promise<void>;

let proveedorDeToken: ProveedorDeToken = () => null;
let manejadorNoAutorizado: ManejadorNoAutorizado | null = null;

/** Registra de donde se lee el token en cada peticion (el store de Pinia). */
export function registrarProveedorDeToken(fn: ProveedorDeToken): void {
  proveedorDeToken = fn;
}

/** Registra que hacer cuando la API responde 401 (cerrar sesion y redirigir). */
export function registrarManejadorNoAutorizado(fn: ManejadorNoAutorizado): void {
  manejadorNoAutorizado = fn;
}

/**
 * Resuelve la URL base del backend de Laravel EXCLUSIVAMENTE desde
 * `import.meta.env.VITE_API_URL` (sin fallback a localhost, en ningun entorno).
 * Normaliza barras finales y cualquier sufijo `/api` o `/api/v1` para evitar duplicarlo,
 * ya que `http.ts` agrega `/api/v1` (o `/api/user` cuando `rutaCompleta` es true).
 */
function resolverBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim();

  if (!raw) {
    throw new Error('Configuración ausente: define VITE_API_URL en tu archivo .env (ver .env.example).');
  }

  return raw.replace(/\/+$/, '').replace(/\/api(\/v1)?$/i, '');
}

/** Mensajes de respaldo por codigo HTTP cuando el cuerpo no trae `mensaje`. */
const MENSAJES_POR_ESTADO: Record<number, string> = {
  400: 'Solicitud inválida.',
  401: 'No autenticado.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'La operación incumple una regla de negocio.',
  422: 'Hay datos inválidos en el formulario.',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
  500: 'Error interno del servidor. Inténtalo más tarde.',
};

/**
 * Parser uniforme de errores del backend (contrato seccion 0): todos los
 * codigos (400/401/403/404/409/422/429/500) traen `{ error, mensaje }`;
 * el texto para el usuario esta en `mensaje`, NO en `message`.
 */
function extraerMensaje(estado: number, datos: Record<string, unknown>): string {
  const mensaje = typeof datos.mensaje === 'string' ? datos.mensaje.trim() : '';
  if (mensaje) return mensaje;
  return MENSAJES_POR_ESTADO[estado] ?? `Error ${estado} al comunicarse con el servidor.`;
}

/** URL base del backend de Laravel, configurable por entorno. */
const BASE_URL: string = resolverBaseUrl();

/** Prefijo de version de la API: todas las rutas viven bajo /api/v1. */
const PREFIJO = '/api/v1';

/** Milisegundos antes de abortar una peticion colgada (red movil lenta). */
const TIEMPO_LIMITE = 15000;

export interface OpcionesPeticion {
  /** Parametros de consulta; los valores nulos o vacios se omiten. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Cuerpo JSON de la peticion. */
  body?: unknown;
  /** True en el login: no adjunta token ni dispara el cierre de sesion por 401. */
  sinAutenticacion?: boolean;
  /** Ruta absoluta que no lleva el prefijo /api/v1 (por ejemplo /api/user). */
  rutaCompleta?: boolean;
  /**
   * Token a usar en lugar del guardado en el store. Solo lo necesita el login:
   * en ese momento el token todavia no se ha guardado y hay que consultar el
   * perfil del usuario con el token recien emitido.
   */
  tokenManual?: string;
  /** Senal para cancelar la peticion (debounce de busquedas, salir de la vista). */
  signal?: AbortSignal;
}

function construirUrl(ruta: string, opciones: OpcionesPeticion): string {
  const base = opciones.rutaCompleta ? BASE_URL : BASE_URL + PREFIJO;
  const url = new URL(base + (ruta.startsWith('/') ? ruta : '/' + ruta));

  for (const [clave, valor] of Object.entries(opciones.query ?? {})) {
    if (valor === null || valor === undefined || valor === '') continue;
    url.searchParams.set(clave, String(valor));
  }

  return url.toString();
}

async function peticion<T>(metodo: string, ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const encabezados: Record<string, string> = {
    Accept: 'application/json',
  };

  if (opciones.body !== undefined) {
    encabezados['Content-Type'] = 'application/json';
  }

  // --- Interceptor de salida: adjunta el token en todas las peticiones ---
  const token = opciones.tokenManual ?? proveedorDeToken();
  if (token && !opciones.sinAutenticacion) {
    encabezados.Authorization = `Bearer ${token}`;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE);
  const alCancelar = (): void => controlador.abort();
  if (opciones.signal?.aborted) controlador.abort();
  opciones.signal?.addEventListener('abort', alCancelar, { once: true });

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, opciones), {
      method: metodo,
      headers: encabezados,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
      signal: controlador.signal,
    });
  } catch (error) {
    clearTimeout(temporizador);
    opciones.signal?.removeEventListener('abort', alCancelar);
    if (opciones.signal?.aborted) {
      throw new ApiError(0, 'Solicitud cancelada.', {}, false, true);
    }
    const abortada = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(
      0,
      abortada
        ? 'El servidor tardo demasiado en responder.'
        : 'No se pudo conectar con el servidor. Revisa tu conexion.',
      {},
      true,
    );
  }
  clearTimeout(temporizador);
  opciones.signal?.removeEventListener('abort', alCancelar);

  // --- Interceptor de entrada: 401 cierra la sesion en un solo lugar ---
  if (respuesta.status === 401 && !opciones.sinAutenticacion) {
    if (manejadorNoAutorizado) {
      await manejadorNoAutorizado();
    }
    throw new ApiError(401, 'Tu sesion expiro. Inicia sesion de nuevo.');
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  let cuerpo: unknown = null;
  const texto = await respuesta.text();
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = null;
    }
  }

  if (!respuesta.ok) {
    const datos = (cuerpo ?? {}) as Record<string, unknown>;
    const errores = respuesta.status === 422 ? ((datos.errors as Record<string, string[]>) ?? {}) : {};
    throw new ApiError(respuesta.status, extraerMensaje(respuesta.status, datos), errores);
  }

  return cuerpo as T;
}

export const http = {
  get: <T>(ruta: string, opciones?: OpcionesPeticion): Promise<T> => peticion<T>('GET', ruta, opciones),
  post: <T>(ruta: string, body?: unknown, opciones?: OpcionesPeticion): Promise<T> =>
    peticion<T>('POST', ruta, { ...opciones, body }),
  put: <T>(ruta: string, body?: unknown, opciones?: OpcionesPeticion): Promise<T> =>
    peticion<T>('PUT', ruta, { ...opciones, body }),
  patch: <T>(ruta: string, body?: unknown, opciones?: OpcionesPeticion): Promise<T> =>
    peticion<T>('PATCH', ruta, { ...opciones, body }),
  delete: <T>(ruta: string, opciones?: OpcionesPeticion): Promise<T> => peticion<T>('DELETE', ruta, opciones),
};

/**
 * Laravel envuelve los recursos en `data`. Algunos endpoints devuelven el
 * objeto plano; esta funcion acepta ambos casos.
 */
export function desenvolver<T>(cuerpo: unknown): T {
  if (cuerpo && typeof cuerpo === 'object' && 'data' in (cuerpo as Record<string, unknown>)) {
    return (cuerpo as { data: T }).data;
  }
  return cuerpo as T;
}

export { BASE_URL, PREFIJO };
