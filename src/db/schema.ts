import { appSchema, tableSchema } from '@nozbe/watermelondb';
import { regionDb } from '../region/db';

// ── Local SQLite schema for WatermelonDB ──────────────────────────────────────
// Column names use camelCase (local convention) matching syncSchema.ts field maps.
// JSON/array fields (snapshot, compliance checklists, etc.) are stored as strings
// and parsed/serialized at the model layer.
//
// IMPORTANT: We use 'syncState' (not 'syncStatus') for the local sync field
// because WatermelonDB's Model base class already has an internal 'syncStatus'
// property. Using the same name causes a TypeScript type collision. The backend
// column remains 'sync_status' — only the local camelCase name changes.
//
// IMPORTANT: any table whose model declares an `updatedAt` field also needs a
// reserved `updated_at` (snake_case, number, non-optional) column below. On
// every `.update()` call, WatermelonDB's Model.prepareUpdate() unconditionally
// touches a raw column *hardcoded* as 'updated_at' whenever the model has an
// `updatedAt` property — it does not derive that raw name from our own
// `updatedAt` (camelCase, ISO-string) column. Without a matching 'updated_at'
// entry in this schema, that lookup returns undefined and WatermelonDB throws
// "Cannot read property 'type' of undefined" from RawRecord's _setRaw. This
// reserved column is never read or written by app code (or by any @field on
// the model) — it exists purely so that internal auto-touch has somewhere
// harmless to write. Our real, app-facing timestamp stays the existing
// `updatedAt` (string) column, set explicitly wherever a record is saved.
// ─────────────────────────────────────────────────────────────────────────────

