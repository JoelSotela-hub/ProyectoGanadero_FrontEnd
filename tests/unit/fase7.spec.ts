import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import App from '@/App.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import {
  alternarTema,
  CLASES_TEMA_OSCURO,
  CLAVE_TEMA,
  inicializarTema,
  useTheme,
} from '@/composables/useTheme';
import { http, networkService } from '@/services';
import { useAnimalesStore } from '@/stores/animales';
import { useAuthStore } from '@/stores/auth';
import { usePotreroStore } from '@/stores/potrero';
import { construirNombreArchivoCsv, exportarCsv, generarCsv, type ColumnaCsv } from '@/utils/csv';
import Animal from '@/views/Animal.vue';
import LoginPage from '@/views/LoginPage.vue';
import Potreros from '@/views/Potreros.vue';

const mockPreferencesStore = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: mockPreferencesStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockPreferencesStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      mockPreferencesStore.delete(key);
    }),
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(async () => ({ connected: true, connectionType: 'wifi' })),
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

const mockToastCreate = vi.fn(async (opts: Record<string, unknown>) => ({
  opts,
  present: vi.fn(async () => undefined),
}));

vi.mock('@ionic/vue', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    toastController: {
      create: (opts: Record<string, unknown>) => mockToastCreate(opts),
    },
    onIonViewWillEnter: vi.fn(),
    onIonViewWillLeave: vi.fn(),
    useBackButton: vi.fn(),
  };
});

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginPage },
      { path: '/tabs/dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/tabs/animales', component: Animal },
      { path: '/tabs/potreros', component: Potreros },
      { path: '/potreros/:id', component: { template: '<div>Detalle Potrero</div>' } },
      { path: '/detalle/:id', component: { template: '<div>Detalle Animal</div>' } },
      { path: '/tabs/registro', component: { template: '<div>Registro</div>' } },
      { path: '/tabs/rondas', component: { template: '<div>Rondas</div>' } },
      { path: '/tabs/pesajes', component: { template: '<div>Pesajes</div>' } },
      { path: '/tabs/tratamientos', component: { template: '<div>Tratamientos</div>' } },
      { path: '/tabs/insumos', component: { template: '<div>Insumos</div>' } },
      { path: '/tabs/catalogos', component: { template: '<div>Catalogos</div>' } },
      { path: '/tabs/usuarios', component: { template: '<div>Usuarios</div>' } },
    ],
  });
}

