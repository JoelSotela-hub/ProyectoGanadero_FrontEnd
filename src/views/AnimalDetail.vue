<template>
  <ion-page>
    <app-header :titulo="tituloHeader" :atras="rutaListadoRegreso">
      <ion-button
        v-if="esAdmin && store.animal"
        aria-label="Editar animal"
        data-testid="header-btn-editar-animal"
        @click="goToEdit"
      >
        <ion-icon slot="icon-only" :icon="createOutline" />
      </ion-button>
    </app-header>

    <ion-content class="gg-content">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="gg-page">
        <a
          class="gg-link gg-back"
          :href="rutaListadoRegreso"
          data-testid="link-volver-listado"
          @click.prevent="volverAlListado"
        >
          ← Volver al listado
        </a>

        <header class="gg-page-header">
          <div>
            <p class="gg-eyebrow">
              Ficha técnica{{ store.animal ? ` · ID #${store.animal.id}` : animalId ? ` · ID #${animalId}` : '' }}
            </p>
            <h1 class="gg-title">
              {{ store.animal ? `Arete ${store.animal.arete}` : 'Detalle del Animal' }}
            </h1>
            <p class="gg-subtitle">
              {{
                store.animal
                  ? `${store.animal.raza} · ${store.animal.sexo} · ${store.animal.potrero}`
                  : 'Consulta la ficha técnica, historial de pesajes y control sanitario.'
              }}
            </p>
          </div>

          <div v-if="store.animal" class="gg-actions">
            <span class="gg-badge" :class="claseEstado(store.animal.estado)" data-testid="badge-estado-animal">
              {{ store.animal.estado }}
            </span>
            <button v-if="esAdmin" type="button" class="gg-btn" data-testid="btn-editar-animal" @click="goToEdit">
              <ion-icon :icon="createOutline" aria-hidden="true" />
              Editar animal
            </button>
          </div>
        </header>

        <!-- Aviso obligatorio de datos no actualizados cuando el detalle se sirve desde la caché (Persona 4) -->
        <div
          v-if="store.mostrandoAvisoOffline"
          class="gg-alert gg-alert--warning"
          role="status"
          aria-live="polite"
          data-testid="offline-detail-banner"
        >
          <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
          <span>
            <strong>Datos no actualizados</strong> · Modo sin conexión (Última actualización:
            {{ store.ultimaActualizacionTexto }})
          </span>
        </div>

        <!-- Estado 1: Cargando -->
        <section v-if="store.loading" class="gg-card" aria-busy="true" aria-label="Cargando ficha del animal">
          <span class="gg-skeleton" style="width: 35%; height: 1.1rem; margin-bottom: 0.75rem" />
          <span class="gg-skeleton" style="width: 65%; height: 1.8rem; margin-bottom: 1.25rem" />
          <div class="gg-detail-grid">
            <span v-for="i in 6" :key="i" class="gg-skeleton" style="height: 3.2rem" />
          </div>
        </section>

        <!-- Estado 2: Error con opción de reintento -->
        <error-state
          v-else-if="store.error"
          title="No se pudo cargar el detalle"
          :message="store.errorMessage"
          @retry="recargarTodo"
        />

        <!-- Estado 3: Vacío / 404 No encontrado -->
        <section v-else-if="!store.animal" class="gg-card">
          <empty-state
            title="Animal no encontrado"
            :message="`No se encontró ningún registro asociado al identificador #${animalId}.`"
          >
            <button type="button" class="gg-btn gg-btn--outline" @click="volverAlListado">Volver al listado</button>
          </empty-state>
        </section>

        <!-- Estado 4: Datos con pestañas internas (ion-segment) -->
        <template v-else>
          <div class="gg-segment-bar">
            <ion-segment
              :value="tabActiva"
              class="gg-segment"
              aria-label="Secciones de la ficha del animal"
              @ionChange="cambiarTab(String($event.detail.value ?? 'resumen'))"
            >
              <ion-segment-button value="resumen" data-testid="tab-resumen" @click="cambiarTab('resumen')">
                <ion-label>Resumen</ion-label>
              </ion-segment-button>
              <ion-segment-button value="pesajes" data-testid="tab-pesajes" @click="cambiarTab('pesajes')">
                <ion-label>Pesajes</ion-label>
              </ion-segment-button>
              <!-- CRÍTICO POR ROL: Oculta completamente esta pestaña si el rol es operario -->
              <ion-segment-button
                v-if="puedeVerSanidad"
                value="sanidad"
                data-testid="tab-sanidad"
                @click="cambiarTab('sanidad')"
              >
                <ion-label>Sanidad / Tratamientos</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>

          <!-- ==================== PESTAÑA 1: RESUMEN (Sin fotografía) ==================== -->
          <div v-if="tabActiva === 'resumen'" class="gg-tab-panel" data-testid="panel-resumen">
            <div class="gg-summary-layout">
              <section class="gg-card" aria-labelledby="sec-ficha-tecnica">
                <div class="gg-section-head">
                  <div>
                    <p class="gg-eyebrow">Datos generales</p>
                    <h2 id="sec-ficha-tecnica" class="gg-section-title">Ficha técnica del animal</h2>
                  </div>
                </div>

                <dl class="gg-tech-dl">
                  <div class="gg-tech-item">
                    <dt>Número de arete</dt>
                    <dd data-testid="dato-numero-arete">{{ store.animal.arete }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Código QR</dt>
                    <dd class="gg-mono" data-testid="dato-codigo-qr">{{ codigoQrValor }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Sexo</dt>
                    <dd data-testid="dato-sexo">{{ store.animal.sexo }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Fecha de nacimiento</dt>
                    <dd data-testid="dato-fecha-nacimiento">{{ formatearFechaLarga(store.animal.fechaNacimiento) }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Estado</dt>
                    <dd data-testid="dato-estado">
                      <span class="gg-badge" :class="claseEstado(store.animal.estado)">
                        {{ store.animal.estado }}
                      </span>
                    </dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Raza</dt>
                    <dd data-testid="dato-raza">{{ store.animal.raza }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Potrero asignado</dt>
                    <dd data-testid="dato-potrero">{{ store.animal.potrero }}</dd>
                  </div>
                  <div class="gg-tech-item">
                    <dt>Último peso conocido</dt>
                    <dd data-testid="dato-peso">
                      {{
                        store.animal.peso === null || store.animal.peso === undefined
                          ? 'Sin registro'
                          : `${store.animal.peso} kg`
                      }}
                    </dd>
                  </div>
                </dl>

                <div class="gg-summary-actions">
                  <button
                    v-if="esAdmin"
                    type="button"
                    class="gg-btn"
                    data-testid="resumen-btn-editar"
                    @click="goToEdit"
                  >
                    <ion-icon :icon="createOutline" aria-hidden="true" />
                    Editar animal
                  </button>
                  <button
                    type="button"
                    class="gg-btn gg-btn--outline"
                    data-testid="resumen-btn-volver"
                    @click="volverAlListado"
                  >
                    <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
                    Volver al listado
                  </button>
                </div>
              </section>

              <!-- Tarjeta de Código QR generada dinámicamente en cliente (sin guardar imágenes ni fotos) -->
              <aside v-if="codigoQrValor" class="gg-card gg-qr-card" aria-labelledby="sec-qr-animal">
                <p class="gg-eyebrow">Identificación por escáner</p>
                <h2 id="sec-qr-animal" class="gg-section-title">Código QR del animal</h2>
                <div class="gg-qr-box">
                  <qrcode-vue :value="codigoQrValor" :size="176" level="H" render-as="svg" />
                </div>
                <p class="gg-qr-text">{{ codigoQrValor }}</p>
              </aside>
            </div>
          </div>

          <!-- ==================== PESTAÑA 2: PESAJES ==================== -->
          <div v-else-if="tabActiva === 'pesajes'" class="gg-tab-panel" data-testid="panel-pesajes">
            <div class="gg-section-head">
              <div>
                <p class="gg-eyebrow">Control de crecimiento</p>
                <h2 class="gg-section-title">Historial de pesajes</h2>
              </div>
              <!-- Botón rápido visible SOLO para admin y operario (oculto para veterinario -> 403) -->
              <button
                v-if="puedeRegistrarPesaje"
                type="button"
                class="gg-btn"
                data-testid="btn-abrir-modal-pesaje"
                @click="abrirModalPesaje"
              >
                <ion-icon :icon="addOutline" aria-hidden="true" />
                Registrar pesaje
              </button>
            </div>

            <!-- Resumen y tendencia de peso -->
            <div class="gg-kpi-grid" aria-label="Resumen y tendencia de peso">
              <div class="gg-kpi-card">
                <span class="gg-kpi-card__icon" aria-hidden="true">
                  <ion-icon :icon="scaleOutline" />
                </span>
                <div>
                  <p class="gg-kpi-card__label">Peso actual</p>
                  <p class="gg-kpi-card__value" data-testid="kpi-peso-actual">
                    {{ store.resumenPesajes.ultimoPeso !== null ? `${store.resumenPesajes.ultimoPeso} kg` : '—' }}
                  </p>
                  <p class="gg-kpi-card__hint">
                    {{
                      store.resumenPesajes.ultimaFecha
                        ? `Registrado el ${formatearFechaCorta(store.resumenPesajes.ultimaFecha)}`
                        : 'Sin pesajes registrados'
                    }}
                  </p>
                </div>
              </div>

              <div class="gg-kpi-card">
                <span
                  class="gg-kpi-card__icon"
                  :class="
                    store.resumenPesajes.tendencia === 'bajada'
                      ? 'gg-kpi-card__icon--earth'
                      : store.resumenPesajes.tendencia === 'subida'
                        ? ''
                        : 'gg-kpi-card__icon--neutral'
                  "
                  aria-hidden="true"
                >
                  <ion-icon
                    :icon="
                      store.resumenPesajes.tendencia === 'subida'
                        ? trendingUpOutline
                        : store.resumenPesajes.tendencia === 'bajada'
                          ? trendingDownOutline
                          : removeOutline
                    "
                  />
                </span>
                <div>
                  <p class="gg-kpi-card__label">Tendencia reciente</p>
                  <p class="gg-kpi-card__value" data-testid="kpi-tendencia-peso">
                    {{ textoVariacionPeso }}
                  </p>
                  <p class="gg-kpi-card__hint">{{ descripcionTendenciaPeso }}</p>
                </div>
              </div>

              <div class="gg-kpi-card">
                <span class="gg-kpi-card__icon gg-kpi-card__icon--neutral" aria-hidden="true">
                  <ion-icon :icon="analyticsOutline" />
                </span>
                <div>
                  <p class="gg-kpi-card__label">Total de pesajes</p>
                  <p class="gg-kpi-card__value" data-testid="kpi-total-pesajes">
                    {{ store.resumenPesajes.totalRegistros }}
                  </p>
                  <p class="gg-kpi-card__hint">Registros en el historial</p>
                </div>
              </div>
            </div>

            <!-- Estado 1 de Pesajes: Cargando -->
            <section
              v-if="store.cargandoPesajes"
              class="gg-card gg-card--flush"
              aria-busy="true"
              aria-label="Cargando pesajes"
            >
              <div v-for="i in 3" :key="i" class="gg-skeleton-row">
                <span class="gg-skeleton" style="width: 25%" />
                <span class="gg-skeleton" style="width: 20%" />
                <span class="gg-skeleton" style="width: 45%" />
              </div>
            </section>

            <!-- Estado 2 de Pesajes: Error con reintento -->
            <error-state
              v-else-if="store.errorPesajes"
              title="No se pudo cargar el historial de pesajes"
              :message="store.mensajeErrorPesajes"
              @retry="store.cargarPesajes(animalId)"
            />

            <!-- Estado 3 de Pesajes: Vacío -->
            <section v-else-if="!store.pesajes.length" class="gg-card">
              <empty-state
                title="Sin pesajes registrados"
                message="Aún no existen pesajes registrados para este animal."
              >
                <button
                  v-if="puedeRegistrarPesaje"
                  type="button"
                  class="gg-btn gg-btn--outline"
                  @click="abrirModalPesaje"
                >
                  Registrar primer pesaje
                </button>
              </empty-state>
            </section>

            <!-- Estado 4 de Pesajes: Datos -->
            <section v-else class="gg-card gg-card--flush" aria-label="Tabla de pesajes del animal">
              <div class="gg-table-wrapper">
                <table class="gg-table" data-testid="tabla-pesajes">
                  <caption class="gg-sr-only">
                    Historial cronológico de pesajes del animal
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Peso</th>
                      <th scope="col">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in store.pesajes" :key="p.pesaje_id">
                      <td data-label="Fecha">{{ formatearFechaCorta(p.fecha_pesaje) }}</td>
                      <td data-label="Peso">
                        <strong>{{ p.peso_kg }} kg</strong>
                      </td>
                      <td data-label="Observaciones">{{ p.observaciones || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="store.hayMasPesajes" class="gg-pagination-footer">
                <button
                  type="button"
                  class="gg-btn gg-btn--outline"
                  :disabled="store.cargandoMasPesajes"
                  @click="store.cargarMasPesajes(animalId)"
                >
                  {{ store.cargandoMasPesajes ? 'Cargando...' : 'Cargar más pesajes' }}
                </button>
              </div>
            </section>
          </div>

          <!-- ==================== PESTAÑA 3: SANIDAD / TRATAMIENTOS ==================== -->
          <!-- CRÍTICO POR ROL: nunca renderizar ni invocar si el rol es operario -->
          <div v-else-if="puedeVerSanidad && tabActiva === 'sanidad'" class="gg-tab-panel" data-testid="panel-sanidad">
            <div class="gg-section-head">
              <div>
                <p class="gg-eyebrow">Control sanitario</p>
                <h2 class="gg-section-title">Tratamientos aplicados</h2>
              </div>
              <button
                type="button"
                class="gg-btn"
                data-testid="btn-abrir-modal-tratamiento"
                @click="abrirModalTratamiento"
              >
                <ion-icon :icon="medkitOutline" aria-hidden="true" />
                Aplicar tratamiento
              </button>
            </div>

            <!-- Estado 1 de Sanidad: Cargando -->
            <section
              v-if="store.cargandoTratamientos"
              class="gg-card gg-card--flush"
              aria-busy="true"
              aria-label="Cargando tratamientos aplicados"
            >
              <div v-for="i in 3" :key="i" class="gg-skeleton-row">
                <span class="gg-skeleton" style="width: 30%" />
                <span class="gg-skeleton" style="width: 18%" />
                <span class="gg-skeleton" style="width: 22%" />
                <span class="gg-skeleton" style="width: 20%" />
              </div>
            </section>

            <!-- Estado 2 de Sanidad: Error con reintento -->
            <error-state
              v-else-if="store.errorTratamientos"
              title="No se pudo cargar el historial sanitario"
              :message="store.mensajeErrorTratamientos"
              @retry="store.cargarTratamientos(animalId)"
            />

            <!-- Estado 3 de Sanidad: Vacío -->
            <section v-else-if="!store.tratamientos.length" class="gg-card">
              <empty-state
                title="Sin tratamientos registrados"
                message="Este animal aún no tiene aplicaciones sanitarias registradas."
              >
                <button type="button" class="gg-btn gg-btn--outline" @click="abrirModalTratamiento">
                  Aplicar primer tratamiento
                </button>
              </empty-state>
            </section>

            <!-- Estado 4 de Sanidad: Datos -->
            <section v-else class="gg-card gg-card--flush" aria-label="Tabla de tratamientos aplicados">
              <div class="gg-table-wrapper">
                <table class="gg-table" data-testid="tabla-tratamientos">
                  <caption class="gg-sr-only">
                    Historial de tratamientos aplicados al animal
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tratamiento</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Fecha de aplicación</th>
                      <th scope="col">Dosis</th>
                      <th scope="col">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in store.tratamientos" :key="t.tratamiento_animal_id">
                      <td data-label="Tratamiento">
                        <strong>{{ t.tratamiento?.nombre ?? `Tratamiento #${t.tratamiento_id}` }}</strong>
                      </td>
                      <td data-label="Tipo">
                        <span class="gg-badge gg-badge--success">
                          {{ t.tratamiento?.tipo || 'Sanitario' }}
                        </span>
                      </td>
                      <td data-label="Fecha">{{ formatearFechaCorta(t.fecha_aplicacion) }}</td>
                      <td data-label="Dosis">{{ t.dosis_ml }} ml</td>
                      <td data-label="Observaciones">{{ t.observaciones || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="store.hayMasTratamientos" class="gg-pagination-footer">
                <button
                  type="button"
                  class="gg-btn gg-btn--outline"
                  :disabled="store.cargandoMasTratamientos"
                  @click="store.cargarMasTratamientos(animalId)"
                >
                  {{ store.cargandoMasTratamientos ? 'Cargando...' : 'Cargar más tratamientos' }}
                </button>
              </div>
            </section>
          </div>
        </template>
      </div>

      <!-- ==================== MODAL RÁPIDO: REGISTRAR PESAJE ==================== -->
      <div
        v-if="modalPesajeAbierto && puedeRegistrarPesaje"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pesaje-titulo"
        data-testid="modal-registrar-pesaje"
        @click.self="cerrarModalPesaje"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">Arete {{ store.animal?.arete }}</p>
              <h2 id="modal-pesaje-titulo" class="gg-section-title">Registrar pesaje</h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar modal de pesaje"
              :disabled="store.guardandoPesaje"
              @click="cerrarModalPesaje"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarPesaje">
            <div v-if="store.errorNegocioPesaje" class="gg-alert gg-alert--warning" role="alert">
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioPesaje }}</span>
            </div>
            <div v-if="store.errorGeneralPesaje" class="gg-alert gg-alert--danger" role="alert">
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralPesaje }}</span>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresPesaje.peso_kg }">
              <label class="gg-field__label" for="p-peso-kg">Peso (kg) *</label>
              <input
                id="p-peso-kg"
                v-model="store.formPesaje.peso_kg"
                class="gg-input"
                type="number"
                inputmode="decimal"
                min="0.01"
                max="9999.99"
                step="0.01"
                placeholder="Ej: 425.5"
                :disabled="store.guardandoPesaje"
                :aria-invalid="Boolean(store.erroresPesaje.peso_kg)"
                :aria-describedby="store.erroresPesaje.peso_kg ? 'p-peso-kg-error' : undefined"
                required
              />
              <p v-if="store.erroresPesaje.peso_kg" id="p-peso-kg-error" class="gg-field__error">
                {{ store.erroresPesaje.peso_kg }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresPesaje.fecha_pesaje }">
              <label class="gg-field__label" for="p-fecha-pesaje">Fecha del pesaje *</label>
              <input
                id="p-fecha-pesaje"
                v-model="store.formPesaje.fecha_pesaje"
                class="gg-input"
                type="date"
                :disabled="store.guardandoPesaje"
                :aria-invalid="Boolean(store.erroresPesaje.fecha_pesaje)"
                :aria-describedby="store.erroresPesaje.fecha_pesaje ? 'p-fecha-pesaje-error' : undefined"
                required
              />
              <p v-if="store.erroresPesaje.fecha_pesaje" id="p-fecha-pesaje-error" class="gg-field__error">
                {{ store.erroresPesaje.fecha_pesaje }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresPesaje.observaciones }">
              <label class="gg-field__label" for="p-observaciones">Observaciones (opcional)</label>
              <textarea
                id="p-observaciones"
                v-model="store.formPesaje.observaciones"
                class="gg-textarea"
                rows="2"
                placeholder="Notas sobre la condición corporal o báscula"
                :disabled="store.guardandoPesaje"
                :aria-invalid="Boolean(store.erroresPesaje.observaciones)"
                :aria-describedby="store.erroresPesaje.observaciones ? 'p-observaciones-error' : undefined"
              />
              <p v-if="store.erroresPesaje.observaciones" id="p-observaciones-error" class="gg-field__error">
                {{ store.erroresPesaje.observaciones }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button type="submit" class="gg-btn" :disabled="store.guardandoPesaje" data-testid="btn-guardar-pesaje">
                {{ store.guardandoPesaje ? 'Guardando...' : 'Guardar pesaje' }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoPesaje"
                @click="cerrarModalPesaje"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ==================== MODAL RÁPIDO: APLICAR TRATAMIENTO ==================== -->
      <div
        v-if="modalTratamientoAbierto && puedeVerSanidad"
        class="gg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-tratamiento-titulo"
        data-testid="modal-aplicar-tratamiento"
        @click.self="cerrarModalTratamiento"
      >
        <div class="gg-modal gg-card">
          <div class="gg-section-head">
            <div>
              <p class="gg-eyebrow">Arete {{ store.animal?.arete }}</p>
              <h2 id="modal-tratamiento-titulo" class="gg-section-title">Aplicar tratamiento</h2>
            </div>
            <button
              type="button"
              class="gg-btn gg-btn--ghost"
              aria-label="Cerrar modal de tratamiento"
              :disabled="store.guardandoTratamiento"
              @click="cerrarModalTratamiento"
            >
              Cancelar
            </button>
          </div>

          <form class="gg-modal-form" novalidate @submit.prevent="enviarTratamiento">
            <div v-if="store.errorNegocioTratamiento" class="gg-alert gg-alert--warning" role="alert">
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span><strong>Regla de negocio:</strong> {{ store.errorNegocioTratamiento }}</span>
            </div>
            <div v-if="store.errorGeneralTratamiento" class="gg-alert gg-alert--danger" role="alert">
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <span>{{ store.errorGeneralTratamiento }}</span>
            </div>
            <div v-if="store.errorCatalogoTratamientos" class="gg-alert gg-alert--warning" role="status">
              <ion-icon :icon="warningOutline" aria-hidden="true" />
              <span>{{ store.errorCatalogoTratamientos }}</span>
              <button type="button" class="gg-link" @click="store.cargarCatalogoTratamientos(true)">Reintentar</button>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresTratamiento.tratamiento_id }">
              <label class="gg-field__label" for="t-tratamiento-id">Tratamiento del catálogo *</label>
              <select
                id="t-tratamiento-id"
                v-model="store.formTratamiento.tratamiento_id"
                class="gg-select"
                :disabled="store.guardandoTratamiento || store.cargandoCatalogoTratamientos"
                :aria-invalid="Boolean(store.erroresTratamiento.tratamiento_id)"
                :aria-describedby="store.erroresTratamiento.tratamiento_id ? 't-tratamiento-id-error' : undefined"
                required
              >
                <option value="" disabled>
                  {{ store.cargandoCatalogoTratamientos ? 'Cargando catálogo...' : 'Selecciona un tratamiento' }}
                </option>
                <option
                  v-for="item in store.catalogoTratamientos"
                  :key="item.tratamiento_id"
                  :value="String(item.tratamiento_id)"
                >
                  {{ item.nombre }}{{ item.tipo ? ` (${item.tipo})` : '' }}
                </option>
              </select>
              <p v-if="store.erroresTratamiento.tratamiento_id" id="t-tratamiento-id-error" class="gg-field__error">
                {{ store.erroresTratamiento.tratamiento_id }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresTratamiento.fecha_aplicacion }">
              <label class="gg-field__label" for="t-fecha-aplicacion">Fecha de aplicación *</label>
              <input
                id="t-fecha-aplicacion"
                v-model="store.formTratamiento.fecha_aplicacion"
                class="gg-input"
                type="date"
                :disabled="store.guardandoTratamiento"
                :aria-invalid="Boolean(store.erroresTratamiento.fecha_aplicacion)"
                :aria-describedby="store.erroresTratamiento.fecha_aplicacion ? 't-fecha-aplicacion-error' : undefined"
                required
              />
              <p v-if="store.erroresTratamiento.fecha_aplicacion" id="t-fecha-aplicacion-error" class="gg-field__error">
                {{ store.erroresTratamiento.fecha_aplicacion }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresTratamiento.dosis_ml }">
              <label class="gg-field__label" for="t-dosis-ml">Dosis (ml) *</label>
              <input
                id="t-dosis-ml"
                v-model="store.formTratamiento.dosis_ml"
                class="gg-input"
                type="number"
                inputmode="decimal"
                min="0.01"
                max="9999.99"
                step="0.01"
                placeholder="Ej: 15"
                :disabled="store.guardandoTratamiento"
                :aria-invalid="Boolean(store.erroresTratamiento.dosis_ml)"
                :aria-describedby="store.erroresTratamiento.dosis_ml ? 't-dosis-ml-error' : undefined"
                required
              />
              <p v-if="store.erroresTratamiento.dosis_ml" id="t-dosis-ml-error" class="gg-field__error">
                {{ store.erroresTratamiento.dosis_ml }}
              </p>
            </div>

            <div class="gg-field" :class="{ 'gg-field--error': store.erroresTratamiento.observaciones }">
              <label class="gg-field__label" for="t-observaciones">Observaciones (opcional)</label>
              <textarea
                id="t-observaciones"
                v-model="store.formTratamiento.observaciones"
                class="gg-textarea"
                rows="2"
                placeholder="Lote de vacuna, vía de administración o reacciones"
                :disabled="store.guardandoTratamiento"
                :aria-invalid="Boolean(store.erroresTratamiento.observaciones)"
                :aria-describedby="store.erroresTratamiento.observaciones ? 't-observaciones-error' : undefined"
              />
              <p v-if="store.erroresTratamiento.observaciones" id="t-observaciones-error" class="gg-field__error">
                {{ store.erroresTratamiento.observaciones }}
              </p>
            </div>

            <div class="gg-modal-actions">
              <button
                type="submit"
                class="gg-btn"
                :disabled="store.guardandoTratamiento"
                data-testid="btn-guardar-tratamiento"
              >
                {{ store.guardandoTratamiento ? 'Aplicando...' : 'Guardar aplicación' }}
              </button>
              <button
                type="button"
                class="gg-btn gg-btn--outline"
                :disabled="store.guardandoTratamiento"
                @click="cerrarModalTratamiento"
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
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  onIonViewWillEnter,
  useBackButton,
} from '@ionic/vue';
import {
  addOutline,
  alertCircleOutline,
  analyticsOutline,
  arrowBackOutline,
  cloudOfflineOutline,
  createOutline,
  medkitOutline,
  removeOutline,
  scaleOutline,
  trendingDownOutline,
  trendingUpOutline,
  warningOutline,
} from 'ionicons/icons';
import QrcodeVue from 'qrcode.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useRol } from '@/composables/useRol';
import { esRutaDeListado, obtenerRutaListadoAnterior } from '@/router';
import { mostrarToast, networkService } from '@/services';
import { useAnimalDetalleStore } from '@/stores/animalDetalle';

type TabFicha = 'resumen' | 'pesajes' | 'sanidad';

const route = useRoute();
const router = useRouter();
const store = useAnimalDetalleStore();

const { esAdmin, esVeterinario, esOperario } = useRol();

/** CRÍTICO POR ROL: Sanidad/Tratamientos solo existe para admin y veterinario (403 para operario). */
const puedeVerSanidad = computed<boolean>(() => (esAdmin.value || esVeterinario.value) && !esOperario.value);

/** Solo admin y operario registran pesajes (403 para veterinario). */
const puedeRegistrarPesaje = computed<boolean>(() => esAdmin.value || esOperario.value);

const animalId = computed<string>(() => String(route.params.id ?? ''));

const tabActiva = ref<TabFicha>('resumen');
const modalPesajeAbierto = ref<boolean>(false);
const modalTratamientoAbierto = ref<boolean>(false);

const tituloHeader = computed<string>(() => (store.animal ? `Arete ${store.animal.arete}` : 'Detalle del Animal'));

const rutaListadoRegreso = computed<string>(() => obtenerRutaListadoAnterior());

const codigoQrValor = computed<string>(() => {
  if (!store.animal) return '';
  return store.animal.codigo_qr || store.animal.codigoQr || `VACA-${store.animal.arete}`;
});

const textoVariacionPeso = computed<string>(() => {
  const diff = store.resumenPesajes.diferenciaKg;
  if (diff === null) {
    return store.resumenPesajes.totalRegistros === 1 ? 'Base' : '—';
  }
  if (diff > 0) return `+${diff} kg`;
  if (diff < 0) return `${diff} kg`;
  return '0 kg';
});

const descripcionTendenciaPeso = computed<string>(() => {
  const r = store.resumenPesajes;
  if (r.totalRegistros === 0) return 'Sin historial previo';
  if (r.totalRegistros === 1) return 'Primer registro del animal';
  if (r.tendencia === 'subida') return `Subió respecto a ${r.pesoAnterior} kg`;
  if (r.tendencia === 'bajada') return `Bajó respecto a ${r.pesoAnterior} kg`;
  return `Estable respecto a ${r.pesoAnterior} kg`;
});

function claseEstado(estado: string): string {
  if (estado === 'Activo') return 'gg-badge--success';
  if (estado === 'Tratamiento') return 'gg-badge--warning';
  return 'gg-badge--neutral';
}

function formatearFechaCorta(iso?: string | null): string {
  if (!iso) return '—';
  const limpio = iso.slice(0, 10);
  const [anio, mes, dia] = limpio.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

function formatearFechaLarga(iso?: string | null): string {
  if (!iso) return 'Sin registro';
  return formatearFechaCorta(iso);
}

function cambiarTab(nuevaTab: string): void {
  if (nuevaTab === 'sanidad' && !puedeVerSanidad.value) {
    tabActiva.value = 'resumen';
    return;
  }
  const tab = (nuevaTab === 'pesajes' || nuevaTab === 'sanidad' ? nuevaTab : 'resumen') as TabFicha;
  tabActiva.value = tab;

  if (tab === 'pesajes' && animalId.value && store.pesajesAnimalId !== animalId.value) {
    void store.cargarPesajes(animalId.value);
  } else if (
    tab === 'sanidad' &&
    puedeVerSanidad.value &&
    animalId.value &&
    store.tratamientosAnimalId !== animalId.value
  ) {
    void store.cargarTratamientos(animalId.value);
  }
}

watch(puedeVerSanidad, (permitido) => {
  if (!permitido && tabActiva.value === 'sanidad') {
    tabActiva.value = 'resumen';
  }
});

async function cargarVista(forzar = false): Promise<void> {
  if (!animalId.value) return;
  await store.cargarAnimal(animalId.value, forzar);

  if (!store.animal) return;

  if (tabActiva.value === 'pesajes') {
    await store.cargarPesajes(animalId.value);
  } else if (tabActiva.value === 'sanidad' && puedeVerSanidad.value) {
    await store.cargarTratamientos(animalId.value);
  }
}

async function recargarTodo(): Promise<void> {
  await cargarVista(true);
}

async function onRefresh(evento: CustomEvent): Promise<void> {
  await recargarTodo();
  (evento.target as HTMLIonRefresherElement).complete();
}

// ---------------- Modales rápidos ----------------
function abrirModalPesaje(): void {
  if (!puedeRegistrarPesaje.value) return;
  store.reiniciarFormPesaje();
  modalPesajeAbierto.value = true;
}

function cerrarModalPesaje(): void {
  modalPesajeAbierto.value = false;
}

async function enviarPesaje(): Promise<void> {
  const ok = await store.registrarPesaje(animalId.value);
  if (!ok) {
    if (store.errorNegocioPesaje) {
      await mostrarToast(store.errorNegocioPesaje, 'warning', 5000);
    }
    return;
  }
  modalPesajeAbierto.value = false;
  await mostrarToast('Pesaje registrado correctamente.', 'success', 2500);
}

function abrirModalTratamiento(): void {
  if (!puedeVerSanidad.value) return;
  store.reiniciarFormTratamiento();
  modalTratamientoAbierto.value = true;
  void store.cargarCatalogoTratamientos();
}

function cerrarModalTratamiento(): void {
  modalTratamientoAbierto.value = false;
}

async function enviarTratamiento(): Promise<void> {
  const ok = await store.aplicarTratamiento(animalId.value);
  if (!ok) {
    if (store.errorNegocioTratamiento) {
      await mostrarToast(store.errorNegocioTratamiento, 'warning', 5000);
    }
    return;
  }
  modalTratamientoAbierto.value = false;
  await mostrarToast('Tratamiento aplicado correctamente.', 'success', 2500);
}

// ---------------- Navegación y botón físico atrás de Android ----------------
function goToEdit(): void {
  if (!esAdmin.value) return;
  void router.push({
    path: '/tabs/registro',
    query: { id: animalId.value },
  });
}

/**
 * Regresa siempre al listado anterior (ej. `/tabs/animales`), nunca al Dashboard.
 * Si hay un modal abierto, el botón atrás cierra primero el modal.
 */
function volverAlListado(): void {
  if (modalPesajeAbierto.value) {
    cerrarModalPesaje();
    return;
  }
  if (modalTratamientoAbierto.value) {
    cerrarModalTratamiento();
    return;
  }

  const backEnHistorial =
    typeof window !== 'undefined' ? (window.history.state?.back as string | undefined) : undefined;

  if (esRutaDeListado(backEnHistorial)) {
    router.back();
  } else {
    void router.push(obtenerRutaListadoAnterior());
  }
}

// Intercepta el botón físico atrás de Android en Ionic con prioridad superior a IonTabs
useBackButton(20, () => {
  volverAlListado();
});

onIonViewWillEnter(() => {
  void cargarVista(false);
});

let cancelarSuscripcionRed: (() => void) | null = null;

onMounted(() => {
  void cargarVista(false);
  cancelarSuscripcionRed = networkService.suscribirCambioDeRed((conectado) => {
    if (conectado) {
      void recargarTodo();
    } else {
      store.marcarSinConexion();
    }
  });
});

onUnmounted(() => {
  cancelarSuscripcionRed?.();
});
</script>

<style scoped>
.gg-back {
  align-self: flex-start;
}

.gg-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.gg-detail-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1fr;
}
@media (min-width: 40rem) {
  .gg-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-segment-bar {
  background: var(--gg-surface);
  border: 1px solid var(--gg-border);
  border-radius: var(--gg-radius-lg);
  padding: 0.35rem;
  box-shadow: var(--gg-shadow);
}

.gg-segment {
  --background: transparent;
}

.gg-segment ion-segment-button {
  --color: var(--gg-ink-muted);
  --color-checked: #283618;
  --indicator-color: #283618;
  --background-checked: rgba(96, 108, 56, 0.12);
  --border-radius: 0.65rem;
  font-weight: 600;
  min-height: 2.5rem;
  text-transform: none;
}

.gg-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.gg-summary-layout {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: 1fr;
  align-items: start;
}
@media (min-width: 56rem) {
  .gg-summary-layout {
    grid-template-columns: minmax(0, 1fr) 18.5rem;
  }
}

.gg-tech-dl {
  margin: 0;
  display: grid;
  gap: 0.85rem;
  grid-template-columns: 1fr;
}
@media (min-width: 36rem) {
  .gg-tech-dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gg-tech-item {
  padding: 0.75rem 0.9rem;
  background: var(--gg-canvas-alt);
  border: 1px solid var(--gg-border);
  border-radius: var(--gg-radius);
}

.gg-tech-item dt {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gg-ink-muted);
  margin-bottom: 0.25rem;
}

.gg-tech-item dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gg-ink);
  word-break: break-word;
}

.gg-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.gg-summary-actions {
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.gg-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.65rem;
}

.gg-qr-box {
  margin-top: 0.35rem;
  background: #ffffff;
  padding: 0.85rem;
  border-radius: var(--gg-radius);
  border: 1px solid var(--gg-border);
  display: inline-flex;
}

.gg-qr-text {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gg-ink);
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

.gg-pagination-footer {
  padding: 0.9rem 1.25rem;
  border-top: 1px solid var(--gg-border);
  display: flex;
  justify-content: center;
}

/* Modales accesibles con estética GuateGanado */
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
  max-width: 32rem;
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
