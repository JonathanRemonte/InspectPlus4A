import { mapSurveyBundle, reportDataModules, reportForms } from '../modules';

jest.mock('../../db/database', () => ({ collections: {}, database: {} }));

describe('EMB4A report modules', () => {
  it('registers no report types and no survey export yet', () => {
    expect(reportDataModules).toEqual({});
    expect(reportForms).toEqual({});
    expect(mapSurveyBundle).toBeUndefined();
  });
});
