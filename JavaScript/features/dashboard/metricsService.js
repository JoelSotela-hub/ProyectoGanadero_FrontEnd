/**
 * Servicio de métricas del Dashboard (Laboratorio 9 - Rol 6)
 * Consulta en paralelo varios recursos con Promise.allSettled():
 * si uno falla, los demás se muestran igual (sin bloquear la pantalla).
 *
 * Para contar sin descargar listados completos se pide ?per_page=1 y se lee
 * meta.total de la paginación uniforme del backend (App\Support\PaginacionUniforme).
 */
import { apiClient } from '../../core/api/ApiClient.js';
import { ENDPOINTS } from '../../core/api/endpoints.js';
import { fetchCurrentUser } from '../auth/authSession.js';

export const METRICAS = Object.freeze([
  { key: 'animales', endpoint: ENDPOINTS.ANIMALES.BASE },
  { key: 'potreros', endpoint: ENDPOINTS.POTREROS.BASE },
  { key: 'tratamientos', endpoint: ENDPOINTS.TRATAMIENTOS.BASE },
  { key: 'insumos', endpoint: ENDPOINTS.INSUMOS.BASE },
]);

/** Devuelve el total de registros de un recurso paginado. */
async function contarRecurso(endpoint, { signal } = {}) {
  const response = await apiClient.get(endpoint, { params: { per_page: 1 }, signal });
  return response?.meta?.total ?? response?.total ?? (Array.isArray(response?.data) ? response.data.length : 0);
}

/** Convierte un resultado de allSettled en el estado de una tarjeta. */
const aEstado = (result) =>
  result.status === 'fulfilled'
    ? { status: 'success', value: result.value, error: null }
    : { status: 'error', value: null, error: result.reason?.mensaje || result.reason?.message || 'Error desconocido' };

export const metricsService = {
  /**
   * Carga todas las métricas y el usuario actual en paralelo.
   * @returns {Promise<{ metricas: Object<string, {status, value, error}>, usuario: Object|null, abortado: boolean }>}
   */
  async obtenerTodo({ signal } = {}) {
    const [usuarioResult, ...metricasResults] = await Promise.allSettled([
      fetchCurrentUser({ signal }),
      ...METRICAS.map(({ endpoint }) => contarRecurso(endpoint, { signal })),
    ]);

    // Si la carga se canceló (el usuario salió de la página), no se actualiza nada.
    const abortado = [usuarioResult, ...metricasResults].some(
      (r) => r.status === 'rejected' && r.reason?.name === 'AbortError'
    );

    const metricas = Object.fromEntries(
      METRICAS.map(({ key }, index) => [key, aEstado(metricasResults[index])])
    );

    return {
      metricas,
      usuario: usuarioResult.status === 'fulfilled' ? usuarioResult.value : null,
      abortado,
    };
  },

  /** Reintenta una sola métrica (botón "Reintentar" de su tarjeta). */
  async obtenerMetrica(key, { signal } = {}) {
    const metrica = METRICAS.find((m) => m.key === key);
    if (!metrica) throw new Error(`Métrica desconocida: ${key}`);
    return await contarRecurso(metrica.endpoint, { signal });
  },
};
