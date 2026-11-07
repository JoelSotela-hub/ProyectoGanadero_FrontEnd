<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/animales" text="Volver" />
        </ion-buttons>
        <ion-title>{{ isEditMode ? `Editar Animal #${editingId}` : 'Registrar Animal' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="form-container">
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Operación Ganadera</ion-card-subtitle>
            <ion-card-title>
              {{ isEditMode ? 'Actualizar Ficha del Animal' : 'Nuevo Registro de Animal' }}
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="full">
              <ion-item>
                <ion-input
                  v-model="form.arete"
                  label="Número de Arete *"
                  label-placement="floating"
                  placeholder="Ej: GT-0006"
                  :disabled="submitting"
                />
              </ion-item>

              <ion-item>
                <ion-input
                  v-model="form.nombre"
                  label="Nombre del Animal *"
                  label-placement="floating"
                  placeholder="Ej: Relámpago"
                  :disabled="submitting"
                />
              </ion-item>

              <ion-item>
                <ion-select
                  v-model="form.raza"
                  label="Raza *"
                  label-placement="floating"
                  interface="popover"
                  :disabled="submitting"
                >
                  <ion-select-option value="Brahman">Brahman</ion-select-option>
                  <ion-select-option value="Simmental">Simmental</ion-select-option>
                  <ion-select-option value="Angus">Angus</ion-select-option>
                  <ion-select-option value="Gyr Lechero">Gyr Lechero</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select
                  v-model="form.sexo"
                  label="Sexo *"
                  label-placement="floating"
                  interface="popover"
                  :disabled="submitting"
                >
                  <ion-select-option value="Hembra">Hembra</ion-select-option>
                  <ion-select-option value="Macho">Macho</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select
                  v-model="form.potrero"
                  label="Potrero *"
                  label-placement="floating"
                  interface="popover"
                  :disabled="submitting"
                >
                  <ion-select-option value="Norte">Norte</ion-select-option>
                  <ion-select-option value="El Río">El Río</ion-select-option>
                  <ion-select-option value="La Laguna">La Laguna</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-input
                  v-model="form.peso"
                  type="number"
                  label="Peso (kg) *"
                  label-placement="floating"
                  placeholder="Ej: 430"
                  :disabled="submitting"
                />
              </ion-item>

              <ion-item>
                <ion-select
                  v-model="form.estado"
                  label="Estado *"
                  label-placement="floating"
                  interface="popover"
                  :disabled="submitting"
                >
                  <ion-select-option value="Activo">Activo</ion-select-option>
                  <ion-select-option value="Tratamiento">En Tratamiento</ion-select-option>
                  <ion-select-option value="Vendido">Vendido</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item lines="none">
                <ion-textarea
                  v-model="form.observaciones"
                  label="Observaciones"
                  label-placement="floating"
                  placeholder="Notas adicionales sobre salud, alimentación o trazabilidad..."
                  :rows="3"
                  :disabled="submitting"
                />
              </ion-item>
            </ion-list>

            <div class="form-actions ion-margin-top">
              <ion-button
                expand="block"
                :disabled="submitting || !isFormValid"
                @click="onSubmit"
              >
                <ion-icon slot="start" :icon="saveOutline" />
                {{ submitting ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Registrar Animal' }}
              </ion-button>

              <ion-button
                expand="block"
                fill="outline"
                color="medium"
                :disabled="submitting"
                @click="onCancel"
              >
                Cancelar
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

      <ion-loading :is-open="submitting" message="Guardando registro..." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonButton,
  IonIcon,
  IonLoading,
  toastController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { saveOutline } from 'ionicons/icons';

const route = useRoute();
const router = useRouter();

const submitting = ref(false);

const editingId = computed(() => {
  const idFromParam = route.params.id;
  const idFromQuery = route.query.id;
  return idFromParam ?? idFromQuery ?? null;
});

const isEditMode = computed(() => Boolean(editingId.value));

const form = reactive({
  arete: '',
  nombre: '',
  raza: 'Brahman',
  sexo: 'Hembra',
  potrero: 'Norte',
  peso: '420',
  estado: 'Activo',
  observaciones: '',
});

const isFormValid = computed(() => {
  return (
    form.arete.trim().length > 0 &&
    form.nombre.trim().length > 0 &&
    form.raza.trim().length > 0 &&
    form.sexo.trim().length > 0 &&
    form.potrero.trim().length > 0 &&
    Number(form.peso) > 0
  );
});

onIonViewWillEnter(() => {
  if (isEditMode.value) {
    form.arete = `GT-000${editingId.value}`;
    form.nombre = editingId.value === '1' ? 'Lucero' : 'Animal Registrado';
    form.observaciones = 'Registro cargado para edición.';
  } else {
    form.arete = '';
    form.nombre = '';
    form.raza = 'Brahman';
    form.sexo = 'Hembra';
    form.potrero = 'Norte';
    form.peso = '';
    form.estado = 'Activo';
    form.observaciones = '';
  }
});

async function onSubmit() {
  if (!isFormValid.value) return;
  submitting.value = true;

  try {
    // Persona 3 conectará aquí la operación de escritura (POST / PUT) contra la API
    await new Promise((resolve) => setTimeout(resolve, 600));

    const toast = await toastController.create({
      message: isEditMode.value
        ? 'Animal actualizado correctamente'
        : 'Animal registrado correctamente',
      duration: 1800,
      color: 'success',
    });
    await toast.present();

    router.replace('/tabs/animales');
  } finally {
    submitting.value = false;
  }
}

function onCancel() {
  router.back();
}
</script>

<style scoped>
.form-container {
  max-width: 640px;
  margin: 0 auto;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
