import type { ComplianceTagEntry, ReportType, ReportTypeDisplay } from '../core/region/contract';
import type { RegionCollections } from './db';

// EMB Region 4-A (CALABARZON). No report types yet: the CHWMS forms (RA 6969
// monitoring/survey, TRC, TSD, PDSF) arrive in Phase 3 of the region split
// (docs/superpowers/specs/2026-10-27-emb4a-region-split-design.md).
export type ReportTypeKey = never;
export type ReportDataKey = never;

export const ENABLED_TYPES: ReportTypeKey[] = [];
export const REPORT_TYPES: ReportType<ReportTypeKey, ReportDataKey>[] = [];
export const REPORT_TYPE_DISPLAY: Record<ReportDataKey, ReportTypeDisplay> = {};
export const DATA_KEY_TO_CREATE_KEY: Partial<Record<ReportDataKey, ReportTypeKey>> = {};

// Survey reports stay a foundation kind until Phase 2; EMB4A creates none, but
// the tag the foundation adds for one keeps its name.
export type ComplianceTag = 'Survey';
export const SURVEY_COMPLIANCE_TAG: ComplianceTag = 'Survey';
export const COMPLIANCE_TAGS: ComplianceTagEntry<ReportTypeKey, ReportDataKey, ComplianceTag>[] = [];

export const COMPLIANCE_COLLECTIONS: Partial<Record<ReportDataKey, keyof RegionCollections>> = {};

// The "documents reviewed" checklist the shared export block prints; EMB4A's
// forms define their own in Phase 3.
export const DOCUMENTS_REVIEWED_OPTIONS: string[] = [];
