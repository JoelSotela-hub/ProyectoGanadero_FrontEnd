/**
 * Controlador de Búsqueda Optimizada y Filtros (Lab 9 - Rol 4 )
 * Integra Debounce y Cancelación activa mediante AbortController.
 * Evita condiciones de carrera (Race Conditions) y optimiza el consumo de la API.
 */
import { debounce } from '../../core/utils/debounce.js';

export class SearchHandler {
  #inputSearch;
  #selectPotrero;
  #selectRaza;
  #selectSexo;
  #selectEstado;
  #form;
  #catalogoView;
  #activeAbortController = null;

  /**
   * @param {Object} options
   * @param {Object} options.catalogoView - Instancia de CatalogoView para invocar la recarga
   * @param {string} options.searchInputSelector - Selector del input de texto
   * @param {string} options.formSelector - Selector del formulario de filtros
   */
  constructor({
    catalogoView,
    searchInputSelector = '#input-busqueda',
    formSelector = '.filter-form'
  } = {}) {
    this.#catalogoView = catalogoView;
    this.#form = document.querySelector(formSelector);
    this.#inputSearch = document.querySelector(searchInputSelector);

    if (this.#form) {
      this.#selectPotrero = this.#form.querySelector('#filtro-potrero');
      this.#selectRaza = this.#form.querySelector('#filtro-raza');
      this.#selectSexo = this.#form.querySelector('#filtro-sexo');
      this.#selectEstado = this.#form.querySelector('#filtro-estado');
    }
  }

  /**
   * Inicializa los escuchadores de eventos para el input y los filtros
   */
  init() {
    if (!this.#catalogoView) {
      console.warn('[SearchHandler] Se requiere una instancia de CatalogoView.');
      return;
    }

    this.#setupFormSubmitPrevention();
    this.#setupSearchInput();
    this.#setupSelectFilters();
  }

  /**
   * Previene la recarga tradicional de página si el usuario presiona Enter en el formulario
   */
  #setupFormSubmitPrevention() {
    if (this.#form) {
      this.#form.addEventListener('submit', (e) => e.preventDefault());
    }
  }

  /**
   * Configura la búsqueda por texto aplicando Debounce de 300ms
   */
  #setupSearchInput() {
    if (!this.#inputSearch) return;

    // Se envuelve la ejecución en la función debounce desarrollada en el Paso 1
    const debouncedSearch = debounce(() => {
      this.ejecutarBusqueda();
    }, 300);

    this.#inputSearch.addEventListener('input', debouncedSearch);
  }

  /**
   * Configura la reacción inmediata ante cambios en los selectores de filtro
   */
  #setupSelectFilters() {
    const selects = [this.#selectPotrero, this.#selectRaza, this.#selectSexo, this.#selectEstado].filter(Boolean);

    selects.forEach((select) => {
      select.addEventListener('change', () => {
        // En los desplegables no se aplica debounce: el cambio es inmediato pero aborta peticiones previas
        this.ejecutarBusqueda();
      });
    });
  }

  /**
   * Cancela la petición anterior en vuelo y despacha la nueva consulta con una nueva señal
   */
  ejecutarBusqueda() {
    // 1. CANCELACIÓN ACTIVA: Si hay una petición en vuelo, la abortamos de inmediato
    if (this.#activeAbortController) {
      this.#activeAbortController.abort();
    }

    // 2. Creamos un nuevo AbortController para la nueva petición
    this.#activeAbortController = new AbortController();
    const { signal } = this.#activeAbortController;

    // 3. Recolectamos los criterios actuales de los controles
    const search = this.#inputSearch ? this.#inputSearch.value.trim() : '';
    const potreroId = this.#selectPotrero ? this.#selectPotrero.value : '';

    // 4. Invocamos a la vista pasando la página 1 y la señal de cancelación
    this.#catalogoView.cargarAnimales({
      page: 1,
      search,
      potreroId,
      signal
    });
  }
}

/**
 * Función helper para inicializar de forma limpia el SearchHandler
 * @param {Object} catalogoView 
 * @returns {SearchHandler}
 */
export function initSearchHandler(catalogoView) {
  const handler = new SearchHandler({ catalogoView });
  handler.init();
  return handler;
}