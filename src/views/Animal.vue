<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Animales</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Escanear QR de Vaca" :disabled="escaneando" @click="escanearVaca">
            <ion-icon slot="icon-only" :icon="qrCodeOutline" />
          </ion-button>
          <ion-button v-if="esAdmin" @click="goToForm">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
          <ion-button @click="logout">Salir</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="search" placeholder="N° de arete, nombre..." :debounce="300" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Aviso obligatorio de datos no actualizados cuando se sirve desde cache o no hay red (Persona 4) -->
      <div
        v-if="mostrandoAvisoOffline"
        class="offline-banner ion-padding-horizontal ion-padding-top"
        role="status"
        aria-live="polite"
        data-testid="offline-cache-banner"
      >
        <ion-chip color="warning" class="offline-chip">
          <ion-icon :icon="cloudOfflineOutline" />
          <ion-label>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ ultimaActualizacionTexto }})
          </ion-label>
        </ion-chip>
      </div>

      <!-- Filtros -->
      <ion-list lines="full" class="filters-list">
        <ion-item>
          <ion-select v-model="filters.potrero" label="Potrero" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Todos</ion-select-option>
            <ion-select-option v-for="p in potreros" :key="p.id" :value="String(p.id)">
              {{ p.nombre }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="filters.raza" label="Raza" interface="popover" @ionChange="onFilterChange">
            <ion-select-option value="">Todas</ion-select-option>
            <ion-select-option v-for="r in razas" :key="r.id" :value="String(r.id)">
              {{ r.nombre }}
            </ion-select-option>
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

      <!-- Estado de error con reintento -->
      <ErrorState v-if="error" title="No se pudo cargar el listado" :message="errorMessage" @retry="recargar" />

      <!-- Skeleton (carga) -->
      <ion-grid v-else-if="loading" class="ion-padding-horizontal">
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
          <ion-col v-for="a in animalFiltrado" :key="a.id_animal ?? a.id" size="12" size-sm="6" size-md="4">
            <ion-card button @click="goToDetail(a.id_animal ?? a.id)">
              <ion-card-header>
                <ion-card-subtitle>Arete: {{ a.arete }}</ion-card-subtitle>
                <ion-card-title>{{ a.nombre }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p><strong>Raza:</strong> {{ a.raza }}</p>
                <p><strong>Sexo:</strong> {{ a.sexo }}</p>
                <p><strong>Potrero:</strong> {{ a.potrero }}</p>
                <p><strong>Peso:</strong> {{ pesoTexto(a.peso) }}</p>
                <ion-chip :color="estadoColor(a.estado)" outline>{{ a.estado }}</ion-chip>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>

        <EmptyState
          v-if="!animalFiltrado.length"
          title="Sin animales"
          message="No hay animales que coincidan con los filtros."
        />
      </ion-grid>

      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="onInfinite($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>

      <ion-fab v-if="esAdmin" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="goToForm">
          <ion-icon :icon="add" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
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
} from '@ionic/vue';
import { add, cloudOfflineOutline, qrCodeOutline } from 'ionicons/icons';

import ErrorState from '@/components/ErrorState.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useEscanearVaca } from '@/composables/useEscanearVaca';
import { useRol } from '@/composables/useRol';
import type { AnimalItem } from '@/models/auth.model';
import { useAuthStore } from '@/stores/auth';
import {
  animalService,
  catalogoService,
  formatearMarcaDeTiempo,
  mostrarError,
  networkService,
  type OpcionCatalogo,
} from '@/services';

const router = useRouter();
const authStore = useAuthStore();
const { escaneando, escanearVaca } = useEscanearVaca();
const { esAdmin } = useRol();

const search = ref('');
const filters = ref({ potrero: '', raza: '', sexo: '', estado: '' });

const loading = ref(true);
const error = ref(false);
const errorMessage = ref('');

const animales = ref<AnimalItem[]>([]);
const razas = ref<OpcionCatalogo[]>([]);
const potreros = ref<OpcionCatalogo[]>([]);

const paginaActual = ref(1);
const hayMas = ref(false);

/** Estado de cache y marca de tiempo (Persona 4). */
const desdeCache = ref(false);
const ultimaActualizacion = ref<string | null>(null);

const mostrandoAvisoOffline = computed<boolean>(
  () => desdeCache.value || (!networkService.isOnline.value && animales.value.length > 0),
);

const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

/** Tamano de pagina; el backend lo topa en 100. */
const POR_PAGINA = 15;

/**
 * El filtrado y la busqueda los resuelve la API, no el cliente: solo asi la
 * paginacion es coherente (filtrar en memoria dejaria fuera los registros
 * de las paginas que todavia no se descargaron).
 */
function filtrosDeConsulta(pagina: number) {
  return {
    page: pagina,
    per_page: POR_PAGINA,
    search: search.value.trim() || undefined,
    sexo: filters.value.sexo || undefined,
    estado: filters.value.estado || undefined,
    raza_id: filters.value.raza || undefined,
    potrero_id: filters.value.potrero || undefined,
    sort_by: 'numero_arete',
    order: 'asc' as const,
  };
}

async function cargar(pagina = 1, anexar = false): Promise<void> {
  if (!anexar) {
    loading.value = true;
    error.value = false;
    errorMessage.value = '';
  }

  try {
    const resultado = await animalService.listar(filtrosDeConsulta(pagina));
    animales.value = anexar ? [...animales.value, ...resultado.items] : resultado.items;
    paginaActual.value = resultado.paginacion.paginaActual;
    hayMas.value = resultado.hayMas;
    desdeCache.value = Boolean(resultado.desdeCache);
    ultimaActualizacion.value = resultado.ultimaActualizacion ?? ultimaActualizacion.value;
  } catch (err) {
    if (!anexar) {
      error.value = true;
      errorMessage.value = err instanceof Error ? err.message : 'No se pudo obtener el listado de animales.';
      animales.value = [];
      hayMas.value = false;
    } else {
      // Fallo al cargar una pagina adicional: aviso con toast, el listado actual se conserva.
      await mostrarError(err, 'No se pudo cargar más animales.');
    }
  } finally {
    loading.value = false;
  }
}

async function recargar(): Promise<void> {
  await cargar(1, false);
}

async function cargarCatalogos(): Promise<void> {
  try {
    const [listaRazas, listaPotreros] = await Promise.all([catalogoService.razas(), catalogoService.potreros()]);
    razas.value = listaRazas;
    potreros.value = listaPotreros;
  } catch {
    // Los catalogos son auxiliares: si fallan, los filtros quedan en "Todos".
  }
}

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  cargarCatalogos();
  cargar(1);

  // Al recuperar la red, refresca automaticamente el listado y los catalogos (Persona 4)
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      cargarCatalogos();
      recargar();
    } else if (animales.value.length > 0) {
      desdeCache.value = true;
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});

