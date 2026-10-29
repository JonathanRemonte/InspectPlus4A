import type { AppSchema } from '@nozbe/watermelondb';
import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// The one runtime check that stands between a bad release and an
// inspector's unsynced work.
//
// WatermelonDB's SQLite adapter, opening a store whose version is older
// than the schema, asks the migrations for the steps in between. If the
// schema version was bumped without a migration to match, the adapter
// doesn't fail - it logs "Migrations not available for this version range,
// resetting database instead" and wipes the store, pending rows included.
// Dev builds catch this with a diagnostic invariant; release builds don't.
//
// Throwing here, before the adapter is ever constructed, turns that silent
// wipe into a crash at launch. A crash is recoverable - the next build
// fixes it and the data is still on the phone. A wipe is not.
export function assertMigrationsCoverSchema(schema: AppSchema, migrations: SchemaMigrations): void {
  if (migrations.maxVersion !== schema.version) {
    throw new Error(
      `[WatermelonDB] Refusing to open the database: schema version ${schema.version} but migrations only reach ${migrations.maxVersion}. ` +
        'Opening would reset the store and destroy unsynced records. Add a migration to version ' +
        `${schema.version} in src/region/db/migrations.ts.`,
    );
  }
}
