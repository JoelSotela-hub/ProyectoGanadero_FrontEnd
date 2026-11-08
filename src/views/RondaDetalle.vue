<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/rondas" text="Volver" />
        </ion-buttons>
        <ion-title>Ronda #{{ rondaId }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Estado de carga -->
      <div v-if="loading">
        <ion-card>
          <ion-card-header>
            <ion-skeleton-text :animated="true" style="width: 45%; height: 18px" />
            <ion-skeleton-text :animated="true" style="width: 75%; height: 26px" />
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text :animated="true" style="width: 90%" />
            <ion-skeleton-text :animated="true" style="width: 65%" />
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Estado de error con reintento -->
      <ErrorState v-else-if="error" title="No se pudo cargar la ronda" :message="errorMessage" @retry="cargar" />

      <!-- Estado vacío: ronda inexistente -->
      <EmptyState
        v-else-if="!ronda"
        title="Ronda no encontrada"
        :message="`No se encontró ninguna ronda con el identificador #${rondaId}.`"
      />

      <div v-else class="detail-container">
        <!-- Resumen -->
        <ion-card>
          <ion-card-header>
            <div class="header-row">
              <div>
                <ion-card-subtitle>Inicio: {{ formatearFecha(ronda.fecha_inicio) }}</ion-card-subtitle>
                <ion-card-title>{{ ronda.total_puntos }} potrero(s) visitado(s)</ion-card-title>
              </div>
              <ion-chip :color="ronda.estado === 'en_progreso' ? 'warning' : 'success'" outline>
                {{ ronda.estado === 'en_progreso' ? 'En progreso' : 'Completada' }}
              </ion-chip>
            </div>
          </ion-card-header>
          <ion-card-content>
            <!-- Auditoría del admin: quién hizo la ronda -->
            <p v-if="esAdmin && ronda.operador">
              <strong>Operario:</strong> {{ ronda.operador.name }}<br />
              <span class="muted">{{ ronda.operador.email }}</span>
            </p>
            <p v-if="ronda.fecha_fin"><strong>Finalizada:</strong> {{ formatearFecha(ronda.fecha_fin) }}</p>
            <p v-if="ronda.observaciones"><strong>Observaciones:</strong> {{ ronda.observaciones }}</p>

            <!-- Acciones: solo el operario dueño de una ronda en progreso -->
            <div v-if="puedeOperar" class="actions-block ion-margin-top">
              <ion-button expand="block" :disabled="procesando" @click="registrarPotrero">
                <ion-icon slot="start" :icon="qrCodeOutline" />
                Registrar Potrero
              </ion-button>
              <ion-button expand="block" fill="outline" color="success" :disabled="procesando" @click="finalizarRonda">
                <ion-icon slot="start" :icon="checkmarkDoneOutline" />
                Finalizar Ronda
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Puntos visitados -->
        <h2 class="section-title">Potreros visitados</h2>

        <EmptyState
          v-if="!puntos.length"
          title="Sin potreros registrados"
          :message="
            puedeOperar
              ? 'Escanea el QR de un potrero con «Registrar Potrero» para añadirlo a la ronda.'
              : 'Esta ronda no tiene potreros registrados.'
          "
        />

        <ion-card v-for="p in puntos" :key="p.id">
          <ion-card-header>
            <div class="header-row">
              <div>
                <ion-card-subtitle>{{ p.potrero?.codigo_qr ?? `Potrero #${p.potrero_id}` }}</ion-card-subtitle>
                <ion-card-title>{{ p.potrero?.nombre ?? `Potrero #${p.potrero_id}` }}</ion-card-title>
              </div>
              <ion-chip :color="colorEstado(p.estado_potrero)" outline>
                {{ ETIQUETA_ESTADO_POTRERO[p.estado_potrero] ?? p.estado_potrero }}
              </ion-chip>
            </div>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Hora:</strong> {{ formatearFecha(p.registrado_en) }}</p>
            <p>
              <strong>Coordenadas:</strong> {{ Number(p.latitud).toFixed(6) }}, {{ Number(p.longitud).toFixed(6) }}
            </p>
            <p v-if="p.observacion"><strong>Observación:</strong> {{ p.observacion }}</p>
            <!-- Sin Leaflet instalado: enlace al mapa para auditar el recorrido -->
            <ion-button size="small" fill="outline" :href="enlaceMapa(p)" target="_blank" rel="noopener">
              <ion-icon slot="start" :icon="locationOutline" />
              Ver en el mapa
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>

    <!-- Datos del punto antes de enviarlo (QR y GPS ya capturados) -->
    <ion-modal :is-open="modalAbierto" @didDismiss="cerrarModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Registrar Potrero</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="cerrarModal">Cancelar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list lines="full">
          <ion-item>
            <ion-label>
              <h3>Código QR del potrero</h3>
              <p>{{ nuevoPunto.codigo_qr }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <h3>Coordenadas GPS capturadas</h3>
              <p>{{ nuevoPunto.latitud.toFixed(6) }}, {{ nuevoPunto.longitud.toFixed(6) }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-select v-model="nuevoPunto.estado_potrero" label="Estado del potrero" interface="popover">
              <ion-select-option v-for="(texto, valor) in ETIQUETA_ESTADO_POTRERO" :key="valor" :value="valor">
                {{ texto }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-textarea
              v-model="nuevoPunto.observacion"
              label="Observación (opcional)"
              label-placement="stacked"
              :auto-grow="true"
              :maxlength="500"
            />
          </ion-item>
        </ion-list>
        <ion-button expand="block" class="ion-margin-top" :disabled="procesando" @click="guardarPunto">
          Guardar punto
        </ion-button>
      </ion-content>
    </ion-modal>

    <ion-loading :is-open="procesando" message="Procesando..." />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
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
  IonChip,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonLoading,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { checkmarkDoneOutline, locationOutline, qrCodeOutline } from 'ionicons/icons';

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
const { esAdmin, esOperario } = useRol();

const rondaId = computed<string>(() => String(route.params.id ?? ''));

const loading = ref(true);
const error = ref(false);
const errorMessage = ref('');
const procesando = ref(false);
const ronda = ref<Ronda | null>(null);

const modalAbierto = ref(false);
const nuevoPunto = reactive<Required<Omit<NuevoPuntoRonda, 'observacion'>> & { observacion: string }>({
  codigo_qr: '',
  latitud: 0,
  longitud: 0,
  estado_potrero: 'bueno',
  observacion: '',
});

const formatearFecha = formatearMarcaDeTiempo;

const puntos = computed<PuntoRonda[]>(() => ronda.value?.puntos ?? []);

/** Solo el operario puede registrar potreros y finalizar, y solo en rondas en progreso. */
const puedeOperar = computed<boolean>(() => esOperario.value && ronda.value?.estado === 'en_progreso');

function colorEstado(estado: EstadoPotrero): string {
  if (estado === 'bueno') return 'success';
  if (estado === 'regular') return 'warning';
  return 'danger';
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

/**
 * Registrar potrero: permisos de camara y GPS -> escanear QR -> capturar
 * coordenadas reales en ese instante -> elegir estado y observacion.
 */
async function registrarPotrero(): Promise<void> {
  if (procesando.value || !ronda.value) return;

  try {
    // Se validan ambos permisos antes de empezar, para no escanear y fallar despues.
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
    modalAbierto.value = true;
  } catch (err) {
    await mostrarError(err, 'No se pudo preparar el registro del potrero.');
  } finally {
    procesando.value = false;
  }
}

function cerrarModal(): void {
  modalAbierto.value = false;
}

async function guardarPunto(): Promise<void> {
  if (procesando.value || !ronda.value) return;
  procesando.value = true;

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
    // 409: ronda completada o potrero repetido -> `mensaje` del backend.
    // 404/422: QR inexistente o datos invalidos.
    await mostrarError(err, 'No se pudo registrar el potrero.');
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
    await mostrarError(err, 'No se pudo finalizar la ronda.');
  } finally {
    procesando.value = false;
  }
}

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
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
.section-title {
  font-size: 1.1rem;
  margin: 1.25rem 0 0.25rem;
}
.muted {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}
</style>

