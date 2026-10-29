import {
  COMPLIANCE_TAGS,
  DATA_KEY_TO_CREATE_KEY,
  ENABLED_TYPES,
  REPORT_TYPES,
  REPORT_TYPE_DISPLAY,
  SURVEY_COMPLIANCE_TAG,
} from '..';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

describe('EMB4B report-type catalog', () => {
  // The single source of ENABLED_TYPES that SpeedDial.test.tsx's guard relies on.
  it('declares ENABLED_TYPES exactly once, in catalog.ts', () => {
    const catalogSource: string = fs.readFileSync(path.join(__dirname, '../catalog.ts'), 'utf8');
    expect(catalogSource.match(/\bconst\s+ENABLED_TYPES\s*[:=]/g)?.length ?? 0).toBe(1);
  });

  it('lists the six create entries in speed-dial order with only water enabled', () => {
    expect(REPORT_TYPES.map(t => t.key)).toEqual(['air', 'water', 'hazwaste_generator', 'hazwaste_tsd', 'eia', 'survey']);
    expect(ENABLED_TYPES).toEqual(['water']);
  });

  it('has a display entry for every data key a create entry produces', () => {
    for (const t of REPORT_TYPES) expect(REPORT_TYPE_DISPLAY[t.dataKey]).toBeDefined();
  });

  it('maps stored report types back to their create entry', () => {
    expect(DATA_KEY_TO_CREATE_KEY).toEqual({
      air_monitoring: 'air',
      water_monitoring: 'water',
      hazardous_waste: 'hazwaste_generator',
      eia: 'eia',
    });
  });

  it('points every compliance tag at a create entry that exists', () => {
    const keys = REPORT_TYPES.map(t => t.key);
    for (const t of COMPLIANCE_TAGS) expect(keys).toContain(t.createKey);
  });

  it('keeps the establishment compliance-tag vocabulary', () => {
    expect(COMPLIANCE_TAGS.map(t => t.tag)).toEqual(['Air Monitoring', 'Water Monitoring', 'Hazwaste', 'EIA', 'Survey']);
    expect(SURVEY_COMPLIANCE_TAG).toBe('Survey');
  });
});
