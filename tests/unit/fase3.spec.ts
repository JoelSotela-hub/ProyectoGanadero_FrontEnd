import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { rolesDeModulo, rolPermitido } from '@/config/roles';
import type { Ronda } from '@/models/ronda.model';
import {
  ApiError,
  http,
  networkService,
  pesajeService,
  rondaService,
  tratamientoService,
  type PesajeAnimal,
  type TratamientoAplicacion,
  type TratamientoCatalogo,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import { usePesajeStore } from '@/stores/pesaje';
import { useTratamientoStore } from '@/stores/tratamiento';
import Pesajes from '@/views/Pesajes.vue';
import RondaDetalle from '@/views/RondaDetalle.vue';
import Rondas from '@/views/Rondas.vue';
import Tratamientos from '@/views/Tratamientos.vue';

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
let mockAlertValues: Record<string, string> = {};
const mockAlertCreate = vi.fn(async (opts: Record<string, unknown>) => ({
  opts,
  present: vi.fn(async () => undefined),
  onDidDismiss: vi.fn(async () => ({ role: mockAlertRole, data: { values: mockAlertValues } })),
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

const ANIMALES_MOCK = [
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

const PESAJES_MOCK: PesajeAnimal[] = [
  {
    pesaje_id: 10,
    id_animal: 5,
    peso_kg: 420.5,
    fecha_pesaje: '2026-10-15T10:00:00Z',
    observaciones: 'Control mensual',
    animal: { id_animal: 5, numero_arete: 'CR-005-LIB' },
  },
];

const CATALOGO_MOCK: TratamientoCatalogo[] = [
  {
    tratamiento_id: 1,
    nombre: 'Vacuna Contra Aftosa',
    tipo: 'Vacuna',
    descripcion: 'Vacunación semestral obligatoria',
  },
  {
    tratamiento_id: 2,
    nombre: 'Ivermectina 1%',
    tipo: 'Desparasitante',
    descripcion: 'Control de parásitos internos y externos',
  },
];

const APLICACIONES_MOCK: TratamientoAplicacion[] = [
  {
    tratamiento_animal_id: 21,
    id_animal: 5,
    tratamiento_id: 1,
    fecha_aplicacion: '2026-10-18T08:00:00Z',
    dosis_ml: 15,
    observaciones: 'Refuerzo anual',
    animal: { id_animal: 5, numero_arete: 'CR-005-LIB' },
    tratamiento: CATALOGO_MOCK[0],
  },
];

const RONDAS_MOCK: Ronda[] = [
  {
    id: 7,
    user_id: 3,
    operador: { id: 3, name: 'Carlos Operario', email: 'carlos@finca.gt' },
    fecha_inicio: '2026-10-20T07:00:00Z',
    fecha_fin: null,
    estado: 'en_progreso',
    observaciones: 'Inicio de mañana',
    total_puntos: 1,
    puntos: [
      {
        id: 101,
        ronda_id: 7,
        potrero_id: 1,
        latitud: 10.456789,
        longitud: -84.123456,
        estado_potrero: 'bueno',
        observacion: 'Cerca en buen estado',
        registrado_en: '2026-10-20T07:15:00Z',
        potrero: { potrero_id: 1, nombre: 'Potrero Norte', codigo_qr: 'POTRERO-NORTE' },
      },
    ],
  },
];

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/pesajes', component: Pesajes },
      { path: '/tabs/tratamientos', component: Tratamientos },
      { path: '/tabs/rondas', component: Rondas },
      { path: '/rondas/:id', component: RondaDetalle },
      { path: '/detalle/:id', component: { template: '<div>Animal Detail</div>' } },
    ],
  });
}

function setRolUsuario(role: 'admin' | 'veterinario' | 'operario') {
  const auth = useAuthStore();
  auth.token = 'token-test';
  auth.user = { id: 1, name: `Usuario ${role}`, email: `${role}@finca.gt`, role };
}

describe('Fase 3 — Pesajes, Tratamientos y Auditoría de Rondas', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPreferencesStore.clear();
    mockAlertRole = 'destructive';
    mockAlertValues = {};
    mockAlertCreate.mockClear();
    mockToastCreate.mockClear();
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(true);
  });

  // ==================== 1. PESAJES ====================
  test('1. Pesajes.vue muestra 1 solo h1, arete con enlace al detalle y permisos exactos por rol', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/animales') {
        return { data: ANIMALES_MOCK, meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } };
      }
      return {
        data: PESAJES_MOCK,
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      };
    });

    // Admin: ve crear, editar y eliminar
    setRolUsuario('admin');
    const router = crearRouterPruebas();
    await router.push('/tabs/pesajes');
    await router.isReady();

    const wrapperAdmin = mount(Pesajes, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapperAdmin.findAll('h1')).toHaveLength(1);
    expect(wrapperAdmin.text()).toContain('CR-005-LIB');
    expect(wrapperAdmin.text()).toContain('420.5 kg');
    expect(wrapperAdmin.find('[data-testid="btn-crear-pesaje"]').exists()).toBe(true);
    expect(wrapperAdmin.find('[data-testid="btn-editar-pesaje-10"]').exists()).toBe(true);
    expect(wrapperAdmin.find('[data-testid="btn-eliminar-pesaje-10"]').exists()).toBe(true);
    wrapperAdmin.unmount();

    // Operario: ve crear, NO ve editar ni eliminar
    setRolUsuario('operario');
    const wrapperOp = mount(Pesajes, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperOp.find('[data-testid="btn-crear-pesaje"]').exists()).toBe(true);
    expect(wrapperOp.find('[data-testid="btn-editar-pesaje-10"]').exists()).toBe(false);
    expect(wrapperOp.find('[data-testid="btn-eliminar-pesaje-10"]').exists()).toBe(false);
    wrapperOp.unmount();

    // Veterinario: solo lectura (NO ve crear, editar ni eliminar)
    setRolUsuario('veterinario');
    const wrapperVet = mount(Pesajes, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperVet.find('[data-testid="btn-crear-pesaje"]').exists()).toBe(false);
    expect(wrapperVet.find('[data-testid="btn-editar-pesaje-10"]').exists()).toBe(false);
    expect(wrapperVet.find('[data-testid="btn-eliminar-pesaje-10"]').exists()).toBe(false);
    wrapperVet.unmount();
  });

  test('2. Store pesaje envía filtros reales a GET /pesajes, mapea 422 y refresca tras 201 Created', async () => {
    setRolUsuario('admin');
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({
      data: PESAJES_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const store = usePesajeStore();
    store.filtros.id_animal = '5';
    store.filtros.fecha_desde = '2026-10-01';
    store.filtros.fecha_hasta = '2026-10-31';
    store.filtros.peso_min = '300';
    store.filtros.peso_max = '500';
    await store.recargar();

    expect(getSpy).toHaveBeenCalledWith(
      '/pesajes',
      expect.objectContaining({
        query: expect.objectContaining({
          id_animal: '5',
          fecha_desde: '2026-10-01',
          fecha_hasta: '2026-10-31',
          peso_min: 300,
          peso_max: 500,
          sort_by: 'fecha_pesaje',
          order: 'desc',
        }),
      }),
    );

    // Error 422 mapeado por campo
    vi.spyOn(http, 'post').mockRejectedValueOnce(
      new ApiError(422, 'Datos inválidos', { peso_kg: ['El peso debe ser mayor a 0.'] }),
    );
    store.prepararNuevo();
    store.form.id_animal = '5';
    store.form.peso_kg = '420';
    store.form.fecha_pesaje = '2026-10-20';
    const fallido = await store.guardar();
    expect(fallido).toBeNull();
    expect(store.errores.peso_kg).toBe('El peso debe ser mayor a 0.');

    // 201 Created (sin relación `animal`) -> dispara recarga para traer relación `animal`
    getSpy.mockClear();
    vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: { pesaje_id: 11, id_animal: 5, peso_kg: 430, fecha_pesaje: '2026-10-20', observaciones: null },
    });
    const creado = await store.guardar();
    expect(creado?.pesaje_id).toBe(11);
    expect(getSpy).toHaveBeenCalledWith('/pesajes', expect.anything());
  });

  test('3. Pesajes sirve caché offline con aviso de obsolescencia cuando no hay red', async () => {
    setRolUsuario('operario');
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: PESAJES_MOCK,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    });
    await pesajeService.listar();

    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(false);
    const offline = await pesajeService.listar();
    expect(offline.desdeCache).toBe(true);
    expect(offline.data).toHaveLength(1);
    expect(offline.ultimaActualizacion).toBeTruthy();

    await pesajeService.limpiarCache();
    expect(mockPreferencesStore.size).toBe(0);
  });

  // ==================== 2. TRATAMIENTOS ====================
  test('4. Tratamientos bloquea completamente a operario y permite admin/veterinario con 2 segmentos', async () => {
    const rolesTratamientos = rolesDeModulo('tratamientos');
    expect(rolPermitido('operario', rolesTratamientos)).toBe(false);
    expect(rolPermitido('admin', rolesTratamientos)).toBe(true);
    expect(rolPermitido('veterinario', rolesTratamientos)).toBe(true);

    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/animales') {
        return { data: ANIMALES_MOCK, meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } };
      }
      if (ruta === '/tratamientos') {
        return {
          data: CATALOGO_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      return {
        data: APLICACIONES_MOCK,
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      };
    });

    const router = crearRouterPruebas();
    await router.push('/tabs/tratamientos');
    await router.isReady();

    // Veterinario: ve crear y editar, NO ve eliminar
    setRolUsuario('veterinario');
    const wrapperVet = mount(Tratamientos, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperVet.findAll('h1')).toHaveLength(1);
    expect(wrapperVet.find('[data-testid="btn-crear-aplicacion"]').exists()).toBe(true);
    expect(wrapperVet.find('[data-testid="btn-editar-aplicacion-21"]').exists()).toBe(true);
    expect(wrapperVet.find('[data-testid="btn-eliminar-aplicacion-21"]').exists()).toBe(false);
    wrapperVet.unmount();

    // Admin: ve eliminar en aplicaciones
    setRolUsuario('admin');
    const wrapperAdmin = mount(Tratamientos, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperAdmin.find('[data-testid="btn-eliminar-aplicacion-21"]').exists()).toBe(true);
    wrapperAdmin.unmount();
  });

  test('5. Catálogo de tratamientos maneja 409 (RN-06) al eliminar y aplicaciones refresca tras 201', async () => {
    setRolUsuario('admin');
    const getSpy = vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/tratamientos') {
        return {
          data: CATALOGO_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      return {
        data: APLICACIONES_MOCK,
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      };
    });

    const store = useTratamientoStore();

    // 201 Created en aplicación -> recarga listado para mostrar animal y tratamiento
    vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: {
        tratamiento_animal_id: 22,
        id_animal: 5,
        tratamiento_id: 1,
        fecha_aplicacion: '2026-10-20',
        dosis_ml: 10,
        observaciones: null,
      },
    });
    store.prepararNuevaAplicacion();
    store.formAplicacion.id_animal = '5';
    store.formAplicacion.tratamiento_id = '1';
    store.formAplicacion.fecha_aplicacion = '2026-10-20';
    store.formAplicacion.dosis_ml = '10';
    const creada = await store.guardarAplicacion();
    expect(creada?.tratamiento_animal_id).toBe(22);
    expect(getSpy).toHaveBeenCalledWith('/tratamientos-aplicaciones', expect.anything());

    // 409 Conflict (RN-06) al eliminar tratamiento con historial
    vi.spyOn(http, 'delete').mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar el tratamiento porque tiene aplicaciones registradas.'),
    );
    const resEliminar = await store.eliminarCatalogo(1);
    expect(resEliminar.ok).toBe(false);
    expect(resEliminar.esReglaDeNegocio).toBe(true);
    expect(resEliminar.mensaje).toContain('aplicaciones registradas');

    await tratamientoService.limpiarCache();
  });

  // ==================== 3. AUDITORÍA DE RONDAS ====================
  test('6. Rondas bloquea veterinario, usa AppHeader + 1 solo h1 y no expone PUT ni DELETE', async () => {
    const rolesRondas = rolesDeModulo('rondas');
    expect(rolPermitido('veterinario', rolesRondas)).toBe(false);
    expect(rolPermitido('admin', rolesRondas)).toBe(true);
    expect(rolPermitido('operario', rolesRondas)).toBe(true);

    vi.spyOn(http, 'get').mockImplementation(async (ruta) => {
      if (ruta === '/rondas') {
        return {
          data: RONDAS_MOCK,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      return { data: RONDAS_MOCK[0] };
    });

    const router = crearRouterPruebas();
    await router.push('/tabs/rondas');
    await router.isReady();

    setRolUsuario('admin');
    const wrapperRondas = mount(Rondas, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperRondas.findAll('h1')).toHaveLength(1);
    expect(wrapperRondas.find('ion-header.gg-app-header').exists()).toBe(true);
    expect(wrapperRondas.text()).not.toContain('Editar');
    expect(wrapperRondas.text()).not.toContain('Eliminar');
    expect(wrapperRondas.find('[data-testid="btn-iniciar-ronda"]').exists()).toBe(false);
    wrapperRondas.unmount();

    await router.push('/rondas/7');
    const wrapperDetalle = mount(RondaDetalle, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapperDetalle.findAll('h1')).toHaveLength(1);
    expect(wrapperDetalle.find('ion-header.gg-app-header').exists()).toBe(true);
    expect(wrapperDetalle.text()).not.toContain('Eliminar');
    wrapperDetalle.unmount();
  });

  test('7. rondaService usa payloads exactos (observaciones plural vs observacion singular) y propaga los 3 errores 409', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValue({ data: RONDAS_MOCK[0] });
    const patchSpy = vi.spyOn(http, 'patch').mockResolvedValue({ data: { ...RONDAS_MOCK[0], estado: 'completada' } });

    // POST /rondas -> observaciones (plural)
    await rondaService.iniciar('Salida matutina');
    expect(postSpy).toHaveBeenCalledWith('/rondas', { observaciones: 'Salida matutina' });

    // POST /rondas/{id}/puntos -> observacion (singular) + estado_potrero
    await rondaService.registrarPunto(7, {
      codigo_qr: 'POTRERO-NORTE',
      latitud: 10.45,
      longitud: -84.12,
      estado_potrero: 'requiere_atencion',
      observacion: 'Cerca dañada',
    });
    expect(postSpy).toHaveBeenCalledWith('/rondas/7/puntos', {
      codigo_qr: 'POTRERO-NORTE',
      latitud: 10.45,
      longitud: -84.12,
      estado_potrero: 'requiere_atencion',
      observacion: 'Cerca dañada',
    });

    // PATCH /rondas/{id}/finalizar -> observaciones (plural)
    await rondaService.finalizar(7, 'Recorrido completo');
    expect(patchSpy).toHaveBeenCalledWith('/rondas/7/finalizar', { observaciones: 'Recorrido completo' });

    // 409 #1: ronda en progreso, #2: potrero repetido, #3: ronda completada
    postSpy.mockRejectedValueOnce(new ApiError(409, 'Ya tiene una ronda en progreso (ID: 7).'));
    await expect(rondaService.iniciar()).rejects.toMatchObject({ status: 409 });

    postSpy.mockRejectedValueOnce(new ApiError(409, 'El potrero ya ha sido registrado en esta ronda de inspección.'));
    await expect(
      rondaService.registrarPunto(7, {
        codigo_qr: 'POTRERO-NORTE',
        latitud: 10.45,
        longitud: -84.12,
        estado_potrero: 'bueno',
      }),
    ).rejects.toMatchObject({ status: 409 });

    patchSpy.mockRejectedValueOnce(new ApiError(409, 'La ronda ya se encuentra finalizada.'));
    await expect(rondaService.finalizar(7)).rejects.toMatchObject({ status: 409 });
  });
});
