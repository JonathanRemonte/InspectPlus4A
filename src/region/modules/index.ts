// The src/region/modules entry point: per-type UI and logic. Imported only
// by the foundation's host screens (detail screen, Add Report panel, the
// new-inspection route, the export mapper) — never at module scope by
// anything those screens' children import, which keeps it cycle-free.
import type { ReportDataModule } from '../../core/region/contract';
import type { ReportDataKey } from '../catalog';
import { AirComplianceSection, EiaComplianceSection, HazwasteComplianceSection } from '../compliance/ComplianceSections';
import { loadAirCompliance, loadEiaCompliance, loadHazwasteCompliance, loadWaterCompliance } from '../compliance/loaders';
import { renderWaterDetailTab, waterDetailTabs } from '../compliance/waterDetail';

export const reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>> = {
  water_monitoring: {
    loadCompliance: loadWaterCompliance,
    detailTabs: waterDetailTabs,
    renderDetailTab: renderWaterDetailTab,
    permitsInDetailTabs: true,
  },
  air_monitoring: { loadCompliance: loadAirCompliance, ComplianceView: AirComplianceSection },
  hazardous_waste: { loadCompliance: loadHazwasteCompliance, ComplianceView: HazwasteComplianceSection },
  eia: { loadCompliance: loadEiaCompliance, ComplianceView: EiaComplianceSection },
};
