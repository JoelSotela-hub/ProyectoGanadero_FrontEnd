import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { rolesDeModulo, rolPermitido } from '@/config/roles';
import appRouter from '@/router';
import {
  ApiError,
  catalogoService,
  categoriaService,
  http,
  insumoService,
  networkService,
  razaService,
  sanitizarOrdenUnidadMedida,
  unidadMedidaService,
  type Categoria,
  type Insumo,
  type Raza,
  type UnidadMedida,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useCatalogoAdminStore } from '@/stores/catalogoAdmin';
import { useCatalogosStore } from '@/stores/catalogos';
import { useInsumoStore } from '@/stores/insumo';
import Catalogos from '@/views/Catalogos.vue';
import Insumos from '@/views/Insumos.vue';
import LoginPage from '@/views/LoginPage.vue';

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

const RAZAS_MOCK: Raza[] = [
  { raza_id: 1, nombre: 'Brahman' },
  { raza_id: 2, nombre: 'Holstein' },
];

const CATEGORIAS_MOCK: Categoria[] = [
  { categoria_id: 1, nombre: 'Suplementos', tipo: 'Nutrición' },
  { categoria_id: 2, nombre: 'Antibióticos', tipo: 'Sanidad' },
];

const UNIDADES_MOCK: UnidadMedida[] = [
  { unidad_medida_id: 1, nombre: 'Kilogramo', apertura: 'kg', abreviatura: 'kg' },
  { unidad_medida_id: 2, nombre: 'Mililitro', apertura: 'ml', abreviatura: 'ml' },
];

const INSUMOS_MOCK: Insumo[] = [
  {
    insumo_id: 10,
    nombre: 'Sal Mineral 25kg',
    categoria_id: 1,
    precio: 185.5,
    unidad_medida_id: 1,
    categoria: CATEGORIAS_MOCK[0],
    unidad_medida: UNIDADES_MOCK[0],
  },
];

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/insumos', component: Insumos },
      { path: '/tabs/catalogos', component: Catalogos },
      { path: '/login', component: LoginPage },
    ],
  });
}

function setRolUsuario(role: 'admin' | 'veterinario' | 'operario') {
  const auth = useAuthStore();
  auth.token = 'token-test';
  auth.user = { id: 1, name: `Usuario ${role}`, email: `${role}@finca.gt`, role };
}

