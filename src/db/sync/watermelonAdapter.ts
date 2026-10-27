import { Q, Model, Collection } from '@nozbe/watermelondb';
import { database } from '../database';
import { syncSchema, SyncEntityName } from '../../services/sync/syncSchema';
import { LocalSyncRecord } from '../../services/sync/syncMappers';
import { PushChangesPayload } from '../../services/sync/syncTypes';
import { LocalPendingRecords, LocalPushSourceAdapter } from './collectPushChanges';
import { LocalEntitySyncAdapter } from './applyPulledChanges';
import { buildEstablishmentSnapshotJson } from '../../features/inspections/establishmentPersistence';
import { notifySyncDataChanged } from '../../services/sync/syncEvents';

const PENDING_SYNC_STATES = ['pending_create', 'pending_update', 'pending_delete'];

// Every sync entity name is its WatermelonDB table name (see syncSchema.ts).
function collectionFor(entity: SyncEntityName): Collection<Model> {
  return database.collections.get<Model>(entity);
}

async function findById(entity: SyncEntityName, id: string): Promise<Model | null> {
  try {
    return await collectionFor(entity).find(id);
  } catch {
    return null;
  }
}

function toLocalRecord(model: Model, localFieldNames: string[]): LocalSyncRecord {
  const record: LocalSyncRecord = {};
  const source = model as unknown as Record<string, unknown>;

  for (const fieldName of localFieldNames) {
    record[fieldName] = source[fieldName];
  }

  return record;
}

// ── Push source (local -> collectPushChanges) ─────────────────────────────

async function getPendingRecords(entity: SyncEntityName): Promise<LocalPendingRecords> {
  const entitySchema = syncSchema[entity];
  const localFieldNames = Object.values(entitySchema.fields);

  const records = await collectionFor(entity)
    .query(Q.where('syncState', Q.oneOf(PENDING_SYNC_STATES)))
    .fetch();

  const created: LocalSyncRecord[] = [];
  const updated: LocalSyncRecord[] = [];
  const deleted: string[] = [];

  for (const record of records) {
    const syncState = (record as unknown as { syncState: string }).syncState;

    if (syncState === 'pending_delete') {
      deleted.push(record.id);
      continue;
    }

    // An attachment's binary file uploads to Supabase Storage on its own
    // pipeline (attachmentUploadQueue.ts), separate from this metadata push.
    // Pushing before the upload finishes would send storage_path: null,
    // which the server would then need a follow-up update to reconcile —
    // simpler to just hold the row back until the file has actually landed.
    if (entity === 'attachments') {
      const uploadStatus = (record as unknown as { uploadStatus: string }).uploadStatus;
      if (uploadStatus !== 'uploaded') continue;
    }

    const plain = toLocalRecord(record, localFieldNames);

    if (syncState === 'pending_create') {
      created.push(plain);
    } else {
      updated.push(plain);
    }
  }

  return { created, updated, deleted };
}

// See collectPushChanges.ts's repairMissingParents for why this exists — a
// plain lookup, deliberately not filtered by syncState.
async function findLocalRecord(entity: SyncEntityName, id: string): Promise<LocalSyncRecord | null> {
  const record = await findById(entity, id);
  if (!record) return null;

  const localFieldNames = Object.values(syncSchema[entity].fields);
  return toLocalRecord(record, localFieldNames);
}

export const watermelonPushSource: LocalPushSourceAdapter = {
  getPendingRecords,
  findLocalRecord,
};

// ── Entity adapter (pull -> applyPulledChanges) ────────────────────────────

