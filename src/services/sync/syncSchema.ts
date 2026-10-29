import { regionSyncEntities, type RegionSyncEntityName } from '../../region/db';

export type FoundationSyncEntityName =
  | 'establishments'
  | 'purpose_of_inspection'
  | 'inspection_reports'
  | 'survey_reports'
  | 'attachments';

export type SyncEntityName = FoundationSyncEntityName | RegionSyncEntityName;

export interface SyncEntitySchema {
  entity: SyncEntityName;
  primaryKey: string;
  localPrimaryKey: string;
  updatedAtField: string | null;
  deletedAtField: string | null;
  softDelete: boolean;
  pushEnabled: boolean;
  pullEnabled: boolean;
  fields: Record<string, string>;
}

const foundationSyncSchema: Record<FoundationSyncEntityName, SyncEntitySchema> = {
  establishments: {
    entity: 'establishments',
    primaryKey: 'estab_id',
    localPrimaryKey: 'estabId',
    updatedAtField: 'updated_at',
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      estab_id:                'estabId',
      inspector_uid:           'inspectorUid',
      name:                    'name',
      former_name:             'formerName',
      address_line:            'addressLine',
      barangay:                'barangay',
      city:                    'city',
      province:                'province',
      geo_lat:                 'geoLat',
      geo_lng:                 'geoLng',
      nature_of_business:      'natureOfBusiness',
      psic_code:               'psicCode',
      product:                 'product',
      year_established:       'yearEstablished',
      operating_status:        'operatingStatus',
      operating_hours_day:     'operatingHoursDay',
      operating_days_week:     'operatingDaysWeek',
      operating_days_year:     'operatingDaysYear',
      operating_status_since:  'operatingStatusSince',
      product_lines:           'productLines',
      owner_name:              'ownerName',
      managing_head_name:      'managingHeadName',
      pco_name:                'pcoName',
      pco_accreditation_no:    'pcoAccreditationNo',
      pco_effectivity:         'pcoEffectivity',
      phone_fax:               'phoneFax',
      email:                   'email',
      contact_person_name:     'contactPersonName',
      contact_person_position: 'contactPersonPosition',
      denr_permits:            'denrPermits',
      device_id:               'deviceId',
      created_at:              'createdAt',
      updated_at:              'updatedAt',
      // backend: sync_status → local: syncState (avoids WatermelonDB Model.syncStatus collision)
      sync_status:             'syncState',
      is_archived:             'isArchived',
    },
  },

  purpose_of_inspection: {
    entity: 'purpose_of_inspection',
    primaryKey: 'purpose_id',
    localPrimaryKey: 'purposeId',
    updatedAtField: 'updated_at',
    deletedAtField: null,
    softDelete: false,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      purpose_id:              'purposeId',
      estab_id:                'estabId',
      inspector_uid:           'inspectorUid',
      inspection_date:         'inspectionDate',
      verify_info:             'verifyInfo',
      verify_info_list:        'verifyInfoList',
      determine_compliance:    'determineCompliance',
      investigate_complaints:  'investigateComplaints',
      check_commitments:       'checkCommitments',
      check_commitments_list:  'checkCommitmentsList',
      others:                  'others',
      device_id:               'deviceId',
      created_at:              'createdAt',
      updated_at:              'updatedAt',
      sync_status:             'syncState',  // ← syncState
    },
  },

  inspection_reports: {
    entity: 'inspection_reports',
    primaryKey: 'report_id',
    localPrimaryKey: 'reportId',
    updatedAtField: 'updated_at',
    deletedAtField: 'deleted_at',
    softDelete: true,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      report_id:              'reportId',
      estab_id:                'estabId',
      inspector_uid:           'inspectorUid',
      purpose_id:              'purposeId',
      report_type:             'reportType',
      report_control_no:       'reportControlNo',
      inspection_date:         'inspectionDate',
      establishment_snapshot:  'establishmentSnapshot',
      permits_snapshot:        'permitsSnapshot',
      is_archived:             'isArchived',
      device_id:               'deviceId',
      created_at:              'createdAt',
      updated_at:              'updatedAt',
      deleted_at:              'deletedAt',
      sync_status:             'syncState',  // ← syncState
      report_status:           'reportStatus',
    },
  },

  survey_reports: {
    entity: 'survey_reports',
    primaryKey: 'survey_id',
    localPrimaryKey: 'surveyId',
    updatedAtField: 'updated_at',
    deletedAtField: 'deleted_at',
    softDelete: true,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      survey_id:               'surveyId',
      estab_id:                'estabId',
      inspector_uid:           'inspectorUid',
      report_control_number:   'reportControlNumber',
      inspection_date:         'inspectionDate',
      project_name:            'projectName',
      reference_code:          'referenceCode',
      proponent_name:          'proponentName',
      contact_person:          'contactPerson',
      contact_position:        'contactPosition',
      contact_number:          'contactNumber',
      email:                   'email',
      project_location:        'projectLocation',
      geo_lat:                 'geoLat',
      geo_lng:                 'geoLng',
      area_size:               'areaSize',
      purpose:                 'purpose',
      document_type:           'documentType',
      project_status:          'projectStatus',
      physical_parameters:     'physicalParameters',
      biological_parameters:   'biologicalParameters',
      socioeconomic_parameters:'socioeconomicParameters',
      other_findings:          'otherFindings',
      remarks_recommendations: 'remarksRecommendations',
      created_at:              'createdAt',
      updated_at:              'updatedAt',
      deleted_at:              'deletedAt',
      is_archived:             'isArchived',
      sync_status:             'syncState',  // ← syncState
      device_id:               'deviceId',
      // Mobile-only for now — no matching Supabase column yet. Harmless to
      // include in the push payload (the RPC extracts named columns and
      // ignores extras); pull just won't populate it until the backend
      // catches up.
      report_status:           'reportStatus',
    },
  },

  // localUri, uploadStatus and uploadError are deliberately absent from
  // `fields` below — mapLocalToBackend (syncMappers.ts) only emits keys
  // present in this map, so those local-only columns never reach the push
  // payload. See schema.ts's `attachments` tableSchema comment.
  attachments: {
    entity: 'attachments',
    primaryKey: 'attachment_id',
    localPrimaryKey: 'attachmentId',
    updatedAtField: 'updated_at',
    deletedAtField: 'deleted_at',
    softDelete: true,
    pushEnabled: true,
    pullEnabled: true,
    fields: {
      attachment_id:        'attachmentId',
      inspection_report_id: 'inspectionReportId',
      survey_report_id:     'surveyReportId',
      inspector_uid:        'inspectorUid',
      storage_path:         'storagePath',
      file_name:            'fileName',
      mime_type:             'mimeType',
      file_size:             'fileSize',
      geo_lat:               'geoLat',
      geo_lng:               'geoLng',
      captured_at:           'capturedAt',
      caption:                'caption',
      device_id:             'deviceId',
      created_at:            'createdAt',
      updated_at:            'updatedAt',
      deleted_at:            'deletedAt',
      sync_status:           'syncState',  // ← syncState
    },
  },
};

export const coreSyncEntities: SyncEntityName[] = [
  'establishments',
  'inspection_reports',
  'survey_reports',
];

export function getSyncEntitySchema(entity: SyncEntityName): SyncEntitySchema {
  return syncSchema[entity];
}

export function getBackendFieldMap(entity: SyncEntityName): Record<string, string> {
  return syncSchema[entity].fields;
}

export function getLocalFieldMap(entity: SyncEntityName): Record<string, string> {
  const backendToLocal = syncSchema[entity].fields;
  return Object.fromEntries(
    Object.entries(backendToLocal).map(([backendField, localField]) => [
      localField,
      backendField,
    ])
  );
}

// Attachments go last: they can reference a row of any other table.
const { attachments, ...foundationParents } = foundationSyncSchema;

export const syncSchema: Record<SyncEntityName, SyncEntitySchema> = {
  ...foundationParents,
  ...regionSyncEntities,
  attachments,
};
