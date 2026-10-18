// Lightweight spreadsheet formula engine untuk SheetsPanel.
// Mendukung: =SUM(range), =AVG/AVERAGE(range), =MIN(range), =MAX(range),
// =COUNT(range), serta ekspresi referensi sel sederhana (=A1+B2*2, =A1-B1, dst).
// Referensi: huruf kolom (A, B, C, ...) + nomor baris (1-based, sesuai tampilan UI).

export type Grid = string[][];

const colToIndex = (col: string): number => {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n - 1;
};

const cellRef = (grid: Grid, ref: string): number => {
  const m = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return NaN;
  const ci = colToIndex(m[1].toUpperCase());
  const ri = parseInt(m[2], 10) - 1;
  const raw = grid[ri]?.[ci] ?? '';
  const val = resolveCellDisplay(grid, ri, ci, new Set());
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const expandRange = (grid: Grid, range: string): number[] => {
  const [startRef, endRef] = range.split(':');
  if (!endRef) return [cellRef(grid, startRef)];

  const sm = startRef.match(/^([A-Za-z]+)(\d+)$/);
  const em = endRef.match(/^([A-Za-z]+)(\d+)$/);
  if (!sm || !em) return [];

  const c1 = colToIndex(sm[1].toUpperCase());
  const r1 = parseInt(sm[2], 10) - 1;
  const c2 = colToIndex(em[1].toUpperCase());
  const r2 = parseInt(em[2], 10) - 1;

  const vals: number[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      const raw = grid[r]?.[c] ?? '';
      const val = resolveCellDisplay(grid, r, c, new Set());
      const n = parseFloat(val);
      if (!isNaN(n)) vals.push(n);
    }
  }
  return vals;
};

const FUNCS: Record<string, (nums: number[]) => number> = {
  SUM: nums => nums.reduce((a, b) => a + b, 0),
  AVG: nums => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0),
  AVERAGE: nums => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0),
  MIN: nums => (nums.length ? Math.min(...nums) : 0),
  MAX: nums => (nums.length ? Math.max(...nums) : 0),
  COUNT: nums => nums.length,
};

/** Evaluasi satu formula string (tanpa tanda '=' di depan) untuk sel (ri, ci), dengan guard siklus. */
const evalFormula = (grid: Grid, expr: string, visiting: Set<string>): string => {
  const trimmed = expr.trim();

  // Pola fungsi: NAMA(range)
  const fnMatch = trimmed.match(/^([A-Za-z]+)\(([^)]*)\)$/);
  if (fnMatch) {
    const fn = FUNCS[fnMatch[1].toUpperCase()];
    if (!fn) return '#FUNC?';
    const parts = fnMatch[2].split(',').map(p => p.trim()).filter(Boolean);
    const nums: number[] = [];
    for (const p of parts) {
      if (p.includes(':')) {
        nums.push(...expandRange(grid, p));
      } else if (/^[A-Za-z]+\d+$/.test(p)) {
        nums.push(cellRef(grid, p));
      } else {
        const n = parseFloat(p);
        if (!isNaN(n)) nums.push(n);
      }
    }
    const result = fn(nums);
    return Number.isInteger(result) ? String(result) : result.toFixed(2);
  }

  // Pola ekspresi aritmatika dengan referensi sel, misal: A1+B2*2-C1/2
  // Ganti semua referensi sel dengan nilainya, lalu evaluasi aman (hanya angka & operator).
  const substituted = trimmed.replace(/([A-Za-z]+\d+)/g, ref => {
    const key = ref.toUpperCase();
    if (visiting.has(key)) return '0'; // cegah siklus
    return String(cellRef(grid, ref));
  });

  if (!/^[\d\s+\-*/.()]+$/.test(substituted)) return '#ERR?';

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${substituted})`)();
    if (typeof result !== 'number' || !isFinite(result)) return '#ERR?';
    return Number.isInteger(result) ? String(result) : result.toFixed(2);
  } catch {
    return '#ERR?';
  }
};

/** Resolve nilai tampilan untuk sel (ri, ci) — jika formula, hitung; jika tidak, kembalikan raw text. */
export const resolveCellDisplay = (
  grid: Grid,
  ri: number,
  ci: number,
  visiting: Set<string> = new Set()
): string => {
  const raw = grid[ri]?.[ci] ?? '';
  if (!raw.startsWith('=')) return raw;

  const key = `${ri},${ci}`;
  if (visiting.has(key)) return '#CYCLE?';
  visiting.add(key);

  const result = evalFormula(grid, raw.slice(1), visiting);
  visiting.delete(key);
  return result;
};

export const isFormulaCell = (raw: string): boolean => raw.startsWith('=');

/** Parse teks CSV (mendukung quoted fields dengan koma/kutip di dalamnya) menjadi grid string[][]. */
export const parseCSV = (text: string): Grid => {
  const rows: Grid = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  // Sisa field/baris terakhir (kalau file tidak diakhiri newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Samakan jumlah kolom tiap baris (isi kosong jika pendek)
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  return rows.map(r => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });
};
