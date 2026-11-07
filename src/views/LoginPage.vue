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
                <ion-button
                  slot="end"
                  fill="clear"
                  size="small"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Ocultar' : 'Ver' }}
                </ion-button>
              </ion-item>

              <ion-item lines="none">
                <ion-checkbox v-model="remember" label-placement="end">
                  Recordarme
                </ion-checkbox>
              </ion-item>
            </ion-list>

            <ion-button
              expand="block"
              class="ion-margin-top"
              :disabled="loading || !email || !password"
              @click="login"
            >
              {{ loading ? 'Ingresando...' : 'Ingresar al Sistema' }}
            </ion-button>

            <ion-button expand="block" fill="clear" size="small">
              ¿Olvidó su contraseña?
            </ion-button>
          </ion-card-content>
        </ion-card>

        <p class="footer-text">
          ¿Necesita asistencia técnica? <strong>Contacte al administrador.</strong>
        </p>
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
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonList, IonItem, IonInput,
  IonButton, IonCheckbox, IonLoading, toastController
} from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const remember = ref(false);
const showPassword = ref(false);
const loading = ref(false);

// Conectado al estado compartido de Pinia — la Persona 3 reemplazará la llamada por el servicio real de API
async function login() {
  loading.value = true;
  try {
    await new Promise(r => setTimeout(r, 600)); // simula llamada

    const success = await authStore.login({
      email: email.value,
      password: password.value,
      remember: remember.value,
    });

    if (success) {
      const t = await toastController.create({
        message: 'Bienvenido',
        duration: 1500,
        color: 'success'
      });
      await t.present();
      // Reemplaza el historial al entrar para que el botón físico de retroceso no vuelva al login
      await router.replace('/tabs/dashboard');
    } else {
      const t = await toastController.create({
        message: 'Credenciales inválidas',
        duration: 2000,
        color: 'danger'
      });
      await t.present();
    }
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
