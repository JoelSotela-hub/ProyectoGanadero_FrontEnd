<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Animales</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="goToForm">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
          <ion-button @click="logout">Salir</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="search"
          placeholder="N° de arete, nombre..."
          :debounce="300"
        />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Filtros -->
      <ion-list lines="full" class="filters-list">
        <ion-item>
          <ion-select v-model="filters.potrero" label="Potrero" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Todos</ion-select-option>
            <ion-select-option value="1">Norte</ion-select-option>
            <ion-select-option value="2">El Río</ion-select-option>
            <ion-select-option value="3">La Laguna</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="filters.raza" label="Raza" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Todas</ion-select-option>
            <ion-select-option value="1">Brahman</ion-select-option>
            <ion-select-option value="2">Simmental</ion-select-option>
            <ion-select-option value="3">Angus</ion-select-option>
            <ion-select-option value="4">Gyr Lechero</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="filters.sexo" label="Sexo" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Cualquiera</ion-select-option>
            <ion-select-option value="Macho">Macho</ion-select-option>
            <ion-select-option value="Hembra">Hembra</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="filters.estado" label="Estado" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Todos</ion-select-option>
            <ion-select-option value="Activo">Activo</ion-select-option>
            <ion-select-option value="Tratamiento">En Tratamiento</ion-select-option>
            <ion-select-option value="Vendido">Vendido</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <!-- Skeleton (carga) -->
      <ion-grid v-if="loading" class="ion-padding-horizontal">
        <ion-row>
          <ion-col v-for="i in 4" :key="i" size="12" size-sm="6" size-md="4">
            <ion-card>
              <ion-card-header>
                <ion-skeleton-text :animated="true" style="width: 40%" />
                <ion-skeleton-text :animated="true" style="width: 70%" />
              </ion-card-header>
              <ion-card-content>
                <ion-skeleton-text :animated="true" />
                <ion-skeleton-text :animated="true" style="width: 80%" />
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Listado -->
      <ion-grid v-else class="ion-padding-horizontal">
        <ion-row>
          <ion-col v-for="a in animalFiltrado" :key="a.id" size="12" size-sm="6" size-md="4">
            <ion-card button @click="goToDetail(a.id)">
              <ion-card-header>
                <ion-card-subtitle>Arete: {{ a.arete }}</ion-card-subtitle>
                <ion-card-title>{{ a.nombre }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p><strong>Raza:</strong> {{ a.raza }}</p>
                <p><strong>Sexo:</strong> {{ a.sexo }}</p>
                <p><strong>Potrero:</strong> {{ a.potrero }}</p>
                <p><strong>Peso:</strong> {{ a.peso }} kg</p>
                <ion-chip :color="estadoColor(a.estado)" outline>{{ a.estado }}</ion-chip>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>

        <div v-if="!animalFiltrado.length" class="empty-state ion-text-center ion-padding">
          <ion-icon :icon="pawOutline" size="large" color="medium" />
          <p>No hay animales que coincidan con los filtros.</p>
        </div>
      </ion-grid>

      <ion-infinite-scroll @ionInfinite="onInfinite($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
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
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonSearchbar, IonList, IonItem, IonSelect, IonSelectOption,
  IonButtons, IonButton, IonIcon, IonGrid, IonRow, IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonChip, IonRefresher, IonRefresherContent, IonSkeletonText,
  IonInfiniteScroll, IonInfiniteScrollContent, IonFab, IonFabButton
} from '@ionic/vue';
import { add, pawOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const search = ref('');
const filters = ref({ potrero: '', raza: '', sexo: '', estado: '' });
const loading = ref(true);

// Datos simulados — Persona 3 los reemplaza por getList(page, limit)
const animales = ref([
  { id: 1, arete: 'GT-0001', nombre: 'Lucero',   raza: 'Brahman',     sexo: 'Hembra', potrero: 'Norte',     peso: 420, estado: 'Activo' },
  { id: 2, arete: 'GT-0002', nombre: 'Trueno',   raza: 'Angus',       sexo: 'Macho',  potrero: 'El Río',    peso: 510, estado: 'Activo' },
  { id: 3, arete: 'GT-0003', nombre: 'Estrella', raza: 'Simmental',   sexo: 'Hembra', potrero: 'La Laguna', peso: 380, estado: 'Tratamiento' },
  { id: 4, arete: 'GT-0004', nombre: 'Capitán',  raza: 'Gyr Lechero', sexo: 'Macho',  potrero: 'Norte',     peso: 460, estado: 'Activo' },
  { id: 5, arete: 'GT-0005', nombre: 'Mariposa', raza: 'Brahman',     sexo: 'Hembra', potrero: 'El Río',    peso: 395, estado: 'Vendido' },
]);

onMounted(() => {
  setTimeout(() => (loading.value = false), 600);
});

const animalFiltrado = computed(() =>
  animales.value.filter(a => {
    const q = search.value.toLowerCase();
    const matchSearch = !q || a.arete.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q);
    const matchSexo = !filters.value.sexo || a.sexo === filters.value.sexo;
    const matchEstado = !filters.value.estado || a.estado === filters.value.estado;
    return matchSearch && matchSexo && matchEstado;
  })
);

function estadoColor(estado: string) {
  if (estado === 'Activo') return 'success';
  if (estado === 'Tratamiento') return 'warning';
  if (estado === 'Vendido') return 'medium';
  return 'primary';
}

function onFilterChange() { /* Persona 3: consultar API con filtros */ }

async function onRefresh(e: any) {
  setTimeout(() => e.target.complete(), 600);
}

async function onInfinite(e: any) {
  setTimeout(() => e.target.complete(), 600);
}

function goToForm() {
  router.push('/tabs/registro');
}

function goToDetail(id: number) {
  router.push(`/detalle/${id}`);
}

async function logout() {
  await authStore.logout();
  await router.replace('/login');
}
</script>

<style scoped>
.filters-list {
  padding-top: 0;
}
.empty-state ion-icon {
  font-size: 3rem;
}
.empty-state p {
  color: var(--ion-color-medium);
  margin-top: 0.5rem;
}
</style>
