import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { ApiError, http, networkService, potreroService, type Potrero } from '@/services';
import { useAuthStore } from '@/stores/auth';
import { usePotreroStore } from '@/stores/potrero';
import PotreroDetail from '@/views/PotreroDetail.vue';
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

let mockAlertRole = 'destructive';
const mockAlertCreate = vi.fn(async (opts: Record<string, unknown>) => ({
  opts,
  present: vi.fn(async () => undefined),
  onDidDismiss: vi.fn(async () => ({ role: mockAlertRole })),
}));
const mockToastCreate = vi.fn(async (opts: Record<string, unknown>) => ({
  opts,
  present: vi.fn(async () => undefined),
}));

vi.mock('@ionic/vue', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    alertController: {
      create: (opts: Record<string, unknown>) => mockAlertCreate(opts),
    },
    toastController: {
      create: (opts: Record<string, unknown>) => mockToastCreate(opts),
    },
    onIonViewWillEnter: vi.fn(),
    onIonViewWillLeave: vi.fn(),
    useBackButton: vi.fn(),
  };
});

const POTREROS_MOCK: Potrero[] = [
  {
    potrero_id: 1,
    nombre: 'Potrero Norte',
    codigo_qr: 'POTRERO-NORTE',
    hectareas_de_extension: 25.5,
    capacidad_maxima: 40,
    estado_pasto: 'Excelente',
  },
  {
    potrero_id: 2,
    nombre: 'Potrero Sur',
    codigo_qr: 'POTRERO-SUR',
    hectareas_de_extension: 12,
    capacidad_maxima: 20,
    estado_pasto: 'Regular',
  },
];

const ANIMALES_POTRERO_MOCK = [
  {
    id_animal: 5,
    numero_arete: 'CR-005-LIB',
    codigo_qr: 'VACA-005',
    sexo: 'Hembra',
    fecha_nacimiento: '2023-04-15',
    estado: 'Activo',
    raza_id: 1,
    potrero_id: 1,
    raza: { raza_id: 1, nombre: 'Brahman' },
    potrero: { potrero_id: 1, nombre: 'Potrero Norte' },
  },
];

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/potreros', component: Potreros },
      { path: '/potreros/:id', component: PotreroDetail },
      { path: '/detalle/:id', component: { template: '<div>Animal Detail</div>' } },
    ],
  });
}

