/**
 * Recuperación de borrador ante expiración de sesión (Laboratorio 9 - Rol 6)
 *
 * Flujo:
 * 1. El usuario llena registro-animal.html.
 * 2. Una petición recibe 401 -> el ApiClient notifica a onUnauthorized().
 * 3. Este módulo serializa el formulario en sessionStorage ("draft_registro_animal").
 * 4. authSession.js redirige a login.html y guarda la página de regreso.
 * 5. Tras iniciar sesión se vuelve aquí y los campos se restauran solos.
 */
import { apiClient } from '../../core/api/ApiClient.js';
import {
  STORAGE_KEYS,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
} from '../../core/utils/storage.js';

const DRAFT_KEY = STORAGE_KEYS.ANIMAL_FORM_DRAFT;
const IGNORED_TYPES = new Set(['password', 'file', 'submit', 'button', 'reset']);
const initializedForms = new WeakSet();

const currentPage = () => `${window.location.pathname.split('/').pop()}${window.location.search}`;

/** Convierte el formulario en un objeto plano { campo: valor | [valores] }. */
export function serializeForm(form) {
  const fields = {};

  Array.from(form.elements).forEach((element) => {
    const { name, type } = element;
    if (!name || element.disabled || IGNORED_TYPES.has(type)) return;

    if (type === 'checkbox') {
      fields[name] = fields[name] ?? [];
      if (element.checked) fields[name].push(element.value);
      return;
    }

    if (type === 'radio') {
      if (element.checked) fields[name] = element.value;
      return;
    }

    if (element.multiple) {
      fields[name] = Array.from(element.selectedOptions, (option) => option.value);
      return;
    }

    fields[name] = element.value;
  });

  return fields;
}

/** Guarda el estado actual del formulario. Devuelve true si había algo que guardar. */
export function saveDraft(form) {
  const fields = serializeForm(form);
  const hasContent = Object.values(fields).some((value) =>
    Array.isArray(value) ? value.length > 0 : String(value).trim() !== ''
  );

  if (!hasContent) return false;

  setSessionItem(DRAFT_KEY, {
    page: currentPage(),
    savedAt: new Date().toISOString(),
    fields,
  });
  return true;
}

/** Elimina el borrador (llamar tras guardar con éxito o al descartarlo). */
export function clearDraft() {
  removeSessionItem(DRAFT_KEY);
}

/** Lee el borrador solo si pertenece a esta misma página (mismo ?id=...). */
export function getDraft() {
  const draft = getSessionItem(DRAFT_KEY, null);
  if (!draft || typeof draft !== 'object' || !draft.fields) return null;
  return draft.page === currentPage() ? draft : null;
}

/** Asigna un valor a un <select>; si su <option> aún no existe, espera a que se cargue. */
function setSelectValue(select, value) {
  const apply = () => {
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    const options = Array.from(select.options);
    if (!values.every((v) => v === '' || options.some((option) => option.value === v))) {
      return false;
    }
    options.forEach((option) => {
      option.selected = values.includes(option.value);
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  if (apply()) return;

  // Opciones cargadas de forma asíncrona (razas, potreros...): esperar hasta 10 s.
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(select, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10_000);
}

/** Restaura los campos del borrador en el formulario. Devuelve el borrador aplicado o null. */
export function restoreDraft(form) {
  const draft = getDraft();
  if (!draft) return null;

  Object.entries(draft.fields).forEach(([name, value]) => {
    const elements = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);

    elements.forEach((element) => {
      if (element.type === 'checkbox') {
        element.checked = Array.isArray(value) && value.includes(element.value);
      } else if (element.type === 'radio') {
        element.checked = element.value === value;
      } else if (element.tagName === 'SELECT') {
        setSelectValue(element, value);
      } else {
        element.value = value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

  return draft;
}

/** Aviso accesible arriba del formulario con opción de descartar el borrador. */
function showRestoredNotice(form, draft) {
  const hora = new Date(draft.savedAt).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  const notice = document.createElement('div');
  notice.className = 'form-alert form-alert--success';
  notice.setAttribute('role', 'status');
  notice.innerHTML = `
    <span>Se recuperaron los datos que estaba llenando (guardados a las ${hora}) antes de que expirara su sesión.</span>
    <button type="button" class="btn btn-secondary btn-sm">Descartar borrador</button>
  `;

  notice.querySelector('button').addEventListener('click', () => {
    clearDraft();
    form.reset();
    notice.remove();
  });

  form.before(notice);
}

/**
 * Activa la protección de borrador en un formulario.
 * @param {HTMLFormElement} form
 * @returns {() => void} Función para desactivar la protección.
 */
export function initDraftRecovery(form) {
  if (!(form instanceof HTMLFormElement) || initializedForms.has(form)) return () => {};
  initializedForms.add(form);

  const draft = restoreDraft(form);
  if (draft) showRestoredNotice(form, draft);

  // Se ejecuta antes de que authSession.js navegue a login.html (la navegación es asíncrona).
  const unsubscribe = apiClient.onUnauthorized(() => {
    saveDraft(form);
  });

  return () => {
    unsubscribe();
    initializedForms.delete(form);
  };
}

// Arranque automático en registro-animal.html.
const formulario = document.querySelector('form.animal-form');
if (formulario) initDraftRecovery(formulario);
