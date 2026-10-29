import { mapBundle } from './index';
import { fullWaterBundle, fullSurveyBundle, signatories } from './fixtures';

// Hoisted above the imports by babel-plugin-jest-hoist; written after them
// to satisfy eslint's import/first rule. The region modules reach the DB.
jest.mock('../../../db/database', () => ({ collections: {}, database: {} }));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

const ctx = { signatories };

describe('mapBundle', () => {
  it('routes water to the water mapper', () => {
    expect(mapBundle(fullWaterBundle(), ctx).cb_has_wwtp_yes).toBeDefined();
  });
  it('routes air/hazwaste/eia to the shared block only', () => {
    for (const reportType of ['air_monitoring', 'hazardous_waste', 'eia']) {
      const data = mapBundle({ ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType }, compliance: { kind: 'none' } }, ctx);
      expect(data.gi_establishment_name).toContain('Alpha');
      expect(data.cb_has_wwtp_yes).toBeUndefined();
    }
  });
  it('routes surveys to the survey mapper', () => {
    expect(mapBundle(fullSurveyBundle(), ctx).survey_project_name).toBe('Bucayao Bridge');
  });
  it('rejects an unknown type', () => {
    expect(() => mapBundle({ ...fullWaterBundle(), report: { ...fullWaterBundle().report, reportType: 'hazwaste_tsd' } }, ctx)).toThrow('No mapper for report type hazwaste_tsd');
  });
});
