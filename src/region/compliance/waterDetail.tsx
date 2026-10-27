import React from 'react';
import type { DetailTabProps } from '../../core/region/contract';
import { DenrPermitsSection } from '../../features/inspections/components/DenrPermitsSection';
import { patchPermitsSnapshot } from '../../features/inspections/permitsSnapshotPersistence';
import { WaterExtraSectionsView } from '../../features/inspections/water/WaterComplianceEditSections';
import { buildWaterReportTabs, establishmentHasDischargePermit } from '../../features/inspections/water/waterReportTabs';

const WATER_SECTION_TABS = ['watersupply', 'wastewaterpollution', 'samplingfindings'];

// Water reports get the full 1-6 section/subsection tab menu from the
// report template instead of DEFAULT_REPORT_DETAIL_TABS.
export function waterDetailTabs() {
  return buildWaterReportTabs({ includeAttachments: true });
}

export function renderWaterDetailTab({ report, compliance, tabKey, canEdit, refetch }: DetailTabProps): React.ReactNode {
  if (tabKey === 'compliance') {
    return (
      <DenrPermitsSection
        permits={report.permitsSnapshot}
        canEdit={canEdit}
        onSave={next => patchPermitsSnapshot(report.reportId, next)}
        onSaved={refetch}
      />
    );
  }
  if (compliance.kind === 'water' && WATER_SECTION_TABS.includes(tabKey)) {
    const tabs = waterDetailTabs();
    return (
      <WaterExtraSectionsView
        compliance={compliance}
        canEdit={canEdit}
        onSaved={refetch}
        mainTab={tabs.find(t => t.key === tabKey) ?? tabs[0]}
        hasDp={establishmentHasDischargePermit(report.permitsSnapshot)}
        province={report.establishmentSnapshot.province}
      />
    );
  }
  return null;
}
