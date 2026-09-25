import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { loadInspectionReportDetail } from './loadInspectionReportDetail';
import type { PurposeFormState } from '../types';
import type { SyncStatus } from '../../establishments/types';
import type { EstablishmentSnapshot, PermitSnapshotItem } from '../../../services/sync/syncTypes';
import type { YnValue } from '../../../components/form';
import type {
  WwtpDetailCard,
  SamplingPointCard,
  DpConditionRow,
  PreviousInspectionState,
} from '../water/waterTypes';

export interface InspectionReportSummary {
  reportId: string;
  estabId: string;
  inspectorUid: string;
  purposeId: string;
  reportType: string;
  reportControlNo: string | null;
  inspectionDate: string;
  reportStatus: string;
  syncState: string;
  // Normalized 'synced' | 'pending' | 'conflict', folding in this report's
  // own attachments — see reportSyncStatusWithAttachments. Distinct from the
  // raw syncState above, which is the report row's own WatermelonDB state
  // only.
  syncStatus: SyncStatus;
  establishmentSnapshot: EstablishmentSnapshot;
  permitsSnapshot: PermitSnapshotItem[];
  createdAt: string;
  updatedAt: string;
}

// legal_ref/requirement + Y/N/NA + remarks — the common shape every
// checklist_* JSONB array uses across compliance_water/hazwaste/air/eia.
export interface ChecklistEntry {
  legal_ref?: string;
  requirement?: string;
  compliant: YnValue;
  remarks?: string | null;
  [key: string]: unknown;
}

// condition_no/description (permit & HWID conditions) OR
// requirement/ecc_description (EIA ECC-EMP conditions) + Y/N/NA + remarks.
export interface ConditionEntry {
  condition_no?: string;
  description?: string;
  requirement?: string;
  relevant_ecc_no?: string;
  ecc_description?: string;
  compliant: YnValue;
  remarks?: string | null;
  proof_of_compliance?: string | null;
  [key: string]: unknown;
}

export interface ChecklistGroup {
  title: string;
  items: ChecklistEntry[];
}

export interface WaterComplianceView {
  kind: 'water';
  complianceId: string;
  waterSources: Record<string, unknown>[];
  wastewaterSources: Record<string, unknown>[];
  abstractedWaterQuality: Record<string, unknown>[];
  hasWwtp: boolean | null;
  nonWwtpTreatment: Record<string, unknown>;
  wwtpType: string | null;
  wwtpTypeOther: string | null;
  // wwtpDetails/wwtpComponents/samplingPoints/dpConditions are written by
  // the create flow (WaterInspectionFormScreen -> useReportFormState) using
  // WaterComplianceFormState's camelCase field names verbatim, unlike the
  // rest of this schema's snake_case JSONB convention — see waterTypes.ts.
  wwtpDetails: WwtpDetailCard[];
  // Untyped like waterSources and its neighbours, not WwtpComponentCard[]:
  // rows written before section 5D became checkboxes hold a comma-separated
  // string where each treatment array now is, so claiming the card shape
  // here would be a lie a reader would act on. WwtpComponentsSection decodes
  // on read — see decodeWwtpComponent in waterTypes.ts.
  wwtpComponents: Record<string, unknown>[];
  wwtpCondition: string | null;
  wwtpConditionOther: string | null;
  wwtpUnderConstruction: boolean | null;
  wwtpConstructionReported: boolean | null;
  wwtpConstructionUnits: string | null;
  wwtpConstructionCompletionDate: string | null;
  wwtpTreatmentUnitsUtilized: string | null;
  samplingConducted: boolean | null;
  samplingClassification: string | null;
  samplingPoints: SamplingPointCard[];
  previousInspectionSummary: PreviousInspectionState;
  checklistDao200510: ChecklistEntry[];
  dpConditions: DpConditionRow[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface HazwasteComplianceView {
  kind: 'hazwaste';
  hazwasteGeneratorId: string | null;
  hazwasteIdDateIssued: string | null;
  wasteTypesGenerated: Record<string, unknown>[];
  checklists: ChecklistGroup[];
  hwidConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface AirComplianceView {
  kind: 'air';
  emissionSources: Record<string, unknown>[];
  checklists: ChecklistGroup[];
  ptoConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export interface EiaComplianceView {
  kind: 'eia';
  checklistDao200330: ChecklistEntry[];
  eccEmpConditions: ConditionEntry[];
  otherObservations: string | null;
  remarksRecommendations: string | null;
  documentsReviewed: string[];
}

export type ComplianceView =
  | WaterComplianceView
  | HazwasteComplianceView
  | AirComplianceView
  | EiaComplianceView
  | { kind: 'none' };

interface UseInspectionReportReturn {
  report: InspectionReportSummary | null;
  purpose: PurposeFormState | null;
  compliance: ComplianceView;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Loads a single inspection report plus its linked purpose_of_inspection and
// type-specific compliance_* row from local WatermelonDB, for the read-only
// report detail screen. Follows the same fetch-once + tick-refetch shape as
// useEstablishment.ts.
export function useInspectionReport(reportId: string | undefined): UseInspectionReportReturn {
  const [report, setReport] = useState<InspectionReportSummary | null>(null);
  const [purpose, setPurpose] = useState<PurposeFormState | null>(null);
  const [compliance, setCompliance] = useState<ComplianceView>({ kind: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { session, province, role } = useAuthContext();
  const myUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  const myProvince = province ?? '';
  const myRole = role ?? '';
  const ready = !!myUid && !!myProvince;

  // Stable across renders — GeneralInformationView's section components pass
  // this down as `onSaved` and are React.memo'd, so a new reference here on
  // every InspectionReportDetailScreen render (e.g. a tab switch) would
  // otherwise force all of them to re-render regardless of memoization.
  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!reportId || !ready) {
        setReport(null);
        setPurpose(null);
        setCompliance({ kind: 'none' });
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const detail = await loadInspectionReportDetail(reportId, {
          uid: myUid,
          province: myProvince,
          role: myRole,
        });
        if (cancelled) return;

        if (!detail) {
          setReport(null);
          setPurpose(null);
          setCompliance({ kind: 'none' });
          return;
        }

        setReport(detail.report);
        setPurpose(detail.purpose);
        setCompliance(detail.compliance);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load inspection report.';
          setError(message);
          console.error('[useInspectionReport]', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [reportId, tick, ready, myProvince, myUid, myRole]);

  return { report, purpose, compliance, loading, error, refetch };
}
