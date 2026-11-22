/**
 * Escaner de codigos QR (Persona 5) con `@capacitor-mlkit/barcode-scanning`.
 *
 * Flujo completo de permisos en tiempo de ejecucion:
 *   1. Declara y solicita permiso de camara (`checkPermissions` -> `requestPermissions`).
 *   2. Si el permiso es denegado permanentemente (`denied`), muestra explicacion
 *      clara con boton para abrir los ajustes del dispositivo Y un campo
 *      alternativo para escribir el codigo QR manualmente (ej. `VACA-001`).
 *   3. En navegador web o dispositivos sin camara soportada, ofrece el campo
 *      alternativo para ingresar el codigo QR manualmente.
 */
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { alertController } from '@ionic/vue';

import {
  consultarPermiso,
  esPlataformaNativa,
  mostrarAlertaCamaraDenegadaConManual,
  solicitarPermiso,
} from './permisos.service';

/** Pide el codigo escrito a mano. Devuelve null si el usuario cancela. */
export async function pedirCodigoManual(titulo: string, ejemplo: string): Promise<string | null> {
  const alerta = await alertController.create({
    header: titulo,
    subHeader: 'Ingreso manual de código QR',
    message: `Escribe el código QR manualmente (por ejemplo: ${ejemplo}).`,
    inputs: [
      {
        name: 'codigo',
        type: 'text',
        placeholder: ejemplo,
        attributes: {
          autocapitalize: 'characters',
          'aria-label': 'Código QR',
        },
      },
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Aceptar', role: 'confirm' },
    ],
  });
  await alerta.present();
  const { data, role } = await alerta.onDidDismiss<{ values?: { codigo?: string } }>();
  if (role !== 'confirm') return null;
  const codigo = data?.values?.codigo?.trim();
  return codigo ? codigo : null;
}

/**
 * Abre la camara nativa (o el respaldo manual si el permiso fue denegado
 * permanentemente o se ejecuta en web) y devuelve el texto del QR leido.
 */
export async function escanearQr(titulo = 'Escanear código QR', ejemplo = 'VACA-001'): Promise<string | null> {
  if (!esPlataformaNativa()) {
    return pedirCodigoManual(titulo, ejemplo);
  }

  let estado = await consultarPermiso('camara');
  if (estado === 'prompt' || estado === 'prompt-with-rationale') {
    estado = await solicitarPermiso('camara');
  }

  if (estado !== 'granted') {
    // Permiso denegado permanentemente: explicacion + Abrir Ajustes + campo manual alternativo
    return mostrarAlertaCamaraDenegadaConManual('Permiso de cámara denegado', ejemplo);
  }

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    return pedirCodigoManual(titulo, ejemplo);
  }

  // El lector de Google se descarga una vez; si aun no esta, se solicita y se ofrece ingreso manual.
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error('El módulo de escaneo se está descargando. Inténtalo de nuevo en unos segundos.');
  }

  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    const valor = barcodes[0]?.rawValue?.trim();
    return valor ? valor : null;
  } catch (error) {
    const texto = error instanceof Error ? error.message.toLowerCase() : '';
    // El usuario cerro el lector sin escanear: no es un error.
    if (texto.includes('cancel')) return null;
    throw error;
  }
}
