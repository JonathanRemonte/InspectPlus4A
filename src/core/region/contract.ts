import type React from 'react';
import type { Database, Model, TableSchema } from '@nozbe/watermelondb';
import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import type { SvgProps } from 'react-native-svg';
import type { Ionicons } from '@expo/vector-icons';
import type { Approvers, TemplateEntry } from '../../features/export/templates';
import type { InspectionBundle, MapContext, SurveyBundle, TemplateData } from '../../features/export/types';
import type { TwoRowMainTabDef } from '../../features/inspections/components/TwoRowTabs';
import type { ComplianceView, InspectionReportSummary } from '../../features/inspections/hooks/useInspectionReport';
import type { GeneralInfoFormState, PurposeFormState } from '../../features/inspections/types';

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
  /** The region as the home greeting names it, e.g. 'EMB Region 4-B'. */
  regionLabel: string;
  /** "owner/name" of the GitHub repo whose Releases carry this app's APKs. */
  releaseRepo: string;
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
  TEMPLATES: Partial<Record<string, TemplateEntry>>;
  UNUSED_CHECKBOXES: Record<string, number>;
  SURVEY_TEMPLATE_KEY: string;
  FALLBACK_APPROVERS: Approvers;
  /** Document names offered in the "documents reviewed" checklist. */
  DOCUMENTS_REVIEWED_OPTIONS: string[];
}

// Type exports foundation also imports by name from `src/region` (checked in
// assertRegion.ts, since interfaces can't express them): ReportTypeKey,
// ReportDataKey, ComplianceTag, RegionComplianceView, WaterComplianceView.
// From `src/region/db`: RegionSyncEntityName, RegionDtoMap, RegionCollections.

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
  /**
   * Keys must equal the entity's WatermelonDB table name: watermelonAdapter's
   * collectionFor looks the collection up by sync entity name.
   */
  regionSyncEntities: Record<string, unknown>;
  regionParentDependencies: { childEntity: string; parentEntity: string; foreignKeyField: string }[];
}

/** What the report detail screen hands a region-owned tab. */
export interface DetailTabProps {
  report: InspectionReportSummary;
  compliance: ComplianceView;
  tabKey: string;
  canEdit: boolean;
  refetch: () => void;
}

/** Everything type-specific about one stored report type (inspection_reports.report_type). */
export interface ReportDataModule {
  /** Reads the report's compliance row; null when none exists yet. */
  loadCompliance(reportId: string): Promise<Exclude<ComplianceView, { kind: 'none' }> | null>;
  /** The flat "Compliance Status" read view. Omit when renderDetailTab owns the compliance tab. */
  ComplianceView?: React.ComponentType<{ compliance: Exclude<ComplianceView, { kind: 'none' }> }>;
  /** Replaces DEFAULT_REPORT_DETAIL_TABS for this type. */
  detailTabs?(): TwoRowMainTabDef[];
  /**
   * Renders any tab the foundation doesn't own (it owns general, purpose and
   * attachments). Return null for tabs this type doesn't render.
   */
  renderDetailTab?(props: DetailTabProps): React.ReactNode;
  /** True when this type renders the DENR permits section in its own detail tabs, so General Information omits it. */
  permitsInDetailTabs?: boolean;
  /** Maps a recorded report to the tags of its .docx template. Omit and the type can't be exported. */
  mapExport?(bundle: InspectionBundle, ctx: MapContext): TemplateData;
}

/** What the Add Report panel already collected when it opens a type's form. */
export interface ShellStart {
  estabId: string | null; // null when creating a brand-new establishment
  initialGeneralInfo: GeneralInfoFormState;
  initialInspectionDate?: string;
  initialPurpose?: PurposeFormState;
  initialControlNumber?: string;
}

/** The forms for one create entry (REPORT_TYPES key). */
export interface ReportFormModule {
  /** Rendered by /inspection/new?type=<key>. */
  NewFormScreen?: React.ComponentType;
  /** Rendered by the establishment's Add Report panel once the shared steps are done. */
  FormShell?: React.ComponentType<{ start: ShellStart }>;
}

/** The `src/region/modules` entry point. */
export interface RegionModulesIndex {
  reportDataModules: Partial<Record<string, ReportDataModule>>;
  reportForms: Partial<Record<string, ReportFormModule>>;
  mapSurveyBundle?: (bundle: SurveyBundle, ctx: MapContext) => TemplateData;
}
