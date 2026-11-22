/**
 * Utilidad pura y tipada para generar y descargar listados en formato CSV.
 *
 * - Antepone BOM UTF-8 (`\uFEFF`) para que Excel en Windows reconozca tildes y `ñ` sin corrupción.
 * - Escapa comillas dobles (`"` -> `""`) y envuelve celdas con comas, comillas o saltos de línea.
 * - Convierte `null` / `undefined` en celdas vacías.
 * - Descarga mediante `Blob` + `URL.createObjectURL` y libera con `URL.revokeObjectURL`.
 */

export interface ColumnaCsv<T> {
  encabezado: string;
  valor: (fila: T) => unknown;
}

export interface ResultadoExportacionCsv {
  nombreArchivo: string;
  totalFilas: number;
  contenido: string;
}

/** Escapa un valor individual siguiendo RFC 4180 para CSV. */
export function escaparCeldaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  const texto = String(valor);
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Genera el contenido CSV completo con BOM UTF-8 y saltos CRLF. */
export function generarCsv<T>(columnas: ReadonlyArray<ColumnaCsv<T>>, filas: ReadonlyArray<T>): string {
  if (columnas.length === 0) {
    return '\uFEFF';
  }

  const lineaEncabezado = columnas.map((columna) => escaparCeldaCsv(columna.encabezado)).join(',');
  const lineasDatos = filas.map((fila) =>
    columnas.map((columna) => escaparCeldaCsv(columna.valor(fila))).join(','),
  );

  return `\uFEFF${[lineaEncabezado, ...lineasDatos].join('\r\n')}`;
}

/** Construye `{prefijoArchivo}_YYYY-MM-DD.csv` usando la fecha local. */
export function construirNombreArchivoCsv(prefijoArchivo: string, fecha: Date = new Date()): string {
  const prefijoNormalizado =
    prefijoArchivo
      .trim()
      .replace(/\.csv$/i, '')
      .replace(/\s+/g, '_') || 'exportacion';

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${prefijoNormalizado}_${anio}-${mes}-${dia}.csv`;
}

/** Genera el CSV y dispara la descarga en el navegador mediante `Blob` y `URL.createObjectURL`. */
export function exportarCsv<T>(
  prefijoArchivo: string,
  columnas: ReadonlyArray<ColumnaCsv<T>>,
  filas: ReadonlyArray<T>,
  fecha: Date = new Date(),
): ResultadoExportacionCsv {
  const contenido = generarCsv(columnas, filas);
  const nombreArchivo = construirNombreArchivoCsv(prefijoArchivo, fecha);

  if (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    try {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivo;
      enlace.style.display = 'none';
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
    } finally {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }
  }

  return {
    nombreArchivo,
    totalFilas: filas.length,
    contenido,
  };
}
