import { mapSurveyBundle } from '../../../region/modules';
import { reportDataModuleFor } from '../../../core/region/lookup';

import type { MapContext, ReportBundle, TemplateData } from '../types';

// Each report type's mapper is region-owned (src/region/modules).
export function mapBundle(bundle: ReportBundle, ctx: MapContext): TemplateData {
  if (bundle.kind === 'survey') {
    if (!mapSurveyBundle) throw new Error('No mapper for survey reports');
    return mapSurveyBundle(bundle, ctx);
  }
  const mapExport = reportDataModuleFor(bundle.report.reportType)?.mapExport;
  if (!mapExport) throw new Error(`No mapper for report type ${bundle.report.reportType}`);
  return mapExport(bundle, ctx);
}
