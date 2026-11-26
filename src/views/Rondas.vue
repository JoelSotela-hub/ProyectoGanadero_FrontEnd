<template>
  <ion-page>
    <app-header :titulo="tituloVista" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Inspección en campo</p>
            <h1 class="gg-title">{{ tituloVista }}</h1>
            <p class="gg-subtitle">
              {{
                esAdmin
                  ? 'Audita el recorrido de los operarios, horarios, estado de potreros y coordenadas registradas.'
                  : 'Inicia rondas de inspección, escanea el código QR de cada potrero y registra su estado.'
              }}
            </p>
          </div>
          <div class="gg-actions">
            <button
              type="button"
              class="gg-btn gg-btn--outline"
              data-testid="btn-exportar-csv"
              :disabled="loading || !rondas.length"
              @click="exportarListado"
            >
              <ion-icon :icon="downloadOutline" aria-hidden="true" />
              Exportar CSV
            </button>
            <button
              v-if="esOperario"
              type="button"
              class="gg-btn"
              :disabled="iniciando"
              data-testid="btn-iniciar-ronda"
              @click="iniciarRonda"
            >
              <ion-icon :icon="walkOutline" aria-hidden="true" />
              {{ iniciando ? 'Iniciando...' : 'Iniciar ronda' }}
            </button>
          </div>
        </header>

        <div
          v-if="mostrandoAvisoOffline"
          class="gg-alert gg-alert--warning"
          role="status"
          aria-live="polite"
          data-testid="offline-cache-banner"
        >
          <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
          <span>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ ultimaActualizacionTexto }})
          </span>
        </div>

        <form class="gg-card gg-filters" role="search" aria-label="Filtros de rondas" @submit.prevent>
          <div class="gg-field">
            <label class="gg-field__label" for="rondas-filtro-estado">Estado de la ronda</label>
            <select
              id="rondas-filtro-estado"
              class="gg-select"
              :value="filtroEstado"
              @change="cambiarFiltroEstado(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todas</option>
              <option value="en_progreso">En progreso</option>
              <option value="completada">Completada</option>
            </select>
          </div>

          <div v-if="filtroEstado" class="gg-filters__clear">
            <button type="button" class="gg-btn gg-btn--ghost" @click="cambiarFiltroEstado('')">Limpiar filtro</button>
          </div>
        </form>

        <section v-if="loading" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando rondas">
          <div v-for="i in 4" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 18%" />
            <span class="gg-skeleton" style="width: 26%" />
            <span class="gg-skeleton" style="width: 18%" />
            <span class="gg-skeleton" style="width: 20%" />
          </div>
        </section>

        <error-state
          v-else-if="error"
          title="No se pudieron cargar las rondas"
          :message="errorMessage"
          @retry="recargar"
        />

        <section v-else-if="!rondas.length" class="gg-card">
          <empty-state
            :title="filtroEstado ? 'Sin rondas con ese estado' : 'Sin rondas registradas'"
            :message="
              filtroEstado
                ? 'No se encontraron rondas para el filtro seleccionado.'
                : esAdmin
                  ? 'Todavía ningún operario ha iniciado una ronda de inspección.'
                  : 'Aún no has iniciado ninguna ronda. Pulsa «Iniciar ronda» para comenzar.'
            "
          >
            <button v-if="filtroEstado" type="button" class="gg-btn gg-btn--outline" @click="cambiarFiltroEstado('')">
              Ver todas
            </button>
            <button v-else-if="esOperario" type="button" class="gg-btn" :disabled="iniciando" @click="iniciarRonda">
              <ion-icon :icon="walkOutline" aria-hidden="true" />
              Iniciar primera ronda
            </button>
          </empty-state>
        </section>

        <section v-else class="gg-card gg-card--flush" aria-label="Listado de rondas">
          <p class="gg-count" role="status">{{ total }} {{ total === 1 ? 'ronda' : 'rondas' }}</p>
          <div class="gg-table-wrapper">
            <table class="gg-table" data-testid="tabla-rondas">
              <caption class="gg-sr-only">
                Listado de rondas de inspección
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ronda</th>
                  <th v-if="esAdmin" scope="col">Operario</th>
                  <th scope="col">Inicio</th>
                  <th scope="col">Finalizada</th>
                  <th scope="col">Potreros</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rondas" :key="r.id">
                  <td data-label="Ronda">
                    <a :href="`/rondas/${r.id}`" @click.prevent="abrirRonda(r.id)">Ronda #{{ r.id }}</a>
                  </td>
                  <td v-if="esAdmin" data-label="Operario">
                    <template v-if="r.operador">
                      <strong>{{ r.operador.name }}</strong>
                      <div class="gg-muted">{{ r.operador.email }}</div>
                    </template>
                    <span v-else>—</span>
                  </td>
                  <td data-label="Inicio">{{ formatearFecha(r.fecha_inicio) }}</td>
                  <td data-label="Finalizada">{{ r.fecha_fin ? formatearFecha(r.fecha_fin) : '—' }}</td>
                  <td data-label="Potreros">{{ r.total_puntos }}</td>
                  <td data-label="Estado">
                    <span
                      class="gg-badge"
                      :class="r.estado === 'en_progreso' ? 'gg-badge--warning' : 'gg-badge--success'"
                    >
                      {{ r.estado === 'en_progreso' ? 'En progreso' : 'Completada' }}
                    </span>
                  </td>
                  <td data-label="Detalle">
                    <a :href="`/rondas/${r.id}`" class="gg-link" @click.prevent="abrirRonda(r.id)">Ver recorrido</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="onInfinite($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>
    </ion-content>

    <ion-loading :is-open="iniciando" message="Iniciando ronda..." />
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonLoading,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import { cloudOfflineOutline, downloadOutline, walkOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useRol } from '@/composables/useRol';
import type { EstadoRonda, Ronda } from '@/models/ronda.model';
import {
  ApiError,
  formatearMarcaDeTiempo,
  mensajeDeError,
  mostrarError,
  mostrarToast,
  networkService,
  rondaService,
} from '@/services';
import { exportarCsv, type ColumnaCsv } from '@/utils/csv';

