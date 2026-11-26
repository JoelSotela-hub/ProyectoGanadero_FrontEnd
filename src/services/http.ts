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

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly esDeRed: boolean;
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

  get esReglaDeNegocio(): boolean {
    return this.status === 409;
  }

  get erroresPorCampo(): Record<string, string> {
    const resultado: Record<string, string> = {};
    for (const [campo, mensajes] of Object.entries(this.errors)) {
      if (mensajes?.[0]) resultado[campo] = mensajes[0];
    }
    return resultado;
  }

  get primerErrorDeValidacion(): string | null {
    const primera = Object.values(this.errors)[0];
    return primera?.[0] ?? null;
  }
}

type ProveedorDeToken = () => string | null;
type ManejadorNoAutorizado = () => void | Promise<void>;

let proveedorDeToken: ProveedorDeToken = () => null;
let manejadorNoAutorizado: ManejadorNoAutorizado | null = null;

export function registrarProveedorDeToken(fn: ProveedorDeToken): void {
  proveedorDeToken = fn;
}

export function registrarManejadorNoAutorizado(fn: ManejadorNoAutorizado): void {
  manejadorNoAutorizado = fn;
}

function resolverBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim();

  if (!raw) {
    throw new Error('Configuración ausente: define VITE_API_URL en tu archivo .env (ver .env.example).');
  }

  return raw.replace(/\/+$/, '').replace(/\/api(\/v1)?$/i, '');
}

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

function extraerMensaje(estado: number, datos: Record<string, unknown>): string {
  const mensaje = typeof datos.mensaje === 'string' ? datos.mensaje.trim() : '';
  if (mensaje) return mensaje;
  return MENSAJES_POR_ESTADO[estado] ?? `Error ${estado} al comunicarse con el servidor.`;
}

const BASE_URL: string = resolverBaseUrl();

const PREFIJO = '/api/v1';

const TIEMPO_LIMITE = 15000;

export interface OpcionesPeticion {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  sinAutenticacion?: boolean;
  rutaCompleta?: boolean;
  tokenManual?: string;
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

export function desenvolver<T>(cuerpo: unknown): T {
  if (cuerpo && typeof cuerpo === 'object' && 'data' in (cuerpo as Record<string, unknown>)) {
    return (cuerpo as { data: T }).data;
  }
  return cuerpo as T;
}

export { BASE_URL, PREFIJO };
