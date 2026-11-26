<template>
  <ion-app>
    <ion-router-outlet />

    <Transition name="gg-fade">
      <div
        v-if="mostrarArranque"
        class="gg-boot-splash"
        role="status"
        aria-live="polite"
        aria-label="Cargando GuateGanado"
        data-testid="gg-boot-splash"
      >
        <div class="gg-boot-splash__inner">
          <span class="gg-boot-splash__logo" aria-hidden="true">
            <svg viewBox="0 0 512 512" fill="currentColor" focusable="false">
              <ellipse cx="146" cy="214" rx="44" ry="58" />
              <ellipse cx="216" cy="128" rx="44" ry="60" />
              <ellipse cx="296" cy="128" rx="44" ry="60" />
              <ellipse cx="366" cy="214" rx="44" ry="58" />
              <path
                d="M256 258c-54 0-116 76-136 124-16 40 8 80 50 80 32 0 54-18 86-18s54 18 86 18c42 0 66-40 50-80-20-48-82-124-136-124z"
              />
            </svg>
          </span>
          <p class="gg-boot-splash__name">GuateGanado</p>
          <p class="gg-boot-splash__tagline">GESTIÓN GANADERA</p>
          <span class="gg-boot-splash__bar" aria-hidden="true" />
          <p class="gg-boot-splash__status">Preparando tu finca…</p>
        </div>
      </div>
    </Transition>
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const authStore = useAuthStore();

const primerPintado = ref<boolean>(false);
const mostrarArranque = computed<boolean>(() => !authStore.initialized || !primerPintado.value);

function trasPrimerPintado(callback: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
  } else {
    setTimeout(callback, 0);
  }
}

let backButtonListener: PluginListenerHandle | null = null;

const ROOT_PATHS = new Set([
  '/login',
  '/tabs/dashboard',
  '/tabs/tab1',
  '/tabs/animales',
  '/tabs/tab2',
  '/tabs/rondas',
  '/tabs/potreros',
  '/tabs/pesajes',
  '/tabs/tratamientos',
  '/tabs/insumos',
  '/tabs/catalogos',
  '/register',
  '/items',
]);

onMounted(async () => {
  trasPrimerPintado(() => {
    primerPintado.value = true;
  });

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const currentPath = route.path;

    if (ROOT_PATHS.has(currentPath) || Boolean(route.meta.isRootScreen) || !canGoBack) {
      CapacitorApp.exitApp();
    }
  });
});

onUnmounted(async () => {
  if (backButtonListener) {
    await backButtonListener.remove();
    backButtonListener = null;
  }
});
</script>
