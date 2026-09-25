import { Q } from '@nozbe/watermelondb';
import { collections } from '../../../db/database';
import type { Attachment } from '../../../db/models/Attachment';
import { isEstablishmentVisible, isPrivilegedRole, reportSyncStatusWithAttachments } from '../../establishments/hooks/useEstablishment';
import { buildPurposeFormFromModel, PurposeFormState } from '../types';
import type { ComplianceView, InspectionReportSummary } from './useInspectionReport';
import { airChecklistGroupsFrom } from './useInspectionReport';

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

  let complianceView: ComplianceView = { kind: 'none' };

  if (reportModel.reportType === 'water_monitoring') {
    const rows = await collections.complianceWater
      .query(Q.where('reportId', reportModel.reportId))
      .fetch();
    const c = rows[0];
    if (c) {
      complianceView = {
        kind: 'water',
        complianceId: c.complianceId,
        waterSources: c.waterSources ?? [],
        wastewaterSources: c.wastewaterSources ?? [],
        abstractedWaterQuality: c.abstractedWaterQuality ?? [],
        hasWwtp: c.hasWwtp,
        nonWwtpTreatment: c.nonWwtpTreatment ?? {},
        wwtpType: c.wwtpType,
        wwtpTypeOther: c.wwtpTypeOther,
        wwtpDetails: c.wwtpDetails ?? [],
        wwtpComponents: c.wwtpComponents ?? [],
        wwtpCondition: c.wwtpCondition,
        wwtpConditionOther: c.wwtpConditionOther,
        wwtpUnderConstruction: c.wwtpUnderConstruction,
        wwtpConstructionReported: c.wwtpConstructionReported,
        wwtpConstructionUnits: c.wwtpConstructionUnits,
        wwtpConstructionCompletionDate: c.wwtpConstructionCompletionDate,
        wwtpTreatmentUnitsUtilized: c.wwtpTreatmentUnitsUtilized,
        samplingConducted: c.samplingConducted,
        samplingClassification: c.samplingClassification,
        samplingPoints: c.samplingPoints ?? [],
        previousInspectionSummary: {
          hasRecords:
            c.previousInspectionSummary?.hasRecords === true
              ? 'yes'
              : c.previousInspectionSummary?.hasRecords === false
                ? 'no'
                : null,
          dateOfSampling: c.previousInspectionSummary?.dateOfSampling ?? '',
          samplingStation: c.previousInspectionSummary?.samplingStation ?? '',
          samplingTime: c.previousInspectionSummary?.samplingTime ?? '',
          typeOfSample: c.previousInspectionSummary?.typeOfSample ?? '',
          parameters: c.previousInspectionSummary?.parameters ?? [],
        },
        checklistDao200510: c.checklistDao200510 ?? [],
        dpConditions: c.dpConditions ?? [],
        otherObservations: c.otherObservations,
        remarksRecommendations: c.remarksRecommendations,
        documentsReviewed: c.documentsReviewed ?? [],
      };
    }
  } else if (reportModel.reportType === 'hazardous_waste') {
    const rows = await collections.complianceHazwaste
      .query(Q.where('reportId', reportModel.reportId))
      .fetch();
    const c = rows[0];
    if (c) {
      complianceView = {
        kind: 'hazwaste',
        hazwasteGeneratorId: c.hazwasteGeneratorId,
        hazwasteIdDateIssued: c.hazwasteIdDateIssued,
        wasteTypesGenerated: c.wasteTypesGenerated ?? [],
        checklists: [
          { title: 'Registration', items: c.checklistRegistration ?? [] },
          { title: 'Storage', items: c.checklistStorage ?? [] },
          { title: 'Packaging', items: c.checklistPackaging ?? [] },
          { title: 'Labeling', items: c.checklistLabeling ?? [] },
          { title: 'Transport', items: c.checklistTransport ?? [] },
          { title: 'Emergency Preparedness', items: c.checklistEmergency ?? [] },
          { title: 'Personnel Training', items: c.checklistPersonnelTraining ?? [] },
          { title: 'Manifest System', items: c.checklistManifestSystem ?? [] },
        ],
        hwidConditions: c.hwidConditions ?? [],
        otherObservations: c.otherObservations,
        remarksRecommendations: c.remarksRecommendations,
        documentsReviewed: c.documentsReviewed ?? [],
      };
    }
  } else if (reportModel.reportType === 'air_monitoring') {
    const rows = await collections.complianceAir
      .query(Q.where('reportId', reportModel.reportId))
      .fetch();
    const c = rows[0];
    if (c) {
      complianceView = {
        kind: 'air',
        emissionSources: c.emissionSources ?? [],
        checklists: airChecklistGroupsFrom(c),
        ptoConditions: c.ptoConditions ?? [],
        otherObservations: c.otherObservations,
        remarksRecommendations: c.remarksRecommendations,
        documentsReviewed: c.documentsReviewed ?? [],
      };
    }
  } else if (reportModel.reportType === 'eia') {
    const rows = await collections.complianceEia
      .query(Q.where('reportId', reportModel.reportId))
      .fetch();
    const c = rows[0];
    if (c) {
      complianceView = {
        kind: 'eia',
        checklistDao200330: c.checklistDao200330 ?? [],
        eccEmpConditions: c.eccEmpConditions ?? [],
        otherObservations: c.otherObservations,
        remarksRecommendations: c.remarksRecommendations,
        documentsReviewed: c.documentsReviewed ?? [],
      };
    }
  }

  return {
    report: summary,
    purpose: purposeForm,
    compliance: complianceView,
    attachments: reportAttachments,
  };
}
