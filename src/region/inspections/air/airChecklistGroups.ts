import { AIR_CHECKLIST_GROUPS } from './airChecklistData';
import type { ChecklistEntry, ChecklistGroup } from '../../../features/inspections/hooks/useInspectionReport';

// The five checklist columns as the form prints them, in its order. Exported
// for its test; the loader is the only production caller.
export function airChecklistGroupsFrom(c: {
  checklistDao200426?: ChecklistEntry[] | null;
  checklistDao200081?: ChecklistEntry[] | null;
  checklistEmbMc?: ChecklistEntry[] | null;
  checklistAppendixF?: ChecklistEntry[] | null;
  checklistConsentAgreement?: ChecklistEntry[] | null;
}): ChecklistGroup[] {
  const columns = [
    c.checklistDao200426,
    c.checklistDao200081,
    c.checklistEmbMc,
    c.checklistAppendixF,
    c.checklistConsentAgreement,
  ];
  return AIR_CHECKLIST_GROUPS.map((g, i) => ({ title: g.title, items: columns[i] ?? [] }));
}
