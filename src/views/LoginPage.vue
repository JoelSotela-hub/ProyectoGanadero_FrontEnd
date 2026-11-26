<template>
  <auth-layout>
    <div class="gg-auth-top">
      <p class="gg-auth-eyebrow">Bienvenido de nuevo</p>
      <button
        type="button"
        class="gg-btn gg-btn--ghost gg-theme-toggle gg-auth-theme-btn"
        data-testid="btn-toggle-theme-login"
        :aria-label="esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        :aria-pressed="esOscuro"
        :title="esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        @click="alternarTema()"
      >
        <ion-icon :icon="esOscuro ? sunnyOutline : moonOutline" aria-hidden="true" />
        <span>{{ esOscuro ? 'Claro' : 'Oscuro' }}</span>
      </button>
    </div>
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
  </auth-layout>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { Preferences } from '@capacitor/preferences';
import { alertCircleOutline, eyeOffOutline, eyeOutline, mailOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import AuthLayout from '@/components/AuthLayout.vue';
import { useTheme } from '@/composables/useTheme';
import { ApiError, authService, mensajeDeError, mostrarToast } from '@/services';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const { esOscuro, alternarTema } = useTheme();

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
    return;
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

    await (
      remember.value
        ? Preferences.set({ key: CLAVE_EMAIL_RECORDADO, value: email.value.trim() })
        : Preferences.remove({ key: CLAVE_EMAIL_RECORDADO })
    ).catch(() => undefined);

    void mostrarToast(`Bienvenido, ${sesion.user.name}`, 'success', 1800);

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
.gg-auth-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.3rem;
}

.gg-auth-top .gg-auth-eyebrow {
  margin: 0;
}

.gg-auth-theme-btn {
  min-height: 2.25rem;
  padding: 0.35rem 0.7rem;
  font-size: 0.82rem;
}

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
