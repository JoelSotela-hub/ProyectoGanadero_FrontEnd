import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useRol } from '@/composables/useRol';
import { rolesDeModulo, rolPermitido } from '@/config/roles';
import type { AuthUser } from '@/models/auth.model';
import appRouter from '@/router';
import { ApiError, authService, http, usuarioService } from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useUsuariosStore } from '@/stores/usuarios';
import LoginPage from '@/views/LoginPage.vue';
import Usuarios from '@/views/Usuarios.vue';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
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

const USUARIOS_MOCK: AuthUser[] = [
  {
    id: 1,
    name: 'Admin Principal',
    email: 'admin@guateganado.com',
    role: 'admin',
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 2,
    name: 'Dra. Elena Gómez',
    email: 'elena@guateganado.com',
    role: 'veterinario',
    created_at: '2026-10-12T14:30:00Z',
  },
  {
    id: 3,
    name: 'Carlos Operario',
    email: 'carlos@guateganado.com',
    role: 'operario',
    created_at: '2026-11-05T09:15:00Z',
  },
];

function crearRouterPruebas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginPage },
      { path: '/tabs/usuarios', component: Usuarios },
    ],
  });
}

describe('Fase 5 — Eliminación de registro público y módulo de Gestión de Usuarios (solo admin)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockToastCreate.mockClear();
  });

  test('1. LoginPage.vue ya NO muestra enlace ni botón hacia /register y la ruta pública /register fue eliminada', async () => {
    const router = crearRouterPruebas();
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find('a[href="/register"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('¿Necesita una cuenta?');
    expect(wrapper.text()).not.toContain('Regístrese aquí');
    wrapper.unmount();

    const rutaRegister = appRouter.getRoutes().find((r) => r.path === '/register' || r.name === 'Register');
    expect(rutaRegister).toBeUndefined();
  });

  test('2. rolesDeModulo("usuarios"), modulosVisibles y ruta /tabs/usuarios solo permiten admin (oculto para veterinario y operario)', () => {
    const rolesUsuarios = rolesDeModulo('usuarios');
    expect(rolesUsuarios).toEqual(['admin']);
    expect(rolPermitido('admin', rolesUsuarios)).toBe(true);
    expect(rolPermitido('veterinario', rolesUsuarios)).toBe(false);
    expect(rolPermitido('operario', rolesUsuarios)).toBe(false);

    const rutaUsuarios = appRouter.getRoutes().find((r) => r.name === 'UsuarioList');
    expect(rutaUsuarios).toBeDefined();
    expect(rutaUsuarios?.path).toBe('/tabs/usuarios');
    expect(rutaUsuarios?.meta.requiresAuth).toBe(true);
    expect(rutaUsuarios?.meta.roles).toEqual(['admin']);

    const authStore = useAuthStore();
    const { modulosVisibles, puedeVer } = useRol();

    authStore.user = { id: 1, name: 'Admin', email: 'admin@finca.gt', role: 'admin' };
    expect(puedeVer('usuarios')).toBe(true);
    expect(modulosVisibles.value.some((m) => m.clave === 'usuarios' && !m.enTabs)).toBe(true);

    authStore.user = { id: 2, name: 'Vet', email: 'vet@finca.gt', role: 'veterinario' };
    expect(puedeVer('usuarios')).toBe(false);
    expect(modulosVisibles.value.some((m) => m.clave === 'usuarios')).toBe(false);

    authStore.user = { id: 3, name: 'Op', email: 'op@finca.gt', role: 'operario' };
    expect(puedeVer('usuarios')).toBe(false);
    expect(modulosVisibles.value.some((m) => m.clave === 'usuarios')).toBe(false);
  });

  test('3. usuarioService / useUsuariosStore llama a GET /users y POST /auth/register CON autenticación, procesa 201 { message, usuario } SIN token, actualiza la lista y NO modifica useAuthStore', async () => {
    const authStore = useAuthStore();
    authStore.token = 'admin-bearer-token-123';
    authStore.user = { id: 1, name: 'Admin Principal', email: 'admin@guateganado.com', role: 'admin' };
    const loginSpy = vi.spyOn(authStore, 'login');

    const getSpy = vi.spyOn(http, 'get').mockResolvedValueOnce({ data: USUARIOS_MOCK });

    const store = useUsuariosStore();
    const lista = await store.cargarUsuarios();

    expect(getSpy).toHaveBeenCalledWith('/users');
    expect(lista).toHaveLength(3);
    expect(store.usuarios).toHaveLength(3);

    getSpy.mockResolvedValueOnce(USUARIOS_MOCK);
    const listaPlana = await usuarioService.listar();
    expect(listaPlana).toHaveLength(3);

    const nuevoUsuario: AuthUser = {
      id: 4,
      name: 'Nuevo Veterinario',
      email: 'nuevo.vet@guateganado.com',
      role: 'veterinario',
      created_at: '2026-11-22T15:00:00Z',
    };
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      message: 'Usuario registrado exitosamente',
      usuario: nuevoUsuario,
    });

    const creado = await store.crearUsuario({
      name: '  Nuevo Veterinario  ',
      email: '  NUEVO.VET@GuateGanado.com ',
      role: 'veterinario',
      password: 'Password1!',
      password_confirmation: 'Password1!',
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0]?.[0]).toBe('/auth/register');
    expect(postSpy.mock.calls[0]?.[1]).toEqual({
      name: 'Nuevo Veterinario',
      email: 'nuevo.vet@guateganado.com',
      role: 'veterinario',
      password: 'Password1!',
      password_confirmation: 'Password1!',
    });
    expect(postSpy.mock.calls[0]?.[2]).toBeUndefined();

    expect(creado).toEqual(nuevoUsuario);
    expect(store.usuarios[0]).toEqual(nuevoUsuario);
    expect(store.usuarios).toHaveLength(4);

    expect(loginSpy).not.toHaveBeenCalled();
    expect(authStore.token).toBe('admin-bearer-token-123');
    expect(authStore.user?.id).toBe(1);
    expect(authStore.user?.email).toBe('admin@guateganado.com');

    postSpy.mockResolvedValueOnce({
      message: 'Usuario creado',
      usuario: nuevoUsuario,
    });
    const creadoDirecto = await authService.registrar({
      name: 'Nuevo Veterinario',
      email: 'nuevo.vet@guateganado.com',
      role: 'veterinario',
      password: 'Password1!',
      password_confirmation: 'Password1!',
    });
    expect(creadoDirecto).toEqual(nuevoUsuario);
  });

  test('4. Usuarios.vue renderiza la tabla de usuarios, filtra por búsqueda/rol y mapea errores 422 en el modal de creación sin cerrar la sesión del admin', async () => {
    const authStore = useAuthStore();
    authStore.token = 'admin-session-token';
    authStore.user = { id: 1, name: 'Admin Principal', email: 'admin@guateganado.com', role: 'admin' };

    vi.spyOn(http, 'get').mockResolvedValue({ data: USUARIOS_MOCK });

    const router = crearRouterPruebas();
    await router.push('/tabs/usuarios');
    await router.isReady();

    const wrapper = mount(Usuarios, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toBe('Usuarios');

    const tabla = wrapper.get('[data-testid="tabla-usuarios"]');
    expect(tabla.text()).toContain('Admin Principal');
    expect(tabla.text()).toContain('Dra. Elena Gómez');
    expect(tabla.text()).toContain('Carlos Operario');
    expect(tabla.text()).toContain('Administrador');
    expect(tabla.text()).toContain('Veterinario');
    expect(tabla.text()).toContain('Operario');

    await wrapper.get('[data-testid="select-filtro-rol"]').setValue('veterinario');
    await flushPromises();
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody tr').text()).toContain('Dra. Elena Gómez');

    await wrapper.get('[data-testid="btn-limpiar-filtros-usuarios"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('tbody tr')).toHaveLength(3);

    await wrapper.get('[data-testid="btn-nuevo-usuario"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="modal-usuario-form"]').exists()).toBe(true);

    vi.spyOn(http, 'post').mockRejectedValueOnce(
      new ApiError(422, 'Los datos proporcionados no son válidos.', {
        email: ['El correo electrónico ya ha sido registrado.'],
        password: ['La contraseña ha aparecido en una filtración de datos.'],
      }),
    );

    await wrapper.get('[data-testid="input-usuario-name"]').setValue('Pedro Gómez');
    await wrapper.get('[data-testid="input-usuario-email"]').setValue('elena@guateganado.com');
    await wrapper.get('[data-testid="select-usuario-role"]').setValue('operario');
    await wrapper.get('[data-testid="input-usuario-password"]').setValue('Segura123!');
    await wrapper.get('[data-testid="input-usuario-password-confirmation"]').setValue('Segura123!');

    await wrapper.get('[data-testid="form-crear-usuario"]').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.get('[data-testid="error-usuario-email"]').text()).toBe(
      'El correo electrónico ya ha sido registrado.',
    );
    expect(wrapper.get('[data-testid="error-usuario-password"]').text()).toBe(
      'La contraseña ha aparecido en una filtración de datos.',
    );
    expect(wrapper.find('[data-testid="modal-usuario-form"]').exists()).toBe(true);

    vi.spyOn(http, 'post').mockResolvedValueOnce({
      message: 'Usuario creado exitosamente.',
      usuario: {
        id: 10,
        name: 'Pedro Gómez',
        email: 'pedro@guateganado.com',
        role: 'operario',
        created_at: '2026-11-22T16:00:00Z',
      },
    });

    await wrapper.get('[data-testid="input-usuario-email"]').setValue('pedro@guateganado.com');
    await wrapper.get('[data-testid="form-crear-usuario"]').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('[data-testid="modal-usuario-form"]').exists()).toBe(false);
    expect(mockToastCreate).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('tbody tr')).toHaveLength(4);
    expect(wrapper.text()).toContain('Pedro Gómez');
    expect(authStore.token).toBe('admin-session-token');
    expect(authStore.user?.email).toBe('admin@guateganado.com');

    wrapper.unmount();
  });
});
