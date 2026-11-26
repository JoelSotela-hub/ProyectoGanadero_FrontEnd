<template>
  <ion-page>
    <app-header :titulo="`Ronda #${rondaId}`" atras="/tabs/rondas" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Detalle de inspección</p>
            <h1 class="gg-title">Ronda #{{ rondaId }}</h1>
            <p class="gg-subtitle">
              {{
                ronda
                  ? `Iniciada el ${formatearFecha(ronda.fecha_inicio)} · ${ronda.total_puntos} potrero(s) visitado(s)`
                  : 'Consulta los potreros inspeccionados, coordenadas GPS y estado del recorrido.'
              }}
            </p>
          </div>
          <div class="gg-actions">
            <button type="button" class="gg-btn gg-btn--outline" @click="router.push('/tabs/rondas')">
              <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
              Volver a rondas
            </button>
          </div>
        </header>

        <section v-if="loading" class="gg-card" aria-busy="true" aria-label="Cargando ronda">
          <div class="gg-skeleton-stack">
            <span class="gg-skeleton" style="width: 40%; height: 1.1rem" />
            <span class="gg-skeleton" style="width: 70%; height: 1.5rem" />
            <span class="gg-skeleton" style="width: 90%" />
            <span class="gg-skeleton" style="width: 60%" />
          </div>
        </section>

        <error-state v-else-if="error" title="No se pudo cargar la ronda" :message="errorMessage" @retry="cargar" />

        <section v-else-if="!ronda" class="gg-card">
          <empty-state
            title="Ronda no encontrada"
            :message="`No se encontró ninguna ronda con el identificador #${rondaId}.`"
          />
        </section>

        <template v-else>
          <section class="gg-card" aria-label="Resumen de la ronda">
            <div class="gg-section-head">
              <div>
                <p class="gg-eyebrow">Inicio: {{ formatearFecha(ronda.fecha_inicio) }}</p>
                <h2 class="gg-section-title">{{ ronda.total_puntos }} potrero(s) visitado(s)</h2>
              </div>
              <span
                class="gg-badge"
                :class="ronda.estado === 'en_progreso' ? 'gg-badge--warning' : 'gg-badge--success'"
              >
                {{ ronda.estado === 'en_progreso' ? 'En progreso' : 'Completada' }}
              </span>
            </div>

            <dl class="gg-meta-grid">
              <div v-if="esAdmin && ronda.operador">
                <dt>Operario</dt>
                <dd>
                  <strong>{{ ronda.operador.name }}</strong>
                  <span class="gg-muted"> ({{ ronda.operador.email }})</span>
                </dd>
              </div>
              <div v-if="ronda.fecha_fin">
                <dt>Finalizada</dt>
                <dd>{{ formatearFecha(ronda.fecha_fin) }}</dd>
              </div>
              <div v-if="ronda.observaciones">
                <dt>Observaciones</dt>
                <dd>{{ ronda.observaciones }}</dd>
              </div>
            </dl>

            <div v-if="puedeOperar" class="gg-actions gg-actions--spaced">
              <button
                type="button"
                class="gg-btn"
                :disabled="procesando"
                data-testid="btn-registrar-potrero"
                @click="registrarPotrero"
              >
                <ion-icon :icon="qrCodeOutline" aria-hidden="true" />
                Registrar potrero
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="procesando"
                data-testid="btn-finalizar-ronda"
                @click="finalizarRonda"
              >
                <ion-icon :icon="checkmarkDoneOutline" aria-hidden="true" />
                Finalizar ronda
              </button>
            </div>
          </section>

          <section aria-label="Potreros visitados">
            <div class="gg-section-head">
              <h2 class="gg-section-title">Potreros visitados</h2>
            </div>

            <section v-if="!puntos.length" class="gg-card">
              <empty-state
                title="Sin potreros registrados"
                :message="
                  puedeOperar
                    ? 'Escanea el QR de un potrero con «Registrar potrero» para añadirlo a la ronda.'
                    : 'Esta ronda no tiene potreros registrados.'
                "
              />
            </section>

            <div v-else class="gg-points-grid">
              <article v-for="p in puntos" :key="p.id" class="gg-card gg-point-card">
                <div class="gg-section-head">
                  <div>
                    <p class="gg-eyebrow">{{ p.potrero?.codigo_qr ?? `Potrero #${p.potrero_id}` }}</p>
                    <h3 class="gg-point-title">{{ p.potrero?.nombre ?? `Potrero #${p.potrero_id}` }}</h3>
                  </div>
                  <span class="gg-badge" :class="claseEstadoPotrero(p.estado_potrero)">
                    {{ ETIQUETA_ESTADO_POTRERO[p.estado_potrero] ?? p.estado_potrero }}
                  </span>
                </div>

                <dl class="gg-meta-grid">
                  <div>
                    <dt>Hora</dt>
                    <dd>{{ formatearFecha(p.registrado_en) }}</dd>
                  </div>
                  <div>
                    <dt>Coordenadas</dt>
                    <dd class="gg-mono">{{ Number(p.latitud).toFixed(6) }}, {{ Number(p.longitud).toFixed(6) }}</dd>
                  </div>
                  <div v-if="p.observacion">
                    <dt>Observación</dt>
                    <dd>{{ p.observacion }}</dd>
                  </div>
                </dl>

                <div v-if="p.potrero?.codigo_qr" class="gg-qr-block">
                  <div class="gg-qr-box">
                    <qrcode-vue :value="p.potrero.codigo_qr" :size="112" level="H" render-as="svg" />
                  </div>
                  <span class="gg-mono">{{ p.potrero.codigo_qr }}</span>
                </div>

                <div class="gg-point-footer">
                  <a class="gg-btn gg-btn--outline" :href="enlaceMapa(p)" target="_blank" rel="noopener">
                    <ion-icon :icon="locationOutline" aria-hidden="true" />
                    Ver en el mapa
                  </a>
                </div>
              </article>
            </div>
          </section>
        </template>
      </div>

      <div
        v-if="modalAbierto"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-punto-titulo"
        data-testid="modal-punto-ronda"
        @click.self="cerrarModal"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">Punto de inspección</p>
              <h2 id="modal-punto-titulo" class="gg-section-title">Registrar potrero</h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de punto"
              :disabled="procesando"
              @click="cerrarModal"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="guardarPunto">
            <div v-if="errorPunto409" class="gg-alert gg-alert--warning" role="alert" data-testid="punto-error-409">
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ errorPunto409 }}</span>
            </div>

            <div class="gg-meta-grid">
              <div>
                <dt>Código QR del potrero</dt>
                <dd class="gg-mono">{{ nuevoPunto.codigo_qr }}</dd>
              </div>
              <div>
                <dt>Coordenadas GPS</dt>
                <dd class="gg-mono">{{ nuevoPunto.latitud.toFixed(6) }}, {{ nuevoPunto.longitud.toFixed(6) }}</dd>
              </div>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="punto-estado">Estado del potrero *</label>
              <select
                id="punto-estado"
                v-model="nuevoPunto.estado_potrero"
                class="gg-select"
                :disabled="procesando"
                required
              >
                <option v-for="(texto, valor) in ETIQUETA_ESTADO_POTRERO" :key="valor" :value="valor">
                  {{ texto }}
                </option>
              </select>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="punto-observacion">Observación (opcional)</label>
              <textarea
                id="punto-observacion"
                v-model="nuevoPunto.observacion"
                class="gg-textarea"
                rows="3"
                maxlength="500"
                placeholder="Ej: Cerca en buen estado y bebedero limpio"
                :disabled="procesando"
              />
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="procesando" data-testid="btn-guardar-punto">
                {{ procesando ? 'Guardando...' : 'Guardar punto' }}
              </button>
              <button type="button" class="gg-btn gg-btn--outline" :disabled="procesando" @click="cerrarModal">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </ion-content>

    <ion-loading :is-open="procesando" message="Procesando..." />
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonContent,
  IonIcon,
  IonLoading,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue';
