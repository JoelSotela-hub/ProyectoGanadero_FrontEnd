import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test, beforeEach, vi } from 'vitest';

import {
  animalService,
  cacheService,
  conectarAlmacenamientoSeguro,
  formatearMarcaDeTiempo,
  networkService,
  SECURE_TOKEN_KEY,
} from '@/services';
import { useAuthStore } from '@/stores/auth';
import LoginPage from '@/views/LoginPage.vue';

const mockVault = new Map<string, string>();
const mockPrefs = new Map<string, string>();

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    get: vi.fn(async (key: string) => mockVault.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      mockVault.set(key, String(value));
    }),
    remove: vi.fn(async (key: string) => {
      mockVault.delete(key);
    }),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: mockPrefs.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockPrefs.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      mockPrefs.delete(key);
    }),
  },
}));

let mockConnected = true;
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(async () => ({
      connected: mockConnected,
      connectionType: mockConnected ? 'wifi' : 'none',
    })),
    addListener: vi.fn(async () => ({
      remove: vi.fn(),
    })),
  },
}));

describe('LoginPage.vue, AuthStore y Capacidades Offline (Persona 2 + Persona 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockVault.clear();
    mockPrefs.clear();
    mockConnected = true;
    conectarAlmacenamientoSeguro();
  });

  test('renderiza la pantalla de inicio de sesion', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.text()).toMatch('GuateGanado');
  });

  test('authStore persiste el token cifrado con @aparajita/capacitor-secure-storage y restaura sesion', async () => {
    const authStore = useAuthStore();
    expect(authStore.isAuthenticated).toBe(false);

    const ok = await authStore.login({
      email: 'usuario@guateganado.cr',
      password: '123456',
    });
    expect(ok).toBe(true);
    expect(authStore.isAuthenticated).toBe(true);
    expect(mockVault.get(SECURE_TOKEN_KEY)).toBe(authStore.token);

    // Simular reinicio de la app (nuevo store de Pinia leyendo del almacenamiento cifrado)
    setActivePinia(createPinia());
    const nuevoAuthStore = useAuthStore();
    await nuevoAuthStore.restoreSession();
    expect(nuevoAuthStore.isAuthenticated).toBe(true);
    expect(nuevoAuthStore.token).toBeTruthy();

    await nuevoAuthStore.logout();
    expect(nuevoAuthStore.isAuthenticated).toBe(false);
    expect(mockVault.has(SECURE_TOKEN_KEY)).toBe(false);
  });

  test('sirve listado y detalle desde la cache local con marca de tiempo cuando no hay red', async () => {
    const updatedAt = await cacheService.guardarListado(
      [
        {
          id: 101,
          arete: 'GG-0101',
          nombre: 'GG-0101',
          raza: 'Brahman',
          sexo: 'Hembra',
          potrero: 'Potrero Norte',
          peso: 480,
          estado: 'Activo',
        },
      ],
      { paginaActual: 1, ultimaPagina: 1, porPagina: 15, total: 1 },
    );

    // Desconectar la red (@capacitor/network reporta connected: false)
    mockConnected = false;

    const listadoOffline = await animalService.listar();
    expect(listadoOffline.desdeCache).toBe(true);
    expect(listadoOffline.ultimaActualizacion).toBe(updatedAt);
    expect(listadoOffline.items).toHaveLength(1);
    expect(listadoOffline.items[0].arete).toBe('GG-0101');
    expect(formatearMarcaDeTiempo(listadoOffline.ultimaActualizacion)).toBeTruthy();

    const detalleOffline = await animalService.obtenerConCache(101);
    expect(detalleOffline.desdeCache).toBe(true);
    expect(detalleOffline.item.raza).toBe('Brahman');
  });

  test('networkService notifica cuando se recupera la conectividad', () => {
    const eventos: boolean[] = [];
    networkService.establecerEstadoParaPruebas(false, 'none');

    const desuscribir = networkService.suscribirCambioDeRed((conectado) => {
      eventos.push(conectado);
    });

    networkService.establecerEstadoParaPruebas(true, 'wifi');
    expect(eventos).toEqual([true]);
    desuscribir();
  });
});
