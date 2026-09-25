import type { DynamicRow, ChecklistValue, YnValue } from '../../../components/form';
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  type FindingsEntry,
  type StoredFindingsEntry,
} from '../checklistEntries';
import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  SMR_QUARTER_KEY,
  SMR_QUARTERS,
  type SmrQuarter,
} from './airChecklistData';

// ── Emission sources (Table 6) ───────────────────────────────────────────────
// One row per emission source. snake_case: written straight through to
// emission_sources, matching the shape documented on the ComplianceAir
// model and read by AirComplianceView. The form's single "Fuel Type &
// Quantity" cell is two fields here and joined at export.
export type EmissionSourceRow = DynamicRow;

export const EMISSION_SOURCE_KEYS = [
  'source_no',
  'type',
  'rated_capacity',
  'fuel_type',
  'fuel_quantity',
  'operating_capacity',
  'control_facility',
  'notes',
] as const;

export function emptyEmissionSource(sourceNo: string): EmissionSourceRow {
  const row: EmissionSourceRow = {};
  for (const key of EMISSION_SOURCE_KEYS) row[key] = '';
  row.source_no = sourceNo;
  return row;
}

// ── Permit to Operate conditions (Table 8) ───────────────────────────────────
// camelCase in the form, the way water's DpConditionRow is; the record
// holds the snake_case shape every other conditions column already uses
// ({condition_no, description, compliant, remarks}) so a reader written
// for hazwaste's or water's conditions reads these too.
export interface PtoConditionRow {
  conditionNo: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export interface PtoConditionEntry {
  condition_no: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export const emptyPtoCondition = (conditionNo: string): PtoConditionRow => ({
  conditionNo,
  description: '',
  compliant: null,
  remarks: '',
});

// A condition with nothing written in it is a blank row the inspector
// added and never used, not a condition - same rule water applies to its
// discharge-permit conditions.
export function ptoConditionsForSave(rows: readonly PtoConditionRow[]): PtoConditionEntry[] {
  return rows
    .filter(r => r.description.trim() !== '')
    .map(r => ({
      condition_no: r.conditionNo,
      description: r.description,
      compliant: r.compliant,
      remarks: r.remarks,
    }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function ptoConditionsFromRecord(entries: readonly Record<string, unknown>[]): PtoConditionRow[] {
  return entries.map(e => ({
    conditionNo: str(e.condition_no),
    description: str(e.description),
    compliant: (e.compliant as YnValue) ?? null,
    remarks: str(e.remarks),
  }));
}

// ── Checklists (Table 7) ─────────────────────────────────────────────────────
// Five lists, one per printed group and per compliance_air column. The form
// holds them positionally (one ChecklistValue per question, in list order);
// the record holds keyed, self-describing entries - see ../checklistEntries.

export interface AirChecklistFormValues {
  checklistDao200426: ChecklistValue[];
  checklistDao200081: ChecklistValue[];
  checklistEmbMc: ChecklistValue[];
  checklistAppendixF: ChecklistValue[];
  checklistConsentAgreement: ChecklistValue[];
  // The Q1-Q4 ticks the form prints beside DAO 2004-26 Rule 19 Section 12.
  // Stored on that entry as `quarters` - see airChecklistsForSave.
  smrQuarters: SmrQuarter[];
}

export interface AirChecklistRecord {
  checklistDao200426: FindingsEntry[];
  checklistDao200081: FindingsEntry[];
  checklistEmbMc: FindingsEntry[];
  checklistAppendixF: FindingsEntry[];
  checklistConsentAgreement: FindingsEntry[];
}

// The record as it comes off the model or the detail hook: any column may
// be missing or null on a row written before it existed.
export type StoredAirChecklistRecord = {
  [K in keyof AirChecklistRecord]?: readonly StoredFindingsEntry[] | null;
};

const blankValues = (n: number): ChecklistValue[] =>
  Array.from({ length: n }, () => ({ compliant: null, remarks: '' }));

// All five columns at once, so a caller can't save four and forget one.
//
// The quarters ride on the quarterly-SMR entry whatever its Y/N/NA answer.
// This differs from water's "no stranded text" rule deliberately: an
// unticked Others beside free text contradicts the boxes, but "Q1 and Q2
// ticked, answer N" is a coherent record - it says which quarters were
// submitted and that the obligation was not met.
export function airChecklistsForSave(form: AirChecklistFormValues): AirChecklistRecord {
  const quarters = form.smrQuarters.filter(q => (SMR_QUARTERS as readonly string[]).includes(q));
  return {
    checklistDao200426: checklistEntriesForSave(AIR_CHECKLIST_DAO_2004_26, form.checklistDao200426).map(e =>
      e.key === SMR_QUARTER_KEY ? { ...e, quarters } : e,
    ),
    checklistDao200081: checklistEntriesForSave(AIR_CHECKLIST_DAO_2000_81, form.checklistDao200081),
    checklistEmbMc: checklistEntriesForSave(AIR_CHECKLIST_EMB_MC, form.checklistEmbMc),
    checklistAppendixF: checklistEntriesForSave(AIR_CHECKLIST_APPENDIX_F, form.checklistAppendixF),
    checklistConsentAgreement: checklistEntriesForSave(AIR_CHECKLIST_CONSENT_AGREEMENT, form.checklistConsentAgreement),
  };
}

// Quarters come back in SMR_QUARTERS order (Q1..Q4), filtered to the four
// the form knows; anything else an older or foreign build wrote is dropped.
function smrQuartersFrom(entries: readonly StoredFindingsEntry[]): SmrQuarter[] {
  const smr = entries.find(e => e.key === SMR_QUARTER_KEY) as Record<string, unknown> | undefined;
  const stored = Array.isArray(smr?.quarters) ? (smr.quarters as unknown[]) : [];
  return SMR_QUARTERS.filter(q => stored.includes(q));
}

export function airChecklistsFromRecord(record: StoredAirChecklistRecord): AirChecklistFormValues {
  const read = (defs: typeof AIR_CHECKLIST_DAO_2004_26, entries: readonly StoredFindingsEntry[] | null | undefined) =>
    checklistValuesFromEntries(defs, entries ?? []);
  return {
    checklistDao200426: read(AIR_CHECKLIST_DAO_2004_26, record.checklistDao200426),
    checklistDao200081: read(AIR_CHECKLIST_DAO_2000_81, record.checklistDao200081),
    checklistEmbMc: read(AIR_CHECKLIST_EMB_MC, record.checklistEmbMc),
    checklistAppendixF: read(AIR_CHECKLIST_APPENDIX_F, record.checklistAppendixF),
    checklistConsentAgreement: read(AIR_CHECKLIST_CONSENT_AGREEMENT, record.checklistConsentAgreement),
    smrQuarters: smrQuartersFrom(record.checklistDao200426 ?? []),
  };
}

// One line for read-only views: 'Q1, Q3', or a dash when none are ticked.
export function describeSmrQuarters(quarters: readonly string[]): string {
  return quarters.length === 0 ? '—' : quarters.join(', ');
}

// ── Whole form ───────────────────────────────────────────────────────────────

export interface AirComplianceFormState extends AirChecklistFormValues {
  emissionSources: EmissionSourceRow[];
  ptoConditions: PtoConditionRow[];
  documentsReviewed: string[];
  otherObservations: string;
  remarksRecommendations: string;
}

export function emptyAirComplianceForm(): AirComplianceFormState {
  return {
    emissionSources: [emptyEmissionSource('1')],
    checklistDao200426: blankValues(AIR_CHECKLIST_DAO_2004_26.length),
    checklistDao200081: blankValues(AIR_CHECKLIST_DAO_2000_81.length),
    checklistEmbMc: blankValues(AIR_CHECKLIST_EMB_MC.length),
    checklistAppendixF: blankValues(AIR_CHECKLIST_APPENDIX_F.length),
    checklistConsentAgreement: blankValues(AIR_CHECKLIST_CONSENT_AGREEMENT.length),
    smrQuarters: [],
    ptoConditions: [emptyPtoCondition('1')],
    documentsReviewed: [],
    otherObservations: '',
    remarksRecommendations: '',
  };
}
