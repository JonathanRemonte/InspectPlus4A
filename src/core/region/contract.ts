import type React from 'react';
import type { Database, Model, TableSchema } from '@nozbe/watermelondb';
import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import type { SvgProps } from 'react-native-svg';
import type { Ionicons } from '@expo/vector-icons';

// What the foundation needs from a region. Each region repo (EMB4B, EMB4A)
// implements it through three entry points — src/region, src/region/db and
// src/region/modules — and src/core/region/assertRegion.ts makes tsc fail
// when an entry point drifts from these shapes. See docs/upstream-merge.md.

export interface RegionIdentity {
  /** Stable id, e.g. 'emb4b'. */
  id: string;
  /** The header lockup line, e.g. 'EMB4B INSPECTION & MONITORING SYSTEM'. */
  systemName: string;
  /** The home footer line. */
  copyrightLine: string;
}

/** The `src/region` entry point. */
export interface RegionIndex {
  region: {
    identity: RegionIdentity;
    locations: RegionLocations;
  };
  REPORT_TYPES: ReportType[];
  ENABLED_TYPES: string[];
  REPORT_TYPE_DISPLAY: Record<string, ReportTypeDisplay>;
  DATA_KEY_TO_CREATE_KEY: Partial<Record<string, string>>;
  COMPLIANCE_TAGS: ComplianceTagEntry[];
  SURVEY_COMPLIANCE_TAG: string;
  COMPLIANCE_COLLECTIONS: Partial<Record<string, string>>;
}

/** One simplified barangay polygon, as scripts/build-barangay-boundaries.js emits it. */
export interface BoundaryEntry {
  p: string; // province
  c: string; // city/municipality
  b: string; // barangay
  bbox: [number, number, number, number]; // west, south, east, north
  rings: number[][];
}

export interface RegionLocations {
  /** province -> city/municipality -> barangays, bundled for offline address entry. */
  locations: Record<string, Record<string, string[]>>;
  /** Where the map picker opens with no pin and no GPS fix. */
  overview: { center: [number, number]; zoom: number };
  /** The barangay boundary polygons. Large: call lazily, never at module scope. */
  loadBoundaries(): BoundaryEntry[];
  /** Shown when a pin falls outside every boundary. */
  outsideBoundariesLabel: string;
}

/** One entry in the create surfaces (home speed dial, Add Report panel). */
export interface ReportType<K extends string = string, D extends string = string> {
  key: K;
  /** Which recorded-report bucket (inspection_reports.report_type) this create flow produces. */
  dataKey: D;
  /** Compact label for the speed dial; the full `title` stays the accessibility label. */
  shortTitle: string;
  law: string;
  title: string;
  iconName: string; // Ionicons name
  iconLibrary: 'Ionicons' | 'MaterialCommunityIcons';
  /** Custom illustration used instead of the icon font glyph when set. */
  iconAsset?: React.FC<SvgProps>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  route: string;
}

/** How an already-recorded report of one data key is labeled and colored. */
export interface ReportTypeDisplay {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
}

/** An establishment-level rollup tag, its stored report type (null for survey_reports) and its create entry. */
export interface ComplianceTagEntry<K extends string = string, D extends string = string, T extends string = string> {
  tag: T;
  dataKey: D | null;
  createKey: K;
}

/** The `src/region/db` entry point: a leaf — it must not import src/db/database. */
export interface RegionDbIndex {
  regionDb: {
    /** WatermelonDB schema version. Region-owned: bump it for core or region table changes. */
    schemaVersion: number;
    /** Region tables only; src/db/schema.ts adds the foundation's. */
    tables: TableSchema[];
    /** The full migration history, foundation steps included (see docs/upstream-merge.md). */
    migrations: SchemaMigrations;
    modelClasses: (typeof Model)[];
  };
  regionCollectionsFor(database: Database): Record<string, unknown>;
}
