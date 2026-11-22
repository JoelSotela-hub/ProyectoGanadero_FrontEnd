<template>
  <ion-page>
    <app-header titulo="Usuarios" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Seguridad y accesos</p>
            <h1 class="gg-title">Usuarios</h1>
            <p class="gg-subtitle">
              Administra las cuentas del personal de la finca y asigna permisos por rol (Administrador, Veterinario u
              Operario).
            </p>
          </div>
          <div class="gg-actions">
            <button type="button" class="gg-btn" data-testid="btn-nuevo-usuario" @click="abrirModal">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nuevo usuario
            </button>
          </div>
        </header>

        <!-- Filtros de búsqueda y rol -->
        <form class="gg-card gg-filters" role="search" aria-label="Filtros de usuarios" @submit.prevent>
          <div class="gg-field gg-filters__search">
            <label class="gg-field__label" for="usr-buscar">Buscar por nombre o correo</label>
            <div class="gg-field__control">
              <input
                id="usr-buscar"
                v-model="store.busqueda"
                class="gg-input gg-input--icon"
                type="search"
                placeholder="Ej: María López o correo@guateganado.com"
                autocomplete="off"
                data-testid="input-buscar-usuario"
              />
              <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
            </div>
          </div>

          <div class="gg-field">
            <label class="gg-field__label" for="usr-filtro-rol">Filtrar por rol</label>
            <select id="usr-filtro-rol" v-model="store.filtroRol" class="gg-select" data-testid="select-filtro-rol">
              <option value="">Todos los roles</option>
              <option v-for="r in ROLES" :key="r" :value="r">{{ ETIQUETA_ROL[r] }}</option>
            </select>
          </div>

          <div v-if="store.hayFiltrosActivos" class="gg-filters__clear">
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              data-testid="btn-limpiar-filtros-usuarios"
              @click="store.limpiarFiltros()"
            >
              Limpiar filtros
            </button>
          </div>
        </form>

        <!-- Estado 1: Cargando -->
        <section v-if="store.cargando" class="gg-card gg-card--flush" aria-busy="true" aria-label="Cargando usuarios">
          <div v-for="i in 4" :key="i" class="gg-skeleton-row">
            <span class="gg-skeleton" style="width: 28%" />
            <span class="gg-skeleton" style="width: 34%" />
            <span class="gg-skeleton" style="width: 18%" />
            <span class="gg-skeleton" style="width: 16%" />
          </div>
        </section>

        <!-- Estado 2: Error -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el listado de usuarios"
          :message="store.error"
          @retry="store.cargarUsuarios()"
        />

        <!-- Estado 3: Vacío -->
        <section v-else-if="!store.usuariosFiltrados.length" class="gg-card">
          <empty-state
            :title="store.hayFiltrosActivos ? 'Sin resultados' : 'Sin usuarios registrados'"
            :message="
              store.hayFiltrosActivos
                ? 'No hay usuarios que coincidan con la búsqueda o el rol seleccionado.'
                : 'Aún no hay usuarios registrados en el sistema.'
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
            <button v-else type="button" class="gg-btn" @click="abrirModal">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Registrar primer usuario
            </button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos -->
        <section v-else class="gg-card gg-card--flush" aria-label="Listado de usuarios">
          <p class="gg-count" role="status">
            {{ store.usuariosFiltrados.length }}
            {{ store.usuariosFiltrados.length === 1 ? 'usuario' : 'usuarios' }}
          </p>
          <div class="gg-table-wrapper">
            <table class="gg-table" data-testid="tabla-usuarios">
              <caption class="gg-sr-only">
                Listado de usuarios registrados en el sistema
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Fecha de registro</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in store.usuariosFiltrados" :key="u.id" :data-testid="`fila-usuario-${u.id}`">
                  <td data-label="Nombre">
                    <strong>{{ u.name }}</strong>
                  </td>
                  <td data-label="Correo">
                    <span class="gg-mono">{{ u.email }}</span>
                  </td>
                  <td data-label="Rol">
                    <span class="gg-badge" :class="claseBadgeRol(u.role)">
                      {{ etiquetaRol(u.role) }}
                    </span>
                  </td>
                  <td data-label="Fecha de registro">
                    <span>{{ formatearFecha(u.created_at) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <usuario-form-modal :abierto="modalAbierto" @cerrar="cerrarModal" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, onIonViewWillEnter } from '@ionic/vue';
import { addOutline, searchOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import UsuarioFormModal from '@/components/UsuarioFormModal.vue';
import { ETIQUETA_ROL, ROLES, type Rol } from '@/config/roles';
import { useUsuariosStore } from '@/stores/usuarios';

const store = useUsuariosStore();
const modalAbierto = ref<boolean>(false);

onMounted(() => {
  void store.cargarUsuarios();
});

onIonViewWillEnter(() => {
  void store.cargarUsuarios();
});

function abrirModal(): void {
  store.limpiarErrores();
  modalAbierto.value = true;
}

function cerrarModal(): void {
  modalAbierto.value = false;
}

function etiquetaRol(rol?: string): string {
  const normalizado = (rol ?? '').toLowerCase() as Rol;
  return ETIQUETA_ROL[normalizado] ?? (rol || 'Sin rol');
}

function claseBadgeRol(rol?: string): string {
  const normalizado = (rol ?? '').toLowerCase();
  if (normalizado === 'admin') return 'gg-badge--success';
  if (normalizado === 'veterinario') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

function formatearFecha(iso?: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const anio = fecha.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  await store.cargarUsuarios();
  (evento.target as HTMLIonRefresherElement).complete();
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
@media (min-width: 48rem) {
  .gg-filters {
    grid-template-columns: 2fr 1fr auto;
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
  font-size: 0.85rem;
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
