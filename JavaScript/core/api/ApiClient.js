import { DEFAULT_API_BASE_URL, ENDPOINTS, withQueryParams } from './endpoints.js';
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from '../utils/storage.js';

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';


export const HTTP_STATUS = Object.freeze({
  NETWORK_ERROR: 0,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
});


const createDefaultTokenAdapter = (tokenKey) => ({
  get: () => getStorageItem(tokenKey, null),
  set: (token) => setStorageItem(tokenKey, token),
  clear: () => removeStorageItem(tokenKey),
});


export class ApiException extends Error {
  
  constructor({
    status,
    message,
    errorType = 'Error de API',
    errors = {},
    data = null,
    endpoint = '',
    method = 'GET',
    cause = undefined,
  }) {
    super(message, cause !== undefined ? { cause } : undefined);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'ApiException';
    this.status = status;
    this.error = errorType;
    this.errorType = errorType;
    this.mensaje = message;

    
    const normalizedFieldErrors = ApiException.#normalizeFieldErrors(errors);
    this.errors = normalizedFieldErrors;
    this.errores = normalizedFieldErrors;

    this.data = data
      ? {
          ...data,
          error: data.error ?? errorType,
          mensaje: data.mensaje ?? data.message ?? message,
          errors: normalizedFieldErrors,
          errores: normalizedFieldErrors,
        }
      : {
          error: errorType,
          mensaje: message,
          errors: normalizedFieldErrors,
          errores: normalizedFieldErrors,
        };

    this.endpoint = endpoint;
    this.method = method;
    this.timestamp = new Date().toISOString();
  }

  static #normalizeFieldErrors(rawErrors) {
    const formatted = {};

    if (rawErrors && typeof rawErrors === 'object') {
      Object.entries(rawErrors).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          formatted[field] = messages.map(String);
        } else if (typeof messages === 'string' && messages.trim() !== '') {
          formatted[field] = [messages];
        }
      });
    }

    return formatted;
  }

  isUnauthorized() {
    return this.status === HTTP_STATUS.UNAUTHORIZED;
  }

  isForbidden() {
    return this.status === HTTP_STATUS.FORBIDDEN;
  }

  isNotFound() {
    return this.status === HTTP_STATUS.NOT_FOUND;
  }

  isBusinessRuleError() {
    return this.status === HTTP_STATUS.CONFLICT;
  }

  isValidationError() {
    return (
      this.status === HTTP_STATUS.UNPROCESSABLE_ENTITY ||
      Object.keys(this.errors).length > 0
    );
  }

  isNetworkError() {
    return this.status === HTTP_STATUS.NETWORK_ERROR;
  }

  getFieldErrors() {
    return { ...this.errors };
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      errorType: this.errorType,
      message: this.message,
      errors: this.errors,
      endpoint: this.endpoint,
      method: this.method,
      timestamp: this.timestamp,
    };
  }
}


export class ApiClient {
  #baseUrl;

  #tokenKey;

  #defaultHeaders;

  #unauthorizedHandlers;

  #tokenAdapter;

  #httpClient;

  #eventTarget;

