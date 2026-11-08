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

  constructor(status: number, message: string, errors: Record<string, string[]> = {}, esDeRed = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.esDeRed = esDeRed;
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

/** URL base del backend de Laravel, configurable por entorno. */
const BASE_URL: string = (import.meta.env.VITE_API_URL ?? 'http://10.0.2.2:8000').replace(/\/+$/, '');

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
    const mensaje =
      (datos.mensaje as string) ??
      (datos.message as string) ??
      (datos.error as string) ??
      `Error ${respuesta.status} al comunicarse con el servidor.`;
    const errores = (datos.errors as Record<string, string[]>) ?? {};
    throw new ApiError(respuesta.status, mensaje, errores);
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
