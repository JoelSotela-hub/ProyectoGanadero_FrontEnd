<template>
  <div
    v-if="abierto"
    class="gg-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-usuario-titulo"
    data-testid="modal-usuario-form"
    @click.self="cerrar"
  >
    <div class="gg-modal gg-card">
      <div class="gg-section-head">
        <div>
          <p class="gg-eyebrow">Administración de accesos</p>
          <h2 id="modal-usuario-titulo" class="gg-section-title">Nuevo usuario</h2>
        </div>
        <button
          type="button"
          class="gg-btn gg-btn--ghost"
          aria-label="Cerrar formulario de usuario"
          :disabled="store.guardando"
          data-testid="btn-cerrar-modal-usuario"
          @click="cerrar"
        >
          Cancelar
        </button>
      </div>

      <form class="gg-modal-form" novalidate data-testid="form-crear-usuario" @submit.prevent="enviarFormulario">
        <div
          v-if="store.errorGeneral"
          class="gg-alert gg-alert--danger"
          role="alert"
          data-testid="usuario-error-general"
        >
          <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
          <span>{{ store.errorGeneral }}</span>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.name }">
          <label class="gg-field__label" for="usr-form-name">Nombre completo *</label>
          <div class="gg-field__control">
            <input
              id="usr-form-name"
              v-model="form.name"
              class="gg-input gg-input--icon"
              type="text"
              autocomplete="name"
              maxlength="255"
              placeholder="Ej: María López"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.name)"
              :aria-describedby="store.errores.name ? 'usr-form-name-error' : undefined"
              data-testid="input-usuario-name"
              required
            />
            <span class="gg-field__icon"><ion-icon :icon="personOutline" aria-hidden="true" /></span>
          </div>
          <p
            v-if="store.errores.name"
            id="usr-form-name-error"
            class="gg-field__error"
            data-testid="error-usuario-name"
          >
            {{ store.errores.name }}
          </p>
        </div>

        <div class="gg-form-row">
          <div class="gg-field" :class="{ 'gg-field--error': store.errores.email }">
            <label class="gg-field__label" for="usr-form-email">Correo electrónico *</label>
            <div class="gg-field__control">
              <input
                id="usr-form-email"
                v-model="form.email"
                class="gg-input gg-input--icon"
                type="email"
                inputmode="email"
                autocomplete="email"
                maxlength="255"
                placeholder="usuario@guateganado.com"
                :disabled="store.guardando"
                :aria-invalid="Boolean(store.errores.email)"
                :aria-describedby="store.errores.email ? 'usr-form-email-error' : undefined"
                data-testid="input-usuario-email"
                required
              />
              <span class="gg-field__icon"><ion-icon :icon="mailOutline" aria-hidden="true" /></span>
            </div>
            <p
              v-if="store.errores.email"
              id="usr-form-email-error"
              class="gg-field__error"
              data-testid="error-usuario-email"
            >
              {{ store.errores.email }}
            </p>
          </div>

          <div class="gg-field" :class="{ 'gg-field--error': store.errores.role }">
            <label class="gg-field__label" for="usr-form-role">Rol *</label>
            <select
              id="usr-form-role"
              v-model="form.role"
              class="gg-select"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.role)"
              :aria-describedby="store.errores.role ? 'usr-form-role-error' : undefined"
              data-testid="select-usuario-role"
              required
            >
              <option value="" disabled>Selecciona un rol</option>
              <option v-for="r in ROLES" :key="r" :value="r">{{ ETIQUETA_ROL[r] }}</option>
            </select>
            <p
              v-if="store.errores.role"
              id="usr-form-role-error"
              class="gg-field__error"
              data-testid="error-usuario-role"
            >
              {{ store.errores.role }}
            </p>
          </div>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.password }">
          <label class="gg-field__label" for="usr-form-password">Contraseña *</label>
          <div class="gg-field__control">
            <input
              id="usr-form-password"
              v-model="form.password"
              class="gg-input gg-input--icon"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Contraseña segura"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.password)"
              aria-describedby="usr-form-password-hint usr-form-password-error"
              data-testid="input-usuario-password"
              required
            />
            <button
              type="button"
              class="gg-field__icon"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" aria-hidden="true" />
            </button>
          </div>
          <p id="usr-form-password-hint" class="gg-field__hint">
            Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.
          </p>
          <p
            v-if="store.errores.password"
            id="usr-form-password-error"
            class="gg-field__error"
            data-testid="error-usuario-password"
          >
            {{ store.errores.password }}
          </p>
        </div>

        <div class="gg-field" :class="{ 'gg-field--error': store.errores.password_confirmation }">
          <label class="gg-field__label" for="usr-form-password-confirm">Confirmar contraseña *</label>
          <div class="gg-field__control">
            <input
              id="usr-form-password-confirm"
              v-model="form.password_confirmation"
              class="gg-input gg-input--icon"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Repite la contraseña"
              :disabled="store.guardando"
              :aria-invalid="Boolean(store.errores.password_confirmation)"
              :aria-describedby="store.errores.password_confirmation ? 'usr-form-confirm-error' : undefined"
              data-testid="input-usuario-password-confirmation"
              required
            />
            <span class="gg-field__icon"><ion-icon :icon="lockClosedOutline" aria-hidden="true" /></span>
          </div>
          <p
            v-if="store.errores.password_confirmation"
            id="usr-form-confirm-error"
            class="gg-field__error"
            data-testid="error-usuario-password-confirmation"
          >
            {{ store.errores.password_confirmation }}
          </p>
        </div>

        <div class="gg-modal-actions">
          <button type="submit" class="gg-btn" :disabled="store.guardando" data-testid="btn-guardar-usuario">
            {{ store.guardando ? 'Creando usuario...' : 'Crear usuario' }}
          </button>
          <button
            type="button"
            class="gg-btn gg-btn--outline"
            :disabled="store.guardando"
            data-testid="btn-cancelar-usuario"
            @click="cerrar"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  alertCircleOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
} from 'ionicons/icons';
import { reactive, ref, watch } from 'vue';

