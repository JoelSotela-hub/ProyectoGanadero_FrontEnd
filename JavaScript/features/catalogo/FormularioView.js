import { displayFormErrors, clearFormErrors } from '../../formValidator.js';

export class FormularioView {
    constructor() {
        this.form = document.querySelector('#form-animal') || document.forms[0];
        this.urlParams = new URLSearchParams(window.location.search);
        this.animalId = this.urlParams.get('id');
        this.isEditMode = Boolean(this.animalId);
    }

    async init() {
        if (!this.form) return;

        // Edición: Si existe el parámetro ?id=..., precargar los datos del animal
        if (this.isEditMode) {
            await this.cargarDatosEdicion(this.animalId);
        }

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async cargarDatosEdicion(id) {
        try {
            const response = await fetch(`/api/v1/animales/${id}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error('No se pudo obtener la información del animal.');

            const animal = await response.json();
            this.poblarFormulario(animal);
        } catch (error) {
            console.error('Error al precargar datos:', error);
        }
    }

    poblarFormulario(data) {
        Object.keys(data).forEach(key => {
            const field = this.form.querySelector(`[name="${key}"]`);
            if (field) field.value = data[key];
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        clearFormErrors(this.form);

        const formData = new FormData(this.form);
        const payload = Object.fromEntries(formData.entries());

        // Operaciones CRUD asíncronas: POST para crear, PUT para editar con ID
        const url = this.isEditMode ? `/api/v1/animales/${this.animalId}` : '/api/v1/animales';
        const method = this.isEditMode ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Mapeo de errores de validación (HTTP 422) de StoreAnimalRequest
            if (response.status === 422) {
                displayFormErrors(this.form, data.errores);
                return;
            }

            if (!response.ok) throw new Error(data.message || 'Error al procesar la solicitud.');

            // Sincronización y Redirección al catálogo
            this.onSuccess(data);

        } catch (error) {
            console.error('Error en la transacción:', error);
        }
    }

    onSuccess(resultado) {
        // Actualiza tu tienda global si la usas (ej: window.store?.agregarAnimal(resultado));
        
        // Redirige al catálogo mostrando el nuevo registro
        window.location.href = '../HTML/animales.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const view = new FormularioView();
    view.init();
});