async function upsertMany(entity: SyncEntityName, records: LocalSyncRecord[]): Promise<void> {
  const entitySchema = syncSchema[entity];
  const localPk = entitySchema.localPrimaryKey;
  const collection = collectionFor(entity);

  await database.write(async () => {
    for (const record of records) {
      const id = String(record[localPk]);
      const existing = await findById(entity, id);

      if (existing) {
        // A row still pending_create/pending_update has a local edit that
        // hasn't been confirmed applied server-side yet (either not pushed
        // this cycle, or pushed and rejected by push_changes's last-write-
        // wins guard). 'conflict' is that same rejection, already flagged
        // for the user (see markLocalChangesAsSynced) — until they
        // explicitly resolve it (resolveConflictKeepLocal), it must survive
        // pulls the same way. Overwriting any of these with whatever pull
        // just returned would silently destroy the local edit; leaving it
        // untouched keeps it queued/flagged instead. Only a row already
        // confirmed 'synced' (or not present locally at all — see the
        // create branch below) is safe to apply incoming pulled data to.
        const currentSyncState = (existing as unknown as { syncState: string }).syncState;
        if (
          currentSyncState === 'pending_create' ||
          currentSyncState === 'pending_update' ||
          currentSyncState === 'conflict'
        ) {
          continue;
        }

        await existing.update((r: unknown) => {
          const target = r as Record<string, unknown>;
          for (const [key, value] of Object.entries(record)) {
            if (key === localPk) continue;
            target[key] = value;
          }
          // Data pulled from the server is synced by definition, regardless
          // of what sync_status it happened to carry.
          target.syncState = 'synced';
          // Re-baseline the last-synced snapshot to what the server just
          // sent — see establishmentPersistence.ts's
          // resolveEstablishmentContentEdit, which diffs future local edits
          // against this instead of just the immediately-prior local value.
          if (entity === 'establishments') {
            target.lastSyncedSnapshot = buildEstablishmentSnapshotJson(target);
          }
        });
      } else {
        await collection.create((r: unknown) => {
          const target = r as Record<string, unknown> & { _raw: { id: string } };
          target._raw.id = id;
          for (const [key, value] of Object.entries(record)) {
            target[key] = value;
          }
          target.syncState = 'synced';
          if (entity === 'establishments') {
            target.lastSyncedSnapshot = buildEstablishmentSnapshotJson(target);
          }
        });
      }
    }
  });
}

async function deleteMany(entity: SyncEntityName, ids: string[]): Promise<void> {
  await database.write(async () => {
    for (const id of ids) {
      const existing = await findById(entity, id);
      if (existing) {
        await existing.destroyPermanently();
      }
    }
  });
}

async function softDeleteMany(
  entity: SyncEntityName,
  ids: string[],
  options: { deletedAtField?: string; updatedAtField?: string; now?: string } = {}
): Promise<void> {
  const entitySchema = syncSchema[entity];
  const now = options.now ?? new Date().toISOString();
  const localDeletedAtField = options.deletedAtField
    ? entitySchema.fields[options.deletedAtField]
    : undefined;
  const localUpdatedAtField = options.updatedAtField
    ? entitySchema.fields[options.updatedAtField]
    : undefined;

  await database.write(async () => {
    for (const id of ids) {
      const existing = await findById(entity, id);
      if (!existing) continue;

      await existing.update((r: unknown) => {
        const target = r as Record<string, unknown>;
        if (localDeletedAtField) target[localDeletedAtField] = now;
        if (localUpdatedAtField) target[localUpdatedAtField] = now;
        target.syncState = 'synced';
      });
    }
  });
}

export const watermelonEntityAdapter: LocalEntitySyncAdapter = {
  upsertMany,
  deleteMany,
  softDeleteMany,
};

// ── User-switch reset ───────────────────────────────────────────────────────

// Deletes only rows already confirmed synced to the server (syncState ===
// 'synced', set explicitly by upsertMany/softDeleteMany/markLocalChangesAsSynced
// above) across every table. Rows in any other state — pending_create,
// pending_update, pending_delete, or never explicitly marked (local-only
// drafts) — are left untouched. Used by ensureSyncScopedToUser in
// syncOrchestrator.ts to force a correctly-scoped full re-pull on a detected
// user switch without destroying not-yet-synced local work.
export async function clearSyncedRecords(): Promise<void> {
  const entities = Object.keys(syncSchema) as SyncEntityName[];

  await database.write(async () => {
    for (const entity of entities) {
      const records = await collectionFor(entity)
        .query(Q.where('syncState', 'synced'))
        .fetch();

      await Promise.all(records.map(record => record.destroyPermanently()));
    }
  });
}

