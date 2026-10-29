// The src/region/modules entry point: per-type UI and logic. Imported only
// by the foundation's host screens (detail screen, Add Report panel, the
// new-inspection route, the export mapper) — never at module scope by
// anything those screens' children import, which keeps it cycle-free.
import type { ReportDataModule, ReportFormModule } from '../../core/region/contract';
import { mapCommon } from '../../features/export/mappers/common';
import { unusedBoxes } from '../../features/export/mappers/primitives';
import type { InspectionBundle, MapContext } from '../../features/export/types';
import type { ReportDataKey, ReportTypeKey } from '../catalog';
import { AirComplianceSection, EiaComplianceSection, HazwasteComplianceSection } from '../compliance/ComplianceSections';
import { loadAirCompliance, loadEiaCompliance, loadHazwasteCompliance, loadWaterCompliance } from '../compliance/loaders';
import { renderWaterDetailTab, waterDetailTabs } from '../compliance/waterDetail';
import { mapSurvey } from '../export/survey';
import { mapWater } from '../export/water';
import { WaterFormShell, WaterInspectionFormScreen } from '../inspections/water/WaterInspectionFormScreen';
import { UNUSED_CHECKBOXES } from '../templates';

// Types whose template has no type-specific tags yet: the shared block
// only, plus their pre-existing checkboxes printed unticked.
const mapCommonOnly = (dataKey: ReportDataKey) => (bundle: InspectionBundle, ctx: MapContext) => ({
  ...mapCommon(bundle, ctx),
  ...unusedBoxes(UNUSED_CHECKBOXES[dataKey] ?? 0),
});

export const mapSurveyBundle = mapSurvey;

export const reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>> = {
  water_monitoring: {
    loadCompliance: loadWaterCompliance,
    detailTabs: waterDetailTabs,
    renderDetailTab: renderWaterDetailTab,
    permitsInDetailTabs: true,
    mapExport: mapWater,
  },
  air_monitoring: { loadCompliance: loadAirCompliance, ComplianceView: AirComplianceSection, mapExport: mapCommonOnly('air_monitoring') },
  hazardous_waste: { loadCompliance: loadHazwasteCompliance, ComplianceView: HazwasteComplianceSection, mapExport: mapCommonOnly('hazardous_waste') },
  eia: { loadCompliance: loadEiaCompliance, ComplianceView: EiaComplianceSection, mapExport: mapCommonOnly('eia') },
};

export const reportForms: Partial<Record<ReportTypeKey, ReportFormModule>> = {
  water: { NewFormScreen: WaterInspectionFormScreen, FormShell: WaterFormShell },
};
