<template>
  <ion-page>
    <app-header titulo="Insumos" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Inventario y suministros</p>
            <h1 class="gg-title">Insumos</h1>
            <p class="gg-subtitle">
              Consulta y administra el catálogo de insumos agrícolas, nutricionales y sanitarios de la finca.
            </p>
          </div>
          <div v-if="store.puedeGestionar" class="gg-actions">
            <button type="button" class="gg-btn" data-testid="btn-crear-insumo" @click="abrirCrear">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nuevo insumo
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

        <!-- Filtros reales conectados a GET /api/v1/insumos -->
        <form class="gg-card gg-filters" role="search" aria-label="Filtros de insumos" @submit.prevent>
          <div class="gg-field gg-filters__search">
            <label class="gg-field__label" for="ins-buscar">Buscar por nombre</label>
            <div class="gg-field__control">
              <input
                id="ins-buscar"
                class="gg-input gg-input--icon"
                type="search"
                placeholder="Ej: Sal Mineral 25kg"
                autocomplete="off"
                :value="store.filtros.buscar"
                @input="store.buscar(($event.target as HTMLInputElement).value)"
              />
              <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
            </div>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="ins-categoria">Categoría</label>
            <select
              id="ins-categoria"
              class="gg-select"
              :value="store.filtros.categoria_id"
              @change="store.establecerCategoria(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todas las categorías</option>
              <option v-for="c in store.categorias" :key="c.categoria_id" :value="String(c.categoria_id)">
                {{ c.nombre }}{{ c.tipo ? ` (${c.tipo})` : '' }}
              </option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="ins-unidad">Unidad de medida</label>
            <select
              id="ins-unidad"
              class="gg-select"
              :value="store.filtros.unidad_medida_id"
              @change="store.establecerUnidadMedida(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todas las unidades</option>
              <option v-for="u in store.unidadesMedida" :key="u.unidad_medida_id" :value="String(u.unidad_medida_id)">
                {{ u.nombre }}{{ u.apertura ? ` (${u.apertura})` : '' }}
              </option>
            </select>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="ins-precio-min">Precio mín. (Q)</label>
            <input
              id="ins-precio-min"
              class="gg-input"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="Ej: 50"
              :value="store.filtros.precio_min"
              @input="store.establecerPrecioMin(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="ins-precio-max">Precio máx. (Q)</label>
            <input
              id="ins-precio-max"
              class="gg-input"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="Ej: 500"
              :value="store.filtros.precio_max"
              @input="store.establecerPrecioMax(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="ins-orden">Ordenar por</label>
            <select
              id="ins-orden"
              class="gg-select"
              :value="store.claveOrden"
              @change="store.establecerOrden(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in OPCIONES_ORDEN_INSUMO" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
            </select>
          </div>

          <div v-if="store.hayFiltrosActivos" class="gg-filters__clear">
            <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltros()">Limpiar filtros</button>
          </div>
        </form>

        <!-- Estado 1: Cargando -->
        <section v-if="store.loading" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando insumos">
          <div v-for="i in 5" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 28%" />
            <span class="gg-skeleton" style="width: 22%" />
            <span class="gg-skeleton" style="width: 20%" />
            <span class="gg-skeleton" style="width: 16%" />
          </div>
        </section>

        <!-- Estado 2: Error con reintento -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el listado de insumos"
          :message="store.mensajeError"
          @retry="store.recargar()"
        />

        <!-- Estado 3: Vacío -->
        <section v-else-if="!store.items.length" class="gg-card">
          <empty-state
            :title="store.hayFiltrosActivos ? 'Sin resultados' : 'Sin insumos registrados'"
            :message="
              store.hayFiltrosActivos
                ? 'No hay insumos que coincidan con los filtros aplicados.'
                : 'Aún no hay insumos registrados en el inventario de la finca.'
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
            <button v-else-if="store.puedeGestionar" type="button" class="gg-btn" @click="abrirCrear">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Crear primer insumo
            </button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos -->
        <section v-else class="gg-card gg-card--flush" aria-label="Listado de insumos">
          <p class="gg-count" role="status">{{ store.total }} {{ store.total === 1 ? 'insumo' : 'insumos' }}</p>
          <div class="gg-table-wrapper">
            <table class="gg-table" data-testid="tabla-insumos">
              <caption class="gg-sr-only">
                Listado de insumos registrados
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Unidad de medida</th>
                  <th scope="col">Precio</th>
                  <th v-if="store.puedeGestionar" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ins in store.items" :key="ins.insumo_id">
                  <td data-label="Nombre">
                    <strong>{{ ins.nombre }}</strong>
                  </td>
                  <td data-label="Categoría">
                    <span class="gg-badge gg-badge--success">
                      {{ obtenerNombreCategoria(ins) }}
                    </span>
                    <span v-if="obtenerTipoCategoria(ins)" class="gg-badge gg-badge--neutral gg-ml-sm">
                      {{ obtenerTipoCategoria(ins) }}
                    </span>
                  </td>
                  <td data-label="Unidad de medida">
                    <span>{{ obtenerNombreUnidad(ins) }}</span>
                    <span v-if="obtenerAperturaUnidad(ins)" class="gg-badge gg-badge--neutral gg-mono gg-ml-sm">
                      {{ obtenerAperturaUnidad(ins) }}
                    </span>
                  </td>
                  <td data-label="Precio">
                    <span class="gg-price">{{ formatearPrecio(ins.precio) }}</span>
                  </td>
                  <td v-if="store.puedeGestionar" data-label="Acciones">
                    <div class="gg-row-actions">
                      <button
                        type="button"
                        class="gg-action-link"
                        :aria-label="`Editar insumo ${ins.nombre}`"
                        :data-testid="`btn-editar-insumo-${ins.insumo_id}`"
                        @click="abrirEditar(ins)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="gg-action-link gg-action-link--danger"
                        :aria-label="`Eliminar insumo ${ins.nombre}`"
                        :disabled="store.eliminandoId === ins.insumo_id"
                        :data-testid="`btn-eliminar-insumo-${ins.insumo_id}`"
                        @click="confirmarEliminar(ins)"
                      >
                        {{ store.eliminandoId === ins.insumo_id ? 'Eliminando...' : 'Eliminar' }}
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

      <!-- Modal Crear / Editar Insumo (solo admin) -->
      <div
        v-if="modalAbierto && store.puedeGestionar"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-insumo-titulo"
        data-testid="modal-insumo-form"
        @click.self="cerrarModal"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicion ? `Insumo #${store.editandoId}` : 'Inventario de la finca' }}
              </p>
              <h2 id="modal-insumo-titulo" class="gg-section-title">
                {{ store.esEdicion ? 'Editar insumo' : 'Nuevo insumo' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de insumo"
              :disabled="store.guardando"
              @click="cerrarModal"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarFormulario">
            <!-- Aviso si aún no existen Categorías o Unidades de Medida (Sección 7.5 del contrato) -->
            <div
              v-if="!store.categorias.length || !store.unidadesMedida.length"
              class="gg-alert gg-alert--warning"
              role="status"
              data-testid="aviso-catalogos-vacios"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <div>
                <strong>Requisito previo:</strong> Para registrar un insumo necesitas al menos una categoría y una
                unidad de medida registradas.
                <a class="gg-link gg-ml-sm" href="/tabs/catalogos" @click.prevent="irACatalogos"> Ir a Catálogos → </a>
              </div>
            </div>

            <div
              v-if="store.errorNegocio"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="insumo-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocio }}</span>
            </div>

            <div
              v-if="store.errorGeneral"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="insumo-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneral }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.errores.nombre }">
              <label class="gg-field__label" for="ins-form-nombre">Nombre del insumo *</label>
              <input
                id="ins-form-nombre"
                v-model="store.form.nombre"
                class="gg-input"
                type="text"
                maxlength="150"
                placeholder="Ej: Sal Mineral 25kg"
                autocomplete="off"
                :disabled="store.guardando"
                :aria-invalid="Boolean(store.errores.nombre)"
                :aria-describedby="store.errores.nombre ? 'ins-form-nombre-error' : undefined"
                required
              />
              <p v-if="store.errores.nombre" id="ins-form-nombre-error" class="gg-field__error">
                {{ store.errores.nombre }}
              </p>
            </div>

            <div class="gg-form-row">
              <div class="gg-field" :class="{ 'gg-field--error': store.errores.categoria_id }">
                <label class="gg-field__label" for="ins-form-categoria">Categoría *</label>
                <select
                  id="ins-form-categoria"
                  v-model="store.form.categoria_id"
                  class="gg-select"
                  :disabled="store.guardando"
                  :aria-invalid="Boolean(store.errores.categoria_id)"
                  :aria-describedby="store.errores.categoria_id ? 'ins-form-categoria-error' : undefined"
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  <option v-for="c in store.categorias" :key="c.categoria_id" :value="String(c.categoria_id)">
                    {{ c.nombre }}{{ c.tipo ? ` (${c.tipo})` : '' }}
                  </option>
                </select>
                <p v-if="store.errores.categoria_id" id="ins-form-categoria-error" class="gg-field__error">
                  {{ store.errores.categoria_id }}
                </p>
              </div>

              <div class="gg-field" :class="{ 'gg-field--error': store.errores.unidad_medida_id }">
                <label class="gg-field__label" for="ins-form-unidad">Unidad de medida *</label>
                <select
                  id="ins-form-unidad"
                  v-model="store.form.unidad_medida_id"
                  class="gg-select"
                  :disabled="store.guardando"
                  :aria-invalid="Boolean(store.errores.unidad_medida_id)"
                  :aria-describedby="store.errores.unidad_medida_id ? 'ins-form-unidad-error' : undefined"
                  required
                >
                  <option value="">Selecciona una unidad</option>
                  <option
                    v-for="u in store.unidadesMedida"
                    :key="u.unidad_medida_id"
                    :value="String(u.unidad_medida_id)"
                  >
                    {{ u.nombre }}{{ u.apertura ? ` (${u.apertura})` : '' }}
                  </option>
                </select>
                <p v-if="store.errores.unidad_medida_id" id="ins-form-unidad-error" class="gg-field__error">
                  {{ store.errores.unidad_medida_id }}
                </p>
              </div>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.errores.precio }">
              <label class="gg-field__label" for="ins-form-precio">Precio unitario (Q) *</label>
              <input
                id="ins-form-precio"
                v-model="store.form.precio"
                class="gg-input"
                type="number"
                inputmode="decimal"
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="Ej: 185.50"
                :disabled="store.guardando"
                :aria-invalid="Boolean(store.errores.precio)"
                :aria-describedby="store.errores.precio ? 'ins-form-precio-error' : undefined"
                required
              />
              <p v-if="store.errores.precio" id="ins-form-precio-error" class="gg-field__error">
                {{ store.errores.precio }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="store.guardando" data-testid="btn-guardar-insumo">
                {{ store.guardando ? 'Guardando...' : store.esEdicion ? 'Guardar cambios' : 'Crear insumo' }}
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
import { addOutline, alertCircleOutline, cloudOfflineOutline, searchOutline, warningOutline } from 'ionicons/icons';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { mostrarToast, networkService, type Insumo } from '@/services';
import { OPCIONES_ORDEN_INSUMO, useInsumoStore } from '@/stores/insumo';

const router = useRouter();
const store = useInsumoStore();

const modalAbierto = ref<boolean>(false);
let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  void store.cargarSelectores();
  void store.recargar();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void store.cargarSelectores(true);
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
  void store.cargarSelectores();
  void store.recargar();
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function formatearPrecio(precio: number): string {
  if (!Number.isFinite(precio)) return '—';
  return `Q ${precio.toFixed(2)}`;
}

function obtenerNombreCategoria(ins: Insumo): string {
  if (ins.categoria?.nombre) return ins.categoria.nombre;
  const encontrada = store.categorias.find((c) => c.categoria_id === ins.categoria_id);
  return encontrada?.nombre ?? `Categoría #${ins.categoria_id}`;
}

function obtenerTipoCategoria(ins: Insumo): string | null {
  if (ins.categoria?.tipo) return ins.categoria.tipo;
  const encontrada = store.categorias.find((c) => c.categoria_id === ins.categoria_id);
  return encontrada?.tipo ?? null;
}

function obtenerNombreUnidad(ins: Insumo): string {
  if (ins.unidad_medida?.nombre) return ins.unidad_medida.nombre;
  const encontrada = store.unidadesMedida.find((u) => u.unidad_medida_id === ins.unidad_medida_id);
  return encontrada?.nombre ?? `Unidad #${ins.unidad_medida_id}`;
}

function obtenerAperturaUnidad(ins: Insumo): string | null {
  if (ins.unidad_medida?.apertura) return ins.unidad_medida.apertura;
  const encontrada = store.unidadesMedida.find((u) => u.unidad_medida_id === ins.unidad_medida_id);
  return encontrada?.apertura ?? null;
}

function abrirCrear(): void {
  if (!store.puedeGestionar) return;
  void store.cargarSelectores();
  store.prepararNuevo();
  modalAbierto.value = true;
}

function abrirEditar(insumo: Insumo): void {
  if (!store.puedeGestionar) return;
  void store.cargarSelectores();
  store.prepararEdicion(insumo);
  modalAbierto.value = true;
}

function cerrarModal(): void {
  if (store.guardando) return;
  modalAbierto.value = false;
}

async function irACatalogos(): Promise<void> {
  modalAbierto.value = false;
  await router.push('/tabs/catalogos');
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
    eraEdicion ? 'Insumo actualizado correctamente.' : 'Insumo creado correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminar(insumo: Insumo): Promise<void> {
  if (!store.puedeGestionar) return;
  const alerta = await alertController.create({
    header: 'Eliminar insumo',
    message: `¿Seguro que deseas eliminar "${insumo.nombre}" del inventario? Esta acción no se puede deshacer.`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminar(insumo.insumo_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio',
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
  await Promise.all([store.cargarSelectores(true), store.recargar()]);
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

.gg-ml-sm {
  margin-left: 0.4rem;
}

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
}

.gg-price {
  font-weight: 700;
  color: var(--gg-ink);
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
