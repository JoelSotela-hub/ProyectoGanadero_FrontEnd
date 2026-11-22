<template>
  <div class="gg-state" role="status">
    <ion-icon :icon="folderOpenOutline" aria-hidden="true" />
    <h3>{{ title || 'No hay datos disponibles' }}</h3>
    <p>{{ message || 'No se encontraron registros en este momento.' }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { folderOpenOutline } from 'ionicons/icons';

defineProps<{
  title?: string;
  message?: string;
}>();
</script>
