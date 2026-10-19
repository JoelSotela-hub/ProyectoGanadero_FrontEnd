/**
 * Vista del Dashboard (Laboratorio 9 - Rol 6)
 * - El estado vive en el Store (Rol 2) bajo la clave "dashboard"; la vista solo
 *   se re-renderiza cuando el Store notifica un cambio (State-Driven UI).
 * - Cada tarjeta maneja sus propios estados: carga, datos o error + reintento.
 */
import { store } from '../../core/store/Store.js';
import { metricsService, METRICAS } from './metricsService.js';
import { logout } from '../auth/authSession.js';
import { ApiClient } from '../../core/api/ApiClient.js';

const LOADING = Object.freeze({ status: 'loading', value: null, error: null });
const numero = new Intl.NumberFormat('es-CR');

const saludoSegunHora = (fecha = new Date()) => {
  const hora = fecha.getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export class DashboardView {
  #root;
  #controller = null;

  constructor(rootSelector = '#main-content') {
    this.#root = document.querySelector(rootSelector);
  }

  async init() {
    if (!this.#root) return;

    store.subscribe((state) => this.render(state.dashboard));
    this.#bindEvents();
    this.#renderFecha();

    window.addEventListener('pagehide', () => this.#controller?.abort());

    await this.cargar();
  }

  /** Carga inicial: todas las tarjetas en paralelo. */
  async cargar() {
    this.#controller?.abort();
    this.#controller = new AbortController();

    store.setState({
      dashboard: {
        usuario: store.getState().dashboard?.usuario ?? null,
        metricas: Object.fromEntries(METRICAS.map(({ key }) => [key, LOADING])),
      },
    });

    const { metricas, usuario, abortado } = await metricsService.obtenerTodo({
      signal: this.#controller.signal,
    });
    if (abortado) return;

    store.setState((state) => ({
      dashboard: { ...state.dashboard, metricas, usuario: usuario ?? state.dashboard?.usuario ?? null },
    }));
  }

  /** Reintenta solo la tarjeta que falló, sin tocar las demás. */
  async reintentar(key) {
    this.#setMetrica(key, LOADING);
    try {
      const value = await metricsService.obtenerMetrica(key, { signal: this.#controller?.signal });
      this.#setMetrica(key, { status: 'success', value, error: null });
    } catch (error) {
      if (ApiClient.isAbortError(error)) return;
      this.#setMetrica(key, { status: 'error', value: null, error: error?.mensaje || error?.message });
    }
  }

  #setMetrica(key, estado) {
    store.setState((state) => ({
      dashboard: {
        ...state.dashboard,
        metricas: { ...state.dashboard?.metricas, [key]: estado },
      },
    }));
  }

  /** Render puro a partir del estado del Store. */
  render(dashboard) {
    if (!dashboard) return;

    const titulo = this.#root.querySelector('#dashboard-saludo');
    if (titulo) {
      const nombre = dashboard.usuario?.name?.split(' ')[0];
      titulo.textContent = nombre ? `${saludoSegunHora()}, ${nombre}` : saludoSegunHora();
    }

    Object.entries(dashboard.metricas ?? {}).forEach(([key, estado]) => {
      const card = this.#root.querySelector(`[data-metric="${key}"]`);
      if (!card) return;

      const valueEl = card.querySelector('.metric-value');
      const footEl = card.querySelector('.metric-foot');
      card.setAttribute('aria-busy', String(estado.status === 'loading'));
      card.classList.toggle('metric-card--error', estado.status === 'error');

      if (estado.status === 'loading') {
        valueEl.innerHTML = '<span class="skeleton-box metric-skeleton" aria-hidden="true"></span><span class="visually-hidden">Cargando…</span>';
        footEl.textContent = '';
      } else if (estado.status === 'success') {
        valueEl.textContent = numero.format(estado.value);
        footEl.textContent = 'Actualizado ahora';
      } else {
        valueEl.textContent = '—';
        footEl.innerHTML = '';
        const msg = document.createElement('span');
        msg.textContent = estado.error || 'No se pudo cargar.';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary btn-sm';
        btn.dataset.retry = key;
        btn.textContent = 'Reintentar';
        footEl.append(msg, btn);
      }
    });
  }

  #renderFecha() {
    const fechaEl = this.#root.querySelector('#dashboard-fecha');
    if (!fechaEl) return;
    const hoy = new Date();
    fechaEl.textContent = capitalizar(
      hoy.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    );
    fechaEl.setAttribute('datetime', hoy.toISOString().slice(0, 10));
  }

  #bindEvents() {
    this.#root.addEventListener('click', (event) => {
      const retryBtn = event.target.closest('[data-retry]');
      if (retryBtn) {
        this.reintentar(retryBtn.dataset.retry);
        return;
      }

      if (event.target.closest('#btn-logout')) {
        logout();
      }
    });
  }
}

new DashboardView().init();
