import type { ChecklistItemDef, ChecklistValue } from '../../components/form';
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  legalRefFor,
} from './checklistEntries';

// A stored checklist answer is matched to its question by key, never by
// position, and every entry carries its citation and wording as they
// stood when it was answered. These are the rules water's Summary of
// Findings settled on; air reuses them against five lists.

const DEFS: ChecklistItemDef[] = [
  { key: 'a', group: 'DAO 1', ref: 'Rule 1', requirement: 'First?' },
  { key: 'b', group: 'DAO 1', ref: 'Rule 2', requirement: 'Second?' },
  { key: 'c', group: 'Other', ref: '', requirement: 'Third?' },
];

const VALUES: ChecklistValue[] = [
  { compliant: 'Y', remarks: '' },
  { compliant: 'N', remarks: 'late' },
  { compliant: 'NA', remarks: '' },
];

describe('legalRefFor', () => {
  it('joins group and ref, or falls back to the group alone', () => {
    expect(legalRefFor(DEFS[0])).toBe('DAO 1 Rule 1');
    expect(legalRefFor(DEFS[2])).toBe('Other');
    expect(legalRefFor({ key: 'x', ref: 'Sec 9', requirement: 'q' })).toBe('Sec 9');
  });
});

describe('checklistEntriesForSave', () => {
  it('writes one self-describing entry per question, in list order', () => {
    expect(checklistEntriesForSave(DEFS, VALUES)).toEqual([
      { key: 'a', legal_ref: 'DAO 1 Rule 1', requirement: 'First?', compliant: 'Y', remarks: '' },
      { key: 'b', legal_ref: 'DAO 1 Rule 2', requirement: 'Second?', compliant: 'N', remarks: 'late' },
      { key: 'c', legal_ref: 'Other', requirement: 'Third?', compliant: 'NA', remarks: '' },
    ]);
  });

  it('treats a missing value as unanswered rather than throwing', () => {
    expect(checklistEntriesForSave(DEFS, [VALUES[0]])[2]).toEqual({
      key: 'c', legal_ref: 'Other', requirement: 'Third?', compliant: null, remarks: '',
    });
  });
});

describe('checklistValuesFromEntries', () => {
  it('round-trips what was saved', () => {
    expect(checklistValuesFromEntries(DEFS, checklistEntriesForSave(DEFS, VALUES))).toEqual(VALUES);
  });

  it('matches by key, so a reordered record still lands on the right questions', () => {
    const entries = checklistEntriesForSave(DEFS, VALUES);
    const shuffled = [entries[2], entries[0], entries[1]];
    expect(checklistValuesFromEntries(DEFS, shuffled)).toEqual(VALUES);
  });

  it('drops entries the list no longer knows and blanks questions it has no entry for', () => {
    const legacy = [
      { legal_ref: 'Section 1', requirement: 'Retired placeholder', compliant: 'Y', remarks: 'x' },
      { key: 'b', compliant: 'N', remarks: 'kept' },
    ];
    expect(checklistValuesFromEntries(DEFS, legacy)).toEqual([
      { compliant: null, remarks: '' },
      { compliant: 'N', remarks: 'kept' },
      { compliant: null, remarks: '' },
    ]);
  });

  it('tolerates a non-string remarks value from an older build', () => {
    expect(checklistValuesFromEntries(DEFS, [{ key: 'a', compliant: 'Y', remarks: null }])[0]).toEqual({
      compliant: 'Y', remarks: '',
    });
  });
});
