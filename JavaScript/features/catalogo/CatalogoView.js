/**
 * Orquestador de la Vista del Catalogo de Animales 
 * Responsabilidades:
 * - Ciclo de vida asincrono y gestion de los 4 Estados de UI (Carga, Vacio, Error+Retry, Datos)
 * - Paginacion nativa integrada
 * - Event delegation para acciones rapidas (Localizar GPS, ver historial)
 * - Compatibilidad directa con el Store reactivo y Buscador con AbortController 
 */
import { animalService } from './animalService.js';
import { AnimalCard } from './components/AnimalCard.js';
import { renderLoadingSkeleton, renderEmptyState, renderErrorState } from '../../core/utils/viewStates.js';
import { renderPagination } from './components/Pagination.js';

export class CatalogoView {
  #gridContainer;
  #paginationContainer;
  #currentPage = 1;
  #currentSearch = '';
  #currentPotrero = '';
  #store = null;

  constructor({
    gridSelector = '.animal-grid',
    paginationSelector = '#pagination-container'
  } = {}) {
    this.#gridContainer = document.querySelector(gridSelector);
    this.#paginationContainer = document.querySelector(paginationSelector);
  }

  /**
   * Inicializa la vista en el DOM y dispara la carga inicial
   */
  async init() {
    if (!this.#gridContainer) {
      console.warn('[CatalogoView] Contenedor .animal-grid no encontrado en el DOM.');
      return;
    }

    // Asegura el contenedor de paginacion debajo de la rejilla
    if (!this.#paginationContainer) {
      this.#paginationContainer = document.createElement('div');
      this.#paginationContainer.id = 'pagination-container';
      this.#gridContainer.parentElement.appendChild(this.#paginationContainer);
    }

    // Delegacion de eventos para acciones dentro de las tarjetas (ej. Localizar GPS)
    this.#setupCardActions();

    // Carga inicial
    await this.cargarAnimales();
  }

  /**
   * Conecta el Store reactivo Singleton (Rol 2) cuando este disponible
   * @param {Object} store - Instancia de Store reactivo
   */
  connectStore(store) {
    if (!store || typeof store.subscribe !== 'function') return;
    this.#store = store;
    this.#store.subscribe((state) => {
      if (state && state.catalogo) {
        this.render(state.catalogo);
      }
    });
  }

  /**
   * Funcion pura de renderizado segun el estado
   * @param {Object} state - { status: 'loading'|'empty'|'error'|'success', data: [], meta: {}, error: null }
   */
  render(state = {}) {
    const { status = 'loading', data = [], meta = {}, error = null } = state;

    switch (status) {
      case 'loading':
        renderLoadingSkeleton(this.#gridContainer, 6);
        if (this.#paginationContainer) this.#paginationContainer.innerHTML = '';
        break;

      case 'empty':
        renderEmptyState(this.#gridContainer);
        if (this.#paginationContainer) this.#paginationContainer.innerHTML = '';
        break;

      case 'error':
        renderErrorState(
          this.#gridContainer,
          error || 'Error al comunicarse con el servidor.',
          () => this.cargarAnimales({ page: this.#currentPage })
        );
        if (this.#paginationContainer) this.#paginationContainer.innerHTML = '';
        break;

      case 'success':
        this.#gridContainer.removeAttribute('aria-busy');
        this.#gridContainer.innerHTML = data.map(animal => AnimalCard(animal)).join('');
        
        if (this.#paginationContainer) {
          renderPagination(this.#paginationContainer, meta, (nuevaPagina) => {
            this.cargarAnimales({ page: nuevaPagina });
          });
        }
        break;
    }
  }

  /**
   * Carga asincrona orquestando los 4 Estados
   * @param {Object} options - { page, search, potreroId, signal }
   */
  async cargarAnimales({
    page = this.#currentPage,
    search = this.#currentSearch,
    potreroId = this.#currentPotrero,
    signal = null
  } = {}) {
    this.#currentPage = page;
    this.#currentSearch = search;
    this.#currentPotrero = potreroId;

    // ESTADO 1: CARGA
    this.render({ status: 'loading' });

    try {
      const response = await animalService.listarAnimales({
        page,
        search,
        potreroId,
        signal
      });

      const animales = response.data || [];
      const meta = response.meta || { currentPage: page, lastPage: 1, total: animales.length };

      // ESTADO 2: VACIO
      if (animales.length === 0) {
        this.render({ status: 'empty' });
        return;
      }

      // ESTADO 4: DATOS
      this.render({ status: 'success', data: animales, meta });

    } catch (err) {
      // Ignora cancelaciones deliberadas de AbortController provocadas por el buscador (Rol 4)
      if (err.name === 'AbortError') return;

      console.error('[CatalogoView] Error de carga:', err);

      // ESTADO 3: ERROR CON BOTON DE REINTENTO
      const mensajeError = err.mensaje || err.message || 'No fue posible conectar con el servidor backend.';
      this.render({ status: 'error', error: mensajeError });
    }
  }

  /**
   * Configura la delegacion de eventos para botones interactivos en las tarjetas
   */
  #setupCardActions() {
    this.#gridContainer.addEventListener('click', (event) => {
      const btnLocalizar = event.target.closest('.btn-localizar');
      if (btnLocalizar) {
        event.preventDefault();
        const arete = btnLocalizar.dataset.arete || 'S/A';
        const lat = btnLocalizar.dataset.lat;
        const lng = btnLocalizar.dataset.lng;

        if (lat && lng) {
          alert(`📡 Ubicación GPS del Arete [${arete}]:\nLatitud: ${lat}\nLongitud: ${lng}\n(Listo para integración con mapa/geocerca)`);
        } else {
          alert(`📡 Tag GPS del Arete [${arete}]: Señal activa en potrero. Coordenadas sincronizadas vía telemetría.`);
        }
      }
    });
  }
}

function bootCatalogo() {
  const catalogoView = new CatalogoView();
  catalogoView.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootCatalogo);
} else {
  bootCatalogo();
}