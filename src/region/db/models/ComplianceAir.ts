import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);

export class ComplianceAir extends Model {
  static table = 'compliance_air';

  // ── Identifiers ─────────────────────────────────────────────────────────────
  @field('complianceId')         complianceId!: string;
  @field('reportId')             reportId!: string;

  // ── Emission sources (Table 6) ───────────────────────────────────────────────
  // Each item: { source_no, type, rated_capacity, fuel_type,
  //              fuel_quantity, operating_capacity, control_facility, notes }
  @json('emissionSources', asArray)    emissionSources!: any[];

  // ── Checklists (Table 7) ─────────────────────────────────────────────────────
  // One column per printed group, in template order. Each item is keyed and
  // self-describing - { key, legal_ref, requirement, compliant: 'Y'|'N'|'NA',
  // remarks } - so a stored report reads on its own and answers are matched
  // by key, never by position. Questions and keys live in
  // src/features/inspections/air/airChecklistData.ts; the save/load boundary
  // is airChecklistsForSave / airChecklistsFromRecord in airTypes.ts.
  // The DAO 2004-26 "Quarterly submission of self-monitoring report" entry
  // additionally carries quarters: ('Q1'|'Q2'|'Q3'|'Q4')[] - the four tick
  // boxes the form prints beside it. Kept whatever the Y/N/NA answer: ticks
  // plus an N is a coherent record of partial submission.
  @json('checklistDao200426', asArray) checklistDao200426!: any[];
  @json('checklistDao200081', asArray) checklistDao200081!: any[];
  @json('checklistEmbMc', asArray)     checklistEmbMc!: any[];
  @json('checklistAppendixF', asArray) checklistAppendixF!: any[];
  @json('checklistConsentAgreement', asArray) checklistConsentAgreement!: any[];

  // ── Permit to Operate conditions (Table 8) ───────────────────────────────────
  // Each item: { condition_no, description, compliant: 'Y'|'N'|'NA', remarks }
  @json('ptoConditions', asArray)      ptoConditions!: any[];

  // ── Narrative fields (Table 9) ───────────────────────────────────────────────
  @field('otherObservations')          otherObservations!: string | null;
  @field('remarksRecommendations')     remarksRecommendations!: string | null;

  // ── Documents reviewed (Table 9) ─────────────────────────────────────────────
  // Values from AIR_DOCUMENTS_REVIEWED_OPTIONS: 'Record File Folder' |
  // 'Synology' | 'OPMS' | 'IIS Transactions' | 'CMR Online' | 'SMR Online' |
  // 'PCO Online' | 'Others'
  @json('documentsReviewed', asArray)  documentsReviewed!: string[];

  // ↓ 'syncState' instead of 'syncStatus' — avoids collision with
  //   WatermelonDB's internal Model.syncStatus property
  @field('syncState')                  syncState!: string;
}
