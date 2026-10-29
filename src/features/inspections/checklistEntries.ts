import type { ChecklistItemDef, ChecklistValue, YnValue } from '../../components/form';

// The stored form of a compliance-checklist answer, shared by every
// checklist_* column on the compliance tables. The form holds one
// {compliant, remarks} per question, in list order; the record holds the
// same answers keyed and self-describing - each entry carries the
// question's key, citation and wording as they stood when it was answered
// - so a stored report reads on its own and survives the list being
// reordered or revised.
export interface FindingsEntry {
  key: string;
  legal_ref: string;
  requirement: string;
  compliant: YnValue;
  remarks: string;
}

// An entry as it comes back off a record: our own FindingsEntry, the
// detail hook's looser ChecklistEntry, or whatever an older build wrote.
export type StoredFindingsEntry = Partial<FindingsEntry> | Record<string, unknown>;

// "DAO 2004-26 Rule 19 Section 1", or just the group when the question has
// no citation of its own, or just the ref when it has no group.
export function legalRefFor(def: ChecklistItemDef): string {
  return [def.group, def.ref].filter(Boolean).join(' ');
}

export function checklistEntriesForSave(
  defs: readonly ChecklistItemDef[],
  values: readonly ChecklistValue[],
): FindingsEntry[] {
  return defs.map((def, i) => ({
    key: def.key,
    legal_ref: legalRefFor(def),
    requirement: def.requirement,
    compliant: values[i]?.compliant ?? null,
    remarks: values[i]?.remarks ?? '',
  }));
}

// Answers are matched by key, never by position. Entries the list doesn't
// know are dropped, so an old report opens blank there rather than with
// answers under the wrong questions.
export function checklistValuesFromEntries(
  defs: readonly ChecklistItemDef[],
  entries: readonly StoredFindingsEntry[],
): ChecklistValue[] {
  const byKey = new Map<string, StoredFindingsEntry>();
  for (const e of entries) if (typeof e.key === 'string') byKey.set(e.key, e);
  return defs.map(def => {
    const e = byKey.get(def.key);
    return {
      compliant: (e?.compliant as YnValue) ?? null,
      remarks: typeof e?.remarks === 'string' ? e.remarks : '',
    };
  });
}
