import { AIR_CHECKLIST_GROUPS } from '../air/airChecklistData';
import { airChecklistGroupsFrom } from './useInspectionReport';

// useInspectionReport pulls in the native SQLite adapter and the supabase
// client transitively, neither of which loads under Jest — same two mocks
// src/features/establishments/hooks/useEstablishment.test.ts:8-19 uses.
// jest.mock calls are hoisted above the imports.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

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