import { arrowBackOutline, checkmarkDoneOutline, locationOutline, qrCodeOutline, warningOutline } from 'ionicons/icons';
import QrcodeVue from 'qrcode.vue';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useRol } from '@/composables/useRol';
import {
  ETIQUETA_ESTADO_POTRERO,
  type EstadoPotrero,
  type NuevoPuntoRonda,
  type PuntoRonda,
  type Ronda,
} from '@/models/ronda.model';
import {
  ApiError,
  asegurarPermiso,
  escanearQr,
  formatearMarcaDeTiempo,
  mensajeDeError,
  mostrarError,
  mostrarToast,
  networkService,
  obtenerCoordenadas,
  rondaService,
} from '@/services';

const route = useRoute();
const router = useRouter();
const { esAdmin, esOperario } = useRol();

const rondaId = computed<string>(() => String(route.params.id ?? ''));

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const errorMessage = ref<string>('');
const procesando = ref<boolean>(false);
const ronda = ref<Ronda | null>(null);
const errorPunto409 = ref<string>('');

const modalAbierto = ref<boolean>(false);
const nuevoPunto = reactive<Required<Omit<NuevoPuntoRonda, 'observacion'>> & { observacion: string }>({
  codigo_qr: '',
  latitud: 0,
  longitud: 0,
  estado_potrero: 'bueno',
  observacion: '',
});

const formatearFecha = formatearMarcaDeTiempo;

const puntos = computed<PuntoRonda[]>(() => ronda.value?.puntos ?? []);

const puedeOperar = computed<boolean>(() => esOperario.value && ronda.value?.estado === 'en_progreso');

function claseEstadoPotrero(estado: EstadoPotrero): string {
  if (estado === 'bueno') return 'gg-badge--success';
  if (estado === 'regular') return 'gg-badge--warning';
  return 'gg-badge--danger';
}

function enlaceMapa(punto: PuntoRonda): string {
  return `https://www.google.com/maps?q=${Number(punto.latitud)},${Number(punto.longitud)}`;
}

