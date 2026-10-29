import type { RegionDtoMap } from '../../region/db';

export type SyncStatus =
  | 'pending'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'synced';

export type ISODateString = string;
export type ISODateTimeString = string;
export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];

export interface SyncEntityChanges<TCreated = unknown, TUpdated = TCreated> {
  created: TCreated[];
  updated: TUpdated[];
  deleted: string[];
}

interface FoundationDtoMap {
  establishments: EstablishmentDTO;
  purpose_of_inspection: PurposeOfInspectionDTO;
  inspection_reports: InspectionReportDTO;
  survey_reports: SurveyReportDTO;
  attachments: AttachmentDTO;
}

type SyncDtoMap = FoundationDtoMap & RegionDtoMap;

export interface PullChangesResponse {
  changes: { [K in keyof SyncDtoMap]: SyncEntityChanges<SyncDtoMap[K]> };
  timestamp: number;
}

export type PushChangesPayload = { [K in keyof SyncDtoMap]?: SyncEntityChanges<SyncDtoMap[K]> };

export interface PushChangesResponse {
  status: 'ok';
  // Primary keys of "updated" rows the server declined to apply because a
  // newer version already existed server-side (the last-write-wins guard —
  // see docs/sync-contract.md's Conflict Handling). Present only when
  // non-empty. markLocalChangesAsSynced must not mark these as synced —
  // see watermelonAdapter.ts.
  conflicts?: Partial<Record<SyncEntityName, string[]>>;
}

// ── Shared JSONB shapes ───────────────────────────────────────────────────

// Used by establishments.denr_permits and inspection_reports.permits_snapshot
export interface PermitSnapshotItem {
  envi_law: string;
  permit_type: string;
  permit_serial: string;
  issued_date: ISODateString;
  expiry_date: ISODateString;
}

// Used by establishments.product_lines
export interface ProductLineItem {
  product_line: string;
  ecc_production_rate: string;
  actual_production_rate: string;
}

// Used by inspection_reports.establishment_snapshot — a single object (not
// an array), frozen from establishments at report-creation time. Deliberately
// excludes product, year_established and denr_permits (the latter is
// tracked separately via inspection_reports.permits_snapshot).
export interface EstablishmentSnapshot {
  estab_id: string;
  name: string;
  former_name: string | null;
  address_line: string;
  barangay: string;
  city: string;
  province: string;
  geo_lat: number | null;
  geo_lng: number | null;
  nature_of_business: string;
  psic_code: string | null;
  operating_status: string;
  operating_hours_day: number | null;
  operating_days_week: number | null;
  operating_days_year: number | null;
  // Only meaningful when operating_status isn't 'Operational' — see
  // src/utils/flexibleDate.ts for the mm-dd-yyyy / mm-yyyy / yyyy formats
  // this free-text field accepts.
  operating_status_since: string | null;
  owner_name: string;
  managing_head_name: string;
  pco_name: string | null;
  pco_accreditation_no: string | null;
  pco_effectivity: ISODateString | null;
  phone_fax: string;
  email: string;
  contact_person_name: string;
  contact_person_position: string;
  product_lines: ProductLineItem[];
}

// Used by purpose_of_inspection.verify_info_list
export type VerifyInfoItemKey =
  | 'pmpin'
  | 'hazwaste_id'
  | 'hazwaste_transporter'
  | 'hazwaste_tsd'
  | 'pto_air'
  | 'discharge_permit'
  | 'others';

export type VerifyInfoStatus = 'new' | 'renewal' | null;

export interface VerifyInfoListItem {
  item_key: VerifyInfoItemKey;
  status: VerifyInfoStatus;
  remarks: string | null;
}

// Used by purpose_of_inspection.check_commitments_list
export type CheckCommitmentItemKey =
  | 'industrial_ecowatch'
  | 'pepp'
  | 'pab'
  | 'others';

export interface CheckCommitmentsListItem {
  item_key: CheckCommitmentItemKey;
  remarks: string | null;
}

