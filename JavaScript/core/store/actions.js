/**
 * Acciones del Store (Laboratorio 9 - Rol 2)
 * Las vistas no modifican el estado directamente: llaman a estas acciones,
 * que consultan la API mediante el ApiClient y actualizan el Store.
 * El Store notifica a los suscriptores y cada vista se re-renderiza sola.
 *
 * Forma del estado de un recurso: store.getState()[key] =
 *   { status: 'loading' | 'success' | 'empty' | 'error', data, meta, error }
 * (es la misma forma que espera CatalogoView.connectStore() en state.catalogo).
 */
import { store } from './Store.js';
import { apiClient, ApiClient } from '../api/ApiClient.js';

/** Un AbortController por recurso: una carga nueva cancela la anterior. */
const controladores = new Map();

const actualizarRecurso = (key, cambios) => {
  store.setState((state) => ({
    [key]: { ...state[key], ...cambios },
  }));
};

export const actions = {
  setTheme(themeName) {
    store.setState({ theme: themeName });
  },

  /**
   * Carga un recurso de la API y lo guarda en el Store bajo `key`.
   * @param {string} key - Clave del estado (ej. 'catalogo').
   * @param {string} endpoint - Ruta del recurso (ej. ENDPOINTS.ANIMALES.BASE).
   * @param {Object} [params] - Query string (page, per_page, potrero_id...).
   * @example actions.fetchResource('catalogo', ENDPOINTS.ANIMALES.BASE, { page: 2 });
   */
  async fetchResource(key, endpoint, params = {}) {
    controladores.get(key)?.abort();
    const controller = new AbortController();
    controladores.set(key, controller);

    actualizarRecurso(key, { status: 'loading', error: null });

    try {
      const response = await apiClient.get(endpoint, { params, signal: controller.signal });
      const data = response?.data ?? response;
      const vacio = Array.isArray(data) && data.length === 0;

      actualizarRecurso(key, {
        status: vacio ? 'empty' : 'success',
        data,
        meta: response?.meta ?? null,
        error: null,
      });
    } catch (error) {
      // Una carga cancelada por otra más reciente no debe mostrar error.
      if (ApiClient.isAbortError(error)) return;

      actualizarRecurso(key, {
        status: 'error',
        error: error?.mensaje || error?.message || 'Error al comunicarse con el servidor.',
      });
    } finally {
      if (controladores.get(key) === controller) controladores.delete(key);
    }
  },

  /** Cancela la carga en curso de un recurso (ej. al salir de la vista). */
  cancelResource(key) {
    controladores.get(key)?.abort();
    controladores.delete(key);
  },
};
