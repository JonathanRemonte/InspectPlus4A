import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { mapBundle } from '../mappers';
import { fullSurveyBundle, fullWaterBundle, signatories } from '../mappers/fixtures';
import type { TemplateData } from '../types';

// Hoisted above the imports by babel-plugin-jest-hoist; written after them
// to satisfy eslint's import/first rule. The region modules reach the DB.
jest.mock('../../../db/database', () => ({ collections: {}, database: {} }));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', '..', 'assets', 'templates');
const ctx = { signatories };

// Every template's tags must be exactly the keys its mapper produces — a
// tag with no data prints "", a key with no tag is silently lost, and both
// are the failure mode of a re-tag after EMB revises a form.
function tagsOf(file: string) {
  const xml = new PizZip(fs.readFileSync(path.join(TEMPLATES_DIR, file))).file('word/document.xml')!.asText();
  const text = xml.replace(/<[^>]+>/g, '');
  const plain = new Set<string>();
  const loops = new Set<string>();
  const raw = new Set<string>();
  for (const m of text.matchAll(/\{([#/@]?)([A-Za-z0-9_]+)\}/g)) {
    if (m[1] === '#' || m[1] === '/') loops.add(m[2]);
    else if (m[1] === '@') raw.add(m[2]);
    else plain.add(m[2]);
  }
  return { plain, loops, raw };
}

// Keys at every level of the data: top-level strings, loop names, and the
// string keys inside loop rows (which is where docxtemplater resolves them).
function keysOf(data: TemplateData) {
  const plain = new Set<string>();
  const loops = new Set<string>();
  const walk = (d: TemplateData) => {
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) {
        loops.add(k);
        v.forEach(walk);
      } else plain.add(k);
    }
  };
  walk(data);
  plain.delete('photo_id');
  plain.delete('photo_missing_text');
  return { plain, loops };
}

const cases: [string, TemplateData][] = [
  ['water-monitoring.docx', mapBundle(fullWaterBundle(), ctx)],
  ['air-monitoring.docx', mapBundle({ ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'air_monitoring' }, compliance: { kind: 'none' } }, ctx)],
  ['eia.docx', mapBundle({ ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'eia' }, compliance: { kind: 'none' } }, ctx)],
  ['hazardous-waste-generators.docx', mapBundle({ ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'hazardous_waste' }, compliance: { kind: 'none' } }, ctx)],
  ['survey.docx', mapBundle(fullSurveyBundle(), ctx)],
];

// mapCommon's DOC_ROWS carries both `doc_cb_opms` and `doc_cb_hwms` on every
// report type, because Hazwaste's own form prints "HWMS" where Water/Air/EIA
// print "OPMS" for the same documents-reviewed box — one shared mapper, two
// possible labels. No single template prints both: ignore whichever one a
// given template doesn't use in the "prints every key" direction only (the
// other direction, "has no tag the mapper does not fill", already passes
// since neither key is ever a stray tag).
const PRINTS_ONE_OF = new Set(['doc_cb_opms', 'doc_cb_hwms']);

describe.each(cases)('%s', (file, data) => {
  const tags = tagsOf(file);
  const keys = keysOf(data);

  it('has no tag the mapper does not fill', () => {
    expect([...tags.plain].filter(t => !keys.plain.has(t)).sort()).toEqual([]);
    expect([...tags.loops].filter(t => !keys.loops.has(t)).sort()).toEqual([]);
  });
  it('prints every key the mapper produces', () => {
    expect([...keys.plain].filter(k => !tags.plain.has(k) && !PRINTS_ONE_OF.has(k)).sort()).toEqual([]);
    expect([...keys.loops].filter(k => !tags.loops.has(k)).sort()).toEqual([]);
  });
  it('uses the photo drawing raw tag', () => {
    expect([...tags.raw]).toEqual(['photo_drawing']);
  });
});
