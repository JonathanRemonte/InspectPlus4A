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

  // The assertion above compares against AIR_CHECKLIST_GROUPS.map(g =>
  // g.title), which is true by construction and wouldn't notice
  // AIR_CHECKLIST_GROUPS itself being reordered. Pin the titles literally,
  // the way airChecklistData.test.ts already does.
  it('lists the five titles literally, in the form’s printed order', () => {
    expect(AIR_CHECKLIST_GROUPS.map(g => g.title)).toEqual([
      'DAO 2004-26',
      'DAO 2000-81',
      'EMB Memorandum Circulars',
      'Appendix F (Quality Assurance Procedures)',
      'For Facilities Engaged with Consent Agreement',
    ]);
  });

  // airChecklistGroupsFrom pairs AIR_CHECKLIST_GROUPS against its own
  // `columns` array by index, not by any shared key - reordering either
  // list would misattribute every group's data to the wrong title, and the
  // titles-only assertions above wouldn't catch it. Give each column a
  // distinguishable value and check it lands under its own title.
  it('carries each column under its own title, not just any title', () => {
    const groups = airChecklistGroupsFrom({
      checklistDao200426: [{ key: 'col-dao-2004-26', compliant: 'Y' }],
      checklistDao200081: [{ key: 'col-dao-2000-81', compliant: 'Y' }],
      checklistEmbMc: [{ key: 'col-emb-mc', compliant: 'Y' }],
      checklistAppendixF: [{ key: 'col-appendix-f', compliant: 'Y' }],
      checklistConsentAgreement: [{ key: 'col-consent-agreement', compliant: 'Y' }],
    });
    const itemsFor = (title: string) => groups.find(g => g.title === title)?.items;
    expect(itemsFor('DAO 2004-26')).toEqual([{ key: 'col-dao-2004-26', compliant: 'Y' }]);
    expect(itemsFor('DAO 2000-81')).toEqual([{ key: 'col-dao-2000-81', compliant: 'Y' }]);
    expect(itemsFor('EMB Memorandum Circulars')).toEqual([{ key: 'col-emb-mc', compliant: 'Y' }]);
    expect(itemsFor('Appendix F (Quality Assurance Procedures)')).toEqual([{ key: 'col-appendix-f', compliant: 'Y' }]);
    expect(itemsFor('For Facilities Engaged with Consent Agreement')).toEqual([{ key: 'col-consent-agreement', compliant: 'Y' }]);
  });
});
