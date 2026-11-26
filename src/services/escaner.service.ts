import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { alertController } from '@ionic/vue';

import {
  consultarPermiso,
  esPlataformaNativa,
  mostrarAlertaCamaraDenegadaConManual,
  solicitarPermiso,
} from './permisos.service';

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

export async function escanearQr(titulo = 'Escanear código QR', ejemplo = 'VACA-001'): Promise<string | null> {
  if (!esPlataformaNativa()) {
    return pedirCodigoManual(titulo, ejemplo);
  }

  let estado = await consultarPermiso('camara');
  if (estado === 'prompt' || estado === 'prompt-with-rationale') {
    estado = await solicitarPermiso('camara');
  }

  if (estado !== 'granted') {
    return mostrarAlertaCamaraDenegadaConManual('Permiso de cámara denegado', ejemplo);
  }

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    return pedirCodigoManual(titulo, ejemplo);
  }

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
    if (texto.includes('cancel')) return null;
    throw error;
  }
}