import { ETIQUETA_ROL, ROLES, type Rol } from '@/config/roles';
import type { AuthUser, RegisterPayload } from '@/models/auth.model';
import { mostrarToast } from '@/services';
import { useUsuariosStore } from '@/stores/usuarios';

const props = defineProps<{
  abierto: boolean;
}>();

const emit = defineEmits<{
  (e: 'cerrar'): void;
  (e: 'creado', usuario: AuthUser): void;
}>();

const store = useUsuariosStore();

const form = reactive<{
  name: string;
  email: string;
  role: Rol | '';
  password: string;
  password_confirmation: string;
}>({
  name: '',
  email: '',
  role: '',
  password: '',
  password_confirmation: '',
});

const showPassword = ref<boolean>(false);

function reiniciarFormulario(): void {
  form.name = '';
  form.email = '';
  form.role = '';
  form.password = '';
  form.password_confirmation = '';
  showPassword.value = false;
  store.limpiarErrores();
}

watch(
  () => props.abierto,
  (nuevoValor) => {
    if (nuevoValor) {
      reiniciarFormulario();
    }
  },
);

/** Misma política de validación fuerte que RegisterRequest del backend. */
function validar(): boolean {
  store.limpiarErrores();

  if (!form.name.trim()) {
    store.errores.name = 'Ingresa el nombre completo.';
  }

  const correo = form.email.trim();
  if (!correo) {
    store.errores.email = 'Ingresa el correo electrónico.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    store.errores.email = 'Ingresa un correo electrónico válido.';
  }

  if (!form.role || !ROLES.includes(form.role as Rol)) {
    store.errores.role = 'Selecciona un rol válido.';
  }

  const clave = form.password;
  if (!clave) {
    store.errores.password = 'Ingresa una contraseña.';
  } else if (clave.length < 8) {
    store.errores.password = 'La contraseña debe tener al menos 8 caracteres.';
  } else if (!/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/\d/.test(clave) || !/[^A-Za-z0-9]/.test(clave)) {
    store.errores.password = 'Debe incluir mayúscula, minúscula, número y símbolo.';
  }

  if (!form.password_confirmation) {
    store.errores.password_confirmation = 'Confirma la contraseña.';
  } else if (form.password_confirmation !== form.password) {
    store.errores.password_confirmation = 'Las contraseñas no coinciden.';
  }

  return Object.values(store.errores).every((mensaje) => !mensaje);
}

function cerrar(): void {
  if (store.guardando) return;
  emit('cerrar');
}

async function enviarFormulario(): Promise<void> {
  if (!validar()) return;

  const payload: RegisterPayload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    role: form.role as RegisterPayload['role'],
    password: form.password,
    password_confirmation: form.password_confirmation,
  };

  const creado = await store.crearUsuario(payload);
  if (!creado) return;

  reiniciarFormulario();
  await mostrarToast(`Usuario ${creado.name} registrado correctamente.`, 'success', 2400);
  emit('creado', creado);
  emit('cerrar');
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
