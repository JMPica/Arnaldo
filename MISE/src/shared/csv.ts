/**
 * CSV compatible con Excel ES: separador ';', decimales con coma, UTF-8 con BOM, CRLF.
 * Protección contra inyección de fórmulas: celdas de texto que empiezan por = + - @ TAB CR se prefijan con '.
 */
export type Cell = string | number | null | undefined | boolean;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: Cell, opts: { numeric?: boolean } = {}): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') s = String(v).replace('.', ',');
  else if (typeof v === 'boolean') s = v ? 'sí' : 'no';
  else if (opts.numeric && /^-?\d+(\.\d+)?$/.test(v)) s = v.replace('.', ',');
  else {
    s = v;
    if (FORMULA_START.test(s)) s = "'" + s;
  }
  if (/[";\r\n]/.test(s) || s !== s.trim()) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => Cell;
  numeric?: boolean;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(c.value(r), { numeric: c.numeric })).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Parser CSV (';' o ',') con comillas; para importación de ingredientes con vista previa. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}
