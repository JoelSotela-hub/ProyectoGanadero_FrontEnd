<template>
  <auth-layout>
    <p class="gg-auth-eyebrow">Bienvenido de nuevo</p>
    <h1 class="gg-auth-title">Inicia sesión en <span>GuateGanado</span></h1>

    <form class="gg-auth-form" novalidate @submit.prevent="login">
      <div v-if="errorGeneral" class="gg-alert gg-alert--danger" role="alert">
        <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
        <span>{{ errorGeneral }}</span>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.email }">
        <label class="gg-field__label" for="login-email">Correo electrónico</label>
        <div class="gg-field__control">
          <input
            id="login-email"
            v-model="email"
            class="gg-input gg-input--icon"
            type="email"
            inputmode="email"
            autocomplete="username"
            placeholder="usuario@guateganado.com"
            :disabled="loading"
            :aria-invalid="Boolean(errores.email)"
            :aria-describedby="errores.email ? 'login-email-error' : undefined"
            required
          />
          <span class="gg-field__icon"><ion-icon :icon="mailOutline" aria-hidden="true" /></span>
        </div>
        <p v-if="errores.email" id="login-email-error" class="gg-field__error">{{ errores.email }}</p>
      </div>

      <div class="gg-field" :class="{ 'gg-field--error': errores.password }">
        <label class="gg-field__label" for="login-password">Contraseña</label>
        <div class="gg-field__control">
          <input
            id="login-password"
            v-model="password"
            class="gg-input gg-input--icon"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Tu contraseña"
            :disabled="loading"
            :aria-invalid="Boolean(errores.password)"
            :aria-describedby="errores.password ? 'login-password-error' : undefined"
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
        <p v-if="errores.password" id="login-password-error" class="gg-field__error">{{ errores.password }}</p>
      </div>

      <label class="gg-checkbox">
        <input v-model="remember" type="checkbox" :disabled="loading" />
        Recordarme
      </label>

      <button type="submit" class="gg-btn gg-btn--block" :disabled="loading">
        {{ loading ? 'Ingresando...' : 'Ingresar al sistema' }}
      </button>
    </form>

    <template #pie>
      <p class="gg-auth-foot">
        ¿Necesita una cuenta?
        <a class="gg-link" href="/register" @click.prevent="router.push('/register')">Regístrese aquí</a>
      </p>
    </template>
  </auth-layout>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { Preferences } from '@capacitor/preferences';
import { alertCircleOutline, eyeOffOutline, eyeOutline, mailOutline } from 'ionicons/icons';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import AuthLayout from '@/components/AuthLayout.vue';
import { ApiError, authService, mensajeDeError, mostrarToast } from '@/services';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

/** "Recordarme" solo recuerda el correo (no es sensible). El token vive en el almacenamiento cifrado. */
const CLAVE_EMAIL_RECORDADO = 'guateganado_email_recordado';

const email = ref('');
const password = ref('');
const remember = ref(false);
const showPassword = ref(false);
const loading = ref(false);
const errorGeneral = ref('');
const errores = reactive<{ email: string; password: string }>({ email: '', password: '' });

onMounted(async () => {
  try {
    const { value } = await Preferences.get({ key: CLAVE_EMAIL_RECORDADO });
    if (value) {
      email.value = value;
      remember.value = true;
    }
  } catch {
    // Sin almacenamiento: el campo queda vacío.
  }
});

function validar(): boolean {
  errores.email = '';
  errores.password = '';

  const correo = email.value.trim();
  if (!correo) errores.email = 'Ingresa tu correo electrónico.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.email = 'Ingresa un correo válido.';

  if (!password.value) errores.password = 'Ingresa tu contraseña.';
  else if (password.value.length < 8) errores.password = 'La contraseña tiene al menos 8 caracteres.';

  return !errores.email && !errores.password;
}

/**
 * POST /api/v1/auth/login → solo devuelve `token`; el servicio llama enseguida a
 * GET /api/user para cargar { id, name, email, role } en Pinia.
 */
async function login(): Promise<void> {
  errorGeneral.value = '';
  if (!validar()) return;

  loading.value = true;
  try {
    const sesion = await authService.login({
      email: email.value,
      password: password.value,
      remember: remember.value,
    });

    await authStore.login(sesion);

    try {
      if (remember.value) await Preferences.set({ key: CLAVE_EMAIL_RECORDADO, value: email.value.trim() });
      else await Preferences.remove({ key: CLAVE_EMAIL_RECORDADO });
    } catch {
      // No es crítico.
    }

    void mostrarToast(`Bienvenido, ${sesion.user.name}`, 'success', 1800);

    // Reemplaza el historial al entrar para que el botón físico de retroceso no vuelva al login
    await router.replace('/tabs/dashboard');
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const porCampo = err.erroresPorCampo;
      errores.email = porCampo.email ?? '';
      errores.password = porCampo.password ?? '';
    }
    errorGeneral.value = mensajeDeError(err, 'No se pudo iniciar sesión.');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* Garantiza en escritorio que la ilustración y el sol naranja del panel verde bosque
   permanezcan detrás (z-index: 0) y desplazados al horizonte inferior sin superponerse
   sobre el título "Control y Registro" ni sobre el subtítulo. */
:deep(.gg-auth__hero) {
  position: relative;
  z-index: 2;
}

:deep(.gg-auth__art) {
  z-index: 0;
  height: 54%;
  max-height: 21rem;
}
</style>