const router = useRouter();
const { esAdmin, esOperario } = useRol();

const tituloVista = computed<string>(() => (esAdmin.value ? 'Auditoría de Rondas' : 'Mis Rondas'));

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const errorMessage = ref<string>('');
const iniciando = ref<boolean>(false);

const rondas = ref<Ronda[]>([]);
const filtroEstado = ref<EstadoRonda | ''>('');
const paginaActual = ref<number>(1);
const total = ref<number>(0);
const hayMas = ref<boolean>(false);

const desdeCache = ref<boolean>(false);
const ultimaActualizacion = ref<string | null>(null);

const mostrandoAvisoOffline = computed<boolean>(
  () => desdeCache.value || (!networkService.isOnline.value && rondas.value.length > 0),
);
const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

const formatearFecha = formatearMarcaDeTiempo;

let controlador: AbortController | null = null;
let cancelarSuscripcionRed: (() => void) | null = null;

function cancelarPendiente(): void {
  controlador?.abort();
  controlador = null;
}

async function cargar(pagina = 1, anexar = false): Promise<void> {
  controlador?.abort();
  const actual = new AbortController();
  controlador = actual;

  if (!anexar) {
    loading.value = true;
    error.value = false;
    errorMessage.value = '';
  }

  try {
    const resultado = await rondaService.listar(pagina, 15, {
      estado: filtroEstado.value,
      signal: actual.signal,
    });
    if (actual.signal.aborted) return;

    rondas.value = anexar ? [...rondas.value, ...resultado.items] : resultado.items;
    paginaActual.value = resultado.paginaActual;
    total.value = resultado.total;
    hayMas.value = resultado.hayMas;
    desdeCache.value = resultado.desdeCache;
    ultimaActualizacion.value = resultado.ultimaActualizacion ?? ultimaActualizacion.value;
  } catch (err) {
    if (actual.signal.aborted || (err instanceof ApiError && err.cancelada)) return;
    if (anexar) {
      await mostrarError(err);
    } else {
      error.value = true;
      errorMessage.value = mensajeDeError(err, 'No se pudo obtener el listado de rondas.');
      rondas.value = [];
      hayMas.value = false;
    }
  } finally {
    if (controlador === actual) {
      loading.value = false;
    }
  }
}

