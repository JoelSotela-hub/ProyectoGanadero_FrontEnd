export interface OpcionesDescargaQrPng {
  elementoContenedor: HTMLElement | null;
  titulo: string;
  subtitulo?: string;
  nombreArchivo: string;
}

export interface ResultadoDescargaQrPng {
  nombreArchivo: string;
  ancho: number;
  alto: number;
}

const TAMANO_QR_PX = 512;
const QUIET_ZONE_PX = 72;
const ESPACIO_QR_TEXTO_PX = 36;
const ALTO_TITULO_PX = 38;
const ESPACIO_ENTRE_TEXTOS_PX = 14;
const ALTO_SUBTITULO_PX = 28;
const MARGEN_INFERIOR_PX = 56;

export function normalizarNombreArchivoQr(nombreArchivo: string): string {
  const sinExtension = nombreArchivo.trim().replace(/\.png$/i, '');
  const limpio = sinExtension
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${limpio || 'codigo_qr'}.png`;
}

function encontrarElementoQr(contenedor: HTMLElement): HTMLCanvasElement | SVGSVGElement {
  if (contenedor.tagName.toLowerCase() === 'canvas') {
    return contenedor as unknown as HTMLCanvasElement;
  }
  const canvas = contenedor.querySelector('canvas');
  if (canvas) {
    return canvas;
  }
  if (contenedor.tagName.toLowerCase() === 'svg') {
    return contenedor as unknown as SVGSVGElement;
  }
  const svg = contenedor.querySelector('svg');
  if (svg) {
    return svg;
  }
  throw new Error('No se encontró el código QR para descargar.');
}

function cargarImagenSvg(svgOrigen: SVGSVGElement, tamano: number): Promise<HTMLImageElement> {
  const svgClonado = svgOrigen.cloneNode(true) as SVGSVGElement;
  if (!svgClonado.getAttribute('xmlns')) {
    svgClonado.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  svgClonado.setAttribute('width', String(tamano));
  svgClonado.setAttribute('height', String(tamano));

  const svgSerializado =
    typeof XMLSerializer !== 'undefined' ? new XMLSerializer().serializeToString(svgClonado) : svgClonado.outerHTML;

  const puedeUsarObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const objectUrl = puedeUsarObjectUrl
    ? URL.createObjectURL(new Blob([svgSerializado], { type: 'image/svg+xml;charset=utf-8' }))
    : null;
  const src = objectUrl ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSerializado)}`;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => {
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
      resolve(imagen);
    };
    imagen.onerror = () => {
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error('No se pudo renderizar el código QR en imagen.'));
    };
    imagen.src = src;
  });
}

function generarBlobPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function dispararDescargaUrl(url: string, nombreArchivo: string): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  try {
    enlace.click();
  } finally {
    document.body.removeChild(enlace);
  }
}

export async function descargarQrPng(opciones: OpcionesDescargaQrPng): Promise<ResultadoDescargaQrPng> {
  const { elementoContenedor, titulo, subtitulo, nombreArchivo } = opciones;
  if (!elementoContenedor) {
    throw new Error('No se encontró el contenedor del código QR.');
  }
  if (typeof document === 'undefined') {
    throw new Error('La descarga de códigos QR requiere un entorno de navegador.');
  }

  const fuenteQr = encontrarElementoQr(elementoContenedor);
  const tituloLimpio = titulo.trim();
  const subtituloLimpio = subtitulo?.trim() ?? '';
  const tieneTexto = Boolean(tituloLimpio || subtituloLimpio);

  const ancho = TAMANO_QR_PX + QUIET_ZONE_PX * 2;
  const alto = tieneTexto
    ? QUIET_ZONE_PX +
      TAMANO_QR_PX +
      ESPACIO_QR_TEXTO_PX +
      (tituloLimpio ? ALTO_TITULO_PX : 0) +
      (tituloLimpio && subtituloLimpio ? ESPACIO_ENTRE_TEXTOS_PX : 0) +
      (subtituloLimpio ? ALTO_SUBTITULO_PX : 0) +
      MARGEN_INFERIOR_PX
    : TAMANO_QR_PX + QUIET_ZONE_PX * 2;

  const canvasTemporal = document.createElement('canvas');
  canvasTemporal.width = ancho;
  canvasTemporal.height = alto;

  const ctx = canvasTemporal.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo 2D para generar el PNG.');
  }

  const nombreArchivoFinal = normalizarNombreArchivoQr(nombreArchivo);

  try {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);

    ctx.imageSmoothingEnabled = false;
    if (fuenteQr.tagName.toLowerCase() === 'canvas') {
      ctx.drawImage(fuenteQr as HTMLCanvasElement, QUIET_ZONE_PX, QUIET_ZONE_PX, TAMANO_QR_PX, TAMANO_QR_PX);
    } else {
      const imagenSvg = await cargarImagenSvg(fuenteQr as SVGSVGElement, TAMANO_QR_PX);
      ctx.drawImage(imagenSvg, QUIET_ZONE_PX, QUIET_ZONE_PX, TAMANO_QR_PX, TAMANO_QR_PX);
    }

    if (tieneTexto) {
      const maxAnchoTexto = ancho - QUIET_ZONE_PX;
      let yActual = QUIET_ZONE_PX + TAMANO_QR_PX + ESPACIO_QR_TEXTO_PX;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (tituloLimpio) {
        ctx.fillStyle = '#000000';
        ctx.font = "700 34px 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
        ctx.fillText(tituloLimpio, ancho / 2, yActual, maxAnchoTexto);
        yActual += ALTO_TITULO_PX + ESPACIO_ENTRE_TEXTOS_PX;
      }

      if (subtituloLimpio) {
        ctx.fillStyle = '#111111';
        ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.fillText(subtituloLimpio, ancho / 2, yActual, maxAnchoTexto);
      }
    }

    const blob = await generarBlobPng(canvasTemporal);
    if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      try {
        dispararDescargaUrl(url, nombreArchivoFinal);
      } finally {
        if (typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      }
    } else {
      const dataUrl = typeof canvasTemporal.toDataURL === 'function' ? canvasTemporal.toDataURL('image/png') : '';
      if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
        throw new Error('No se pudo generar el archivo PNG del código QR.');
      }
      dispararDescargaUrl(dataUrl, nombreArchivoFinal);
    }

    return {
      nombreArchivo: nombreArchivoFinal,
      ancho,
      alto,
    };
  } finally {
    canvasTemporal.width = 0;
    canvasTemporal.height = 0;
  }
}
