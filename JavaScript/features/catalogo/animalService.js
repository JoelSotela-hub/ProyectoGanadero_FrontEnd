/**
 * Servicio Asincrono para el Catalogo de Animales (Laboratorio 9 - Rol 3)
 * Consume el ApiClient centralizado con soporte para:
 * - Paginacion y filtros
 * - Cancelacion activa con AbortController (Signal)
 * - Manejo robusto de errores de red y HTTP
 */
import { apiClient } from '../../core/api/ApiClient.js';
import { ENDPOINTS } from '../../core/api/endpoints.js';

export const animalService = {
  /**
   * Obtiene el listado de ganado desde la API REST de Laravel
   * @param {Object} options - Parametros de consulta (page, search, potrero_id, signal)
   * @returns {Promise<Object>} Promesa con la respuesta de la API
   */
  async listarAnimales({ page = 1, search = '', potreroId = '', signal = null } = {}) {
    const params = {};
    if (page) params.page = page;
    if (search && search.trim() !== '') params.search = search.trim();
    if (potreroId) params.potrero_id = potreroId;

    try {
      const response = await apiClient.get(ENDPOINTS.ANIMALES.BASE, {
        params,
        signal
      });

      // Normaliza la respuesta para que la vista siempre reciba { data: [...], meta: {...} }
      if (Array.isArray(response)) {
        return {
          data: response,
          meta: { currentPage: page, lastPage: 1, total: response.length }
        };
      }

      return {
        data: response.data || [],
        meta: {
          currentPage: response.meta?.current_page || response.current_page || page,
          lastPage: response.meta?.last_page || response.last_page || 1,
          total: response.meta?.total ?? response.total ?? (response.data ? response.data.length : 0)
        }
      };
    } catch (error) {
      // Si fue cancelado por AbortController (Rol 4), relanzamos el error de abort
      if (error.name === 'AbortError') {
        throw error;
      }
      // Relanza la excepcion para que CatalogoView active el Estado 3 (Error + Reintento)
      throw error;
    }
  },

  /**
   * Obtiene la ficha completa de un animal por su ID
   * @param {number|string} id
   * @param {AbortSignal|null} signal
   */
  async obtenerPorId(id, signal = null) {
    if (!id) throw new Error('ID de animal requerido.');
    return await apiClient.get(ENDPOINTS.ANIMALES.BY_ID(id), { signal });
  }
};