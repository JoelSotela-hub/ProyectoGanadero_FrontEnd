/**
 *
 * @param {HTMLElement} container - Contenedor en el DOM
 * @param {Object} meta - Metadatos de paginación (current_page / currentPage, last_page / lastPage, total)
 * @param {Function} onPageChange - Callback al cambiar de página
 */
export function renderPagination(container, meta = {}, onPageChange) {
  if (!container) return;

  // Soporta tanto camelCase como snake_case de Laravel
  const currentPage = Number(meta.currentPage ?? meta.current_page ?? 1);
  const lastPage = Number(meta.lastPage ?? meta.last_page ?? 1);
  const total = Number(meta.total ?? 0);

  // Si solo hay una página o ninguna, se limpia el contenedor
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

  // Función interna para sincronizar la página con URLSearchParams
  const sincronizarUrlYCambiarPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage || nuevaPagina === currentPage) return;

    // Manejo de parámetros de búsqueda con URLSearchParams
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);

    if (nuevaPagina > 1) {
      searchParams.set('page', nuevaPagina);
    } else {
      searchParams.delete('page');
    }

    const nuevaRuta = `${url.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    window.history.pushState({ page: nuevaPagina }, '', nuevaRuta);

    // Notificar al controlador de vista
    if (typeof onPageChange === 'function') {
      onPageChange(nuevaPagina);
    }
  };

  const prevBtn = container.querySelector('#btn-page-prev');
  const nextBtn = container.querySelector('#btn-page-next');

  if (prevBtn && !prevDisabled) {
    prevBtn.addEventListener('click', () => sincronizarUrlYCambiarPagina(currentPage - 1));
  }

  if (nextBtn && !nextDisabled) {
    nextBtn.addEventListener('click', () => sincronizarUrlYCambiarPagina(currentPage + 1));
  }
}