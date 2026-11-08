<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

const route = useRoute();
const router = useRouter();

let backButtonListener: PluginListenerHandle | null = null;

const ROOT_PATHS = new Set(['/login', '/tabs/dashboard', '/tabs/tab1', '/tabs/animales', '/tabs/tab2', '/items']);

onMounted(async () => {
  /**
   * Manejo del botón físico de retroceso de Android (Persona 2):
   * - Desde las pantallas raíz o el login, sale de la aplicación en lugar de retroceder al login.
   * - En pantallas internas (detalle, formulario), retrocede en el historial o vuelve al listado raíz.
   */
  backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const currentPath = route.path;

    if (ROOT_PATHS.has(currentPath) || Boolean(route.meta.isRootScreen) || !canGoBack) {
      CapacitorApp.exitApp();
      return;
    }

    router.back();
  });
});

onUnmounted(async () => {
  if (backButtonListener) {
    await backButtonListener.remove();
    backButtonListener = null;
  }
});
</script>
