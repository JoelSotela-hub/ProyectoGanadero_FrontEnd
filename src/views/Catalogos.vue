<template>
  <ion-page>
    <app-header titulo="Catálogos" />

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">Configuración maestra</p>
            <h1 class="gg-title">Catálogos</h1>
            <p class="gg-subtitle">
              Administra las razas de ganado, categorías de insumos y unidades de medida utilizadas en toda la finca.
            </p>
          </div>
          <div v-if="store.esAdmin" class="gg-actions">
            <button
              v-if="segmento === 'razas'"
              type="button"
              class="gg-btn"
              data-testid="btn-crear-raza"
              @click="abrirCrearRaza"
            >
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nueva raza
            </button>
            <button
              v-else-if="segmento === 'categorias'"
              type="button"
              class="gg-btn"
              data-testid="btn-crear-categoria"
              @click="abrirCrearCategoria"
            >
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nueva categoría
            </button>
            <button v-else type="button" class="gg-btn" data-testid="btn-crear-unidad" @click="abrirCrearUnidad">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              Nueva unidad
            </button>
          </div>
        </header>

        <!-- Selector de 3 segmentos para los catálogos administrativos -->
        <div class="gg-segment-wrap">
          <ion-segment
            :value="segmento"
            aria-label="Secciones de catálogos"
            data-testid="segmento-catalogos"
            @ionChange="cambiarSegmento($event)"
          >
            <ion-segment-button value="razas" data-testid="tab-razas">
              <ion-label>Razas</ion-label>
            </ion-segment-button>
            <ion-segment-button value="categorias" data-testid="tab-categorias">
              <ion-label>Categorías</ion-label>
            </ion-segment-button>
            <ion-segment-button value="unidades" data-testid="tab-unidades">
              <ion-label>Unidades de Medida</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <!-- ==================== SEGMENTO 1: RAZAS ==================== -->
        <template v-if="segmento === 'razas'">
          <div
            v-if="store.mostrandoAvisoOfflineRazas"
            class="gg-alert gg-alert--warning"
            role="status"
            aria-live="polite"
            data-testid="offline-cache-banner-razas"
          >
            <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
            <span>
              <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
              {{ store.ultimaActualizacionRazasTexto }})
            </span>
          </div>

          <form class="gg-card gg-filters" role="search" aria-label="Filtros de razas" @submit.prevent>
            <div class="gg-field gg-filters__search">
              <label class="gg-field__label" for="raza-buscar">Buscar por nombre</label>
              <div class="gg-field__control">
                <input
                  id="raza-buscar"
                  class="gg-input gg-input--icon"
                  type="search"
                  placeholder="Ej: Brahman"
                  autocomplete="off"
                  :value="store.filtrosRazas.buscar"
                  @input="store.buscarRazas(($event.target as HTMLInputElement).value)"
                />
                <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
              </div>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="raza-orden">Ordenar por</label>
              <select
                id="raza-orden"
                class="gg-select"
                :value="store.claveOrdenRazas"
                @change="store.establecerOrdenRazas(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="o in OPCIONES_ORDEN_RAZA" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
              </select>
            </div>

            <div v-if="store.hayFiltrosRazas" class="gg-filters__clear">
              <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltrosRazas()">
                Limpiar filtros
              </button>
            </div>
          </form>

          <!-- Estado 1: Cargando -->
          <section
            v-if="store.loadingRazas"
            class="gg-card gg-card--flush"
            aria-busy="true"
            aria-label="Cargando catálogo de razas"
          >
            <div v-for="i in 5" :key="i" class="gg-skeleton-row">
              <span class="gg-skeleton" style="width: 15%" />
              <span class="gg-skeleton" style="width: 45%" />
              <span class="gg-skeleton" style="width: 25%" />
            </div>
          </section>

          <!-- Estado 2: Error -->
          <error-state
            v-else-if="store.errorRazas"
            title="No se pudo cargar el catálogo de razas"
            :message="store.mensajeErrorRazas"
            @retry="store.recargarRazas()"
          />

          <!-- Estado 3: Vacío -->
          <section v-else-if="!store.razas.length" class="gg-card">
            <empty-state
              :title="store.hayFiltrosRazas ? 'Sin resultados' : 'Sin razas registradas'"
              :message="
                store.hayFiltrosRazas
                  ? 'No hay razas que coincidan con la búsqueda.'
                  : 'Aún no hay razas registradas en el catálogo.'
              "
            >
              <button
                v-if="store.hayFiltrosRazas"
                type="button"
                class="gg-btn gg-btn--outline"
                @click="store.limpiarFiltrosRazas()"
              >
                Limpiar filtros
              </button>
              <button v-else-if="store.esAdmin" type="button" class="gg-btn" @click="abrirCrearRaza">
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Crear primera raza
              </button>
            </empty-state>
          </section>

          <!-- Estado 4: Datos -->
          <section v-else class="gg-card gg-card--flush" aria-label="Catálogo de razas">
            <p class="gg-count" role="status">{{ store.totalRazas }} {{ store.totalRazas === 1 ? 'raza' : 'razas' }}</p>
            <div class="gg-table-wrapper">
              <table class="gg-table" data-testid="tabla-razas">
                <caption class="gg-sr-only">
                  Catálogo de razas de ganado
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nombre</th>
                    <th v-if="store.esAdmin" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in store.razas" :key="r.raza_id">
                    <td data-label="ID">
                      <span class="gg-mono">#{{ r.raza_id }}</span>
                    </td>
                    <td data-label="Nombre">
                      <strong>{{ r.nombre }}</strong>
                    </td>
                    <td v-if="store.esAdmin" data-label="Acciones">
                      <div class="gg-row-actions">
                        <button
                          type="button"
                          class="gg-action-link"
                          :aria-label="`Editar raza ${r.nombre}`"
                          :data-testid="`btn-editar-raza-${r.raza_id}`"
                          @click="abrirEditarRaza(r)"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="gg-action-link gg-action-link--danger"
                          :aria-label="`Eliminar raza ${r.nombre}`"
                          :disabled="store.eliminandoRazaId === r.raza_id"
                          :data-testid="`btn-eliminar-raza-${r.raza_id}`"
                          @click="confirmarEliminarRaza(r)"
                        >
                          {{ store.eliminandoRazaId === r.raza_id ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ion-infinite-scroll :disabled="!store.hayMasRazas" @ionInfinite="onInfiniteRazas($event)">
            <ion-infinite-scroll-content loading-spinner="crescent" />
          </ion-infinite-scroll>
        </template>

        <!-- ==================== SEGMENTO 2: CATEGORÍAS ==================== -->
        <template v-else-if="segmento === 'categorias'">
          <div
            v-if="store.mostrandoAvisoOfflineCategorias"
            class="gg-alert gg-alert--warning"
            role="status"
            aria-live="polite"
            data-testid="offline-cache-banner-categorias"
          >
            <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
            <span>
              <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
              {{ store.ultimaActualizacionCategoriasTexto }})
            </span>
          </div>

          <form class="gg-card gg-filters" role="search" aria-label="Filtros de categorías" @submit.prevent>
            <div class="gg-field gg-filters__search">
              <label class="gg-field__label" for="cat-ins-buscar">Buscar por nombre</label>
              <div class="gg-field__control">
                <input
                  id="cat-ins-buscar"
                  class="gg-input gg-input--icon"
                  type="search"
                  placeholder="Ej: Suplementos"
                  autocomplete="off"
                  :value="store.filtrosCategorias.buscar"
                  @input="store.buscarCategorias(($event.target as HTMLInputElement).value)"
                />
                <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
              </div>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="cat-ins-tipo">Tipo</label>
              <select
                id="cat-ins-tipo"
                class="gg-select"
                :value="store.filtrosCategorias.tipo"
                @change="store.establecerTipoCategoria(($event.target as HTMLSelectElement).value)"
              >
                <option value="">Todos los tipos</option>
                <option v-for="t in tiposCategoriaDisponibles" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="cat-ins-orden">Ordenar por</label>
              <select
                id="cat-ins-orden"
                class="gg-select"
                :value="store.claveOrdenCategorias"
                @change="store.establecerOrdenCategorias(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="o in OPCIONES_ORDEN_CATEGORIA" :key="o.clave" :value="o.clave">{{ o.etiqueta }}</option>
              </select>
            </div>

            <div v-if="store.hayFiltrosCategorias" class="gg-filters__clear">
              <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltrosCategorias()">
                Limpiar filtros
              </button>
            </div>
          </form>

          <!-- Estado 1: Cargando -->
          <section
            v-if="store.loadingCategorias"
            class="gg-card gg-card--flush"
            aria-busy="true"
            aria-label="Cargando catálogo de categorías"
          >
            <div v-for="i in 5" :key="i" class="gg-skeleton-row">
              <span class="gg-skeleton" style="width: 15%" />
              <span class="gg-skeleton" style="width: 35%" />
              <span class="gg-skeleton" style="width: 25%" />
            </div>
          </section>

          <!-- Estado 2: Error -->
          <error-state
            v-else-if="store.errorCategorias"
            title="No se pudo cargar el catálogo de categorías"
            :message="store.mensajeErrorCategorias"
            @retry="store.recargarCategorias()"
          />

          <!-- Estado 3: Vacío -->
          <section v-else-if="!store.categorias.length" class="gg-card">
            <empty-state
              :title="store.hayFiltrosCategorias ? 'Sin resultados' : 'Sin categorías registradas'"
              :message="
                store.hayFiltrosCategorias
                  ? 'No hay categorías que coincidan con los filtros seleccionados.'
                  : 'Aún no hay categorías registradas para los insumos.'
              "
            >
              <button
                v-if="store.hayFiltrosCategorias"
                type="button"
                class="gg-btn gg-btn--outline"
                @click="store.limpiarFiltrosCategorias()"
              >
                Limpiar filtros
              </button>
              <button v-else-if="store.esAdmin" type="button" class="gg-btn" @click="abrirCrearCategoria">
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Crear primera categoría
              </button>
            </empty-state>
          </section>

          <!-- Estado 4: Datos -->
          <section v-else class="gg-card gg-card--flush" aria-label="Catálogo de categorías">
            <p class="gg-count" role="status">
              {{ store.totalCategorias }} {{ store.totalCategorias === 1 ? 'categoría' : 'categorías' }}
            </p>
            <div class="gg-table-wrapper">
              <table class="gg-table" data-testid="tabla-categorias">
                <caption class="gg-sr-only">
                  Catálogo de categorías de insumos
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Tipo</th>
                    <th v-if="store.esAdmin" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in store.categorias" :key="c.categoria_id">
                    <td data-label="ID">
                      <span class="gg-mono">#{{ c.categoria_id }}</span>
                    </td>
                    <td data-label="Nombre">
                      <strong>{{ c.nombre }}</strong>
                    </td>
                    <td data-label="Tipo">
                      <span class="gg-badge" :class="c.tipo ? 'gg-badge--success' : 'gg-badge--neutral'">
                        {{ c.tipo || 'Sin especificar' }}
                      </span>
                    </td>
                    <td v-if="store.esAdmin" data-label="Acciones">
                      <div class="gg-row-actions">
                        <button
                          type="button"
                          class="gg-action-link"
                          :aria-label="`Editar categoría ${c.nombre}`"
                          :data-testid="`btn-editar-categoria-${c.categoria_id}`"
                          @click="abrirEditarCategoria(c)"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="gg-action-link gg-action-link--danger"
                          :aria-label="`Eliminar categoría ${c.nombre}`"
                          :disabled="store.eliminandoCategoriaId === c.categoria_id"
                          :data-testid="`btn-eliminar-categoria-${c.categoria_id}`"
                          @click="confirmarEliminarCategoria(c)"
                        >
                          {{ store.eliminandoCategoriaId === c.categoria_id ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ion-infinite-scroll :disabled="!store.hayMasCategorias" @ionInfinite="onInfiniteCategorias($event)">
            <ion-infinite-scroll-content loading-spinner="crescent" />
          </ion-infinite-scroll>
        </template>

        <!-- ==================== SEGMENTO 3: UNIDADES DE MEDIDA ==================== -->
        <template v-else>
          <div
            v-if="store.mostrandoAvisoOfflineUnidades"
            class="gg-alert gg-alert--warning"
            role="status"
            aria-live="polite"
            data-testid="offline-cache-banner-unidades"
          >
            <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
            <span>
              <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
              {{ store.ultimaActualizacionUnidadesTexto }})
            </span>
          </div>

          <form class="gg-card gg-filters" role="search" aria-label="Filtros de unidades de medida" @submit.prevent>
            <div class="gg-field gg-filters__search">
              <label class="gg-field__label" for="uni-buscar">Buscar por nombre</label>
              <div class="gg-field__control">
                <input
                  id="uni-buscar"
                  class="gg-input gg-input--icon"
                  type="search"
                  placeholder="Ej: Kilogramo"
                  autocomplete="off"
                  :value="store.filtrosUnidades.buscar"
                  @input="store.buscarUnidades(($event.target as HTMLInputElement).value)"
                />
                <span class="gg-field__icon"><ion-icon :icon="searchOutline" aria-hidden="true" /></span>
              </div>
            </div>

            <div class="gg-field">
              <label class="gg-field__label" for="uni-orden">Ordenar por</label>
              <select
                id="uni-orden"
                class="gg-select"
                :value="store.claveOrdenUnidades"
                @change="store.establecerOrdenUnidades(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="o in OPCIONES_ORDEN_UNIDAD_MEDIDA" :key="o.clave" :value="o.clave">
                  {{ o.etiqueta }}
                </option>
              </select>
            </div>

            <div v-if="store.hayFiltrosUnidades" class="gg-filters__clear">
              <button type="button" class="gg-btn gg-btn--ghost" @click="store.limpiarFiltrosUnidades()">
                Limpiar filtros
              </button>
            </div>
          </form>

          <!-- Estado 1: Cargando -->
          <section
            v-if="store.loadingUnidades"
            class="gg-card gg-card--flush"
            aria-busy="true"
            aria-label="Cargando catálogo de unidades de medida"
          >
            <div v-for="i in 5" :key="i" class="gg-skeleton-row">
              <span class="gg-skeleton" style="width: 15%" />
              <span class="gg-skeleton" style="width: 40%" />
              <span class="gg-skeleton" style="width: 20%" />
            </div>
          </section>

          <!-- Estado 2: Error -->
          <error-state
            v-else-if="store.errorUnidades"
            title="No se pudo cargar el catálogo de unidades de medida"
            :message="store.mensajeErrorUnidades"
            @retry="store.recargarUnidades()"
          />

          <!-- Estado 3: Vacío -->
          <section v-else-if="!store.unidades.length" class="gg-card">
            <empty-state
              :title="store.hayFiltrosUnidades ? 'Sin resultados' : 'Sin unidades de medida'"
              :message="
                store.hayFiltrosUnidades
                  ? 'No hay unidades de medida que coincidan con la búsqueda.'
                  : 'Aún no hay unidades de medida registradas.'
              "
            >
              <button
                v-if="store.hayFiltrosUnidades"
                type="button"
                class="gg-btn gg-btn--outline"
                @click="store.limpiarFiltrosUnidades()"
              >
                Limpiar filtros
              </button>
              <button v-else-if="store.esAdmin" type="button" class="gg-btn" @click="abrirCrearUnidad">
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Crear primera unidad
              </button>
            </empty-state>
          </section>

          <!-- Estado 4: Datos -->
          <section v-else class="gg-card gg-card--flush" aria-label="Catálogo de unidades de medida">
            <p class="gg-count" role="status">
              {{ store.totalUnidades }} {{ store.totalUnidades === 1 ? 'unidad de medida' : 'unidades de medida' }}
            </p>
            <div class="gg-table-wrapper">
              <table class="gg-table" data-testid="tabla-unidades">
                <caption class="gg-sr-only">
                  Catálogo de unidades de medida
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Abreviatura</th>
                    <th v-if="store.esAdmin" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in store.unidades" :key="u.unidad_medida_id">
                    <td data-label="ID">
                      <span class="gg-mono">#{{ u.unidad_medida_id }}</span>
                    </td>
                    <td data-label="Nombre">
                      <strong>{{ u.nombre }}</strong>
                    </td>
                    <td data-label="Abreviatura">
                      <span v-if="u.apertura" class="gg-badge gg-badge--neutral gg-mono">{{ u.apertura }}</span>
                      <span v-else>—</span>
                    </td>
                    <td v-if="store.esAdmin" data-label="Acciones">
                      <div class="gg-row-actions">
                        <button
                          type="button"
                          class="gg-action-link"
                          :aria-label="`Editar unidad ${u.nombre}`"
                          :data-testid="`btn-editar-unidad-${u.unidad_medida_id}`"
                          @click="abrirEditarUnidad(u)"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="gg-action-link gg-action-link--danger"
                          :aria-label="`Eliminar unidad ${u.nombre}`"
                          :disabled="store.eliminandoUnidadId === u.unidad_medida_id"
                          :data-testid="`btn-eliminar-unidad-${u.unidad_medida_id}`"
                          @click="confirmarEliminarUnidad(u)"
                        >
                          {{ store.eliminandoUnidadId === u.unidad_medida_id ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ion-infinite-scroll :disabled="!store.hayMasUnidades" @ionInfinite="onInfiniteUnidades($event)">
            <ion-infinite-scroll-content loading-spinner="crescent" />
          </ion-infinite-scroll>
        </template>
      </div>

      <!-- ==================== MODAL 1: CREAR / EDITAR RAZA ==================== -->
      <div
        v-if="modalRazaAbierto && store.esAdmin"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-raza-titulo"
        data-testid="modal-raza-form"
        @click.self="cerrarModalRaza"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicionRaza ? `Raza #${store.editandoRazaId}` : 'Catálogo de razas' }}
              </p>
              <h2 id="modal-raza-titulo" class="gg-section-title">
                {{ store.esEdicionRaza ? 'Editar raza' : 'Nueva raza' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de raza"
              :disabled="store.guardandoRaza"
              @click="cerrarModalRaza"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarRaza">
            <div
              v-if="store.errorNegocioRaza"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="raza-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioRaza }}</span>
            </div>

            <div
              v-if="store.errorGeneralRaza"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="raza-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralRaza }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresRaza.nombre }">
              <label class="gg-field__label" for="raza-form-nombre">Nombre de la raza *</label>
              <input
                id="raza-form-nombre"
                v-model="store.formRaza.nombre"
                class="gg-input"
                type="text"
                maxlength="100"
                placeholder="Ej: Brahman"
                autocomplete="off"
                :disabled="store.guardandoRaza"
                :aria-invalid="Boolean(store.erroresRaza.nombre)"
                :aria-describedby="store.erroresRaza.nombre ? 'raza-form-nombre-error' : undefined"
                required
              />
              <p v-if="store.erroresRaza.nombre" id="raza-form-nombre-error" class="gg-field__error">
                {{ store.erroresRaza.nombre }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="store.guardandoRaza" data-testid="btn-guardar-raza">
                {{ store.guardandoRaza ? 'Guardando...' : store.esEdicionRaza ? 'Guardar cambios' : 'Crear raza' }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoRaza"
                @click="cerrarModalRaza"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ==================== MODAL 2: CREAR / EDITAR CATEGORÍA ==================== -->
      <div
        v-if="modalCategoriaAbierto && store.esAdmin"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-categoria-titulo"
        data-testid="modal-categoria-form"
        @click.self="cerrarModalCategoria"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicionCategoria ? `Categoría #${store.editandoCategoriaId}` : 'Catálogo de categorías' }}
              </p>
              <h2 id="modal-categoria-titulo" class="gg-section-title">
                {{ store.esEdicionCategoria ? 'Editar categoría' : 'Nueva categoría' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de categoría"
              :disabled="store.guardandoCategoria"
              @click="cerrarModalCategoria"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarCategoria">
            <div
              v-if="store.errorNegocioCategoria"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="categoria-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioCategoria }}</span>
            </div>

            <div
              v-if="store.errorGeneralCategoria"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="categoria-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralCategoria }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresCategoria.nombre }">
              <label class="gg-field__label" for="cat-ins-form-nombre">Nombre de la categoría *</label>
              <input
                id="cat-ins-form-nombre"
                v-model="store.formCategoria.nombre"
                class="gg-input"
                type="text"
                maxlength="100"
                placeholder="Ej: Suplementos"
                autocomplete="off"
                :disabled="store.guardandoCategoria"
                :aria-invalid="Boolean(store.erroresCategoria.nombre)"
                :aria-describedby="store.erroresCategoria.nombre ? 'cat-ins-form-nombre-error' : undefined"
                required
              />
              <p v-if="store.erroresCategoria.nombre" id="cat-ins-form-nombre-error" class="gg-field__error">
                {{ store.erroresCategoria.nombre }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresCategoria.tipo }">
              <label class="gg-field__label" for="cat-ins-form-tipo">Tipo (opcional)</label>
              <input
                id="cat-ins-form-tipo"
                v-model="store.formCategoria.tipo"
                class="gg-input"
                type="text"
                maxlength="50"
                list="gg-tipos-categoria-datalist"
                placeholder="Ej: Nutrición, Sanidad, Mantenimiento"
                autocomplete="off"
                :disabled="store.guardandoCategoria"
                :aria-invalid="Boolean(store.erroresCategoria.tipo)"
                :aria-describedby="store.erroresCategoria.tipo ? 'cat-ins-form-tipo-error' : undefined"
              />
              <datalist id="gg-tipos-categoria-datalist">
                <option v-for="t in TIPOS_CATEGORIA_REFERENCIA" :key="t" :value="t" />
              </datalist>
              <p v-if="store.erroresCategoria.tipo" id="cat-ins-form-tipo-error" class="gg-field__error">
                {{ store.erroresCategoria.tipo }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button
                type="submit"
                class="gg-btn"
                :disabled="store.guardandoCategoria"
                data-testid="btn-guardar-categoria"
              >
                {{
                  store.guardandoCategoria
                    ? 'Guardando...'
                    : store.esEdicionCategoria
                      ? 'Guardar cambios'
                      : 'Crear categoría'
                }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoCategoria"
                @click="cerrarModalCategoria"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ==================== MODAL 3: CREAR / EDITAR UNIDAD DE MEDIDA ==================== -->
      <div
        v-if="modalUnidadAbierto && store.esAdmin"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-unidad-titulo"
        data-testid="modal-unidad-form"
        @click.self="cerrarModalUnidad"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">
                {{ store.esEdicionUnidad ? `Unidad #${store.editandoUnidadId}` : 'Catálogo de unidades' }}
              </p>
              <h2 id="modal-unidad-titulo" class="gg-section-title">
                {{ store.esEdicionUnidad ? 'Editar unidad de medida' : 'Nueva unidad de medida' }}
              </h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar formulario de unidad de medida"
              :disabled="store.guardandoUnidad"
              @click="cerrarModalUnidad"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarUnidad">
            <div
              v-if="store.errorNegocioUnidad"
              class="gg-alert gg-alert--warning"
              role="alert"
              data-testid="unidad-error-409"
            >
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioUnidad }}</span>
            </div>

            <div
              v-if="store.errorGeneralUnidad"
              class="gg-alert gg-alert--danger"
              role="alert"
              data-testid="unidad-error-general"
            >
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralUnidad }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresUnidad.nombre }">
              <label class="gg-field__label" for="uni-form-nombre">Nombre de la unidad *</label>
              <input
                id="uni-form-nombre"
                v-model="store.formUnidad.nombre"
                class="gg-input"
                type="text"
                maxlength="100"
                placeholder="Ej: Kilogramo"
                autocomplete="off"
                :disabled="store.guardandoUnidad"
                :aria-invalid="Boolean(store.erroresUnidad.nombre)"
                :aria-describedby="store.erroresUnidad.nombre ? 'uni-form-nombre-error' : undefined"
                required
              />
              <p v-if="store.erroresUnidad.nombre" id="uni-form-nombre-error" class="gg-field__error">
                {{ store.erroresUnidad.nombre }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresUnidad.apertura }">
              <label class="gg-field__label" for="uni-form-apertura">Abreviatura (opcional)</label>
              <input
                id="uni-form-apertura"
                v-model="store.formUnidad.apertura"
                class="gg-input"
                type="text"
                maxlength="20"
                placeholder="Ej: kg, ml, L, saco"
                autocomplete="off"
                :disabled="store.guardandoUnidad"
                :aria-invalid="Boolean(store.erroresUnidad.apertura)"
                :aria-describedby="
                  store.erroresUnidad.apertura
                    ? 'uni-form-apertura-error uni-form-apertura-hint'
                    : 'uni-form-apertura-hint'
                "
              />
              <p id="uni-form-apertura-hint" class="gg-field__hint">
                Símbolo corto de la unidad (hasta 20 caracteres, almacenado en el campo <code>apertura</code>).
              </p>
              <p v-if="store.erroresUnidad.apertura" id="uni-form-apertura-error" class="gg-field__error">
                {{ store.erroresUnidad.apertura }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="store.guardandoUnidad" data-testid="btn-guardar-unidad">
                {{
                  store.guardandoUnidad ? 'Guardando...' : store.esEdicionUnidad ? 'Guardar cambios' : 'Crear unidad'
                }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoUnidad"
                @click="cerrarModalUnidad"
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

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import {
  mostrarToast,
  networkService,
  TIPOS_CATEGORIA_REFERENCIA,
  type Categoria,
  type Raza,
  type UnidadMedida,
} from '@/services';
import {
  OPCIONES_ORDEN_CATEGORIA,
  OPCIONES_ORDEN_RAZA,
  OPCIONES_ORDEN_UNIDAD_MEDIDA,
  useCatalogoAdminStore,
  type SegmentoCatalogo,
} from '@/stores/catalogoAdmin';

const store = useCatalogoAdminStore();

const segmento = ref<SegmentoCatalogo>('razas');
const modalRazaAbierto = ref<boolean>(false);
const modalCategoriaAbierto = ref<boolean>(false);
const modalUnidadAbierto = ref<boolean>(false);

let cancelarSuscripcionRed: (() => void) | null = null;

const tiposCategoriaDisponibles = computed<string[]>(() => {
  const conjunto = new Set<string>(TIPOS_CATEGORIA_REFERENCIA);
  for (const item of store.categorias) {
    if (item.tipo?.trim()) conjunto.add(item.tipo.trim());
  }
  return Array.from(conjunto);
});

function recargarSegmentoActivo(): Promise<void> {
  if (segmento.value === 'razas') return store.recargarRazas();
  if (segmento.value === 'categorias') return store.recargarCategorias();
  return store.recargarUnidades();
}

onMounted(() => {
  void recargarSegmentoActivo();
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void recargarSegmentoActivo();
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
  void recargarSegmentoActivo();
});

onIonViewWillLeave(() => {
  store.cancelarPendiente();
});

function cambiarSegmento(evento: CustomEvent): void {
  const valor = evento.detail?.value as SegmentoCatalogo | undefined;
  if (valor !== 'razas' && valor !== 'categorias' && valor !== 'unidades') return;
  segmento.value = valor;
  void recargarSegmentoActivo();
}

// -------- Razas --------
function abrirCrearRaza(): void {
  if (!store.esAdmin) return;
  store.prepararNuevaRaza();
  modalRazaAbierto.value = true;
}

function abrirEditarRaza(item: Raza): void {
  if (!store.esAdmin) return;
  store.prepararEdicionRaza(item);
  modalRazaAbierto.value = true;
}

function cerrarModalRaza(): void {
  if (store.guardandoRaza) return;
  modalRazaAbierto.value = false;
}

async function enviarRaza(): Promise<void> {
  const eraEdicion = store.esEdicionRaza;
  const guardado = await store.guardarRaza();
  if (!guardado) {
    if (store.errorNegocioRaza) {
      await mostrarToast(store.errorNegocioRaza, 'warning', 5000);
    }
    return;
  }
  modalRazaAbierto.value = false;
  await mostrarToast(eraEdicion ? 'Raza actualizada correctamente.' : 'Raza creada correctamente.', 'success', 2500);
}

async function confirmarEliminarRaza(item: Raza): Promise<void> {
  if (!store.esAdmin) return;
  const alerta = await alertController.create({
    header: 'Eliminar raza',
    message: `¿Seguro que deseas eliminar la raza "${item.nombre}"?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminarRaza(item.raza_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio (RN-05)',
      message: resultado.mensaje,
      buttons: ['Entendido'],
    });
    await alertaRegla.present();
    await mostrarToast(resultado.mensaje, 'warning', 5000);
  } else {
    await mostrarToast(resultado.mensaje, 'danger', 5000);
  }
}

// -------- Categorías --------
function abrirCrearCategoria(): void {
  if (!store.esAdmin) return;
  store.prepararNuevaCategoria();
  modalCategoriaAbierto.value = true;
}

function abrirEditarCategoria(item: Categoria): void {
  if (!store.esAdmin) return;
  store.prepararEdicionCategoria(item);
  modalCategoriaAbierto.value = true;
}

function cerrarModalCategoria(): void {
  if (store.guardandoCategoria) return;
  modalCategoriaAbierto.value = false;
}

async function enviarCategoria(): Promise<void> {
  const eraEdicion = store.esEdicionCategoria;
  const guardado = await store.guardarCategoria();
  if (!guardado) {
    if (store.errorNegocioCategoria) {
      await mostrarToast(store.errorNegocioCategoria, 'warning', 5000);
    }
    return;
  }
  modalCategoriaAbierto.value = false;
  await mostrarToast(
    eraEdicion ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminarCategoria(item: Categoria): Promise<void> {
  if (!store.esAdmin) return;
  const alerta = await alertController.create({
    header: 'Eliminar categoría',
    message: `¿Seguro que deseas eliminar la categoría "${item.nombre}"?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminarCategoria(item.categoria_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio (RN-04)',
      message: resultado.mensaje,
      buttons: ['Entendido'],
    });
    await alertaRegla.present();
    await mostrarToast(resultado.mensaje, 'warning', 5000);
  } else {
    await mostrarToast(resultado.mensaje, 'danger', 5000);
  }
}

// -------- Unidades de Medida --------
function abrirCrearUnidad(): void {
  if (!store.esAdmin) return;
  store.prepararNuevaUnidad();
  modalUnidadAbierto.value = true;
}

function abrirEditarUnidad(item: UnidadMedida): void {
  if (!store.esAdmin) return;
  store.prepararEdicionUnidad(item);
  modalUnidadAbierto.value = true;
}

function cerrarModalUnidad(): void {
  if (store.guardandoUnidad) return;
  modalUnidadAbierto.value = false;
}

async function enviarUnidad(): Promise<void> {
  const eraEdicion = store.esEdicionUnidad;
  const guardado = await store.guardarUnidad();
  if (!guardado) {
    if (store.errorNegocioUnidad) {
      await mostrarToast(store.errorNegocioUnidad, 'warning', 5000);
    }
    return;
  }
  modalUnidadAbierto.value = false;
  await mostrarToast(
    eraEdicion ? 'Unidad de medida actualizada correctamente.' : 'Unidad de medida creada correctamente.',
    'success',
    2500,
  );
}

async function confirmarEliminarUnidad(item: UnidadMedida): Promise<void> {
  if (!store.esAdmin) return;
  const alerta = await alertController.create({
    header: 'Eliminar unidad de medida',
    message: `¿Seguro que deseas eliminar la unidad "${item.nombre}"?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  const resultado = await store.eliminarUnidad(item.unidad_medida_id);
  if (resultado.ok) {
    await mostrarToast(resultado.mensaje, 'success', 2500);
    return;
  }

  if (resultado.esReglaDeNegocio) {
    const alertaRegla = await alertController.create({
      header: 'No se puede eliminar',
      subHeader: 'Regla de negocio (RN-07)',
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
  await recargarSegmentoActivo();
  (evento.target as HTMLIonRefresherElement).complete();
}

async function onInfiniteRazas(evento: CustomEvent): Promise<void> {
  await store.cargarMasRazas();
  if (store.mensajeErrorRazas && !store.errorRazas) {
    await mostrarToast(store.mensajeErrorRazas, 'danger', 4000);
  }
  (evento.target as HTMLIonInfiniteScrollElement).complete();
}

async function onInfiniteCategorias(evento: CustomEvent): Promise<void> {
  await store.cargarMasCategorias();
  if (store.mensajeErrorCategorias && !store.errorCategorias) {
    await mostrarToast(store.mensajeErrorCategorias, 'danger', 4000);
  }
  (evento.target as HTMLIonInfiniteScrollElement).complete();
}

async function onInfiniteUnidades(evento: CustomEvent): Promise<void> {
  await store.cargarMasUnidades();
  if (store.mensajeErrorUnidades && !store.errorUnidades) {
    await mostrarToast(store.mensajeErrorUnidades, 'danger', 4000);
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
  max-width: 34rem;
}

.gg-segment-wrap ion-segment {
  --background: var(--gg-surface);
  border: 1px solid var(--gg-border);
  border-radius: 0.75rem;
  padding: 0.2rem;
}

.gg-segment-wrap ion-segment-button {
  --color: var(--gg-ink-muted);
  --color-checked: #283618;
  --indicator-color: #283618;
  --background-checked: rgba(96, 108, 56, 0.12);
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

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
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

.gg-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
