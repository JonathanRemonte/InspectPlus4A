import type { ChecklistEntry, ChecklistGroup, ConditionEntry } from '../features/inspections/hooks/useInspectionReport';
import type {
  DpConditionRow,
  PreviousInspectionState,
  SamplingPointCard,
  WwtpDetailCard,
} from '../features/inspections/water/waterTypes';

export interface WaterComplianceView {
  kind: 'water';
  complianceId: string;
  waterSources: Record<string, unknown>[];
  wastewaterSources: Record<string, unknown>[];
  abstractedWaterQuality: Record<string, unknown>[];
  hasWwtp: boolean | null;
  nonWwtpTreatment: Record<string, unknown>;
  wwtpType: string | null;
  wwtpTypeOther: string | null;
  // wwtpDetails/wwtpComponents/samplingPoints/dpConditions are written by
  // the create flow (WaterInspectionFormScreen -> useReportFormState) using
  // WaterComplianceFormState's camelCase field names verbatim, unlike the
  // rest of this schema's snake_case JSONB convention — see waterTypes.ts.
  wwtpDetails: WwtpDetailCard[];
  // Untyped like waterSources and its neighbours, not WwtpComponentCard[]:
  // rows written before section 5D became checkboxes hold a comma-separated
  // string where each treatment array now is, so claiming the card shape
  // here would be a lie a reader would act on. WwtpComponentsSection decodes
  // on read — see decodeWwtpComponent in waterTypes.ts.
  wwtpComponents: Record<string, unknown>[];
  wwtpCondition: string | null;
  wwtpConditionOther: string | null;
  wwtpUnderConstruction: boolean | null;
  wwtpConstructionReported: boolean | null;
  wwtpConstructionUnits: string | null;
  wwtpConstructionCompletionDate: string | null;
  wwtpTreatmentUnitsUtilized: string | null;
  samplingConducted: boolean | null;
  samplingClassification: string | null;
  samplingPoints: SamplingPointCard[];
  previousInspectionSummary: PreviousInspectionState;
  checklistDao200510: ChecklistEntry[];
  dpConditions: DpConditionRow[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface HazwasteComplianceView {
  kind: 'hazwaste';
  hazwasteGeneratorId: string | null;
  hazwasteIdDateIssued: string | null;
  wasteTypesGenerated: Record<string, unknown>[];
  checklists: ChecklistGroup[];
  hwidConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface AirComplianceView {
  kind: 'air';
  emissionSources: Record<string, unknown>[];
  checklists: ChecklistGroup[];
  ptoConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface EiaComplianceView {
  kind: 'eia';
  checklistDao200330: ChecklistEntry[];
  eccEmpConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export type RegionComplianceView =
  | WaterComplianceView
  | HazwasteComplianceView
  | AirComplianceView
  | EiaComplianceView;
