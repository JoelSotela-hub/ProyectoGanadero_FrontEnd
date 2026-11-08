<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ esAdmin ? 'Auditoría de Rondas' : 'Mis Rondas' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="logout">Salir</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Estado de carga -->
      <ion-grid v-if="loading" class="ion-padding-horizontal">
        <ion-row>
          <ion-col v-for="i in 3" :key="i" size="12" size-md="6">
            <ion-card>
              <ion-card-header>
                <ion-skeleton-text :animated="true" style="width: 40%" />
                <ion-skeleton-text :animated="true" style="width: 70%" />
              </ion-card-header>
              <ion-card-content>
                <ion-skeleton-text :animated="true" />
                <ion-skeleton-text :animated="true" style="width: 60%" />
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Estado de error con reintento -->
      <ErrorState v-else-if="error" title="No se pudieron cargar las rondas" :message="errorMessage" @retry="recargar" />

      <!-- Estado vacío -->
      <EmptyState
        v-else-if="!rondas.length"
        title="Sin rondas registradas"
        :message="
          esAdmin
            ? 'Todavía ningún operario ha iniciado una ronda de inspección.'
            : 'Aún no has iniciado ninguna ronda. Pulsa «Iniciar Ronda» para comenzar.'
        "
      />

      <!-- Listado -->
      <ion-grid v-else class="ion-padding-horizontal">
        <ion-row>
          <ion-col v-for="r in rondas" :key="r.id" size="12" size-md="6">
            <ion-card button @click="abrirRonda(r.id)">
              <ion-card-header>
                <ion-card-subtitle>Ronda #{{ r.id }}</ion-card-subtitle>
                <ion-card-title>{{ formatearFecha(r.fecha_inicio) }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <!-- Solo el admin ve quién hizo cada ronda -->
                <p v-if="esAdmin && r.operador">
                  <strong>Operario:</strong> {{ r.operador.name }}<br />
                  <span class="muted">{{ r.operador.email }}</span>
                </p>
                <p><strong>Potreros visitados:</strong> {{ r.total_puntos }}</p>
                <p v-if="r.fecha_fin"><strong>Finalizada:</strong> {{ formatearFecha(r.fecha_fin) }}</p>
                <ion-chip :color="r.estado === 'en_progreso' ? 'warning' : 'success'" outline>
                  {{ r.estado === 'en_progreso' ? 'En progreso' : 'Completada' }}
                </ion-chip>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="onInfinite($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>

      <!-- Solo el operario inicia rondas; el admin audita -->
      <ion-fab v-if="esOperario" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="iniciando" aria-label="Iniciar Ronda" @click="iniciarRonda">
          <ion-icon :icon="walkOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-loading :is-open="iniciando" message="Iniciando ronda..." />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton,
  IonLoading,
  onIonViewWillEnter,
} from '@ionic/vue';
import { walkOutline } from 'ionicons/icons';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useRol } from '@/composables/useRol';
import type { Ronda } from '@/models/ronda.model';
import {
  ApiError,
  formatearMarcaDeTiempo,
  mensajeDeError,
  mostrarError,
  mostrarToast,
  networkService,
  rondaService,
} from '@/services';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const { esAdmin, esOperario } = useRol();

const loading = ref(true);
const error = ref(false);
const errorMessage = ref('');
const iniciando = ref(false);

const rondas = ref<Ronda[]>([]);
const paginaActual = ref(1);
const hayMas = ref(false);

const formatearFecha = formatearMarcaDeTiempo;

async function cargar(pagina = 1, anexar = false): Promise<void> {
  if (!anexar) {
    loading.value = true;
    error.value = false;
    errorMessage.value = '';
  }

  try {
    const resultado = await rondaService.listar(pagina);
    rondas.value = anexar ? [...rondas.value, ...resultado.items] : resultado.items;
    paginaActual.value = resultado.paginaActual;
    hayMas.value = resultado.hayMas;
  } catch (err) {
    if (anexar) {
      await mostrarError(err);
    } else {
      error.value = true;
      errorMessage.value = mensajeDeError(err, 'No se pudo obtener el listado de rondas.');
      rondas.value = [];
      hayMas.value = false;
    }
  } finally {
    loading.value = false;
  }
}

async function recargar(): Promise<void> {
  await cargar(1, false);
}

async function onRefresh(e: CustomEvent): Promise<void> {
  await cargar(1, false);
  (e.target as HTMLIonRefresherElement).complete();
}

async function onInfinite(e: CustomEvent): Promise<void> {
  if (hayMas.value) {
    await cargar(paginaActual.value + 1, true);
  }
  (e.target as HTMLIonInfiniteScrollElement).complete();
}

function abrirRonda(id: number): void {
  router.push(`/rondas/${id}`);
}

/**
 * Inicia una ronda. Si el operario ya tiene una `en_progreso` (en el listado o
 * porque el backend responde 409), lo lleva a esa ronda en lugar de crear otra.
 */
async function iniciarRonda(): Promise<void> {
  if (iniciando.value) return;

  const activa = rondas.value.find((r) => r.estado === 'en_progreso');
  if (activa) {
    await mostrarToast('Ya tienes una ronda en progreso. Te llevamos a ella.', 'warning');
    abrirRonda(activa.id);
    return;
  }

  iniciando.value = true;
  try {
    const nueva = await rondaService.iniciar();
    await mostrarToast('Ronda iniciada.', 'success');
    abrirRonda(nueva.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // Regla de negocio: ya existe una ronda activa. Mensaje = campo `mensaje` del backend.
      await mostrarToast(err.message, 'warning');
      try {
        const existente = await rondaService.buscarActiva();
        if (existente) abrirRonda(existente.id);
      } catch {
        // Si no se puede localizar, el aviso del 409 ya informó al usuario.
      }
    } else {
      await mostrarError(err, 'No se pudo iniciar la ronda.');
    }
  } finally {
    iniciando.value = false;
  }
}

async function logout(): Promise<void> {
  await authStore.logout();
  await router.replace('/login');
}

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) void recargar();
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});

// Recarga al volver desde el detalle (la ronda pudo cambiar de estado).
onIonViewWillEnter(() => {
  void cargar(1, false);
});
</script>

<style scoped>
.muted {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}
</style>

