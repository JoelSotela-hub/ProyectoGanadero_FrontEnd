<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/animales" text="Volver" />
        </ion-buttons>
        <ion-title>Detalle del Animal</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="goToEdit">
            <ion-icon slot="icon-only" :icon="createOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Aviso obligatorio de datos no actualizados cuando el detalle se sirve desde la cache (Persona 4) -->
      <div
        v-if="mostrandoAvisoOffline"
        class="offline-banner ion-margin-bottom"
        role="status"
        aria-live="polite"
        data-testid="offline-detail-banner"
      >
        <ion-chip color="warning" class="offline-chip">
          <ion-icon :icon="cloudOfflineOutline" />
          <ion-label>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ ultimaActualizacionTexto }})
          </ion-label>
        </ion-chip>
      </div>

      <!-- Estado de carga -->
      <div v-if="loading">
        <ion-card>
          <ion-card-header>
            <ion-skeleton-text :animated="true" style="width: 45%; height: 18px" />
            <ion-skeleton-text :animated="true" style="width: 75%; height: 26px" />
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text :animated="true" style="width: 90%" />
            <ion-skeleton-text :animated="true" style="width: 80%" />
            <ion-skeleton-text :animated="true" style="width: 65%" />
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Estado de error -->
      <ErrorState
        v-else-if="error"
        title="No se pudo cargar el detalle"
        :message="errorMessage"
        @retry="loadAnimalDetail"
      />

      <!-- Estado vacío si no existe el ID -->
      <EmptyState
        v-else-if="!animal"
        title="Animal no encontrado"
        :message="`No se encontró ningún registro asociado al identificador #${animalId}.`"
      />

      <!-- Ficha completa del animal -->
      <div v-else class="detail-container">
        <ion-card>
          <ion-card-header>
            <div class="header-row">
              <div>
                <ion-card-subtitle>Arete: {{ animal.arete }} · ID #{{ animal.id }}</ion-card-subtitle>
                <ion-card-title>{{ animal.nombre }}</ion-card-title>
              </div>
              <ion-chip :color="estadoColor(animal.estado)" outline>
                {{ animal.estado }}
              </ion-chip>
            </div>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="full">
              <ion-item>
                <ion-label>
                  <h3>Raza</h3>
                  <p>{{ animal.raza }}</p>
                </ion-label>
              </ion-item>

              <ion-item>
                <ion-label>
                  <h3>Sexo</h3>
                  <p>{{ animal.sexo }}</p>
                </ion-label>
              </ion-item>

              <ion-item>
                <ion-label>
                  <h3>Potrero Asignado</h3>
                  <p>{{ animal.potrero }}</p>
                </ion-label>
              </ion-item>

              <ion-item>
                <ion-label>
                  <h3>Peso Actual</h3>
                  <p>{{ animal.peso === null || animal.peso === undefined ? 'Sin registro' : `${animal.peso} kg` }}</p>
                </ion-label>
              </ion-item>

              <ion-item v-if="animal.fechaNacimiento">
                <ion-label>
                  <h3>Fecha de Nacimiento</h3>
                  <p>{{ animal.fechaNacimiento }}</p>
                </ion-label>
              </ion-item>

              <ion-item lines="none" v-if="animal.observaciones">
                <ion-label class="ion-text-wrap">
                  <h3>Observaciones</h3>
                  <p>{{ animal.observaciones }}</p>
                </ion-label>
              </ion-item>
            </ion-list>

            <div class="actions-block ion-margin-top">
              <ion-button expand="block" @click="goToEdit">
                <ion-icon slot="start" :icon="createOutline" />
                Editar Registro
              </ion-button>
              <ion-button expand="block" fill="outline" color="medium" @click="goBackToList">
                <ion-icon slot="start" :icon="arrowBackOutline" />
                Volver al Listado
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonSkeletonText,
  onIonViewWillEnter,
} from '@ionic/vue';
import { arrowBackOutline, cloudOfflineOutline, createOutline } from 'ionicons/icons';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import type { AnimalItem } from '@/models/auth.model';
import { animalService, ApiError, formatearMarcaDeTiempo, networkService } from '@/services';

const route = useRoute();
const router = useRouter();

// Lectura reactiva del parámetro de ruta (:id)
const animalId = computed<string>(() => String(route.params.id ?? ''));

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const errorMessage = ref<string>('');
const animal = ref<AnimalItem | null>(null);

/** Estado de cache y marca de tiempo (Persona 4). */
const desdeCache = ref<boolean>(false);
const ultimaActualizacion = ref<string | null>(null);

const mostrandoAvisoOffline = computed<boolean>(
  () => Boolean(animal.value) && (desdeCache.value || !networkService.isOnline.value),
);

const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

function estadoColor(estado: string) {
  if (estado === 'Activo') return 'success';
  if (estado === 'Tratamiento') return 'warning';
  if (estado === 'Vendido') return 'medium';
  return 'primary';
}

/**
 * Detalle contra GET /api/v1/animales/{id} con soporte de cache local sin conexion (Persona 4).
 * Un 404 se trata como "no encontrado" (estado vacio), no como error.
 */
async function loadAnimalDetail() {
  loading.value = true;
  error.value = false;
  errorMessage.value = '';

  try {
    const resultado = await animalService.obtenerConCache(animalId.value);
    animal.value = resultado.item;
    desdeCache.value = resultado.desdeCache;
    ultimaActualizacion.value = resultado.ultimaActualizacion;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      animal.value = null;
    } else {
      error.value = true;
      errorMessage.value = err instanceof Error ? err.message : 'Error al consultar el detalle.';
    }
  } finally {
    loading.value = false;
  }
}

onIonViewWillEnter(() => {
  loadAnimalDetail();
});

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  // Refresca el detalle automaticamente cuando se recupera la red (Persona 4)
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      loadAnimalDetail();
    } else if (animal.value) {
      desdeCache.value = true;
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});

function goToEdit() {
  router.push({
    path: '/tabs/registro',
    query: { id: animalId.value },
  });
}

function goBackToList() {
  router.push('/tabs/animales');
}
</script>

<style scoped>
.detail-container {
  max-width: 640px;
  margin: 0 auto;
}

.offline-banner {
  max-width: 640px;
  margin: 0 auto 0.75rem;
  display: flex;
  justify-content: center;
}

.offline-chip {
  height: auto;
  padding: 0.4rem 0.75rem;
  white-space: normal;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.actions-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
