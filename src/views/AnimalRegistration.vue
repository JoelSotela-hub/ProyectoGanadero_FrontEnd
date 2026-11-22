<template>
  <ion-page>
    <app-header :titulo="titulo" atras="/tabs/animales" />

    <ion-content class="gg-content">
      <div class="gg-page gg-form-page">
        <a class="gg-link gg-back" href="/tabs/animales" @click.prevent="router.push('/tabs/animales')">
          ← Volver al listado
        </a>

        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Operación ganadera</p>
            <h1 class="gg-title">{{ titulo }}</h1>
            <p class="gg-subtitle">
              {{
                form.esEdicion
                  ? 'Actualiza los datos de la ficha del animal.'
                  : 'Completa los datos para registrar un nuevo animal.'
              }}
            </p>
          </div>
        </header>

        <!-- Carga del registro a editar -->
        <section v-if="form.cargando" class="gg-card" aria-busy="true" aria-label="Cargando animal">
          <span v-for="i in 4" :key="i" class="gg-skeleton" style="margin-bottom: 1.1rem; height: 2.5rem" />
        </section>

        <error-state
          v-else-if="form.errorCarga"
          title="No se pudo cargar el animal"
          :message="form.errorCarga"
          @retry="iniciar"
        />

        <form v-else class="gg-card gg-form" novalidate @submit.prevent="enviar">
          <div v-if="form.errorNegocio" class="gg-alert gg-alert--warning gg-form__full" role="alert">
            <ion-icon :icon="warningOutline" aria-hidden="true" />
            <span><strong>Regla de negocio:</strong> {{ form.errorNegocio }}</span>
          </div>
          <div v-if="form.errorGeneral" class="gg-alert gg-alert--danger gg-form__full" role="alert">
            <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
            <span>{{ form.errorGeneral }}</span>
          </div>
          <div v-if="catalogos.error" class="gg-alert gg-alert--warning gg-form__full" role="status">
            <ion-icon :icon="warningOutline" aria-hidden="true" />
            <span>No se pudieron cargar las razas y potreros.</span>
            <button type="button" class="gg-link" @click="catalogos.cargar(true)">Reintentar</button>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.numero_arete }">
            <label class="gg-field__label" for="a-arete">Número de arete *</label>
            <input
              id="a-arete"
              v-model="form.form.numero_arete"
              class="gg-input"
              type="text"
              maxlength="50"
              placeholder="Ej: CR-001-LIB"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.numero_arete)"
              :aria-describedby="form.errores.numero_arete ? 'a-arete-error' : undefined"
              required
            />
            <p v-if="form.errores.numero_arete" id="a-arete-error" class="gg-field__error">
              {{ form.errores.numero_arete }}
            </p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.codigo_qr }">
            <label class="gg-field__label" for="a-qr">Código QR (opcional)</label>
            <input
              id="a-qr"
              v-model="form.form.codigo_qr"
              class="gg-input"
              type="text"
              maxlength="100"
              :placeholder="
                form.form.numero_arete.trim() ? `Se autogenera: VACA-${form.form.numero_arete.trim()}` : 'Ej: VACA-001'
              "
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.codigo_qr)"
              :aria-describedby="form.errores.codigo_qr ? 'a-qr-error' : 'a-qr-hint'"
            />
            <p v-if="form.errores.codigo_qr" id="a-qr-error" class="gg-field__error">{{ form.errores.codigo_qr }}</p>
            <p v-else id="a-qr-hint" class="gg-field__hint">Si lo dejas vacío, el sistema lo genera automáticamente.</p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.raza_id }">
            <label class="gg-field__label" for="a-raza">Raza *</label>
            <select
              id="a-raza"
              v-model="form.form.raza_id"
              class="gg-select"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.raza_id)"
              :aria-describedby="form.errores.raza_id ? 'a-raza-error' : undefined"
              required
            >
              <option value="" disabled>Selecciona una raza</option>
              <option v-for="r in catalogos.razas" :key="r.id" :value="String(r.id)">{{ r.nombre }}</option>
            </select>
            <p v-if="form.errores.raza_id" id="a-raza-error" class="gg-field__error">{{ form.errores.raza_id }}</p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.potrero_id }">
            <label class="gg-field__label" for="a-potrero">Potrero *</label>
            <select
              id="a-potrero"
              v-model="form.form.potrero_id"
              class="gg-select"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.potrero_id)"
              :aria-describedby="form.errores.potrero_id ? 'a-potrero-error' : undefined"
              required
            >
              <option value="" disabled>Selecciona un potrero</option>
              <option v-for="p in catalogos.potreros" :key="p.id" :value="String(p.id)">{{ p.nombre }}</option>
            </select>
            <p v-if="form.errores.potrero_id" id="a-potrero-error" class="gg-field__error">
              {{ form.errores.potrero_id }}
            </p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.sexo }">
            <label class="gg-field__label" for="a-sexo">Sexo *</label>
            <select
              id="a-sexo"
              v-model="form.form.sexo"
              class="gg-select"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.sexo)"
              :aria-describedby="form.errores.sexo ? 'a-sexo-error' : undefined"
              required
            >
              <option value="" disabled>Selecciona el sexo</option>
              <option value="Hembra">Hembra</option>
              <option value="Macho">Macho</option>
            </select>
            <p v-if="form.errores.sexo" id="a-sexo-error" class="gg-field__error">{{ form.errores.sexo }}</p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.fecha_nacimiento }">
            <label class="gg-field__label" for="a-nacimiento">Fecha de nacimiento</label>
            <input
              id="a-nacimiento"
              v-model="form.form.fecha_nacimiento"
              class="gg-input"
              type="date"
              :max="hoy"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.fecha_nacimiento)"
              :aria-describedby="form.errores.fecha_nacimiento ? 'a-nacimiento-error' : undefined"
            />
            <p v-if="form.errores.fecha_nacimiento" id="a-nacimiento-error" class="gg-field__error">
              {{ form.errores.fecha_nacimiento }}
            </p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': form.errores.estado }">
            <label class="gg-field__label" for="a-estado">Estado</label>
            <select
              id="a-estado"
              v-model="form.form.estado"
              class="gg-select"
              :disabled="form.guardando"
              :aria-invalid="Boolean(form.errores.estado)"
            >
              <option v-for="e in estadosDisponibles" :key="e" :value="e">{{ e }}</option>
            </select>
            <p v-if="form.errores.estado" class="gg-field__error">{{ form.errores.estado }}</p>
          </div>

          <template v-if="!form.esEdicion">
            <div class="gg-field" :class="{ 'gg-field--error': form.errores.peso_kg }">
              <label class="gg-field__label" for="a-peso">Peso inicial (kg, opcional)</label>
              <input
                id="a-peso"
                v-model="form.form.peso_kg"
                class="gg-input"
                type="number"
                inputmode="decimal"
                min="0"
                max="9999.99"
                step="0.01"
                placeholder="Ej: 430"
                :disabled="form.guardando"
                :aria-invalid="Boolean(form.errores.peso_kg)"
                :aria-describedby="form.errores.peso_kg ? 'a-peso-error' : undefined"
              />
              <p v-if="form.errores.peso_kg" id="a-peso-error" class="gg-field__error">{{ form.errores.peso_kg }}</p>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="a-obs">Observaciones del pesaje</label>
              <textarea
                id="a-obs"
                v-model="form.form.observaciones"
                class="gg-textarea"
                rows="2"
                placeholder="Notas del primer pesaje (opcional)"
                :disabled="form.guardando"
              />
            </div>
          </template>

          <div class="gg-form__actions gg-form__full">
            <button type="submit" class="gg-btn" :disabled="form.guardando">
              <ion-icon :icon="saveOutline" aria-hidden="true" />
              {{ form.guardando ? 'Guardando...' : form.esEdicion ? 'Guardar cambios' : 'Registrar animal' }}
            </button>
            <button type="button" class="gg-btn gg-btn--outline" :disabled="form.guardando" @click="router.back()">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage, onIonViewWillEnter } from '@ionic/vue';
