<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard" href="/tabs/dashboard">
          <ion-icon aria-hidden="true" :icon="homeOutline" />
          <ion-label>Inicio</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="animales" href="/tabs/animales">
          <ion-icon aria-hidden="true" :icon="pawOutline" />
          <ion-label>Animales</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="registro" href="/tabs/registro">
          <ion-icon aria-hidden="true" :icon="addCircleOutline" />
          <ion-label>Registrar</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { addCircleOutline, homeOutline, pawOutline } from 'ionicons/icons';
</script>
