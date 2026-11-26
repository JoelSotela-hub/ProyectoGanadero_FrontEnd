<template>
  <ion-page>
    <button type="button" class="gg-skip-link" @click="irAlContenido">Saltar al contenido principal</button>

    <ion-split-pane content-id="gg-main" when="lg" class="gg-split" :style="anchoSidebar">
      <ion-menu content-id="gg-main" menu-id="gg-menu" type="overlay" class="gg-menu">
        <app-sidebar />
      </ion-menu>

      <div id="gg-main" class="ion-page">
        <ion-tabs>
          <ion-router-outlet />
          <ion-tab-bar slot="bottom" class="gg-tabbar" aria-label="Accesos principales">
            <ion-tab-button v-for="modulo in tabsVisibles" :key="modulo.clave" :tab="modulo.clave" :href="modulo.ruta">
              <ion-icon aria-hidden="true" :icon="modulo.icono" />
              <ion-label>{{ modulo.etiqueta }}</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="menu" aria-label="Abrir menú completo" @click.prevent="abrirMenu">
              <ion-icon aria-hidden="true" :icon="menuOutline" />
              <ion-label>Menú</ion-label>
            </ion-tab-button>
          </ion-tab-bar>
        </ion-tabs>
      </div>
    </ion-split-pane>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonIcon,
  IonLabel,
  IonMenu,
  IonPage,
  IonRouterOutlet,
  IonSplitPane,
  IonTabBar,
  IonTabButton,
  IonTabs,
  menuController,
} from '@ionic/vue';
import { menuOutline } from 'ionicons/icons';
import { computed, onMounted } from 'vue';

import AppSidebar from '@/components/AppSidebar.vue';
import { useRol } from '@/composables/useRol';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { modulosVisibles } = useRol();

const tabsVisibles = computed(() => modulosVisibles.value.filter((modulo) => modulo.enTabs));

const anchoSidebar = computed(() => {
  const ancho = ui.sidebarColapsado ? 'var(--gg-sidebar-width-compact)' : 'var(--gg-sidebar-width)';
  return { '--side-width': ancho, '--side-min-width': ancho, '--side-max-width': ancho };
});

onMounted(() => {
  void ui.cargarPreferencias();
});

async function abrirMenu(): Promise<void> {
  await menuController.open('gg-menu');
}

function irAlContenido(): void {
  const titulo = document.querySelector<HTMLElement>('#gg-main .ion-page:not(.ion-page-hidden) h1');
  if (titulo) {
    titulo.tabIndex = -1;
    titulo.focus();
  }
}
</script>
<style>
ion-menu.gg-menu {
  --background: var(--gg-forest);
  --width: min(19rem, 85vw);
  --max-width: 85vw;
}

ion-split-pane.gg-split {
  --border: 0;
}

ion-tab-bar.gg-tabbar {
  padding-bottom: var(--ion-safe-area-bottom);
  border-top: 1px solid var(--gg-border);
}
ion-tab-button {
  min-height: 3.25rem;
  --color: var(--gg-ink-muted);
  --color-selected: var(--gg-forest);
}
ion-tab-button ion-label {
  font-size: 0.7rem;
  font-weight: 600;
}
@media (min-width: 62rem) {
  ion-tab-bar.gg-tabbar {
    display: none;
  }
}
</style>
