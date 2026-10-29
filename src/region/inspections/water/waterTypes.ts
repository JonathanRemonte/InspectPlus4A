import type { DynamicRow, ChecklistValue, YnValue } from '../../../components/form';
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  type FindingsEntry,
  type StoredFindingsEntry,
} from '../../../features/inspections/checklistEntries';
import {
  WATER_FINDINGS_CHECKLIST,
  NON_WWTP_TREATMENT_OTHERS,
  TREATMENT_OTHERS,
  WWTP_TYPE_OTHERS,
  WWTP_CONDITION_OTHERS,
  PRIMARY_TREATMENT_OPTIONS,
  BIOLOGICAL_TREATMENT_OPTIONS,
  CHEMICAL_TREATMENT_OPTIONS,
} from './waterChecklistData';
import { getWaterbodyGroups, WATERBODY_NOT_LISTED } from '../../data/waterbodies';

export interface WwtpDetailCard {
  outletNo: string;
  wwtpDetail: string;
  dateOfInstallation: string;
  designCapacity: string;
  annualMaintenanceCost: string;
  outletLocation: string;
  receivingBodyOfWater: string;
  receivingBodyOfWaterOther: string;
  flowMeterDevice: string;
  flowRate: string;
}

export interface WwtpComponentCard {
  outletNo: string;
  wwtp: string;
  primaryTreatment: string[];
  primaryTreatmentOther: string;
  biologicalTreatment: string[];
  biologicalTreatmentOther: string;
  chemicalTreatment: string[];
  chemicalTreatmentOther: string;
  otherTreatment: string;
}

export interface SamplingParameterRow {
  parameterName: string;
  value: string;
  unit: string;
  denrStandard: string;
  compliant: YnValue;
  remarks: string;
}

export interface SamplingPointCard {
  pointNo: string;
  samplingStation: string;
  samplingTime: string;
  typeOfSample: string;
  remarks: string;
  parameters: SamplingParameterRow[];
}

export interface PreviousInspectionState {
  // Whether any previous sampling inspection records exist at all - the
  // section's gate. null on reports written before it was asked.
  hasRecords: 'yes' | 'no' | null;
  dateOfSampling: string;
  samplingStation: string;
  samplingTime: string;
  typeOfSample: string;
  parameters: SamplingParameterRow[];
}