// Foundation tables. Region tables (compliance_* in EMB4B) come from
// src/region/db/tables.ts; the version is region-owned (src/region/db).
const foundationTables = [
  // ── ESTABLISHMENTS ───────────────────────────────────────────────────────
  tableSchema({
    name: 'establishments',
    columns: [
      { name: 'estabId',                    type: 'string' },
      { name: 'inspectorUid',               type: 'string' },
      { name: 'name',                        type: 'string' },
      { name: 'formerName',                  type: 'string', isOptional: true },
      { name: 'addressLine',                 type: 'string' },
      { name: 'barangay',                    type: 'string' },
      { name: 'city',                        type: 'string' },
      { name: 'province',                    type: 'string' },
      { name: 'geoLat',                      type: 'number', isOptional: true },
      { name: 'geoLng',                      type: 'number', isOptional: true },
      { name: 'natureOfBusiness',            type: 'string' },
      { name: 'psicCode',                    type: 'string', isOptional: true },
      { name: 'product',                     type: 'string', isOptional: true },
      { name: 'yearEstablished',             type: 'number', isOptional: true },
      { name: 'operatingStatus',             type: 'string' },
      { name: 'operatingHoursDay',           type: 'number', isOptional: true },
      { name: 'operatingDaysWeek',           type: 'number', isOptional: true },
      { name: 'operatingDaysYear',           type: 'number', isOptional: true },
      // Only meaningful when operatingStatus isn't 'Operational' — the
      // date (mm-dd-yyyy / mm-yyyy / yyyy, kept as free text) the
      // establishment became closed/non-operational. See flexibleDate.ts.
      { name: 'operatingStatusSince',        type: 'string', isOptional: true },
      { name: 'productLines',                type: 'string', isOptional: true },
      { name: 'ownerName',                   type: 'string' },
      { name: 'managingHeadName',            type: 'string' },
      { name: 'pcoName',                     type: 'string', isOptional: true },
      { name: 'pcoAccreditationNo',          type: 'string', isOptional: true },
      { name: 'pcoEffectivity',              type: 'string', isOptional: true },
      { name: 'phoneFax',                    type: 'string' },
      { name: 'email',                       type: 'string' },
      { name: 'contactPersonName',           type: 'string' },
      { name: 'contactPersonPosition',       type: 'string' },
      { name: 'denrPermits',                 type: 'string', isOptional: true },
      { name: 'deviceId',                    type: 'string' },
      { name: 'createdAt',                   type: 'string' },
      { name: 'updatedAt',                   type: 'string' },
      { name: 'updated_at',                  type: 'number' }, // reserved — see note above, not used by app code
      { name: 'syncState',                   type: 'string' }, // ← not syncStatus
      { name: 'isArchived',                  type: 'boolean' },
      // JSON snapshot of the content fields as of the last successful sync
      // (push or pull) — see establishmentPersistence.ts's
      // resolveEstablishmentContentEdit. Lets a later edit be compared
      // against the true last-synced baseline instead of just the
      // immediately-prior local value, so reverting a field back to what's
      // already on the server clears the pending-sync flag instead of
      // leaving it stuck dirty.
      { name: 'lastSyncedSnapshot',          type: 'string', isOptional: true },
    ],
  }),

  // ── PURPOSE_OF_INSPECTION ────────────────────────────────────────────────
  // Independent per-visit entity — created before any inspection_reports
  // row exists; a single purpose can be shared by several reports from
  // the same visit (one per report type).
  tableSchema({
    name: 'purpose_of_inspection',
    columns: [
      { name: 'purposeId',              type: 'string' },
      { name: 'estabId',                type: 'string' },
      { name: 'inspectorUid',           type: 'string' },
      { name: 'inspectionDate',         type: 'string' },
      { name: 'verifyInfo',             type: 'boolean' },
      { name: 'verifyInfoList',         type: 'string', isOptional: true },
      { name: 'determineCompliance',    type: 'boolean' },
      { name: 'investigateComplaints',  type: 'boolean' },
      { name: 'checkCommitments',       type: 'boolean' },
      { name: 'checkCommitmentsList',   type: 'string', isOptional: true },
      { name: 'others',                 type: 'string', isOptional: true },
      { name: 'deviceId',               type: 'string' },
      { name: 'createdAt',              type: 'string' },
      { name: 'updatedAt',              type: 'string' },
      { name: 'updated_at',             type: 'number' }, // reserved — see note above, not used by app code
      { name: 'syncState',              type: 'string' }, // ← not syncStatus
    ],
  }),

  // ── INSPECTION_REPORTS ───────────────────────────────────────────────────
  tableSchema({
    name: 'inspection_reports',
    columns: [
      { name: 'reportId',               type: 'string' },
      { name: 'estabId',                type: 'string' },
      { name: 'inspectorUid',           type: 'string' },
      { name: 'purposeId',              type: 'string' },
      { name: 'reportType',             type: 'string' },
      { name: 'reportControlNo',        type: 'string', isOptional: true },
      { name: 'inspectionDate',         type: 'string' },
      { name: 'establishmentSnapshot',  type: 'string' },
      { name: 'permitsSnapshot',        type: 'string' },
      { name: 'isArchived',             type: 'boolean' },
      { name: 'deviceId',               type: 'string' },
      { name: 'createdAt',              type: 'string' },
      { name: 'updatedAt',              type: 'string' },
      { name: 'updated_at',             type: 'number' }, // reserved — see note above, not used by app code
      { name: 'deletedAt',              type: 'string', isOptional: true },
      { name: 'syncState',              type: 'string' }, // ← not syncStatus
      { name: 'reportStatus',           type: 'string' }, // 'draft' | 'submitted'
    ],
  }),

  // ── SURVEY_REPORTS ───────────────────────────────────────────────────────
  tableSchema({
    name: 'survey_reports',
    columns: [
      { name: 'surveyId',                  type: 'string' },
      { name: 'estabId',                   type: 'string' },
      { name: 'inspectorUid',              type: 'string' },
      { name: 'reportControlNumber',       type: 'string', isOptional: true },
      { name: 'inspectionDate',            type: 'string' },
      { name: 'projectName',               type: 'string' },
      { name: 'referenceCode',             type: 'string', isOptional: true },
      { name: 'proponentName',             type: 'string' },
      { name: 'contactPerson',             type: 'string', isOptional: true },
      { name: 'contactPosition',           type: 'string', isOptional: true },
      { name: 'contactNumber',             type: 'string', isOptional: true },
      { name: 'email',                     type: 'string', isOptional: true },
      { name: 'projectLocation',           type: 'string' },
      { name: 'geoLat',                    type: 'number', isOptional: true },
      { name: 'geoLng',                    type: 'number', isOptional: true },
      { name: 'areaSize',                  type: 'number', isOptional: true },
      { name: 'purpose',                   type: 'string' },
      { name: 'documentType',              type: 'string', isOptional: true },
      { name: 'projectStatus',             type: 'string', isOptional: true },
      { name: 'physicalParameters',        type: 'string', isOptional: true },
      { name: 'biologicalParameters',      type: 'string', isOptional: true },
      { name: 'socioeconomicParameters',   type: 'string', isOptional: true },
      { name: 'otherFindings',             type: 'string', isOptional: true },
      { name: 'remarksRecommendations',    type: 'string', isOptional: true },
      { name: 'createdAt',                 type: 'string' },
      { name: 'updatedAt',                 type: 'string' },
      { name: 'updated_at',                type: 'number' }, // reserved — see note above, not used by app code
      { name: 'deletedAt',                 type: 'string', isOptional: true },
      { name: 'isArchived',                type: 'boolean' },
      { name: 'syncState',                 type: 'string' }, // ← not syncStatus
      { name: 'deviceId',                  type: 'string' },
      // Mobile-only for now — no matching Supabase column yet, see
      // useAllReports/useEstablishmentReports for the ?? 'draft' default.
      { name: 'reportStatus',              type: 'string', isOptional: true }, // 'draft' | 'submitted'
    ],
  }),

  // ── ATTACHMENTS ──────────────────────────────────────────────────────────
  // References exactly one of inspectionReportId / surveyReportId — enforced
  // app-side in attachmentPersistence.ts (WatermelonDB has no CHECK-constraint
  // support locally; the backend enforces it via a real CHECK constraint, see
  // the create_attachments_table migration). Only inspection reports are
  // wired up in the UI for now — surveyReportId exists so survey report
  // support is a pure UI follow-up later, not a schema/sync change.
  //
  // localUri / uploadStatus / uploadError are local-only: deliberately
  // excluded from syncSchema.ts's `attachments.fields` map so they never
  // reach the push payload. The binary file itself never syncs through
  // pull_changes/push_changes — see attachmentUploadQueue.ts, which uploads
  // directly to Supabase Storage and stores the resulting path in
  // storagePath (which IS synced).
  tableSchema({
    name: 'attachments',
    columns: [
      { name: 'attachmentId',      type: 'string' },
      { name: 'inspectionReportId', type: 'string', isOptional: true },
      { name: 'surveyReportId',    type: 'string', isOptional: true },
      { name: 'inspectorUid',      type: 'string' },
      { name: 'storagePath',       type: 'string', isOptional: true },
      { name: 'fileName',          type: 'string' },
      { name: 'mimeType',          type: 'string' },
      { name: 'fileSize',          type: 'number' },
      { name: 'geoLat',            type: 'number', isOptional: true },
      { name: 'geoLng',            type: 'number', isOptional: true },
      { name: 'capturedAt',        type: 'string' },
      { name: 'caption',           type: 'string', isOptional: true },
      { name: 'deviceId',          type: 'string' },
      { name: 'createdAt',         type: 'string' },
      { name: 'updatedAt',         type: 'string' },
      { name: 'updated_at',        type: 'number' }, // reserved — see note above, not used by app code
      { name: 'deletedAt',         type: 'string', isOptional: true },
      { name: 'syncState',         type: 'string' }, // ← not syncStatus
      // Local-only — never synced, see column comment above.
      { name: 'localUri',          type: 'string', isOptional: true },
      { name: 'uploadStatus',      type: 'string' }, // 'pending' | 'uploading' | 'uploaded' | 'failed'
      { name: 'uploadError',       type: 'string', isOptional: true },
    ],
  }),
];

export const schema = appSchema({
  version: regionDb.schemaVersion,
  tables: [...foundationTables, ...regionDb.tables],
});
