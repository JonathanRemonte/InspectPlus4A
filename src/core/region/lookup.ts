import { reportDataModules, reportForms } from '../../region/modules';
import type { RegionModulesIndex, ReportDataModule, ReportFormModule } from './contract';

// The region's module registries are typed by its own key unions, which are
// `never` in a region with no report types - and indexing a `never`-keyed
// record by a stored string is a type error. Foundation looks modules up by
// the strings it holds (inspection_reports.report_type, a route param), so
// these accessors widen to the contract's string-keyed shape once, here.
const dataModules: RegionModulesIndex['reportDataModules'] = reportDataModules;
const formModules: RegionModulesIndex['reportForms'] = reportForms;

export function reportDataModuleFor(reportType: string): ReportDataModule | undefined {
  return dataModules[reportType];
}

export function reportFormFor(createKey: string): ReportFormModule | undefined {
  return formModules[createKey];
}
