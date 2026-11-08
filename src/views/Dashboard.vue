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
        <p class="subtitle">Bienvenido, este es el estado actual de tu operación ganadera.</p>
      </section>

      <!-- Acciones principales según el rol -->
      <ion-button expand="block" color="secondary" :disabled="escaneando" @click="escanearVaca">
        <ion-icon slot="start" :icon="qrCodeOutline" />
        Escanear QR de Vaca
      </ion-button>
      <ion-button v-if="esAdmin" expand="block" class="ion-margin-top" @click="goToForm">
        <ion-icon slot="start" :icon="add" />
        Registrar Animal
      </ion-button>
      <ion-button
        v-if="esAdmin || esOperario"
        expand="block"
        fill="outline"
        class="ion-margin-top"
        @click="goToRondas"
      >
        <ion-icon slot="start" :icon="walkOutline" />
        {{ esAdmin ? 'Auditar Rondas' : 'Mis Rondas' }}
      </ion-button>

      <!-- Estado de carga -->
      <ion-grid v-if="cargando" class="ion-margin-top">
        <ion-row>
          <ion-col v-for="i in 4" :key="i" size="12" size-sm="6">
            <ion-card>
              <ion-card-header>
                <ion-skeleton-text :animated="true" style="width: 60%" />
              </ion-card-header>
              <ion-card-content>
                <ion-skeleton-text :animated="true" style="width: 30%; height: 28px" />
                <ion-skeleton-text :animated="true" style="width: 50%" />
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Estado de error con reintento -->
      <ErrorState
        v-else-if="falloTotal"
        title="No se pudieron cargar las métricas"
        message="No se obtuvo respuesta del servidor. Revisa tu conexión e inténtalo de nuevo."
        @retry="cargarConteos"
      />

      <!-- Tarjetas de métricas -->
      <ion-grid v-else class="ion-margin-top">
        <ion-row>
          <ion-col v-for="m in metricas" :key="m.key" size="12" size-sm="6">
            <ion-card button @click="goToList()">
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

      <!-- FAB (acción flotante): solo el admin registra animales -->
      <ion-fab v-if="esAdmin" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="goToForm">
          <ion-icon :icon="add" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSkeletonText,
} from '@ionic/vue';
import { add, qrCodeOutline, walkOutline } from 'ionicons/icons';
import ErrorState from '@/components/ErrorState.vue';
import { useEscanearVaca } from '@/composables/useEscanearVaca';
import { useRol } from '@/composables/useRol';
import { useAuthStore } from '@/stores/auth';
import { panelService } from '@/services';

const router = useRouter();
const authStore = useAuthStore();
const { esAdmin, esOperario } = useRol();
const { escaneando, escanearVaca } = useEscanearVaca();

// Fecha actual
const fecha = new Date().toLocaleDateString('es-CR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const saludo = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
});

/**
 * Totales reales del panel (Persona 3): cada tarjeta lee `meta.total` del
 * listado correspondiente. Si un recurso falla, solo esa tarjeta queda sin dato.
 */
const cargando = ref(true);
const falloTotal = ref(false);

const metricas = ref([
  { key: 'animales', emoji: '\u{1F404}', label: 'Total de Animales', value: '—', foot: 'Ver catálogo de animales' },
  { key: 'potreros', emoji: '\u{1F33F}', label: 'Potreros Registrados', value: '—', foot: 'Distribución del hato' },
  {
    key: 'tratamientos',
    emoji: '\u{1F489}',
    label: 'Tratamientos Registrados',
    value: '—',
    foot: 'En seguimiento activo',
  },
  { key: 'insumos', emoji: '\u{1F4E6}', label: 'Insumos en Inventario', value: '—', foot: 'Stock actualizado' },
]);

function texto(valor: number | null): string {
  return valor === null ? '—' : String(valor);
}

/**
 * Carga los totales. Si TODOS fallan (sin red o servidor caido) se muestra el
 * estado de error con reintento; si falla solo alguno (p. ej. 403 por rol),
 * esa tarjeta queda con «—» y las demas se muestran.
 */
async function cargarConteos(): Promise<void> {
  cargando.value = true;
  falloTotal.value = false;
  try {
    const conteos = await panelService.conteos();
    falloTotal.value = Object.values(conteos).every((valor) => valor === null);
    metricas.value = metricas.value.map((m) => ({
      ...m,
      value: texto(conteos[m.key as keyof typeof conteos]),
    }));
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarConteos);

function goToForm() {
  router.push('/tabs/registro');
}

function goToList() {
  router.push('/tabs/animales');
}

function goToRondas() {
  router.push('/tabs/rondas');
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
