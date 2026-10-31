import { PARENT_DEPENDENCIES } from '../../db/sync/collectPushChanges';
import { syncSchema } from '../../services/sync/syncSchema';

describe('EMB4A sync registry', () => {
  it('syncs only the foundation entities', () => {
    expect(Object.keys(syncSchema)).toEqual([
      'establishments',
      'purpose_of_inspection',
      'inspection_reports',
      'survey_reports',
      'attachments',
    ]);
  });

  it('adds no parent dependencies of its own', () => {
    expect(PARENT_DEPENDENCIES.every(d => !d.childEntity.startsWith('compliance_'))).toBe(true);
  });
});
