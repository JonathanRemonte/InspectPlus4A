// EMB4A's synced region tables — none until Phase 3.
import type { ParentDependency } from '../../db/sync/collectPushChanges';
import type { SyncEntitySchema } from '../../services/sync/syncSchema';

export type RegionSyncEntityName = never;
export const regionSyncEntities: Record<RegionSyncEntityName, SyncEntitySchema> = {};
export const regionParentDependencies: ParentDependency[] = [];
export type RegionDtoMap = Record<never, never>;
