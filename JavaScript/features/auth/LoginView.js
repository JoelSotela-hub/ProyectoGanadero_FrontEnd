/**
 * Vista de Inicio de Sesión (Laboratorio 9 - Rol 6)
 * - Envía las credenciales con async/await al ApiClient.
 * - Muestra errores 401 / 422 / 429 / red sin recargar la página.
 * - Si el usuario llegó por un token expirado, se lo explica y, al entrar,
 *   lo devuelve a la página donde estaba (ej. el formulario con su borrador).
 */
import { login, consumePostLoginRedirect } from './authSession.js';
import { ApiClient } from '../../core/api/ApiClient.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

/** Mensajes específicos para cada tipo de error del formulario. */
const MENSAJES_VALIDACION = {
  camposVacios: 'Ingrese su correo electrónico y su contraseña.',
  emailVacio: 'El correo electrónico es obligatorio.',
  emailInvalido: 'El correo electrónico no es válido. Ejemplo: nombre@dominio.com',
  passwordVacia: 'La contraseña es obligatoria.',
  passwordCorta: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
};

const MENSAJES_MOTIVO = {
  expired: 'Su sesión expiró. Inicie sesión de nuevo; los datos que estaba llenando se conservaron.',
  required: 'Debe iniciar sesión para acceder al sistema.',
};

export class LoginView {
  #form;
  #emailInput;
  #passwordInput;
  #submitBtn;
  #alertBox;
  #controller = null;

  constructor(formSelector = '#login-form') {
    this.#form = document.querySelector(formSelector);
    this.#emailInput = this.#form?.querySelector('#email');
    this.#passwordInput = this.#form?.querySelector('#password');
    this.#submitBtn = this.#form?.querySelector('button[type="submit"]');
    this.#alertBox = document.querySelector('#login-alert');
  }

  init() {
    if (!this.#form) {
      console.warn('[LoginView] No se encontró el formulario de login.');
      return;
    }

    const motivo = new URLSearchParams(window.location.search).get('motivo');
    if (MENSAJES_MOTIVO[motivo]) {
      this.#showAlert(MENSAJES_MOTIVO[motivo], motivo === 'expired' ? 'warning' : 'info');
    }

    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#handleSubmit();
    });

    this.#setupPasswordToggle();
  }

  /** Botón del ojo: alterna entre mostrar y ocultar la contraseña. */
  #setupPasswordToggle() {
    const toggle = this.#form.querySelector('#toggle-password');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const mostrar = this.#passwordInput.type === 'password';
      this.#passwordInput.type = mostrar ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(mostrar));
      toggle.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  async #handleSubmit() {
    this.#clearErrors();

    // Cancela un intento anterior que siga en vuelo (doble clic, Enter repetido).
    this.#controller?.abort();
    this.#controller = new AbortController();

    const credentials = {
      email: this.#emailInput.value.trim(),
      password: this.#passwordInput.value,
    };

    // Validación local: cada caso (vacíos, correo, contraseña) tiene su propio mensaje.
    if (!this.#validateCredentials(credentials)) return;

    this.#setLoading(true);

    try {
      await login(credentials, { signal: this.#controller.signal });
      window.location.assign(consumePostLoginRedirect());
    } catch (error) {
      if (ApiClient.isAbortError(error)) return;
      this.#renderError(error);
    } finally {
      this.#setLoading(false);
    }
  }

  /**
   * Valida los campos antes de enviarlos y muestra un mensaje distinto para cada caso.
   * @returns {boolean} true si los datos se pueden enviar.
   */
  #validateCredentials({ email, password }) {
    if (!email && !password) {
      this.#setFieldError('email', MENSAJES_VALIDACION.emailVacio);
      this.#setFieldError('password', MENSAJES_VALIDACION.passwordVacia);
      this.#showAlert(MENSAJES_VALIDACION.camposVacios, 'error');
      this.#emailInput.focus();
      return false;
    }

    const errores = {};
    if (!email) errores.email = MENSAJES_VALIDACION.emailVacio;
    else if (!EMAIL_REGEX.test(email)) errores.email = MENSAJES_VALIDACION.emailInvalido;

    if (!password) errores.password = MENSAJES_VALIDACION.passwordVacia;
    else if (password.length < PASSWORD_MIN_LENGTH) errores.password = MENSAJES_VALIDACION.passwordCorta;

    const campos = Object.keys(errores);
    if (campos.length === 0) return true;

    campos.forEach((campo) => this.#setFieldError(campo, errores[campo]));
    this.#showAlert(Object.values(errores).join(' '), 'error');
    (errores.email ? this.#emailInput : this.#passwordInput).focus();
    return false;
  }

  #renderError(error) {
    if (error?.isValidationError?.()) {
      // El backend responde 422 con un mensaje genérico ("Los datos enviados no son válidos.");
      // se muestran en su lugar los mensajes específicos de cada campo.
      const fieldErrors = error.getFieldErrors?.() ?? {};
      const mensajes = [];
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        const mensaje = Array.isArray(messages) ? messages[0] : messages;
        this.#setFieldError(field, mensaje);
        if (mensaje) mensajes.push(mensaje);
      });
      this.#showAlert(mensajes.join(' ') || error.mensaje || 'Revise los datos ingresados.', 'error');
      return;
    }

    if (error?.status === 401) {
      this.#showAlert('Correo o contraseña incorrectos.', 'error');
      this.#passwordInput.select();
      return;
    }

    if (error?.status === 429) {
      this.#showAlert('Demasiados intentos fallidos. Espere un minuto e intente de nuevo.', 'error');
      return;
    }

    this.#showAlert(error?.mensaje || error?.message || 'No fue posible iniciar sesión.', 'error');
  }

  #setFieldError(field, message) {
    const input = this.#form.querySelector(`#${field}`);
    const help = this.#form.querySelector(`#error-${field}`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (help) {
      help.textContent = message;
      help.hidden = false;
    }
  }

  #clearErrors() {
    this.#form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.#form.querySelectorAll('.field-error').forEach((el) => {
      el.textContent = '';
      el.hidden = true;
    });
    this.#hideAlert();
  }

  #setLoading(isLoading) {
    this.#form.setAttribute('aria-busy', String(isLoading));
    if (this.#submitBtn) {
      this.#submitBtn.disabled = isLoading;
      this.#submitBtn.textContent = isLoading ? 'Verificando…' : 'Ingresar al Sistema';
    }
  }

  #showAlert(message, type = 'info') {
    if (!this.#alertBox) return;
    this.#alertBox.textContent = message;
    this.#alertBox.className = `form-alert form-alert--${type}`;
    this.#alertBox.setAttribute('role', type === 'error' ? 'alert' : 'status');
    this.#alertBox.hidden = false;
  }

  #hideAlert() {
    if (!this.#alertBox) return;
    this.#alertBox.hidden = true;
    this.#alertBox.textContent = '';
  }
}

new LoginView().init();
