import { exportReports, ExportPorts, ExportItem } from '../../../features/export/exportReports';
import { RenderError } from '../../../features/export/render/renderDocx';
import { fullWaterBundle, signatories } from '../../export/fixtures';

// Hoisted above the imports by babel-plugin-jest-hoist; written after them
// to satisfy eslint's import/first rule. The region modules reach the DB.
jest.mock('../../../db/database', () => ({ collections: {}, database: {} }));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

jest.mock('../../../features/export/templates', () => ({
  templateFor: (kind: string, type: string) => (type === 'water_monitoring' || kind === 'survey' ? { label: type === 'water_monitoring' ? 'Water Monitoring' : 'Survey', file: 'x', module: 0 } : null),
}));

const item = (key: string, extra: Partial<ExportItem> = {}): ExportItem => ({
  key, kind: 'inspection', reportId: key, reportType: 'water_monitoring', title: 'Water Monitoring',
  estabName: 'Alpha Water', date: '2026-09-05', ...extra,
});

function makePorts(overrides: Partial<ExportPorts> = {}) {
  const written: { dir: string; name: string; bytes: Uint8Array }[] = [];
  const shared: { uri: string; mime: string }[] = [];
  const ports: ExportPorts = {
    loadBundle: jest.fn(async () => fullWaterBundle()),
    loadTemplate: jest.fn(async () => new Uint8Array([1])),
    preparePhoto: jest.fn(async photo => (photo.localUri ? { id: photo.attachmentId, bytes: new Uint8Array([2]), mime: 'image/jpeg' as const, width: 4, height: 3 } : null)),
    render: jest.fn(() => new Uint8Array([3])),
    files: {
      resetExportDir: jest.fn(async () => 'file:///cache/exports'),
      write: jest.fn(async (dir, name, bytes) => { written.push({ dir, name, bytes }); return `${dir}/${name}`; }),
    },
    zip: jest.fn(() => new Uint8Array([4])),
    share: jest.fn(async (uri, mime) => { shared.push({ uri, mime }); }),
    now: () => new Date(2026, 8, 5, 14, 7),
    ...overrides,
  };
  return { ports, written, shared };
}

