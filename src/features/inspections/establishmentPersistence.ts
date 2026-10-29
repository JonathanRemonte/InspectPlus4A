import { database, collections } from '../../db/database';
import { GeneralInfoFormState } from './types';
import { notifySyncDataChanged } from '../../services/sync/syncEvents';

// Preserves a still-unsynced establishment's 'pending_create' status across
// local edits. push_changes' "updated establishments" handler only ever runs
// an UPDATE (never an INSERT) — so if a local edit downgrades a row to
// 'pending_update' before its original create has ever reached the server,
// that UPDATE matches nothing, silently drops the row from every future
// push, and permanently orphans anything that references it (purpose_of_
// inspection, inspection_reports, ...) behind a foreign key violation.
export function nextEstablishmentSyncState(current: string): 'pending_create' | 'pending_update' {
  return current === 'pending_create' ? 'pending_create' : 'pending_update';
}

// Array/object fields (productLines, denrPermits) can't be compared with
// === — a freshly mapped array is never reference-equal to the one already
// stored even when its contents match, so this falls back to a structural
// comparison for anything non-primitive.
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// Every establishment "content" field either write path (quick-create/report
// save, or one of the establishment detail screen's editable sections) can
// touch — the union of createEstablishmentRecord's and every section's field
// set. Used both to build the last-synced snapshot (see watermelonAdapter.ts)
// and to diff a proposed edit against it below.
export const ESTABLISHMENT_CONTENT_FIELDS = [
  'name', 'formerName', 'addressLine', 'barangay', 'city', 'province',
  'geoLat', 'geoLng', 'natureOfBusiness', 'psicCode', 'product', 'yearEstablished',
  'operatingStatus', 'operatingHoursDay', 'operatingDaysWeek', 'operatingDaysYear',
  'operatingStatusSince',
  'productLines', 'ownerName', 'managingHeadName', 'pcoName', 'pcoAccreditationNo',
  'pcoEffectivity', 'phoneFax', 'email', 'contactPersonName', 'contactPersonPosition',
  'denrPermits',
] as const;

export type EstablishmentContentField = typeof ESTABLISHMENT_CONTENT_FIELDS[number];
type EstablishmentContentSnapshot = Partial<Record<EstablishmentContentField, unknown>>;

// Captures the establishment's content fields right after a successful sync
// (push or pull) — see watermelonAdapter.ts's markLocalChangesAsSynced and
// upsertMany, the only two call sites for this.
export function buildEstablishmentSnapshotJson(record: Record<string, unknown>): string {
  const snapshot: EstablishmentContentSnapshot = {};
  for (const field of ESTABLISHMENT_CONTENT_FIELDS) {
    snapshot[field] = record[field];
  }
  return JSON.stringify(snapshot);
}

interface ResolvedEstablishmentEdit {
  syncState: 'pending_create' | 'pending_update' | 'synced';
  // Whether the record actually needs writing — false means the proposed
  // values already match what's live, so the caller should skip the write
  // entirely rather than bump updatedAt/syncState for no reason.
  isDirty: boolean;
}

// Diffs a proposed partial edit (only the fields the caller manages — the
// Edit screen and the report-save path each touch a different subset) to
// decide what syncState it should leave behind:
//  - Still-unsynced (pending_create): stays pending_create regardless of the
//    diff — see nextEstablishmentSyncState's reasoning.
//  - Has a last-synced snapshot: the resulting record (live fields with this
//    edit's overrides applied) is compared against that snapshot, not just
//    whatever was live a moment ago — so saving a change and later saving it
//    back to the original value resolves to 'synced' again instead of
//    staying stuck 'pending_update' forever.
//  - No snapshot yet (row synced before this column existed): falls back to
//    comparing the edit against the live record, matching the old behavior.
export function resolveEstablishmentContentEdit(
  record: Record<string, unknown> & { syncState: string; lastSyncedSnapshot?: string | null },
  nextPartialFields: Partial<Record<EstablishmentContentField, unknown>>,
): ResolvedEstablishmentEdit {
  const editedKeys = Object.keys(nextPartialFields) as EstablishmentContentField[];
  const isDirtyVsLive = editedKeys.some(key => !valuesEqual(record[key], nextPartialFields[key]));

  if (!isDirtyVsLive) {
    // Nothing proposed actually differs from what's live right now — no
    // write needed, regardless of sync state or snapshot.
    return { syncState: record.syncState as 'pending_create' | 'pending_update' | 'synced', isDirty: false };
  }

  if (record.syncState === 'pending_create') {
    return { syncState: 'pending_create', isDirty: true };
  }

  if (!record.lastSyncedSnapshot) {
    return { syncState: 'pending_update', isDirty: true };
  }

  const snapshot = JSON.parse(record.lastSyncedSnapshot) as EstablishmentContentSnapshot;
  const matchesSnapshot = ESTABLISHMENT_CONTENT_FIELDS.every(key => {
    const nextValue = key in nextPartialFields ? nextPartialFields[key] : record[key];
    return valuesEqual(snapshot[key], nextValue);
  });

  return { syncState: matchesSnapshot ? 'synced' : 'pending_update', isDirty: true };
}

interface CreateEstablishmentArgs {
  estabId: string;
  inspectorUid: string;
  deviceId: string;
  generalInfo: GeneralInfoFormState;
}

