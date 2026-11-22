<template>
  <ion-page>
    <app-header titulo="Tratamientos" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Sanidad animal</p>
            <h1 class="gg-title">Tratamientos</h1>
            <p class="gg-subtitle">
              Gestiona las aplicaciones sanitarias del hato y el catálogo de vacunas, vitaminas y desparasitantes.
            </p>
          </div>
          <div v-if="store.puedeGestionar" class="gg-actions">
            <button
              v-if="segmento === 'aplicaciones'"
              type="button"
              class="gg-btn"
              data-testid="btn-crear-aplicacion"
              @click="abrirCrearAplicacion"
            >
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Aplicar tratamiento
            </button>
            <button v-else type="button" class="gg-btn" data-testid="btn-crear-catalogo" @click="abrirCrearCatalogo">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nuevo tratamiento
            </button>
          </div>
        </header>

        <!-- Selector de 2 segmentos -->
        <div class="gg-segment-wrap">
          <ion-segment
            :value="segmento"
            aria-label="Secciones de tratamientos"
            data-testid="segmento-tratamientos"
            @ionChange="cambiarSegmento($event)"
          >
            <ion-segment-button value="aplicaciones" data-testid="tab-aplicaciones">
              <ion-label>Aplicaciones</ion-label>
            </ion-segment-button>
            <ion-segment-button value="catalogo" data-testid="tab-catalogo">
              <ion-label>Catálogo</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <!-- ==================== SEGMENTO 1: APLICACIONES ==================== -->
        <template v-if="segmento === 'aplicaciones'">
          <div
            v-if="store.mostrandoAvisoOfflineAplicaciones"
            class="gg-alert gg-alert--warning"
            role="status"
            aria-live="polite"
            data-testid="offline-cache-banner"
          >
            <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
            <span>
              <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
              {{ store.ultimaActualizacionAplicacionesTexto }})
            </span>
          </div>

          <form class="gg-card gg-filters" role="search" aria-label="Filtros de aplicaciones" @submit.prevent>
            <div class="gg-field">
              <label class="gg-field__label" for="ap-filtro-animal">Animal</label>
              <select
                id="ap-filtro-animal"
                class="gg-select"
                :value="store.filtrosAplicaciones.id_animal"
                @change="store.establecerAnimalFiltro(($event.target as HTMLSelectElement).value)"
              >
                <option value="">Todos los animales</option>
                <option v-for="a in store.animales" :key="a.id" :value="String(a.id)">
                  {{ a.arete }}{{ a.raza ? ` · ${a.raza}` : '' }}
                </option>
              </select>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="ap-filtro-tratamiento">Tratamiento</label>
              <select
                id="ap-filtro-tratamiento"
                class="gg-select"
                :value="store.filtrosAplicaciones.tratamiento_id"
                @change="store.establecerTratamientoFiltro(($event.target as HTMLSelectElement).value)"
              >
                <option value="">Todos los tratamientos</option>
                <option v-for="t in store.catalogoOpciones" :key="t.tratamiento_id" :value="String(t.tratamiento_id)">
                  {{ t.nombre }}{{ t.tipo ? ` (${t.tipo})` : '' }}
                </option>
              </select>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="ap-filtro-desde">Fecha desde</label>
              <input
                id="ap-filtro-desde"
                class="gg-input"
                type="date"
                :value="store.filtrosAplicaciones.fecha_desde"
                @change="store.establecerFechaDesdeFiltro(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="ap-filtro-hasta">Fecha hasta</label>
              <input
                id="ap-filtro-hasta"
                class="gg-input"
                type="date"
                :value="store.filtrosAplicaciones.fecha_hasta"
                @change="store.establecerFechaHastaFiltro(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="ap-filtro-orden">Ordenar por</label>
              <select
                id="ap-filtro-orden"
                class="gg-select"
                :value="store.claveOrdenAplicaciones"
                @change="store.establecerOrdenAplicaciones(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="o in OPCIONES_ORDEN_APLICACION" :key="o.clave" :value="o.clave">
                  {{ o.etiqueta }}
                </option>
              </select>
            </div>

            <div v-if="store.hayFiltrosAplicaciones" class="gg-filters__clear">
              <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltrosAplicaciones()">
                Limpiar filtros
              </button>
            </div>
          </form>

          <!-- Estado 1: Cargando -->
          <section
            v-if="store.loadingAplicaciones"
            class="gg-card gg-card--flush"
            aria-busy="true"
            aria-label="Cargando aplicaciones sanitarias"
          >
            <div v-for="i in 5" :key="i" class="gg-skeleton-row">
              <span class="gg-skeleton" style="width: 20%" />
              <span class="gg-skeleton" style="width: 24%" />
              <span class="gg-skeleton" style="width: 14%" />
              <span class="gg-skeleton" style="width: 24%" />
            </div>
          </section>

          <!-- Estado 2: Error -->
          <error-state
            v-else-if="store.errorAplicaciones"
            title="No se pudieron cargar las aplicaciones"
            :message="store.mensajeErrorAplicaciones"
            @retry="store.recargarAplicaciones()"
          />

          <!-- Estado 3: Vacío -->
          <section v-else-if="!store.aplicaciones.length" class="gg-card">
            <empty-state
              :title="store.hayFiltrosAplicaciones ? 'Sin resultados' : 'Sin aplicaciones registradas'"
              :message="
                store.hayFiltrosAplicaciones
                  ? 'No hay aplicaciones que coincidan con los filtros seleccionados.'
                  : 'Aún no se han registrado aplicaciones sanitarias.'
              "
            >
              <button
                v-if="store.hayFiltrosAplicaciones"
                type="button"
                class="gg-btn gg-btn--outline"
                @click="store.limpiarFiltrosAplicaciones()"
              >
                Limpiar filtros
              </button>
              <button v-else-if="store.puedeGestionar" type="button" class="gg-btn" @click="abrirCrearAplicacion">
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Registrar primera aplicación
              </button>
            </empty-state>
          </section>

          <!-- Estado 4: Datos -->
          <section v-else class="gg-card gg-card--flush" aria-label="Listado de aplicaciones sanitarias">
            <p class="gg-count" role="status">
              {{ store.totalAplicaciones }} {{ store.totalAplicaciones === 1 ? 'aplicación' : 'aplicaciones' }}
            </p>
            <div class="gg-table-wrapper">
              <table class="gg-table" data-testid="tabla-aplicaciones">
                <caption class="gg-sr-only">
                  Listado de aplicaciones sanitarias registradas
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Animal</th>
                    <th scope="col">Tratamiento</th>
                    <th scope="col">Dosis</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Observaciones</th>
                    <th v-if="store.puedeGestionar" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in store.aplicaciones" :key="a.tratamiento_animal_id">
                    <td data-label="Animal">
                      <a :href="`/detalle/${a.id_animal}`" @click.prevent="router.push(`/detalle/${a.id_animal}`)">
                        {{ a.animal?.numero_arete || `Animal #${a.id_animal}` }}
                      </a>
                    </td>
                    <td data-label="Tratamiento">
                      <span>{{ a.tratamiento?.nombre || `Tratamiento #${a.tratamiento_id}` }}</span>
                      <span v-if="a.tratamiento?.tipo" class="gg-badge gg-badge--neutral gg-ml-sm">
                        {{ a.tratamiento.tipo }}
                      </span>
                    </td>
                    <td data-label="Dosis">{{ a.dosis_ml }} ml</td>
                    <td data-label="Fecha">{{ formatearFecha(a.fecha_aplicacion) }}</td>
                    <td data-label="Observaciones">{{ a.observaciones || '—' }}</td>
                    <td v-if="store.puedeGestionar" data-label="Acciones">
                      <div class="gg-row-actions">
                        <button
                          type="button"
                          class="gg-action-link"
                          :aria-label="`Editar aplicación #${a.tratamiento_animal_id}`"
                          :data-testid="`btn-editar-aplicacion-${a.tratamiento_animal_id}`"
                          @click="abrirEditarAplicacion(a)"
                        >
                          Editar
                        </button>
                        <button
                          v-if="store.puedeEliminar"
                          type="button"
                          class="gg-action-link gg-action-link--danger"
                          :aria-label="`Eliminar aplicación #${a.tratamiento_animal_id}`"
                          :disabled="store.eliminandoAplicacionId === a.tratamiento_animal_id"
                          :data-testid="`btn-eliminar-aplicacion-${a.tratamiento_animal_id}`"
                          @click="confirmarEliminarAplicacion(a)"
                        >
                          {{ store.eliminandoAplicacionId === a.tratamiento_animal_id ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ion-infinite-scroll :disabled="!store.hayMasAplicaciones" @ionInfinite="onInfiniteAplicaciones($event)">
            <ion-infinite-scroll-content loading-spinner="crescent" />
          </ion-infinite-scroll>
        </template>

        <!-- ==================== SEGMENTO 2: CATÁLOGO ==================== -->
        <template v-else>
          <div
            v-if="store.mostrandoAvisoOfflineCatalogo"
            class="gg-alert gg-alert--warning"
            role="status"
            aria-live="polite"
            data-testid="offline-cache-banner-catalogo"
          >
            <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
            <span>
              <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
              {{ store.ultimaActualizacionCatalogoTexto }})
            </span>
          </div>

          <form
            class="gg-card gg-filters"
            role="search"
            aria-label="Filtros del catálogo de tratamientos"
            @submit.prevent
          >
            <div class="gg-field">
              <label class="gg-field__label" for="cat-buscar">Buscar por nombre</label>
              <div class="gg-field__control">
                <input
                  id="cat-buscar"
                  class="gg-input gg-input--icon"
                  type="search"
                  placeholder="Ej: Vacuna Contra Aftosa"
                  autocomplete="off"
                  :value="store.filtrosCatalogo.buscar"
                  @input="store.buscarCatalogo(($event.target as HTMLInputElement).value)"
                />
                <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
              </div>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="cat-tipo">Tipo</label>
              <select
                id="cat-tipo"
                class="gg-select"
                :value="store.filtrosCatalogo.tipo"
                @change="store.establecerTipoCatalogo(($event.target as HTMLSelectElement).value)"
              >
                <option value="">Todos los tipos</option>
                <option v-for="tipo in tiposDisponibles" :key="tipo" :value="tipo">{{ tipo }}</option>
              </select>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="cat-orden">Ordenar por</label>
              <select
                id="cat-orden"
                class="gg-select"
                :value="store.claveOrdenCatalogo"
                @change="store.establecerOrdenCatalogo(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="o in OPCIONES_ORDEN_CATALOGO" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
              </select>
            </div>

            <div v-if="store.hayFiltrosCatalogo" class="gg-filters__clear">
              <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltrosCatalogo()">
                Limpiar filtros
              </button>
            </div>
          </form>

          <!-- Estado 1: Cargando -->
          <section
            v-if="store.loadingCatalogo"
            class="gg-card gg-card--flush"
            aria-busy="true"
            aria-label="Cargando catálogo de tratamientos"
          >
            <div v-for="i in 5" :key="i" class="gg-skeleton-row">
              <span class="gg-skeleton" style="width: 26%" />
              <span class="gg-skeleton" style="width: 18%" />
              <span class="gg-skeleton" style="width: 34%" />
            </div>
          </section>

          <!-- Estado 2: Error -->
          <error-state
            v-else-if="store.errorCatalogo"
            title="No se pudo cargar el catálogo"
            :message="store.mensajeErrorCatalogo"
            @retry="store.recargarCatalogo()"
          />

          <!-- Estado 3: Vacío -->
          <section v-else-if="!store.catalogo.length" class="gg-card">
            <empty-state
              :title="store.hayFiltrosCatalogo ? 'Sin resultados' : 'Catálogo vacío'"
              :message="
                store.hayFiltrosCatalogo
                  ? 'No hay tratamientos que coincidan con la búsqueda o el tipo seleccionado.'
                  : 'Aún no hay tratamientos registrados en el catálogo.'
              "
            >
              <button
                v-if="store.hayFiltrosCatalogo"
                type="button"
                class="gg-btn gg-btn--outline"
                @click="store.limpiarFiltrosCatalogo()"
              >
                Limpiar filtros
              </button>
              <button v-else-if="store.puedeGestionar" type="button" class="gg-btn" @click="abrirCrearCatalogo">
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Crear primer tratamiento
              </button>
            </empty-state>
          </section>

          <!-- Estado 4: Datos -->
          <section v-else class="gg-card gg-card--flush" aria-label="Catálogo de tratamientos">
            <p class="gg-count" role="status">
              {{ store.totalCatalogo }} {{ store.totalCatalogo === 1 ? 'tratamiento' : 'tratamientos' }}
            </p>
            <div class="gg-table-wrapper">
              <table class="gg-table" data-testid="tabla-catalogo">
                <caption class="gg-sr-only">
                  Catálogo sanitario de tratamientos
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Descripción</th>
                    <th v-if="store.puedeGestionar" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in store.catalogo" :key="t.tratamiento_id">
                    <td data-label="Nombre">
                      <strong>{{ t.nombre }}</strong>
                    </td>
                    <td data-label="Tipo">
                      <span class="gg-badge" :class="claseTipoTratamiento(t.tipo)">
                        {{ t.tipo || 'Sin especificar' }}
                      </span>
                    </td>
                    <td data-label="Descripción">{{ t.descripcion || '—' }}</td>
                    <td v-if="store.puedeGestionar" data-label="Acciones">
                      <div class="gg-row-actions">
                        <button
                          type="button"
                          class="gg-action-link"
                          :aria-label="`Editar tratamiento ${t.nombre}`"
                          :data-testid="`btn-editar-catalogo-${t.tratamiento_id}`"
                          @click="abrirEditarCatalogo(t)"
                        >
                          Editar
                        </button>
                        <button
                          v-if="store.puedeEliminar"
                          type="button"
                          class="gg-action-link gg-action-link--danger"
                          :aria-label="`Eliminar tratamiento ${t.nombre}`"
                          :disabled="store.eliminandoCatalogoId === t.tratamiento_id"
                          :data-testid="`btn-eliminar-catalogo-${t.tratamiento_id}`"
                          @click="confirmarEliminarCatalogo(t)"
                        >
                          {{ store.eliminandoCatalogoId === t.tratamiento_id ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ion-infinite-scroll :disabled="!store.hayMasCatalogo" @ionInfinite="onInfiniteCatalogo($event)">
            <ion-infinite-scroll-content loading-spinner="crescent" />
          </ion-infinite-scroll>
        </template>
      </div>

      <!-- Modal Crear / Editar Aplicación -->
      <div
        v-if="modalAplicacionAbierto && store.puedeGestionar"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-aplicacion-titulo"
        data-testid="modal-aplicacion-form"
        @click.self="cerrarModalAplicacion"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicionAplicacion ? `Aplicación #${store.editandoAplicacionId}` : 'Sanidad animal' }}
              </p>
              <h2 id="modal-aplicacion-titulo" class="gg-section-title">
                {{ store.esEdicionAplicacion ? 'Editar aplicación' : 'Aplicar tratamiento' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de aplicación"
              :disabled="store.guardandoAplicacion"
              @click="cerrarModalAplicacion"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarAplicacion">
            <div
              v-if="store.errorNegocioAplicacion"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="aplicacion-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioAplicacion }}</span>
            </div>

            <div
              v-if="store.errorGeneralAplicacion"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="aplicacion-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralAplicacion }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresAplicacion.id_animal }">
              <label class="gg-field__label" for="ap-animal">Animal *</label>
              <select
                id="ap-animal"
                v-model="store.formAplicacion.id_animal"
                class="gg-select"
                :disabled="store.guardandoAplicacion"
                :aria-invalid="Boolean(store.erroresAplicacion.id_animal)"
                :aria-describedby="store.erroresAplicacion.id_animal ? 'ap-animal-error' : undefined"
                required
              >
                <option value="">Selecciona un animal</option>
                <option v-for="a in store.animales" :key="a.id" :value="String(a.id)">
                  {{ a.arete }}{{ a.raza ? ` · ${a.raza}` : '' }}
                </option>
              </select>
              <p v-if="store.erroresAplicacion.id_animal" id="ap-animal-error" class="gg-field__error">
                {{ store.erroresAplicacion.id_animal }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresAplicacion.tratamiento_id }">
              <label class="gg-field__label" for="ap-tratamiento">Tratamiento *</label>
              <select
                id="ap-tratamiento"
                v-model="store.formAplicacion.tratamiento_id"
                class="gg-select"
                :disabled="store.guardandoAplicacion"
                :aria-invalid="Boolean(store.erroresAplicacion.tratamiento_id)"
                :aria-describedby="store.erroresAplicacion.tratamiento_id ? 'ap-tratamiento-error' : undefined"
                required
              >
                <option value="">Selecciona un tratamiento</option>
                <option v-for="t in store.catalogoOpciones" :key="t.tratamiento_id" :value="String(t.tratamiento_id)">
                  {{ t.nombre }}{{ t.tipo ? ` (${t.tipo})` : '' }}
                </option>
              </select>
              <p v-if="store.erroresAplicacion.tratamiento_id" id="ap-tratamiento-error" class="gg-field__error">
                {{ store.erroresAplicacion.tratamiento_id }}
              </p>
            </div>

            <div class="gg-form-row">
              <div class="gg-field" :class="{ 'gg-field--error': store.erroresAplicacion.fecha_aplicacion }">
                <label class="gg-field__label" for="ap-fecha">Fecha de aplicación *</label>
                <input
                  id="ap-fecha"
                  v-model="store.formAplicacion.fecha_aplicacion"
                  class="gg-input"
                  type="date"
                  :disabled="store.guardandoAplicacion"
                  :aria-invalid="Boolean(store.erroresAplicacion.fecha_aplicacion)"
                  :aria-describedby="store.erroresAplicacion.fecha_aplicacion ? 'ap-fecha-error' : undefined"
                  required
                />
                <p v-if="store.erroresAplicacion.fecha_aplicacion" id="ap-fecha-error" class="gg-field__error">
                  {{ store.erroresAplicacion.fecha_aplicacion }}
                </p>
              </div>

              <div class="gg-field" :class="{ 'gg-field--error': store.erroresAplicacion.dosis_ml }">
                <label class="gg-field__label" for="ap-dosis">Dosis (ml) *</label>
                <input
                  id="ap-dosis"
                  v-model="store.formAplicacion.dosis_ml"
                  class="gg-input"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="9999.99"
                  step="0.01"
                  placeholder="Ej: 15.0"
                  :disabled="store.guardandoAplicacion"
                  :aria-invalid="Boolean(store.erroresAplicacion.dosis_ml)"
                  :aria-describedby="store.erroresAplicacion.dosis_ml ? 'ap-dosis-error' : undefined"
                  required
                />
                <p v-if="store.erroresAplicacion.dosis_ml" id="ap-dosis-error" class="gg-field__error">
                  {{ store.erroresAplicacion.dosis_ml }}
                </p>
              </div>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresAplicacion.observaciones }">
              <label class="gg-field__label" for="ap-observaciones">Observaciones (opcional)</label>
              <textarea
                id="ap-observaciones"
                v-model="store.formAplicacion.observaciones"
                class="gg-textarea"
                rows="3"
                placeholder="Ej: Refuerzo semestral sin reacciones adversas"
                :disabled="store.guardandoAplicacion"
                :aria-invalid="Boolean(store.erroresAplicacion.observaciones)"
                :aria-describedby="store.erroresAplicacion.observaciones ? 'ap-observaciones-error' : undefined"
              />
              <p v-if="store.erroresAplicacion.observaciones" id="ap-observaciones-error" class="gg-field__error">
                {{ store.erroresAplicacion.observaciones }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button
                type="submit"
                class="gg-btn"
                :disabled="store.guardandoAplicacion"
                data-testid="btn-guardar-aplicacion"
              >
                {{
                  store.guardandoAplicacion
                    ? 'Guardando...'
                    : store.esEdicionAplicacion
                      ? 'Guardar cambios'
                      : 'Registrar aplicación'
                }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoAplicacion"
                @click="cerrarModalAplicacion"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Crear / Editar Tratamiento del Catálogo -->
      <div
        v-if="modalCatalogoAbierto && store.puedeGestionar"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-catalogo-titulo"
        data-testid="modal-catalogo-form"
        @click.self="cerrarModalCatalogo"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicionCatalogo ? `Tratamiento #${store.editandoCatalogoId}` : 'Catálogo sanitario' }}
              </p>
              <h2 id="modal-catalogo-titulo" class="gg-section-title">
                {{ store.esEdicionCatalogo ? 'Editar tratamiento' : 'Nuevo tratamiento' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de catálogo"
              :disabled="store.guardandoCatalogo"
              @click="cerrarModalCatalogo"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarCatalogo">
            <div
              v-if="store.errorNegocioCatalogo"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="catalogo-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioCatalogo }}</span>
            </div>

            <div
              v-if="store.errorGeneralCatalogo"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="catalogo-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralCatalogo }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresCatalogo.nombre }">
              <label class="gg-field__label" for="cat-form-nombre">Nombre *</label>
              <input
                id="cat-form-nombre"
                v-model="store.formCatalogo.nombre"
                class="gg-input"
                type="text"
                maxlength="100"
                placeholder="Ej: Vacuna Contra Aftosa"
                autocomplete="off"
                :disabled="store.guardandoCatalogo"
                :aria-invalid="Boolean(store.erroresCatalogo.nombre)"
                :aria-describedby="store.erroresCatalogo.nombre ? 'cat-form-nombre-error' : undefined"
                required
              />
              <p v-if="store.erroresCatalogo.nombre" id="cat-form-nombre-error" class="gg-field__error">
                {{ store.erroresCatalogo.nombre }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresCatalogo.tipo }">
              <label class="gg-field__label" for="cat-form-tipo">Tipo (opcional)</label>
              <input
                id="cat-form-tipo"
                v-model="store.formCatalogo.tipo"
                class="gg-input"
                type="text"
                maxlength="50"
                list="gg-tipos-tratamiento-datalist"
                placeholder="Vacuna, Desparasitante, Vitamina u otro"
                autocomplete="off"
                :disabled="store.guardandoCatalogo"
                :aria-invalid="Boolean(store.erroresCatalogo.tipo)"
                :aria-describedby="store.erroresCatalogo.tipo ? 'cat-form-tipo-error' : undefined"
              />
              <datalist id="gg-tipos-tratamiento-datalist">
                <option v-for="t in TIPOS_TRATAMIENTO_REFERENCIA" :key="t" :value="t" />
              </datalist>
              <p v-if="store.erroresCatalogo.tipo" id="cat-form-tipo-error" class="gg-field__error">
                {{ store.erroresCatalogo.tipo }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresCatalogo.descripcion }">
              <label class="gg-field__label" for="cat-form-descripcion">Descripción (opcional)</label>
              <textarea
                id="cat-form-descripcion"
                v-model="store.formCatalogo.descripcion"
                class="gg-textarea"
                rows="3"
                placeholder="Ej: Vacunación semestral obligatoria"
                :disabled="store.guardandoCatalogo"
                :aria-invalid="Boolean(store.erroresCatalogo.descripcion)"
                :aria-describedby="store.erroresCatalogo.descripcion ? 'cat-form-descripcion-error' : undefined"
              />
              <p v-if="store.erroresCatalogo.descripcion" id="cat-form-descripcion-error" class="gg-field__error">
                {{ store.erroresCatalogo.descripcion }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button
                type="submit"
                class="gg-btn"
                :disabled="store.guardandoCatalogo"
                data-testid="btn-guardar-catalogo"
              >
                {{
                  store.guardandoCatalogo
                    ? 'Guardando...'
                    : store.esEdicionCatalogo
                      ? 'Guardar cambios'
                      : 'Crear tratamiento'
                }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoCatalogo"
                @click="cerrarModalCatalogo"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  onIonViewWillEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import { addOutline, alertCircleOutline, cloudOfflineOutline, searchOutline, warningOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import {
  mostrarToast,
  networkService,
  TIPOS_TRATAMIENTO_REFERENCIA,
  type TratamientoAplicacion,
  type TratamientoCatalogo,
} from '@/services';
import {
  OPCIONES_ORDEN_APLICACION,
  OPCIONES_ORDEN_CATALOGO,
  useTratamientoStore,
  type SegmentoTratamientos,
} from '@/stores/tratamiento';

const router = useRouter();
const store = useTratamientoStore();

const segmento = ref<SegmentoTratamientos>('aplicaciones');
const modalAplicacionAbierto = ref<boolean>(false);
const modalCatalogoAbierto = ref<boolean>(false);

let cancelarSuscripcionRed: (() => void) | null = null;

const tiposDisponibles = computed<string[]>(() => {
  const conjunto = new Set<string>(TIPOS_TRATAMIENTO_REFERENCIA);
  for (const item of store.catalogoOpciones) {
    if (item.tipo?.trim()) conjunto.add(item.tipo.trim());
  }
  return Array.from(conjunto);
});

onMounted(() => {
  void store.cargarSelectores();
  void store.recargarAplicaciones();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      if (segmento.value === 'aplicaciones') {
        void store.recargarAplicaciones();
      } else {
        void store.recargarCatalogo();
      }
    } else {
      store.marcarSinConexion();
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
  store.cancelarPendiente();
});

onIonViewWillEnter(() => {
  void store.cargarSelectores();
  if (segmento.value === 'aplicaciones') {
    void store.recargarAplicaciones();
  } else {
    void store.recargarCatalogo();
  }
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function cambiarSegmento(evento: CustomEvent): void {
  const valor = evento.detail?.value as SegmentoTratamientos | undefined;
  if (valor !== 'aplicaciones' && valor !== 'catalogo') return;
  segmento.value = valor;
  if (valor === 'aplicaciones') {
    void store.recargarAplicaciones();
  } else {
    void store.recargarCatalogo();
  }
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function claseTipoTratamiento(tipo: string | null): string {
  if (tipo === 'Vacuna') return 'gg-badge--success';
  if (tipo === 'Desparasitante') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

// -------- Aplicaciones --------
function abrirCrearAplicacion(): void {
  if (!store.puedeGestionar) return;
  void store.cargarSelectores();
  store.prepararNuevaAplicacion();
  modalAplicacionAbierto.value = true;
}

function abrirEditarAplicacion(item: TratamientoAplicacion): void {
  if (!store.puedeGestionar) return;
  void store.cargarSelectores();
  store.prepararEdicionAplicacion(item);
  modalAplicacionAbierto.value = true;
}

function cerrarModalAplicacion(): void {
  if (store.guardandoAplicacion) return;
  modalAplicacionAbierto.value = false;
}

async function enviarAplicacion(): Promise<void> {
  const eraEdicion = store.esEdicionAplicacion;
  const guardado = await store.guardarAplicacion();
  if (!guardado) {
    if (store.errorNegocioAplicacion) {
      await mostrarToast(store.errorNegocioAplicacion, 'warning', 5000);
    }
    return;
  }
  modalAplicacionAbierto.value = false;
  await mostrarToast(
    eraEdicion ? 'Aplicación actualizada correctamente.' : 'Tratamiento aplicado correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminarAplicacion(item: TratamientoAplicacion): Promise<void> {
  if (!store.puedeEliminar) return;
  const arete = item.animal?.numero_arete || `Animal #${item.id_animal}`;
  const alerta = await alertController.create({
    header: 'Eliminar aplicación',
    message: `¿Seguro que deseas eliminar la aplicación registrada para ${arete}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminarAplicacion(item.tratamiento_animal_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
  } else {
    await mostrarToast(resultado.mensaje, resultado.esReglaDeNegocio ? 'warning' : 'danger', 5000);
  }
}

// -------- Catálogo --------
function abrirCrearCatalogo(): void {
  if (!store.puedeGestionar) return;
  store.prepararNuevoCatalogo();
  modalCatalogoAbierto.value = true;
}

function abrirEditarCatalogo(item: TratamientoCatalogo): void {
  if (!store.puedeGestionar) return;
  store.prepararEdicionCatalogo(item);
  modalCatalogoAbierto.value = true;
}

function cerrarModalCatalogo(): void {
  if (store.guardandoCatalogo) return;
  modalCatalogoAbierto.value = false;
}

async function enviarCatalogo(): Promise<void> {
  const eraEdicion = store.esEdicionCatalogo;
  const guardado = await store.guardarCatalogo();
  if (!guardado) {
    if (store.errorNegocioCatalogo) {
      await mostrarToast(store.errorNegocioCatalogo, 'warning', 5000);
    }
    return;
  }
  modalCatalogoAbierto.value = false;
  await mostrarToast(
    eraEdicion ? 'Tratamiento actualizado correctamente.' : 'Tratamiento creado correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminarCatalogo(item: TratamientoCatalogo): Promise<void> {
  if (!store.puedeEliminar) return;
  const alerta = await alertController.create({
    header: 'Eliminar tratamiento',
    message: `¿Seguro que deseas eliminar "${item.nombre}" del catálogo sanitario?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminarCatalogo(item.tratamiento_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio (RN-06)',
      message: resultado.mensaje,
      buttons: ['Entendido'],
    });
    await alertaRegla.present();
    await mostrarToast(resultado.mensaje, 'warning', 5000);
  } else {
    await mostrarToast(resultado.mensaje, 'danger', 5000);
  }
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  if (segmento.value === 'aplicaciones') {
    await store.recargarAplicaciones();
  } else {
    await store.recargarCatalogo();
  }
  (evento.target as HTMLIonRefresherElement).complete();
}

async function onInfiniteAplicaciones(evento: CustomEvent): Promise<void> {
  await store.cargarMasAplicaciones();
  if (store.mensajeErrorAplicaciones && !store.errorAplicaciones) {
    await mostrarToast(store.mensajeErrorAplicaciones, 'danger', 4000);
  }
  (evento.target as HTMLIonInfiniteScrollElement).complete();
}

async function onInfiniteCatalogo(evento: CustomEvent): Promise<void> {
  await store.cargarMasCatalogo();
  if (store.mensajeErrorCatalogo && !store.errorCatalogo) {
    await mostrarToast(store.mensajeErrorCatalogo, 'danger', 4000);
  }
  (evento.target as HTMLIonInfiniteScrollElement).complete();
}
</script>

<style scoped>
.gg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.gg-segment-wrap {
  max-width: 24rem;
}

.gg-segment-wrap ion-segment {
  --background: var(--gg-surface);
  border: 1px solid var(--gg-border);
  border-radius: 0.75rem;
  padding: 0.2rem;
}

.gg-segment-wrap ion-segment-button {
  --color: var(--gg-ink-muted);
  --color-checked: #ffffff;
  --indicator-color: var(--gg-olive);
  --border-radius: 0.55rem;
  font-weight: 600;
}

.gg-filters {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
  align-items: end;
}
@media (min-width: 40rem) {
  .gg-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 62rem) {
  .gg-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.gg-filters__clear {
  display: flex;
  align-items: center;
}

.gg-count {
  margin: 0;
  padding: 0.9rem 1.25rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gg-ink-muted);
}

.gg-ml-sm {
  margin-left: 0.4rem;
}

.gg-row-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.gg-action-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gg-olive);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
.gg-action-link:hover {
  color: var(--gg-olive-hover);
}
.gg-action-link--danger {
  color: var(--gg-danger-fg);
}
.gg-action-link--danger:hover {
  color: #991b1b;
}
.gg-action-link:disabled {
  color: var(--gg-disabled-fg);
  cursor: not-allowed;
}

.gg-skeleton-row {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--gg-border);
}
.gg-skeleton-row:first-child {
  border-top: 0;
}

.gg-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(40 54 24 / 48%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow-y: auto;
}

.gg-modal {
  width: 100%;
  max-width: 34rem;
  max-height: 90vh;
  overflow-y: auto;
}

.gg-modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gg-form-row {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
}
@media (min-width: 34rem) {
  .gg-form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
