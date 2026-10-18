// Gestor de estado reactivo singleton (State-driven UI)

class Store {
    #state;
    #listeners;

    constructor(initialState = {}) {
    this.#state = Object.freeze(initialState);
    this.#listeners = new Set();
    }

    getState() {
    return structuredClone(this.#state);
    }

    // @param {Object|Function} partialState - Nuevos datos o funcion basada en el estado previo

    setState(partialState) {
        const currentState = this.getState();
        const nextState = typeof partialState === 'function' ? partialState(currentState): partialState;

        this.#state = Object.freeze({
            ...currentState,
            ...nextState
        });

        this.#notify();
    }

    /*
    Suscribe una vista u observador a los cambios de estado.
    @param {Function} listener - Callback que se ejecuta ante cada cambio.
    @returns {Function} - Función para desuscribirse.
    */

    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('El listner debe ser una funcion valida.');
        }

        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    }

    #notify(){
        const currentState = this.getState();
        this.#listeners.forEach(listener => listener(currentState));
    }
}

export const store = new Store();






