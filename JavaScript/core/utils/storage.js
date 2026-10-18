export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: 'guateganado_token',
  AUTH_USER: 'guateganado_user',
  API_BASE_URL: 'guateganado_api_base_url',
  ANIMAL_FORM_DRAFT: 'draft_registro_animal',
  POST_LOGIN_REDIRECT: 'guateganado_post_login_redirect',
});

const getWebStorage = (type) => {
  try {
    if (typeof window !== 'undefined' && window[type]) {
      return window[type];
    }
  } catch {
    
  }
  return null;
};

const memoryFallback = new Map();

export const getStorageItem = (key, defaultValue = null) => {
  const store = getWebStorage('localStorage');
  const raw = store ? store.getItem(key) : (memoryFallback.get(`local:${key}`) ?? null);

  if (raw === null || raw === undefined) {
    return defaultValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const setStorageItem = (key, value) => {
  if (value === undefined || value === null) {
    removeStorageItem(key);
    return;
  }

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const store = getWebStorage('localStorage');

  if (store) {
    store.setItem(key, serialized);
  } else {
    memoryFallback.set(`local:${key}`, serialized);
  }
};

export const removeStorageItem = (key) => {
  const store = getWebStorage('localStorage');
  if (store) {
    store.removeItem(key);
  }
  memoryFallback.delete(`local:${key}`);
};

export const getSessionItem = (key, defaultValue = null) => {
  const store = getWebStorage('sessionStorage');
  const raw = store ? store.getItem(key) : (memoryFallback.get(`session:${key}`) ?? null);

  if (raw === null || raw === undefined) {
    return defaultValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const setSessionItem = (key, value) => {
  if (value === undefined || value === null) {
    removeSessionItem(key);
    return;
  }

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const store = getWebStorage('sessionStorage');

  if (store) {
    store.setItem(key, serialized);
  } else {
    memoryFallback.set(`session:${key}`, serialized);
  }
};

export const removeSessionItem = (key) => {
  const store = getWebStorage('sessionStorage');
  if (store) {
    store.removeItem(key);
  }
  memoryFallback.delete(`session:${key}`);
};
