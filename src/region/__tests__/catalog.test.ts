import { COMPLIANCE_COLLECTIONS, COMPLIANCE_TAGS, ENABLED_TYPES, REPORT_TYPES, REPORT_TYPE_DISPLAY, TEMPLATES } from '..';

// EMB4A has no report types until the CHWMS forms land (Phase 3).
describe('EMB4A report-type catalog', () => {
  it('is empty', () => {
    expect(REPORT_TYPES).toEqual([]);
    expect(ENABLED_TYPES).toEqual([]);
    expect(REPORT_TYPE_DISPLAY).toEqual({});
    expect(COMPLIANCE_TAGS).toEqual([]);
    expect(COMPLIANCE_COLLECTIONS).toEqual({});
    expect(TEMPLATES).toEqual({});
  });
});
