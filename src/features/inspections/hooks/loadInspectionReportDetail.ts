import { Q } from '@nozbe/watermelondb';
import { collections } from '../../../db/database';
import type { Attachment } from '../../../db/models/Attachment';
import { isEstablishmentVisible, isPrivilegedRole, reportSyncStatusWithAttachments } from '../../establishments/hooks/useEstablishment';
import { buildPurposeFormFromModel, PurposeFormState } from '../types';
import type { ComplianceView, InspectionReportSummary } from './useInspectionReport';
import { reportDataModules } from '../../../region/modules';
import type { ReportDataKey } from '../../../region';

export interface Viewer {
  uid: string;
  province: string;
  role: string;
}

export interface InspectionReportDetail {
  report: InspectionReportSummary;
  purpose: PurposeFormState | null;
  compliance: ComplianceView;
  attachments: Attachment[];
}

// One report with everything the detail screen and the export need, read
// once from WatermelonDB. Returns null for a report that doesn't exist or
// that this viewer may not see — the same jurisdiction rule as the
// "inspectors can read jurisdiction inspection reports" RLS policy.
export async function loadInspectionReportDetail(
  reportId: string,
  viewer: Viewer,
): Promise<InspectionReportDetail | null> {
  const reportMatches = await collections.inspectionReports
    .query(Q.where('reportId', reportId))
    .fetch();
  let reportModel: typeof reportMatches[number] | undefined = reportMatches[0];

  // Jurisdiction check, mirroring the "inspectors can read
  // jurisdiction inspection reports" / "admins and developers can
  // read all inspection reports" RLS policies: visible if this
  // inspector wrote it, the role is unrestricted, or its
  // establishment is jurisdiction-visible. A non-visible report is
  // treated exactly like "not found".
  if (reportModel && reportModel.inspectorUid !== viewer.uid && !isPrivilegedRole(viewer.role)) {
    const estabMatches = await collections.establishments
      .query(Q.where('estabId', reportModel.estabId))
      .fetch();
    const estab = estabMatches[0];
    if (!estab || !isEstablishmentVisible(estab, viewer.province, viewer.uid, viewer.role)) {
      reportModel = undefined;
    }
  }

  if (!reportModel) {
    return null;
  }

  const reportAttachments = await collections.attachments
    .query(Q.where('inspectionReportId', reportModel.reportId))
    .fetch();

  const summary: InspectionReportSummary = {
    reportId: reportModel.reportId,
    estabId: reportModel.estabId,
    inspectorUid: reportModel.inspectorUid,
    purposeId: reportModel.purposeId,
    reportType: reportModel.reportType,
    reportControlNo: reportModel.reportControlNo,
    inspectionDate: reportModel.inspectionDate,
    reportStatus: reportModel.reportStatus,
    syncState: reportModel.syncState,
    syncStatus: reportSyncStatusWithAttachments(
      reportModel.syncState,
      reportAttachments.map(a => a.syncState),
    ),
    establishmentSnapshot: reportModel.establishmentSnapshot,
    permitsSnapshot: reportModel.permitsSnapshot ?? [],
    createdAt: reportModel.createdAt,
    updatedAt: reportModel.updatedAt,
  };

  const purposeMatches = await collections.purposeOfInspection
    .query(Q.where('purposeId', reportModel.purposeId))
    .fetch();
  const purposeForm = purposeMatches[0] ? buildPurposeFormFromModel(purposeMatches[0]) : null;

  // The compliance row is type-specific; the region module for this report
  // type knows its table and shape (src/region/modules).
  const dataModule = reportDataModules[reportModel.reportType as ReportDataKey];
  const complianceView: ComplianceView = (await dataModule?.loadCompliance(reportModel.reportId)) ?? { kind: 'none' };

  return {
    report: summary,
    purpose: purposeForm,
    compliance: complianceView,
    attachments: reportAttachments,
  };
}
