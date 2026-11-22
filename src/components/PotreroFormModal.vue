<template>
  <div
    v-if="open && esAdmin"
    class="gg-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-potrero-titulo"
    data-testid="modal-potrero-form"
    @click.self="cerrar"
  >
    <div class="gg-modal gg-card">
      <div class="gg-section-head">
        <div>
          <p class="gg-eyebrow">{{ store.esEdicion ? `Potrero #${store.editandoId}` : 'Gestión de potreros' }}</p>
          <h2 id="modal-potrero-titulo" class="gg-section-title">
            {{ store.esEdicion ? 'Editar potrero' : 'Nuevo potrero' }}
          </h2>
        </div>
        <button
          type="button"
          class="gg-btn gg-btn--ghost"
          aria-label="Cerrar formulario de potrero"
          :disabled="store.guardando"
          @click="cerrar"
        >
          Cancelar
        </button>
      </div>

      <form class="gg-modal-form" novalidate @submit.prevent="enviar">
        <div v-if="store.errorNegocio" class="gg-alert gg-alert--warning" role="alert" data-testid="potrero-error-409">
          <ion-icon :icon="warningOutline" aria-hidden="true" />
          <span><strong>Regla de negocio:</strong> {{ store.errorNegocio }}</span>
        </div>

        <div
          v-if="store.errorGeneral"
          class="gg-alert gg-alert--danger"
          role="alert"
          data-testid="potrero-error-general"
        >
          <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
          <span>{{ store.errorGeneral }}</span>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.nombre }">
          <label class="gg-field__label" for="potrero-nombre">Nombre del potrero *</label>
          <input
            id="potrero-nombre"
            v-model="store.form.nombre"
            class="gg-input"
            type="text"
            maxlength="100"
            placeholder="Ej: Potrero Norte"
            autocomplete="off"
            :disabled="store.guardando"
            :aria-invalid="Boolean(store.errores.nombre)"
            :aria-describedby="store.errores.nombre ? 'potrero-nombre-error' : undefined"
            required
          />
          <p v-if="store.errores.nombre" id="potrero-nombre-error" class="gg-field__error">
            {{ store.errores.nombre }}
          </p>
        </div>

        <div class="gg-form-row">
          <div class="gg-field" :class="{ 'gg-field--error': store.errores.hectareas_de_extension }">
            <label class="gg-field__label" for="potrero-hectareas">Extensión (hectáreas) *</label>
            <input
              id="potrero-hectareas"
              v-model="store.form.hectareas_de_extension"
              class="gg-input"
              type="number"
              inputmode="decimal"
              min="0"
              max="999999.99"
              step="0.01"
              placeholder="Ej: 25.5"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.hectareas_de_extension)"
              :aria-describedby="store.errores.hectareas_de_extension ? 'potrero-hectareas-error' : undefined"
              required
            />
            <p v-if="store.errores.hectareas_de_extension" id="potrero-hectareas-error" class="gg-field__error">
              {{ store.errores.hectareas_de_extension }}
            </p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': store.errores.capacidad_maxima }">
            <label class="gg-field__label" for="potrero-capacidad">Capacidad máxima (animales) *</label>
            <input
              id="potrero-capacidad"
              v-model="store.form.capacidad_maxima"
              class="gg-input"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              placeholder="Ej: 40"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.capacidad_maxima)"
              :aria-describedby="store.errores.capacidad_maxima ? 'potrero-capacidad-error' : undefined"
              required
            />
            <p v-if="store.errores.capacidad_maxima" id="potrero-capacidad-error" class="gg-field__error">
              {{ store.errores.capacidad_maxima }}
            </p>
          </div>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.estado_pasto }">
          <label class="gg-field__label" for="potrero-estado-pasto">Estado del pasto (opcional)</label>
          <select
            id="potrero-estado-pasto"
            v-model="store.form.estado_pasto"
            class="gg-select"
            :disabled="store.guardando"
            :aria-invalid="Boolean(store.errores.estado_pasto)"
            :aria-describedby="store.errores.estado_pasto ? 'potrero-estado-pasto-error' : undefined"
          >
            <option value="">Sin especificar</option>
            <option v-for="estado in ESTADOS_PASTO" :key="estado" :value="estado">{{ estado }}</option>
          </select>
          <p v-if="store.errores.estado_pasto" id="potrero-estado-pasto-error" class="gg-field__error">
            {{ store.errores.estado_pasto }}
          </p>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.codigo_qr }">
          <label class="gg-field__label" for="potrero-codigo-qr">Código QR (opcional)</label>
          <input
            id="potrero-codigo-qr"
            v-model="store.form.codigo_qr"
            class="gg-input"
            type="text"
            maxlength="100"
            placeholder="Ej: POTRERO-NORTE"
            autocomplete="off"
            :disabled="store.guardando"
            :aria-invalid="Boolean(store.errores.codigo_qr)"
            :aria-describedby="
              store.errores.codigo_qr ? 'potrero-codigo-qr-error potrero-codigo-qr-hint' : 'potrero-codigo-qr-hint'
            "
          />
          <p id="potrero-codigo-qr-hint" class="gg-field__hint">
            Si se deja vacío, el servidor genera automáticamente <code>POTRERO-{SLUG}</code> a partir del nombre.
          </p>
          <p v-if="store.errores.codigo_qr" id="potrero-codigo-qr-error" class="gg-field__error">
            {{ store.errores.codigo_qr }}
          </p>
        </div>

        <div class="gg-modal-actions">
          <button type="submit" class="gg-btn" :disabled="store.guardando" data-testid="btn-guardar-potrero">
            {{ store.guardando ? 'Guardando...' : store.esEdicion ? 'Guardar cambios' : 'Crear potrero' }}
          </button>
          <button type="button" class="gg-btn gg-btn--outline" :disabled="store.guardando" @click="cerrar">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { alertCircleOutline, warningOutline } from 'ionicons/icons';

import { useRol } from '@/composables/useRol';
import { ESTADOS_PASTO, mostrarToast, type Potrero } from '@/services';
import { usePotreroStore } from '@/stores/potrero';

defineProps<{ open: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', potrero: Potrero): void;
}>();

const store = usePotreroStore();
const { esAdmin } = useRol();

function cerrar(): void {
  if (store.guardando) return;
  emit('close');
}

async function enviar(): Promise<void> {
  const eraEdicion = store.esEdicion;
  const guardado = await store.guardar();
  if (!guardado) {
    if (store.errorNegocio) {
      await mostrarToast(store.errorNegocio, 'warning', 5000);
    }
    return;
  }
  await mostrarToast(
    eraEdicion ? 'Potrero actualizado correctamente.' : 'Potrero creado correctamente.',
    'success',
    2500,
  );
  emit('saved', guardado);
}
</script>

<style scoped>
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

.gg-form-row {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
}
@media (min-width: 34rem) {
  .gg-form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
