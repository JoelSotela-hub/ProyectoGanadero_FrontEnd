<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GuateGanado</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="logout">Salir</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Saludo / encabezado -->
      <section class="header-block">
        <p class="eyebrow">{{ fecha }}</p>
        <h1>{{ saludo }}</h1>
        <p class="subtitle">
          Bienvenido, este es el estado actual de tu operación ganadera.
        </p>
      </section>

      <!-- Botón principal -->
      <ion-button expand="block" @click="goToForm">
        <ion-icon slot="start" :icon="add" />
        Registrar Animal
      </ion-button>

      <!-- Tarjetas de métricas -->
      <ion-grid class="ion-margin-top">
        <ion-row>
          <ion-col
            v-for="m in metricas"
            :key="m.key"
            size="12"
            size-sm="6"
          >
            <ion-card button @click="goToList(m)">
              <ion-card-header>
                <ion-card-title>
                  <span class="emoji">{{ m.emoji }}</span>
                  {{ m.label }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p class="metric-value">{{ m.value }}</p>
                <p class="metric-foot">{{ m.foot }}</p>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- FAB (acción flotante) -->
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="goToForm">
          <ion-icon :icon="add" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonGrid, IonRow, IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonFab, IonFabButton, IonIcon
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// Fecha actual
const fecha = new Date().toLocaleDateString('es-CR', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const saludo = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
});

// Datos simulados — la Persona 3 los reemplaza con la API real
const metricas = ref([
  { key: 'animales',     emoji: '🐄', label: 'Total de Animales',        value: '5', foot: 'Ver catálogo de animales' },
  { key: 'potreros',     emoji: '🌿', label: 'Potreros Registrados',     value: '3', foot: 'Norte, El Río, La Laguna' },
  { key: 'tratamientos', emoji: '💉', label: 'Tratamientos Registrados', value: '1', foot: 'En seguimiento activo' },
  { key: 'insumos',      emoji: '📦', label: 'Insumos en Inventario',    value: '12', foot: 'Stock actualizado' },
]);

function goToForm() {
  router.push('/tabs/registro');
}

function goToList(_m: { key: string }) {
  router.push('/tabs/animales');
}

async function logout() {
  // Limpia el estado de sesión en Pinia, borra el token y redirige reemplazando el historial
  await authStore.logout();
  await router.replace('/login');
}
</script>

<style scoped>
.header-block {
  margin-bottom: 1rem;
}
.eyebrow {
  text-transform: capitalize;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
}
.header-block h1 {
  margin: 0.25rem 0;
  font-size: 1.6rem;
}
.subtitle {
  color: var(--ion-color-medium);
  margin: 0;
}
.emoji {
  margin-right: 0.4rem;
}
.metric-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--ion-color-primary);
}
.metric-foot {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
}
</style>
