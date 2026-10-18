/**
 * Componente nativo de Tarjeta de Ganado (Laboratorio 9 - Rol 3)
 * Soporta:
 * - Fotos capturadas por camara movil (Capacitor/Ionic) o placeholder SVG si aun no tiene foto
 * - Telemetria y monitoreo por arete GPS en tiempo real
 * - Modulos ESM puros y programacion defensiva
 * 
 * @param {Object} animal - Objeto devuelto por Laravel API
 * @returns {string} HTML semantico de la tarjeta
 */
export function AnimalCard(animal = {}) {
  const {
    id = '',
    id_animal = '',
    numero_arete = 'S/A',
    peso_kg = 0,
    sexo = 'Hembra',
    raza = {},
    potrero = {},
    estado = 'Activo',
    fecha_nacimiento = 'N/D',
    foto_url = null,
    // Telemetria del tag GPS en el arete
    gps_activo = true,
    alerta_escape = false,
    latitud = null,
    longitud = null
  } = animal;

  const animalId = id || id_animal || '';
  const nombreRaza = typeof raza === 'object' && raza !== null ? (raza.nombre || 'Bovino') : (raza || 'Bovino');
  const nombrePotrero = typeof potrero === 'object' && potrero !== null ? (potrero.nombre || 'Sin Asignar') : (potrero || 'Sin Asignar');
  
  const esMacho = String(sexo).toLowerCase() === 'macho';
  const badgeSexo = esMacho ? 'badge-primary' : 'badge-accent';

  // Badge de telemetria GPS
  const gpsBadge = alerta_escape 
    ? `<span class="badge badge-danger badge-pulse" title="Alerta: Animal fuera del perimetro del potrero">🚨 Fuera de Potrero</span>`
    : gps_activo
      ? `<span class="badge badge-gps" title="Senal GPS activa en tiempo real">📡 GPS Activo</span>`
      : `<span class="badge badge-muted" title="Sin senal GPS reciente">📡 Sin Senal</span>`;

  // Renderizado de foto real vs placeholder de camara
  const visualContent = foto_url
    ? `<img 
         src="${foto_url}" 
         alt="Vaca ${numero_arete} (${nombreRaza}) en ${nombrePotrero}" 
         class="card-animal-img"
         loading="lazy"
         decoding="async">`
    : `<div class="card-animal-placeholder" role="img" aria-label="Sin fotografia registrada">
         <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
           <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
         </svg>
         <span class="placeholder-text">Foto pendiente (Camara movil)</span>
       </div>`;

  return `
    <article class="card-animal ${alerta_escape ? 'card-animal--alerta' : ''}" data-id="${animalId}" data-arete="${numero_arete}">
      <header class="card-animal-header">
        <div class="header-tags">
          <span class="animal-id">Arete: <strong>${numero_arete}</strong></span>
          ${gpsBadge}
        </div>
        <span class="badge ${badgeSexo}">${sexo}</span>
      </header>
      
      <figure class="card-animal-figure">
        ${visualContent}
        <figcaption class="visually-hidden">Animal ${numero_arete} (${nombreRaza})</figcaption>
      </figure>

      <div class="card-animal-body">
        <h3 class="animal-name">${nombreRaza} (${sexo})</h3>
        
        <dl class="animal-specs">
          <div class="spec-row">
            <dt class="spec-term">Potrero actual:</dt>
            <dd class="spec-desc"><strong>${nombrePotrero}</strong></dd>
          </div>
          <div class="spec-row">
            <dt class="spec-term">Ultimo pesaje:</dt>
            <dd class="spec-desc"><data value="${peso_kg}"><strong>${peso_kg} kg</strong></data></dd>
          </div>
          <div class="spec-row">
            <dt class="spec-term">Fecha nacimiento:</dt>
            <dd class="spec-desc"><time datetime="${fecha_nacimiento}">${fecha_nacimiento}</time></dd>
          </div>
          <div class="spec-row">
            <dt class="spec-term">Estado:</dt>
            <dd class="spec-desc">${estado}</dd>
          </div>
        </dl>
      </div>

      <footer class="card-animal-footer">
        <button 
          type="button" 
          class="btn btn-secondary btn-sm btn-localizar" 
          data-lat="${latitud || ''}" 
          data-lng="${longitud || ''}"
          data-arete="${numero_arete}"
          title="Consultar coordenadas GPS del arete">
          📍 Localizar
        </button>
        <a href="registro-animal.html?id=${animalId}" class="btn btn-accent btn-sm" aria-label="Actualizar animal ${numero_arete}">
          Ficha / Editar
        </a>
      </footer>
    </article>
  `;
}