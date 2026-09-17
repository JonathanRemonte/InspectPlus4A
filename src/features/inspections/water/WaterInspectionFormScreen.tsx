import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { formatEstablishmentLocation } from '../../../utils/establishmentLocation';
import { database, collections } from '../../../db/database';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { generateId } from '../../../utils/crypto';
import { getDeviceId } from '../../../utils/device';
import { nextSyncStateForEdit } from '../../../utils/syncState';
import { EstablishmentPickerStep } from '../components/EstablishmentPickerStep';
import { NewEstablishmentModal } from '../components/NewEstablishmentModal';
import { ReportFormHeader } from '../components/ReportFormHeader';
import { GeneralInformationTab } from '../components/GeneralInformationTab';
import { PurposeOfInspectionTab } from '../components/PurposeOfInspectionTab';
import { DenrPermitsFormSection } from '../components/DenrPermitsFormSection';
import { SaveBar } from '../components/SaveBar';
import { useReportFormState } from '../hooks/useReportFormState';
import { useMainTabChange } from '../hooks/useMainTabChange';
import { createEstablishmentRecord } from '../establishmentPersistence';
import { buildGeneralInfoFromEstablishment, GeneralInfoFormState, PurposeFormState } from '../types';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import {
  emptyWaterComplianceForm,
  nonWwtpTreatmentForSave,
  wwtpDetailForSave,
  wwtpComponentForSave,
  wwtpTypeOtherForSave,
  wwtpConditionOtherForSave,
  wwtpConstructionForSave,
  samplingForSave,
  findingsEntriesForSave,
  previousInspectionForSave,
  WaterComplianceFormState,
} from './waterTypes';
import { buildWaterReportTabs, establishmentHasDischargePermit } from './waterReportTabs';
import type { EstablishmentDTO } from '../../establishments/types';
import { useHeaderScroll } from '../../home/context/HeaderScrollContext';
import { useScreenFooter } from '../../home/context/ScreenFooterContext';
import { AttachmentsSection } from '../../attachments/components/AttachmentsSection';
import { ReportThemeProvider } from '../../../core/providers/ReportThemeProvider';

const REPORT_TYPE = 'water_monitoring';

export interface ShellStart {
  estabId: string | null; // null when creating a brand-new establishment
  initialGeneralInfo: GeneralInfoFormState;
  initialInspectionDate?: string;
  initialPurpose?: PurposeFormState;
  initialControlNumber?: string;
}