// El ion-searchbar ya trae debounce de 300 ms en la plantilla.
watch(search, () => {
  recargar();
});

/** El listado ya viene filtrado por la API (o por cache offline). */
const animalFiltrado = computed<AnimalItem[]>(() => animales.value);

function pesoTexto(peso: number | null | undefined): string {
  return peso === null || peso === undefined ? 'sin registro' : `${peso} kg`;
}

function estadoColor(estado: string) {
  if (estado === 'Activo') return 'success';
  if (estado === 'Tratamiento') return 'warning';
  if (estado === 'Vendido') return 'medium';
  return 'primary';
}

function onFilterChange() {
  recargar();
}

async function onRefresh(e: CustomEvent) {
  await cargar(1, false);
  (e.target as HTMLIonRefresherElement).complete();
}

async function onInfinite(e: CustomEvent) {
  if (hayMas.value) {
    await cargar(paginaActual.value + 1, true);
  }
  (e.target as HTMLIonInfiniteScrollElement).complete();
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
.offline-banner {
  display: flex;
  justify-content: center;
}
.offline-chip {
  height: auto;
  padding: 0.4rem 0.75rem;
  white-space: normal;
}
.empty-state ion-icon {
  font-size: 3rem;
}
.empty-state p {
  color: var(--ion-color-medium);
  margin-top: 0.5rem;
}
</style>
