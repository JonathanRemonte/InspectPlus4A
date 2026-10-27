import {
  COMPLIANCE_TAGS,
  DATA_KEY_TO_CREATE_KEY,
  ENABLED_TYPES,
  REPORT_TYPES,
  REPORT_TYPE_DISPLAY,
  SURVEY_COMPLIANCE_TAG,
} from '..';

describe('EMB4B report-type catalog', () => {
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

  it('keeps the establishment compliance-tag vocabulary', () => {
    expect(COMPLIANCE_TAGS.map(t => t.tag)).toEqual(['Air Monitoring', 'Water Monitoring', 'Hazwaste', 'EIA', 'Survey']);
    expect(SURVEY_COMPLIANCE_TAG).toBe('Survey');
  });
});
