import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { inicializarServicios } from './services';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/*
 * GuateGanado define su propia paleta oscura (src/theme/dark.css) activada por
 * la clase `.ion-palette-dark` / `.gg-dark` en <html>; no se importa la paleta
 * genérica de Ionic para conservar la identidad verde/oliva con contraste AA.
 */

/* Theme variables + clases utilitarias gg-* + modo oscuro + movimiento */
import './theme/variables.css';
import './theme/components.css';
import './theme/dark.css';
import './theme/motion.css';

import { inicializarTema } from './composables/useTheme';

/*
 * Aplica el tema (localStorage `gg_theme` o `prefers-color-scheme`) antes de
 * montar la app. `index.html` ya lo adelanta con un script en línea para que
 * no exista destello blanco; aquí se sincroniza el estado reactivo.
 */
inicializarTema();

const pinia = createPinia();
const app = createApp(App).use(pinia).use(IonicVue).use(router);

/**
 * Conecta la capa de servicios con la sesion y el router (Persona 3):
 * de aqui sale el token que se adjunta a cada peticion y aqui se define
 * que ocurre cuando la API responde 401. Debe ir despues de `use(pinia)`.
 */
inicializarServicios(router);

router.isReady().then(() => {
  app.mount('#app');
});