// Shared by the quick-create modal (creates immediately, before any report
// exists) and useReportFormState's save path (creates as part of the report
// transaction) so both insert identically-shaped rows. Must be called inside
// a database.write — it doesn't open its own.
export async function createEstablishmentRecord({
  estabId,
  inspectorUid,
  deviceId,
  generalInfo,
}: CreateEstablishmentArgs): Promise<void> {
  const now = new Date().toISOString();
  const productLines = generalInfo.productLines
    .filter(p => p.product_line?.trim())
    .map(p => ({
      product_line: p.product_line ?? '',
      ecc_production_rate: p.ecc_production_rate ?? '',
      actual_production_rate: p.actual_production_rate ?? '',
    }));
  const permitsSnapshot = generalInfo.denrPermits.filter(p => p.permit_serial?.trim());

  await collections.establishments.create(rec => {
    rec._raw.id = estabId;
    rec.estabId = estabId;
    rec.inspectorUid = inspectorUid;
    rec.name = generalInfo.name;
    rec.formerName = generalInfo.includeFormerName ? generalInfo.formerName || null : null;
    rec.addressLine = generalInfo.addressLine;
    rec.barangay = generalInfo.barangay;
    rec.city = generalInfo.city;
    rec.province = generalInfo.province;
    rec.geoLat = generalInfo.geoLat ? Number(generalInfo.geoLat) : null;
    rec.geoLng = generalInfo.geoLng ? Number(generalInfo.geoLng) : null;
    rec.natureOfBusiness = generalInfo.natureOfBusiness;
    rec.psicCode = generalInfo.psicCode || null;
    rec.operatingStatus = generalInfo.operatingStatus;
    rec.operatingHoursDay = generalInfo.operatingHoursDay ? Number(generalInfo.operatingHoursDay) : null;
    rec.operatingDaysWeek = generalInfo.operatingDaysWeek ? Number(generalInfo.operatingDaysWeek) : null;
    rec.operatingDaysYear = generalInfo.operatingDaysYear ? Number(generalInfo.operatingDaysYear) : null;
    rec.operatingStatusSince = generalInfo.operatingStatusSince || null;
    rec.ownerName = generalInfo.ownerName;
    rec.managingHeadName = generalInfo.managingHeadName;
    rec.contactPersonName = generalInfo.contactPersonName;
    rec.contactPersonPosition = generalInfo.contactPersonPosition;
    rec.phoneFax = generalInfo.phoneFax;
    rec.email = generalInfo.email;
    rec.pcoName = generalInfo.pcoName || null;
    rec.pcoAccreditationNo = generalInfo.pcoAccreditationNo || null;
    rec.pcoEffectivity = generalInfo.pcoEffectivity || null;
    rec.productLines = productLines;
    rec.denrPermits = permitsSnapshot;
    rec.deviceId = deviceId;
    rec.createdAt = now;
    rec.updatedAt = now;
    rec.syncState = 'pending_create';
    rec.isArchived = false;
  });
}

interface PatchEstablishmentArgs {
  estabId: string;
  fields: Partial<Record<EstablishmentContentField, unknown>>;
}

// Used by every independently-editable FormSection on the establishment
// detail screen (see useEditableSection) — patches only the fields that
// section owns, so saving one section can never clobber an in-flight edit
// on another. denrPermits/isArchived/deviceId/inspectorUid/createdAt are
// never among `fields`; no section currently edits them. geoLat/geoLng
// arrive from the Details section as numbers (or null) — see
// EstablishmentInfoSections' fromDetailsFields.
// Opens its own database.write and notifies other screens the same way
// archiveEstablishmentRecord does, since this is always called standalone
// from a section's Save button rather than composed into a larger
// transaction.
export async function patchEstablishmentRecord({ estabId, fields }: PatchEstablishmentArgs): Promise<void> {
  const now = new Date().toISOString();
  let wasDirty = false;

  await database.write(async () => {
    const estabRecord = await collections.establishments.find(estabId);
    const resolved = resolveEstablishmentContentEdit(
      estabRecord as unknown as Record<string, unknown> & { syncState: string; lastSyncedSnapshot?: string | null },
      fields,
    );
    if (!resolved.isDirty) return;
    wasDirty = true;

    await estabRecord.update(rec => {
      Object.assign(rec, fields);
      rec.updatedAt = now;
      rec.syncState = resolved.syncState;
    });
  });

  if (wasDirty) notifySyncDataChanged();
}

// "Delete" for establishments means archive, not a hard delete: the remote
// establishments table has no soft-delete column and inspection_reports/
// survey_reports/purpose_of_inspection all reference it with `on delete
// restrict`, so a real delete would fail server-side for any establishment
// with report history. Archiving reuses the existing (till now unused)
// isArchived flag, which is already wired through the sync field map for
// both push and pull — see syncSchema.ts. Opens its own database.write,
// unlike create/update above, since it's always called standalone from a
// delete action rather than composed into a larger save transaction.
export async function archiveEstablishmentRecord(estabId: string): Promise<void> {
  const now = new Date().toISOString();
  await database.write(async () => {
    const estabRecord = await collections.establishments.find(estabId);
    await estabRecord.update(rec => {
      rec.isArchived = true;
      rec.updatedAt = now;
      rec.syncState = nextEstablishmentSyncState(rec.syncState);
    });
  });

  // The archiving screen already refetches its own list, but another
  // screen showing this establishment (e.g. its detail screen) wouldn't
  // otherwise know to refresh — see reportPersistence.ts's matching call
  // for report deletion.
  notifySyncDataChanged();
}