// How much unsynced work this device is holding, across every table. The
// confirmation before "Reset and re-download" quotes it so the inspector
// knows what the push step is about to carry - and what would be at stake
// if it couldn't.
export async function countPendingRecords(): Promise<number> {
  const entities = Object.keys(syncSchema) as SyncEntityName[];
  const counts = await Promise.all(
    entities.map(entity =>
      collectionFor(entity).query(Q.where('syncState', Q.oneOf(PENDING_SYNC_STATES))).fetchCount(),
    ),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

// ── Post-push bookkeeping ───────────────────────────────────────────────────

// Flips the local records that were just successfully pushed back to
// 'synced', using the primary key values already present on the pushed DTOs
// (the WatermelonDB row id always matches the entity's own primary key —
// see rec._raw.id assignments at record-creation sites).
//
// conflicts (from PushChangesResponse) names the ids push_changes actually
// rejected via its last-write-wins guard, despite the RPC call as a whole
// returning {status:'ok'}. Those get flagged 'conflict' instead of 'synced'
// — a distinct state the UI already has a badge for (EstablishmentCard,
// EstablishmentHeaderCard, ReportListCard, InspectionReportHeader all check
// syncStatus === 'conflict'; toDisplaySyncStatus already mapped it, this is
// what was missing to ever actually produce it). Marking a rejected row
// 'synced' anyway is what let the pull that follows in the same sync run
// silently overwrite it (see upsertMany's pending-state guard, which now
// also protects 'conflict'); flagging it instead keeps the edit queued and
// visible until the user resolves it via resolveConflictKeepLocal.
export async function markLocalChangesAsSynced(
  payload: PushChangesPayload,
  conflicts?: Partial<Record<SyncEntityName, string[]>>
): Promise<void> {
  await database.write(async () => {
    for (const entity of Object.keys(payload) as SyncEntityName[]) {
      const entityChanges = (payload as Record<string, { created: object[]; updated: object[] } | undefined>)[entity];
      if (!entityChanges) continue;

      const primaryKey = syncSchema[entity].primaryKey;
      const conflictedIds = new Set(conflicts?.[entity] ?? []);
      const ids = [...entityChanges.created, ...entityChanges.updated].map(dto =>
        String((dto as Record<string, unknown>)[primaryKey])
      );

      for (const id of ids) {
        const existing = await findById(entity, id);
        if (!existing) continue;

        const isConflicted = conflictedIds.has(id);

        await existing.update((r: unknown) => {
          const target = r as Record<string, unknown>;
          if (isConflicted) {
            target.syncState = 'conflict';
            return;
          }
          target.syncState = 'synced';
          // Re-baseline the last-synced snapshot to what was just pushed —
          // see resolveEstablishmentContentEdit.
          if (entity === 'establishments') {
            target.lastSyncedSnapshot = buildEstablishmentSnapshotJson(target);
          }
        });
      }
    }
  });
}

// User-initiated resolution for a row flagged 'conflict': keep the local
// version and force it to win the next push by re-stamping updatedAt to
// now (the last-write-wins guard only ever compares timestamps — this is
// what makes the retry legitimately newer instead of losing the same race
// again). "Local changes only" by design: this never fetches or looks at
// the other device's version, it just re-queues what's already here.
// Entities without an updatedAtField (the compliance_* tables) can't
// conflict in the first place — push_changes has no timestamp guard for
// them — so this is only ever called for establishments/inspection_reports
// today, the two entities the conflict badge is wired up for.
export async function resolveConflictKeepLocal(entity: SyncEntityName, id: string): Promise<void> {
  const entitySchema = syncSchema[entity];
  const localUpdatedAtField = entitySchema.updatedAtField
    ? entitySchema.fields[entitySchema.updatedAtField]
    : undefined;

  await database.write(async () => {
    const existing = await findById(entity, id);
    if (!existing) return;

    await existing.update((r: unknown) => {
      const target = r as Record<string, unknown>;
      target.syncState = 'pending_update';
      if (localUpdatedAtField) {
        target[localUpdatedAtField] = new Date().toISOString();
      }
    });
  });

  notifySyncDataChanged();
}
