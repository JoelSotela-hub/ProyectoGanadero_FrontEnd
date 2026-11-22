<template>
  <ion-page>
    <app-header :titulo="titulo" />
    <ion-content class="gg-content">
      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Próximamente</p>
            <h1 class="gg-title">{{ titulo }}</h1>
            <p class="gg-subtitle">{{ descripcion }}</p>
          </div>
        </header>
        <section class="gg-card gg-state" aria-live="polite">
          <ion-icon :icon="constructOutline" aria-hidden="true" />
          <h2>Este módulo se habilita en una próxima fase</h2>
          <p>Ya cuentas con acceso según tu rol; la vista completa llegará con el rediseño de {{ titulo }}.</p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import { constructOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';

const route = useRoute();
const titulo = computed<string>(() => String(route.meta.titulo ?? 'Módulo'));
const descripcion = computed<string>(() => String(route.meta.descripcion ?? ''));
</script>
