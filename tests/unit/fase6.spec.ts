import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import PotreroFormModal from '@/components/PotreroFormModal.vue';
import {
  animalService,
  ApiError,
  catalogoService,
  dashboardService,
  http,
  networkService,
  potreroService,
} from '@/services';
import { useAnimalFormStore } from '@/stores/animalForm';
import { useAuthStore } from '@/stores/auth';
import { useCatalogosStore } from '@/stores/catalogos';
import { usePotreroStore } from '@/stores/potrero';
import AnimalRegistration from '@/views/AnimalRegistration.vue';
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
      { path: '/tabs/potreros', component: Potreros },
      { path: '/potreros/:id', component: PotreroDetail },
      { path: '/tabs/animales', component: { template: '<div>Animales</div>' } },
      { path: '/tabs/registro', component: AnimalRegistration },
      { path: '/detalle/:id', component: { template: '<div>Detalle Animal</div>' } },
    ],
  });
}

describe('Fase 6 — Ocupación real de potreros, manejo de aforo (Pendiente 3) y limpieza final de foto (Pendiente 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPreferencesStore.clear();
    mockToastCreate.mockClear();
    vi.spyOn(networkService, 'verificarConectividad').mockResolvedValue(true);
  });

  test('1. potreroService mapea ocupacion_actual y espacios_disponibles desde la API (y calcula fallback cuando no vienen)', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [
        {
          potrero_id: 1,
          nombre: 'Potrero Norte',
          codigo_qr: 'POTRERO-NORTE',
          hectareas_de_extension: '25.50',
          capacidad_maxima: '10',
          estado_pasto: 'Excelente',
          ocupacion_actual: 8,
          espacios_disponibles: 2,
        },
        {
          potrero_id: 2,
          nombre: 'Potrero Sur',
          codigo_qr: 'POTRERO-SUR',
          hectareas_de_extension: 12,
          capacidad_maxima: 15,
          estado_pasto: 'Bueno',
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const listado = await potreroService.listar();
    expect(listado.data).toHaveLength(2);
    expect(listado.data[0]).toMatchObject({
      potrero_id: 1,
      capacidad_maxima: 10,
      ocupacion_actual: 8,
      espacios_disponibles: 2,
    });
    expect(listado.data[1]).toMatchObject({
      potrero_id: 2,
      capacidad_maxima: 15,
      ocupacion_actual: 0,
      espacios_disponibles: 15,
    });
  });

  test('2. Potreros.vue renderiza la ocupación real (ocupacion_actual / capacidad_maxima) y el badge Lleno cuando espacios_disponibles === 0', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [
        {
          potrero_id: 1,
          nombre: 'Potrero Norte',
          codigo_qr: 'POTRERO-NORTE',
          hectareas_de_extension: 20,
          capacidad_maxima: 10,
          estado_pasto: 'Excelente',
          ocupacion_actual: 4,
          espacios_disponibles: 6,
        },
        {
          potrero_id: 2,
          nombre: 'Potrero Central',
          codigo_qr: 'POTRERO-CENTRAL',
          hectareas_de_extension: 18,
          capacidad_maxima: 10,
          estado_pasto: 'Bueno',
          ocupacion_actual: 8,
          espacios_disponibles: 2,
        },
        {
          potrero_id: 3,
          nombre: 'Potrero Sur',
          codigo_qr: 'POTRERO-SUR',
          hectareas_de_extension: 12,
          capacidad_maxima: 10,
          estado_pasto: 'Regular',
          ocupacion_actual: 10,
          espacios_disponibles: 0,
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 3 },
      links: { first: null, last: null, prev: null, next: null },
    });

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/tabs/potreros');
    await router.isReady();

    const wrapper = mount(Potreros, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.get('[data-testid="ocupacion-potrero-1"]').text()).toContain('4 / 10');
    const badge1 = wrapper.get('[data-testid="badge-ocupacion-potrero-1"]');
    expect(badge1.text()).toBe('6 disp.');
    expect(badge1.classes()).toContain('gg-badge--success');

    expect(wrapper.get('[data-testid="ocupacion-potrero-2"]').text()).toContain('8 / 10');
    const badge2 = wrapper.get('[data-testid="badge-ocupacion-potrero-2"]');
    expect(badge2.text()).toContain('Casi lleno');
    expect(badge2.classes()).toContain('gg-badge--warning');

    expect(wrapper.get('[data-testid="ocupacion-potrero-3"]').text()).toContain('10 / 10');
    const badge3 = wrapper.get('[data-testid="badge-ocupacion-potrero-3"]');
    expect(badge3.text()).toBe('Lleno');
    expect(badge3.classes()).toContain('gg-badge--danger');

    wrapper.unmount();
  });

  test('3. usePotreroStore / PotreroDetail.vue prioriza ocupacion_actual del backend (excluyendo Vendido) y PotreroFormModal maneja 409 al reducir capacidad_maxima', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/potreros/1') {
        return {
          data: {
            potrero_id: 1,
            nombre: 'Potrero Norte',
            codigo_qr: 'POTRERO-NORTE',
            hectareas_de_extension: 25,
            capacidad_maxima: 10,
            estado_pasto: 'Excelente',
            ocupacion_actual: 8,
            espacios_disponibles: 2,
          },
        };
      }
      if (ruta === '/potreros/1/animales') {
        return {
          data: [
            {
              id_animal: 5,
              numero_arete: 'CR-005-LIB',
              sexo: 'Hembra',
              fecha_nacimiento: '2023-04-15',
              estado: 'Vendido',
              raza_id: 1,
              potrero_id: 1,
            },
          ],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 12 },
          links: { first: null, last: null, prev: null, next: null },
        };
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });

    const authStore = useAuthStore();
    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };

    const router = crearRouterPruebas();
    await router.push('/potreros/1');
    await router.isReady();

    const wrapper = mount(PotreroDetail, { global: { plugins: [router] } });
    await flushPromises();

    const store = usePotreroStore();
    expect(store.ocupacion.ocupados).toBe(8);
    expect(store.ocupacion.disponibles).toBe(2);
    expect(store.ocupacion.porcentajeReal).toBe(80);
    expect(wrapper.get('[data-testid="ocupacion-texto"]').text()).toContain('8 de 10 animales asignados');
    expect(wrapper.get('[data-testid="badge-ocupacion-porcentaje"]').text()).toBe('80% ocupado');

    store.prepararEdicion(store.detalle!);
    const modal = mount(PotreroFormModal, {
      props: { open: true },
    });

    vi.spyOn(http, 'put').mockRejectedValueOnce(
      new ApiError(
        409,
        'No se puede reducir la capacidad máxima a 5 porque el potrero tiene 8 animales activos asignados.',
      ),
    );

    await modal.get('#potrero-capacidad').setValue('5');
    await modal.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(modal.get('[data-testid="potrero-error-409"]').text()).toContain(
      'No se puede reducir la capacidad máxima a 5',
    );
    expect(mockToastCreate).toHaveBeenCalled();

    vi.spyOn(http, 'put').mockResolvedValueOnce({
      data: {
        potrero_id: 1,
        nombre: 'Potrero Norte',
        codigo_qr: 'POTRERO-NORTE',
        hectareas_de_extension: 25,
        capacidad_maxima: 12,
        estado_pasto: 'Excelente',
        ocupacion_actual: 8,
        espacios_disponibles: 4,
      },
    });

    await modal.get('#potrero-capacidad').setValue('12');
    await modal.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.detalle?.capacidad_maxima).toBe(12);
    expect(store.detalle?.espacios_disponibles).toBe(4);
    expect(store.ocupacion.disponibles).toBe(4);

    modal.unmount();
    wrapper.unmount();
  });

  test('4. AnimalRegistration.vue muestra disponibilidad en el selector de potreros, deshabilita potreros llenos (salvo potrero actual en edición o estado Vendido) y maneja error 409', async () => {
    vi.spyOn(catalogoService, 'razas').mockResolvedValue([{ id: 1, nombre: 'Brahman' }]);
    vi.spyOn(catalogoService, 'potreros').mockResolvedValue([
      { id: 10, nombre: 'Potrero Norte', capacidad_maxima: 10, ocupacion_actual: 8, espacios_disponibles: 2 },
      { id: 20, nombre: 'Potrero Sur', capacidad_maxima: 10, ocupacion_actual: 10, espacios_disponibles: 0 },
    ]);

    const router = crearRouterPruebas();
    await router.push('/tabs/registro');
    await router.isReady();

    const catalogosStore = useCatalogosStore();
    const formStore = useAnimalFormStore();
    await Promise.all([catalogosStore.cargar(true), formStore.iniciar(null)]);

    const wrapper = mount(AnimalRegistration, { global: { plugins: [router] } });
    await flushPromises();

    const opciones = wrapper.findAll('#a-potrero option');
    expect(opciones[1]?.text()).toBe('Potrero Norte (8/10 — 2 disp.)');
    expect((opciones[1]?.element as HTMLOptionElement).disabled).toBe(false);

    expect(opciones[2]?.text()).toBe('Potrero Sur (10/10 — Lleno)');
    expect((opciones[2]?.element as HTMLOptionElement).disabled).toBe(true);

    await wrapper.get('#a-estado').setValue('Vendido');
    await flushPromises();
    expect((opciones[2]?.element as HTMLOptionElement).disabled).toBe(false);

    await wrapper.get('#a-estado').setValue('Activo');
    await flushPromises();
    expect((opciones[2]?.element as HTMLOptionElement).disabled).toBe(true);

    vi.spyOn(animalService, 'obtener').mockResolvedValueOnce({
      id: 99,
      id_animal: 99,
      arete: 'CR-099',
      nombre: 'CR-099',
      raza: 'Brahman',
      razaId: 1,
      potrero: 'Potrero Sur',
      potreroId: 20,
      sexo: 'Hembra',
      peso: null,
      estado: 'Activo',
      codigoQr: 'VACA-099',
      codigo_qr: 'VACA-099',
    });

    await formStore.iniciar('99');
    await flushPromises();
    const opcionesEdicion = wrapper.findAll('#a-potrero option');
    expect((opcionesEdicion[2]?.element as HTMLOptionElement).disabled).toBe(false);

    vi.spyOn(http, 'put').mockRejectedValueOnce(
      new ApiError(409, 'El potrero seleccionado ha alcanzado su capacidad máxima de 10 animales.'),
    );

    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(formStore.errorNegocio).toContain('capacidad máxima');
    expect(wrapper.text()).toContain('Regla de negocio:');
    expect(wrapper.text()).toContain('El potrero seleccionado ha alcanzado su capacidad máxima');
    expect(mockToastCreate).toHaveBeenCalled();

    wrapper.unmount();
  });

  test('5. dashboardService.potrerosCapacidad() usa ocupacion_actual directamente sin disparar consultas N+1 a /potreros/{id}/animales', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: [
        { potrero_id: 1, nombre: 'Potrero Norte', capacidad_maxima: 40, ocupacion_actual: 30 },
        { potrero_id: 2, nombre: 'Potrero Sur', capacidad_maxima: 20, ocupacion_actual: 20 },
        { potrero_id: 3, nombre: 'Potrero Este', capacidad_maxima: 10, ocupacion_actual: 0 },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 3, total: 3 },
    });

    const tarjetas = await dashboardService.potrerosCapacidad();

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledWith(
      '/potreros',
      expect.objectContaining({
        query: { per_page: 3, sort_by: 'capacidad_maxima', order: 'desc' },
      }),
    );

    expect(tarjetas).toEqual([
      { id: 1, nombre: 'Potrero Norte', capacidad: 40, ocupados: 30, porcentaje: 75 },
      { id: 2, nombre: 'Potrero Sur', capacidad: 20, ocupados: 20, porcentaje: 100 },
      { id: 3, nombre: 'Potrero Este', capacidad: 10, ocupados: 0, porcentaje: 0 },
    ]);
  });

  test('6. animalService y useAnimalFormStore no envían ni mapean la propiedad eliminada foto al crear o actualizar', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: {
        id_animal: 15,
        numero_arete: 'CR-015',
        codigo_qr: 'VACA-CR-015',
        sexo: 'Hembra',
        fecha_nacimiento: '2024-01-10',
        estado: 'Activo',
        raza_id: 1,
        potrero_id: 2,
      },
    });
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: {
        id_animal: 15,
        numero_arete: 'CR-015',
        codigo_qr: 'VACA-CR-015',
        sexo: 'Hembra',
        fecha_nacimiento: '2024-01-10',
        estado: 'Activo',
        raza_id: 1,
        potrero_id: 2,
      },
    });

    const formStore = useAnimalFormStore();
    await formStore.iniciar(null);
    formStore.form.numero_arete = 'CR-015';
    formStore.form.raza_id = '1';
    formStore.form.potrero_id = '2';
    formStore.form.sexo = 'Hembra';
    formStore.form.fecha_nacimiento = '2024-01-10';
    formStore.form.estado = 'Activo';
    (formStore.form as unknown as { peso_kg: number }).peso_kg = 250;

    vi.spyOn(animalService, 'registrarPesaje').mockResolvedValueOnce(undefined);

    const resultado = await formStore.guardar();
    expect(resultado.ok).toBe(true);
    expect(animalService.registrarPesaje).toHaveBeenCalledWith(15, 250, undefined);

    const payloadCreacion = postSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payloadCreacion).toBeDefined();
    expect('foto' in payloadCreacion).toBe(false);
    expect(resultado.animal && 'foto' in (resultado.animal as unknown as Record<string, unknown>)).toBe(false);

    const putSpy = vi.spyOn(http, 'put').mockResolvedValueOnce({
      data: {
        id_animal: 15,
        numero_arete: 'CR-015',
        codigo_qr: 'VACA-CR-015',
        sexo: 'Hembra',
        fecha_nacimiento: '2024-01-10',
        estado: 'Enfermo',
        raza_id: 1,
        potrero_id: 2,
      },
    });

    await animalService.actualizar(15, { estado: 'Enfermo' });
    const payloadActualizacion = putSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect('foto' in payloadActualizacion).toBe(false);
  });
});
