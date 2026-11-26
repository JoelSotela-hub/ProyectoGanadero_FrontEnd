<template>
  <ion-page>
    <app-header titulo="Panel de Control" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">{{ fecha }}</p>
            <h1 class="gg-title">Panel de Control</h1>
            <p class="gg-subtitle">
              Bienvenido{{ primerNombre ? `, ${primerNombre}` : '' }}. Este es el estado general de tu finca.
            </p>
          </div>

          <div class="gg-actions">
            <button
              type="button"
              class="gg-btn gg-btn--outline"
              :disabled="escaneando"
              data-testid="btn-escanear-qr-vaca"
              @click="escanearVaca"
            >
              <ion-icon :icon="qrCodeOutline" aria-hidden="true" />
              Escanear QR de vaca
            </button>
            <button v-if="esAdmin" type="button" class="gg-btn" @click="ir('/tabs/registro')">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Registrar Animal
            </button>
            <button v-if="puedeVer('rondas')" type="button" class="gg-btn gg-btn--outline" @click="ir('/tabs/rondas')">
              <ion-icon :icon="walkOutline" aria-hidden="true" />
              Rondas
            </button>
          </div>
        </header>

        <template v-if="store.cargando">
          <div class="gg-kpi-grid" aria-busy="true" aria-label="Cargando métricas">
            <div v-for="i in 3" :key="i" class="gg-kpi-card">
              <span class="gg-skeleton" style="width: 2.75rem; height: 2.75rem" />
              <div style="flex: 1">
                <span class="gg-skeleton" style="width: 60%" />
                <span class="gg-skeleton" style="width: 35%; height: 2rem; margin-top: 0.5rem" />
              </div>
            </div>
          </div>
        </template>

        <error-state
          v-else-if="store.error"
          title="No se pudieron cargar las métricas"
          :message="store.mensajeError"
          @retry="cargar"
        />

        <template v-else>
          <section aria-label="Resumen general">
            <div class="gg-kpi-grid">
              <component
                :is="kpi.ruta ? 'a' : 'div'"
                v-for="kpi in kpis"
                :key="kpi.clave"
                class="gg-kpi-card"
                :href="kpi.ruta"
                @click="kpi.ruta ? navegar($event, kpi.ruta) : undefined"
              >
                <span class="gg-kpi-card__icon" :class="kpi.clase" aria-hidden="true">
                  <ion-icon :icon="kpi.icono" />
                </span>
                <span>
                  <span class="gg-kpi-card__label">{{ kpi.etiqueta }}</span>
                  <span class="gg-kpi-card__value" style="display: block">{{ formatear(kpi.valor) }}</span>
                  <span class="gg-kpi-card__hint">{{ kpi.pista }}</span>
                </span>
              </component>
            </div>
          </section>

          <section aria-labelledby="dash-potreros">
            <div class="gg-section-head">
              <div>
                <p class="gg-eyebrow">Ocupación actual</p>
                <h2 id="dash-potreros" class="gg-section-title">Capacidad de potreros</h2>
              </div>
              <a class="gg-link" href="/tabs/potreros" @click="navegar($event, '/tabs/potreros')">Ver todos →</a>
            </div>

            <p v-if="!store.potreros.length" class="gg-card gg-subtitle">Aún no hay potreros registrados.</p>
            <div v-else class="gg-potrero-grid">
              <a
                v-for="potrero in store.potreros"
                :key="potrero.id"
                class="gg-card"
                href="/tabs/potreros"
                @click="navegar($event, '/tabs/potreros')"
              >
                <div class="gg-potrero__head">
                  <strong>{{ potrero.nombre }}</strong>
                  <span class="gg-badge" :class="estadoPotrero(potrero).clase">{{ estadoPotrero(potrero).texto }}</span>
                </div>
                <p class="gg-kpi-card__hint">{{ potrero.ocupados ?? '—' }} de {{ potrero.capacidad }} animales</p>
                <span
                  class="gg-progress-bar"
                  :class="estadoPotrero(potrero).barra"
                  role="progressbar"
                  :aria-label="`Ocupación de ${potrero.nombre}`"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="potrero.porcentaje"
                >
                  <span class="gg-progress-bar__fill" :style="{ width: `${potrero.porcentaje}%` }" />
                </span>
              </a>
            </div>
          </section>

          <section class="gg-card gg-card--flush" aria-labelledby="dash-actividad">
            <div class="gg-section-head" style="padding: 1.1rem 1.25rem 0">
              <div>
                <p class="gg-eyebrow">Actividad reciente</p>
                <h2 id="dash-actividad" class="gg-section-title">
                  {{ store.tipoActividad === 'pesajes' ? 'Últimos pesajes' : 'Últimos animales registrados' }}
                </h2>
              </div>
              <a class="gg-link" href="/tabs/animales" @click="navegar($event, '/tabs/animales')">Ver animales →</a>
            </div>

            <p v-if="!hayActividad" class="gg-subtitle" style="padding: 0 1.25rem 1.25rem">
              Todavía no hay actividad para mostrar.
            </p>

            <div v-else class="gg-table-wrapper">
              <table v-if="store.tipoActividad === 'pesajes'" class="gg-table">
                <caption class="gg-sr-only">
                  Últimos pesajes registrados
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Animal</th>
                    <th scope="col">Peso</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in store.pesajes" :key="p.id">
                    <td data-label="Animal">
                      <a :href="`/detalle/${p.idAnimal}`" @click="navegar($event, `/detalle/${p.idAnimal}`)">{{
                        p.arete
                      }}</a>
                    </td>
                    <td data-label="Peso">{{ p.pesoKg }} kg</td>
                    <td data-label="Fecha">{{ fechaCorta(p.fecha) }}</td>
                    <td data-label="Observaciones">{{ p.observaciones || '—' }}</td>
                  </tr>
                </tbody>
              </table>

              <table v-else class="gg-table">
                <caption class="gg-sr-only">
                  Últimos animales registrados
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Animal</th>
                    <th scope="col">Raza</th>
                    <th scope="col">Sexo</th>
                    <th scope="col">Potrero</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in store.animales" :key="a.id">
                    <td data-label="Animal">
                      <a :href="`/detalle/${a.id}`" @click="navegar($event, `/detalle/${a.id}`)">{{ a.arete }}</a>
                    </td>
                    <td data-label="Raza">{{ a.raza }}</td>
                    <td data-label="Sexo">{{ a.sexo }}</td>
                    <td data-label="Potrero">{{ a.potrero }}</td>
                    <td data-label="Estado">
                      <span class="gg-badge" :class="claseEstadoAnimal(a.estado)">{{ a.estado }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, onIonViewWillEnter } from '@ionic/vue';
