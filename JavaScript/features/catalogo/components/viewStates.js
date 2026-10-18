/**
 * Adaptador de Estados Visuales para el Catalogo de Animales (Laboratorio 9 - Rol 3)
 * Re-exporta la implementacion global de core/utils/viewStates.js garantizando:
 * - Cero duplicacion de codigo en el repositorio
 * - Compatibilidad total con la ruta asignada en la rubrica (features/catalogo/components/viewStates.js)
 */
export {
  renderLoadingSkeleton,
  renderEmptyState,
  renderErrorState
} from '../../../core/utils/viewStates.js';