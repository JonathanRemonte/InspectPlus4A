import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// EMB4A's local migration history. It starts at version 1: no device ever held
// EMB4B's store, so EMB4B's sixteen steps are not carried. A foundation change
// to a core table adds its step here at EMB4A's next version
// (docs/upstream-merge.md §5).
export const migrations = schemaMigrations({ migrations: [] });
