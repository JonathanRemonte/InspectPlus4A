// The src/region/db entry point. A leaf: src/db/schema.ts and
// src/db/database.ts import it, so nothing here may import src/db/database.
import type { Database } from '@nozbe/watermelondb';
import { migrations } from './migrations';
import { regionTables } from './tables';

export { regionParentDependencies, regionSyncEntities } from './sync';
export type { RegionDtoMap, RegionSyncEntityName } from './sync';

export const regionDb = {
  schemaVersion: 1,
  tables: regionTables,
  migrations,
  modelClasses: [],
};

// Spread into src/db/database.ts's `collections`; EMB4A has no region tables.
export function regionCollectionsFor(_database: Database) {
  return {};
}

export type RegionCollections = ReturnType<typeof regionCollectionsFor>;
