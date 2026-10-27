import { COMPLIANCE_COLLECTIONS } from '..';
import { reportDataModules, reportForms } from '../modules';

// Hoisted above the imports by babel-plugin-jest-hoist; written after them
// to satisfy eslint's import/first rule.
jest.mock('../../db/database', () => ({ collections: {}, database: {} }));
jest.mock('../../services/supabase/client', () => ({ supabase: {} }));

describe('EMB4B report data modules', () => {
  it('has a compliance loader for every report type with a compliance collection', () => {
    for (const dataKey of Object.keys(COMPLIANCE_COLLECTIONS)) {
      expect(reportDataModules[dataKey as keyof typeof reportDataModules]?.loadCompliance).toEqual(expect.any(Function));
    }
  });

  it('gives water its own detail tabs and every other type the flat compliance view', () => {
    expect(reportDataModules.water_monitoring?.detailTabs?.().map(t => t.key)).toContain('watersupply');
    expect(reportDataModules.water_monitoring?.renderDetailTab).toEqual(expect.any(Function));
    expect(reportDataModules.water_monitoring?.permitsInDetailTabs).toBe(true);
    for (const key of ['air_monitoring', 'hazardous_waste', 'eia'] as const) {
      expect(reportDataModules[key]?.ComplianceView).toBeDefined();
      expect(reportDataModules[key]?.detailTabs).toBeUndefined();
      expect(reportDataModules[key]?.permitsInDetailTabs).toBeUndefined();
    }
  });

  it('opens water — the only enabled create entry — through both form surfaces', () => {
    expect(reportForms.water?.NewFormScreen).toBeDefined();
    expect(reportForms.water?.FormShell).toBeDefined();
    expect(Object.keys(reportForms)).toEqual(['water']);
  });
});
