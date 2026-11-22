<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

const route = useRoute();

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
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  /**
   * Manejo del botón físico de retroceso de Android:
   * - Desde las pantallas raíz o el login, sale de la aplicación en lugar de retroceder al login.
   * - En pantallas internas (detalle, formulario), Ionic ya realiza el retroceso nativo;
   *   no se invoca `router.back()` manualmente para evitar un doble retroceso.
   */
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
