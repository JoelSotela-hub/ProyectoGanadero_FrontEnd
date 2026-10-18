/**
 * Modulo Global de Estados Visuales de Interfaz (GuateGanado Core)
 * Reutilizable en todas las pantallas: Catalogo, Dashboard, Potreros, Pesajes, Tratamientos, Insumos.
 *
 * Gestiona los 4 estados de la UI:
 * - Estado 1: Carga (Skeletons accesibles con aria-busy="true")
 * - Estado 2: Vacio (Semantico, con titulo, descripcion y accion configurable)
 * - Estado 3: Error + Reintento (Alerta con role="alert" y callback interactivo)
 */

/**
 * ESTADO 1: Carga (Skeleton Shimmer configurable)
 * @param {HTMLElement} container - Contenedor en el DOM
 * @param {Object|number} options - Opciones de configuracion o numero de skeletons (retrocompatibilidad)
 */
export function renderLoadingSkeleton(container, options = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'true');

  const count = typeof options === 'number' ? options : (options.count || 6);
  const type = (typeof options === 'object' && options?.type) ? options.type : 'card';
  const customHtml = (typeof options === 'object' && options?.template) ? options.template : null;

  let skeletonItem = '';
  if (customHtml) {
    skeletonItem = customHtml;
  } else if (type === 'row' || type === 'table') {
    skeletonItem = `
      <div class="skeleton-row" aria-hidden="true" style="display:flex;gap:1rem;padding:0.75rem;margin-bottom:0.5rem;background:rgba(0,0,0,0.04);border-radius:6px;">
        <div class="skeleton-box" style="flex:1;height:1.25rem;"></div>
        <div class="skeleton-box" style="width:80px;height:1.25rem;"></div>
        <div class="skeleton-box" style="width:100px;height:1.25rem;"></div>
      </div>
    `;
  } else {
    // Tipo 'card' por defecto
    const cardClass = (typeof options === 'object' && options?.cardClass) ? options.cardClass : 'card-animal skeleton-card';
    skeletonItem = `
      <article class="${cardClass}" aria-hidden="true">
        <div class="skeleton-box skeleton-header"></div>
        <div class="skeleton-box skeleton-image"></div>
        <div class="skeleton-box skeleton-title"></div>
        <div class="skeleton-box skeleton-line"></div>
        <div class="skeleton-box skeleton-line short"></div>
        <div class="skeleton-box skeleton-footer"></div>
      </article>
    `;
  }

  container.innerHTML = skeletonItem.repeat(count);
}

/**
 * ESTADO 2: Vacio (Empty State configurable)
 * @param {HTMLElement} container - Contenedor en el DOM
 * @param {Object|string} options - Opciones o mensaje de texto (retrocompatibilidad)
 */
export function renderEmptyState(container, options = {}) {
  if (!container) return;
  container.removeAttribute('aria-busy');

  let title = 'Sin registros';
  let message = 'No se encontraron elementos con los criterios seleccionados.';
  let icon = '📋';
  let actionText = null;
  let actionUrl = null;
  let onAction = null;

  if (typeof options === 'string') {
    message = options;
    title = 'Catálogo sin resultados';
    icon = '🐂';
    actionText = 'Registrar Nuevo Animal';
    actionUrl = 'registro-animal.html';
  } else if (typeof options === 'object' && options !== null) {
    title = options.title || 'Sin registros';
    message = options.message || options.mensaje || 'No hay elementos para mostrar en esta vista o filtro.';
    icon = options.icon || '🔍';
    actionText = options.actionText || null;
    actionUrl = options.actionUrl || null;
    onAction = options.onAction || null;
  }

  const actionHtml = actionText && actionUrl
    ? `<a href="${actionUrl}" class="btn btn-primary btn-sm">${actionText}</a>`
    : (actionText && onAction ? `<button type="button" class="btn btn-primary btn-sm btn-state-action">${actionText}</button>` : '');

  container.innerHTML = `
    <div class="state-container state-empty" role="status">
      <div class="state-icon" aria-hidden="true">${icon}</div>
      <h3 class="state-title">${title}</h3>
      <p class="state-desc">${message}</p>
      ${actionHtml}
    </div>
  `;

  if (actionText && onAction && !actionUrl) {
    const actionBtn = container.querySelector('.btn-state-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onAction();
      });
    }
  }
}

/**
 * ESTADO 3: Error con Boton de Reintento configurable
 * @param {HTMLElement} container - Contenedor en el DOM
 * @param {Object|string} options - Opciones o mensaje de error (retrocompatibilidad)
 * @param {Function} [onRetryFallback] - Callback si se paso mensaje como string
 */
export function renderErrorState(container, options = {}, onRetryFallback = null) {
  if (!container) return;
  container.removeAttribute('aria-busy');

  let title = 'Error al cargar los datos';
  let message = 'No fue posible conectar con el servidor backend.';
  let icon = '⚠️';
  let retryText = '🔄 Reintentar conexión';
  let onRetry = onRetryFallback;

  if (typeof options === 'string') {
    message = options || message;
    title = 'Error de conexión';
  } else if (typeof options === 'object' && options !== null) {
    title = options.title || title;
    message = options.message || options.mensaje || message;
    icon = options.icon || icon;
    retryText = options.retryText || retryText;
    onRetry = options.onRetry || onRetryFallback;
  }

  const btnId = 'btn-retry-' + Math.random().toString(36).substring(2, 9);

  container.innerHTML = `
    <div class="state-container state-error" role="alert">
      <div class="state-icon" aria-hidden="true">${icon}</div>
      <h3 class="state-title">${title}</h3>
      <p class="state-desc">${message}</p>
      ${onRetry ? `
        <button type="button" class="btn btn-secondary btn-retry" id="${btnId}">
          ${retryText}
        </button>
      ` : ''}
    </div>
  `;

  if (onRetry) {
    const btnRetry = container.querySelector('#' + btnId);
    if (btnRetry) {
      btnRetry.addEventListener('click', (e) => {
        e.preventDefault();
        btnRetry.disabled = true;
        btnRetry.textContent = 'Reintentando conexión...';
        onRetry();
      });
    }
  }
}