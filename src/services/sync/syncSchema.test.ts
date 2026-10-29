import { schema } from '../../db/schema';
import { regionSyncEntities } from '../../region/db';
import { syncSchema, SyncEntityName } from './syncSchema';

// Region-neutral order rule: the foundation's parent tables first, then the
// region's entities in its own order, attachments last (they can reference a
// row of any other table). The region's exact entity list is pinned in
// src/region/__tests__/syncRegistry.test.ts.
describe('syncSchema entity order', () => {
  it('puts foundation parents first, region entities next and attachments last', () => {
    expect(Object.keys(syncSchema)).toEqual([
      'establishments',
      'purpose_of_inspection',
      'inspection_reports',
      'survey_reports',
      ...Object.keys(regionSyncEntities),
      'attachments',
    ]);
  });
});

// syncSchema.fields is the map push/pull actually walks (mapLocalToBackend /
// mapBackendToLocal in syncMappers.ts, and getPendingRecords /
// toLocalRecord in watermelonAdapter.ts read every one of its local names
// straight off the WatermelonDB model). A typo on either side of an entry -
// or a local name that doesn't match a real column - typechecks and lints
// clean, but silently drops that column from every push/pull. Nothing else
// in the suite would catch it, since nothing else cross-checks this map
// against src/db/schema.ts.
//
// updatedAtField/deletedAtField store *backend* field names (watermelonAdapter.ts
// resolves the local column via entitySchema.fields[entitySchema.updatedAtField]
// - see resolveConflictKeepLocal and softDeleteMany), so their local
// counterpart is whatever `fields` maps them to; that's already covered by
// the per-field loop below, but it's asserted again by name for clarity.

describe('syncSchema matches the local WatermelonDB schema', () => {
  const entities = Object.keys(syncSchema) as SyncEntityName[];

  // watermelonAdapter.collectionFor looks collections up by sync entity name.
  it('every sync entity name is a WatermelonDB table name', () => {
    for (const entity of entities) expect(Object.keys(schema.tables)).toContain(entity);
  });

  it.each(entities)('%s: every local field name is a real column', entity => {
    const entitySchema = syncSchema[entity];
    const table = schema.tables[entity];
    expect(table).toBeDefined();

    for (const [backendField, localField] of Object.entries(entitySchema.fields)) {
      if (!table.columns[localField]) {
        throw new Error(`${entity}.fields.${backendField} -> '${localField}' is not a column`);
      }
    }
  });

  it.each(entities)('%s: localPrimaryKey is a real column, and matches what fields maps its primaryKey to', entity => {
    const entitySchema = syncSchema[entity];
    const table = schema.tables[entity];

    expect(table.columns[entitySchema.localPrimaryKey]).toBeDefined();
    expect(entitySchema.fields[entitySchema.primaryKey]).toBe(entitySchema.localPrimaryKey);
  });

  it.each(entities)('%s: updatedAtField, if set, resolves to a real column', entity => {
    const entitySchema = syncSchema[entity];
    const table = schema.tables[entity];
    if (!entitySchema.updatedAtField) return;

    const localUpdatedAtField = entitySchema.fields[entitySchema.updatedAtField];
    expect(localUpdatedAtField).toBeDefined();
    expect(table.columns[localUpdatedAtField]).toBeDefined();
  });

  it.each(entities)('%s: deletedAtField, if set, resolves to a real column', entity => {
    const entitySchema = syncSchema[entity];
    const table = schema.tables[entity];
    if (!entitySchema.deletedAtField) return;

    const localDeletedAtField = entitySchema.fields[entitySchema.deletedAtField];
    expect(localDeletedAtField).toBeDefined();
    expect(table.columns[localDeletedAtField]).toBeDefined();
  });

  // No entity in this codebase maps a backend field to WatermelonDB's own
  // implicit `id` column (every table keeps a separate camelCase primary
  // key column - estabId, complianceId, etc. - alongside the row id), so
  // there is nothing to exclude here today. If one is ever added, exclude
  // it explicitly with a comment rather than loosening the assertions above.
});
