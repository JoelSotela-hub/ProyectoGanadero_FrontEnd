/**
 * Store de Pinia para la Ficha Técnica del Animal (`AnimalDetail.vue`) y búsqueda por QR.
 *
 * Centraliza todo el consumo de API de la Fase 1 (sin tokens manuales):
 *   1. Ficha técnica: GET /api/v1/animales/{id} (con caché offline) y GET /api/v1/animales/qr/{codigo_qr}
 *   2. Pestaña Pesajes: GET /api/v1/animales/{id}/pesajes + POST /api/v1/animales/{id}/pesajes
 *   3. Pestaña Sanidad / Tratamientos (solo admin y veterinario; prohibido para operario):
 *      GET /api/v1/animales/{id}/tratamientos + GET /api/v1/tratamientos?per_page=100 +
 *      POST /api/v1/tratamientos-aplicaciones
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import type { AnimalItem } from '@/models/auth.model';
import {
  animalService,
  ApiError,
  formatearMarcaDeTiempo,
  mensajeDeError,
  networkService,
  pesajeService,
  tratamientoService,
  type ApiLinks,
  type ApiMeta,
  type PesajeAnimal,
  type TratamientoAplicacion,
  type TratamientoCatalogo,
} from '@/services';
import { useAuthStore } from '@/stores/auth';

export type CampoFormPesaje = 'peso_kg' | 'fecha_pesaje' | 'observaciones';
export type CampoFormTratamiento = 'tratamiento_id' | 'fecha_aplicacion' | 'dosis_ml' | 'observaciones' | 'id_animal';

export interface ResumenTendenciaPeso {
  ultimoPeso: number | null;
  ultimaFecha: string | null;
  pesoAnterior: number | null;
  pesoInicial: number | null;
  diferenciaKg: number | null;
  tendencia: 'subida' | 'bajada' | 'estable' | 'sin_datos';
  totalRegistros: number;
}

function fechaHoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useAnimalDetalleStore = defineStore('animalDetalle', () => {
  const authStore = useAuthStore();

  // ---------------- 1. Ficha técnica del animal ----------------
  const animal = ref<AnimalItem | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<boolean>(false);
  const errorMessage = ref<string>('');
  const desdeCache = ref<boolean>(false);
  const ultimaActualizacion = ref<string | null>(null);
  const precargadoPorQrId = ref<string | null>(null);

  const mostrandoAvisoOffline = computed<boolean>(
    () => Boolean(animal.value) && (desdeCache.value || !networkService.isOnline.value),
  );
  const ultimaActualizacionTexto = computed<string>(() => formatearMarcaDeTiempo(ultimaActualizacion.value));

  // ---------------- 2. Pestaña Pesajes ----------------
  const pesajes = ref<PesajeAnimal[]>([]);
  const pesajesMeta = ref<ApiMeta | null>(null);
  const pesajesLinks = ref<ApiLinks | null>(null);
  const cargandoPesajes = ref<boolean>(false);
  const cargandoMasPesajes = ref<boolean>(false);
  const errorPesajes = ref<boolean>(false);
  const mensajeErrorPesajes = ref<string>('');
  const pesajesAnimalId = ref<string | null>(null);

  const hayMasPesajes = computed<boolean>(() => {
    if (!pesajesMeta.value) return false;
    return pesajesMeta.value.current_page < pesajesMeta.value.last_page;
  });

  const resumenPesajes = computed<ResumenTendenciaPeso>(() => {
    const lista = pesajes.value;
    const totalRegistros = pesajesMeta.value?.total ?? lista.length;
    if (!lista.length) {
      return {
        ultimoPeso: animal.value?.peso ?? null,
        ultimaFecha: null,
        pesoAnterior: null,
        pesoInicial: null,
        diferenciaKg: null,
        tendencia: 'sin_datos',
        totalRegistros: 0,
      };
    }

    const ultimo = lista[0];
    const anterior = lista.length > 1 ? lista[1] : null;
    const inicial = lista[lista.length - 1];
    const diferencia = anterior !== null ? Number((ultimo.peso_kg - anterior.peso_kg).toFixed(2)) : null;

    let tendencia: ResumenTendenciaPeso['tendencia'] = 'estable';
    if (diferencia !== null) {
      if (diferencia > 0) tendencia = 'subida';
      else if (diferencia < 0) tendencia = 'bajada';
    }

    return {
      ultimoPeso: ultimo.peso_kg,
      ultimaFecha: ultimo.fecha_pesaje,
      pesoAnterior: anterior?.peso_kg ?? null,
      pesoInicial: inicial?.peso_kg ?? null,
      diferenciaKg: diferencia,
      tendencia,
      totalRegistros,
    };
  });

  const formPesaje = reactive({
    peso_kg: '',
    fecha_pesaje: fechaHoyIso(),
    observaciones: '',
  });

  const erroresPesaje = reactive<Record<CampoFormPesaje, string>>({
    peso_kg: '',
    fecha_pesaje: '',
    observaciones: '',
  });
  const errorNegocioPesaje = ref<string>('');
  const errorGeneralPesaje = ref<string>('');
  const guardandoPesaje = ref<boolean>(false);

  // ---------------- 3. Pestaña Sanidad / Tratamientos ----------------
  const tratamientos = ref<TratamientoAplicacion[]>([]);
  const tratamientosMeta = ref<ApiMeta | null>(null);
  const tratamientosLinks = ref<ApiLinks | null>(null);
  const cargandoTratamientos = ref<boolean>(false);
  const cargandoMasTratamientos = ref<boolean>(false);
  const errorTratamientos = ref<boolean>(false);
  const mensajeErrorTratamientos = ref<string>('');
  const tratamientosAnimalId = ref<string | null>(null);

  const catalogoTratamientos = ref<TratamientoCatalogo[]>([]);
  const cargandoCatalogoTratamientos = ref<boolean>(false);
  const errorCatalogoTratamientos = ref<string>('');

  const hayMasTratamientos = computed<boolean>(() => {
    if (!tratamientosMeta.value) return false;
    return tratamientosMeta.value.current_page < tratamientosMeta.value.last_page;
  });

  const formTratamiento = reactive({
    tratamiento_id: '',
    fecha_aplicacion: fechaHoyIso(),
    dosis_ml: '',
    observaciones: '',
  });

  const erroresTratamiento = reactive<Record<CampoFormTratamiento, string>>({
    tratamiento_id: '',
    fecha_aplicacion: '',
    dosis_ml: '',
    observaciones: '',
    id_animal: '',
  });
  const errorNegocioTratamiento = ref<string>('');
  const errorGeneralTratamiento = ref<string>('');
  const guardandoTratamiento = ref<boolean>(false);

  /** True únicamente para `admin` y `veterinario`. El `operario` tiene prohibido el módulo Sanidad (403). */
  function rolPuedeVerSanidad(): boolean {
    const rol = (authStore.user?.role ?? '').toLowerCase();
    return rol === 'admin' || rol === 'veterinario';
  }

  /** True únicamente para `admin` y `operario`. El `veterinario` recibe 403 al crear pesajes. */
  function rolPuedeRegistrarPesaje(): boolean {
    const rol = (authStore.user?.role ?? '').toLowerCase();
    return rol === 'admin' || rol === 'operario';
  }

  function limpiarSubmodulosSiCambiaAnimal(id: string): void {
    if (pesajesAnimalId.value && pesajesAnimalId.value !== id) {
      pesajes.value = [];
      pesajesMeta.value = null;
      pesajesLinks.value = null;
      pesajesAnimalId.value = null;
      errorPesajes.value = false;
      mensajeErrorPesajes.value = '';
    }
    if (tratamientosAnimalId.value && tratamientosAnimalId.value !== id) {
      tratamientos.value = [];
      tratamientosMeta.value = null;
      tratamientosLinks.value = null;
      tratamientosAnimalId.value = null;
      errorTratamientos.value = false;
      mensajeErrorTratamientos.value = '';
    }
  }

  /**
   * Carga la ficha técnica desde GET /api/v1/animales/{id} con soporte offline.
   * Si el animal acaba de resolverse por QR (`buscarPorQr`), reutiliza la ficha ya cargada.
   */
  async function cargarAnimal(id: number | string, forzar = false): Promise<void> {
    const idStr = String(id);
    limpiarSubmodulosSiCambiaAnimal(idStr);

    if (!forzar && precargadoPorQrId.value === idStr && animal.value && String(animal.value.id) === idStr) {
      precargadoPorQrId.value = null;
      loading.value = false;
      error.value = false;
      errorMessage.value = '';
      return;
    }

    loading.value = true;
    error.value = false;
    errorMessage.value = '';

    try {
      const resultado = await animalService.obtenerConCache(idStr);
      animal.value = resultado.item;
      desdeCache.value = resultado.desdeCache;
      ultimaActualizacion.value = resultado.ultimaActualizacion;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        animal.value = null;
      } else {
        error.value = true;
        errorMessage.value = mensajeDeError(err, 'Error al consultar el detalle.');
      }
    } finally {
      loading.value = false;
    }
  }

  /**
   * Consulta GET /api/v1/animales/qr/{codigo_qr} y deja el animal cargado en el store
   * para navegar inmediatamente a `AnimalDetail.vue`.
   */
  async function buscarPorQr(codigoQr: string): Promise<AnimalItem> {
    const encontrado = await animalService.obtenerPorQr(codigoQr);
    const idStr = String(encontrado.id);
    limpiarSubmodulosSiCambiaAnimal(idStr);
    animal.value = encontrado;
    desdeCache.value = false;
    ultimaActualizacion.value = new Date().toISOString();
    error.value = false;
    errorMessage.value = '';
    loading.value = false;
    precargadoPorQrId.value = idStr;
    return encontrado;
  }

  // ---------------- Acciones de Pesajes ----------------
  async function cargarPesajes(idAnimal: number | string, pagina = 1, anexar = false): Promise<void> {
    const idStr = String(idAnimal);
    if (!idStr) return;

    mensajeErrorPesajes.value = '';
    if (anexar) {
      cargandoMasPesajes.value = true;
    } else {
      cargandoPesajes.value = true;
      errorPesajes.value = false;
    }

    try {
      const respuesta = await pesajeService.listarPorAnimal(idStr, {
        page: pagina,
        per_page: 15,
        sort_by: 'fecha_pesaje',
        order: 'desc',
      });

      pesajes.value = anexar ? [...pesajes.value, ...respuesta.data] : respuesta.data;
      pesajesMeta.value = respuesta.meta;
      pesajesLinks.value = respuesta.links;
      pesajesAnimalId.value = idStr;

      if (animal.value && String(animal.value.id) === idStr && pesajes.value.length > 0) {
        animal.value = { ...animal.value, peso: pesajes.value[0].peso_kg };
      }
    } catch (err) {
      if (anexar) {
        mensajeErrorPesajes.value = mensajeDeError(err, 'No se pudieron cargar más pesajes.');
      } else {
        errorPesajes.value = true;
        mensajeErrorPesajes.value = mensajeDeError(err, 'No se pudo cargar el historial de pesajes.');
        pesajes.value = [];
      }
    } finally {
      cargandoPesajes.value = false;
      cargandoMasPesajes.value = false;
    }
  }

  async function cargarMasPesajes(idAnimal: number | string): Promise<void> {
    if (!hayMasPesajes.value || cargandoMasPesajes.value || cargandoPesajes.value) return;
    const siguiente = (pesajesMeta.value?.current_page ?? 1) + 1;
    await cargarPesajes(idAnimal, siguiente, true);
  }

  function limpiarErroresPesaje(): void {
    erroresPesaje.peso_kg = '';
    erroresPesaje.fecha_pesaje = '';
    erroresPesaje.observaciones = '';
    errorNegocioPesaje.value = '';
    errorGeneralPesaje.value = '';
  }

  function reiniciarFormPesaje(): void {
    formPesaje.peso_kg = '';
    formPesaje.fecha_pesaje = fechaHoyIso();
    formPesaje.observaciones = '';
    limpiarErroresPesaje();
  }

  function validarFormPesaje(): boolean {
    limpiarErroresPesaje();

    const textoPeso = String(formPesaje.peso_kg ?? '').trim();
    const peso = Number(textoPeso);
    if (!textoPeso) {
      erroresPesaje.peso_kg = 'El peso en kilogramos es obligatorio.';
    } else if (!Number.isFinite(peso) || peso <= 0 || peso > 9999.99) {
      erroresPesaje.peso_kg = 'Ingresa un peso válido entre 0.01 y 9999.99 kg.';
    }

    if (!formPesaje.fecha_pesaje.trim()) {
      erroresPesaje.fecha_pesaje = 'La fecha del pesaje es obligatoria.';
    }

    return !erroresPesaje.peso_kg && !erroresPesaje.fecha_pesaje && !erroresPesaje.observaciones;
  }

  async function registrarPesaje(idAnimal: number | string): Promise<boolean> {
    if (!rolPuedeRegistrarPesaje()) {
      errorGeneralPesaje.value = 'No tienes permiso para registrar pesajes.';
      return false;
    }
    if (!validarFormPesaje()) return false;

    guardandoPesaje.value = true;
    try {
      await pesajeService.crearParaAnimal(idAnimal, {
        peso_kg: Number(formPesaje.peso_kg),
        fecha_pesaje: formPesaje.fecha_pesaje.trim(),
        observaciones: formPesaje.observaciones.trim() || null,
      });
      await cargarPesajes(idAnimal, 1, false);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(erroresPesaje) as CampoFormPesaje[]).forEach((campo) => {
            if (porCampo[campo]) erroresPesaje[campo] = porCampo[campo];
          });
          errorGeneralPesaje.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioPesaje.value = err.message;
        } else {
          errorGeneralPesaje.value = err.message;
        }
      } else {
        errorGeneralPesaje.value = mensajeDeError(err, 'No se pudo registrar el pesaje.');
      }
      return false;
    } finally {
      guardandoPesaje.value = false;
    }
  }

  // ---------------- Acciones de Sanidad / Tratamientos ----------------
  async function cargarTratamientos(idAnimal: number | string, pagina = 1, anexar = false): Promise<void> {
    // CRÍTICO POR ROL: nunca llamar a /animales/{id}/tratamientos si el usuario es operario (403).
    if (!rolPuedeVerSanidad()) {
      tratamientos.value = [];
      tratamientosMeta.value = null;
      tratamientosLinks.value = null;
      return;
    }

    const idStr = String(idAnimal);
    if (!idStr) return;

    mensajeErrorTratamientos.value = '';
    if (anexar) {
      cargandoMasTratamientos.value = true;
    } else {
      cargandoTratamientos.value = true;
      errorTratamientos.value = false;
    }

    try {
      const respuesta = await tratamientoService.listarPorAnimal(idStr, {
        page: pagina,
        per_page: 15,
        sort_by: 'fecha_aplicacion',
        order: 'desc',
      });

      tratamientos.value = anexar ? [...tratamientos.value, ...respuesta.data] : respuesta.data;
      tratamientosMeta.value = respuesta.meta;
      tratamientosLinks.value = respuesta.links;
      tratamientosAnimalId.value = idStr;
    } catch (err) {
      if (anexar) {
        mensajeErrorTratamientos.value = mensajeDeError(err, 'No se pudieron cargar más tratamientos.');
      } else {
        errorTratamientos.value = true;
        mensajeErrorTratamientos.value = mensajeDeError(err, 'No se pudo cargar el historial sanitario.');
        tratamientos.value = [];
      }
    } finally {
      cargandoTratamientos.value = false;
      cargandoMasTratamientos.value = false;
    }
  }

  async function cargarMasTratamientos(idAnimal: number | string): Promise<void> {
    if (!rolPuedeVerSanidad()) return;
    if (!hayMasTratamientos.value || cargandoMasTratamientos.value || cargandoTratamientos.value) return;
    const siguiente = (tratamientosMeta.value?.current_page ?? 1) + 1;
    await cargarTratamientos(idAnimal, siguiente, true);
  }

  async function cargarCatalogoTratamientos(forzar = false): Promise<void> {
    if (!rolPuedeVerSanidad()) return;
    if (catalogoTratamientos.value.length > 0 && !forzar) return;

    cargandoCatalogoTratamientos.value = true;
    errorCatalogoTratamientos.value = '';
    try {
      const respuesta = await tratamientoService.listarCatalogo({ per_page: 100 });
      catalogoTratamientos.value = respuesta.data;
    } catch (err) {
      errorCatalogoTratamientos.value = mensajeDeError(err, 'No se pudo cargar el catálogo de tratamientos.');
    } finally {
      cargandoCatalogoTratamientos.value = false;
    }
  }

  function limpiarErroresTratamiento(): void {
    erroresTratamiento.tratamiento_id = '';
    erroresTratamiento.fecha_aplicacion = '';
    erroresTratamiento.dosis_ml = '';
    erroresTratamiento.observaciones = '';
    erroresTratamiento.id_animal = '';
    errorNegocioTratamiento.value = '';
    errorGeneralTratamiento.value = '';
  }

  function reiniciarFormTratamiento(): void {
    formTratamiento.tratamiento_id = '';
    formTratamiento.fecha_aplicacion = fechaHoyIso();
    formTratamiento.dosis_ml = '';
    formTratamiento.observaciones = '';
    limpiarErroresTratamiento();
  }

  function validarFormTratamiento(): boolean {
    limpiarErroresTratamiento();

    if (!String(formTratamiento.tratamiento_id ?? '').trim()) {
      erroresTratamiento.tratamiento_id = 'Selecciona un tratamiento del catálogo.';
    }

    if (!formTratamiento.fecha_aplicacion.trim()) {
      erroresTratamiento.fecha_aplicacion = 'La fecha de aplicación es obligatoria.';
    }

    const textoDosis = String(formTratamiento.dosis_ml ?? '').trim();
    const dosis = Number(textoDosis);
    if (!textoDosis) {
      erroresTratamiento.dosis_ml = 'La dosis en mililitros (ml) es obligatoria.';
    } else if (!Number.isFinite(dosis) || dosis <= 0 || dosis > 9999.99) {
      erroresTratamiento.dosis_ml = 'Ingresa una dosis válida entre 0.01 y 9999.99 ml.';
    }

    return (
      !erroresTratamiento.tratamiento_id &&
      !erroresTratamiento.fecha_aplicacion &&
      !erroresTratamiento.dosis_ml &&
      !erroresTratamiento.observaciones
    );
  }

  async function aplicarTratamiento(idAnimal: number | string): Promise<boolean> {
    if (!rolPuedeVerSanidad()) {
      errorGeneralTratamiento.value = 'No tienes permiso para aplicar tratamientos.';
      return false;
    }
    if (!validarFormTratamiento()) return false;

    guardandoTratamiento.value = true;
    try {
      await tratamientoService.aplicarTratamiento({
        id_animal: Number(idAnimal),
        tratamiento_id: Number(formTratamiento.tratamiento_id),
        fecha_aplicacion: formTratamiento.fecha_aplicacion.trim(),
        dosis_ml: Number(formTratamiento.dosis_ml),
        observaciones: formTratamiento.observaciones.trim() || null,
      });
      // Recargar el historial porque store() devuelve 201 sin la relación `tratamiento` anidada.
      await cargarTratamientos(idAnimal, 1, false);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(erroresTratamiento) as CampoFormTratamiento[]).forEach((campo) => {
            if (porCampo[campo]) erroresTratamiento[campo] = porCampo[campo];
          });
          errorGeneralTratamiento.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocioTratamiento.value = err.message;
        } else {
          errorGeneralTratamiento.value = err.message;
        }
      } else {
        errorGeneralTratamiento.value = mensajeDeError(err, 'No se pudo registrar la aplicación del tratamiento.');
      }
      return false;
    } finally {
      guardandoTratamiento.value = false;
    }
  }

  function marcarSinConexion(): void {
    if (animal.value) {
      desdeCache.value = true;
    }
  }

  return {
    // Ficha técnica
    animal,
    loading,
    error,
    errorMessage,
    desdeCache,
    ultimaActualizacion,
    mostrandoAvisoOffline,
    ultimaActualizacionTexto,
    cargarAnimal,
    buscarPorQr,
    marcarSinConexion,

    // Pesajes
    pesajes,
    pesajesMeta,
    pesajesLinks,
    cargandoPesajes,
    cargandoMasPesajes,
    errorPesajes,
    mensajeErrorPesajes,
    pesajesAnimalId,
    hayMasPesajes,
    resumenPesajes,
    formPesaje,
    erroresPesaje,
    errorNegocioPesaje,
    errorGeneralPesaje,
    guardandoPesaje,
    cargarPesajes,
    cargarMasPesajes,
    reiniciarFormPesaje,
    validarFormPesaje,
    registrarPesaje,

    // Sanidad / Tratamientos
    tratamientos,
    tratamientosMeta,
    tratamientosLinks,
    cargandoTratamientos,
    cargandoMasTratamientos,
    errorTratamientos,
    mensajeErrorTratamientos,
    tratamientosAnimalId,
    hayMasTratamientos,
    catalogoTratamientos,
    cargandoCatalogoTratamientos,
    errorCatalogoTratamientos,
    formTratamiento,
    erroresTratamiento,
    errorNegocioTratamiento,
    errorGeneralTratamiento,
    guardandoTratamiento,
    cargarTratamientos,
    cargarMasTratamientos,
    cargarCatalogoTratamientos,
    reiniciarFormTratamiento,
    validarFormTratamiento,
    aplicarTratamiento,
  };
});
