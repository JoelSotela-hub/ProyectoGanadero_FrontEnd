<template>
  <div class="gg-state gg-card" role="alert">
    <ion-icon :icon="alertCircleOutline" class="gg-state__icon--error" aria-hidden="true" />
    <h3>{{ title || 'Ocurrió un error' }}</h3>
    <p>{{ message || 'No se pudo conectar con el servidor o cargar la información.' }}</p>
    <button type="button" class="gg-btn" @click="$emit('retry')">
      <ion-icon :icon="refreshOutline" aria-hidden="true" />
      Reintentar
    </button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { alertCircleOutline, refreshOutline } from 'ionicons/icons';

defineProps<{
  title?: string;
  message?: string;
}>();

defineEmits<{ (e: 'retry'): void }>();
</script>
<style scoped>
.gg-state__icon--error {
  color: var(--gg-danger-fg);
}
</style>