function crearMockMatchMedia(oscuridadPorDefecto = false) {
  return vi.fn((query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') ? oscuridadPorDefecto : true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function leerBlobComoTexto(blob: Blob): Promise<string> {
  const buffer =
    typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);
}

describe('Fase 7 — Modo claro/oscuro, transición de arranque y exportación a CSV', () => {
  const originalMatchMedia = window.matchMedia;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPreferencesStore.clear();
    mockToastCreate.mockClear();
    localStorage.clear();

    document.documentElement.classList.remove(...CLASES_TEMA_OSCURO, 'gg-theme-transition');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });

    inicializarTema({ forzar: true });
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  test('1. generarCsv y exportarCsv aplican BOM UTF-8, escapan caracteres especiales y descargan con fecha', async () => {
    interface FilaPrueba {
      nombre: string;
      detalle: string | null | undefined;
      nota?: string;
    }

    const columnas: ColumnaCsv<FilaPrueba>[] = [
      { encabezado: 'Nombre', valor: (f) => f.nombre },
      { encabezado: 'Detalle', valor: (f) => f.detalle },
      { encabezado: 'Nota', valor: (f) => f.nota },
    ];

    const filas: FilaPrueba[] = [
      { nombre: 'Cabaña "San José"', detalle: 'Pasto húmedo, lote #1', nota: 'Línea 1\nLínea 2' },
      { nombre: 'Potrero Ñandú', detalle: null, nota: undefined },
    ];

    const csv = generarCsv(columnas, filas);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Cabaña ""San José""');
    expect(csv).toContain('"Pasto húmedo, lote #1"');
    expect(csv).toContain('"Línea 1\nLínea 2"');
    expect(csv).toContain('Potrero Ñandú,,');

    const fechaFija = new Date(2026, 10, 22, 10, 30, 0);
    expect(construirNombreArchivoCsv('potreros', fechaFija)).toBe('potreros_2026-11-22.csv');

    let blobCapturado: Blob | null = null;
    let nombreDescarga = '';
    const createObjectUrlSpy = vi.fn((blob: Blob) => {
      blobCapturado = blob;
      return 'blob:gg-csv-test';
    });
    const revokeObjectUrlSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeObjectUrlSpy;

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        nombreDescarga = this.download;
      });

    const resultado = exportarCsv('potreros', columnas, filas, fechaFija);

    expect(resultado.nombreArchivo).toBe('potreros_2026-11-22.csv');
    expect(resultado.totalFilas).toBe(2);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(nombreDescarga).toBe('potreros_2026-11-22.csv');
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:gg-csv-test');
    expect(blobCapturado).toBeInstanceOf(Blob);
    const contenidoBlob = await leerBlobComoTexto(blobCapturado!);
    expect(contenidoBlob).toBe(csv);
    const bytes = new Uint8Array(await blobCapturado!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  test('2. useTheme inicializa desde localStorage o matchMedia (con fallback jsdom), alterna y persiste', () => {
    // Fallback seguro cuando window.matchMedia no existe en jsdom
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(inicializarTema({ forzar: true })).toBe('light');
    expect(document.documentElement.classList.contains('gg-dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Respeta prefers-color-scheme: dark cuando no hay clave en localStorage
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: crearMockMatchMedia(true),
    });
    expect(inicializarTema({ forzar: true })).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(document.documentElement.classList.contains('gg-dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Prioriza localStorage sobre el sistema
    localStorage.setItem(CLAVE_TEMA, 'light');
    expect(inicializarTema({ forzar: true })).toBe('light');
    expect(document.documentElement.classList.contains('gg-dark')).toBe(false);

    // Alterna light <-> dark y persiste en localStorage
    const { tema, esOscuro } = useTheme();
    expect(tema.value).toBe('light');
    expect(esOscuro.value).toBe(false);

    expect(alternarTema()).toBe('dark');
    expect(tema.value).toBe('dark');
    expect(esOscuro.value).toBe(true);
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(document.documentElement.classList.contains('gg-dark')).toBe(true);

    expect(alternarTema()).toBe('light');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light');
    expect(document.documentElement.classList.contains('gg-dark')).toBe(false);
  });

  test('3. AppSidebar.vue y LoginPage.vue exponen toggle accesible de tema que actualiza DOM y localStorage', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: crearMockMatchMedia(false),
    });
    inicializarTema({ forzar: true });

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Kevin Admin', email: 'kevin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/tabs/dashboard');
    await router.isReady();

    const sidebar = mount(AppSidebar, { global: { plugins: [router] } });
    const btnSidebar = sidebar.get('[data-testid="btn-toggle-theme"]');
    expect(btnSidebar.attributes('aria-label')).toBe('Cambiar a modo oscuro');
    expect(btnSidebar.attributes('aria-pressed')).toBe('false');

    await btnSidebar.trigger('click');
    await nextTick();

    expect(btnSidebar.attributes('aria-label')).toBe('Cambiar a modo claro');
    expect(btnSidebar.attributes('aria-pressed')).toBe('true');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark');
    expect(document.documentElement.classList.contains('gg-dark')).toBe(true);
    sidebar.unmount();

    const loginWrapper = mount(LoginPage, { global: { plugins: [router] } });
    const btnLogin = loginWrapper.get('[data-testid="btn-toggle-theme-login"]');
    expect(btnLogin.attributes('aria-pressed')).toBe('true');

    await btnLogin.trigger('click');
    await nextTick();
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light');
    expect(document.documentElement.classList.contains('gg-dark')).toBe(false);
    loginWrapper.unmount();
  });

  test('4. Potreros.vue y Animal.vue incluyen botón Exportar CSV funcional y deshabilitado cuando no hay filas', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-csv');
    URL.revokeObjectURL = vi.fn();

    let ultimoBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((obj: Blob | MediaSource) => {
      ultimoBlob = obj as Blob;
      return 'blob:mock-csv';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Veterinaria', email: 'vet@finca.gt', role: 'veterinario' };

    const router = crearRouterPruebas();
    await router.push('/tabs/potreros');
    await router.isReady();

    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [
        {
          potrero_id: 1,
          nombre: 'Potrero La Cañada',
          codigo_qr: 'POT-001',
          hectareas_de_extension: 15.5,
          capacidad_maxima: 20,
          estado_pasto: 'Excelente',
          ocupacion_actual: 12,
          espacios_disponibles: 8,
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const potreroWrapper = mount(Potreros, { global: { plugins: [router] } });
    await flushPromises();

    const btnExportarPotreros = potreroWrapper.get('[data-testid="btn-exportar-csv"]');
    expect((btnExportarPotreros.element as HTMLButtonElement).disabled).toBe(false);

    await btnExportarPotreros.trigger('click');
    await flushPromises();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-csv');
    const csvPotreros = await leerBlobComoTexto(ultimoBlob!);
    expect(csvPotreros.startsWith('\uFEFF')).toBe(true);
    expect(csvPotreros).toContain('Nombre,Extensión (ha),Capacidad máx.,Ocupación actual,Espacios disponibles');
    expect(csvPotreros).toContain('Potrero La Cañada,15.5,20,12,8,Excelente,POT-001');
    expect(mockToastCreate).toHaveBeenCalled();

    // Deshabilitado si la lista queda vacía
    usePotreroStore().items = [];
    await nextTick();
    expect((btnExportarPotreros.element as HTMLButtonElement).disabled).toBe(true);
    potreroWrapper.unmount();

    // Animal.vue
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
    mockToastCreate.mockClear();

    await router.push('/tabs/animales');
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [
        {
          id_animal: 9,
          numero_arete: 'CR-009',
          codigo_qr: 'VACA-009',
          sexo: 'Hembra',
          fecha_nacimiento: '2024-03-10',
          estado: 'Activo',
          raza_id: 1,
          potrero_id: 1,
          raza: { raza_id: 1, nombre: 'Brahman' },
          potrero: { potrero_id: 1, nombre: 'Potrero La Cañada' },
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const animalWrapper = mount(Animal, { global: { plugins: [router] } });
    const btnExportarAnimales = animalWrapper.get('[data-testid="btn-exportar-csv"]');
    expect((btnExportarAnimales.element as HTMLButtonElement).disabled).toBe(true);

    await useAnimalesStore().recargar();
    await flushPromises();
    expect((btnExportarAnimales.element as HTMLButtonElement).disabled).toBe(false);

    await btnExportarAnimales.trigger('click');
    await flushPromises();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const csvAnimales = await leerBlobComoTexto(ultimoBlob!);
    expect(csvAnimales).toContain('Arete,Código QR,Raza,Sexo,Estado,Potrero,Fecha nacimiento');
    expect(csvAnimales).toContain('CR-009,VACA-009,Brahman,Hembra,Activo,Potrero La Cañada,10/03/2024');
    expect(mockToastCreate).toHaveBeenCalled();
    animalWrapper.unmount();
  });

  test('5. App.vue muestra el overlay de arranque mientras !authStore.initialized y lo oculta al inicializar', async () => {
    vi.useFakeTimers();

    const router = crearRouterPruebas();
    await router.push('/login');
    await router.isReady();

    const authStore = useAuthStore();
    authStore.initialized = false;

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          IonRouterOutlet: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="gg-boot-splash"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="gg-boot-splash"]').text()).toContain('GuateGanado');

    // Completa el primer pintado pero la sesión sigue inicializándose
    await vi.advanceTimersByTimeAsync(100);
    await nextTick();
    expect(wrapper.find('[data-testid="gg-boot-splash"]').exists()).toBe(true);

    // Al finalizar restoreSession() desaparece el overlay
    authStore.initialized = true;
    await nextTick();
    await flushPromises();
    expect(wrapper.find('[data-testid="gg-boot-splash"]').exists()).toBe(false);

    wrapper.unmount();
  });
});
