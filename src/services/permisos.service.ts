/**
 * Gestion de permisos nativos de Android (Persona 5).
 *
 * Flujo exigido por la rubrica, para camara (escaner QR) y ubicacion (GPS):
 *   1. checkPermissions()
 *   2. si el estado es 'prompt' o 'prompt-with-rationale' -> requestPermissions()
 *   3. si el resultado final NO es 'granted' (denegado de forma permanente) ->
 *      IonAlert que explica que funcion se pierde y ofrece "Abrir Ajustes"
 *      (y, en el caso de camara/QR, permite ademas escribir el codigo QR manualmente).
 *
 * En navegador web los plugins nativos no aplican: el navegador gestiona sus
 * propios permisos y cada servicio ofrece un modo de respaldo manual.
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { alertController } from '@ionic/vue';
import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';

export type CapacidadNativa = 'camara' | 'ubicacion';

export type EstadoPermiso = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | string;

const PERDIDA_POR_CAPACIDAD: Record<CapacidadNativa, { titulo: string; mensaje: string }> = {
  camara: {
    titulo: 'Permiso de cámara denegado',
    mensaje:
      'Sin acceso a la cámara no puedes escanear el código QR de las vacas ni de los potreros. ' +
      'Para volver a usar el escáner, habilita el permiso de Cámara en los ajustes del dispositivo o escribe el código manualmente.',
  },
  ubicacion: {
    titulo: 'Permiso de ubicación denegado',
    mensaje:
      'Sin acceso a la ubicación no puedes obtener las coordenadas GPS del potrero al registrarlo en la ronda. ' +
      'Para registrar potreros, habilita el permiso de Ubicación en los ajustes de la aplicación.',
  },
};

export function esPlataformaNativa(): boolean {
  return Capacitor.isNativePlatform();
}

export async function consultarPermiso(capacidad: CapacidadNativa): Promise<EstadoPermiso> {
  if (capacidad === 'camara') {
    const { camera } = await BarcodeScanner.checkPermissions();
    return camera;
  }
  const { location, coarseLocation } = await Geolocation.checkPermissions();
  // Con la ubicacion aproximada concedida ya se pueden leer coordenadas.
  return location === 'granted' || coarseLocation === 'granted' ? 'granted' : location;
}

export async function solicitarPermiso(capacidad: CapacidadNativa): Promise<EstadoPermiso> {
  if (capacidad === 'camara') {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera;
  }
  const { location, coarseLocation } = await Geolocation.requestPermissions({
    permissions: ['location', 'coarseLocation'],
  });
  return location === 'granted' || coarseLocation === 'granted' ? 'granted' : location;
}

/** Abre la pantalla de ajustes de la aplicacion en Android (o iOS), con fallback seguro en web. */
export async function abrirAjustesDeLaApp(): Promise<void> {
  if (!esPlataformaNativa()) return;
  try {
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  } catch {
    // En entornos donde el intent nativo no esté disponible, no se rompe el flujo.
  }
}

/** Alerta del caso "denegado de forma permanente" con boton "Abrir Ajustes". */
export async function mostrarAlertaPermisoDenegado(capacidad: CapacidadNativa): Promise<void> {
  const { titulo, mensaje } = PERDIDA_POR_CAPACIDAD[capacidad];
  const alerta = await alertController.create({
    header: titulo,
    message: mensaje,
    backdropDismiss: false,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Abrir Ajustes',
        role: 'confirm',
        handler: () => {
          void abrirAjustesDeLaApp();
        },
      },
    ],
  });
  await alerta.present();
}

/**
 * Alerta para permiso de cámara denegado permanentemente en el escáner QR:
 * muestra explicación clara, opción para abrir ajustes del dispositivo Y un
 * campo alternativo para escribir el código QR manualmente (ej. VACA-001).
 */
export async function mostrarAlertaCamaraDenegadaConManual(
  titulo = 'Permiso de cámara denegado',
  ejemplo = 'VACA-001',
): Promise<string | null> {
  const alerta = await alertController.create({
    header: titulo,
    subHeader: 'Permiso denegado permanentemente',
    message:
      'El permiso de cámara fue denegado. Puedes abrir los ajustes del dispositivo para habilitar la cámara o escribir el código QR manualmente a continuación.',
    backdropDismiss: false,
    inputs: [
      {
        name: 'codigo',
        type: 'text',
        placeholder: `Ej: ${ejemplo}`,
        attributes: {
          autocapitalize: 'characters',
          'aria-label': 'Código QR manual',
        },
      },
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Abrir Ajustes',
        role: 'settings',
        handler: () => {
          void abrirAjustesDeLaApp();
        },
      },
      { text: 'Usar código', role: 'confirm' },
    ],
  });
  await alerta.present();
  const { data, role } = await alerta.onDidDismiss<{ values?: { codigo?: string } }>();
  if (role !== 'confirm') return null;
  const codigo = data?.values?.codigo?.trim();
  return codigo ? codigo : null;
}

/**
 * Garantiza el permiso antes de usar el hardware. Devuelve true si se puede
 * continuar. Si el permiso queda denegado, ya muestra la alerta explicativa.
 */
export async function asegurarPermiso(capacidad: CapacidadNativa): Promise<boolean> {
  // En navegador el propio navegador pide el permiso al usar la API.
  if (!esPlataformaNativa()) return true;

  let estado = await consultarPermiso(capacidad);
  if (estado === 'granted') return true;

  if (estado === 'prompt' || estado === 'prompt-with-rationale') {
    estado = await solicitarPermiso(capacidad);
    if (estado === 'granted') return true;
  }

  // 'denied' tras consultar/solicitar: el sistema ya no volvera a preguntar.
  await mostrarAlertaPermisoDenegado(capacidad);
  return false;
}