export function WaterFormShell({ start }: { start: ShellStart }) {
  const [activeMain, setActiveMain] = useState('geninfo');
  const [waterCompliance, setWaterCompliance] = useState<WaterComplianceFormState>(
    emptyWaterComplianceForm,
  );
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll } = useHeaderScroll();
  const handleMainChange = useMainTabChange(activeMain, setActiveMain, scrollRef);
  // Set on the first save() (silent or explicit) and reused on every save()
  // after that — save() itself updates rather than recreates once it sees
  // a complianceIdRef, matching the create-or-update pattern of save()'s own
  // purpose_of_inspection/inspection_reports rows.
  const complianceIdRef = useRef<string | null>(null);

  const { generalInfo, setGeneralInfo, purpose, setPurpose, saving, save, reportId: draftReportId } =
    useReportFormState({
      estabId: start.estabId,
      initialGeneralInfo: start.initialGeneralInfo,
      initialInspectionDate: start.initialInspectionDate,
      initialPurpose: start.initialPurpose,
      initialControlNumber: start.initialControlNumber,
      reportType: REPORT_TYPE,
    });

  const writeCompliance = useCallback(
    async ({ reportId, isUpdate }: { reportId: string; isUpdate: boolean }) => {
      const fields = {
        reportId,
        waterSources: waterCompliance.waterSources.filter(r => r.source_type?.trim()),
        wastewaterSources: waterCompliance.wastewaterSources.filter(r => r.use_type?.trim()),
        abstractedWaterQuality: waterCompliance.abstractedWaterQuality.filter(r => r.source?.trim()),
        hasWwtp: waterCompliance.hasWwtp === 'yes',
        nonWwtpTreatment: nonWwtpTreatmentForSave(waterCompliance),
        wwtpType: waterCompliance.wwtpType || null,
        wwtpTypeOther: wwtpTypeOtherForSave(waterCompliance.wwtpType, waterCompliance.wwtpTypeOther) || null,
        wwtpDetails: waterCompliance.wwtpDetails.map(d => wwtpDetailForSave(d)),
        wwtpComponents: waterCompliance.wwtpComponents.map(c => wwtpComponentForSave(c)),
        wwtpCondition: waterCompliance.wwtpCondition || null,
        wwtpConditionOther:
          wwtpConditionOtherForSave(waterCompliance.wwtpCondition, waterCompliance.wwtpConditionOther) || null,
        wwtpUnderConstruction: waterCompliance.wwtpUnderConstruction === 'yes',
        ...wwtpConstructionForSave(waterCompliance.wwtpUnderConstruction, waterCompliance),
        ...samplingForSave(
          waterCompliance.samplingConducted,
          waterCompliance.samplingClassification,
          waterCompliance.samplingPoints,
        ),
        previousInspectionSummary: previousInspectionForSave(waterCompliance.previousInspection),
        checklistDao200510: findingsEntriesForSave(waterCompliance.checklistDao200510),
        dpConditions: waterCompliance.dpConditions.filter(c => c.description?.trim()),
        otherObservations: waterCompliance.otherObservations || null,
        remarksRecommendations: waterCompliance.remarksRecommendations || null,
        documentsReviewed: waterCompliance.documentsReviewed,
      } as const;

      if (isUpdate && complianceIdRef.current) {
        const complianceRecord = await collections.complianceWater.find(complianceIdRef.current);
        await complianceRecord.update(rec => {
          Object.assign(rec, fields);
          rec.syncState = nextSyncStateForEdit(rec.syncState);
        });
        return;
      }

      const complianceId = generateId();
      complianceIdRef.current = complianceId;
      await collections.complianceWater.create(rec => {
        rec._raw.id = complianceId;
        rec.complianceId = complianceId;
        Object.assign(rec, fields);
        rec.syncState = 'pending_create';
      });
    },
    [waterCompliance],
  );

  // No Alert, no navigation — used both by the explicit Save Draft/Submit
  // buttons (via handleSave) and silently by ensureDraftReport, which must
  // not interrupt the inspector just because they tapped "Take Photo".
  const performSave = useCallback(
    (status: 'draft' | 'submitted') => save(status, writeCompliance),
    [save, writeCompliance],
  );

  const handleSave = useCallback(
    async (status: 'draft' | 'submitted') => {
      try {
        await performSave(status);

        Alert.alert(
          status === 'draft' ? 'Draft saved' : 'Report submitted',
          status === 'draft'
            ? 'Your water inspection report has been saved as a draft.'
            : 'Your water inspection report has been submitted.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } catch (err) {
        // Alert only ever shows err.message — log the full error (stack
        // included) so it's visible in the Metro/logcat console, since the
        // one-line message alone isn't enough to locate the actual failure.
        console.error('[WaterInspectionFormScreen] Save failed:', err);
        Alert.alert(
          'Save failed',
          err instanceof Error ? err.message : 'Something went wrong while saving this report.',
        );
      }
    },
    [performSave],
  );

  // Passed to AttachmentsSection as ensureParentId: attachments need a real
  // reportId to attach to, so the first photo added during report creation
  // transparently saves the report as a draft first (once — subsequent
  // photos reuse the same reportId already returned here).
  const ensureDraftReport = useCallback(async (): Promise<string> => {
    if (draftReportId) return draftReportId;
    const result = await performSave('draft');
    return result.reportId;
  }, [draftReportId, performSave]);

  // Rendered by AppChrome as a sibling of the collapsing header rather than
  // inline here — see useScreenFooter for why nesting it below the header
  // caused it to visibly lag the collapse/expand animation.
  useScreenFooter(
    () => (
      <SaveBar
        saving={saving}
        onDiscard={() => router.back()}
        onSaveDraft={() => handleSave('draft')}
        onSubmit={() => handleSave('submitted')}
      />
    ),
    [saving, handleSave]
  );

  const hasDp = establishmentHasDischargePermit(generalInfo.denrPermits);
  const tabs = buildWaterReportTabs({ includeAttachments: true });
  const activeMainTab = tabs.find(t => t.key === activeMain) ?? tabs[0];

  return (
    <ReportThemeProvider reportType={REPORT_TYPE}>
      <View style={styles.flex}>
        <ReportFormHeader
          establishmentName={generalInfo.name || 'New Establishment'}
          establishmentLocation={formatEstablishmentLocation(generalInfo)}
          reportType={REPORT_TYPE}
          tabs={tabs}
          activeMain={activeMainTab.key}
          onMainChange={handleMainChange}
        />

        <KeyboardAwareScrollView
          ref={scrollRef as unknown as React.Ref<KeyboardAwareScrollViewRef>}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          bottomOffset={150}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}>
          {activeMainTab.key === 'geninfo' && (
            <GeneralInformationTab value={generalInfo} onChange={setGeneralInfo} estabId={start.estabId} />
          )}
          {activeMainTab.key === 'purpose' && (
            <PurposeOfInspectionTab value={purpose} onChange={setPurpose} />
          )}
          {activeMainTab.key === 'compliance' && (
            <DenrPermitsFormSection
              value={generalInfo.denrPermits}
              onChange={denrPermits => setGeneralInfo({ ...generalInfo, denrPermits })}
            />
          )}
          {(activeMainTab.key === 'watersupply' || activeMainTab.key === 'wastewaterpollution' || activeMainTab.key === 'samplingfindings') && (
            <WaterExtraFormSectionsView
              value={waterCompliance}
              onChange={setWaterCompliance}
              mainTab={activeMainTab}
              hasDp={hasDp}
              province={generalInfo.province}
            />
          )}
          {activeMainTab.key === 'attachments' && (
            <AttachmentsSection
              parentType="inspection"
              parentId={draftReportId ?? undefined}
              ensureParentId={ensureDraftReport}
              canEdit
            />
          )}
        </KeyboardAwareScrollView>
      </View>
    </ReportThemeProvider>
  );
}

