<template>
  <ion-header class="gg-app-header">
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-back-button v-if="atras" :default-href="atras" text="Volver" />
        <ion-menu-button v-else menu="gg-menu" :auto-hide="false" aria-label="Abrir menú de navegación" />
      </ion-buttons>
      <ion-title>{{ titulo }}</ion-title>
      <ion-buttons slot="end">
        <slot />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { IonBackButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue';

defineProps<{ titulo: string; atras?: string }>();
</script>

<style>
/* En escritorio el sidebar ya está visible: la cabecera con botón de menú solo existe en móvil/tablet. */
@media (min-width: 62rem) {
  ion-header.gg-app-header {
    display: none;
  }
}
</style>
