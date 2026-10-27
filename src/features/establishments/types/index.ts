// ── Embedded object types — re-exported from the sync layer, which is the
// canonical source for JSONB shapes shared between Supabase and WatermelonDB ──

import type {
  PermitSnapshotItem,
  ProductLineItem,
} from '../../../services/sync/syncTypes';
import type { ComplianceTag } from '../../../region';
import type { DueReportsSummary } from '../../../utils/reportUrgency';

export type { PermitSnapshotItem, ProductLineItem };

// ── Establishment operating_status values ─────────────────────────────────────
export type EstablishmentOperatingStatus =
  | 'Operational'
  | 'Temporarily Close'
  | 'Non-Operational';

// ── Sync status values (shared across all entities) ───────────────────────────
// Display-level status only — the local WatermelonDB syncState column tracks
// finer-grained states ('pending_create' | 'pending_update' | 'pending_delete'
// | 'synced', see src/services/sync/syncTypes.ts's SyncStatus) so push can
// tell creates from updates. UI badges don't need that distinction.
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export function toDisplaySyncStatus(syncState: string | null | undefined): SyncStatus {
  if (syncState === 'synced' || !syncState) return 'synced';
  if (syncState === 'conflict') return 'conflict';
  return 'pending'; // pending_create | pending_update | pending_delete
}

// ── Compliance tag — derived from report types ────────────────────────────────
// Used for display badges on EstablishmentCard
export type { ComplianceTag } from '../../../region';

// ── Full Establishment DTO — mirrors the establishments table ─────────────────
export interface EstablishmentDTO {
  id: string;                          // WatermelonDB internal ID
  estabId: string;                     // PK
  inspectorUid: string;                // FK → user_account.uid
  name: string;
  formerName: string | null;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  geoLat: number | null;
  geoLng: number | null;
  natureOfBusiness: string;
  psicCode: string | null;
  product: string | null;
  yearEstablished: number | null;
  operatingStatus: EstablishmentOperatingStatus;
  operatingHoursDay: number | null;
  operatingDaysWeek: number | null;
  operatingDaysYear: number | null;
  operatingStatusSince: string | null;
  productLines: ProductLineItem[];
  ownerName: string;
  managingHeadName: string;
  pcoName: string | null;
  pcoAccreditationNo: string | null;
  pcoEffectivity: string | null;
  phoneFax: string;
  email: string;
  contactPersonName: string;
  contactPersonPosition: string;
  denrPermits: PermitSnapshotItem[];
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deviceId: string;
  isArchived: boolean;
  // Derived — computed from inspection_reports linked to this establishment
  complianceTags: ComplianceTag[];
  // Derived from the same reports: how many of them are asking for attention
  // and how badly. Null when none are. See summarizeDueReports.
  dueReports: DueReportsSummary | null;
}
