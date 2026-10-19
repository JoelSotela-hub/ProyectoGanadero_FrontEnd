/**
 * Vista del Formulario de Animales (Laboratorio 9 - Rol 5)
 * - Creación (POST /animales) y edición (?id=... -> GET + PUT /animales/{id}).
 * - Pesaje inicial: tras crear el animal se registra en POST /animales/{id}/pesajes.
 * - Errores 422 de Laravel mapeados campo por campo (formValidator.js).
 * - Todas las peticiones pasan por el ApiClient: llevan el Bearer Token y, si la
 *   sesión expiró (401), draftRecovery.js guarda el borrador antes de ir al login.
 */
import { apiClient, ApiClient } from '../../core/api/ApiClient.js';
import { ENDPOINTS } from '../../core/api/endpoints.js';
import { displayFormErrors, clearFormErrors } from '../../core/utils/formValidator.js';
import { clearDraft, getDraft } from '../formulario/draftRecovery.js';

/** Condición sanitaria del formulario -> campo "estado" del animal en el backend. */
const ESTADO_POR_SALUD = Object.freeze({
  Saludable: 'Activo',
  Tratamiento: 'Enfermo',
  Cuarentena: 'Enfermo',
});

/** Campos que acepta StoreAnimalRequest / UpdateAnimalRequest. */
const CAMPOS_ANIMAL = ['numero_arete', 'raza_id', 'sexo', 'fecha_nacimiento', 'potrero_id'];

export class FormularioView {
  constructor() {
    this.form = document.querySelector('#form-animal') || document.forms[0];
    this.submitBtn = this.form?.querySelector('button[type="submit"]') ?? null;
    this.urlParams = new URLSearchParams(window.location.search);
    this.animalId = this.urlParams.get('id');
    this.isEditMode = Boolean(this.animalId);
    this.alertBox = null;
    this.textoBoton = this.submitBtn?.textContent.trim() ?? 'Guardar';
  }

  async init() {
    if (!this.form) return;

    this.alertBox = this.crearAlerta();

    // Edición: si existe ?id=..., precargar los datos del animal
    // (salvo que haya un borrador recuperado tras un 401: ese es más reciente).
    if (this.isEditMode && !getDraft()) {
      await this.cargarDatosEdicion(this.animalId);
    }

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async cargarDatosEdicion(id) {
    try {
      const response = await apiClient.get(ENDPOINTS.ANIMALES.BY_ID(id));
      this.poblarFormulario(response?.data ?? {});
    } catch (error) {
      if (error?.status === 401) return; // authSession redirige al login
      this.mostrarAlerta(error?.mensaje || 'No se pudo obtener la información del animal.', 'error');
    }
  }

  poblarFormulario(animal) {
    CAMPOS_ANIMAL.forEach((campo) => {
      const field = this.form.querySelector(`[name="${campo}"]`);
      if (field && animal[campo] !== undefined && animal[campo] !== null) {
        field.value = animal[campo];
      }
    });

    const salud = Object.keys(ESTADO_POR_SALUD).find((k) => ESTADO_POR_SALUD[k] === animal.estado);
    const selectSalud = this.form.querySelector('[name="estado_salud"]');
    if (selectSalud && salud) selectSalud.value = salud;
  }

  construirPayload() {
    const datos = Object.fromEntries(new FormData(this.form).entries());
    const payload = {};

    CAMPOS_ANIMAL.forEach((campo) => {
      const valor = typeof datos[campo] === 'string' ? datos[campo].trim() : datos[campo];
      if (valor !== undefined && valor !== '') payload[campo] = valor;
    });

    if (payload.raza_id) payload.raza_id = Number(payload.raza_id);
    if (payload.potrero_id) payload.potrero_id = Number(payload.potrero_id);
    if (ESTADO_POR_SALUD[datos.estado_salud]) payload.estado = ESTADO_POR_SALUD[datos.estado_salud];

    return { payload, datos };
  }

  async handleSubmit(event) {
    event.preventDefault();
    clearFormErrors(this.form);
    this.ocultarAlerta();

    const { payload, datos } = this.construirPayload();
    this.setLoading(true);

    try {
      // Operaciones CRUD asíncronas: POST para crear, PUT para editar con ID
      const response = this.isEditMode
        ? await apiClient.put(ENDPOINTS.ANIMALES.BY_ID(this.animalId), payload)
        : await apiClient.post(ENDPOINTS.ANIMALES.BASE, payload);

      const animal = response?.data ?? {};

      if (!this.isEditMode && datos.peso_inicial) {
        await this.registrarPesajeInicial(animal.id_animal, datos);
      }

      this.onSuccess(animal);
    } catch (error) {
      if (ApiClient.isAbortError(error)) return;
      this.manejarError(error);
    } finally {
      this.setLoading(false);
    }
  }

  /** El pesaje inicial es un recurso aparte: POST /animales/{id}/pesajes. */
  async registrarPesajeInicial(animalId, datos) {
    if (!animalId) return;
    try {
      await apiClient.post(ENDPOINTS.ANIMALES.PESAJES(animalId), {
        peso_kg: Number(datos.peso_inicial),
        fecha_pesaje: new Date().toLocaleDateString('en-CA'), // AAAA-MM-DD en hora local
        observaciones: datos.observaciones?.trim() || null,
      });
    } catch (error) {
      // El animal ya quedó guardado; solo se avisa que faltó el pesaje.
      console.warn('[FormularioView] El animal se guardó, pero el pesaje inicial falló:', error);
    }
  }

  manejarError(error) {
    // 401: el ApiClient ya notificó; draftRecovery guardó el borrador y authSession redirige.
    if (error?.status === 401) return;

    // 422: mapeo de errores de validación de StoreAnimalRequest campo por campo
    if (error?.isValidationError?.()) {
      const errores = error.getFieldErrors();
      displayFormErrors(this.form, errores);
      this.mostrarAlerta('Revise los campos marcados en rojo.', 'error');
      this.form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    // 409: regla de negocio (p. ej. potrero sin capacidad)
    if (error?.status === 409) {
      this.mostrarAlerta(error.mensaje, 'warning');
      return;
    }

    this.mostrarAlerta(error?.mensaje || error?.message || 'Error al procesar la solicitud.', 'error');
  }

  onSuccess() {
    clearDraft();
    // Redirige al catálogo, donde aparece el nuevo registro
    window.location.assign('animales.html');
  }

  crearAlerta() {
    const alerta = document.createElement('div');
    alerta.className = 'form-alert';
    alerta.hidden = true;
    this.form.before(alerta);
    return alerta;
  }

  mostrarAlerta(mensaje, tipo = 'error') {
    if (!this.alertBox) return;
    this.alertBox.textContent = mensaje;
    this.alertBox.className = `form-alert form-alert--${tipo}`;
    this.alertBox.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    this.alertBox.hidden = false;
    this.alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ocultarAlerta() {
    if (this.alertBox) this.alertBox.hidden = true;
  }

  setLoading(isLoading) {
    this.form.setAttribute('aria-busy', String(isLoading));
    if (!this.submitBtn) return;
    this.submitBtn.disabled = isLoading;
    this.submitBtn.textContent = isLoading ? 'Guardando…' : this.textoBoton;
  }
}

// Los módulos ESM se ejecutan cuando el DOM ya está listo (main.js los importa).
new FormularioView().init();
