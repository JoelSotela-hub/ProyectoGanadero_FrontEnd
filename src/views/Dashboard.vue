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

const router = useRouter();

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
  { key: 'animales',     emoji: '🐄', label: 'Total de Animales',       value: '—', foot: 'Cargando...' },
  { key: 'potreros',     emoji: '🌿', label: 'Potreros Registrados',    value: '—', foot: 'Cargando...' },
  { key: 'tratamientos', emoji: '💉', label: 'Tratamientos Registrados', value: '—', foot: 'Cargando...' },
  { key: 'insumos',      emoji: '📦', label: 'Insumos en Inventario',   value: '—', foot: 'Cargando...' },
]);

// Navegación simulada
function goToForm() {
  router.push('/tabs/tab3'); // ajusta a tu ruta real del formulario
}

function goToList(m: { key: string }) {
  router.push(`/tabs/tab2`); // ajusta a tu ruta real del listado
}

function logout() {
  // La Persona 4 cerrará la sesión real (borrar token cifrado).
  // Por ahora solo limpiamos el estado y volvemos al login.
  router.replace('/login');
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