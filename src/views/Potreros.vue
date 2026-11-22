<template>
  <ion-page>
    <app-header titulo="Potreros" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Gestión territorial</p>
            <h1 class="gg-title">Potreros</h1>
            <p class="gg-subtitle">
              Consulta áreas, estado del pasto, capacidad máxima y los animales asignados a cada potrero.
            </p>
          </div>
          <div v-if="esAdmin" class="gg-actions">
            <button type="button" class="gg-btn" data-testid="btn-crear-potrero" @click="abrirCrear">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nuevo potrero
            </button>
          </div>
        </header>

        <!-- Aviso obligatorio de datos no actualizados (caché offline con marca de tiempo) -->
        <div
          v-if="store.mostrandoAvisoOffline"
          class="gg-alert gg-alert--warning"
          role="status"
          aria-live="polite"
          data-testid="offline-cache-banner"
        >
          <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
          <span>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ store.ultimaActualizacionTexto }})
          </span>
        </div>

        <!-- Filtros conectados al API -->
        <form class="gg-card gg-filters" role="search" aria-label="Filtros de potreros" @submit.prevent>
          <div class="gg-field gg-filters__search">
            <label class="gg-field__label" for="p-search">Buscar por nombre</label>
            <div class="gg-field__control">
              <input
                id="p-search"
                class="gg-input gg-input--icon"
                type="search"
                placeholder="Ej: Potrero Norte"
                autocomplete="off"
                :value="store.filtros.nombre"
                @input="store.buscar(($event.target as HTMLInputElement).value)"
              />
              <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
            </div>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="p-estado-pasto">Estado del pasto</label>
            <select
              id="p-estado-pasto"
              class="gg-select"
              :value="store.filtros.estado_pasto"
              @change="store.establecerEstadoPasto(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos</option>
              <option v-for="estado in ESTADOS_PASTO" :key="estado" :value="estado">{{ estado }}</option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="p-orden">Ordenar por</label>
            <select
              id="p-orden"
              class="gg-select"
              :value="store.claveOrden"
              @change="store.establecerOrden(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in OPCIONES_ORDEN_POTRERO" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
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

        <!-- Estado 1: Cargando -->
        <section v-if="store.loading" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando potreros">
          <div v-for="i in 5" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 24%" />
            <span class="gg-skeleton" style="width: 16%" />
            <span class="gg-skeleton" style="width: 16%" />
            <span class="gg-skeleton" style="width: 24%" />
          </div>
        </section>

        <!-- Estado 2: Error con reintento -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el listado de potreros"
          :message="store.mensajeError"
          @retry="store.recargar()"
        />

        <!-- Estado 3: Vacío -->
        <section v-else-if="!store.items.length" class="gg-card">
          <empty-state
            :title="store.hayFiltrosActivos ? 'Sin resultados' : 'Sin potreros registrados'"
            :message="
              store.hayFiltrosActivos
                ? 'No hay potreros que coincidan con los filtros aplicados.'
                : 'Aún no hay potreros registrados en la finca.'
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
            <button v-else-if="esAdmin" type="button" class="gg-btn" @click="abrirCrear">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Crear primer potrero
            </button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos -->
        <section v-else class="gg-card gg-card--flush" aria-label="Listado de potreros">
          <p class="gg-count" role="status">{{ store.total }} {{ store.total === 1 ? 'potrero' : 'potreros' }}</p>
          <div class="gg-table-wrapper">
            <table class="gg-table" data-testid="tabla-potreros">
              <caption class="gg-sr-only">
                Listado de potreros registrados
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Extensión</th>
                  <th scope="col">Capacidad máx.</th>
                  <th scope="col">Estado del pasto</th>
                  <th scope="col">Código QR</th>
                  <th v-if="esAdmin" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in store.items" :key="p.potrero_id">
                  <td data-label="Nombre">
                    <a :href="`/potreros/${p.potrero_id}`" @click.prevent="router.push(`/potreros/${p.potrero_id}`)">
                      {{ p.nombre }}
                    </a>
                  </td>
                  <td data-label="Extensión">{{ formatearHectareas(p.hectareas_de_extension) }}</td>
                  <td data-label="Capacidad máx.">{{ p.capacidad_maxima }} animales</td>
                  <td data-label="Estado del pasto">
                    <span class="gg-badge" :class="claseEstadoPasto(p.estado_pasto)">
                      {{ p.estado_pasto || 'Sin especificar' }}
                    </span>
                  </td>
                  <td data-label="Código QR">
                    <span class="gg-mono">{{ p.codigo_qr || '—' }}</span>
                  </td>
                  <td v-if="esAdmin" data-label="Acciones">
                    <div class="gg-row-actions">
                      <button
                        type="button"
                        class="gg-action-link"
                        :aria-label="`Editar potrero ${p.nombre}`"
                        :data-testid="`btn-editar-potrero-${p.potrero_id}`"
                        @click="abrirEditar(p)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="gg-action-link gg-action-link--danger"
                        :aria-label="`Eliminar potrero ${p.nombre}`"
                        :disabled="store.eliminandoId === p.potrero_id"
                        :data-testid="`btn-eliminar-potrero-${p.potrero_id}`"
                        @click="confirmarEliminar(p)"
                      >
                        {{ store.eliminandoId === p.potrero_id ? 'Eliminando...' : 'Eliminar' }}
                      </button>
                    </div>
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

      <potrero-form-modal :open="modalAbierto" @close="cerrarModal" @saved="alGuardarPotrero" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
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
import { addOutline, cloudOfflineOutline, searchOutline } from 'ionicons/icons';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PotreroFormModal from '@/components/PotreroFormModal.vue';
import { useRol } from '@/composables/useRol';
import { ESTADOS_PASTO, mostrarToast, networkService, type Potrero } from '@/services';
import { OPCIONES_ORDEN_POTRERO, usePotreroStore } from '@/stores/potrero';

