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
                  <p>{{ animal.peso }} kg</p>
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
import { computed, ref } from 'vue';
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
import { arrowBackOutline, createOutline } from 'ionicons/icons';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import type { AnimalItem } from '@/models/auth.model';

const route = useRoute();
const router = useRouter();

// Lectura reactiva del parámetro de ruta (:id)
const animalId = computed<string>(() => String(route.params.id ?? ''));

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const errorMessage = ref<string>('');
const animal = ref<AnimalItem | null>(null);

// Catálogo base simulado (Persona 3 reemplazará por getById(id) contra la API real)
const mockCatalog: AnimalItem[] = [
  {
    id: 1,
    arete: 'GT-0001',
    nombre: 'Lucero',
    raza: 'Brahman',
    sexo: 'Hembra',
    potrero: 'Norte',
    peso: 420,
    estado: 'Activo',
    fechaNacimiento: '2023-04-12',
    observaciones: 'Excelente condición corporal. Vacunación al día.',
  },
  {
    id: 2,
    arete: 'GT-0002',
    nombre: 'Trueno',
    raza: 'Angus',
    sexo: 'Macho',
    potrero: 'El Río',
    peso: 510,
    estado: 'Activo',
    fechaNacimiento: '2022-11-05',
    observaciones: 'Semental principal del potrero El Río.',
  },
  {
    id: 3,
    arete: 'GT-0003',
    nombre: 'Estrella',
    raza: 'Simmental',
    sexo: 'Hembra',
    potrero: 'La Laguna',
    peso: 380,
    estado: 'Tratamiento',
    fechaNacimiento: '2024-01-20',
    observaciones: 'En seguimiento veterinario por suplementación vitamínica.',
  },
  {
    id: 4,
    arete: 'GT-0004',
    nombre: 'Capitán',
    raza: 'Gyr Lechero',
    sexo: 'Macho',
    potrero: 'Norte',
    peso: 460,
    estado: 'Activo',
    fechaNacimiento: '2023-07-18',
    observaciones: 'Ganancia de peso constante en los últimos 3 controles.',
  },
  {
    id: 5,
    arete: 'GT-0005',
    nombre: 'Mariposa',
    raza: 'Brahman',
    sexo: 'Hembra',
    potrero: 'El Río',
    peso: 395,
    estado: 'Vendido',
    fechaNacimiento: '2023-02-09',
    observaciones: 'Registro histórico de animal comercializado.',
  },
];

function estadoColor(estado: string) {
  if (estado === 'Activo') return 'success';
  if (estado === 'Tratamiento') return 'warning';
  if (estado === 'Vendido') return 'medium';
  return 'primary';
}

async function loadAnimalDetail() {
  loading.value = true;
  error.value = false;

  try {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const numericId = Number(animalId.value);
    animal.value = mockCatalog.find((item) => item.id === numericId) ?? null;
  } catch (err) {
    error.value = true;
    errorMessage.value = err instanceof Error ? err.message : 'Error al consultar el detalle.';
  } finally {
    loading.value = false;
  }
}

onIonViewWillEnter(() => {
  loadAnimalDetail();
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
