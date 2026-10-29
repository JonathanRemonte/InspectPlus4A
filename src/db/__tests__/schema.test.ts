import { regionDb } from '../../region/db';
import { schema } from '../schema';

// Region-neutral checks on the assembled local schema. The region's exact
// version, tables and columns are pinned in
// src/region/__tests__/schemaSnapshot.test.ts.
describe('local schema assembly', () => {
  it('takes its version from the region', () => {
    expect(schema.version).toBe(regionDb.schemaVersion);
  });

  it('holds every foundation table', () => {
    expect(Object.keys(schema.tables)).toEqual(
      expect.arrayContaining(['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports', 'attachments']),
    );
  });

  it('holds every region table', () => {
    expect(Object.keys(schema.tables)).toEqual(expect.arrayContaining(regionDb.tables.map(t => t.name)));
  });
});
