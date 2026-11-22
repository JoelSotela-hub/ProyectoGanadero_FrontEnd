<template>
  <auth-layout>
    <p class="gg-auth-eyebrow">Crear cuenta</p>
    <h1 class="gg-auth-title">Regístrate en <span>GuateGanado</span></h1>

    <form class="gg-auth-form" novalidate @submit.prevent="registrar">
      <div
        v-if="errorGeneral"
        class="gg-alert"
        :class="esNegocio ? 'gg-alert--warning' : 'gg-alert--danger'"
        role="alert"
      >
        <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
        <span>{{ errorGeneral }}</span>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.name }">
        <label class="gg-field__label" for="reg-name">Nombre completo</label>
        <div class="gg-field__control">
          <input
            id="reg-name"
            v-model="form.name"
            class="gg-input gg-input--icon"
            type="text"
            autocomplete="name"
            maxlength="255"
            :disabled="loading"
            :aria-invalid="Boolean(errores.name)"
            :aria-describedby="errores.name ? 'reg-name-error' : undefined"
            required
          />
          <span class="gg-field__icon"><ion-icon :icon="personOutline" aria-hidden="true" /></span>
        </div>
        <p v-if="errores.name" id="reg-name-error" class="gg-field__error">{{ errores.name }}</p>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.email }">
        <label class="gg-field__label" for="reg-email">Correo electrónico</label>
        <div class="gg-field__control">
          <input
            id="reg-email"
            v-model="form.email"
            class="gg-input gg-input--icon"
            type="email"
            inputmode="email"
            autocomplete="email"
            maxlength="255"
            :disabled="loading"
            :aria-invalid="Boolean(errores.email)"
            :aria-describedby="errores.email ? 'reg-email-error' : undefined"
            required
          />
          <span class="gg-field__icon"><ion-icon :icon="mailOutline" aria-hidden="true" /></span>
        </div>
        <p v-if="errores.email" id="reg-email-error" class="gg-field__error">{{ errores.email }}</p>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.role }">
        <label class="gg-field__label" for="reg-role">Rol</label>
        <select id="reg-role" v-model="form.role" class="gg-select" :disabled="loading" required>
          <option value="" disabled>Selecciona un rol</option>
          <option v-for="r in ROLES" :key="r" :value="r">{{ ETIQUETA_ROL[r] }}</option>
        </select>
        <p v-if="errores.role" class="gg-field__error">{{ errores.role }}</p>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.password }">
        <label class="gg-field__label" for="reg-password">Contraseña</label>
        <div class="gg-field__control">
          <input
            id="reg-password"
            v-model="form.password"
            class="gg-input gg-input--icon"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :disabled="loading"
            :aria-invalid="Boolean(errores.password)"
            aria-describedby="reg-password-hint reg-password-error"
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
        <p id="reg-password-hint" class="gg-field__hint">
          Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.
        </p>
        <p v-if="errores.password" id="reg-password-error" class="gg-field__error">{{ errores.password }}</p>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.password_confirmation }">
        <label class="gg-field__label" for="reg-password-confirm">Confirmar contraseña</label>
        <div class="gg-field__control">
          <input
            id="reg-password-confirm"
            v-model="form.password_confirmation"
            class="gg-input gg-input--icon"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :disabled="loading"
            :aria-invalid="Boolean(errores.password_confirmation)"
            :aria-describedby="errores.password_confirmation ? 'reg-confirm-error' : undefined"
            required
          />
          <span class="gg-field__icon"><ion-icon :icon="lockClosedOutline" aria-hidden="true" /></span>
        </div>
        <p v-if="errores.password_confirmation" id="reg-confirm-error" class="gg-field__error">
          {{ errores.password_confirmation }}
        </p>
      </div>

      <button type="submit" class="gg-btn gg-btn--block" :disabled="loading">
        {{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}
      </button>
    </form>

    <template #pie>
      <p class="gg-auth-foot">
        ¿Ya tiene una cuenta?
        <a class="gg-link" href="/login" @click.prevent="router.push('/login')">Inicie sesión</a>
      </p>
    </template>
  </auth-layout>
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
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import AuthLayout from '@/components/AuthLayout.vue';
import { ETIQUETA_ROL, ROLES } from '@/config/roles';
import type { RegisterPayload } from '@/models/auth.model';
import { ApiError, authService, mensajeDeError, mostrarToast } from '@/services';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: '' as RegisterPayload['role'] | '',
});
type Campo = keyof typeof form;

const errores = reactive<Record<Campo, string>>({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: '',
});
const showPassword = ref(false);
const loading = ref(false);
const errorGeneral = ref('');
const esNegocio = ref(false);

function limpiarErrores(): void {
  (Object.keys(errores) as Campo[]).forEach((campo) => {
    errores[campo] = '';
  });
  errorGeneral.value = '';
  esNegocio.value = false;
}

/** Misma política que RegisterRequest del backend (la validación `uncompromised` solo la puede hacer el servidor). */
function validar(): boolean {
  limpiarErrores();

  if (!form.name.trim()) errores.name = 'Ingresa tu nombre.';
  if (!form.email.trim()) errores.email = 'Ingresa tu correo electrónico.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errores.email = 'Ingresa un correo válido.';
  if (!form.role) errores.role = 'Selecciona un rol.';

  const clave = form.password;
  if (!clave) errores.password = 'Ingresa una contraseña.';
  else if (clave.length < 8) errores.password = 'La contraseña debe tener al menos 8 caracteres.';
  else if (!/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/\d/.test(clave) || !/[^A-Za-z0-9]/.test(clave)) {
    errores.password = 'Debe incluir mayúscula, minúscula, número y símbolo.';
  }

  if (!form.password_confirmation) errores.password_confirmation = 'Confirma tu contraseña.';
  else if (form.password_confirmation !== form.password)
    errores.password_confirmation = 'Las contraseñas no coinciden.';

  return Object.values(errores).every((mensaje) => !mensaje);
}

/** POST /api/v1/auth/register → 201 { token, usuario }: el usuario viene en la clave `usuario`. */
async function registrar(): Promise<void> {
  if (!validar()) return;

  loading.value = true;
  try {
    const sesion = await authService.registrar({
      name: form.name,
      email: form.email,
      password: form.password,
      password_confirmation: form.password_confirmation,
      role: form.role as RegisterPayload['role'],
    });

    await authStore.login(sesion);
    void mostrarToast(`Cuenta creada. Bienvenido, ${sesion.user.name}`, 'success', 2200);
    await router.replace('/tabs/dashboard');
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const porCampo = err.erroresPorCampo;
      (Object.keys(errores) as Campo[]).forEach((campo) => {
        errores[campo] = porCampo[campo] ?? '';
      });
    }
    esNegocio.value = err instanceof ApiError && err.esReglaDeNegocio;
    errorGeneral.value = mensajeDeError(err, 'No se pudo crear la cuenta.');
  } finally {
    loading.value = false;
  }
}
</script>
