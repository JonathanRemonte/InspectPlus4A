import { AIR_CHECKLIST_GROUPS } from './airChecklistData';
import { airChecklistGroupsFrom } from './airChecklistGroups';

// The detail screen's read-only view of an air report lists the checklist
// groups as the printed form does - all five, in its order - so a reviewer
// reading the app and a reviewer holding the paper see the same sequence.

describe('airChecklistGroupsFrom', () => {
  it('yields the five printed groups in template order, empty columns as []', () => {
    const groups = airChecklistGroupsFrom({
      checklistDao200426: [{ key: 'a', compliant: 'Y' }],
      checklistDao200081: [],
      checklistEmbMc: [],
      checklistAppendixF: undefined,
      checklistConsentAgreement: null,
    });
    expect(groups.map(g => g.title)).toEqual(AIR_CHECKLIST_GROUPS.map(g => g.title));
    expect(groups[0].items).toEqual([{ key: 'a', compliant: 'Y' }]);
    expect(groups[3].items).toEqual([]);
    expect(groups[4].items).toEqual([]);
  });
});