describe('exportReports', () => {
  it('renders one report, writes it and shares the docx', async () => {
    const { ports, written, shared } = makePorts();
    const progress: unknown[] = [];
    const result = await exportReports([item('r1')], { signatories, onProgress: p => progress.push(p) }, ports);
    expect(ports.files.resetExportDir).toHaveBeenCalledTimes(1);
    expect(written.map(w => w.name)).toEqual(['Water-Monitoring-Alpha-Water-2026-09-05.docx']);
    expect(shared).toEqual([{ uri: 'file:///cache/exports/Water-Monitoring-Alpha-Water-2026-09-05.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }]);
    expect(result).toEqual({ shareUri: shared[0].uri, succeeded: 1, failures: [], skippedPhotos: 1, cancelled: false });
    // Progress is a fraction of the whole run that advances inside the
    // item — loads, each photo, render — not just once at its start.
    // Before this, a single-report export drew an empty bar for its whole
    // run: the bar showed completed items, and there never were any.
    expect(progress.length).toBeGreaterThan(2);
    const fractions = progress.map(p => (p as { fraction: number }).fraction);
    expect(fractions[0]).toBe(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    fractions.forEach((f, i) => { if (i > 0) expect(f).toBeGreaterThanOrEqual(fractions[i - 1]); });
    expect(progress.every(p => (p as { index: number; total: number; title: string }).index === 1 && (p as { total: number }).total === 1 && (p as { title: string }).title === 'Alpha Water')).toBe(true);
    expect(ports.render).toHaveBeenCalledWith(new Uint8Array([1]), expect.objectContaining({ gi_establishment_name: expect.stringContaining('Alpha') }), [expect.objectContaining({ id: 'a1' })]);
  });

  it('starts each item at its share of the run, so the bar keeps its place across items', async () => {
    const { ports } = makePorts();
    const progress: { index: number; fraction: number }[] = [];
    await exportReports([item('r1'), item('r2')], { signatories, onProgress: p => progress.push(p) }, ports);
    expect(progress.find(p => p.index === 2)?.fraction).toBe(0.5);
    expect(progress[progress.length - 1]).toMatchObject({ index: 2, fraction: 1 });
  });

  it('zips several and disambiguates duplicate names', async () => {
    const { ports, written, shared } = makePorts();
    const result = await exportReports([item('r1'), item('r2'), item('r3', { estabName: 'Beta' })], { signatories }, ports);
    expect(written.map(w => w.name)).toEqual([
      'Water-Monitoring-Alpha-Water-2026-09-05.docx',
      'Water-Monitoring-Alpha-Water-2026-09-05 (2).docx',
      'Water-Monitoring-Beta-2026-09-05.docx',
      'InspectPlus-exports-20260905-1407.zip',
    ]);
    expect(ports.zip).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'Water-Monitoring-Beta-2026-09-05.docx' })]));
    expect(shared[0]).toEqual({ uri: 'file:///cache/exports/InspectPlus-exports-20260905-1407.zip', mime: 'application/zip' });
    expect(result.succeeded).toBe(3);
  });

  it('records a failure and carries on with the rest', async () => {
    const { ports, shared } = makePorts({
      render: jest.fn((_t, data) => {
        if ((data as { report_control_no: string }).report_control_no === 'WQ-2026-001' && (ports.render as jest.Mock).mock.calls.length === 1) throw new RenderError('bad tag', ['wwtp_outlets']);
        return new Uint8Array([3]);
      }),
    });
    const result = await exportReports([item('r1'), item('r2')], { signatories }, ports);
    expect(result.succeeded).toBe(1);
    expect(result.failures).toEqual([{ key: 'r1', title: 'Water Monitoring — Alpha Water', reason: 'bad tag' }]);
    expect(shared).toHaveLength(1);
    expect(shared[0].mime).toContain('wordprocessingml');
  });

  it('reports a missing template as a failure without loading the bundle', async () => {
    const { ports } = makePorts();
    const result = await exportReports([item('r1', { reportType: 'hazwaste_tsd', title: 'Hazwaste TSD' })], { signatories }, ports);
    expect(ports.loadBundle).not.toHaveBeenCalled();
    expect(result.failures[0].reason).toMatch(/no template/i);
    expect(result.shareUri).toBeNull();
  });

  it('stops after the current report when cancelled, sharing what finished', async () => {
    let cancelled = false;
    const { ports, shared } = makePorts({
      render: jest.fn(() => { cancelled = true; return new Uint8Array([3]); }),
    });
    const result = await exportReports([item('r1'), item('r2')], { signatories, isCancelled: () => cancelled }, ports);
    expect(ports.render).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(true);
    expect(result.succeeded).toBe(1);
    expect(shared).toHaveLength(1);
  });

  it('reports a failed export write instead of throwing, without sharing', async () => {
    const { ports, shared } = makePorts({
      files: {
        resetExportDir: jest.fn(async () => 'file:///cache/exports'),
        write: jest.fn(async (dir, name) => {
          if (name.endsWith('.zip')) throw new Error('disk full');
          return `${dir}/${name}`;
        }),
      },
    });
    const result = await exportReports([item('r1'), item('r2')], { signatories }, ports);
    expect(shared).toEqual([]);
    expect(result).toEqual({
      shareUri: null,
      succeeded: 2,
      failures: [{ key: 'export', title: 'Saving the export', reason: 'disk full' }],
      skippedPhotos: 2,
      cancelled: false,
    });
  });

  it('shares nothing when everything failed', async () => {
    const { ports, shared } = makePorts({ loadBundle: jest.fn(async () => { throw new Error('Report not found'); }) });
    const result = await exportReports([item('r1')], { signatories }, ports);
    expect(shared).toEqual([]);
    expect(result).toMatchObject({ shareUri: null, succeeded: 0, failures: [{ key: 'r1', reason: 'Report not found' }] });
  });
});
