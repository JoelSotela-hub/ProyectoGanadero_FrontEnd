export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export const ENDPOINTS = Object.freeze({
  AUTH: Object.freeze({
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
  }),

  ANIMALES: Object.freeze({
    BASE: '/animales',
    BY_ID: (animalId) => `/animales/${encodeURIComponent(animalId)}`,
    PESAJES: (animalId) => `/animales/${encodeURIComponent(animalId)}/pesajes`,
    TRATAMIENTOS: (animalId) => `/animales/${encodeURIComponent(animalId)}/tratamientos`,
  }),

  POTREROS: Object.freeze({
    BASE: '/potreros',
    BY_ID: (potreroId) => `/potreros/${encodeURIComponent(potreroId)}`,
    ANIMALES: (potreroId) => `/potreros/${encodeURIComponent(potreroId)}/animales`,
  }),

  RAZAS: Object.freeze({
    BASE: '/razas',
    BY_ID: (razaId) => `/razas/${encodeURIComponent(razaId)}`,
    ANIMALES: (razaId) => `/razas/${encodeURIComponent(razaId)}/animales`,
  }),

  PESAJES: Object.freeze({
    BASE: '/pesajes',
    BY_ID: (pesajeId) => `/pesajes/${encodeURIComponent(pesajeId)}`,
  }),

  TRATAMIENTOS: Object.freeze({
    BASE: '/tratamientos',
    BY_ID: (tratamientoId) => `/tratamientos/${encodeURIComponent(tratamientoId)}`,
  }),

  TRATAMIENTOS_APLICACIONES: Object.freeze({
    BASE: '/tratamientos-aplicaciones',
    BY_ID: (aplicacionId) => `/tratamientos-aplicaciones/${encodeURIComponent(aplicacionId)}`,
  }),

  INSUMOS: Object.freeze({
    BASE: '/insumos',
    BY_ID: (insumoId) => `/insumos/${encodeURIComponent(insumoId)}`,
  }),

  CATEGORIAS: Object.freeze({
    BASE: '/categorias',
    BY_ID: (categoriaId) => `/categorias/${encodeURIComponent(categoriaId)}`,
    INSUMOS: (categoriaId) => `/categorias/${encodeURIComponent(categoriaId)}/insumos`,
  }),

  UNIDADES_MEDIDA: Object.freeze({
    BASE: '/unidades-medida',
    BY_ID: (unidadId) => `/unidades-medida/${encodeURIComponent(unidadId)}`,
  }),
});


export const buildQueryParams = (params = {}) => {
  if (!params) return '';

  if (params instanceof URLSearchParams) {
    return params.toString();
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const normalized = String(value).trim();
    if (normalized !== '') {
      searchParams.append(key, normalized);
    }
  });

  return searchParams.toString();
};


export const withQueryParams = (endpoint, params = {}) => {
  const queryString = buildQueryParams(params);
  if (!queryString) return endpoint;

  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${queryString}`;
};
