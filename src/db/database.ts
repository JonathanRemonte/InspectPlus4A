import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { regionDb, regionCollectionsFor } from '../region/db';
import { assertMigrationsCoverSchema } from './migrationGuard';
import {
  Establishment,
  InspectionReport,
  SurveyReport,
  PurposeOfInspection,
  Attachment,
} from './models';

// A schema version the migrations can't reach makes the adapter reset the
// store instead of migrating it - see migrationGuard.ts. Crash here rather
// than let that happen to an inspector's unsynced work.
assertMigrationsCoverSchema(schema, regionDb.migrations);

// ── SQLite adapter ────────────────────────────────────────────────────────────
const adapter = new SQLiteAdapter({
  schema,
  migrations: regionDb.migrations,
  jsi: true,        // uses JSI for better performance on Hermes
  onSetUpError: error => {
    console.error('[WatermelonDB] Database setup failed:', error);
  },
});

// ── Database instance ─────────────────────────────────────────────────────────
// Single shared instance — import `database` anywhere you need DB access.
export const database = new Database({
  adapter,
  modelClasses: [Establishment, InspectionReport, SurveyReport, PurposeOfInspection, Attachment, ...regionDb.modelClasses],
});

// ── Collection accessors ──────────────────────────────────────────────────────
// Use these instead of database.collections.get('table_name') to keep
// everything typed and centralized.
export const collections = {
  establishments:      database.collections.get<Establishment>('establishments'),
  inspectionReports:   database.collections.get<InspectionReport>('inspection_reports'),
  surveyReports:       database.collections.get<SurveyReport>('survey_reports'),
  purposeOfInspection: database.collections.get<PurposeOfInspection>('purpose_of_inspection'),
  attachments:         database.collections.get<Attachment>('attachments'),
  ...regionCollectionsFor(database),
};