export interface EstablishmentDTO {
  estab_id: string;
  inspector_uid: string;
  name: string;
  former_name?: string | null;
  address_line: string;
  barangay: string;
  city: string;
  province: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  nature_of_business: string;
  psic_code?: string | null;
  product?: string | null;
  year_established?: number | null;
  operating_status: string;
  operating_hours_day?: number | null;
  operating_days_week?: number | null;
  operating_days_year?: number | null;
  operating_status_since?: string | null;
  product_lines?: ProductLineItem[];
  owner_name: string;
  managing_head_name: string;
  pco_name?: string | null;
  pco_accreditation_no?: string | null;
  pco_effectivity?: ISODateString | null;
  phone_fax: string;
  email: string;
  contact_person_name: string;
  contact_person_position: string;
  denr_permits?: PermitSnapshotItem[];
  device_id?: string | null;
  created_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
  sync_status?: SyncStatus | string;
  is_archived?: boolean;
}

export interface PurposeOfInspectionDTO {
  purpose_id: string;
  estab_id: string;
  inspector_uid: string;
  inspection_date: ISODateString;
  verify_info: boolean;
  verify_info_list?: VerifyInfoListItem[];
  determine_compliance: boolean;
  investigate_complaints: boolean;
  check_commitments: boolean;
  check_commitments_list?: CheckCommitmentsListItem[];
  others?: string | null;
  device_id?: string | null;
  created_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
  sync_status?: SyncStatus | string;
}

export interface InspectionReportDTO {
  report_id: string;
  estab_id: string;
  inspector_uid: string;
  purpose_id: string;
  report_type: string;
  report_control_no?: string | null;
  inspection_date: ISODateString;
  establishment_snapshot: EstablishmentSnapshot;
  permits_snapshot: PermitSnapshotItem[];
  is_archived?: boolean;
  device_id?: string | null;
  created_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
  deleted_at?: ISODateTimeString | null;
  sync_status?: SyncStatus | string;
  report_status?: 'draft' | 'submitted';
}

export interface SurveyReportDTO {
  survey_id: string;
  estab_id: string;
  inspector_uid: string;
  report_control_number: string;
  inspection_date: ISODateString;
  project_name: string;
  reference_code?: string | null;
  proponent_name: string;
  contact_person?: string | null;
  contact_position?: string | null;
  contact_number?: string | null;
  email?: string | null;
  project_location: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  area_size?: number | null;
  purpose: string;
  document_type?: string | null;
  project_status?: string | null;
  physical_parameters?: JsonObject;
  biological_parameters?: JsonObject;
  socioeconomic_parameters?: JsonObject;
  other_findings?: string | null;
  remarks_recommendations?: string | null;
  created_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
  deleted_at?: ISODateTimeString | null;
  is_archived?: boolean;
  sync_status?: SyncStatus | string;
  device_id?: string | null;
  // Mobile-only for now — no matching Supabase column yet.
  report_status?: 'draft' | 'submitted';
}

export interface AttachmentDTO {
  attachment_id: string;
  inspection_report_id?: string | null;
  survey_report_id?: string | null;
  inspector_uid: string;
  storage_path?: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  geo_lat?: number | null;
  geo_lng?: number | null;
  captured_at: ISODateTimeString;
  caption?: string | null;
  device_id?: string | null;
  created_at?: ISODateTimeString;
  updated_at?: ISODateTimeString;
  deleted_at?: ISODateTimeString | null;
  sync_status?: SyncStatus | string;
}

export interface SyncMetadata {
  lastPulledAt: number | null;
  lastSyncAt?: number | null;
  isSyncing?: boolean;
  // uid of the inspector this device last ran a sync for — see
  // syncOrchestrator.ts's ensureSyncScopedToUser. lastPulledAt is a single
  // incremental watermark; if a different user logs in on the same device,
  // an incremental pull would skip everything outside the previous user's
  // RLS-visible scope that predates the watermark, even though the new
  // user is allowed to see it. Comparing against this field is how that
  // gets detected.
  lastSyncedUserId?: string | null;
}

export type CoreSyncEntityName =
  | 'establishments'
  | 'inspection_reports'
  | 'survey_reports';

export type SyncEntityName = keyof PullChangesResponse['changes'];