// EMB4B's synced tables: field maps, DTO shapes and push-order parent
// dependencies. Type-only imports from the foundation keep this a leaf.
import type { ParentDependency } from '../../db/sync/collectPushChanges';
import type { SyncEntitySchema } from '../../services/sync/syncSchema';
import type { ISODateString, JsonArray, JsonObject } from '../../services/sync/syncTypes';

export type RegionSyncEntityName = 'compliance_air' | 'compliance_water' | 'compliance_hazwaste' | 'compliance_eia';

export const regionSyncEntities: Record<RegionSyncEntityName, SyncEntitySchema> = {
  compliance_air: {
    entity: 'compliance_air',
    primaryKey: 'compliance_id',
    localPrimaryKey: 'complianceId',
    updatedAtField: null,
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      compliance_id:           'complianceId',
      report_id:               'reportId',
      emission_sources:        'emissionSources',
      checklist_dao_2004_26:   'checklistDao200426',
      checklist_dao_2000_81:   'checklistDao200081',
      checklist_emb_mc:        'checklistEmbMc',
      checklist_appendix_f:    'checklistAppendixF',
      checklist_consent_agreement: 'checklistConsentAgreement',
      pto_conditions:          'ptoConditions',
      other_observations:      'otherObservations',
      remarks_recommendations: 'remarksRecommendations',
      documents_reviewed:      'documentsReviewed',
    },
  },

  compliance_water: {
    entity: 'compliance_water',
    primaryKey: 'compliance_id',
    localPrimaryKey: 'complianceId',
    updatedAtField: null,
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      compliance_id:               'complianceId',
      report_id:                   'reportId',
      water_sources:               'waterSources',
      wastewater_sources:          'wastewaterSources',
      abstracted_water_quality:    'abstractedWaterQuality',
      has_wwtp:                    'hasWwtp',
      non_wwtp_treatment:          'nonWwtpTreatment',
      wwtp_type:                   'wwtpType',
      wwtp_type_other:             'wwtpTypeOther',
      wwtp_details:                'wwtpDetails',
      wwtp_components:             'wwtpComponents',
      wwtp_condition:              'wwtpCondition',
      wwtp_condition_other:        'wwtpConditionOther',
      wwtp_under_construction:     'wwtpUnderConstruction',
      wwtp_construction_reported:  'wwtpConstructionReported',
      wwtp_construction_units:     'wwtpConstructionUnits',
      wwtp_construction_completion_date: 'wwtpConstructionCompletionDate',
      wwtp_treatment_units_utilized: 'wwtpTreatmentUnitsUtilized',
      sampling_conducted:          'samplingConducted',
      sampling_classification:     'samplingClassification',
      sampling_points:             'samplingPoints',
      previous_inspection_summary: 'previousInspectionSummary',
      checklist_dao_2005_10:       'checklistDao200510',
      dp_conditions:               'dpConditions',
      other_observations:          'otherObservations',
      remarks_recommendations:     'remarksRecommendations',
      documents_reviewed:          'documentsReviewed',
    },
  },

  compliance_hazwaste: {
    entity: 'compliance_hazwaste',
    primaryKey: 'compliance_id',
    localPrimaryKey: 'complianceId',
    updatedAtField: null,
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      compliance_id:               'complianceId',
      report_id:                   'reportId',
      hazwaste_generator_id:       'hazwasteGeneratorId',
      hazwaste_id_date_issued:     'hazwasteIdDateIssued',
      waste_types_generated:       'wasteTypesGenerated',
      checklist_registration:      'checklistRegistration',
      checklist_storage:           'checklistStorage',
      checklist_packaging:         'checklistPackaging',
      checklist_labeling:          'checklistLabeling',
      checklist_transport:         'checklistTransport',
      checklist_emergency:         'checklistEmergency',
      checklist_personnel_training:'checklistPersonnelTraining',
      checklist_manifest_system:   'checklistManifestSystem',
      hwid_conditions:             'hwidConditions',
      other_observations:          'otherObservations',
      remarks_recommendations:     'remarksRecommendations',
      documents_reviewed:          'documentsReviewed',
    },
  },

  compliance_eia: {
    entity: 'compliance_eia',
    primaryKey: 'compliance_id',
    localPrimaryKey: 'complianceId',
    updatedAtField: null,
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      compliance_id:           'complianceId',
      report_id:               'reportId',
      checklist_dao_2003_30:   'checklistDao200330',
      ecc_emp_conditions:      'eccEmpConditions',
      other_observations:      'otherObservations',
      remarks_recommendations: 'remarksRecommendations',
      documents_reviewed:      'documentsReviewed',
    },
  },
};

export const regionParentDependencies: ParentDependency[] = [
  { childEntity: 'compliance_air', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_water', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_hazwaste', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_eia', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
];

export interface ComplianceAirDTO {
  compliance_id: string;
  report_id: string;
  emission_sources?: JsonArray;
  checklist_dao_2004_26?: JsonArray;
  checklist_dao_2000_81?: JsonArray;
  checklist_emb_mc?: JsonArray;
  pto_conditions?: JsonArray;
  other_observations?: string | null;
  remarks_recommendations?: string | null;
  documents_reviewed?: JsonArray;
}

export interface ComplianceWaterDTO {
  compliance_id: string;
  report_id: string;
  water_sources?: JsonArray;
  wastewater_sources?: JsonArray;
  abstracted_water_quality?: JsonArray;
  has_wwtp?: boolean;
  wwtp_type?: string | null;
  wwtp_details?: JsonArray;
  wwtp_components?: JsonArray;
  wwtp_condition?: string | null;
  wwtp_condition_other?: string | null;
  wwtp_under_construction?: boolean;
  wwtp_construction_reported?: boolean | null;
  wwtp_construction_units?: string | null;
  wwtp_construction_completion_date?: ISODateString | null;
  wwtp_treatment_units_utilized?: string | null;
  sampling_conducted?: boolean | null;
  sampling_classification?: string | null;
  sampling_points?: JsonArray;
  previous_inspection_summary?: JsonObject;
  checklist_dao_2005_10?: JsonArray;
  dp_conditions?: JsonArray;
  other_observations?: string | null;
  remarks_recommendations?: string | null;
  documents_reviewed?: JsonArray;
}

export interface ComplianceHazwasteDTO {
  compliance_id: string;
  report_id: string;
  hazwaste_generator_id?: string | null;
  hazwaste_id_date_issued?: ISODateString | null;
  waste_types_generated?: JsonArray;
  checklist_registration?: JsonArray;
  checklist_storage?: JsonArray;
  checklist_packaging?: JsonArray;
  checklist_labeling?: JsonArray;
  checklist_transport?: JsonArray;
  checklist_emergency?: JsonArray;
  checklist_personnel_training?: JsonArray;
  checklist_manifest_system?: JsonArray;
  hwid_conditions?: JsonArray;
  other_observations?: string | null;
  remarks_recommendations?: string | null;
  documents_reviewed?: JsonArray;
}

export interface ComplianceEiaDTO {
  compliance_id: string;
  report_id: string;
  checklist_dao_2003_30?: JsonArray;
  ecc_emp_conditions?: JsonArray;
  other_observations?: string | null;
  remarks_recommendations?: string | null;
  documents_reviewed?: JsonArray;
}

export interface RegionDtoMap {
  compliance_air: ComplianceAirDTO;
  compliance_water: ComplianceWaterDTO;
  compliance_hazwaste: ComplianceHazwasteDTO;
  compliance_eia: ComplianceEiaDTO;
}
