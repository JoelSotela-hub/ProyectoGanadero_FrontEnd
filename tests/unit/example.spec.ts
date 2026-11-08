import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth';
import LoginPage from '@/views/LoginPage.vue';

describe('LoginPage.vue & AuthStore (Persona 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('renderiza la pantalla de inicio de sesion', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.text()).toMatch('GuateGanado');
  });

  test('authStore exposes isAuthenticated, login() and logout()', async () => {
    const authStore = useAuthStore();
    expect(authStore.isAuthenticated).toBe(false);

    const ok = await authStore.login({
      email: 'usuario@guateganado.cr',
      password: '123456',
    });
    expect(ok).toBe(true);
    expect(authStore.isAuthenticated).toBe(true);

    await authStore.logout();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.token).toBeNull();
  });
});
