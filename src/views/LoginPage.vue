<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GuateGanado</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="login-container">
        <!-- Encabezado -->
        <div class="login-header">
          <p class="eyebrow">Bienvenido de nuevo</p>
          <h1>Inicia sesión en <span>GuateGanado</span></h1>
        </div>

        <!-- Formulario -->
        <ion-card>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-input
                  v-model="email"
                  type="email"
                  label="Correo electrónico"
                  label-placement="floating"
                  placeholder="usuario@guateganado.cr"
                  autocomplete="username"
                  :disabled="loading"
                />
              </ion-item>

              <ion-item>
                <ion-input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  label="Contraseña"
                  label-placement="floating"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  :disabled="loading"
                />
                <ion-button slot="end" fill="clear" size="small" @click="showPassword = !showPassword">
                  {{ showPassword ? 'Ocultar' : 'Ver' }}
                </ion-button>
              </ion-item>

              <ion-item lines="none">
                <ion-checkbox v-model="remember" label-placement="end"> Recordarme </ion-checkbox>
              </ion-item>
            </ion-list>

            <ion-button expand="block" class="ion-margin-top" :disabled="loading || !email || !password" @click="login">
              {{ loading ? 'Ingresando...' : 'Ingresar al Sistema' }}
            </ion-button>

            <ion-button expand="block" fill="clear" size="small"> ¿Olvidó su contraseña? </ion-button>
          </ion-card-content>
        </ion-card>

        <p class="footer-text">¿Necesita asistencia técnica? <strong>Contacte al administrador.</strong></p>
      </div>

      <!-- Loader -->
      <ion-loading :is-open="loading" message="Verificando credenciales..." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonCheckbox,
  IonLoading,
  toastController,
} from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';
import { ApiError, authService } from '@/services';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const remember = ref(false);
const showPassword = ref(false);
const loading = ref(false);

/**
 * Inicio de sesion real contra POST /api/v1/auth/login (Persona 3).
 * El servicio devuelve { token, user } y el store de Pinia lo guarda;
 * el almacenamiento seguro del token lo resuelve el adaptador de Persona 4.
 */
async function login() {
  if (!email.value.trim() || !password.value) {
    const t = await toastController.create({
      message: 'Ingresa tu correo y contraseña',
      duration: 2000,
      color: 'warning',
    });
    await t.present();
    return;
  }

  loading.value = true;
  try {
    const sesion = await authService.login({
      email: email.value,
      password: password.value,
      remember: remember.value,
    });

    await authStore.login(sesion);

    const t = await toastController.create({
      message: `Bienvenido, ${sesion.user.name}`,
      duration: 1500,
      color: 'success',
    });
    await t.present();

    // Reemplaza el historial al entrar para que el botón físico de retroceso no vuelva al login
    await router.replace('/tabs/dashboard');
  } catch (err) {
    const mensaje =
      err instanceof ApiError
        ? err.status === 401
          ? 'Credenciales inválidas'
          : err.status === 429
            ? 'Demasiados intentos. Espera un momento.'
            : err.message
        : 'No se pudo iniciar sesión';

    const t = await toastController.create({
      message: mensaje,
      duration: 2500,
      color: 'danger',
    });
    await t.present();
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  max-width: 420px;
  margin: 0 auto;
  padding-top: 1rem;
}

.login-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.25rem;
}

.login-header h1 {
  font-size: 1.5rem;
  margin: 0;
}

.login-header span {
  color: var(--ion-color-primary);
}

.footer-text {
  text-align: center;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 1.5rem;
}
</style>
