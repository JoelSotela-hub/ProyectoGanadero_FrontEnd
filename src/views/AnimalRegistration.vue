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
                  v-model="form.codigo_qr"
                  label="Código QR (opcional)"
                  label-placement="floating"
                  :placeholder="form.arete.trim() ? `Se autogenera: VACA-${form.arete.trim()}` : 'Ej: VACA-001'"
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
                  <ion-select-option v-for="r in razas" :key="r.id" :value="String(r.id)">
                    {{ r.nombre }}
                  </ion-select-option>
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
                  <ion-select-option v-for="p in potreros" :key="p.id" :value="String(p.id)">
                    {{ p.nombre }}
                  </ion-select-option>
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
              <ion-button expand="block" :disabled="submitting || !isFormValid" @click="onSubmit">
                <ion-icon slot="start" :icon="saveOutline" />
                {{ submitting ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Registrar Animal' }}
              </ion-button>

              <ion-button expand="block" fill="outline" color="medium" :disabled="submitting" @click="onCancel">
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

import { ApiError, animalService, catalogoService, type OpcionCatalogo } from '@/services';

const route = useRoute();
const router = useRouter();

const submitting = ref(false);

const editingId = computed(() => {
  const idFromParam = route.params.id;
  const idFromQuery = route.query.id;
  return idFromParam ?? idFromQuery ?? null;
});

const isEditMode = computed(() => Boolean(editingId.value));

/** Catalogos reales: la API exige raza_id y potrero_id, no texto libre. */
const razas = ref<OpcionCatalogo[]>([]);
const potreros = ref<OpcionCatalogo[]>([]);

const form = reactive({
  arete: '',
  codigo_qr: '',
  nombre: '',
  raza: '',
  sexo: 'Hembra',
  potrero: '',
  peso: '',
  estado: 'Activo',
  observaciones: '',
});

/**
 * Campos obligatorios segun StoreAnimalRequest del backend:
 * numero_arete, raza_id, potrero_id y sexo. El nombre y el peso no existen
 * como columnas del animal: el peso se guarda aparte como primer pesaje.
 */
const isFormValid = computed(() => {
  return (
    form.arete.trim().length > 0 &&
    form.raza.trim().length > 0 &&
    form.sexo.trim().length > 0 &&
    form.potrero.trim().length > 0
  );
});

async function cargarCatalogos() {
  try {
    const [listaRazas, listaPotreros] = await Promise.all([catalogoService.razas(), catalogoService.potreros()]);
    razas.value = listaRazas;
    potreros.value = listaPotreros;
  } catch {
    const toast = await toastController.create({
      message: 'No se pudieron cargar las razas y potreros',
      duration: 2500,
      color: 'warning',
    });
    await toast.present();
  }
}

onIonViewWillEnter(async () => {
  await cargarCatalogos();

  if (isEditMode.value) {
    // Edicion: se trae el registro real desde GET /api/v1/animales/{id}
    try {
      const animal = await animalService.obtener(String(editingId.value));
      form.arete = animal.arete;
      form.codigo_qr = animal.codigo_qr ?? animal.codigoQr ?? '';
      form.nombre = animal.nombre ?? '';
      form.raza = animal.razaId ? String(animal.razaId) : '';
      form.sexo = animal.sexo;
      form.potrero = animal.potreroId ? String(animal.potreroId) : '';
      form.peso = animal.peso !== null && animal.peso !== undefined ? String(animal.peso) : '';
      form.estado = animal.estado;
      form.observaciones = '';
    } catch {
      const toast = await toastController.create({
        message: 'No se pudo cargar el animal a editar',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    }
  } else {
    form.arete = '';
    form.codigo_qr = '';
    form.nombre = '';
    form.raza = '';
    form.sexo = 'Hembra';
    form.potrero = '';
    form.peso = '';
    form.estado = 'Activo';
    form.observaciones = '';
  }
});

/**
 * Operacion de escritura real (Persona 3):
 *   POST /api/v1/animales          al registrar
 *   PUT  /api/v1/animales/{id}     al editar
 * Si el usuario escribio un peso, se guarda como primer pesaje del animal.
 */
async function onSubmit() {
  if (!isFormValid.value) return;
  submitting.value = true;

  const areteLimpio = form.arete.trim();
  const qrLimpio = form.codigo_qr.trim();
  const datos = {
    numero_arete: areteLimpio,
    codigo_qr: qrLimpio || `VACA-${areteLimpio}`,
    raza_id: Number(form.raza),
    potrero_id: Number(form.potrero),
    sexo: form.sexo as 'Macho' | 'Hembra',
    estado: form.estado || null,
  };

  try {
    const animal = isEditMode.value
      ? await animalService.actualizar(String(editingId.value), datos)
      : await animalService.crear(datos);

    const peso = Number(form.peso);
    if (!isEditMode.value && Number.isFinite(peso) && peso > 0) {
      try {
        await animalService.registrarPesaje(animal.id, peso, form.observaciones);
      } catch {
        // El animal ya quedo registrado; el pesaje se puede agregar despues.
      }
    }

    const toast = await toastController.create({
      message: isEditMode.value ? 'Animal actualizado correctamente' : 'Animal registrado correctamente',
      duration: 1800,
      color: 'success',
    });
    await toast.present();

    router.replace('/tabs/animales');
  } catch (err) {
    const mensaje =
      err instanceof ApiError ? (err.primerErrorDeValidacion ?? err.message) : 'No se pudo guardar el animal';

    const toast = await toastController.create({
      message: mensaje,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
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
