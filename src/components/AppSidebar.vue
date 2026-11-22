<template>
  <aside class="gg-sidebar" :class="{ 'gg-sidebar--compact': compacto }" aria-label="Barra lateral de GuateGanado">
    <div class="gg-sidebar__head">
      <div class="gg-sidebar__brand">
        <span class="gg-sidebar__logo" aria-hidden="true"><ion-icon :icon="pawOutline" /></span>
        <div v-if="!compacto" class="gg-sidebar__brand-text">
          <strong>GuateGanado</strong>
          <small>GESTIÓN GANADERA</small>
        </div>
      </div>

      <button
        v-if="esEscritorio"
        type="button"
        class="gg-sidebar__toggle"
        :aria-label="compacto ? 'Expandir menú lateral' : 'Minimizar menú lateral'"
        :aria-expanded="!compacto"
        aria-controls="gg-sidebar-nav"
        :title="compacto ? 'Expandir menú lateral' : 'Minimizar menú lateral'"
        @click="ui.alternarSidebar()"
      >
        <ion-icon :icon="compacto ? chevronForwardOutline : chevronBackOutline" aria-hidden="true" />
      </button>
    </div>

    <nav id="gg-sidebar-nav" class="gg-sidebar__nav" aria-label="Menú principal">
      <p v-if="!compacto" class="gg-sidebar__section">MENÚ PRINCIPAL</p>
      <ul class="gg-sidebar__list">
        <li v-for="modulo in modulosVisibles" :key="modulo.clave">
          <a
            :href="modulo.ruta"
            class="gg-sidebar__item"
            :class="{ 'gg-sidebar__item--active': estaActivo(modulo.clave) }"
            :aria-current="estaActivo(modulo.clave) ? 'page' : undefined"
            :title="compacto ? modulo.etiqueta : undefined"
            @click.prevent="ir(modulo.ruta)"
          >
            <ion-icon :icon="modulo.icono" aria-hidden="true" />
            <span :class="{ 'gg-sr-only': compacto }">{{ modulo.etiqueta }}</span>
          </a>
        </li>
      </ul>
    </nav>

    <div class="gg-sidebar__user">
      <button
        id="gg-user-btn"
        type="button"
        class="gg-sidebar__user-btn"
        :title="compacto ? `${nombre} · ${etiquetaRol}` : undefined"
        :aria-label="`Cuenta de ${nombre}, ${etiquetaRol}. Abrir perfil y cerrar sesión`"
        aria-haspopup="dialog"
      >
        <span class="gg-sidebar__avatar" aria-hidden="true">{{ iniciales }}</span>
        <span v-if="!compacto" class="gg-sidebar__user-text">
          <strong>{{ nombre }}</strong>
          <small>{{ etiquetaRol }}</small>
        </span>
      </button>

      <ion-popover trigger="gg-user-btn" trigger-action="click" side="top" alignment="start" :dismiss-on-select="false">
        <div class="gg-profile" role="dialog" aria-label="Perfil de usuario">
          <p class="gg-profile__name">{{ nombre }}</p>
          <p class="gg-profile__email">{{ authStore.user?.email || 'Sin correo' }}</p>
          <span class="gg-badge gg-badge--success">{{ etiquetaRol }}</span>
          <button type="button" class="gg-btn gg-btn--outline gg-btn--block gg-profile__logout" @click="cerrarSesion">
            <ion-icon :icon="logOutOutline" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </ion-popover>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { IonIcon, IonPopover, menuController, popoverController } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline, logOutOutline, pawOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useEscritorio } from '@/composables/useEscritorio';
import { useRol } from '@/composables/useRol';
import { ETIQUETA_ROL, type Rol } from '@/config/roles';
import { authService, cacheService, potreroService } from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const ui = useUiStore();
const { rol, modulosVisibles } = useRol();
const { esEscritorio } = useEscritorio();

/** El modo compacto (solo íconos) solo aplica en escritorio; en móvil el drawer siempre es completo. */
const compacto = computed<boolean>(() => esEscritorio.value && ui.sidebarColapsado);

const nombre = computed<string>(() => authStore.user?.name?.trim() || 'Usuario');
const etiquetaRol = computed<string>(() => ETIQUETA_ROL[rol.value as Rol] ?? 'Sin rol');
const iniciales = computed<string>(() => {
  const partes = nombre.value.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? 'U') + (partes[1]?.[0] ?? '')).toUpperCase();
});

