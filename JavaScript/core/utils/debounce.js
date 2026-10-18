/**
 * Función de orden superior para retrasar la ejecución de otra función.
 * Optimiza el rendimiento evitando llamadas excesivas a la API mientras el usuario teclea.
 * 
 * @param {Function} func - La función que queremos retrasar (ej. la llamada a la API)
 * @param {number} delay - El tiempo en milisegundos a esperar (por defecto 300ms)
 * @returns {Function} - Una nueva función que maneja el temporizador
 */
export function debounce(func, delay = 300) {
  let timeoutId; // Guardará el ID del temporizador activo

  return function (...args) {
    // Si el usuario vuelve a escribir, cancelamos el temporizador anterior
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Iniciamos un nuevo temporizador
    // La función 'func' solo se ejecutará si pasan 'delay' milisegundos sin que se cancele
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}