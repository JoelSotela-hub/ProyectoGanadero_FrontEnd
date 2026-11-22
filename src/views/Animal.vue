<template>
  <ion-page>
    <app-header titulo="Animales" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Inventario del hato</p>
            <h1 class="gg-title">Animales</h1>
            <p class="gg-subtitle">Consulta, filtra y administra los animales registrados en la finca.</p>
          </div>
          <div class="gg-actions">
            <button type="button" class="gg-btn gg-btn--outline" :disabled="escaneando" @click="escanearVaca">
              <ion-icon :icon="qrCodeOutline" aria-hidden="true" />
              Escanear QR
            </button>
            <button v-if="esAdmin" type="button" class="gg-btn" @click="router.push('/tabs/registro')">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Registrar Animal
            </button>
          </div>
        </header>

        <!-- Aviso obligatorio de datos no actualizados (caché offline con marca de tiempo) -->
        <div
          v-if="store.mostrandoAvisoOffline"
          class="gg-alert gg-alert--warning"
          role="status"
          data-testid="offline-cache-banner"
        >
          <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
          <span>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ store.ultimaActualizacionTexto }})
          </span>
        </div>

        <!-- Filtros -->
        <form class="gg-card gg-filters" role="search" aria-label="Filtros de animales" @submit.prevent>
          <div class="gg-field gg-filters__search">
            <label class="gg-field__label" for="f-search">Buscar por número de arete</label>
            <div class="gg-field__control">
              <input
                id="f-search"
                class="gg-input gg-input--icon"
                type="search"
                placeholder="Ej: CR-001"
                autocomplete="off"
                :value="store.filtros.search"
                @input="store.buscar(($event.target as HTMLInputElement).value)"
              />
              <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
            </div>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="f-potrero">Potrero</label>
            <select
              id="f-potrero"
              class="gg-select"
              :value="store.filtros.potrero_id"
              @change="store.establecerFiltro('potrero_id', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos</option>
              <option v-for="p in catalogos.potreros" :key="p.id" :value="String(p.id)">{{ p.nombre }}</option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="f-raza">Raza</label>
            <select
              id="f-raza"
              class="gg-select"
              :value="store.filtros.raza_id"
              @change="store.establecerFiltro('raza_id', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todas</option>
              <option v-for="r in catalogos.razas" :key="r.id" :value="String(r.id)">{{ r.nombre }}</option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="f-sexo">Sexo</label>
            <select
              id="f-sexo"
              class="gg-select"
              :value="store.filtros.sexo"
              @change="store.establecerFiltro('sexo', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Cualquiera</option>
              <option value="Macho">Macho</option>
              <option value="Hembra">Hembra</option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="f-estado">Estado</label>
            <select
              id="f-estado"
              class="gg-select"
              :value="store.filtros.estado"
              @change="store.establecerFiltro('estado', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos</option>
              <option v-for="e in ESTADOS_ANIMAL" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="f-orden">Ordenar por</label>
            <select
              id="f-orden"
              class="gg-select"
              :value="store.claveOrden"
              @change="store.establecerOrden(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in OPCIONES_ORDEN" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
            </select>
          </div>

          <div class="gg-filters__clear">
            <button
              v-if="store.hayFiltrosActivos"
              type="button"
              class="gg-btn gg-btn--ghost"
              @click="store.limpiarFiltros()"
            >
              Limpiar filtros
            </button>
          </div>
        </form>

        <!-- Estado: cargando -->
        <section v-if="store.loading" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando animales">
          <div v-for="i in 5" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 22%" />
            <span class="gg-skeleton" style="width: 18%" />
            <span class="gg-skeleton" style="width: 30%" />
          </div>
        </section>

        <!-- Estado: error con reintento -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el listado"
          :message="store.mensajeError"
          @retry="store.recargar()"
        />

        <!-- Estado: vacío -->
        <section v-else-if="!store.items.length" class="gg-card">
          <empty-state
            :title="store.hayFiltrosActivos ? 'Sin resultados' : 'Sin animales'"
            :message="
              store.hayFiltrosActivos
                ? 'No hay animales que coincidan con los filtros aplicados.'
                : 'Aún no hay animales registrados.'
            "
          >
            <button
              v-if="store.hayFiltrosActivos"
              type="button"
              class="gg-btn gg-btn--outline"
              @click="store.limpiarFiltros()"
            >
              Limpiar filtros
            </button>
          </empty-state>
        </section>

        <!-- Estado: datos -->
        <section v-else class="gg-card gg-card--flush" aria-label="Listado de animales">
          <p class="gg-count" role="status">{{ store.total }} {{ store.total === 1 ? 'animal' : 'animales' }}</p>
          <div class="gg-table-wrapper">
            <table class="gg-table">
              <caption class="gg-sr-only">
                Listado de animales
              </caption>
              <thead>
                <tr>
                  <th scope="col">Arete</th>
                  <th scope="col">Raza</th>
                  <th scope="col">Sexo</th>
                  <th scope="col">Potrero</th>
                  <th scope="col">Nacimiento</th>
                  <th scope="col">Estado</th>
                  <th v-if="esAdmin" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in store.items" :key="a.id">
                  <td data-label="Arete">
                    <a :href="`/detalle/${a.id}`" @click.prevent="router.push(`/detalle/${a.id}`)">{{ a.arete }}</a>
                  </td>
                  <td data-label="Raza">{{ a.raza }}</td>
                  <td data-label="Sexo">{{ a.sexo }}</td>
                  <td data-label="Potrero">{{ a.potrero }}</td>
                  <td data-label="Nacimiento">{{ fechaCorta(a.fechaNacimiento) }}</td>
                  <td data-label="Estado">
                    <span class="gg-badge" :class="claseEstado(a.estado)">{{ a.estado }}</span>
                  </td>
                  <td v-if="esAdmin" data-label="Acciones">
                    <a
                      :href="`/tabs/registro?id=${a.id}`"
                      :aria-label="`Editar animal ${a.arete}`"
                      @click.prevent="router.push(`/tabs/registro?id=${a.id}`)"
                      >Editar</a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ion-infinite-scroll :disabled="!store.hayMas" @ionInfinite="onInfinite($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import { addOutline, cloudOfflineOutline, qrCodeOutline, searchOutline } from 'ionicons/icons';
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useEscanearVaca } from '@/composables/useEscanearVaca';
import { useRol } from '@/composables/useRol';
import { mostrarToast, networkService } from '@/services';
import { ESTADOS_ANIMAL } from '@/stores/animalForm';
import { OPCIONES_ORDEN, useAnimalesStore } from '@/stores/animales';
import { useCatalogosStore } from '@/stores/catalogos';

