import { Geolocation } from '@capacitor/geolocation';
import { alertController } from '@ionic/vue';

import { asegurarPermiso, esPlataformaNativa } from './permisos.service';

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

async function pedirCoordenadasManuales(): Promise<Coordenadas | null> {
  const alerta = await alertController.create({
    header: 'Coordenadas manuales',
    subHeader: 'Modo navegador (sin GPS)',
    message: 'No se pudo leer la ubicación. Escribe las coordenadas para continuar con las pruebas.',
    inputs: [
      { name: 'latitud', type: 'text', placeholder: 'Latitud (ej. 10.456789)', attributes: { inputmode: 'decimal' } },
      {
        name: 'longitud',
        type: 'text',
        placeholder: 'Longitud (ej. -84.123456)',
        attributes: { inputmode: 'decimal' },
      },
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Aceptar', role: 'confirm' },
    ],
  });
  await alerta.present();
  const { data, role } = await alerta.onDidDismiss<{ values?: { latitud?: string; longitud?: string } }>();
  if (role !== 'confirm') return null;

  const latitud = Number(String(data?.values?.latitud ?? '').replace(',', '.'));
  const longitud = Number(String(data?.values?.longitud ?? '').replace(',', '.'));
  const validas =
    Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
  return validas ? { latitud, longitud } : null;
}

export async function obtenerCoordenadas(): Promise<Coordenadas | null> {
  if (!esPlataformaNativa()) {
    try {
      const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
    } catch {
      return pedirCoordenadasManuales();
    }
  }

  if (!(await asegurarPermiso('ubicacion'))) return null;

  const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
  return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
}
