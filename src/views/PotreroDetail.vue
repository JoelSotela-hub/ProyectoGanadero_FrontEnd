<template>
  <ion-page>
    <app-header :titulo="tituloHeader" atras="/tabs/potreros">
      <ion-button
        v-if="esAdmin && store.detalle"
        aria-label="Editar potrero"
        data-testid="header-btn-editar-potrero"
        @click="abrirEditar"
      >
        <ion-icon slot="icon-only" :icon="createOutline" />
      </ion-button>
    </app-header>

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <a
          class="gg-link gg-back"
          href="/tabs/potreros"
          data-testid="link-volver-potreros"
          @click.prevent="volverAListado"
        >
          ← Volver a potreros
        </a>

        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">
              Detalle del potrero{{
                store.detalle ? ` · ID #${store.detalle.potrero_id}` : potreroId ? ` · ID #${potreroId}` : ''
              }}
            </p>
            <h1 class="gg-title">{{ store.detalle ? store.detalle.nombre : 'Detalle del Potrero' }}</h1>
            <p class="gg-subtitle">
              {{
                store.detalle
                  ? `${store.detalle.hectareas_de_extension} ha · Capacidad máxima ${store.detalle.capacidad_maxima} animales`
                  : 'Consulta la ficha técnica, ocupación real y animales asignados al potrero.'
              }}
            </p>
          </div>

          <div v-if="store.detalle" class="gg-actions">
            <span
              class="gg-badge"
              :class="claseEstadoPasto(store.detalle.estado_pasto)"
              data-testid="badge-estado-pasto"
            >
              {{ store.detalle.estado_pasto || 'Sin especificar' }}
            </span>
            <button
              v-if="esAdmin"
              type="button"
              class="gg-btn"
              data-testid="btn-editar-potrero-detalle"
              @click="abrirEditar"
            >
              <ion-icon :icon="createOutline" aria-hidden="true" />
              Editar
            </button>
            <button
              v-if="esAdmin"
              type="button"
              class="gg-btn gg-btn--outline gg-btn--danger"
              :disabled="store.eliminandoId === store.detalle.potrero_id"
              data-testid="btn-eliminar-potrero-detalle"
              @click="confirmarEliminar"
            >
              <ion-icon :icon="trashOutline" aria-hidden="true" />
              Eliminar
            </button>
          </div>
        </header>

        <!-- Aviso de datos en caché offline -->
        <div
          v-if="store.mostrandoAvisoOfflineDetalle"
          class="gg-alert gg-alert--warning"
          role="status"
          aria-live="polite"
          data-testid="offline-detail-banner"
        >
          <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
          <span>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ store.detalleUltimaActualizacionTexto }})
          </span>
        </div>

        <!-- Estado 1: Cargando -->
        <section
          v-if="store.cargandoDetalle"
          class="gg-card"
          aria-busy="true"
          aria-label="Cargando detalle del potrero"
        >
          <span class="gg-skeleton" style="width: 35%; height: 1.1rem; margin-bottom: 0.75rem" />
          <span class="gg-skeleton" style="width: 60%; height: 1.8rem; margin-bottom: 1.25rem" />
          <div class="gg-tech-dl">
            <span v-for="i in 4" :key="i" class="gg-skeleton" style="height: 3.4rem" />
          </div>
        </section>

        <!-- Estado 2: Error con reintento -->
        <error-state
          v-else-if="store.errorDetalle"
          title="No se pudo cargar el potrero"
          :message="store.mensajeErrorDetalle"
          @retry="recargarTodo"
        />

        <!-- Estado 3: Vacío / 404 -->
        <section v-else-if="!store.detalle" class="gg-card">
          <empty-state
            title="Potrero no encontrado"
            :message="`No se encontró ningún potrero con el identificador #${potreroId}.`"
          >
            <button type="button" class="gg-btn gg-btn--outline" @click="volverAListado">Volver a potreros</button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos -->
        <template v-else>
          <div class="gg-summary-layout">
            <div class="gg-main-col">
              <!-- Ficha técnica -->
              <section class="gg-card" aria-labelledby="sec-ficha-potrero">
                <div class="gg-section-head">
                  <div>
                    <p class="gg-eyebrow">Información general</p>
                    <h2 id="sec-ficha-potrero" class="gg-section-title">Datos del potrero</h2>
                  </div>
                </div>

                <dl class="gg-tech-dl">
                  <div class="gg-tech-item">
                    <dt>Nombre</dt>
                    <dd data-testid="dato-nombre">{{ store.detalle.nombre }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Extensión</dt>
                    <dd data-testid="dato-hectareas">{{ store.detalle.hectareas_de_extension }} ha</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Capacidad máxima</dt>
                    <dd data-testid="dato-capacidad">{{ store.detalle.capacidad_maxima }} animales</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Estado del pasto</dt>
                    <dd data-testid="dato-estado-pasto">
                      <span class="gg-badge" :class="claseEstadoPasto(store.detalle.estado_pasto)">
                        {{ store.detalle.estado_pasto || 'Sin especificar' }}
                      </span>
                    </dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Código QR</dt>
                    <dd class="gg-mono" data-testid="dato-codigo-qr">{{ store.detalle.codigo_qr || '—' }}</dd>
                  </div>
                </dl>
              </section>

              <!-- Ocupación real (meta.total / capacidad_maxima) -->
              <section class="gg-card" aria-labelledby="sec-ocupacion-potrero" data-testid="card-ocupacion">
                <div class="gg-section-head">
                  <div>
                    <p class="gg-eyebrow">Carga animal actual</p>
                    <h2 id="sec-ocupacion-potrero" class="gg-section-title">Ocupación del potrero</h2>
                  </div>
                  <span
                    class="gg-badge"
                    :class="
                      store.ocupacion.nivel === 'danger'
                        ? 'gg-badge--danger'
                        : store.ocupacion.nivel === 'warning'
                          ? 'gg-badge--warning'
                          : 'gg-badge--success'
                    "
                    data-testid="badge-ocupacion-porcentaje"
                  >
                    {{ store.ocupacion.porcentajeReal }}% ocupado
                  </span>
                </div>

                <div class="gg-occupancy-stats">
                  <p class="gg-occupancy-count" data-testid="ocupacion-texto">
                    <strong>{{ store.ocupacion.ocupados }}</strong> de
                    <strong>{{ store.ocupacion.capacidad }}</strong> animales asignados
                  </p>
                  <p class="gg-occupancy-hint">
                    {{
                      store.ocupacion.disponibles > 0
                        ? `${store.ocupacion.disponibles} ${store.ocupacion.disponibles === 1 ? 'espacio disponible' : 'espacios disponibles'}`
                        : 'Capacidad máxima alcanzada'
                    }}
                  </p>
                </div>

                <div
                  class="gg-progress-bar"
                  :class="{
                    'gg-progress-bar--warning': store.ocupacion.nivel === 'warning',
                    'gg-progress-bar--danger': store.ocupacion.nivel === 'danger',
                  }"
                  role="progressbar"
                  aria-label="Porcentaje de ocupación del potrero"
                  :aria-valuenow="store.ocupacion.porcentajeBarra"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  data-testid="barra-ocupacion"
                >
                  <span class="gg-progress-bar__fill" :style="{ width: `${store.ocupacion.porcentajeBarra}%` }" />
                </div>
              </section>
            </div>

            <!-- Tarjeta QR visual + botón copiar -->
            <aside v-if="store.detalle.codigo_qr" class="gg-card gg-qr-card" aria-labelledby="sec-qr-potrero">
              <p class="gg-eyebrow">Escaneo en rondas</p>
              <h2 id="sec-qr-potrero" class="gg-section-title">Código QR del potrero</h2>
              <div class="gg-qr-box" data-testid="qr-potrero-visual">
                <qrcode-vue :value="store.detalle.codigo_qr" :size="176" level="H" render-as="svg" />
              </div>
              <p class="gg-qr-text">{{ store.detalle.codigo_qr }}</p>
              <button
                type="button"
                class="gg-btn gg-btn--outline gg-btn--block"
                data-testid="btn-copiar-qr"
                @click="copiarCodigoQr"
              >
                <ion-icon :icon="copyOutline" aria-hidden="true" />
                Copiar código QR
              </button>
            </aside>
          </div>

          <!-- Listado paginado de animales asignados -->
          <section aria-labelledby="sec-animales-potrero">
            <div class="gg-section-head">
              <div>
                <p class="gg-eyebrow">Hato asignado</p>
                <h2 id="sec-animales-potrero" class="gg-section-title">Animales en este potrero</h2>
              </div>
              <span v-if="store.animalesMeta" class="gg-badge gg-badge--neutral">
                {{ store.animalesMeta.total }} {{ store.animalesMeta.total === 1 ? 'animal' : 'animales' }}
              </span>
            </div>

            <!-- Estado 1: Cargando animales -->
            <section
              v-if="store.cargandoAnimales"
              class="gg-card gg-card--flush"
              aria-busy="true"
              aria-label="Cargando animales del potrero"
            >
              <div v-for="i in 3" :key="i" class="gg-skeleton-row">
                <span class="gg-skeleton" style="width: 24%" />
                <span class="gg-skeleton" style="width: 22%" />
                <span class="gg-skeleton" style="width: 20%" />
              </div>
            </section>

            <!-- Estado 2: Error animales -->
            <error-state
              v-else-if="store.errorAnimales"
              title="No se pudieron cargar los animales del potrero"
              :message="store.mensajeErrorAnimales"
              @retry="store.cargarAnimalesPotrero(potreroId)"
            />

            <!-- Estado 3: Vacío -->
            <section v-else-if="!store.animalesPotrero.length" class="gg-card">
              <empty-state
                title="Sin animales asignados"
                message="Actualmente no hay animales ubicados en este potrero."
              />
            </section>

            <!-- Estado 4: Datos -->
            <section v-else class="gg-card gg-card--flush" aria-label="Tabla de animales en el potrero">
              <div class="gg-table-wrapper">
                <table class="gg-table" data-testid="tabla-animales-potrero">
                  <caption class="gg-sr-only">
                    Animales asignados al potrero
                    {{
                      store.detalle.nombre
                    }}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Arete</th>
                      <th scope="col">Raza</th>
                      <th scope="col">Sexo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in store.animalesPotrero" :key="a.id">
                      <td data-label="Arete">
                        <a
                          :href="`/detalle/${a.id}`"
                          :data-testid="`link-animal-${a.id}`"
                          @click.prevent="router.push(`/detalle/${a.id}`)"
                        >
                          {{ a.arete }}
                        </a>
                      </td>
                      <td data-label="Raza">{{ a.raza }}</td>
                      <td data-label="Sexo">{{ a.sexo }}</td>
                      <td data-label="Estado">
                        <span class="gg-badge" :class="claseEstadoAnimal(a.estado)">{{ a.estado }}</span>
                      </td>
                      <td data-label="Acción">
                        <a :href="`/detalle/${a.id}`" @click.prevent="router.push(`/detalle/${a.id}`)">Ver ficha</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="store.hayMasAnimales" class="gg-pagination-footer">
                <button
                  type="button"
                  class="gg-btn gg-btn--outline"
                  :disabled="store.cargandoMasAnimales"
                  data-testid="btn-cargar-mas-animales"
                  @click="store.cargarMasAnimalesPotrero(potreroId)"
                >
                  {{ store.cargandoMasAnimales ? 'Cargando...' : 'Cargar más animales' }}
                </button>
              </div>
            </section>
          </section>
        </template>
      </div>

      <potrero-form-modal :open="modalAbierto" @close="modalAbierto = false" @saved="alGuardarPotrero" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
  useBackButton,
} from '@ionic/vue';
import { cloudOfflineOutline, copyOutline, createOutline, trashOutline } from 'ionicons/icons';
import QrcodeVue from 'qrcode.vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PotreroFormModal from '@/components/PotreroFormModal.vue';
import { useRol } from '@/composables/useRol';
import { mostrarToast, networkService } from '@/services';
import { usePotreroStore } from '@/stores/potrero';

