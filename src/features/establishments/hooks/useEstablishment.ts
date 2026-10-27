import { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../../../db/database';
import { Establishment, InspectionReport, SurveyReport } from '../../../db/models';
import { Q } from '@nozbe/watermelondb';
import type { EstablishmentDTO, ComplianceTag, SyncStatus } from '../types';
import { toDisplaySyncStatus } from '../types';
import { resolveInspectorNames } from '../../../services/inspectorNames';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { REPORT_TYPE_DISPLAY } from '../../../constants/reportTypeDisplay';
import { COMPLIANCE_TAGS, SURVEY_COMPLIANCE_TAG } from '../../../region';
import { summarizeDueReports } from '../../../utils/reportUrgency';

// ── Jurisdiction visibility ─────────────────────────────────────────────────
// Mirrors the "inspectors can read jurisdiction establishments" and "admins
// and developers can read all establishments" RLS policies (see
// supabase/migrations/20260806030000_add_province_and_municipality_assignments.sql
// and 20260806040000_add_developer_role_and_admin_visibility.sql)
// client-side: establishments are only ever created locally on-device (there
// is no pull-sync reconciliation that purges rows a device shouldn't see —
// see docs/sync-contract.md), so this has to be enforced as a real query
// constraint here, not just an optional filter the UI happens to default to.
const UNRESTRICTED_ROLES = new Set(['Administrator', 'Developer']);

// Administrator/Developer accounts see every establishment/report, full
// stop — no need to even look up the establishment record for these roles.
export function isPrivilegedRole(role: string): boolean {
  return UNRESTRICTED_ROLES.has(role);
}

// Distinct from isPrivilegedRole above: that's a READ-only expansion shared
// by Administrator and Developer. Developer alone additionally gets
// unrestricted WRITE access — add/edit/delete on any establishment or
// report, not just their own — per
// supabase/migrations/20260807010000_add_developer_full_write_access.sql.
// Administrator's write access stays owner-only. Client-side gates using
// this must stay in sync with that migration's RLS policies: showing an
// edit/delete control this doesn't cover would let a role tap an action
// that the backend silently drops.
export function canManageAllRecords(role: string): boolean {
  return role === 'Developer';
}

export function isEstablishmentVisible(
  e: { province: string; inspectorUid: string },
  myProvince: string,
  myUid: string,
  myRole: string,
): boolean {
  return isPrivilegedRole(myRole) || e.inspectorUid === myUid || e.province === myProvince;
}

// Resolves the signed-in user's own uid/province/role for the visibility
// check above. Empty until auth finishes loading — callers should treat
// "no province yet" as "show nothing" rather than "show everything", since
// an empty check would otherwise fail open. Administrator/Developer accounts
// never have a province (they bypass province scoping entirely — see
// isPrivilegedRole above and auth.ts's CRED_ROLE_KEY comment), so requiring
// one for them would fail closed permanently instead of just until auth
// resolves.
function useJurisdiction(): { myUid: string; myProvince: string; myRole: string; ready: boolean } {
  const { session, province, role } = useAuthContext();
  const myUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  const myRole = role ?? '';
  return {
    myUid,
    myProvince: province ?? '',
    myRole,
    ready: !!myUid && (isPrivilegedRole(myRole) || !!province),
  };
}

// ── Report type → compliance tag mapping ──────────────────────────────────────
// Report type → establishment compliance tag; survey_reports add
// SURVEY_COMPLIANCE_TAG separately (see below). Region-owned vocabulary.
const REPORT_TYPE_TO_TAG: Record<string, ComplianceTag> = Object.fromEntries(
  COMPLIANCE_TAGS.filter(t => t.dataKey !== null).map(t => [t.dataKey, t.tag]),
);

// Local-only sync states (never sent to the backend as-is — see
// collectPushChanges.ts's withBackendSyncStatus) that mean "this row still
// needs to be pushed."
const PENDING_LOCAL_STATES = new Set(['pending_create', 'pending_update', 'pending_delete']);

// The establishment's own "Pending sync" badge should reflect its full state
// as an inspector thinks of it — general info, its inspection/survey
// reports, AND any attachments on those reports (a newly added photo, a
// bulk delete, or an edited caption) — not just the establishments row in
// isolation. Adding a report/attachment keeps it pending on purpose (a
// reminder there's something unsynced), but reverting a change (e.g. adding
// then deleting a never-synced report, or editing a field back to its
// last-synced value) must actually clear it — see
// resolveEstablishmentContentEdit and reportPersistence.ts's
// hard-delete-if-never-synced path for the other half of that contract.
function computeEstablishmentSyncStatus(
  estabSyncState: string,
  reportsRaw: { syncState: string }[],
  surveyReports: { syncState: string }[],
  attachments: { syncState: string }[],
): SyncStatus {
  if (estabSyncState === 'conflict') return 'conflict';
  const hasPendingChanges =
    reportsRaw.some(r => PENDING_LOCAL_STATES.has(r.syncState)) ||
    surveyReports.some(r => PENDING_LOCAL_STATES.has(r.syncState)) ||
    attachments.some(a => PENDING_LOCAL_STATES.has(a.syncState));
  if (hasPendingChanges) return 'pending';
  return toDisplaySyncStatus(estabSyncState);
}

// Attachments reference a report, not an establishment directly, so this
// takes already-fetched report/survey ids rather than querying by estabId
// itself, and groups the result by parent report id — both the aggregate
// establishment-level check (computeEstablishmentSyncStatus) and each
// individual report row's own badge (see reportSyncStatusWithAttachments)
// need the same underlying data, just rolled up differently. Skips the
// query entirely when there are no reports at all — an empty Q.oneOf(...)
// would otherwise need special-casing per clause.
async function fetchAttachmentSyncStatesByReport(
  reportIds: string[],
  surveyReportIds: string[],
): Promise<Map<string, string[]>> {
  const byReportId = new Map<string, string[]>();
  if (reportIds.length === 0 && surveyReportIds.length === 0) return byReportId;

  const clauses = [];
  if (reportIds.length > 0) clauses.push(Q.where('inspectionReportId', Q.oneOf(reportIds)));
  if (surveyReportIds.length > 0) clauses.push(Q.where('surveyReportId', Q.oneOf(surveyReportIds)));

  const rows = (await database.collections
    .get('attachments')
    .query(clauses.length === 1 ? clauses[0] : Q.or(...clauses))
    .fetch()) as unknown as { inspectionReportId: string | null; surveyReportId: string | null; syncState: string }[];

  for (const row of rows) {
    const parentId = row.inspectionReportId ?? row.surveyReportId;
    if (!parentId) continue;
    const list = byReportId.get(parentId);
    if (list) {
      list.push(row.syncState);
    } else {
      byReportId.set(parentId, [row.syncState]);
    }
  }
  return byReportId;
}

// Per-report counterpart of computeEstablishmentSyncStatus, for report list
// rows (ReportListCard) and the report detail header (InspectionReportHeader)
// — a report whose own row is already 'synced' should still read as
// 'pending' if one of its attachments (a new photo, a bulk delete, an
// edited caption) hasn't reached the server yet. Exported so
// useInspectionReport.ts can compute the same normalized status for the
// single report it loads.
export function reportSyncStatusWithAttachments(reportSyncState: string, attachmentSyncStates: string[]): SyncStatus {
  if (reportSyncState === 'conflict') return 'conflict';
  if (PENDING_LOCAL_STATES.has(reportSyncState) || attachmentSyncStates.some(s => PENDING_LOCAL_STATES.has(s))) {
    return 'pending';
  }
  return toDisplaySyncStatus(reportSyncState);
}

// ── Map WatermelonDB model → EstablishmentDTO ──────────────────────────────────
async function modelToDTO(model: Establishment): Promise<EstablishmentDTO> {
  // Derive compliance tags from linked inspection reports
  const reportsRaw = await database.collections
    .get('inspection_reports')
    .query(Q.where('estabId', model.estabId))
    .fetch();

  const surveyReports = await database.collections
    .get('survey_reports')
    .query(Q.where('estabId', model.estabId))
    .fetch();

  const attachmentSyncStatesByReport = await fetchAttachmentSyncStatesByReport(
    reportsRaw.map((r: any) => r.reportId),
    surveyReports.map((r: any) => r.surveyId),
  );
  const attachments = Array.from(attachmentSyncStatesByReport.values())
    .flat()
    .map(syncState => ({ syncState }));

  // Same rule as useEstablishmentReports: a soft-deleted report (pending_delete
  // locally, or deletedAt set by a pulled remote delete) must not count toward
  // the establishment's tags — otherwise a deleted report's tag/badge lingers
  // on the establishment card even though its own report list shows nothing.
  const reports = reportsRaw.filter(
    (r: any) => !r.deletedAt && r.syncState !== 'pending_delete',
  );

  const tagSet = new Set<ComplianceTag>();
  reports.forEach((r: any) => {
    const tag = REPORT_TYPE_TO_TAG[r.reportType];
    if (tag) tagSet.add(tag);
  });
  if (surveyReports.length > 0) tagSet.add(SURVEY_COMPLIANCE_TAG);

  // The establishment's due indicator counts exactly what its own report list
  // flags, so both kinds of report are included — and surveys get the same
  // soft-delete filter the inspection reports above already have, so a
  // deleted one can't inflate the count.
  const dueReports = summarizeDueReports([
    ...reports.map((r: any) => ({ date: r.inspectionDate, status: r.reportStatus })),
    ...surveyReports
      .filter((r: any) => !r.deletedAt && r.syncState !== 'pending_delete')
      .map((r: any) => ({ date: r.inspectionDate, status: r.reportStatus ?? 'draft' })),
  ]);

  return {
    id:                     model.id,
    estabId:                model.estabId,
    inspectorUid:           model.inspectorUid,
    name:                   model.name,
    formerName:             model.formerName,
    addressLine:            model.addressLine,
    barangay:               model.barangay,
    city:                   model.city,
    province:               model.province,
    geoLat:                 model.geoLat,
    geoLng:                 model.geoLng,
    natureOfBusiness:       model.natureOfBusiness,
    psicCode:               model.psicCode,
    product:                model.product,
    yearEstablished:        model.yearEstablished,
    operatingStatus:        model.operatingStatus as any,
    operatingHoursDay:      model.operatingHoursDay,
    operatingDaysWeek:      model.operatingDaysWeek,
    operatingDaysYear:      model.operatingDaysYear,
    operatingStatusSince:   model.operatingStatusSince,
    productLines:           model.productLines ?? [],
    ownerName:              model.ownerName,
    managingHeadName:       model.managingHeadName,
    pcoName:                model.pcoName,
    pcoAccreditationNo:     model.pcoAccreditationNo,
    pcoEffectivity:         model.pcoEffectivity,
    phoneFax:               model.phoneFax,
    email:                  model.email,
    contactPersonName:      model.contactPersonName,
    contactPersonPosition:  model.contactPersonPosition,
    denrPermits:            model.denrPermits ?? [],
    createdAt:              model.createdAt,
    updatedAt:              model.updatedAt,
    syncStatus:             computeEstablishmentSyncStatus(model.syncState, reportsRaw as any, surveyReports as any, attachments),
    deviceId:               model.deviceId,
    isArchived:             model.isArchived,
    complianceTags:         Array.from(tagSet),
    dueReports,
  };
}

// ── Hook return type ──────────────────────────────────────────────────────────
interface UseEstablishmentsReturn {
  establishments: EstablishmentDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface EstablishmentFilters {
  province?: string;
  city?: string;
  inspectorUid?: string;
  complianceTag?: ComplianceTag | '';
}

const EMPTY_ESTABLISHMENT_FILTERS: EstablishmentFilters = {};

// ── useEstablishments ─────────────────────────────────────────────────────────
// Fetches all establishments from local WatermelonDB, ordered by name.
// Accepts an optional search query that filters by name, address, or city,
// plus optional region/inspector/compliance-type filters. Re-fetches when
// search or filters change or when refetch() is called — refetch() returns
// a promise so callers (e.g. pull-to-refresh) can await completion.
//
// NOTE: When the sync layer is wired up, a successful pull will update
// WatermelonDB directly — just call refetch() from the sync completion
// callback to refresh this list without any other changes.
// ─────────────────────────────────────────────────────────────────────────────
export function useEstablishments(
  search = '',
  filters: EstablishmentFilters = EMPTY_ESTABLISHMENT_FILTERS,
): UseEstablishmentsReturn {
  const [establishments, setEstablishments] = useState<EstablishmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { myUid, myProvince, myRole, ready } = useJurisdiction();

  // Guards against a stale, slower request clobbering a fresher one when
  // refetch() overlaps with the search-driven effect (or a rapid double pull).
  const requestId = useRef(0);

  // Only the very first fetch should show the full-screen spinner. Every
  // later fetch (search-as-you-type, refetch()) sets `loading` back to
  // true too if left ungated — which unmounts the search bar's TextInput
  // via the tab component's `if (loading) return <spinner>` and drops
  // native keyboard focus after every keystroke. Subsequent fetches just
  // update the list in place instead.
  const hasLoadedOnce = useRef(false);

  const fetchEstablishments = useCallback(async (searchTerm: string, f: EstablishmentFilters) => {
    const id = ++requestId.current;
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      setError(null);

      // Auth hasn't resolved a province yet — show nothing rather than
      // everything (fail closed, not open) until it does.
      if (!ready) {
        if (id === requestId.current) setEstablishments([]);
        return;
      }

      const q = searchTerm.trim().toLowerCase();

      // Fetch all, then filter — WatermelonDB SQLite adapter supports
      // Q.where with string matching but case-insensitive LIKE requires
      // a raw query; filtering in JS is simpler and fast for typical
      // inspector-level dataset sizes (hundreds, not millions).
      const all = await database.collections
        .get<Establishment>('establishments')
        .query()
        .fetch();

      // Jurisdiction baseline first — same-province or own establishments
      // only (see isEstablishmentVisible) — then the name search and any
      // user-chosen filters narrow further within that. Archived
      // establishments (the local stand-in for "deleted", see
      // archiveEstablishmentRecord) are excluded from every list surface.
      const visible = all.filter(e => isEstablishmentVisible(e, myProvince, myUid, myRole) && !e.isArchived);

      // Name-only — matching on address/city/province too used to pull in
      // unrelated establishments that merely shared a location with the
      // search term, which read as inaccurate results.
      let filtered = q
        ? visible.filter(e => e.name.toLowerCase().includes(q))
        : visible;

      if (f.province) filtered = filtered.filter(e => e.province === f.province);
      if (f.city) filtered = filtered.filter(e => e.city === f.city);
      if (f.inspectorUid) filtered = filtered.filter(e => e.inspectorUid === f.inspectorUid);

      // Sort by name ascending
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      let dtos = await Promise.all(filtered.map(modelToDTO));

      if (f.complianceTag) {
        dtos = dtos.filter(d => d.complianceTags.includes(f.complianceTag as ComplianceTag));
      }

      if (id === requestId.current) {
        setEstablishments(dtos);
      }
    } catch (err) {
      if (id === requestId.current) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load establishments.';
        setError(message);
        console.error('[useEstablishments]', err);
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, [ready, myProvince, myUid, myRole]);

  useEffect(() => {
    fetchEstablishments(search, filters);
  }, [search, filters, fetchEstablishments]);

  const refetch = useCallback(
    () => fetchEstablishments(search, filters),
    [fetchEstablishments, search, filters],
  );

  return { establishments, loading, error, refetch };
}

// ── useEstablishmentFilterOptions ─────────────────────────────────────────────
// Derives the option lists for the Manage Establishments filter sheet: every
// province actually in use, and every inspector actually assigned to at
// least one establishment (resolved to a display name). Independent of the
// search/filter state above so the option lists don't shrink as filters
// are applied.
interface InspectorOption {
  uid: string;
  name: string;
}

interface UseEstablishmentFilterOptionsReturn {
  provinceOptions: string[];
  inspectorOptions: InspectorOption[];
  loading: boolean;
}

export function useEstablishmentFilterOptions(): UseEstablishmentFilterOptionsReturn {
  const [provinceOptions, setProvinceOptions] = useState<string[]>([]);
  const [inspectorOptions, setInspectorOptions] = useState<InspectorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { myUid, myProvince, myRole, ready } = useJurisdiction();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!ready) {
        if (!cancelled) {
          setProvinceOptions([]);
          setInspectorOptions([]);
          setLoading(false);
        }
        return;
      }
      try {
        const all = await database.collections
          .get<Establishment>('establishments')
          .query()
          .fetch();

        const visible = all.filter(e => isEstablishmentVisible(e, myProvince, myUid, myRole) && !e.isArchived);

        const provinces = Array.from(new Set(visible.map(e => e.province).filter(Boolean))).sort();
        const inspectorUids = Array.from(new Set(visible.map(e => e.inspectorUid).filter(Boolean)));

        const names = await resolveInspectorNames(inspectorUids);
        const inspectors = inspectorUids
          .map(uid => ({ uid, name: names[uid] ?? uid }))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setProvinceOptions(provinces);
          setInspectorOptions(inspectors);
        }
      } catch (err) {
        console.error('[useEstablishmentFilterOptions]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [ready, myProvince, myUid, myRole]);

  return { provinceOptions, inspectorOptions, loading };
}

// ── Hook return type for a single establishment ──────────────────────────────
interface UseEstablishmentReturn {
  establishment: EstablishmentDTO | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── useEstablishment ──────────────────────────────────────────────────────────
// Fetches a single establishment by estabId from local WatermelonDB.
// Used by the establishment detail screen (features/establishments/EstablishmentDetailScreen).
export function useEstablishment(estabId: string | undefined): UseEstablishmentReturn {
  const [establishment, setEstablishment] = useState<EstablishmentDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { myUid, myProvince, myRole, ready } = useJurisdiction();

  // Same rationale as useEstablishments' hasLoadedOnce: `ready`/myProvince/
  // myRole can each flip shortly after mount as AuthProvider's session-first,
  // province/role-backfilled-after bootstrap settles (see AuthProvider.tsx),
  // re-running this effect. Without this guard that re-run flips `loading`
  // back to true and flashes the full-screen spinner a second time for what
  // the user experiences as a single screen visit.
  const hasLoadedOnce = useRef(false);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEstablishment() {
      if (!estabId || !ready) {
        setEstablishment(null);
        setLoading(false);
        return;
      }
      try {
        if (!hasLoadedOnce.current) setLoading(true);
        setError(null);

        const matches = await database.collections
          .get<Establishment>('establishments')
          .query(Q.where('estabId', estabId))
          .fetch();

        // Not visible under jurisdiction rules, or archived (the local
        // stand-in for "deleted") -> treat exactly like "not found", same
        // as RLS would for a row outside a user's grant.
        const match = matches.find(e => isEstablishmentVisible(e, myProvince, myUid, myRole) && !e.isArchived);

        if (!cancelled) {
          setEstablishment(match ? await modelToDTO(match) : null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load establishment.';
          setError(message);
          console.error('[useEstablishment]', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedOnce.current = true;
        }
      }
    }

    fetchEstablishment();
    return () => { cancelled = true; };
  }, [estabId, tick, ready, myProvince, myUid, myRole]);

  return { establishment, loading, error, refetch };
}

// ── Establishment reports (inspection + survey), for the detail screen ────────
export interface EstablishmentReportItem {
  key: string;
  kind: 'inspection' | 'survey';
  reportId: string;
  inspectorUid: string;
  reportType: string;
  title: string;
  date: string;
  controlNo: string | null;
  status: string | null;
  syncStatus: SyncStatus;
  // Linked purpose_of_inspection row id — only set for inspection-kind
  // items, used by "Reuse Existing" to copy a past report's purpose
  // answers into a new one. Survey reports have no linked purpose row.
  purposeId?: string;
}

// Derived so the labels can't drift from the icons and colors beside them —
// REPORT_TYPE_DISPLAY is the source of truth. The Record<string, string>
// shape is unchanged, so existing consumers (ManageReportsTab,
// InspectionReportDetailScreen, EstablishmentDetailScreen) are unaffected.
export const INSPECTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_TYPE_DISPLAY).map(([key, meta]) => [key, meta.label]),
);

interface UseEstablishmentReportsReturn {
  reports: EstablishmentReportItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEstablishmentReports(estabId: string | undefined): UseEstablishmentReportsReturn {
  const [reports, setReports] = useState<EstablishmentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchReports() {
      if (!estabId) {
        setReports([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const [inspectionReportsRaw, surveyReports] = await Promise.all([
          database.collections
            .get<InspectionReport>('inspection_reports')
            .query(Q.where('estabId', estabId))
            .fetch(),
          database.collections
            .get<SurveyReport>('survey_reports')
            .query(Q.where('estabId', estabId))
            .fetch(),
        ]);

        // Exclude reports that have been deleted locally (pending_delete,
        // not yet pushed) or remotely (deletedAt set by a pulled soft
        // delete) — see deleteInspectionReportRecord.
        const inspectionReports = inspectionReportsRaw.filter(
          r => !r.deletedAt && r.syncState !== 'pending_delete',
        );

        const attachmentSyncStatesByReport = await fetchAttachmentSyncStatesByReport(
          inspectionReports.map(r => r.reportId),
          surveyReports.map(r => r.surveyId),
        );

        const items: EstablishmentReportItem[] = [
          ...inspectionReports.map(r => ({
            key: `inspection-${r.reportId}`,
            kind: 'inspection' as const,
            reportId: r.reportId,
            inspectorUid: r.inspectorUid,
            reportType: r.reportType,
            title: INSPECTION_TYPE_LABELS[r.reportType] ?? r.reportType,
            date: r.inspectionDate,
            controlNo: r.reportControlNo,
            status: r.reportStatus,
            syncStatus: reportSyncStatusWithAttachments(r.syncState, attachmentSyncStatesByReport.get(r.reportId) ?? []),
            purposeId: r.purposeId,
          })),
          ...surveyReports.map(r => ({
            key: `survey-${r.surveyId}`,
            kind: 'survey' as const,
            reportId: r.surveyId,
            inspectorUid: r.inspectorUid,
            reportType: 'survey',
            title: r.projectName || 'Survey Report',
            date: r.inspectionDate,
            controlNo: r.reportControlNumber,
            // Mobile-only field, absent on rows written before it existed.
            status: r.reportStatus ?? 'draft',
            syncStatus: reportSyncStatusWithAttachments(r.syncState, attachmentSyncStatesByReport.get(r.surveyId) ?? []),
          })),
        ];

        // Most recent first
        items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

        if (!cancelled) setReports(items);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load reports.';
          setError(message);
          console.error('[useEstablishmentReports]', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReports();
    return () => { cancelled = true; };
  }, [estabId, tick]);

  return { reports, loading, error, refetch };
}

// ── All reports across establishments, for the "Manage Reports" tab ───────────
export type ReportStatusFilter = 'all' | 'draft' | 'submitted';
export type ReportSortOrder = 'newest' | 'oldest';

export interface AllReportItem extends EstablishmentReportItem {
  estabId: string;
  estabName: string;
  estabProvince: string;
  estabCity: string;
}

export interface ReportFilters {
  province?: string;
  city?: string;
  reportType?: string;
  dateFrom?: string; // YYYY-MM-DD, inclusive
  dateTo?: string;   // YYYY-MM-DD, inclusive
  sortOrder?: ReportSortOrder;
}

const EMPTY_REPORT_FILTERS: ReportFilters = {};

interface UseAllReportsReturn {
  reports: AllReportItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Fetches inspection + survey reports across ALL establishments (unlike
// useEstablishmentReports, which is scoped to one). Filters by search text
// (establishment name, report title, or control number), draft/submitted
// status, and optional region/report-type/date-range filters. Survey
// reports have no backend-synced status yet, so they default to 'draft' —
// see AllReportItem/EstablishmentReportItem.
export function useAllReports(
  search = '',
  statusFilter: ReportStatusFilter = 'all',
  filters: ReportFilters = EMPTY_REPORT_FILTERS,
): UseAllReportsReturn {
  const [reports, setReports] = useState<AllReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { myUid, myProvince, myRole, ready } = useJurisdiction();

  const requestId = useRef(0);

  // Same rationale as useEstablishments — only gate the full-screen
  // spinner on the very first load, so search/filter changes don't
  // unmount (and defocus) the search TextInput on every keystroke.
  const hasLoadedOnce = useRef(false);

  const fetchAllReports = useCallback(async (
    searchTerm: string,
    status: ReportStatusFilter,
    f: ReportFilters,
  ) => {
    const id = ++requestId.current;
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      setError(null);

      if (!ready) {
        if (id === requestId.current) setReports([]);
        return;
      }

      const [establishments, allInspectionReports, allSurveyReports] = await Promise.all([
        database.collections.get<Establishment>('establishments').query().fetch(),
        database.collections.get<InspectionReport>('inspection_reports').query().fetch(),
        database.collections.get<SurveyReport>('survey_reports').query().fetch(),
      ]);

      const estabNameById = new Map(establishments.map(e => [e.estabId, e.name]));
      const estabProvinceById = new Map(establishments.map(e => [e.estabId, e.province]));
      const estabCityById = new Map(establishments.map(e => [e.estabId, e.city]));

      // Jurisdiction baseline, mirroring "inspectors can read jurisdiction
      // inspection reports" RLS: visible if the establishment itself is
      // (same province or own), OR the report is one this inspector wrote
      // themselves regardless of where the establishment sits.
      const visibleEstabIds = new Set(
        establishments.filter(e => isEstablishmentVisible(e, myProvince, myUid, myRole)).map(e => e.estabId),
      );
      const inspectionReports = allInspectionReports.filter(
        r =>
          !r.deletedAt &&
          r.syncState !== 'pending_delete' &&
          (visibleEstabIds.has(r.estabId) || r.inspectorUid === myUid),
      );
      const surveyReports = allSurveyReports.filter(
        r => visibleEstabIds.has(r.estabId) || r.inspectorUid === myUid,
      );

      const attachmentSyncStatesByReport = await fetchAttachmentSyncStatesByReport(
        inspectionReports.map(r => r.reportId),
        surveyReports.map(r => r.surveyId),
      );

      const items: AllReportItem[] = [
        ...inspectionReports.map(r => ({
          key: `inspection-${r.reportId}`,
          kind: 'inspection' as const,
          reportId: r.reportId,
          inspectorUid: r.inspectorUid,
          estabId: r.estabId,
          estabName: estabNameById.get(r.estabId) ?? 'Unknown establishment',
          estabProvince: estabProvinceById.get(r.estabId) ?? '',
          estabCity: estabCityById.get(r.estabId) ?? '',
          reportType: r.reportType,
          title: INSPECTION_TYPE_LABELS[r.reportType] ?? r.reportType,
          date: r.inspectionDate,
          controlNo: r.reportControlNo,
          status: r.reportStatus,
          syncStatus: reportSyncStatusWithAttachments(r.syncState, attachmentSyncStatesByReport.get(r.reportId) ?? []),
          purposeId: r.purposeId,
        })),
        ...surveyReports.map(r => ({
          key: `survey-${r.surveyId}`,
          kind: 'survey' as const,
          reportId: r.surveyId,
          inspectorUid: r.inspectorUid,
          estabId: r.estabId,
          estabName: estabNameById.get(r.estabId) ?? 'Unknown establishment',
          estabProvince: estabProvinceById.get(r.estabId) ?? '',
          estabCity: estabCityById.get(r.estabId) ?? '',
          reportType: 'survey',
          title: r.projectName || 'Survey Report',
          date: r.inspectionDate,
          controlNo: r.reportControlNumber,
          status: r.reportStatus ?? 'draft',
          syncStatus: reportSyncStatusWithAttachments(r.syncState, attachmentSyncStatesByReport.get(r.surveyId) ?? []),
        })),
      ];

      const q = searchTerm.trim().toLowerCase();
      const filtered = items.filter(item => {
        const matchesStatus = status === 'all' || item.status === status;
        // Name-only — matching on report title/control-no too used to pull
        // in unrelated reports that merely shared a word with the search
        // term, which read as inaccurate results.
        const matchesSearch = !q || item.estabName.toLowerCase().includes(q);
        const matchesProvince = !f.province || item.estabProvince === f.province;
        const matchesCity = !f.city || item.estabCity === f.city;
        const matchesReportType = !f.reportType || item.reportType === f.reportType;
        const matchesDateFrom = !f.dateFrom || item.date >= f.dateFrom;
        const matchesDateTo = !f.dateTo || item.date <= f.dateTo;
        return (
          matchesStatus &&
          matchesSearch &&
          matchesProvince &&
          matchesCity &&
          matchesReportType &&
          matchesDateFrom &&
          matchesDateTo
        );
      });

      const sortDir = f.sortOrder === 'oldest' ? 1 : -1;
      filtered.sort((a, b) => (a.date < b.date ? -sortDir : a.date > b.date ? sortDir : 0));

      if (id === requestId.current) {
        setReports(filtered);
      }
    } catch (err) {
      if (id === requestId.current) {
        const message = err instanceof Error ? err.message : 'Failed to load reports.';
        setError(message);
        console.error('[useAllReports]', err);
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, [ready, myProvince, myUid, myRole]);

  useEffect(() => {
    fetchAllReports(search, statusFilter, filters);
  }, [search, statusFilter, filters, fetchAllReports]);

  const refetch = useCallback(
    () => fetchAllReports(search, statusFilter, filters),
    [fetchAllReports, search, statusFilter, filters],
  );

  return { reports, loading, error, refetch };
}