const router = useRouter();
const store = usePotreroStore();
const { esAdmin } = useRol();

const modalAbierto = ref<boolean>(false);
let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  void store.recargar();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
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

onIonViewWillEnter(() => {
  void store.recargar();
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function formatearHectareas(valor: number): string {
  if (!Number.isFinite(valor)) return '—';
  return `${valor} ha`;
}

function claseEstadoPasto(estado: string | null): string {
  if (estado === 'Excelente') return 'gg-badge--success';
  if (estado === 'Regular') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

function abrirCrear(): void {
  if (!esAdmin.value) return;
  store.prepararNuevo();
  modalAbierto.value = true;
}

function abrirEditar(potrero: Potrero): void {
  if (!esAdmin.value) return;
  store.prepararEdicion(potrero);
  modalAbierto.value = true;
}

function cerrarModal(): void {
  modalAbierto.value = false;
}

async function alGuardarPotrero(): Promise<void> {
  modalAbierto.value = false;
  await store.recargar();
}

async function confirmarEliminar(potrero: Potrero): Promise<void> {
  if (!esAdmin.value) return;
  const alerta = await alertController.create({
    header: 'Eliminar potrero',
    message: `¿Seguro que deseas eliminar "${potrero.nombre}"? Esta acción no se puede deshacer.`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminar(potrero.potrero_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio (RN-02)',
      message: resultado.mensaje,
      buttons: ['Entendido'],
    });
    await alertaRegla.present();
    await mostrarToast(resultado.mensaje, 'warning', 5000);
  } else {
    await mostrarToast(resultado.mensaje, 'danger', 5000);
  }
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
    grid-template-columns: 2fr 1fr 1.25fr auto;
  }
  .gg-filters__search {
    grid-column: auto;
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

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
}

.gg-row-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.gg-action-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gg-olive);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
.gg-action-link:hover {
  color: var(--gg-olive-hover);
}
.gg-action-link--danger {
  color: var(--gg-danger-fg);
}
.gg-action-link--danger:hover {
  color: #991b1b;
}
.gg-action-link:disabled {
  color: var(--gg-disabled-fg);
  cursor: not-allowed;
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
