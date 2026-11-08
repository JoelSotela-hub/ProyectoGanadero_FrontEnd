<template>
  <div class="error-container ion-text-center ion-padding">
    <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
    <h3>{{ title || 'Ocurrió un error' }}</h3>
    <p>{{ message || 'No se pudo conectar con el servidor o cargar la información.' }}</p>
    <ion-button color="primary" @click="$emit('retry')">Reintentar</ion-button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonButton } from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';

defineProps<{
  title?: string;
  message?: string;
}>();

defineEmits(['retry']);
</script>

<style scoped>
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: var(--ion-color-medium);
}
.error-icon {
  font-size: 64px;
  color: var(--ion-color-danger);
  margin-bottom: 16px;
}
</style>
