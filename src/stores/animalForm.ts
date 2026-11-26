import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import type { AnimalItem } from '@/models/auth.model';
import { animalService, ApiError, mensajeDeError } from '@/services';

export type CampoAnimal =
  'numero_arete' | 'codigo_qr' | 'raza_id' | 'potrero_id' | 'sexo' | 'fecha_nacimiento' | 'estado' | 'peso_kg';

export interface FormularioAnimal {
  numero_arete: string;
  codigo_qr: string;
  raza_id: string;
  potrero_id: string;
  sexo: string;
  fecha_nacimiento: string;
  estado: string;
  peso_kg: string;
  observaciones: string;
}

export const ESTADOS_ANIMAL = ['Activo', 'Tratamiento', 'Vendido'];

function formularioVacio(): FormularioAnimal {
  return {
    numero_arete: '',
    codigo_qr: '',
    raza_id: '',
    potrero_id: '',
    sexo: '',
    fecha_nacimiento: '',
    estado: 'Activo',
    peso_kg: '',
    observaciones: '',
  };
}

function erroresVacios(): Record<CampoAnimal, string> {
  return {
    numero_arete: '',
    codigo_qr: '',
    raza_id: '',
    potrero_id: '',
    sexo: '',
    fecha_nacimiento: '',
    estado: '',
    peso_kg: '',
  };
}

export interface ResultadoGuardado {
  ok: boolean;
  animal?: AnimalItem;
  aviso?: string;
}

export const useAnimalFormStore = defineStore('animalForm', () => {
  const form = reactive<FormularioAnimal>(formularioVacio());
  const errores = reactive<Record<CampoAnimal, string>>(erroresVacios());

  const editingId = ref<string | null>(null);
  const originalPotreroId = ref<string>('');
  const cargando = ref<boolean>(false);
  const guardando = ref<boolean>(false);
  const errorCarga = ref<string>('');
  const errorNegocio = ref<string>('');
  const errorGeneral = ref<string>('');

  const esEdicion = computed<boolean>(() => editingId.value !== null);

  function limpiarErrores(): void {
    Object.assign(errores, erroresVacios());
    errorNegocio.value = '';
    errorGeneral.value = '';
  }

  async function iniciar(id: string | null): Promise<void> {
    Object.assign(form, formularioVacio());
    limpiarErrores();
    errorCarga.value = '';
    editingId.value = id;
    originalPotreroId.value = '';

    if (!id) return;

    cargando.value = true;
    try {
      const animal = await animalService.obtener(id);
      form.numero_arete = animal.arete;
      form.codigo_qr = animal.codigo_qr ?? animal.codigoQr ?? '';
      form.raza_id = animal.razaId ? String(animal.razaId) : '';
      form.potrero_id = animal.potreroId ? String(animal.potreroId) : '';
      originalPotreroId.value = form.potrero_id;
      form.sexo = animal.sexo ?? '';
      form.fecha_nacimiento = (animal.fechaNacimiento ?? '').slice(0, 10);
      form.estado = animal.estado ?? 'Activo';
    } catch (err) {
      errorCarga.value = mensajeDeError(err, 'No se pudo cargar el animal a editar.');
    } finally {
      cargando.value = false;
    }
  }

  function validar(): boolean {
    limpiarErrores();

    const arete = form.numero_arete.trim();
    if (!arete) errores.numero_arete = 'El número de arete es obligatorio.';
    else if (arete.length > 50) errores.numero_arete = 'Máximo 50 caracteres.';

    if (form.codigo_qr.trim().length > 100) errores.codigo_qr = 'Máximo 100 caracteres.';
    if (!form.raza_id) errores.raza_id = 'Selecciona una raza.';
    if (!form.potrero_id) errores.potrero_id = 'Selecciona un potrero.';
    if (form.sexo !== 'Macho' && form.sexo !== 'Hembra') errores.sexo = 'Selecciona el sexo.';

    if (form.fecha_nacimiento) {
      const hoy = new Date().toISOString().slice(0, 10);
      if (form.fecha_nacimiento > hoy) errores.fecha_nacimiento = 'La fecha no puede ser futura.';
    }
    if (form.estado.length > 50) errores.estado = 'Máximo 50 caracteres.';

    if (form.peso_kg.trim() !== '') {
      const peso = Number(form.peso_kg);
      if (!Number.isFinite(peso) || peso <= 0 || peso > 9999.99) {
        errores.peso_kg = 'Ingresa un peso entre 0.01 y 9999.99 kg.';
      }
    }

    return Object.values(errores).every((mensaje) => !mensaje);
  }

  async function guardar(): Promise<ResultadoGuardado> {
    if (!validar()) return { ok: false };

    guardando.value = true;
    try {
      const datos = {
        numero_arete: form.numero_arete.trim(),
        codigo_qr: form.codigo_qr.trim() || null,
        raza_id: Number(form.raza_id),
        potrero_id: Number(form.potrero_id),
        sexo: form.sexo as 'Macho' | 'Hembra',
        fecha_nacimiento: form.fecha_nacimiento || null,
        estado: form.estado.trim() || null,
      };

      if (esEdicion.value) {
        const actualizado = await animalService.actualizar(String(editingId.value), datos);
        return { ok: true, animal: actualizado };
      }

      const creado = await animalService.crear(datos);
      let animal = creado;
      let aviso: string | undefined;

      const peso = Number(form.peso_kg);
      if (form.peso_kg.trim() !== '' && Number.isFinite(peso) && peso > 0) {
        try {
          await animalService.registrarPesaje(creado.id, peso, form.observaciones.trim() || undefined);
        } catch (errPeso) {
          aviso = `El animal se registró, pero el peso inicial no se guardó: ${mensajeDeError(errPeso)}`;
        }
      }

      try {
        animal = await animalService.obtener(creado.id);
      } catch {
        animal = creado;
      }

      return { ok: true, animal, aviso };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const porCampo = err.erroresPorCampo;
          (Object.keys(errores) as CampoAnimal[]).forEach((campo) => {
            if (porCampo[campo]) errores[campo] = porCampo[campo];
          });
          errorGeneral.value = Object.keys(porCampo).length ? 'Revisa los campos marcados.' : err.message;
        } else if (err.esReglaDeNegocio) {
          errorNegocio.value = err.message;
        } else {
          errorGeneral.value = err.message;
        }
      } else {
        errorGeneral.value = mensajeDeError(err, 'No se pudo guardar el animal.');
      }
      return { ok: false };
    } finally {
      guardando.value = false;
    }
  }

  return {
    form,
    errores,
    editingId,
    originalPotreroId,
    esEdicion,
    cargando,
    guardando,
    errorCarga,
    errorNegocio,
    errorGeneral,
    iniciar,
    validar,
    guardar,
  };
});