describe('Fase 2 — Módulo Potreros (CRUD, filtros, RN-02, detalle, ocupación real y caché)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPreferencesStore.clear();
    mockAlertRole = 'destructive';
    mockAlertCreate.mockClear();
    mockToastCreate.mockClear();
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(true);
  });

  test('1. Listado Potreros.vue muestra 1 solo h1, columnas reales y restringe CRUD solo a admin', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({
      data: POTREROS_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/tabs/potreros');
    await router.isReady();

    const wrapper = mount(Potreros, { global: { plugins: [router] } });
    await flushPromises();

    // Exactamente un solo <h1>
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toBe('Potreros');

    // Datos visibles
    const tabla = wrapper.get('[data-testid="tabla-potreros"]').text();
    expect(tabla).toContain('Potrero Norte');
    expect(tabla).toContain('25.5 ha');
    expect(tabla).toContain('40 animales');
    expect(tabla).toContain('Excelente');
    expect(tabla).toContain('POTRERO-NORTE');

    // Admin ve botones Crear, Editar y Eliminar
    expect(wrapper.find('[data-testid="btn-crear-potrero"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-editar-potrero-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-eliminar-potrero-1"]').exists()).toBe(true);

    // Veterinario solo lectura
    authStore.user = { id: 2, name: 'Vet', email: 'vet@finca.gt', role: 'veterinario' };
    await flushPromises();
    expect(wrapper.find('[data-testid="btn-crear-potrero"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-editar-potrero-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-eliminar-potrero-1"]').exists()).toBe(false);

    // Operario solo lectura
    authStore.user = { id: 3, name: 'Op', email: 'op@finca.gt', role: 'operario' };
    await flushPromises();
    expect(wrapper.find('[data-testid="btn-crear-potrero"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-editar-potrero-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-eliminar-potrero-1"]').exists()).toBe(false);
  });

  test('2. Filtros conectados al API: nombre (debounce + AbortController), estado_pasto y ordenamiento', async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({
      data: [POTREROS_MOCK[0]],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const store = usePotreroStore();

    // Búsqueda con debounce de 300ms
    store.buscar('Nor');
    store.buscar('Norte');
    expect(getSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenLastCalledWith(
      '/potreros',
      expect.objectContaining({
        query: expect.objectContaining({
          nombre: 'Norte',
          sort_by: 'potrero_id',
          order: 'asc',
        }),
        signal: expect.any(AbortSignal),
      }),
    );

    // Filtro estado_pasto + ordenamiento
    store.establecerEstadoPasto('Excelente');
    await flushPromises();
    expect(getSpy).toHaveBeenLastCalledWith(
      '/potreros',
      expect.objectContaining({
        query: expect.objectContaining({
          nombre: 'Norte',
          estado_pasto: 'Excelente',
        }),
      }),
    );

    store.establecerOrden('hectareas_de_extension|desc');
    await flushPromises();
    expect(getSpy).toHaveBeenLastCalledWith(
      '/potreros',
      expect.objectContaining({
        query: expect.objectContaining({
          sort_by: 'hectareas_de_extension',
          order: 'desc',
        }),
      }),
    );

    vi.useRealTimers();
  });

  test('3. Formulario Crear / Editar valida, mapea 422 por campo, precarga al editar y envía payload exacto', async () => {
    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const store = usePotreroStore();
    store.prepararNuevo();

    // Validación cliente falla si campos requeridos están vacíos
    expect(store.validarFormulario()).toBe(false);
    expect(store.errores.nombre).toBeTruthy();
    expect(store.errores.hectareas_de_extension).toBeTruthy();
    expect(store.errores.capacidad_maxima).toBeTruthy();

    // Error 422 del backend mapeado por campo
    vi.spyOn(http, 'post').mockRejectedValueOnce(
      new ApiError(422, 'Hay datos inválidos.', {
        codigo_qr: ['El código QR ya está en uso.'],
      }),
    );

    store.form.nombre = 'Potrero Este';
    store.form.hectareas_de_extension = '18.5';
    store.form.capacidad_maxima = '30';
    store.form.estado_pasto = 'Bueno';
    store.form.codigo_qr = 'POTRERO-NORTE';

    const res422 = await store.guardar();
    expect(res422).toBeNull();
    expect(store.errores.codigo_qr).toBe('El código QR ya está en uso.');

    // Creación exitosa con codigo_qr vacío (backend autogenera POTRERO-{SLUG})
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: {
        potrero_id: 3,
        nombre: 'Potrero Este',
        codigo_qr: 'POTRERO-POTRERO-ESTE',
        hectareas_de_extension: 18.5,
        capacidad_maxima: 30,
        estado_pasto: 'Bueno',
      },
    });
    store.form.codigo_qr = '';

    const creado = await store.guardar();
    expect(creado?.potrero_id).toBe(3);
    expect(postSpy).toHaveBeenCalledWith('/potreros', {
      nombre: 'Potrero Este',
      hectareas_de_extension: 18.5,
      capacidad_maxima: 30,
      estado_pasto: 'Bueno',
      codigo_qr: null,
    });

    // Edición precarga todos los valores y llama PUT /potreros/{id}
    store.prepararEdicion(POTREROS_MOCK[0]);
    expect(store.esEdicion).toBe(true);
    expect(store.form.nombre).toBe('Potrero Norte');
    expect(store.form.hectareas_de_extension).toBe('25.5');
    expect(store.form.capacidad_maxima).toBe('40');
    expect(store.form.estado_pasto).toBe('Excelente');
    expect(store.form.codigo_qr).toBe('POTRERO-NORTE');

    const putSpy = vi.spyOn(http, 'put').mockResolvedValueOnce({
      data: { ...POTREROS_MOCK[0], capacidad_maxima: 45 },
    });
    store.form.capacidad_maxima = '45';

    const actualizado = await store.guardar();
    expect(actualizado?.capacidad_maxima).toBe(45);
    expect(putSpy).toHaveBeenCalledWith('/potreros/1', {
      nombre: 'Potrero Norte',
      hectareas_de_extension: 25.5,
      capacidad_maxima: 45,
      estado_pasto: 'Excelente',
      codigo_qr: 'POTRERO-NORTE',
    });
  });

  test('4. Eliminar potrero pide confirmación con ion-alert y muestra claramente el error 409 (RN-02)', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({
      data: POTREROS_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });
    vi.spyOn(http, 'delete').mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar el potrero porque tiene animales asignados actualmente.'),
    );

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/tabs/potreros');
    await router.isReady();

    const wrapper = mount(Potreros, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.get('[data-testid="btn-eliminar-potrero-1"]').trigger('click');
    await flushPromises();

    // 1er alert: confirmación; 2do alert: regla de negocio 409 RN-02
    expect(mockAlertCreate).toHaveBeenCalledTimes(2);
    const alertaRn02 = mockAlertCreate.mock.calls[1]?.[0] as { header: string; subHeader: string; message: string };
    expect(alertaRn02.subHeader).toContain('RN-02');
    expect(alertaRn02.message).toContain('animales asignados');
    expect(mockToastCreate).toHaveBeenCalled();
  });

  test('5. PotreroDetail.vue muestra QR, botón copiar, ocupación real (meta.total / capacidad_maxima) y animales con link a AnimalDetail', async () => {
    const getSpy = vi.spyOn(http, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/potreros/1') {
        return { data: POTREROS_MOCK[0] };
      }
      if (ruta === '/potreros/1/animales') {
        return {
          data: ANIMALES_POTRERO_MOCK,
          meta: { current_page: 1, last_page: 2, per_page: 15, total: 30 },
          links: { first: null, last: null, prev: null, next: '?page=2' },
        };
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });

    const writeTextMock = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const authStore = useAuthStore();
    authStore.user = { id: 2, name: 'Operario', email: 'op@finca.gt', role: 'operario' };

    const router = crearRouterPruebas();
    await router.push('/potreros/1');
    await router.isReady();

    const wrapper = mount(PotreroDetail, { global: { plugins: [router] } });
    await flushPromises();

    // Exactamente un solo <h1>
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toBe('Potrero Norte');

    // Endpoints consultados
    expect(getSpy).toHaveBeenCalledWith('/potreros/1');
    expect(getSpy).toHaveBeenCalledWith(
      '/potreros/1/animales',
      expect.objectContaining({ query: { page: 1, per_page: 15 } }),
    );

    // Ocupación real: 30 / 40 = 75% (nivel warning)
    expect(wrapper.get('[data-testid="ocupacion-texto"]').text()).toContain('30 de 40 animales asignados');
    expect(wrapper.get('[data-testid="badge-ocupacion-porcentaje"]').text()).toBe('75% ocupado');
    const barra = wrapper.get('[data-testid="barra-ocupacion"]');
    expect(barra.attributes('aria-valuenow')).toBe('75');
    expect(barra.classes()).toContain('gg-progress-bar--warning');

    // QR visual + copiar código QR
    expect(wrapper.find('[data-testid="qr-potrero-visual"]').exists()).toBe(true);
    await wrapper.get('[data-testid="btn-copiar-qr"]').trigger('click');
    await flushPromises();
    expect(writeTextMock).toHaveBeenCalledWith('POTRERO-NORTE');

    // Listado paginado de animales con navegación directa a AnimalDetail.vue
    expect(wrapper.find('[data-testid="btn-cargar-mas-animales"]').exists()).toBe(true);
    await wrapper.get('[data-testid="link-animal-5"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/detalle/5');
  });

  test('6. Caché offline sirve el último listado de potreros con marca de tiempo cuando no hay conexión', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: POTREROS_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });

    // Primera carga online guarda en caché
    const online = await potreroService.listar();
    expect(online.desdeCache).toBe(false);
    expect(online.data).toHaveLength(2);

    // Segunda carga offline devuelve desde caché con marca de tiempo y filtro local
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(false);
    const offline = await potreroService.listar({ nombre: 'Norte' });
    expect(offline.desdeCache).toBe(true);
    expect(offline.ultimaActualizacion).toBeTruthy();
    expect(offline.data).toHaveLength(1);
    expect(offline.data[0]?.nombre).toBe('Potrero Norte');
  });
});