describe('Fase 4 (Final) — Insumos, Catálogos (Razas, Categorías, UnidadMedida), Roles, 422/409 y Caché Offline', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPreferencesStore.clear();
    mockAlertRole = 'destructive';
    mockAlertCreate.mockClear();
    mockToastCreate.mockClear();
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(true);
  });

  // ==================== 1. MATRIZ DE ROLES Y RUTAS REALES ====================
  test('1. Matriz de roles: Insumos permite admin/veterinario (bloquea operario), Catálogos es exclusivo de admin y el router ya no usa ModuloProximamente', () => {
    const rolesInsumos = rolesDeModulo('insumos');
    expect(rolPermitido('admin', rolesInsumos)).toBe(true);
    expect(rolPermitido('veterinario', rolesInsumos)).toBe(true);
    expect(rolPermitido('operario', rolesInsumos)).toBe(false);

    const rolesCatalogos = rolesDeModulo('catalogos');
    expect(rolPermitido('admin', rolesCatalogos)).toBe(true);
    expect(rolPermitido('veterinario', rolesCatalogos)).toBe(false);
    expect(rolPermitido('operario', rolesCatalogos)).toBe(false);

    const rutaInsumos = appRouter.getRoutes().find((r) => r.name === 'InsumoList');
    const rutaCatalogos = appRouter.getRoutes().find((r) => r.name === 'CatalogoList');
    expect(rutaInsumos?.meta.roles).toEqual(['admin', 'veterinario']);
    expect(rutaCatalogos?.meta.roles).toEqual(['admin']);
    expect(rutaInsumos?.meta.titulo).toBeUndefined();
    expect(rutaCatalogos?.meta.titulo).toBeUndefined();
  });

  // ==================== 2. INSUMOS (UI, ROLES, FILTROS, 422, 409, RECARGA 201) ====================
  test('2. Insumos.vue muestra 1 solo h1, formatea precio y relaciones, y restringe botones CRUD solo a admin (veterinario solo lectura)', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/categorias') return { data: CATEGORIAS_MOCK };
      if (ruta === '/unidades-medida') return { data: UNIDADES_MOCK };
      return {
        data: INSUMOS_MOCK,
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      };
    });

    const router = crearRouterPruebas();
    await router.push('/tabs/insumos');
    await router.isReady();

    // Admin: ve Nuevo insumo, Editar y Eliminar
    setRolUsuario('admin');
    const wrapperAdmin = mount(Insumos, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapperAdmin.findAll('h1')).toHaveLength(1);
    expect(wrapperAdmin.find('h1').text()).toBe('Insumos');
    expect(wrapperAdmin.text()).toContain('Sal Mineral 25kg');
    expect(wrapperAdmin.text()).toContain('Suplementos');
    expect(wrapperAdmin.text()).toContain('Kilogramo');
    expect(wrapperAdmin.text()).toContain('kg');
    expect(wrapperAdmin.text()).toContain('Q 185.50');
    expect(wrapperAdmin.find('[data-testid="btn-crear-insumo"]').exists()).toBe(true);
    expect(wrapperAdmin.find('[data-testid="btn-editar-insumo-10"]').exists()).toBe(true);
    expect(wrapperAdmin.find('[data-testid="btn-eliminar-insumo-10"]').exists()).toBe(true);
    wrapperAdmin.unmount();

    // Veterinario: solo lectura (NO ve Nuevo insumo, Editar ni Eliminar)
    setRolUsuario('veterinario');
    const wrapperVet = mount(Insumos, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperVet.findAll('h1')).toHaveLength(1);
    expect(wrapperVet.text()).toContain('Sal Mineral 25kg');
    expect(wrapperVet.find('[data-testid="btn-crear-insumo"]').exists()).toBe(false);
    expect(wrapperVet.find('[data-testid="btn-editar-insumo-10"]').exists()).toBe(false);
    expect(wrapperVet.find('[data-testid="btn-eliminar-insumo-10"]').exists()).toBe(false);
    wrapperVet.unmount();
  });

  test('3. Store de Insumos envía filtros reales con debounce, mapea errores 422 por campo, maneja 409 y refresca listado tras 201 Created', async () => {
    vi.useFakeTimers();
    setRolUsuario('admin');

    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({
      data: INSUMOS_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const store = useInsumoStore();

    // Búsqueda con debounce de 300 ms
    store.buscar('Sal');
    store.buscar('Sal Mineral');
    expect(getSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenLastCalledWith(
      '/insumos',
      expect.objectContaining({
        query: expect.objectContaining({
          buscar: 'Sal Mineral',
          sort_by: 'insumo_id',
          order: 'asc',
        }),
        signal: expect.any(AbortSignal),
      }),
    );

    // Filtros exactos: categoria_id, unidad_medida_id, precio_min, precio_max y ordenamiento
    store.filtros.categoria_id = '1';
    store.filtros.unidad_medida_id = '1';
    store.filtros.precio_min = '100';
    store.filtros.precio_max = '300';
    store.establecerOrden('precio|desc');
    await flushPromises();

    expect(getSpy).toHaveBeenLastCalledWith(
      '/insumos',
      expect.objectContaining({
        query: expect.objectContaining({
          buscar: 'Sal Mineral',
          categoria_id: '1',
          unidad_medida_id: '1',
          precio_min: 100,
          precio_max: 300,
          sort_by: 'precio',
          order: 'desc',
        }),
      }),
    );

    vi.useRealTimers();

    // Mapeo de error 422 por campo
    vi.spyOn(http, 'post').mockRejectedValueOnce(
      new ApiError(422, 'Datos inválidos', {
        nombre: ['El nombre del insumo ya existe.'],
        precio: ['El precio debe ser un número positivo.'],
      }),
    );

    store.prepararNuevo();
    store.form.nombre = 'Sal Mineral 25kg';
    store.form.categoria_id = '1';
    store.form.unidad_medida_id = '1';
    store.form.precio = '185.5';

    const fallido422 = await store.guardar();
    expect(fallido422).toBeNull();
    expect(store.errores.nombre).toBe('El nombre del insumo ya existe.');
    expect(store.errores.precio).toBe('El precio debe ser un número positivo.');

    // 201 Created sin eager-loading de `categoria`/`unidad_medida` -> recarga listado automáticamente
    getSpy.mockClear();
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: {
        insumo_id: 11,
        nombre: 'Melaza 20L',
        categoria_id: 1,
        precio: 95,
        unidad_medida_id: 2,
      },
    });

    store.form.nombre = 'Melaza 20L';
    store.form.categoria_id = '1';
    store.form.unidad_medida_id = '2';
    store.form.precio = '95';

    const creado = await store.guardar();
    expect(creado?.insumo_id).toBe(11);
    expect(postSpy).toHaveBeenCalledWith('/insumos', {
      nombre: 'Melaza 20L',
      categoria_id: 1,
      precio: 95,
      unidad_medida_id: 2,
    });
    expect(getSpy).toHaveBeenCalledWith('/insumos', expect.anything());

    // Conflicto 409 al eliminar
    vi.spyOn(http, 'delete').mockRejectedValueOnce(new ApiError(409, 'El insumo no puede eliminarse en este momento.'));
    const resEliminar = await store.eliminar(10);
    expect(resEliminar.ok).toBe(false);
    expect(resEliminar.esReglaDeNegocio).toBe(true);
  });

  // ==================== 3. UNIDAD DE MEDIDA (BUG DOCUMENTADO EN SECCIÓN 11) ====================
  test('4. UnidadMedida adapta limpiamente la columna apertura, normaliza abreviatura y jamás envía sort_by=abreviatura al backend', async () => {
    expect(sanitizarOrdenUnidadMedida('nombre')).toBe('nombre');
    expect(sanitizarOrdenUnidadMedida('created_at')).toBe('created_at');
    expect(sanitizarOrdenUnidadMedida('unidad_medida_id')).toBe('unidad_medida_id');
    // Si alguien intenta ordenar por `abreviatura` o `apertura`, hace fallback seguro a `unidad_medida_id`
    expect(sanitizarOrdenUnidadMedida('abreviatura')).toBe('unidad_medida_id');
    expect(sanitizarOrdenUnidadMedida('apertura')).toBe('unidad_medida_id');

    const getSpy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [{ unidad_medida_id: 1, nombre: 'Kilogramo', apertura: 'kg' }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const listado = await unidadMedidaService.listar({
      buscar: 'Kilo',
      sort_by: 'abreviatura',
      order: 'asc',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/unidades-medida',
      expect.objectContaining({
        query: {
          page: 1,
          per_page: 15,
          buscar: 'Kilo',
          sort_by: 'unidad_medida_id',
          order: 'asc',
        },
      }),
    );
    expect(listado.data[0]?.apertura).toBe('kg');
    expect(listado.data[0]?.abreviatura).toBe('kg');

    // POST /unidades-medida envía estrictamente `{ nombre, apertura }`
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: { unidad_medida_id: 3, nombre: 'Litro', apertura: 'L' },
    });
    const creada = await unidadMedidaService.crear({ nombre: 'Litro', apertura: 'L' });
    expect(postSpy).toHaveBeenCalledWith('/unidades-medida', { nombre: 'Litro', apertura: 'L' });
    expect(creada.apertura).toBe('L');
    expect(creada.abreviatura).toBe('L');

    // PUT /unidades-medida/{id} traduce incluso el alias `abreviatura` hacia `apertura`
    const putSpy = vi.spyOn(http, 'put').mockResolvedValueOnce({
      data: { unidad_medida_id: 3, nombre: 'Litro', apertura: 'lt' },
    });
    const actualizada = await unidadMedidaService.actualizar(3, { nombre: 'Litro', abreviatura: 'lt' });
    expect(putSpy).toHaveBeenCalledWith('/unidades-medida/3', { nombre: 'Litro', apertura: 'lt' });
    expect(actualizada.apertura).toBe('lt');
  });

  // ==================== 4. CATÁLOGOS: CRUD, 422, 409 (RN-04, RN-05, RN-07) Y SINCRONIZACIÓN ====================
  test('5. Catalogos.vue y useCatalogoAdminStore manejan 422, conflictos 409 (RN-04, RN-05, RN-07) y sincronizan useCatalogosStore al instante', async () => {
    setRolUsuario('admin');

    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/razas') {
        return {
          data: RAZAS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      if (ruta === '/categorias') {
        return {
          data: CATEGORIAS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      if (ruta === '/unidades-medida') {
        return {
          data: UNIDADES_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      return { data: [] };
    });

    const router = crearRouterPruebas();
    await router.push('/tabs/catalogos');
    await router.isReady();

    const wrapper = mount(Catalogos, { global: { plugins: [router] } });
    await flushPromises();

    // Exactamente un solo <h1>
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toBe('Catálogos');
    expect(wrapper.find('[data-testid="tab-razas"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-categorias"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-unidades"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Brahman');

    const adminStore = useCatalogoAdminStore();
    const catalogosStore = useCatalogosStore();
    const syncSpy = vi.spyOn(catalogosStore, 'sincronizar');

    // Crear nueva raza -> sincroniza useCatalogosStore('razas')
    vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: { raza_id: 3, nombre: 'Gyr' },
    });
    adminStore.prepararNuevaRaza();
    adminStore.formRaza.nombre = 'Gyr';
    const razaCreada = await adminStore.guardarRaza();
    expect(razaCreada?.nombre).toBe('Gyr');
    expect(syncSpy).toHaveBeenCalledWith('razas');

    // Error 422 en UnidadMedida sobre el campo `apertura`
    vi.spyOn(http, 'post').mockRejectedValueOnce(
      new ApiError(422, 'Validación fallida', {
        apertura: ['La abreviatura no puede superar los 20 caracteres.'],
      }),
    );
    adminStore.prepararNuevaUnidad();
    adminStore.formUnidad.nombre = 'Quintal';
    adminStore.formUnidad.apertura = 'qq';
    const unidad422 = await adminStore.guardarUnidad();
    expect(unidad422).toBeNull();
    expect(adminStore.erroresUnidad.apertura).toBe('La abreviatura no puede superar los 20 caracteres.');

    // RN-05 (409 Conflict) al eliminar Raza en uso desde la vista con ion-alert
    vi.spyOn(http, 'delete').mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar la raza porque tiene animales asociados.'),
    );
    await wrapper.get('[data-testid="btn-eliminar-raza-1"]').trigger('click');
    await flushPromises();

    expect(mockAlertCreate).toHaveBeenCalledTimes(2);
    const alertaRn05 = mockAlertCreate.mock.calls[1]?.[0] as { subHeader: string; message: string };
    expect(alertaRn05.subHeader).toContain('RN-05');
    expect(alertaRn05.message).toContain('animales asociados');

    // RN-04 (409 Conflict) al eliminar Categoría con insumos asociados
    vi.spyOn(http, 'delete').mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar la categoría porque tiene insumos asociados.'),
    );
    const resRn04 = await adminStore.eliminarCategoria(1);
    expect(resRn04.ok).toBe(false);
    expect(resRn04.esReglaDeNegocio).toBe(true);
    expect(resRn04.mensaje).toContain('insumos asociados');

    // RN-07 (409 Conflict) al eliminar UnidadMedida con insumos asociados
    vi.spyOn(http, 'delete').mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar la unidad de medida porque tiene insumos asociados.'),
    );
    const resRn07 = await adminStore.eliminarUnidad(1);
    expect(resRn07.ok).toBe(false);
    expect(resRn07.esReglaDeNegocio).toBe(true);
    expect(resRn07.mensaje).toContain('insumos asociados');

    wrapper.unmount();
  });

  // ==================== 5. CACHÉ OFFLINE Y PULIDO VISUAL DE LOGIN ====================
  test('6. Caché offline sirve insumos y catálogos con marca de tiempo cuando no hay conexión y limpia al cerrar sesión', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/insumos') {
        return {
          data: INSUMOS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      if (ruta === '/razas') {
        return {
          data: RAZAS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      if (ruta === '/categorias') {
        return {
          data: CATEGORIAS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      return {
        data: UNIDADES_MOCK,
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
        links: { first: null, last: null, prev: null, next: null },
      };
    });

    // Primera consulta online guarda en caché
    await insumoService.listar();
    await razaService.listar();
    await categoriaService.listar();
    await unidadMedidaService.listar();
    expect(mockPreferencesStore.size).toBe(4);

    // Modo sin conexión devuelve datos desde caché con marca de tiempo
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(false);
    const insumosOffline = await insumoService.listar();
    const unidadesOffline = await unidadMedidaService.listar();

    expect(insumosOffline.desdeCache).toBe(true);
    expect(insumosOffline.data[0]?.nombre).toBe('Sal Mineral 25kg');
    expect(insumosOffline.ultimaActualizacion).toBeTruthy();

    expect(unidadesOffline.desdeCache).toBe(true);
    expect(unidadesOffline.data[0]?.apertura).toBe('kg');
    expect(unidadesOffline.ultimaActualizacion).toBeTruthy();

    // Limpieza completa al cerrar sesión
    await Promise.all([insumoService.limpiarCache(), catalogoService.limpiarCache()]);
    expect(mockPreferencesStore.size).toBe(0);
  });

  test('7. LoginPage renderiza un solo h1 y posiciona el sol decorativo desplazado en el horizonte sin superponerse al título', async () => {
    const router = crearRouterPruebas();
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('.gg-auth__hero-title').text()).toContain('Control y Registro');

    const sol = wrapper.get('[data-testid="auth-decorative-sun"]');
    expect(Number(sol.attributes('cx'))).toBeGreaterThanOrEqual(400);
    expect(Number(sol.attributes('cy'))).toBeGreaterThanOrEqual(360);
    wrapper.unmount();
  });
});

