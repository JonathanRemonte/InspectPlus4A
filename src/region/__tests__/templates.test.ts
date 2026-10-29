import { defaultApproversFor, hasTemplate, templateFor } from '../../features/export/templates/index';

describe('defaultApproversFor', () => {
  it('resolves Water, Air, EIA and Survey to the same shared approvers', () => {
    const water = defaultApproversFor('inspection', 'water_monitoring');
    expect(water).toEqual({
      recommendingName: 'ERWIN R. LIZARDO',
      recommendingPosition: 'OIC, AWMS',
      approverName: 'ENGR. DAN GOODWIN S. BORJA',
      approverPosition: 'OIC-Chief, EMED',
    });
    expect(defaultApproversFor('inspection', 'air_monitoring')).toEqual(water);
    expect(defaultApproversFor('inspection', 'eia')).toEqual(water);
    expect(defaultApproversFor('survey', 'survey')).toEqual(water);
  });

  // Hazardous Waste Generators has always printed a different recommending
  // signatory than the other four forms.
  it('resolves Hazardous Waste Generators to its own distinct recommending signatory', () => {
    const hazwaste = defaultApproversFor('inspection', 'hazardous_waste');
    expect(hazwaste).toEqual({
      recommendingName: 'JANE T. DUMENDEN',
      recommendingPosition: 'OIC-CHWMS',
      approverName: 'ENGR. DAN GOODWIN S. BORJA',
      approverPosition: 'OIC-Chief, EMED',
    });
    expect(hazwaste.recommendingName).not.toBe(defaultApproversFor('inspection', 'water_monitoring').recommendingName);
  });

  it('falls back to the Water set for an unknown/untemplated type', () => {
    expect(hasTemplate('inspection', 'hazwaste_tsd')).toBe(false);
    expect(templateFor('inspection', 'hazwaste_tsd')).toBeNull();
    expect(defaultApproversFor('inspection', 'hazwaste_tsd')).toEqual(defaultApproversFor('inspection', 'water_monitoring'));
  });
});
