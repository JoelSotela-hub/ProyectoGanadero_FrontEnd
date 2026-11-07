<template>
  <div class="empty-container ion-text-center ion-padding">
    <ion-icon name="folder-open-outline" class="empty-icon"></ion-icon>
    <h3>{{ title || 'No hay datos disponibles' }}</h3>
    <p>{{ message || 'No se encontraron registros en este momento.' }}</p>
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

<style scoped>
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: var(--ion-color-medium);
}
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
</style>