async function cargar(): Promise<void> {
  loading.value = true;
  error.value = false;
  errorMessage.value = '';

  try {
    ronda.value = await rondaService.obtener(rondaId.value);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      ronda.value = null;
    } else {
      error.value = true;
      errorMessage.value = mensajeDeError(err, 'Error al consultar la ronda.');
    }
  } finally {
    loading.value = false;
  }
}

async function onRefresh(e: CustomEvent): Promise<void> {
  await cargar();
  (e.target as HTMLIonRefresherElement).complete();
}

async function registrarPotrero(): Promise<void> {
  if (procesando.value || !ronda.value) return;

  try {
    if (!(await asegurarPermiso('camara'))) return;
    if (!(await asegurarPermiso('ubicacion'))) return;

    const codigo = await escanearQr('Escanear QR del potrero', 'POTRERO-NORTE');
    if (!codigo) return;

    procesando.value = true;
    const coordenadas = await obtenerCoordenadas();
    procesando.value = false;
    if (!coordenadas) return;

    nuevoPunto.codigo_qr = codigo;
    nuevoPunto.latitud = coordenadas.latitud;
    nuevoPunto.longitud = coordenadas.longitud;
    nuevoPunto.estado_potrero = 'bueno';
    nuevoPunto.observacion = '';
    errorPunto409.value = '';
    modalAbierto.value = true;
  } catch (err) {
    await mostrarError(err, 'No se pudo preparar el registro del potrero.');
  } finally {
    procesando.value = false;
  }
}

function cerrarModal(): void {
  if (procesando.value) return;
  modalAbierto.value = false;
  errorPunto409.value = '';
}

async function guardarPunto(): Promise<void> {
  if (procesando.value || !ronda.value) return;
  procesando.value = true;
  errorPunto409.value = '';

  try {
    await rondaService.registrarPunto(ronda.value.id, {
      codigo_qr: nuevoPunto.codigo_qr,
      latitud: nuevoPunto.latitud,
      longitud: nuevoPunto.longitud,
      estado_potrero: nuevoPunto.estado_potrero,
      observacion: nuevoPunto.observacion.trim() || undefined,
    });
    modalAbierto.value = false;
    await mostrarToast('Potrero registrado en la ronda.', 'success');
    await cargar();
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      errorPunto409.value = err.message;
      const alerta = await alertController.create({
        header: 'No se pudo registrar el punto',
        subHeader: 'Regla de negocio',
        message: err.message,
        buttons: ['Entendido'],
      });
      await alerta.present();
      await mostrarToast(err.message, 'warning', 5000);
      if (err.message.toLowerCase().includes('completada')) {
        modalAbierto.value = false;
        await cargar();
      }
    } else {
      await mostrarError(err, 'No se pudo registrar el potrero.');
    }
  } finally {
    procesando.value = false;
  }
}

async function finalizarRonda(): Promise<void> {
  if (procesando.value || !ronda.value) return;

  const alerta = await alertController.create({
    header: 'Finalizar ronda',
    message: 'Se cerrará la ronda y ya no podrás añadir más potreros.',
    inputs: [{ name: 'observaciones', type: 'textarea', placeholder: 'Observaciones (opcional)' }],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Finalizar', role: 'confirm' },
    ],
  });
  await alerta.present();
  const { data, role } = await alerta.onDidDismiss<{ values?: { observaciones?: string } }>();
  if (role !== 'confirm') return;

  procesando.value = true;
  try {
    await rondaService.finalizar(ronda.value.id, data?.values?.observaciones?.trim() || undefined);
    await mostrarToast('Ronda finalizada.', 'success');
    await cargar();
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const alertaConflicto = await alertController.create({
        header: 'Ronda ya finalizada',
        subHeader: 'Regla de negocio',
        message: err.message,
        buttons: ['Entendido'],
      });
      await alertaConflicto.present();
      await mostrarToast(err.message, 'warning', 5000);
      await cargar();
    } else {
      await mostrarError(err, 'No se pudo finalizar la ronda.');
    }
  } finally {
    procesando.value = false;
  }
}

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  void cargar();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado && !modalAbierto.value) void cargar();
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});

onIonViewWillEnter(() => {
  void cargar();
});
</script>
<style scoped>
.gg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.gg-actions--spaced {
  margin-top: 1.25rem;
}

.gg-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gg-meta-grid {
  display: grid;
  gap: 0.75rem 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  margin: 0;
}

.gg-meta-grid dt {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gg-ink-muted);
  margin-bottom: 0.2rem;
}

.gg-meta-grid dd {
  margin: 0;
  color: var(--gg-ink);
  font-size: 0.92rem;
}

.gg-muted {
  color: var(--gg-ink-muted);
  font-size: 0.85rem;
}

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.84rem;
}

.gg-points-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}
@media (min-width: 48rem) {
  .gg-points-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-point-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.gg-point-title {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--gg-ink);
}

.gg-qr-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.75rem;
  border-radius: var(--gg-radius);
  background: var(--gg-canvas-alt);
}

.gg-qr-box {
  background: #ffffff;
  padding: 0.5rem;
  border-radius: 0.5rem;
  display: inline-flex;
  border: 1px solid var(--gg-border);
}

.gg-point-footer {
  margin-top: auto;
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

.gg-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
