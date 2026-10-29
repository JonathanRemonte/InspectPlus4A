import {
  syncSchema,
  SyncEntityName,
} from '../../services/sync/syncSchema';

import {
  mapLocalListToBackend,
  mapLocalToBackend,
  LocalSyncRecord,
} from '../../services/sync/syncMappers';

import { PushChangesPayload } from '../../services/sync/syncTypes';
import { regionParentDependencies } from '../../region/db';

export interface LocalPendingRecords {
  created: LocalSyncRecord[];
  updated: LocalSyncRecord[];
  deleted: string[];
}

export interface LocalPushSourceAdapter {
  getPendingRecords(entity: SyncEntityName): Promise<LocalPendingRecords>;
  // Looks up any entity's local record by id, regardless of its current
  // syncState label — used by the parent-safety-net pass below to pull in
  // a parent row referenced by a pending child but not already part of
  // this push. Returns null only if there's genuinely no local record with
  // that id.
  findLocalRecord(entity: SyncEntityName, id: string): Promise<LocalSyncRecord | null>;
}

// The backend `sync_status` column is a 3-value enum ('pending' | 'synced' |
// 'conflict') — it has no notion of the local 'pending_create' /
// 'pending_update' / 'pending_delete' states, which exist purely so this
// module can bucket records into the right created/updated/deleted array.
// Sending one of those local values through verbatim makes the RPC's enum
// cast throw and the whole push fail, so it's normalized here before the
// record ever leaves the device.
const BACKEND_PENDING_SYNC_STATUS = 'pending';

function withBackendSyncStatus(
  dto: Record<string, unknown>
): Record<string, unknown> {
  if (!('sync_status' in dto)) {
    return dto;
  }

  return { ...dto, sync_status: BACKEND_PENDING_SYNC_STATUS };
}

export async function collectPushChanges(
  adapter: LocalPushSourceAdapter
): Promise<PushChangesPayload> {
  const payload: Record<string, unknown> = {};

  const entities = Object.keys(syncSchema) as SyncEntityName[];

  for (const entity of entities) {
    const entitySchema = syncSchema[entity];

    if (!entitySchema.pushEnabled) {
      continue;
    }

    const { created, updated, deleted } = await adapter.getPendingRecords(entity);

    if (created.length === 0 && updated.length === 0 && deleted.length === 0) {
      continue;
    }

    payload[entity] = {
      created: mapLocalListToBackend(entity, created).map(withBackendSyncStatus),
      updated: mapLocalListToBackend(entity, updated).map(withBackendSyncStatus),
      deleted,
    };
  }

  await repairMissingParents(adapter, payload);

  return payload as PushChangesPayload;
}

type EntityChanges = { created: Record<string, unknown>[]; updated: Record<string, unknown>[]; deleted: string[] };

export interface ParentDependency {
  childEntity: SyncEntityName;
  parentEntity: SyncEntityName;
  // Backend field name on the child DTO holding the parent's id, e.g.
  // 'estab_id' on purpose_of_inspection pointing at establishments.
  foreignKeyField: string;
}