export interface DpConditionRow {
  conditionNo: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export interface WaterComplianceFormState {
  waterSources: DynamicRow[];
  wastewaterSources: DynamicRow[];
  abstractedWaterQuality: DynamicRow[];
  hasWwtp: 'yes' | 'no' | null;
  // Only meaningful on the "no" branch, but kept in state regardless so
  // toggling Has WWTP doesn't destroy the answer - see
  // nonWwtpTreatmentForSave for where the record stops being that lenient.
  nonWwtpSystems: string[];
  nonWwtpOther: string;
  wwtpType: string;
  wwtpTypeOther: string;
  wwtpDetails: WwtpDetailCard[];
  wwtpComponents: WwtpComponentCard[];
  wwtpCondition: string;
  wwtpConditionOther: string;
  wwtpUnderConstruction: 'yes' | 'no' | null;
  // Section 5E questions 3-6. Only asked while wwtpUnderConstruction is
  // 'yes', but kept in state regardless so flipping the answer doesn't
  // destroy what was typed - see wwtpConstructionForSave for where the
  // record stops being that lenient.
  wwtpConstructionReported: 'yes' | 'no' | null;
  wwtpConstructionUnits: string;
  wwtpConstructionCompletionDate: string;
  wwtpTreatmentUnitsUtilized: string;
  // Section 6I's gate. Points are kept in state whatever the answer so
  // flipping it doesn't destroy them - see samplingForSave for where the
  // record stops being that lenient.
  samplingConducted: 'yes' | 'no' | null;
  samplingClassification: string;
  samplingPoints: SamplingPointCard[];
  previousInspection: PreviousInspectionState;
  checklistDao200510: ChecklistValue[];
  dpConditions: DpConditionRow[];
  documentsReviewed: string[];
  otherObservations: string;
  remarksRecommendations: string;
}

export const emptySamplingParameter = (): SamplingParameterRow => ({
  parameterName: '',
  value: '',
  unit: '',
  denrStandard: '',
  compliant: null,
  remarks: '',
});

export const emptySamplingPoint = (pointNo: string): SamplingPointCard => ({
  pointNo,
  samplingStation: '',
  samplingTime: '',
  typeOfSample: '',
  remarks: '',
  parameters: [],
});

export const emptyWwtpDetail = (outletNo: string): WwtpDetailCard => ({
  outletNo,
  wwtpDetail: '',
  dateOfInstallation: '',
  designCapacity: '',
  annualMaintenanceCost: '',
  outletLocation: '',
  receivingBodyOfWater: '',
  receivingBodyOfWaterOther: '',
  flowMeterDevice: '',
  flowRate: '',
});

export const emptyWwtpComponent = (outletNo: string): WwtpComponentCard => ({
  outletNo,
  wwtp: '',
  primaryTreatment: [],
  primaryTreatmentOther: '',
  biologicalTreatment: [],
  biologicalTreatmentOther: '',
  chemicalTreatment: [],
  chemicalTreatmentOther: '',
  otherTreatment: '',
});

export const emptyDpCondition = (conditionNo: string): DpConditionRow => ({
  conditionNo,
  description: '',
  compliant: null,
  remarks: '',
});

export function emptyWaterComplianceForm(): WaterComplianceFormState {
  return {
    waterSources: [{ source_type: '', daily_m3: '', annual_m3: '', specify: '' }],
    wastewaterSources: [{ use_type: '', consumed_m3_day: '', generated_m3_day: '', outlet_info: '' }],
    abstractedWaterQuality: [{ source: '', specify: '', bod_cod: '', tss: '', avfp: '', heavy_metal: '' }],
    hasWwtp: null,
    nonWwtpSystems: [],
    nonWwtpOther: '',
    wwtpType: '',
    wwtpTypeOther: '',
    wwtpDetails: [],
    wwtpComponents: [],
    wwtpCondition: '',
    wwtpConditionOther: '',
    wwtpUnderConstruction: null,
    wwtpConstructionReported: null,
    wwtpConstructionUnits: '',
    wwtpConstructionCompletionDate: '',
    wwtpTreatmentUnitsUtilized: '',
    samplingConducted: null,
    samplingClassification: '',
    samplingPoints: [],
    previousInspection: {
      hasRecords: null,
      dateOfSampling: '',
      samplingStation: '',
      samplingTime: '',
      typeOfSample: '',
      parameters: [],
    },
    checklistDao200510: WATER_FINDINGS_CHECKLIST.map(() => ({ compliant: null, remarks: '' })),
    dpConditions: [emptyDpCondition('1')],
    documentsReviewed: [],
    otherObservations: '',
    remarksRecommendations: '',
  };
}

// What section 5A's treatment-system answer contributes to the record.
export interface NonWwtpTreatment {
  systems: string[];
  other: string;
}

// The boundary between a forgiving form and a strict record. The form keeps
// a selection alive while an inspector toggles "Has WWTP?" back and forth,
// so an accidental Yes costs nothing; the stored report is not that
// lenient, because a report describing both a WWTP and a septic tank leaves
// a reader no way to tell which one is real. Same reason the free text is
// dropped unless Others is actually ticked - text stranded by an untick
// would otherwise contradict the boxes beside it.
// The rule itself, shared by the create form and the edit screen so a
// report saved from either one stores the same thing.
export function nonWwtpTreatmentFor(
  hasNoWwtp: boolean,
  systems: string[],
  other: string,
): NonWwtpTreatment | Record<string, never> {
  if (!hasNoWwtp) return {};
  return {
    systems,
    other: systems.includes(NON_WWTP_TREATMENT_OTHERS) ? other.trim() : '',
  };
}

export function nonWwtpTreatmentForSave(
  form: WaterComplianceFormState,
): NonWwtpTreatment | Record<string, never> {
  return nonWwtpTreatmentFor(form.hasWwtp === 'no', form.nonWwtpSystems, form.nonWwtpOther);
}

// One line summarising the answer for read-only views, folding the free
// text into the Others tick it belongs to rather than showing an orphaned
// "Others" beside a separate box.
export function describeNonWwtpTreatment(systems: string[], other: string): string {
  if (systems.length === 0) return '—';
  return systems
    .map(s => (s === NON_WWTP_TREATMENT_OTHERS && other ? `${s}: ${other}` : s))
    .join(', ');
}

// ── Receiving body of water ──────────────────────────────────────────────────
// The field stores one string either way: the picked option, or - when the
// receiving water isn't on EMB's list - whatever the inspector typed. The
// form splits that back into a selection and a text box on open and rejoins
// it on save, so the record never holds a "Not listed (specify)" label
// standing in for a real name.

export function decodeReceivingBodyOfWater(
  stored: string,
  province: string,
): { selection: string; other: string } {
  if (!stored) return { selection: '', other: '' };
  const known = getWaterbodyGroups(province).some(g => g.options.includes(stored));
  return known
    ? { selection: stored, other: '' }
    : { selection: WATERBODY_NOT_LISTED, other: stored };
}

export function receivingBodyOfWaterForSave(selection: string, other: string): string {
  if (selection !== WATERBODY_NOT_LISTED) return selection;
  return other.trim();
}

// Both entry paths - the create form and the edit screen - write a whole
// outlet card, not one field at a time, so this is the boundary they
// actually share, exactly as wwtpComponentForSave is for section 5D. The
// specify key is blanked because the record holds one string: what the
// inspector typed is now *in* receivingBodyOfWater, and a copy left beside
// it would be text the next open has to reconcile.
export function wwtpDetailForSave(d: WwtpDetailCard): WwtpDetailCard {
  return {
    ...d,
    receivingBodyOfWater: receivingBodyOfWaterForSave(
      d.receivingBodyOfWater,
      d.receivingBodyOfWaterOther,
    ),
    receivingBodyOfWaterOther: '',
  };
}

export function describeReceivingBodyOfWater(detail: WwtpDetailCard): string {
  const value = receivingBodyOfWaterForSave(
    detail.receivingBodyOfWater,
    detail.receivingBodyOfWaterOther,
  );
  return value || '—';
}

// ── WWTP treatment components ────────────────────────────────────────────────
// Rows written before section 5D became checkboxes hold a comma-separated
// string here, because the field was one free-text box hinted
// "Comma-separated". Decoding is lenient and happens on read: no data
// migration, and a report nobody re-opens is never rewritten.

export function decodeTreatment(
  stored: unknown,
  options: string[],
): { selected: string[]; other: string } {
  const parts = Array.isArray(stored)
    ? stored.map(String)
    : typeof stored === 'string'
      ? stored.split(',').map(s => s.trim())
      : [];
  const selected: string[] = [];
  const unmatched: string[] = [];
  parts.filter(Boolean).forEach(part => {
    const match = options.find(o => o.toLowerCase() === part.toLowerCase());
    if (match) {
      if (!selected.includes(match)) selected.push(match);
    } else {
      unmatched.push(part);
    }
  });
  // What the list doesn't recognise is still what the inspector wrote, so it
  // moves under Others rather than being discarded.
  if (unmatched.length > 0 && !selected.includes(TREATMENT_OTHERS)) {
    selected.push(TREATMENT_OTHERS);
  }
  return { selected, other: unmatched.join(', ') };
}

// A stage's specify text can arrive two ways. A legacy row has no specify
// key at all - its unrecognised fragments are what decodeTreatment
// recovered. A row this build wrote keeps the text in its own key, and the
// array beside it normally holds nothing but ticks. Normally: if an option
// is later renamed, that array also carries an entry the list no longer
// knows, and then both parts are the inspector's words. So they are joined
// rather than one preferred - anything unrecognised is preserved verbatim,
// never displaced by the other copy.
const treatmentOtherFor = (recovered: string, stored: unknown): string =>
  [recovered, String(stored ?? '')].filter(Boolean).join(', ');

export function decodeWwtpComponent(stored: Record<string, unknown>): WwtpComponentCard {
  const primary = decodeTreatment(stored.primaryTreatment, PRIMARY_TREATMENT_OPTIONS);
  const biological = decodeTreatment(stored.biologicalTreatment, BIOLOGICAL_TREATMENT_OPTIONS);
  const chemical = decodeTreatment(stored.chemicalTreatment, CHEMICAL_TREATMENT_OPTIONS);
  return {
    outletNo: String(stored.outletNo ?? ''),
    wwtp: String(stored.wwtp ?? ''),
    primaryTreatment: primary.selected,
    primaryTreatmentOther: treatmentOtherFor(primary.other, stored.primaryTreatmentOther),
    biologicalTreatment: biological.selected,
    biologicalTreatmentOther: treatmentOtherFor(biological.other, stored.biologicalTreatmentOther),
    chemicalTreatment: chemical.selected,
    chemicalTreatmentOther: treatmentOtherFor(chemical.other, stored.chemicalTreatmentOther),
    otherTreatment: String(stored.otherTreatment ?? ''),
  };
}

// Same boundary nonWwtpTreatmentFor draws: text stranded by an untick would
// contradict the boxes beside it, so it never reaches the record.
export function treatmentForSave(
  selected: string[],
  other: string,
): { selected: string[]; other: string } {
  return { selected, other: selected.includes(TREATMENT_OTHERS) ? other.trim() : '' };
}

// Both entry paths - the create form and the edit screen - write a whole
// component card, not one stage at a time, so this is the boundary they
// actually share. Reconciling all three stages in one place means a fourth
// stage, or a rename, can't update one call site and silently leave the
// other persisting text stranded by an unticked Others.
export function wwtpComponentForSave(c: WwtpComponentCard): WwtpComponentCard {
  const primary = treatmentForSave(c.primaryTreatment, c.primaryTreatmentOther);
  const biological = treatmentForSave(c.biologicalTreatment, c.biologicalTreatmentOther);
  const chemical = treatmentForSave(c.chemicalTreatment, c.chemicalTreatmentOther);
  return {
    ...c,
    primaryTreatment: primary.selected,
    primaryTreatmentOther: primary.other,
    biologicalTreatment: biological.selected,
    biologicalTreatmentOther: biological.other,
    chemicalTreatment: chemical.selected,
    chemicalTreatmentOther: chemical.other,
  };
}

export function describeTreatment(selected: string[], other: string): string {
  if (selected.length === 0) return '—';
  return selected.map(s => (s === TREATMENT_OTHERS && other ? `${s}: ${other}` : s)).join(', ');
}

// ── Type of WWTP ─────────────────────────────────────────────────────────────
// "Others" says the plant is none of the listed kinds; this says which kind
// it is. Same boundary as nonWwtpTreatmentFor: text stranded by re-picking a
// listed type would contradict the choice beside it, so it never reaches the
// record.

export function wwtpTypeOtherForSave(wwtpType: string, other: string): string {
  return wwtpType === WWTP_TYPE_OTHERS ? other.trim() : '';
}

export function describeWwtpType(wwtpType: string, other: string): string {
  if (!wwtpType) return '—';
  return wwtpType === WWTP_TYPE_OTHERS && other ? `${wwtpType}: ${other}` : wwtpType;
}

// ── Condition of the WWTP ────────────────────────────────────────────────────
// Section 5E. Question 1's "Others" and questions 3-6 follow the same rule
// as wwtpTypeOtherForSave: an answer is only recorded while the answer it
// hangs off still calls for it, so the record can't describe two answers at
// once - specify text for a listed condition, or construction work on a
// plant it also says is not under construction.

export function wwtpConditionOtherForSave(condition: string, other: string): string {
  return condition === WWTP_CONDITION_OTHERS ? other.trim() : '';
}

export function describeWwtpCondition(condition: string, other: string): string {
  if (!condition) return '—';
  return condition === WWTP_CONDITION_OTHERS && other ? `${condition}: ${other}` : condition;
}

export interface WwtpConstructionAnswers {
  wwtpConstructionReported: 'yes' | 'no' | null;
  wwtpConstructionUnits: string;
  wwtpConstructionCompletionDate: string;
  wwtpTreatmentUnitsUtilized: string;
}

export interface WwtpConstructionRecord {
  wwtpConstructionReported: boolean | null;
  wwtpConstructionUnits: string | null;
  wwtpConstructionCompletionDate: string | null;
  wwtpTreatmentUnitsUtilized: string | null;
}

// ── Previous Inspection ──────────────────────────────────────────────────────
// The whole section is one jsonb object, so its gate lives inside it as
// `hasRecords` rather than in a column of its own. A No stores only the
// gate - fields stranded by flipping to No would describe a previous
// sampling the record also says never happened, the same rule
// samplingForSave applies. A report never asked (null) keeps the rule it
// was written under: the summary if a date was entered, otherwise nothing.

export function previousInspectionForSave(state: PreviousInspectionState): Record<string, unknown> {
  const { hasRecords, ...fields } = state;
  if (hasRecords === 'no') return { hasRecords: false };
  if (hasRecords === 'yes') return { hasRecords: true, ...fields };
  return fields.dateOfSampling ? fields : {};
}

// ── Summary of Findings ──────────────────────────────────────────────────────
// The keyed, self-describing entry shape and the key-matching read live in
// ../checklistEntries.ts, shared with the air report. These are that
// mechanism bound to this form's list. (Still under the
// checklist_dao_2005_10 column; renaming it isn't worth a push_changes
// re-issue.)

export type { FindingsEntry, StoredFindingsEntry };

export function findingsEntriesForSave(values: ChecklistValue[]): FindingsEntry[] {
  return checklistEntriesForSave(WATER_FINDINGS_CHECKLIST, values);
}

// Answers are matched by key, never by position. Entries the current list
// doesn't know - the retired "Section N" placeholders - are dropped, so an
// old report opens blank here rather than with answers under the wrong
// questions.
export function findingsValuesFromEntries(entries: readonly StoredFindingsEntry[]): ChecklistValue[] {
  return checklistValuesFromEntries(WATER_FINDINGS_CHECKLIST, entries);
}

// ── Water Quality Sampling ───────────────────────────────────────────────────
// Section 6I. A report that says no sampling happened can't also list
// sampling points, so a No clears them and the classification on save. A
// report that was never asked (null - written before the question existed)
// keeps its points as they are.

export interface SamplingRecord {
  samplingConducted: boolean | null;
  samplingClassification: string | null;
  samplingPoints: SamplingPointCard[];
}

export function samplingForSave(
  conducted: 'yes' | 'no' | boolean | null,
  classification: string,
  points: SamplingPointCard[],
): SamplingRecord {
  if (conducted === null) {
    return { samplingConducted: null, samplingClassification: null, samplingPoints: points };
  }
  const yes = conducted === true || conducted === 'yes';
  return {
    samplingConducted: yes,
    samplingClassification: yes ? classification.trim() || null : null,
    samplingPoints: yes ? points : [],
  };
}

export function describeSampling(conducted: boolean | null, classification: string | null): string {
  if (conducted === null) return '—';
  if (!conducted) return 'No — not applicable';
  return classification ? `Yes — ${classification}` : 'Yes';
}

// `underConstruction` is question 2 as the caller holds it - the form's
// 'yes'/'no'/null or the record's boolean/null; only a definite yes keeps
// questions 3-6. Question 3 stays null when unanswered rather than
// collapsing to No, since "not asked" and "No" are different answers.
export function wwtpConstructionForSave(
  underConstruction: 'yes' | 'no' | boolean | null,
  answers: WwtpConstructionAnswers,
): WwtpConstructionRecord {
  if (underConstruction !== true && underConstruction !== 'yes') {
    return {
      wwtpConstructionReported: null,
      wwtpConstructionUnits: null,
      wwtpConstructionCompletionDate: null,
      wwtpTreatmentUnitsUtilized: null,
    };
  }
  return {
    wwtpConstructionReported:
      answers.wwtpConstructionReported == null ? null : answers.wwtpConstructionReported === 'yes',
    wwtpConstructionUnits: answers.wwtpConstructionUnits.trim() || null,
    wwtpConstructionCompletionDate: answers.wwtpConstructionCompletionDate.trim() || null,
    wwtpTreatmentUnitsUtilized: answers.wwtpTreatmentUnitsUtilized.trim() || null,
  };
}