const router = useRouter();
const store = useAnimalesStore();
const catalogos = useCatalogosStore();
const { esAdmin } = useRol();
const { escaneando, escanearVaca } = useEscanearVaca();

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  // Al recuperar la red, refresca el listado y los catálogos; al perderla, marca los datos como cacheados.
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void catalogos.cargar(true);
      void store.recargar();
    } else {
      store.marcarSinConexion();
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
  store.cancelarPendiente();
});

// Al entrar (incluye volver tras registrar/editar un animal) se refresca el listado.
onIonViewWillEnter(() => {
  void catalogos.cargar();
  void store.recargar();
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function fechaCorta(fecha?: string): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

function claseEstado(estado: string): string {
  if (estado === 'Activo') return 'gg-badge--success';
  if (estado === 'Tratamiento') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  await store.recargar();
  (evento.target as HTMLIonRefresherElement).complete();
}

async function onInfinite(evento: CustomEvent): Promise<void> {
  await store.cargarMas();
  if (store.mensajeError && !store.error) {
    await mostrarToast(store.mensajeError, 'danger', 4000);
  }
  (evento.target as HTMLIonInfiniteScrollElement).complete();
}
</script>

<style scoped>
.gg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.gg-filters {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
  align-items: end;
}
@media (min-width: 40rem) {
  .gg-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .gg-filters__search {
    grid-column: 1 / -1;
  }
}
@media (min-width: 62rem) {
  .gg-filters {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .gg-filters__search {
    grid-column: 1 / 3;
  }
}
.gg-filters__clear {
  display: flex;
  align-items: center;
}
.gg-count {
  margin: 0;
  padding: 0.9rem 1.25rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gg-ink-muted);
}
.gg-skeleton-row {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--gg-border);
}
.gg-skeleton-row:first-child {
  border-top: 0;
}
</style>
