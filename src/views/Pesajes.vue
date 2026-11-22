<template>
  <ion-page>
    <app-header titulo="Pesajes" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Control de peso</p>
            <h1 class="gg-title">Pesajes</h1>
            <p class="gg-subtitle">
              Consulta el historial global de pesajes del hato, filtra por animal, fechas o rango de peso.
            </p>
          </div>
          <div class="gg-actions">
            <button
              type="button"
              class="gg-btn gg-btn--outline"
              data-testid="btn-exportar-csv"
              :disabled="store.loading || !store.items.length"
              @click="exportarListado"
            >
              <ion-icon :icon="downloadOutline" aria-hidden="true" />
              Exportar CSV
            </button>
            <button
              v-if="store.puedeCrear"
              type="button"
              class="gg-btn"
              data-testid="btn-crear-pesaje"
              @click="abrirCrear"
            >
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Registrar pesaje
            </button>
          </div>
        </header>

        <!-- Aviso de caché offline con marca de tiempo -->
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
        <form class="gg-card gg-filters" role="search" aria-label="Filtros de pesajes" @submit.prevent>
          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-animal">Animal</label>
            <select
              id="pesaje-filtro-animal"
              class="gg-select"
              :value="store.filtros.id_animal"
              @change="store.establecerAnimal(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos los animales</option>
              <option v-for="a in store.animales" :key="a.id" :value="String(a.id)">
                {{ a.arete }}{{ a.raza ? ` · ${a.raza}` : '' }}
              </option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-desde">Fecha desde</label>
            <input
              id="pesaje-filtro-desde"
              class="gg-input"
              type="date"
              :value="store.filtros.fecha_desde"
              @change="store.establecerFechaDesde(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-hasta">Fecha hasta</label>
            <input
              id="pesaje-filtro-hasta"
              class="gg-input"
              type="date"
              :value="store.filtros.fecha_hasta"
              @change="store.establecerFechaHasta(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-peso-min">Peso mín. (kg)</label>
            <input
              id="pesaje-filtro-peso-min"
              class="gg-input"
              type="number"
              inputmode="decimal"
              min="0"
              max="9999.99"
              step="0.1"
              placeholder="Ej: 200"
              :value="store.filtros.peso_min"
              @input="store.establecerPesoMin(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-peso-max">Peso máx. (kg)</label>
            <input
              id="pesaje-filtro-peso-max"
              class="gg-input"
              type="number"
              inputmode="decimal"
              min="0"
              max="9999.99"
              step="0.1"
              placeholder="Ej: 600"
              :value="store.filtros.peso_max"
              @input="store.establecerPesoMax(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="pesaje-filtro-orden">Ordenar por</label>
            <select
              id="pesaje-filtro-orden"
              class="gg-select"
              :value="store.claveOrden"
              @change="store.establecerOrden(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in OPCIONES_ORDEN_PESAJE" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
            </select>
          </div>

          <div v-if="store.hayFiltrosActivos" class="gg-filters__clear">
            <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltros()">Limpiar filtros</button>
          </div>
        </form>

        <!-- Estado 1: Cargando -->
        <section v-if="store.loading" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando pesajes">
          <div v-for="i in 5" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 22%" />
            <span class="gg-skeleton" style="width: 16%" />
            <span class="gg-skeleton" style="width: 20%" />
            <span class="gg-skeleton" style="width: 28%" />
          </div>
        </section>

        <!-- Estado 2: Error con reintento -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el listado de pesajes"
          :message="store.mensajeError"
          @retry="store.recargar()"
        />

        <!-- Estado 3: Vacío -->
        <section v-else-if="!store.items.length" class="gg-card">
          <empty-state
            :title="store.hayFiltrosActivos ? 'Sin resultados' : 'Sin pesajes registrados'"
            :message="
              store.hayFiltrosActivos
                ? 'No hay pesajes que coincidan con los filtros aplicados.'
                : 'Aún no se han registrado pesajes en el hato.'
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
            <button v-else-if="store.puedeCrear" type="button" class="gg-btn" @click="abrirCrear">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Registrar primer pesaje
            </button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos -->
        <section v-else class="gg-card gg-card--flush" aria-label="Listado global de pesajes">
          <p class="gg-count" role="status">{{ store.total }} {{ store.total === 1 ? 'pesaje' : 'pesajes' }}</p>
          <div class="gg-table-wrapper">
            <table class="gg-table" data-testid="tabla-pesajes">
              <caption class="gg-sr-only">
                Listado global de pesajes registrados
              </caption>
              <thead>
                <tr>
                  <th scope="col">Animal (Arete)</th>
                  <th scope="col">Peso (kg)</th>
                  <th scope="col">Fecha de pesaje</th>
                  <th scope="col">Observaciones</th>
                  <th v-if="store.puedeEditar || store.puedeEliminar" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in store.items" :key="p.pesaje_id">
                  <td data-label="Animal (Arete)">
                    <a :href="`/detalle/${p.id_animal}`" @click.prevent="router.push(`/detalle/${p.id_animal}`)">
                      {{ p.animal?.numero_arete || `Animal #${p.id_animal}` }}
                    </a>
                  </td>
                  <td data-label="Peso (kg)">
                    <span class="gg-badge gg-badge--success">{{ formatearPeso(p.peso_kg) }}</span>
                  </td>
                  <td data-label="Fecha de pesaje">{{ formatearFecha(p.fecha_pesaje) }}</td>
                  <td data-label="Observaciones">{{ p.observaciones || '—' }}</td>
                  <td v-if="store.puedeEditar || store.puedeEliminar" data-label="Acciones">
                    <div class="gg-row-actions">
                      <button
                        v-if="store.puedeEditar"
                        type="button"
                        class="gg-action-link"
                        :aria-label="`Editar pesaje #${p.pesaje_id}`"
                        :data-testid="`btn-editar-pesaje-${p.pesaje_id}`"
                        @click="abrirEditar(p)"
                      >
                        Editar
                      </button>
                      <button
                        v-if="store.puedeEliminar"
                        type="button"
                        class="gg-action-link gg-action-link--danger"
                        :aria-label="`Eliminar pesaje #${p.pesaje_id}`"
                        :disabled="store.eliminandoId === p.pesaje_id"
                        :data-testid="`btn-eliminar-pesaje-${p.pesaje_id}`"
                        @click="confirmarEliminar(p)"
                      >
                        {{ store.eliminandoId === p.pesaje_id ? 'Eliminando...' : 'Eliminar' }}
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

      <!-- Modal Crear / Editar Pesaje -->
      <div
        v-if="modalAbierto && (store.esEdicion ? store.puedeEditar : store.puedeCrear)"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pesaje-titulo"
        data-testid="modal-pesaje-form"
        @click.self="cerrarModal"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">{{ store.esEdicion ? `Pesaje #${store.editandoId}` : 'Nuevo registro' }}</p>
              <h2 id="modal-pesaje-titulo" class="gg-section-title">
                {{ store.esEdicion ? 'Editar pesaje' : 'Registrar pesaje' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de pesaje"
              :disabled="store.guardando"
              @click="cerrarModal"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarFormulario">
            <div
              v-if="store.errorNegocio"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="pesaje-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocio }}</span>
            </div>

            <div
              v-if="store.errorGeneral"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="pesaje-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneral }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.errores.id_animal }">
              <label class="gg-field__label" for="pesaje-animal">Animal *</label>
              <select
                id="pesaje-animal"
                v-model="store.form.id_animal"
                class="gg-select"
                :disabled="store.guardando"
                :aria-invalid="Boolean(store.errores.id_animal)"
                :aria-describedby="store.errores.id_animal ? 'pesaje-animal-error' : undefined"
                required
              >
                <option value="">Selecciona un animal</option>
                <option v-for="a in store.animales" :key="a.id" :value="String(a.id)">
                  {{ a.arete }}{{ a.raza ? ` · ${a.raza}` : '' }}
                </option>
              </select>
              <p v-if="store.errores.id_animal" id="pesaje-animal-error" class="gg-field__error">
                {{ store.errores.id_animal }}
              </p>
            </div>

            <div class="gg-form-row">
              <div class="gg-field" :class="{ 'gg-field--error': store.errores.peso_kg }">
                <label class="gg-field__label" for="pesaje-peso">Peso (kg) *</label>
                <input
                  id="pesaje-peso"
                  v-model="store.form.peso_kg"
                  class="gg-input"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="9999.99"
                  step="0.01"
                  placeholder="Ej: 420.5"
                  :disabled="store.guardando"
                  :aria-invalid="Boolean(store.errores.peso_kg)"
                  :aria-describedby="store.errores.peso_kg ? 'pesaje-peso-error' : undefined"
                  required
                />
                <p v-if="store.errores.peso_kg" id="pesaje-peso-error" class="gg-field__error">
                  {{ store.errores.peso_kg }}
                </p>
              </div>

              <div class="gg-field" :class="{ 'gg-field--error': store.errores.fecha_pesaje }">
                <label class="gg-field__label" for="pesaje-fecha">Fecha de pesaje *</label>
                <input
                  id="pesaje-fecha"
                  v-model="store.form.fecha_pesaje"
                  class="gg-input"
                  type="date"
                  :disabled="store.guardando"
                  :aria-invalid="Boolean(store.errores.fecha_pesaje)"
                  :aria-describedby="store.errores.fecha_pesaje ? 'pesaje-fecha-error' : undefined"
                  required
                />
                <p v-if="store.errores.fecha_pesaje" id="pesaje-fecha-error" class="gg-field__error">
                  {{ store.errores.fecha_pesaje }}
                </p>
              </div>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.errores.observaciones }">
              <label class="gg-field__label" for="pesaje-observaciones">Observaciones (opcional)</label>
              <textarea
                id="pesaje-observaciones"
                v-model="store.form.observaciones"
                class="gg-textarea"
                rows="3"
                placeholder="Ej: Control mensual de engorde"
                :disabled="store.guardando"
                :aria-invalid="Boolean(store.errores.observaciones)"
                :aria-describedby="store.errores.observaciones ? 'pesaje-observaciones-error' : undefined"
              />
              <p v-if="store.errores.observaciones" id="pesaje-observaciones-error" class="gg-field__error">
                {{ store.errores.observaciones }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="store.guardando" data-testid="btn-guardar-pesaje">
                {{ store.guardando ? 'Guardando...' : store.esEdicion ? 'Guardar cambios' : 'Registrar pesaje' }}
              </button>
              <button type="button" class="gg-btn gg-btn--outline" :disabled="store.guardando" @click="cerrarModal">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
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
import { addOutline, alertCircleOutline, cloudOfflineOutline, downloadOutline, warningOutline } from 'ionicons/icons';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { mostrarToast, networkService, type PesajeAnimal } from '@/services';
import { OPCIONES_ORDEN_PESAJE, usePesajeStore } from '@/stores/pesaje';
import { exportarCsv, type ColumnaCsv } from '@/utils/csv';

const router = useRouter();
const store = usePesajeStore();

const modalAbierto = ref<boolean>(false);
let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  void store.cargarAnimales();
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
  void store.cargarAnimales();
  void store.recargar();
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function formatearPeso(valor: number): string {
  if (!Number.isFinite(valor)) return '—';
  return `${valor.toFixed(1)} kg`;
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function abrirCrear(): void {
  if (!store.puedeCrear) return;
  void store.cargarAnimales();
  store.prepararNuevo();
  modalAbierto.value = true;
}

function abrirEditar(pesaje: PesajeAnimal): void {
  if (!store.puedeEditar) return;
  void store.cargarAnimales();
  store.prepararEdicion(pesaje);
  modalAbierto.value = true;
}

function cerrarModal(): void {
  if (store.guardando) return;
  modalAbierto.value = false;
}

async function enviarFormulario(): Promise<void> {
  const eraEdicion = store.esEdicion;
  const guardado = await store.guardar();
  if (!guardado) {
    if (store.errorNegocio) {
      await mostrarToast(store.errorNegocio, 'warning', 5000);
    }
    return;
  }
  modalAbierto.value = false;
  await mostrarToast(
    eraEdicion ? 'Pesaje actualizado correctamente.' : 'Pesaje registrado correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminar(pesaje: PesajeAnimal): Promise<void> {
  if (!store.puedeEliminar) return;
  const arete = pesaje.animal?.numero_arete || `Animal #${pesaje.id_animal}`;
  const alerta = await alertController.create({
    header: 'Eliminar pesaje',
    message: `¿Seguro que deseas eliminar el pesaje de ${pesaje.peso_kg} kg del animal ${arete}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminar(pesaje.pesaje_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
  } else {
    await mostrarToast(resultado.mensaje, resultado.esReglaDeNegocio ? 'warning' : 'danger', 5000);
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

const COLUMNAS_CSV: ReadonlyArray<ColumnaCsv<PesajeAnimal>> = [
  { encabezado: 'Animal (Arete)', valor: (p) => p.animal?.numero_arete || `Animal #${p.id_animal}` },
  { encabezado: 'Peso (kg)', valor: (p) => (Number.isFinite(p.peso_kg) ? p.peso_kg : '') },
  { encabezado: 'Fecha de pesaje', valor: (p) => formatearFecha(p.fecha_pesaje) },
  { encabezado: 'Observaciones', valor: (p) => p.observaciones ?? '' },
];

async function exportarListado(): Promise<void> {
  if (!store.items.length) {
    await mostrarToast('No hay registros para exportar.', 'warning', 2500);
    return;
  }
  const { nombreArchivo, totalFilas } = exportarCsv('pesajes', COLUMNAS_CSV, store.items);
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 62rem) {
  .gg-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

.gg-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(40 54 24 / 48%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow-y: auto;
}

.gg-modal {
  width: 100%;
  max-width: 34rem;
  max-height: 90vh;
  overflow-y: auto;
}

.gg-modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gg-form-row {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
}
@media (min-width: 34rem) {
  .gg-form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
