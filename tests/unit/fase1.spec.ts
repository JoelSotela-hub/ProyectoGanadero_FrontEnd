import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useEscanearVaca } from '@/composables/useEscanearVaca';
import { ApiError, escanearQr, http, pesajeService, tratamientoService } from '@/services';
import { useAnimalDetalleStore } from '@/stores/animalDetalle';
import { useAuthStore } from '@/stores/auth';
import AnimalDetail from '@/views/AnimalDetail.vue';

const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockIsSupported = vi.fn(async () => ({ supported: true }));
const mockIsModuleAvailable = vi.fn(async () => ({ available: true }));
const mockScan = vi.fn();

vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeFormat: { QrCode: 'QR_CODE' },
  BarcodeScanner: {
    checkPermissions: () => mockCheckPermissions(),
    requestPermissions: () => mockRequestPermissions(),
    isSupported: () => mockIsSupported(),
    isGoogleBarcodeScannerModuleAvailable: () => mockIsModuleAvailable(),
    installGoogleBarcodeScannerModule: vi.fn(),
    scan: () => mockScan(),
  },
}));

const mockNativeSettingsOpen = vi.fn(async () => undefined);
vi.mock('capacitor-native-settings', () => ({
  AndroidSettings: { ApplicationDetails: 'ApplicationDetails' },
  IOSSettings: { App: 'App' },
  NativeSettings: {
    open: () => mockNativeSettingsOpen(),
  },
}));

let mockIsNative = false;
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const actualCap = (actual.Capacitor ?? {}) as Record<string, unknown>;
  return {
    ...actual,
    Capacitor: {
      ...actualCap,
      isNativePlatform: () => mockIsNative,
    },
  };
});

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(async () => ({ connected: true, connectionType: 'wifi' })),
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

let mockAlertResponse: { role: string; data?: { values?: { codigo?: string } } } = {
  role: 'confirm',
  data: { values: { codigo: 'VACA-001' } },
};
const mockAlertCreate = vi.fn(async (opts: Record<string, unknown>) => ({
  opts,
  present: vi.fn(async () => undefined),
  onDidDismiss: vi.fn(async () => mockAlertResponse),
}));
const mockToastCreate = vi.fn(async () => ({
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
      create: () => mockToastCreate(),
    },
    onIonViewWillEnter: vi.fn(),
    useBackButton: vi.fn(),
  };
});

const ANIMAL_API_MOCK = {
  id_animal: 5,
  numero_arete: 'CR-005-LIB',
  codigo_qr: 'VACA-005',
  sexo: 'Hembra',
  fecha_nacimiento: '2023-04-15',
  estado: 'Activo',
  raza_id: 1,
  potrero_id: 2,
  raza: { raza_id: 1, nombre: 'Brahman' },
  potrero: { potrero_id: 2, nombre: 'Potrero Norte' },
  pesajes: [
    { pesaje_id: 11, id_animal: 5, peso_kg: 430, fecha_pesaje: '2026-10-10', observaciones: 'Control mensual' },
  ],
  tratamientos: [
    {
      tratamiento_id: 2,
      nombre: 'Vacuna Contra Aftosa',
      tipo: 'Vacuna',
      aplicacion: {
        tratamiento_animal_id: 20,
        fecha_aplicacion: '2026-09-01',
        dosis_ml: 15,
        observaciones: 'Dosis completa',
      },
    },
  ],
};

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/tabs/animales', component: { template: '<div>Animales</div>' } },
      { path: '/tabs/registro', component: { template: '<div>Registro</div>' } },
      { path: '/detalle/:id', component: AnimalDetail },
    ],
  });
}

