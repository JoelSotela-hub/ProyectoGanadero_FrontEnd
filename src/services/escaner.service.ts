/**
 * Escaner de codigos QR (Persona 5) con `@capacitor-mlkit/barcode-scanning`.
 *
 * Antes de abrir la camara pasa siempre por `asegurarPermiso('camara')`
 * (checkPermissions -> requestPermissions -> alerta de denegado permanente).
 * En navegador web, donde no hay camara nativa, se ofrece un campo de texto de
 * respaldo para escribir el codigo (por ejemplo `VACA-001`).
 */
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { alertController } from '@ionic/vue';

import { asegurarPermiso, esPlataformaNativa } from './permisos.service';

/** Pide el codigo escrito a mano. Devuelve null si el usuario cancela. */
export async function pedirCodigoManual(titulo: string, ejemplo: string): Promise<string | null> {
  const alerta = await alertController.create({
    header: titulo,
    subHeader: 'Modo navegador (sin cámara)',
    message: 'Escribe el contenido del código QR.',
    inputs: [{ name: 'codigo', type: 'text', placeholder: ejemplo, attributes: { autocapitalize: 'characters' } }],
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
 * Abre la camara y devuelve el texto del QR leido.
 * Devuelve null si el usuario cancela o si el permiso fue denegado.
 */
export async function escanearQr(titulo = 'Escanear código QR', ejemplo = 'VACA-001'): Promise<string | null> {
  if (!esPlataformaNativa()) {
    return pedirCodigoManual(titulo, ejemplo);
  }

  if (!(await asegurarPermiso('camara'))) return null;

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    return pedirCodigoManual(titulo, ejemplo);
  }

  // El lector de Google se descarga una vez; si aun no esta, se solicita y se avisa.
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