import { alertCircleOutline, saveOutline, warningOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import ErrorState from '@/components/ErrorState.vue';
import { mostrarToast } from '@/services';
import { ESTADOS_ANIMAL, useAnimalFormStore } from '@/stores/animalForm';
import { useCatalogosStore } from '@/stores/catalogos';

const route = useRoute();
const router = useRouter();
const form = useAnimalFormStore();
const catalogos = useCatalogosStore();

const hoy = new Date().toISOString().slice(0, 10);

const idEnRuta = computed<string | null>(() => {
  const valor = route.query.id ?? route.params.id;
  const id = Array.isArray(valor) ? valor[0] : valor;
  return id ? String(id) : null;
});

const titulo = computed<string>(() => (form.esEdicion ? `Editar animal #${form.editingId}` : 'Registrar animal'));

/** Si el animal trae un estado fuera del catálogo habitual, se conserva como opción. */
const estadosDisponibles = computed<string[]>(() => {
  const actual = form.form.estado;
  return actual && !ESTADOS_ANIMAL.includes(actual) ? [...ESTADOS_ANIMAL, actual] : ESTADOS_ANIMAL;
});

async function iniciar(): Promise<void> {
  await Promise.all([catalogos.cargar(), form.iniciar(idEnRuta.value)]);
}

onIonViewWillEnter(iniciar);

async function enviar(): Promise<void> {
  const edicion = form.esEdicion;
  const resultado = await form.guardar();

  if (!resultado.ok) {
    if (form.errorNegocio) {
      // 409 — regla de negocio (RN-03: potrero en capacidad máxima)
      await mostrarToast(form.errorNegocio, 'warning', 5000);
    } else if (form.errorGeneral) {
      await mostrarToast(form.errorGeneral, 'danger', 4000);
    }
    return;
  }

  await mostrarToast(
    edicion ? 'Animal actualizado correctamente.' : 'Animal registrado correctamente.',
    'success',
    2200,
  );
  if (resultado.aviso) await mostrarToast(resultado.aviso, 'warning', 6000);

  await router.replace('/tabs/animales');
}
</script>

<style scoped>
.gg-form-page {
  max-width: 52rem;
}
.gg-back {
  align-self: flex-start;
}
.gg-form {
  display: grid;
  gap: 1.1rem;
  grid-template-columns: 1fr;
}
@media (min-width: 48rem) {
  .gg-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 1.5rem;
  }
  .gg-form__full {
    grid-column: 1 / -1;
  }
}
.gg-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
</style>
