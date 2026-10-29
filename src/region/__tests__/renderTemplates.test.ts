import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { renderDocx } from '../../features/export/render/renderDocx';
import { mapBundle } from '../../features/export/mappers';
import { emptyWaterBundle, fullSurveyBundle, fullWaterBundle, signatories } from '../../features/export/mappers/fixtures';
import { TICKED } from '../../features/export/mappers/primitives';

// Hoisted above the imports by babel-plugin-jest-hoist; written after them
// to satisfy eslint's import/first rule. The region modules reach the DB.
jest.mock('../../db/database', () => ({ collections: {}, database: {} }));
jest.mock('../../services/supabase/client', () => ({ supabase: {} }));
// scripts/docx-tag.js is a plain Node script, not part of the app bundle —
// Jest transpiles it like any other CommonJS module, and templates/index.ts
// already imports the sibling .docx assets the same require()-based way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertWellFormed } = require('../../../scripts/docx-tag');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'templates');
const ctx = { signatories };
const load = (file: string) => new Uint8Array(fs.readFileSync(path.join(TEMPLATES_DIR, file)));
const docXml = (bytes: Uint8Array) => new PizZip(bytes).file('word/document.xml')!.asText();
const png1x1 = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));

// Finds the <w:tc>…</w:tc> that contains `primaryInspectorName` (unique to
// the "Submitted by" cell) and returns the plain text of every paragraph in
// it. The {#sig_inspectors}/{/sig_inspectors} delimiter paragraphs render to
// nothing (docxtemplater drops a paragraph that holds only a loop tag), so
// this is just the loop's repeated output — including the two blank
// signature-space paragraphs that print above every inspector's name, since
// those now live inside the loop. Used to assert name and position land in
// separate paragraphs per inspector rather than being glued together inside
// one (see the inline-loop bug this guards against), and that the printed
// form's blank signature lines repeat for every inspector, not just the
// first.
function submittedByParagraphs(xml: string, primaryInspectorName: string): string[] {
  const i = xml.indexOf(primaryInspectorName);
  expect(i).toBeGreaterThanOrEqual(0);
  const tcStart = xml.lastIndexOf('<w:tc>', i);
  const tcEnd = xml.indexOf('</w:tc>', i) + '</w:tc>'.length;
  const tc = xml.slice(tcStart, tcEnd);
  return [...tc.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(m => m[0].replace(/<[^>]+>/g, ''));
}

// A checked-in template with a malformed document.xml (e.g. the EIA
// checkbox-unwrap bug that produced a mismatched-tag document) would break
// silently until someone opened the output in Word — assert every source
// template, and every render of it, parses as well-formed XML.
const CHECKED_IN_TEMPLATES = [
  'water-monitoring.docx',
  'air-monitoring.docx',
  'eia.docx',
  'hazardous-waste-generators.docx',
  'survey.docx',
];

describe('every checked-in template is well-formed XML', () => {
  it.each(CHECKED_IN_TEMPLATES)('%s', file => {
    expect(() => assertWellFormed(docXml(load(file)))).not.toThrow();
  });
});

describe('every checked-in template starts ATTACHMENTS on its own page', () => {
  it.each(CHECKED_IN_TEMPLATES)('%s', file => {
    const xml = docXml(load(file));
    const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
    const attachmentsParagraph = paragraphs.find(p => {
      const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
      return text === 'ATTACHMENTS';
    });
    expect(attachmentsParagraph).toBeDefined();
    const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(attachmentsParagraph!);
    expect(pPr).toBeTruthy();
    expect(pPr![0]).toContain('<w:pageBreakBefore/>');
  });
});

describe('every checked-in template centres its photo cells', () => {
  it.each(CHECKED_IN_TEMPLATES)('%s', file => {
    const xml = docXml(load(file));
    const i = xml.indexOf('{#photo_rows}');
    expect(i).toBeGreaterThanOrEqual(0);
    const trStart = xml.lastIndexOf('<w:tr>', i);
    const trEnd = xml.indexOf('</w:tr>', i) + '</w:tr>'.length;
    const cells = xml.slice(trStart, trEnd).match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
    expect(cells).toHaveLength(2);
    for (const cell of cells) expect(cell).toContain('<w:vAlign w:val="center"/>');
  });
});

describe('water-monitoring.docx renders', () => {
  it('a full report with no tag left behind', () => {
    const out = renderDocx(load('water-monitoring.docx'), mapBundle(fullWaterBundle(), ctx), [
      { id: 'a1', bytes: png1x1, mime: 'image/png', width: 1, height: 1 },
    ]);
    const xml = docXml(out);
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain('Alpha Water Refilling');
    expect(xml).toContain('05 September 2026');
    expect(xml).toContain('Calapan River (Class C)');
    expect(xml).toContain('Figure 2');
    expect(xml).toContain('(photo not downloaded)');
    expect(xml).toContain('<w:drawing>');
    expect(xml.split(TICKED).length - 1).toBeGreaterThan(5);
    expect(new PizZip(out).file('word/media/export_1.png')).toBeTruthy();
    expect(() => assertWellFormed(xml)).not.toThrow();
    // Every drawing paragraph centres itself — the raw {@photo_drawing} tag
    // replaces its whole paragraph, so the recipe's own <w:jc> on that
    // paragraph doesn't survive; drawingParagraph() must supply its own.
    const drawingParagraphs = xml.match(/<w:p>[\s\S]*?<w:drawing>[\s\S]*?<\/w:p>/g) ?? [];
    expect(drawingParagraphs.length).toBeGreaterThan(0);
    for (const p of drawingParagraphs) expect(p).toContain('<w:jc w:val="center"/>');
    // The plain case (no additional inspectors) prints the primary
    // inspector's name and position once each, as separate paragraphs, with
    // the form's two blank signature-space lines above the name.
    expect(submittedByParagraphs(xml, signatories.inspectorName)).toEqual(['', '', signatories.inspectorName, signatories.inspectorPosition]);
    // The "Reviewed by" (supervisor) cell isn't part of the sig_inspectors
    // loop and stays exactly as printed: two blanks, then name, position.
    expect(submittedByParagraphs(xml, signatories.supervisorName)).toEqual(['', '', signatories.supervisorName, signatories.supervisorPosition]);
  });

  it('an empty draft, still showing the printed row counts', () => {
    const xml = docXml(renderDocx(load('water-monitoring.docx'), mapBundle(emptyWaterBundle(), ctx), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    // 3 outlet rows + 2 component rows survive padding
    expect(xml).toContain('Receiving Body of Water');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('stacks additional inspectors under the primary one, with no tag left behind', () => {
    const ctxWithExtras = {
      signatories: {
        ...signatories,
        additionalInspectors: [
          { name: 'Second Inspector', position: 'Engineer I' },
          { name: 'Third Inspector', position: 'Engineer III' },
        ],
      },
    };
    const xml = docXml(renderDocx(load('water-monitoring.docx'), mapBundle(fullWaterBundle(), ctxWithExtras), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain(signatories.inspectorName);
    expect(xml).toContain('Second Inspector');
    expect(xml).toContain('Third Inspector');
    // The primary inspector's name prints exactly once — the loop doesn't
    // duplicate it alongside the top-level sig_inspector_name tag.
    expect(xml.split(signatories.inspectorName).length - 1).toBe(1);
    expect(() => assertWellFormed(xml)).not.toThrow();
    // Whole paragraphs repeat per inspector: the form's two blank
    // signature-space lines, then name, then position, for every inspector —
    // never a name glued onto the next inspector's position, and never just
    // the first inspector getting the blank lines above their name.
    expect(submittedByParagraphs(xml, signatories.inspectorName)).toEqual([
      '', '', signatories.inspectorName, signatories.inspectorPosition,
      '', '', 'Second Inspector', 'Engineer I',
      '', '', 'Third Inspector', 'Engineer III',
    ]);
  });
});

describe('the other tagged templates render', () => {
  it('air-monitoring.docx with no tag left behind', () => {
    const bundle = { ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'air_monitoring' }, compliance: { kind: 'none' as const } };
    const xml = docXml(renderDocx(load('air-monitoring.docx'), mapBundle(bundle, ctx), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain('Alpha Water Refilling');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('eia.docx with no tag left behind', () => {
    const bundle = { ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'eia' }, compliance: { kind: 'none' as const } };
    const xml = docXml(renderDocx(load('eia.docx'), mapBundle(bundle, ctx), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain('Alpha Water Refilling');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('hazardous-waste-generators.docx with no tag left behind', () => {
    const bundle = { ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'hazardous_waste' }, compliance: { kind: 'none' as const } };
    const xml = docXml(renderDocx(load('hazardous-waste-generators.docx'), mapBundle(bundle, ctx), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain('Alpha Water Refilling');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('survey.docx with no tag left behind', () => {
    const xml = docXml(renderDocx(load('survey.docx'), mapBundle(fullSurveyBundle(), ctx), []));
    expect(xml).not.toMatch(/\{[#/@]?[A-Za-z0-9_]+\}/);
    expect(xml).toContain('Bucayao Bridge');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });
});
