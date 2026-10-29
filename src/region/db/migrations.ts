import { schemaMigrations, addColumns, createTable, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

// v5 -> v6: compliance_air/water/hazwaste/eia never had a syncState column,
// so edits to those tables couldn't be flagged for push sync. See
// src/services/sync/syncSchema.ts for the entities these correspond to.
//
// v6 -> v7: establishments gains lastSyncedSnapshot, a JSON snapshot of its
// content fields as of the last successful sync — see schema.ts's column
// comment and establishmentPersistence.ts's resolveEstablishmentContentEdit.
// Existing rows get NULL here (no known baseline yet); the dirty-check falls
// back to comparing against the live record until the next successful sync
// populates it.
//
// v7 -> v8: establishments, purpose_of_inspection, and inspection_reports
// rows created before the Supabase push/pull pipeline (see a4cba93) were
// stamped with the old generic syncState = 'pending'. getPendingRecords in
// src/db/sync/watermelonAdapter.ts only selects 'pending_create' /
// 'pending_update' / 'pending_delete', so those legacy rows were silently
// excluded from every push. Backfill them to 'pending_create' — correct
// here since a never-synced row has nothing to update on the server yet —
// so they're picked up on the next sync. compliance_* and survey_reports
// never used the old 'pending' literal (their syncState support was added
// together with the new convention), so they don't need backfilling.
//
// This also catches establishments stuck in a *false* 'synced' state: an
// early build of markLocalChangesAsSynced (before it started stamping
// lastSyncedSnapshot — see the v6->v7 migration above) flipped a row to
// 'synced' the moment push_changes returned {"status":"ok"}, without
// confirming that specific row actually landed server-side (e.g. it was
// silently dropped by `on conflict (estab_id) do nothing` or an RLS
// mismatch). Since every genuine successful sync now always sets
// lastSyncedSnapshot alongside 'synced', a 'synced' establishment with no
// snapshot is unreachable via current code and is a reliable signature of
// that earlier bug — reset it to 'pending_create' too.
//
// v8 -> v9: establishments gains operatingStatusSince — the date (kept as
// free text; see flexibleDate.ts) an establishment became closed/non-
// operational, shown in place of the operating hours/days fields once
// operatingStatus isn't 'Operational'.
//
// v9 -> v10: adds the attachments table (photo attachments on inspection
// reports — see schema.ts's column comment for the full shape). First
// createTable step in this codebase's migration history; every prior step
// only added columns to existing tables.
//
// v10 -> v11: attachments gains an optional inspector-entered caption.
//
// v11 -> v12: compliance_water gains nonWwtpTreatment - what an
// establishment without a WWTP actually treats its wastewater with (septic
// tank, oil/water separator, or free text), asked in section 5A once
// "Has WWTP?" is answered no. Existing rows get NULL, which the model's
// asObject decoder reads as {} - correct, since no inspection before this
// was ever asked the question.
//
// v12 -> v13: compliance_water gains wwtpTypeOther - what "Others" means
// when that's the answer to "Type of WWTP" (section 5B). Existing rows get
// NULL - correct, since no inspection before this was ever asked.
//
// v13 -> v14: compliance_water gains section 5E's remaining questions -
// what "Others" means for the WWTP's condition, and questions 3-6 about a
// WWTP under construction or rehabilitation (reported to EMB/LLDA, which
// units, estimated completion, treatment units in use meanwhile). Existing
// rows get NULL - correct, since no inspection before this was ever asked.
//
// v14 -> v15: compliance_water gains section 6I's gate - whether the
// inspector conducted water quality sampling, and if so its classification
// (ambient, effluent or both). Existing rows get NULL - correct, since no
// inspection before this was ever asked; their sampling points stand as
// they are.
//
// v15 -> v16: compliance_air gains checklistAppendixF and
// checklistConsentAgreement - the printed Air Monitoring form's fourth and
// fifth checklist groups (the CEMS quality-assurance questions and the two
// Consent Agreement ones), which the table lacked columns for. Existing
// rows get NULL, which the model's asArray reads as [] - correct, since no
// inspection before this was ever asked either group's questions.
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'compliance_air',
          columns: [{ name: 'syncState', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'compliance_water',
          columns: [{ name: 'syncState', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'compliance_hazwaste',
          columns: [{ name: 'syncState', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'compliance_eia',
          columns: [{ name: 'syncState', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'establishments',
          columns: [{ name: 'lastSyncedSnapshot', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        unsafeExecuteSql(
          `UPDATE establishments SET syncState = 'pending_create' WHERE syncState = 'pending' OR (syncState = 'synced' AND lastSyncedSnapshot IS NULL);`
        ),
        unsafeExecuteSql(
          `UPDATE purpose_of_inspection SET syncState = 'pending_create' WHERE syncState = 'pending';`
        ),
        unsafeExecuteSql(
          `UPDATE inspection_reports SET syncState = 'pending_create' WHERE syncState = 'pending';`
        ),
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'establishments',
          columns: [{ name: 'operatingStatusSince', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        createTable({
          name: 'attachments',
          columns: [
            { name: 'attachmentId',       type: 'string' },
            { name: 'inspectionReportId', type: 'string', isOptional: true },
            { name: 'surveyReportId',     type: 'string', isOptional: true },
            { name: 'inspectorUid',       type: 'string' },
            { name: 'storagePath',        type: 'string', isOptional: true },
            { name: 'fileName',           type: 'string' },
            { name: 'mimeType',           type: 'string' },
            { name: 'fileSize',           type: 'number' },
            { name: 'geoLat',             type: 'number', isOptional: true },
            { name: 'geoLng',             type: 'number', isOptional: true },
            { name: 'capturedAt',         type: 'string' },
            { name: 'deviceId',           type: 'string' },
            { name: 'createdAt',          type: 'string' },
            { name: 'updatedAt',          type: 'string' },
            { name: 'updated_at',         type: 'number' },
            { name: 'deletedAt',          type: 'string', isOptional: true },
            { name: 'syncState',          type: 'string' },
            { name: 'localUri',           type: 'string', isOptional: true },
            { name: 'uploadStatus',       type: 'string' },
            { name: 'uploadError',        type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'attachments',
          columns: [{ name: 'caption', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'compliance_water',
          columns: [{ name: 'nonWwtpTreatment', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 13,
      steps: [
        addColumns({
          table: 'compliance_water',
          columns: [{ name: 'wwtpTypeOther', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 14,
      steps: [
        addColumns({
          table: 'compliance_water',
          columns: [
            { name: 'wwtpConditionOther', type: 'string', isOptional: true },
            { name: 'wwtpConstructionReported', type: 'boolean', isOptional: true },
            { name: 'wwtpConstructionUnits', type: 'string', isOptional: true },
            { name: 'wwtpConstructionCompletionDate', type: 'string', isOptional: true },
            { name: 'wwtpTreatmentUnitsUtilized', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: 'compliance_water',
          columns: [
            { name: 'samplingConducted', type: 'boolean', isOptional: true },
            { name: 'samplingClassification', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'compliance_air',
          columns: [
            { name: 'checklistAppendixF', type: 'string', isOptional: true },
            { name: 'checklistConsentAgreement', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
