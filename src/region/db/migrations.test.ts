import { stepsForMigration } from '@nozbe/watermelondb/Schema/migrations/stepsForMigration';
import { schema } from '../../db/schema';
import { migrations } from './migrations';
import { assertMigrationsCoverSchema } from '../../db/migrationGuard';

// What these protect: an inspector's unsynced establishments and reports.
//
// WatermelonDB's SQLite adapter, on opening a database whose version is
// older than the app's schema, asks the migrations for the steps from that
// version to the current one. If they can't supply them - a schema.version
// bumped without a migration, a gap in the list - it does not fail: it logs
// "Migrations not available for this version range, resetting database
// instead" and wipes the store, pending rows included. Dev builds surface
// this as a diagnostic error at startup; release builds do it silently.
// Every assertion here is a way that wipe could be reintroduced.

type ColumnDef = { name: string; type: string; isOptional?: boolean };
type Step =
  | { type: 'add_columns'; table: string; columns: ColumnDef[] }
  | { type: 'create_table'; schema: { name: string; columns: Record<string, ColumnDef> } }
  | { type: 'sql'; sql: string };

const allSteps = (): Step[] => migrations.sortedMigrations.flatMap(m => m.steps as Step[]);

describe('every device on a covered version migrates forward instead of resetting', () => {
  it('has a migration to the current schema version', () => {
    expect(migrations.maxVersion).toBe(schema.version);
  });

  it('can produce steps from every covered version to the current one', () => {
    for (let from = migrations.minVersion; from < schema.version; from++) {
      const steps = stepsForMigration({ migrations, fromVersion: from, toVersion: schema.version });
      expect(steps).not.toBeNull();
    }
  });

  it('is what database.ts checks before it lets the adapter open the store', () => {
    expect(() => assertMigrationsCoverSchema(schema, migrations)).not.toThrow();
    expect(() => assertMigrationsCoverSchema({ ...schema, version: schema.version + 1 }, migrations)).toThrow(
      /schema version 17 .* migrations only reach 16/,
    );
  });
});

describe('migrations only ever add', () => {
  // A migration that drops a table or column, or deletes rows, is the other
  // way an update can lose local work - and the one this guard can't stop
  // at runtime, so it stops it here.
  it('never drops, truncates or deletes', () => {
    for (const step of allSteps()) {
      if (step.type === 'sql') {
        expect(step.sql).not.toMatch(/\b(drop|truncate|delete)\b/i);
      }
      expect(['add_columns', 'create_table', 'sql']).toContain(step.type);
    }
  });

  it('adds only nullable columns, so rows written before the column existed still load', () => {
    for (const step of allSteps()) {
      if (step.type !== 'add_columns') continue;
      for (const col of step.columns) {
        // A NOT NULL column with no default would make every existing row
        // invalid the moment the migration ran.
        expect({ step: step.table, column: col.name, isOptional: col.isOptional }).toEqual(
          expect.objectContaining({ isOptional: true }),
        );
      }
    }
  });
});

describe('the migrations and the schema describe the same database', () => {
  // The schema is what a fresh install creates; the migrations are what an
  // existing install becomes. If a column is in one and not the other, the
  // two kinds of device end up with different tables and the next sync or
  // query breaks on one of them.
  const schemaColumns = (table: string): Record<string, ColumnDef> =>
    (schema.tables[table]?.columns ?? {}) as Record<string, ColumnDef>;

  it('every column a migration adds exists in the schema with the same type', () => {
    for (const step of allSteps()) {
      if (step.type !== 'add_columns') continue;
      for (const col of step.columns) {
        const inSchema = schemaColumns(step.table)[col.name];
        expect({ table: step.table, column: col.name, found: !!inSchema }).toEqual(
          expect.objectContaining({ found: true }),
        );
        expect({ table: step.table, column: col.name, type: inSchema?.type }).toEqual(
          expect.objectContaining({ type: col.type }),
        );
      }
    }
  });

  it('every table a migration creates exists in the schema', () => {
    for (const step of allSteps()) {
      if (step.type !== 'create_table') continue;
      expect(schema.tables[step.schema.name]).toBeDefined();
    }
  });
});
