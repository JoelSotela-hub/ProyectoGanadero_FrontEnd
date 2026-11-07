import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth';
import Tab1Page from '@/views/Tab1Page.vue';

describe('Tab1Page.vue & AuthStore (Persona 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('renders tab 1 Tab1Page', () => {
    const wrapper = mount(Tab1Page);
    expect(wrapper.text()).toMatch('Tab 1 page');
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