  constructor({
    baseUrl = getStorageItem(STORAGE_KEYS.API_BASE_URL) || DEFAULT_API_BASE_URL,
    tokenKey = STORAGE_KEYS.AUTH_TOKEN,
    defaultHeaders = {},
    tokenAdapter = undefined,
    httpClient = undefined,
    eventTarget = typeof window !== 'undefined' ? window : null,
  } = {}) {
    this.#baseUrl = ApiClient.#sanitizeBaseUrl(baseUrl);
    this.#tokenKey = tokenKey;
    this.#tokenAdapter = tokenAdapter ?? createDefaultTokenAdapter(this.#tokenKey);
    this.#httpClient = httpClient ?? ((...args) => globalThis.fetch(...args));
    this.#eventTarget = eventTarget;
    this.#defaultHeaders = Object.freeze({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...defaultHeaders,
    });
    this.#unauthorizedHandlers = new Set();
  }


  static #sanitizeBaseUrl(url) {
    return String(url || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
  }


  static isAbortError(error) {
    return Boolean(
      error &&
        typeof error === 'object' &&
        (error.name === 'AbortError' || error.code === 20)
    );
  }


  #getToken() {
    const token = this.#tokenAdapter.get();
    return typeof token === 'string' && token.trim() !== '' ? token.trim() : null;
  }


  #buildHeaders(customHeaders = {}, hasBody = true) {
    const headers = {
      ...this.#defaultHeaders,
      ...customHeaders,
    };

    if (!hasBody) {
      delete headers['Content-Type'];
    }

    const token = this.#getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  #buildUrl(endpoint, params) {
    const endpointWithQuery = params ? withQueryParams(endpoint, params) : endpoint;

    if (/^https?:\/\//i.test(endpointWithQuery)) {
      return endpointWithQuery;
    }

    const normalizedPath = endpointWithQuery.startsWith('/')
      ? endpointWithQuery
      : `/${endpointWithQuery}`;

    return `${this.#baseUrl}${normalizedPath}`;
  }


  async #parseResponseBody(response) {
    if (response.status === HTTP_STATUS.NO_CONTENT) {
      return null;
    }

    const rawText = await response.text();
    if (!rawText || rawText.trim() === '') {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return {
        error: 'Respuesta no JSON',
        mensaje: rawText,
      };
    }
  }

  #notifyUnauthorized(detail) {
    this.clearToken();

    this.#unauthorizedHandlers.forEach((handler) => {
      try {
        handler(detail);
      } catch (listenerError) {
        console.error('[ApiClient] Error en suscriptor de onUnauthorized:', listenerError);
      }
    });

    if (this.#eventTarget && typeof this.#eventTarget.dispatchEvent === 'function') {
      this.#eventTarget.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
          detail,
        })
      );
    }
  }


  async #request(method, endpoint, options = {}) {
    const {
      body = undefined,
      params = undefined,
      headers: customHeaders = {},
      signal = undefined,
      skipUnauthorizedHook = false,
    } = options;

    const hasBody = body !== undefined && body !== null && method !== 'GET';
    const url = this.#buildUrl(endpoint, params);
    const headers = this.#buildHeaders(customHeaders, hasBody);

    const fetchOptions = {
      method,
      headers,
      signal,
    };

    if (hasBody) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await this.#httpClient(url, fetchOptions);
    } catch (networkOrAbortError) {
      if (ApiClient.isAbortError(networkOrAbortError)) {
        throw networkOrAbortError;
      }

      throw new ApiException({
        status: HTTP_STATUS.NETWORK_ERROR,
        errorType: 'Error de Red',
        message:
          'No se pudo conectar con el servidor de GuateGanado. Verifique que el backend de Laravel esté en ejecución.',
        endpoint,
        method,
        cause: networkOrAbortError,
      });
    }

    const data = await this.#parseResponseBody(response);

    if (!response.ok) {
      const errorType = data?.error || `HTTP ${response.status}`;
      const message =
        data?.mensaje ||
        data?.message ||
        'Ocurrió un error al procesar la solicitud en el servidor.';
      const rawFieldErrors = data?.errors || data?.errores || {};

      const apiException = new ApiException({
        status: response.status,
        errorType,
        message,
        errors: rawFieldErrors,
        data,
        endpoint,
        method,
      });

      const isLoginAttempt = endpoint.includes(ENDPOINTS.AUTH.LOGIN);
      if (
        response.status === HTTP_STATUS.UNAUTHORIZED &&
        !isLoginAttempt &&
        !skipUnauthorizedHook
      ) {
        this.#notifyUnauthorized({
          status: HTTP_STATUS.UNAUTHORIZED,
          message,
          endpoint,
          method,
          exception: apiException,
        });
      }

      throw apiException;
    }

    return data;
  }

  async get(endpoint, options = {}) {
    return await this.#request('GET', endpoint, options);
  }

  async post(endpoint, body = {}, options = {}) {
    return await this.#request('POST', endpoint, { ...options, body });
  }


  async put(endpoint, body = {}, options = {}) {
    return await this.#request('PUT', endpoint, { ...options, body });
  }


  async patch(endpoint, body = {}, options = {}) {
    return await this.#request('PATCH', endpoint, { ...options, body });
  }


  async delete(endpoint, options = {}) {
    return await this.#request('DELETE', endpoint, options);
  }


  setToken(token) {
    if (typeof token === 'string' && token.trim() !== '') {
      this.#tokenAdapter.set(token.trim());
    }
  }


  getToken() {
    return this.#getToken();
  }


  clearToken() {
    this.#tokenAdapter.clear();
  }

  hasToken() {
    return Boolean(this.#getToken());
  }

  getBaseUrl() {
    return this.#baseUrl;
  }

  setBaseUrl(newBaseUrl) {
    this.#baseUrl = ApiClient.#sanitizeBaseUrl(newBaseUrl);
    setStorageItem(STORAGE_KEYS.API_BASE_URL, this.#baseUrl);
  }


  onUnauthorized(callback) {
    if (typeof callback === 'function') {
      this.#unauthorizedHandlers.add(callback);
    }
    return () => {
      this.#unauthorizedHandlers.delete(callback);
    };
  }
}


export const apiClient = new ApiClient();
