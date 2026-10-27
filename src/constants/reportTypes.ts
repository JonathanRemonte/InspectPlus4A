// Facade: the report-type catalog is region-owned (src/region/catalog.ts).
// Kept so this path's importers and test mocks don't change.
import type { ReportType as ContractReportType } from '../core/region/contract';
import type { ReportDataKey, ReportTypeKey } from '../region';

export { ENABLED_TYPES, REPORT_TYPES } from '../region';
export type { ReportTypeKey } from '../region';
export type ReportType = ContractReportType<ReportTypeKey, ReportDataKey>;
