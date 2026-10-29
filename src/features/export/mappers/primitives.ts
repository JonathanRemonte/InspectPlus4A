// The vocabulary every mapper is written in. A mapper's job is to turn a
// ReportBundle into strings a template can print, and never to throw on
// data — so each helper here accepts `unknown` and blanks what it can't use.

import type { TemplateData } from '../types';

export const TICKED = '☒'; // ☒
export const UNTICKED = '☐'; // ☐

export function cb(on: boolean): string {
  return on ? TICKED : UNTICKED;
}

// Fills the template's pre-existing ☐ glyphs that no field maps to
// (unused_1 … unused_N) so they print unticked.
export function unusedBoxes(count: number): TemplateData {
  const out: TemplateData = {};
  for (let i = 1; i <= count; i += 1) out[`unused_${i}`] = UNTICKED;
  return out;
}

export function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function numberText(value: unknown): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

// Pads a loop's rows up to the count the printed form shows so a sparse
// report still looks like the official form; a fuller report simply grows.
export function padRows<T>(rows: readonly T[] | undefined | null, min: number, blank: () => T): T[] {
  const list = Array.isArray(rows) ? [...rows] : [];
  while (list.length < min) list.push(blank());
  return list;
}

export function joinNonEmpty(parts: readonly unknown[], separator = ', '): string {
  return parts.map(text).map(s => s.trim()).filter(Boolean).join(separator);
}

// Matches a stored label against a printed row label without caring about
// case, spacing or punctuation ("Water utilities" ↔ "Water Utilities").
export function normalizeLabel(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : [];
}
