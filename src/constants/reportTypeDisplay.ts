// Facade: the recorded-report vocabulary is region-owned (src/region/catalog.ts).
import { REPORT_TYPE_DISPLAY as REGION_REPORT_TYPE_DISPLAY } from '../region';
import type { ReportTypeDisplay } from '../core/region/contract';

export type { ReportDataKey } from '../region';
export type { ReportTypeDisplay } from '../core/region/contract';

// Widened to the contract's string-keyed shape: a region with no report types
// keys this by `never`, which would make every lookup by a stored report_type
// string a type error.
export const REPORT_TYPE_DISPLAY: Record<string, ReportTypeDisplay> = REGION_REPORT_TYPE_DISPLAY;