export const WaterInspectionFormScreen: React.FC = () => {
  const [start, setStart] = useState<ShellStart | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const { session } = useAuthContext();
  const inspectorUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';

  const handlePickExisting = useCallback((estab: EstablishmentDTO) => {
    setStart({ estabId: estab.estabId, initialGeneralInfo: buildGeneralInfoFromEstablishment(estab) });
  }, []);

  const handleCreateNew = useCallback(
    async (initialGeneralInfo: GeneralInfoFormState, initialInspectionDate: string) => {
      try {
        const estabId = generateId();
        const deviceId = await getDeviceId();
        await database.write(async () => {
          await createEstablishmentRecord({ estabId, inspectorUid, deviceId, generalInfo: initialGeneralInfo });
        });
        setCreatingNew(false);
        setStart({ estabId, initialGeneralInfo, initialInspectionDate });
      } catch (err) {
        console.error('[WaterInspectionFormScreen] Failed to create establishment:', err);
        Alert.alert(
          'Save failed',
          err instanceof Error ? err.message : 'Could not save the establishment. Please try again.',
        );
      }
    },
    [inspectorUid],
  );

  return (
    <View style={styles.flex}>
      {start ? (
        <WaterFormShell start={start} />
      ) : (
        <EstablishmentPickerStep onPick={handlePickExisting} onCreateNew={() => setCreatingNew(true)} />
      )}
      <NewEstablishmentModal
        visible={creatingNew}
        onCancel={() => setCreatingNew(false)}
        onCreate={handleCreateNew}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
