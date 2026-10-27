import { Q } from '@nozbe/watermelondb';
import { collections } from '../../db/database';
import { airChecklistGroupsFrom } from '../../features/inspections/air/airChecklistGroups';
import type { AirComplianceView, EiaComplianceView, HazwasteComplianceView, WaterComplianceView } from '../complianceViews';

export async function loadWaterCompliance(reportId: string): Promise<WaterComplianceView | null> {
  const rows = await collections.complianceWater.query(Q.where('reportId', reportId)).fetch();
  const c = rows[0];
  if (!c) return null;
  return {
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

export async function loadHazwasteCompliance(reportId: string): Promise<HazwasteComplianceView | null> {
  const rows = await collections.complianceHazwaste.query(Q.where('reportId', reportId)).fetch();
  const c = rows[0];
  if (!c) return null;
  return {
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

export async function loadAirCompliance(reportId: string): Promise<AirComplianceView | null> {
  const rows = await collections.complianceAir.query(Q.where('reportId', reportId)).fetch();
  const c = rows[0];
  if (!c) return null;
  return {
      kind: 'air',
      emissionSources: c.emissionSources ?? [],
      checklists: airChecklistGroupsFrom(c),
      ptoConditions: c.ptoConditions ?? [],
      otherObservations: c.otherObservations,
      remarksRecommendations: c.remarksRecommendations,
      documentsReviewed: c.documentsReviewed ?? [],
  };
}

export async function loadEiaCompliance(reportId: string): Promise<EiaComplianceView | null> {
  const rows = await collections.complianceEia.query(Q.where('reportId', reportId)).fetch();
  const c = rows[0];
  if (!c) return null;
  return {
      kind: 'eia',
      checklistDao200330: c.checklistDao200330 ?? [],
      eccEmpConditions: c.eccEmpConditions ?? [],
      otherObservations: c.otherObservations,
      remarksRecommendations: c.remarksRecommendations,
      documentsReviewed: c.documentsReviewed ?? [],
  };
}
