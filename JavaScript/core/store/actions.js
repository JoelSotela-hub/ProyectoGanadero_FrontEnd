import { store } from './Store.js';

export const actions = {
    setTheme(themeName){
        store.setState({theme: themeName});
    },

    async fetchResorceData(resourceID){
        store.setState({loading: true, error: null});

        try {
            const response = await fetch();

            if (!response.ok) {
                throw new Error('Error HTTP: ${response.status}');
            }

            const data = await response.json();

            store.setState({
                currentResource: data,
                loading: false
            });
        } catch (error){
            store.setState({
                error: error.message,
                loading: false
            });
        }
    }
};

/*
Esta porcion de codigo seria para conectar la State-Driven UI
import {store} from './core/store/Store.js';
import {actions} from './core/store/actions.js';

export function initUserView() {
  const container = document.getElementById('app-view');

  const render = (state) => {
    if (state.loading) {
      container.innerHTML = `<p>Cargando datos...</p>`;
      return;
    }

    if (state.error) {
      container.innerHTML = `<p style="color: red;">Error: ${state.error}</p>`;
      return;
    }

    container.innerHTML = `
      <h2>Recurso: ${state.currentResource?.name || 'Ninguno'}</h2>
      <button id="reload-btn">Actualizar Datos</button>
    `;

    // Vincular eventos de UI que disparan acciones
    document.getElementById('reload-btn')?.addEventListener('click', () => {
      actions.fetchResourceData(1);
    });
  };

  const unsubscribe = store.subscribe(render);

  render(store.getState());
}
 La porcion de codigo va en otro archivo independiente.
*/