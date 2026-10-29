import { PARENT_DEPENDENCIES } from '../../db/sync/collectPushChanges';
import { syncSchema } from '../../services/sync/syncSchema';

// Pins the client-side sync registry across the region split.
describe('sync registry', () => {
  it('keeps entity order (parents before children, attachments last)', () => {
    expect(Object.keys(syncSchema)).toEqual([
      'establishments',
      'purpose_of_inspection',
      'inspection_reports',
      'survey_reports',
      'compliance_air',
      'compliance_water',
      'compliance_hazwaste',
      'compliance_eia',
      'attachments',
    ]);
  });

  it('keeps every entity schema', () => {
    expect(syncSchema).toMatchSnapshot();
  });

  it('keeps every parent dependency', () => {
    expect(PARENT_DEPENDENCIES).toMatchSnapshot();
  });
});
