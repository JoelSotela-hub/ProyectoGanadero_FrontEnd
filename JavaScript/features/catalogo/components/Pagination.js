/**
 * Componente nativo de Paginacion Accesible (Laboratorio 9 - Rol 3)
 * @param {HTMLElement} container - Contenedor en el DOM
 * @param {Object} options - Metadatos de paginacion (currentPage, lastPage, total)
 * @param {Function} onPageChange - Callback al cambiar de pagina
 */
export function renderPagination(container, { currentPage = 1, lastPage = 1, total = 0 } = {}, onPageChange) {
  if (!container) return;

  if (lastPage <= 1) {
    container.innerHTML = '';
    return;
  }

  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= lastPage ? 'disabled' : '';

  container.innerHTML = `
    <nav class="pagination-nav" aria-label="Navegación de páginas del catálogo">
      <button 
        type="button" 
        class="btn btn-secondary btn-sm" 
        id="btn-page-prev" 
        ${prevDisabled}
        aria-label="Ir a página anterior">
        &larr; Anterior
      </button>

      <span class="pagination-info" aria-live="polite">
        Página <strong>${currentPage}</strong> de <strong>${lastPage}</strong> (${total} animales)
      </span>

      <button 
        type="button" 
        class="btn btn-secondary btn-sm" 
        id="btn-page-next" 
        ${nextDisabled}
        aria-label="Ir a página siguiente">
        Siguiente &rarr;
      </button>
    </nav>
  `;

  const prevBtn = container.querySelector('#btn-page-prev');
  const nextBtn = container.querySelector('#btn-page-next');

  if (prevBtn && !prevDisabled && typeof onPageChange === 'function') {
    prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
  }

  if (nextBtn && !nextDisabled && typeof onPageChange === 'function') {
    nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
  }
}