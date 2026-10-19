/**
 * Punto de entrada único de GuateGanado (Laboratorio 9)
 * Todas las páginas cargan solo este archivo:
 *   <script type="module" src="../JavaScript/main.js"></script>
 *
 * 1. En las páginas privadas carga authGuard.js: sin token -> login.html (y escucha los 401).
 * 2. Carga el módulo de la vista según la página actual (import dinámico),
 *    así cada página descarga solo el código que necesita.
 */
import { apiClient } from './core/api/ApiClient.js';

const PAGINAS_PUBLICAS = new Set(['login.html']);

/** Módulos de cada página. Para agregar una vista nueva, añada su import aquí. */
const VISTAS = {
  'login.html': [() => import('./features/auth/LoginView.js')],
  'dashboard.html': [() => import('./features/dashboard/DashboardView.js')],
  'animales.html': [() => import('./features/catalogo/CatalogoView.js')],
  'registro-animal.html': [
    () => import('./features/formulario/draftRecovery.js'),
    () => import('./features/catalogo/FormularioView.js'),
  ],
};

const paginaActual = () => window.location.pathname.split('/').pop() || 'dashboard.html';

async function iniciar() {
  const pagina = paginaActual();

  if (!PAGINAS_PUBLICAS.has(pagina)) {
    // authGuard.js protege la página; si no hay sesión ya redirigió al login
    // y no se carga la vista (evita peticiones que solo darían 401).
    await import('./features/auth/authGuard.js');
    if (!apiClient.hasToken()) return;
  }

  const modulos = VISTAS[pagina] ?? [];
  const resultados = await Promise.allSettled(modulos.map((cargar) => cargar()));

  resultados
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error(`[main] No se pudo cargar un módulo de ${pagina}:`, r.reason));
}

iniciar();
