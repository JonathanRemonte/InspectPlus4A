// The src/region/modules entry point. EMB4A registers no report types until
// Phase 3; see src/region/catalog.ts.
import type { MapContext, SurveyBundle, TemplateData } from '../../features/export/types';
import type { ReportDataModule, ReportFormModule } from '../../core/region/contract';
import type { ReportDataKey, ReportTypeKey } from '../catalog';

export const reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>> = {};
export const reportForms: Partial<Record<ReportTypeKey, ReportFormModule>> = {};
export const mapSurveyBundle: ((bundle: SurveyBundle, ctx: MapContext) => TemplateData) | undefined = undefined;
