import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { inicializarTema } from './composables/useTheme';
import router from './router';
import { inicializarServicios } from './services';

import '@ionic/vue/css/core.css';

import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

import './theme/variables.css';
import './theme/components.css';
import './theme/dark.css';
import './theme/motion.css';

inicializarTema();

const pinia = createPinia();
const app = createApp(App).use(pinia).use(IonicVue).use(router);

inicializarServicios(router);

router.isReady().then(() => {
  app.mount('#app');
});