// Every FK relationship in the sync schema where a child can be pending
// while its parent, despite existing locally, isn't part of the same push.
// A parent row can end up marked 'synced' locally without that ever being
// confirmed server-side — the historical markLocalChangesAsSynced bug (see
// src/db/migrations.ts's v7->v8 comment) is one known cause, but any future
// variant of "client believes this landed, server never actually got it"
// hits the same failure mode: the child's insert trips a foreign key or —
// for tables whose ownership is checked via a same-transaction EXISTS join
// rather than a hard FK, like compliance_* checking inspection_reports —
// an RLS violation instead, since the join simply finds no row yet.
// Re-including a missing parent as a `created` row is always safe even if
// it turns out to already exist server-side (push_changes inserts with `on
// conflict do nothing`, and an ownership-checked child insert is a no-op
// against an already-correct parent). If no local record exists at all for
// the id, this can't help — that's a genuinely orphaned local reference, a
// different problem this can't repair.
export const PARENT_DEPENDENCIES: ParentDependency[] = [
  { childEntity: 'purpose_of_inspection', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  { childEntity: 'inspection_reports', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  { childEntity: 'inspection_reports', parentEntity: 'purpose_of_inspection', foreignKeyField: 'purpose_id' },
  { childEntity: 'survey_reports', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  ...regionParentDependencies,
  { childEntity: 'attachments', parentEntity: 'inspection_reports', foreignKeyField: 'inspection_report_id' },
  { childEntity: 'attachments', parentEntity: 'survey_reports', foreignKeyField: 'survey_report_id' },
];

async function repairMissingParents(
  adapter: LocalPushSourceAdapter,
  payload: Record<string, unknown>
): Promise<void> {
  // Repairing one relationship can itself pull in a parent that has unmet
  // dependencies of its own (e.g. adding a missing inspection_reports row
  // whose own establishment also never actually landed) — loop to a fixed
  // point rather than assuming a single dependency-ordered pass covers it.
  let changedInThisPass = true;
  while (changedInThisPass) {
    changedInThisPass = false;

    for (const dep of PARENT_DEPENDENCIES) {
      const added = await repairOneParentDependency(adapter, payload, dep);
      if (added) changedInThisPass = true;
    }
  }

  // Anything still unresolved after the fixed point above has no local
  // parent at all — findLocalRecord came back null, so there was nothing
  // to repair with (see repairOneParentDependency). This is a genuinely
  // orphaned local record (e.g. a child edited after its parent was
  // already 'synced', then the parent got swept away by a since-detected
  // user switch on a shared device — see clearSyncedRecords in
  // watermelonAdapter.ts, which hard-deletes 'synced' rows per table with
  // no cascade to their still-pending children). push_changes runs as one
  // transaction, so pushing this row anyway would trip a server-side FK or
  // RLS violation and abort every *other* pending change in the same
  // batch along with it — one broken record would silently block an
  // entire device's worth of otherwise-valid work every single sync
  // attempt. Drop it from this push instead: it stays pending locally
  // (never deleted), so it surfaces again if its parent ever reappears,
  // rather than either corrupting the batch or being destroyed here.
  //
  // Processed in PARENT_DEPENDENCIES' listed order (parents before the
  // things that depend on them), so a child dropped for one relationship
  // is correctly excluded from `alreadyIncluded` seen by a later
  // relationship where it's itself the parent (e.g. an orphaned
  // inspection_reports row dropped here means compliance_water rows
  // pointing at it get dropped too, in the same pass).
  for (const dep of PARENT_DEPENDENCIES) {
    pruneUnresolvableChildren(payload, dep);
  }
}

function pruneUnresolvableChildren(
  payload: Record<string, unknown>,
  dep: ParentDependency
): void {
  const childChanges = payload[dep.childEntity] as EntityChanges | undefined;
  if (!childChanges) return;

  const parentChanges = payload[dep.parentEntity] as EntityChanges | undefined;
  const parentPk = syncSchema[dep.parentEntity].primaryKey;
  const resolvedParentIds = new Set(
    parentChanges
      ? [...parentChanges.created, ...parentChanges.updated].map(dto => dto[parentPk])
      : []
  );

  const isResolved = (dto: Record<string, unknown>): boolean => {
    const fk = dto[dep.foreignKeyField];
    // No value at all — e.g. attachments' optional survey_report_id when
    // the attachment is actually linked to an inspection report instead —
    // isn't this dependency's concern.
    if (typeof fk !== 'string') return true;
    return resolvedParentIds.has(fk);
  };

  childChanges.created = childChanges.created.filter(isResolved);
  childChanges.updated = childChanges.updated.filter(isResolved);
}

async function repairOneParentDependency(
  adapter: LocalPushSourceAdapter,
  payload: Record<string, unknown>,
  dep: ParentDependency
): Promise<boolean> {
  const childChanges = payload[dep.childEntity] as EntityChanges | undefined;
  if (!childChanges) return false;

  const referencedIds = new Set<string>();
  for (const dto of [...childChanges.created, ...childChanges.updated]) {
    const fk = dto[dep.foreignKeyField];
    if (typeof fk === 'string') referencedIds.add(fk);
  }
  if (referencedIds.size === 0) return false;

  let parentChanges = payload[dep.parentEntity] as EntityChanges | undefined;
  const parentPk = syncSchema[dep.parentEntity].primaryKey;
  const alreadyIncluded = new Set(
    parentChanges
      ? [...parentChanges.created, ...parentChanges.updated].map(dto => dto[parentPk])
      : []
  );

  let added = false;
  for (const id of referencedIds) {
    if (alreadyIncluded.has(id)) continue;

    const record = await adapter.findLocalRecord(dep.parentEntity, id);
    if (!record) continue;

    if (!parentChanges) {
      parentChanges = { created: [], updated: [], deleted: [] };
      payload[dep.parentEntity] = parentChanges;
    }
    parentChanges.created.push(withBackendSyncStatus(mapLocalToBackend(dep.parentEntity, record)));
    alreadyIncluded.add(id);
    added = true;
  }

  return added;
}