async function recargar(): Promise<void> {
  await cargar(1, false);
}

function cambiarFiltroEstado(valor: string): void {
  filtroEstado.value = valor === 'en_progreso' || valor === 'completada' ? valor : '';
  void recargar();
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
  void router.push(`/rondas/${id}`);
}

async function iniciarRonda(): Promise<void> {
  if (iniciando.value || !esOperario.value) return;

  const activa = rondas.value.find((r) => r.estado === 'en_progreso');
  if (activa) {
    await mostrarToast('Ya tienes una ronda en progreso. Te llevamos a ella.', 'warning');
    abrirRonda(activa.id);
    return;
  }

  const alertaObs = await alertController.create({
    header: 'Iniciar ronda',
    message: 'Puedes agregar observaciones iniciales opcionales antes de comenzar el recorrido.',
    inputs: [{ name: 'observaciones', type: 'textarea', placeholder: 'Observaciones (opcional)' }],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Iniciar', role: 'confirm' },
    ],
  });
  await alertaObs.present();
  const { data, role } = await alertaObs.onDidDismiss<{ values?: { observaciones?: string } }>();
  if (role !== 'confirm') return;

  iniciando.value = true;
  try {
    const nueva = await rondaService.iniciar(data?.values?.observaciones?.trim() || undefined);
    await mostrarToast('Ronda iniciada.', 'success');
    abrirRonda(nueva.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const alertaConflicto = await alertController.create({
        header: 'Ronda en progreso',
        subHeader: 'Regla de negocio',
        message: err.message,
        buttons: ['Ir a la ronda activa'],
      });
      await alertaConflicto.present();
      await alertaConflicto.onDidDismiss();
      await mostrarToast(err.message, 'warning', 5000);
      try {
        const existente = await rondaService.buscarActiva();
        if (existente) abrirRonda(existente.id);
      } catch {
        return;
      }
    } else {
      await mostrarError(err, 'No se pudo iniciar la ronda.');
    }
  } finally {
    iniciando.value = false;
  }
}

onMounted(() => {
  void cargar(1, false);
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void recargar();
    } else if (rondas.value.length > 0) {
      desdeCache.value = true;
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
  cancelarPendiente();
});

onIonViewWillEnter(() => {
  void cargar(1, false);
});

onIonViewWillLeave(() => {
  cancelarPendiente();
});

async function exportarListado(): Promise<void> {
  if (!rondas.value.length) {
    await mostrarToast('No hay registros para exportar.', 'warning', 2500);
    return;
  }

  const columnas: ColumnaCsv<Ronda>[] = [
    { encabezado: 'Ronda', valor: (r) => `#${r.id}` },
    ...(esAdmin.value
      ? ([
          { encabezado: 'Operario', valor: (r) => r.operador?.name ?? '' },
          { encabezado: 'Correo operario', valor: (r) => r.operador?.email ?? '' },
        ] satisfies ColumnaCsv<Ronda>[])
      : []),
    { encabezado: 'Inicio', valor: (r) => formatearFecha(r.fecha_inicio) },
    { encabezado: 'Finalizada', valor: (r) => (r.fecha_fin ? formatearFecha(r.fecha_fin) : '') },
    { encabezado: 'Potreros', valor: (r) => r.total_puntos },
    { encabezado: 'Estado', valor: (r) => (r.estado === 'en_progreso' ? 'En progreso' : 'Completada') },
    { encabezado: 'Observaciones', valor: (r) => r.observaciones ?? '' },
  ];

  const { nombreArchivo, totalFilas } = exportarCsv('rondas', columnas, rondas.value);
  await mostrarToast(
    `Se exportaron ${totalFilas} ${totalFilas === 1 ? 'registro' : 'registros'} a ${nombreArchivo}`,
    'success',
    2800,
  );
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
    grid-template-columns: minmax(14rem, 20rem) auto;
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

.gg-muted {
  color: var(--gg-ink-muted);
  font-size: 0.8rem;
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
