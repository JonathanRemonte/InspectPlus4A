import { tableSchema, type TableSchema } from '@nozbe/watermelondb';

// EMB4B's region tables. Column conventions are the foundation's — see the
// header of src/db/schema.ts (camelCase locals, syncState, updated_at).
export const regionTables: TableSchema[] = [
  // ── COMPLIANCE_AIR ───────────────────────────────────────────────────────
  tableSchema({
    name: 'compliance_air',
    columns: [
      { name: 'complianceId',           type: 'string' },
      { name: 'reportId',               type: 'string' },
      { name: 'emissionSources',        type: 'string', isOptional: true },
      { name: 'checklistDao200426',     type: 'string', isOptional: true },
      { name: 'checklistDao200081',     type: 'string', isOptional: true },
      { name: 'checklistEmbMc',         type: 'string', isOptional: true },
      // Table 7's fourth and fifth groups - the CEMS quality-assurance
      // questions and the two Consent Agreement ones. Added after the
      // table; NULL on rows written before, read as [] by the model.
      { name: 'checklistAppendixF',     type: 'string', isOptional: true },
      { name: 'checklistConsentAgreement', type: 'string', isOptional: true },
      { name: 'ptoConditions',          type: 'string', isOptional: true },
      { name: 'otherObservations',      type: 'string', isOptional: true },
      { name: 'remarksRecommendations', type: 'string', isOptional: true },
      { name: 'documentsReviewed',      type: 'string', isOptional: true },
      { name: 'syncState',              type: 'string', isOptional: true }, // ← not syncStatus
    ],
  }),

  // ── COMPLIANCE_WATER ─────────────────────────────────────────────────────
  tableSchema({
    name: 'compliance_water',
    columns: [
      { name: 'complianceId',               type: 'string' },
      { name: 'reportId',                   type: 'string' },
      { name: 'waterSources',               type: 'string', isOptional: true },
      { name: 'wastewaterSources',          type: 'string', isOptional: true },
      { name: 'abstractedWaterQuality',     type: 'string', isOptional: true },
      { name: 'hasWwtp',                    type: 'boolean', isOptional: true },
      // { systems: string[], other: string } - the treatment an
      // establishment runs when it has no WWTP (section 5A). Only written
      // while hasWwtp is false; see nonWwtpTreatmentForSave.
      { name: 'nonWwtpTreatment',           type: 'string', isOptional: true },
      { name: 'wwtpType',                   type: 'string', isOptional: true },
      { name: 'wwtpTypeOther',              type: 'string', isOptional: true },
      { name: 'wwtpDetails',                type: 'string', isOptional: true },
      { name: 'wwtpComponents',             type: 'string', isOptional: true },
      { name: 'wwtpCondition',              type: 'string', isOptional: true },
      { name: 'wwtpUnderConstruction',      type: 'boolean', isOptional: true },
      // Section 5E, questions 1 (specify) and 3-6. All nullable: NULL on
      // rows written before they existed, and the construction ones are
      // only ever populated while wwtpUnderConstruction is true - see
      // wwtpConstructionForSave.
      { name: 'wwtpConditionOther',         type: 'string', isOptional: true },
      { name: 'wwtpConstructionReported',   type: 'boolean', isOptional: true },
      { name: 'wwtpConstructionUnits',      type: 'string', isOptional: true },
      { name: 'wwtpConstructionCompletionDate', type: 'string', isOptional: true },
      { name: 'wwtpTreatmentUnitsUtilized', type: 'string', isOptional: true },
      // Section 6I's gate: whether the inspector sampled at all, and if
      // so whether ambient, effluent or both. samplingPoints is only ever
      // populated while samplingConducted is true - see samplingForSave.
      { name: 'samplingConducted',          type: 'boolean', isOptional: true },
      { name: 'samplingClassification',     type: 'string', isOptional: true },
      { name: 'samplingPoints',             type: 'string', isOptional: true },
      { name: 'previousInspectionSummary',  type: 'string', isOptional: true },
      { name: 'checklistDao200510',         type: 'string', isOptional: true },
      { name: 'dpConditions',               type: 'string', isOptional: true },
      { name: 'otherObservations',          type: 'string', isOptional: true },
      { name: 'remarksRecommendations',     type: 'string', isOptional: true },
      { name: 'documentsReviewed',          type: 'string', isOptional: true },
      { name: 'syncState',                  type: 'string', isOptional: true }, // ← not syncStatus
    ],
  }),

  // ── COMPLIANCE_HAZWASTE ──────────────────────────────────────────────────
  tableSchema({
    name: 'compliance_hazwaste',
    columns: [
      { name: 'complianceId',               type: 'string' },
      { name: 'reportId',                   type: 'string' },
      { name: 'hazwasteGeneratorId',        type: 'string', isOptional: true },
      { name: 'hazwasteIdDateIssued',       type: 'string', isOptional: true },
      { name: 'wasteTypesGenerated',        type: 'string', isOptional: true },
      { name: 'checklistRegistration',      type: 'string', isOptional: true },
      { name: 'checklistStorage',           type: 'string', isOptional: true },
      { name: 'checklistPackaging',         type: 'string', isOptional: true },
      { name: 'checklistLabeling',          type: 'string', isOptional: true },
      { name: 'checklistTransport',         type: 'string', isOptional: true },
      { name: 'checklistEmergency',         type: 'string', isOptional: true },
      { name: 'checklistPersonnelTraining', type: 'string', isOptional: true },
      { name: 'checklistManifestSystem',    type: 'string', isOptional: true },
      { name: 'hwidConditions',             type: 'string', isOptional: true },
      { name: 'otherObservations',          type: 'string', isOptional: true },
      { name: 'remarksRecommendations',     type: 'string', isOptional: true },
      { name: 'documentsReviewed',          type: 'string', isOptional: true },
      { name: 'syncState',                  type: 'string', isOptional: true }, // ← not syncStatus
    ],
  }),

  // ── COMPLIANCE_EIA ───────────────────────────────────────────────────────
  tableSchema({
    name: 'compliance_eia',
    columns: [
      { name: 'complianceId',           type: 'string' },
      { name: 'reportId',               type: 'string' },
      { name: 'checklistDao200330',     type: 'string', isOptional: true },
      { name: 'eccEmpConditions',       type: 'string', isOptional: true },
      { name: 'otherObservations',      type: 'string', isOptional: true },
      { name: 'remarksRecommendations', type: 'string', isOptional: true },
      { name: 'documentsReviewed',      type: 'string', isOptional: true },
      { name: 'syncState',              type: 'string', isOptional: true }, // ← not syncStatus
    ],
  }),
];