const route = useRoute();
const router = useRouter();
const store = usePotreroStore();
const { esAdmin } = useRol();

const potreroId = computed<string>(() => String(route.params.id ?? ''));
const tituloHeader = computed<string>(() => store.detalle?.nombre ?? 'Detalle del Potrero');
const modalAbierto = ref<boolean>(false);

let cancelarSuscripcionRed: (() => void) | null = null;

function claseEstadoPasto(estado: string | null): string {
  if (estado === 'Excelente') return 'gg-badge--success';
  if (estado === 'Regular') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

function claseEstadoAnimal(estado: string): string {
  if (estado === 'Activo') return 'gg-badge--success';
  if (estado === 'Tratamiento') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

async function recargarTodo(): Promise<void> {
  if (!potreroId.value) return;
  await Promise.all([store.cargarDetalle(potreroId.value), store.cargarAnimalesPotrero(potreroId.value, 1, false)]);
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  await recargarTodo();
  (evento.target as HTMLIonRefresherElement).complete();
}

function abrirEditar(): void {
  if (!esAdmin.value || !store.detalle) return;
  store.prepararEdicion(store.detalle);
  modalAbierto.value = true;
}

function alGuardarPotrero(): void {
  modalAbierto.value = false;
}

async function confirmarEliminar(): Promise<void> {
  if (!esAdmin.value || !store.detalle) return;
  const potrero = store.detalle;
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
    await router.replace('/tabs/potreros');
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

async function copiarCodigoQr(): Promise<void> {
  const codigo = store.detalle?.codigo_qr;
  if (!codigo) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(codigo);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = codigo;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    await mostrarToast(`Código QR "${codigo}" copiado al portapapeles.`, 'success', 2500);
  } catch {
    await mostrarToast('No se pudo copiar el código QR.', 'danger', 3500);
  }
}

function volverAListado(): void {
  if (modalAbierto.value) {
    modalAbierto.value = false;
    return;
  }
  void router.push('/tabs/potreros');
}

useBackButton(20, () => {
  volverAListado();
});

onIonViewWillEnter(() => {
  void recargarTodo();
});

onMounted(() => {
  void recargarTodo();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void recargarTodo();
    } else {
      store.marcarDetalleSinConexion();
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});
</script>

<style scoped>
.gg-back {
  align-self: flex-start;
}

.gg-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.gg-btn--danger {
  color: var(--gg-danger-fg);
  border-color: var(--gg-danger-fg);
}
.gg-btn--danger:hover {
  background: var(--gg-danger-bg);
}

.gg-summary-layout {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: 1fr;
  align-items: start;
}
@media (min-width: 56rem) {
  .gg-summary-layout {
    grid-template-columns: minmax(0, 1fr) 18.5rem;
  }
}

.gg-main-col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.gg-tech-dl {
  margin: 0;
  display: grid;
  gap: 0.85rem;
  grid-template-columns: 1fr;
}
@media (min-width: 36rem) {
  .gg-tech-dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-tech-item {
  padding: 0.75rem 0.9rem;
  background: var(--gg-canvas-alt);
  border: 1px solid var(--gg-border);
  border-radius: var(--gg-radius);
}

.gg-tech-item dt {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gg-ink-muted);
  margin-bottom: 0.25rem;
}

.gg-tech-item dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gg-ink);
  word-break: break-word;
}

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.gg-occupancy-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.gg-occupancy-count {
  margin: 0;
  font-size: 0.95rem;
  color: var(--gg-ink);
}

.gg-occupancy-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--gg-ink-muted);
}

.gg-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.65rem;
}

.gg-qr-box {
  margin-top: 0.35rem;
  background: #ffffff;
  padding: 0.85rem;
  border-radius: var(--gg-radius);
  border: 1px solid var(--gg-border);
  display: inline-flex;
}

.gg-qr-text {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gg-ink);
  word-break: break-all;
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

.gg-pagination-footer {
  padding: 0.9rem 1.25rem;
  border-top: 1px solid var(--gg-border);
  display: flex;
  justify-content: center;
}
</style>
