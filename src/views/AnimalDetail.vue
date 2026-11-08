<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/animales" text="Volver" />
        </ion-buttons>
        <ion-title>Detalle del Animal</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="esAdmin" @click="goToEdit">
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
          <img v-if="animal.fotoUrl" :src="animal.fotoUrl" :alt="`Foto del animal ${animal.arete}`" class="animal-foto" />
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

              <ion-item v-if="animal.codigoQr">
                <ion-label>
                  <h3>Código QR</h3>
                  <p>{{ animal.codigoQr }}</p>
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

            <!-- Historial de pesajes -->
            <h4 v-if="animal.pesajes?.length" class="section-title">Pesajes</h4>
            <ion-list v-if="animal.pesajes?.length" lines="full">
              <ion-item v-for="p in animal.pesajes" :key="p.id">
                <ion-label>
                  <h3>{{ p.pesoKg }} kg</h3>
                  <p>{{ p.fecha ?? 'Sin fecha' }}<span v-if="p.observaciones"> · {{ p.observaciones }}</span></p>
                </ion-label>
              </ion-item>
            </ion-list>

            <!-- Tratamientos aplicados -->
            <h4 v-if="animal.tratamientos?.length" class="section-title">Tratamientos</h4>
            <ion-list v-if="animal.tratamientos?.length" lines="full">
              <ion-item v-for="t in animal.tratamientos" :key="t.id">
                <ion-label class="ion-text-wrap">
                  <h3>{{ t.nombre }}<span v-if="t.tipo"> · {{ t.tipo }}</span></h3>
                  <p>
                    {{ t.fechaAplicacion ?? 'Sin fecha' }}<span v-if="t.dosisMl"> · {{ t.dosisMl }} ml</span
                    ><span v-if="t.observaciones"> · {{ t.observaciones }}</span>
                  </p>
                </ion-label>
              </ion-item>
            </ion-list>

            <div class="actions-block ion-margin-top">
              <ion-button v-if="esAdmin" expand="block" @click="goToEdit">
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

        <!-- Tarjeta de Código QR generada dinámicamente en cliente (sin guardar imágenes en BD) -->
        <ion-card v-if="codigoQrValor" class="qr-card ion-text-center">
          <ion-card-header>
            <ion-card-subtitle>Identificación por Escáner</ion-card-subtitle>
            <ion-card-title>Código QR del Animal</ion-card-title>
          </ion-card-header>
          <ion-card-content class="qr-card-content">
            <div class="qr-box">
              <qrcode-vue :value="codigoQrValor" :size="180" level="H" render-as="svg" />
            </div>
            <p class="qr-code-text">{{ codigoQrValor }}</p>
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
import QrcodeVue from 'qrcode.vue';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useRol } from '@/composables/useRol';
import type { AnimalItem } from '@/models/auth.model';
import { animalService, ApiError, formatearMarcaDeTiempo, networkService } from '@/services';

const route = useRoute();
const router = useRouter();
// Solo el admin edita animales (el backend responde 403 al resto de roles).
const { esAdmin } = useRol();

// Lectura reactiva del parámetro de ruta (:id)
const animalId = computed<string>(() => String(route.params.id ?? ''));

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const errorMessage = ref<string>('');
const animal = ref<AnimalItem | null>(null);

const codigoQrValor = computed<string>(() => {
  if (!animal.value) return '';
  return animal.value.codigo_qr || animal.value.codigoQr || `VACA-${animal.value.arete}`;
});

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

.animal-foto {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
}

.section-title {
  margin: 1rem 0 0.25rem;
  font-size: 1rem;
}

.qr-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.qr-box {
  background: #ffffff;
  padding: 12px;
  border-radius: 12px;
  display: inline-flex;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.qr-code-text {
  margin: 0;
  font-family: monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
