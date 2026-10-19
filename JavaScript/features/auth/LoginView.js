/**
 * Vista de Inicio de Sesión (Laboratorio 9 - Rol 6)
 * - Envía las credenciales con async/await al ApiClient.
 * - Muestra errores 401 / 422 / 429 / red sin recargar la página.
 * - Si el usuario llegó por un token expirado, se lo explica y, al entrar,
 *   lo devuelve a la página donde estaba (ej. el formulario con su borrador).
 */
import { login, consumePostLoginRedirect } from './authSession.js';
import { ApiClient } from '../../core/api/ApiClient.js';

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

  #renderError(error) {
    if (error?.isValidationError?.()) {
      const fieldErrors = error.getFieldErrors();
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        this.#setFieldError(field, messages[0]);
      });
      this.#showAlert(error.mensaje || 'Revise los datos ingresados.', 'error');
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