/** Rutas que pertenecen a cada módulo (incluye detalles y formularios). */
const PREFIJOS: Record<string, string[]> = {
  dashboard: ['/tabs/dashboard', '/tabs/tab1'],
  animales: ['/tabs/animales', '/tabs/registro', '/detalle/', '/items'],
  potreros: ['/tabs/potreros', '/potreros/'],
  rondas: ['/tabs/rondas', '/rondas/'],
};

function estaActivo(clave: string): boolean {
  const prefijos = PREFIJOS[clave] ?? [`/tabs/${clave}`];
  return prefijos.some((prefijo) => route.path.startsWith(prefijo));
}

async function ir(ruta: string): Promise<void> {
  await menuController.close('gg-menu');
  if (route.path !== ruta) {
    await router.push(ruta);
  }
}

async function cerrarSesion(): Promise<void> {
  await popoverController.dismiss().catch(() => undefined);
  await menuController.close('gg-menu');
  await authService.logout();
  await cacheService.limpiar();
  await potreroService.limpiarCache();
  await authStore.logout();
  await router.replace('/login');
}
</script>

<style scoped>
.gg-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--gg-forest);
  color: var(--gg-on-forest);
  padding: calc(1.1rem + var(--ion-safe-area-top)) 0.9rem calc(1rem + var(--ion-safe-area-bottom))
    calc(0.9rem + var(--ion-safe-area-left));
  overflow: hidden;
}
.gg-sidebar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.25rem 1.25rem;
}
.gg-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.gg-sidebar__logo {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.7rem;
  background: var(--gg-on-forest);
  color: var(--gg-forest);
  font-size: 1.4rem;
}
.gg-sidebar__brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gg-sidebar__brand-text strong {
  font-size: 1rem;
}
.gg-sidebar__brand-text small {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: var(--gg-on-forest-muted);
}
.gg-sidebar__toggle {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  border: 1px solid var(--gg-on-forest-muted);
  background: transparent;
  color: var(--gg-on-forest);
  font-size: 1.1rem;
  cursor: pointer;
}
.gg-sidebar__toggle:hover {
  background: rgb(247 245 232 / 12%);
}
.gg-sidebar__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.gg-sidebar__section {
  margin: 0 0 0.6rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--gg-on-forest-muted);
}
.gg-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gg-sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.75rem;
  color: var(--gg-on-forest);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
}
.gg-sidebar__item ion-icon {
  flex: 0 0 auto;
  font-size: 1.25rem;
}
.gg-sidebar__item:hover {
  background: rgb(247 245 232 / 10%);
}
.gg-sidebar__item--active,
.gg-sidebar__item--active:hover {
  background: var(--gg-olive-pill);
  color: var(--gg-on-forest);
}
.gg-sidebar--compact .gg-sidebar__item,
.gg-sidebar--compact .gg-sidebar__user-btn {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
.gg-sidebar--compact .gg-sidebar__head {
  flex-direction: column;
  padding-bottom: 1rem;
}
.gg-sidebar__user {
  padding-top: 0.9rem;
  border-top: 1px solid rgb(247 245 232 / 18%);
}
.gg-sidebar__user-btn {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.4rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--gg-on-forest);
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.gg-sidebar__user-btn:hover {
  background: rgb(247 245 232 / 10%);
}
.gg-sidebar__avatar {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--gg-success-bg);
  color: var(--gg-forest);
  font-size: 0.85rem;
  font-weight: 700;
}
.gg-sidebar__user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gg-sidebar__user-text strong,
.gg-sidebar__user-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gg-sidebar__user-text strong {
  font-size: 0.88rem;
}
.gg-sidebar__user-text small {
  font-size: 0.72rem;
  color: var(--gg-on-forest-muted);
}
.gg-profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 1rem;
  background: var(--gg-surface);
  color: var(--gg-ink);
}
.gg-profile__name {
  margin: 0;
  font-weight: 700;
}
.gg-profile__email {
  margin: 0 0 0.3rem;
  font-size: 0.85rem;
  color: var(--gg-ink-muted);
  overflow-wrap: anywhere;
}
.gg-profile__logout {
  margin-top: 0.6rem;
}
</style>
