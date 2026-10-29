import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const asArray  = (v: unknown) => (Array.isArray(v) ? v : []);
const asObject = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};

export class ComplianceWater extends Model {
  static table = 'compliance_water';

  // ── Identifiers ─────────────────────────────────────────────────────────────
  @field('complianceId')              complianceId!: string;
  @field('reportId')                  reportId!: string;

  // ── Water usage ──────────────────────────────────────────────────────────────
  // Each item: { source_type, daily_m3, annual_m3, specify }
  @json('waterSources', asArray)             waterSources!: any[];
  // Each item: { use_type, consumed_m3_day, generated_m3_day, outlet_info }
  @json('wastewaterSources', asArray)        wastewaterSources!: any[];
  // Each item: { source, bod_cod, tss, avfp, heavy_metal, specify }
  @json('abstractedWaterQuality', asArray)   abstractedWaterQuality!: any[];

  // ── WWTP ─────────────────────────────────────────────────────────────────────
  @field('hasWwtp')                          hasWwtp!: boolean | null;
  // { systems: string[], other: string } - only populated when hasWwtp is
  // false; a report with a WWTP stores {} here. See nonWwtpTreatmentForSave.
  @json('nonWwtpTreatment', asObject)        nonWwtpTreatment!: Record<string, any>;
  // wwtpType: 'Physical' | 'Biological' | 'Chemical' | 'Combined' | 'Others'
  @field('wwtpType')                         wwtpType!: string | null;
  // What "Others" means, when that's the answer. Empty otherwise - see
  // wwtpTypeOtherForSave in src/features/inspections/water/waterTypes.ts.
  @field('wwtpTypeOther')                    wwtpTypeOther!: string | null;
  // Each item: { outletNo, wwtpDetail, dateOfInstallation, designCapacity,
  //   annualMaintenanceCost, outletLocation, receivingBodyOfWater,
  //   flowMeterDevice, flowRate }. Keys are camelCase: the form object is
  //   written straight through by Object.assign, with no key transform.
  @json('wwtpDetails', asArray)              wwtpDetails!: any[];
  // Each item: { outletNo, wwtp, primaryTreatment[], primaryTreatmentOther,
  //   biologicalTreatment[], biologicalTreatmentOther, chemicalTreatment[],
  //   chemicalTreatmentOther, otherTreatment }. Rows written before section
  //   5D became checkboxes hold comma-separated strings where the arrays
  //   are; decodeWwtpComponent in waterTypes.ts reads both.
  @json('wwtpComponents', asArray)           wwtpComponents!: any[];
  // wwtpCondition: 'Properly Maintained' | 'Inadequately Maintained' |
  //                'Poor Maintenance' | 'Others'
  @field('wwtpCondition')                    wwtpCondition!: string | null;
  // What "Others" means, when that's the condition. Empty otherwise - see
  // wwtpConditionOtherForSave in src/features/inspections/water/waterTypes.ts.
  @field('wwtpConditionOther')               wwtpConditionOther!: string | null;
  @field('wwtpUnderConstruction')            wwtpUnderConstruction!: boolean | null;
  // Section 5E questions 3-6, asked only of a WWTP under construction or
  // rehabilitation. All null when wwtpUnderConstruction is not true - see
  // wwtpConstructionForSave.
  @field('wwtpConstructionReported')         wwtpConstructionReported!: boolean | null;
  @field('wwtpConstructionUnits')            wwtpConstructionUnits!: string | null;
  // ISO date string, same as every other date on the record.
  @field('wwtpConstructionCompletionDate')   wwtpConstructionCompletionDate!: string | null;
  @field('wwtpTreatmentUnitsUtilized')       wwtpTreatmentUnitsUtilized!: string | null;

  // ── Sampling ─────────────────────────────────────────────────────────────────
  // Whether the inspector conducted water quality sampling at all, and if
  // so its classification: 'Ambient' | 'Effluent' | 'Both'. samplingPoints
  // is [] and the classification null whenever this is not true - see
  // samplingForSave in src/features/inspections/water/waterTypes.ts.
  @field('samplingConducted')                samplingConducted!: boolean | null;
  @field('samplingClassification')           samplingClassification!: string | null;
  // Each item: { point_no, sampling_station, sampling_time, type_of_sample,
  //   parameters[{ parameter_name, value, unit, denr_standard, compliant, remarks }],
  //   remarks }
  @json('samplingPoints', asArray)           samplingPoints!: any[];
  // { date_of_sampling, sampling_station, sampling_time, type_of_sample,
  //   parameters[] }
  @json('previousInspectionSummary', asObject) previousInspectionSummary!: Record<string, any>;

  // ── Checklists ───────────────────────────────────────────────────────────────
  // Each item: { legal_ref, requirement, compliant: 'Y'|'N'|'NA', remarks }
  @json('checklistDao200510', asArray)       checklistDao200510!: any[];
  // Each item: { condition_no, description, compliant: 'Y'|'N'|'NA', remarks }
  @json('dpConditions', asArray)             dpConditions!: any[];

  // ── Narrative fields ─────────────────────────────────────────────────────────
  @field('otherObservations')                otherObservations!: string | null;
  @field('remarksRecommendations')           remarksRecommendations!: string | null;
  @json('documentsReviewed', asArray)        documentsReviewed!: string[];

  // ↓ 'syncState' instead of 'syncStatus' — avoids collision with
  //   WatermelonDB's internal Model.syncStatus property
  @field('syncState')                        syncState!: string;
}