describe('Fase 1 — Ficha Técnica, Escáner QR, Pesajes y Sanidad por Rol', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockIsNative = false;
    mockAlertCreate.mockClear();
    mockToastCreate.mockClear();
    mockCheckPermissions.mockReset();
    mockRequestPermissions.mockReset();
    mockScan.mockReset();
    mockNativeSettingsOpen.mockClear();
  });

  test('1. Ficha técnica sin fotografía muestra datos completos, 1 solo h1, AppHeader y botón Editar solo para admin', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: ANIMAL_API_MOCK });

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/detalle/5');
    await router.isReady();

    const wrapper = mount(AnimalDetail, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toContain('CR-005-LIB');

    expect(wrapper.get('[data-testid="dato-numero-arete"]').text()).toBe('CR-005-LIB');
    expect(wrapper.get('[data-testid="dato-codigo-qr"]').text()).toBe('VACA-005');
    expect(wrapper.get('[data-testid="dato-sexo"]').text()).toBe('Hembra');
    expect(wrapper.get('[data-testid="dato-fecha-nacimiento"]').text()).toBe('15/04/2023');
    expect(wrapper.get('[data-testid="dato-estado"]').text()).toContain('Activo');
    expect(wrapper.get('[data-testid="dato-raza"]').text()).toBe('Brahman');
    expect(wrapper.get('[data-testid="dato-potrero"]').text()).toBe('Potrero Norte');
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);

    expect(wrapper.find('[data-testid="btn-editar-animal"]').exists()).toBe(true);

    authStore.user = { id: 2, name: 'Operario', email: 'op@finca.gt', role: 'operario' };
    await flushPromises();
    expect(wrapper.find('[data-testid="btn-editar-animal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tab-sanidad"]').exists()).toBe(false);
  });

  test('2. Escáner QR contempla permiso denegado permanentemente con opción Abrir Ajustes + campo manual alternativo', async () => {
    mockIsNative = true;
    mockCheckPermissions.mockResolvedValue({ camera: 'prompt' });
    mockRequestPermissions.mockResolvedValue({ camera: 'denied' });
    mockAlertResponse = {
      role: 'confirm',
      data: { values: { codigo: 'VACA-005' } },
    };

    const codigo = await escanearQr('Escanear QR de la vaca', 'VACA-001');

    expect(mockCheckPermissions).toHaveBeenCalledTimes(1);
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockAlertCreate).toHaveBeenCalledTimes(1);

    const opcionesAlerta = mockAlertCreate.mock.calls[0]?.[0] as {
      header: string;
      subHeader: string;
      inputs: { name: string }[];
      buttons: { text: string; handler?: () => void }[];
    };
    expect(opcionesAlerta.header).toContain('Permiso de cámara denegado');
    expect(opcionesAlerta.subHeader).toContain('denegado permanentemente');
    expect(opcionesAlerta.inputs[0]?.name).toBe('codigo');

    const botonAjustes = opcionesAlerta.buttons.find((b) => b.text === 'Abrir Ajustes');
    expect(botonAjustes).toBeDefined();
    botonAjustes?.handler?.();
    expect(mockNativeSettingsOpen).toHaveBeenCalledTimes(1);

    expect(codigo).toBe('VACA-005');
  });

  test('3. useEscanearVaca resuelve GET /api/v1/animales/qr/{codigo_qr}, precarga el store y navega a AnimalDetail (y maneja 404)', async () => {
    mockIsNative = false;
    mockAlertResponse = {
      role: 'confirm',
      data: { values: { codigo: 'VACA-005' } },
    };

    const getSpy = vi.spyOn(http, 'get').mockResolvedValueOnce({ data: ANIMAL_API_MOCK });

    const router = crearRouterPruebas();
    await router.push('/tabs/dashboard');
    await router.isReady();

    const Comp = {
      template: '<button @click="escanearVaca">Escanear</button>',
      setup() {
        return useEscanearVaca();
      },
    };

    const wrapper = mount(Comp, { global: { plugins: [router] } });
    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith('/animales/qr/VACA-005');
    const store = useAnimalDetalleStore();
    expect(store.animal?.arete).toBe('CR-005-LIB');
    expect(router.currentRoute.value.path).toBe('/detalle/5');

    await router.push('/tabs/dashboard');
    mockAlertResponse = {
      role: 'confirm',
      data: { values: { codigo: 'QR-INEXISTENTE' } },
    };
    getSpy.mockRejectedValueOnce(new ApiError(404, 'Animal no encontrado'));

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/tabs/dashboard');
    expect(mockToastCreate).toHaveBeenCalled();
  });

  test('4. Pestaña Pesajes: consume GET /animales/{id}/pesajes, restringe botón a admin/operario y envía POST sin id_animal en body', async () => {
    const authStore = useAuthStore();
    authStore.user = { id: 2, name: 'Operario', email: 'op@finca.gt', role: 'operario' };

    const listarSpy = vi.spyOn(pesajeService, 'listarPorAnimal').mockResolvedValue({
      data: [
        { pesaje_id: 2, id_animal: 5, peso_kg: 445, fecha_pesaje: '2026-11-10', observaciones: 'Subió de peso' },
        { pesaje_id: 1, id_animal: 5, peso_kg: 430, fecha_pesaje: '2026-10-10', observaciones: 'Peso base' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const postSpy = vi.spyOn(http, 'post').mockResolvedValue({
      data: { pesaje_id: 3, id_animal: 5, peso_kg: 452.5, fecha_pesaje: '2026-11-20', observaciones: 'Nuevo control' },
    });

    const store = useAnimalDetalleStore();
    await store.cargarPesajes(5);

    expect(listarSpy).toHaveBeenCalledWith('5', {
      page: 1,
      per_page: 15,
      sort_by: 'fecha_pesaje',
      order: 'desc',
    });
    expect(store.resumenPesajes.ultimoPeso).toBe(445);
    expect(store.resumenPesajes.diferenciaKg).toBe(15);
    expect(store.resumenPesajes.tendencia).toBe('subida');

    store.formPesaje.peso_kg = '452.5';
    store.formPesaje.fecha_pesaje = '2026-11-20';
    store.formPesaje.observaciones = 'Nuevo control';

    const ok = await store.registrarPesaje(5);
    expect(ok).toBe(true);
    expect(postSpy).toHaveBeenCalledWith('/animales/5/pesajes', {
      peso_kg: 452.5,
      fecha_pesaje: '2026-11-20',
      observaciones: 'Nuevo control',
    });
    expect(listarSpy).toHaveBeenCalledTimes(2);

    authStore.user = { id: 3, name: 'Veterinario', email: 'vet@finca.gt', role: 'veterinario' };
    const okVet = await store.registrarPesaje(5);
    expect(okVet).toBe(false);
  });

  test('5. Pestaña Sanidad / Tratamientos: oculta y bloqueada para operario; admin y veterinario consultan y aplican con POST /tratamientos-aplicaciones', async () => {
    const authStore = useAuthStore();
    const store = useAnimalDetalleStore();

    const listarTratSpy = vi.spyOn(tratamientoService, 'listarPorAnimal').mockResolvedValue({
      data: [
        {
          tratamiento_animal_id: 10,
          id_animal: 5,
          tratamiento_id: 2,
          fecha_aplicacion: '2026-11-15',
          dosis_ml: 12.5,
          observaciones: 'Refuerzo anual',
          tratamiento: {
            tratamiento_id: 2,
            nombre: 'Vacuna Contra Aftosa',
            descripcion: 'Semestral',
            tipo: 'Vacuna',
          },
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const catalogoSpy = vi.spyOn(tratamientoService, 'listarCatalogo').mockResolvedValue({
      data: [{ tratamiento_id: 2, nombre: 'Vacuna Contra Aftosa', descripcion: 'Semestral', tipo: 'Vacuna' }],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const postAplicacionSpy = vi.spyOn(http, 'post').mockResolvedValue({
      data: {
        tratamiento_animal_id: 11,
        id_animal: 5,
        tratamiento_id: 2,
        fecha_aplicacion: '2026-11-21',
        dosis_ml: 15,
        observaciones: 'Sin reacción',
      },
    });

    authStore.user = { id: 2, name: 'Operario', email: 'op@finca.gt', role: 'operario' };
    await store.cargarTratamientos(5);
    await store.cargarCatalogoTratamientos();
    expect(listarTratSpy).not.toHaveBeenCalled();
    expect(catalogoSpy).not.toHaveBeenCalled();

    authStore.user = { id: 3, name: 'Veterinario', email: 'vet@finca.gt', role: 'veterinario' };
    await store.cargarTratamientos(5);
    await store.cargarCatalogoTratamientos();
    expect(listarTratSpy).toHaveBeenCalledTimes(1);
    expect(catalogoSpy).toHaveBeenCalledWith({ per_page: 100 });

    store.formTratamiento.tratamiento_id = '2';
    store.formTratamiento.fecha_aplicacion = '2026-11-21';
    store.formTratamiento.dosis_ml = '15';
    store.formTratamiento.observaciones = 'Sin reacción';

    const ok = await store.aplicarTratamiento(5);
    expect(ok).toBe(true);
    expect(postAplicacionSpy).toHaveBeenCalledWith('/tratamientos-aplicaciones', {
      id_animal: 5,
      tratamiento_id: 2,
      fecha_aplicacion: '2026-11-21',
      dosis_ml: 15,
      observaciones: 'Sin reacción',
    });
    expect(listarTratSpy).toHaveBeenCalledTimes(2);
  });
});