import {
  addOutline,
  cubeOutline,
  leafOutline,
  medkitOutline,
  pawOutline,
  qrCodeOutline,
  scaleOutline,
  walkOutline,
} from 'ionicons/icons';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useEscanearVaca } from '@/composables/useEscanearVaca';
import { useRol } from '@/composables/useRol';
import type { PotreroCapacidad } from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';

const router = useRouter();
const authStore = useAuthStore();
const store = useDashboardStore();
const { esAdmin, esVeterinario, puedeVer } = useRol();
const { escaneando, escanearVaca } = useEscanearVaca();

const fecha = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
const primerNombre = computed<string>(() => authStore.user?.name?.trim().split(/\s+/)[0] ?? '');

const veTratamientosEInsumos = computed<boolean>(() => esAdmin.value || esVeterinario.value);

interface Kpi {
  clave: string;
  etiqueta: string;
  valor: number | null;
  pista: string;
  icono: string;
  clase: string;
  ruta?: string;
}

const kpis = computed<Kpi[]>(() => {
  const c = store.conteos;
  const lista: Kpi[] = [
    {
      clave: 'animales',
      etiqueta: 'Total de animales',
      valor: c.animales,
      pista: 'Registrados en el sistema',
      icono: pawOutline,
      clase: '',
      ruta: '/tabs/animales',
    },
    {
      clave: 'potreros',
      etiqueta: 'Potreros registrados',
      valor: c.potreros,
      pista: 'Áreas de pastoreo',
      icono: leafOutline,
      clase: 'gg-kpi-card__icon--earth',
      ruta: '/tabs/potreros',
    },
  ];
  if (veTratamientosEInsumos.value) {
    lista.push({
      clave: 'tratamientos',
      etiqueta: 'Tratamientos aplicados',
      valor: c.tratamientos,
      pista: 'Aplicaciones sanitarias',
      icono: medkitOutline,
      clase: 'gg-kpi-card__icon--rose',
      ruta: '/tabs/tratamientos',
    });
  }
  lista.push({
    clave: 'pesajes',
    etiqueta: 'Pesajes registrados',
    valor: c.pesajes,
    pista: 'Historial de peso del hato',
    icono: scaleOutline,
    clase: 'gg-kpi-card__icon--neutral',
    ruta: '/tabs/pesajes',
  });
  if (veTratamientosEInsumos.value) {
    lista.push({
      clave: 'insumos',
      etiqueta: 'Insumos registrados',
      valor: c.insumos,
      pista: 'Productos del inventario',
      icono: cubeOutline,
      clase: 'gg-kpi-card__icon--earth',
      ruta: '/tabs/insumos',
    });
  }
  return lista;
});

const hayActividad = computed<boolean>(() =>
  store.tipoActividad === 'pesajes' ? store.pesajes.length > 0 : store.animales.length > 0,
);

function formatear(valor: number | null): string {
  return valor === null ? '—' : valor.toLocaleString('es-GT');
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function estadoPotrero(potrero: PotreroCapacidad): { texto: string; clase: string; barra: string } {
  if (potrero.ocupados === null) return { texto: 'Sin datos', clase: 'gg-badge--neutral', barra: '' };
  if (potrero.capacidad <= 0) return { texto: 'Sin capacidad', clase: 'gg-badge--neutral', barra: '' };
  if (potrero.porcentaje >= 100)
    return { texto: 'Completo', clase: 'gg-badge--danger', barra: 'gg-progress-bar--danger' };
  if (potrero.porcentaje >= 80) return { texto: 'Alta', clase: 'gg-badge--warning', barra: 'gg-progress-bar--warning' };
  return { texto: 'Óptima', clase: 'gg-badge--success', barra: '' };
}

function claseEstadoAnimal(estado: string): string {
  if (estado === 'Activo') return 'gg-badge--success';
  if (estado === 'Enfermo') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

function ir(ruta: string): void {
  void router.push(ruta);
}

function navegar(evento: Event, ruta: string): void {
  evento.preventDefault();
  ir(ruta);
}

async function cargar(): Promise<void> {
  await store.cargar({ tratamientos: veTratamientosEInsumos.value, insumos: veTratamientosEInsumos.value });
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  await cargar();
  (evento.target as HTMLIonRefresherElement).complete();
}

onIonViewWillEnter(cargar);
</script>
<style scoped>
.gg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.gg-potrero-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}
@media (min-width: 48rem) {
  .gg-potrero-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 62rem) {
  .gg-potrero-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.gg-potrero__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.gg-potrero__head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gg-potrero-grid .gg-progress-bar {
  margin-top: 0.75rem;
}
</style>
