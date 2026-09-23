import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { formatEstablishmentLocation } from '../../../utils/establishmentLocation';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { useInspectionReport } from '../hooks/useInspectionReport';
import { useMainTabChange } from '../hooks/useMainTabChange';
import { deleteInspectionReportRecord } from '../reportPersistence';
import { INSPECTION_TYPE_LABELS, canManageAllRecords, useEstablishment } from '../../establishments/hooks/useEstablishment';
import { InspectionReportHeader, DEFAULT_REPORT_DETAIL_TABS } from './InspectionReportHeader';
import { GeneralInformationView } from './GeneralInformationView';
import { PurposeOfInspectionView } from './PurposeOfInspectionView';
import { ComplianceStatusView } from './ComplianceStatusView';
import { DenrPermitsSection } from './DenrPermitsSection';
import { useHeaderScroll } from '../../home/context/HeaderScrollContext';
import { WaterExtraSectionsView } from '../water/WaterComplianceEditSections';
import { ReportThemeProvider } from '../../../core/providers/ReportThemeProvider';
import { buildWaterReportTabs, establishmentHasDischargePermit } from '../water/waterReportTabs';
import { AttachmentsSection } from '../../attachments/components/AttachmentsSection';

const WATER_REPORT_TYPE = 'water_monitoring';

interface InspectionReportDetailScreenProps {
  reportId: string;
}

export const InspectionReportDetailScreen: React.FC<InspectionReportDetailScreenProps> = ({ reportId }) => {
  const [activeMain, setActiveMain] = useState('geninfo');
  const [noteBarDismissed, setNoteBarDismissed] = useState(false);
  const { report, purpose, compliance, loading, error, refetch } = useInspectionReport(reportId);
  // Loaded independently of `report.establishmentSnapshot` — that's a
  // point-in-time copy, while this reflects the establishments row as it
  // stands right now, so GeneralInformationView can flag where they've
  // drifted apart instead of the two silently going out of sync.
  const { establishment: liveEstablishment, loading: liveEstablishmentLoading } = useEstablishment(report?.estabId);
  const scrollRef = useRef<ScrollView>(null);
  // Same onScroll every other screen uses (see HeaderScrollContext) — the
  // card fully collapses or expands once scroll crosses one of two fixed
  // offset thresholds, animated as a single bounded transition rather than
  // tracked continuously (continuous per-frame updates forced a layout pass
  // on every scroll frame, which was expensive enough to drop frames).
  const { collapsed, onScroll } = useHeaderScroll();
  const handleMainChange = useMainTabChange(activeMain, setActiveMain, scrollRef);
  const { session, role } = useAuthContext();
  const currentUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  // Developer accounts get unrestricted write access — including editing
  // submitted reports and reports they don't own — see canManageAllRecords.
  const isDeveloper = canManageAllRecords(role ?? '');

  // Only the inspector who created the report can edit it, and only while
  // it's still a draft — jurisdiction-visible reports from other inspectors
  // (or a report that's already been submitted) render read-only, unless
  // the current user is a Developer. See SectionEditActions.
  const canEdit =
    !!report && (isDeveloper || (report.inspectorUid === currentUid && report.reportStatus === 'draft'));

  // Delete, unlike edit, isn't restricted to drafts — matches the "own
  // record" delete RLS policy on the backend, which only checks ownership.
  const handleDelete = useCallback(async () => {
    if (!report) return;
    const choice = await showPrompt({
      title: 'Delete report?',
      message: `This ${INSPECTION_TYPE_LABELS[report.reportType] ?? report.reportType} report will be removed.`,
      tone: 'danger',
      actions: [
        { id: 'cancel', label: 'Cancel', variant: 'cancel' },
        { id: 'delete', label: 'Delete', variant: 'danger' },
      ],
    });
    if (choice !== 'delete') return;
try {
          await deleteInspectionReportRecord(report.reportId);
          router.back();
        } catch (err) {
          console.error('[InspectionReportDetailScreen] Failed to delete report:', err);
          void showPrompt({ title: 'Delete failed', message: err instanceof Error ? err.message : 'Something went wrong.', tone: 'danger' });
        }
  }, [report]);

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={Colors.navy} />
        <Text style={styles.stateText}>Loading inspection report...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.conflict} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="document-outline" size={40} color={Colors.border} />
        <Text style={styles.stateText}>Inspection report not found.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // From the report's own snapshot rather than the live establishment, so a
  // report keeps showing the address as it stood when it was filed. Snapshot
  // keys are snake_case, hence the mapping into the shared formatter.
  const location = formatEstablishmentLocation({
    addressLine: report.establishmentSnapshot.address_line,
    barangay: report.establishmentSnapshot.barangay,
    city: report.establishmentSnapshot.city,
    province: report.establishmentSnapshot.province,
  });

  // Water reports get the full 1-6 section/subsection tab menu from the
  // report template; every other report kind keeps the original 3-tab
  // layout — see waterReportTabs.ts and DEFAULT_REPORT_DETAIL_TABS.
  const isWater = report.reportType === WATER_REPORT_TYPE;
  const hasDp = establishmentHasDischargePermit(report.permitsSnapshot);
  const waterTabs = buildWaterReportTabs({ includeAttachments: true });
  const tabs = isWater ? waterTabs : DEFAULT_REPORT_DETAIL_TABS;
  const activeMainTab = tabs.find(t => t.key === activeMain) ?? tabs[0];
  const activeWaterMainTab = waterTabs.find(t => t.key === activeMain) ?? waterTabs[0];

  return (
    <ReportThemeProvider reportType={report.reportType}>
      <View style={styles.flex}>
        <InspectionReportHeader
          reportId={reportId}
          establishmentName={report.establishmentSnapshot.name}
          establishmentLocation={location}
          reportType={report.reportType}
          reportControlNo={report.reportControlNo}
          inspectionDate={report.inspectionDate}
          reportStatus={report.reportStatus}
          syncStatus={report.syncStatus}
          inspectorUid={report.inspectorUid}
          tabs={tabs}
          activeMain={activeMainTab.key}
          onMainChange={handleMainChange}
          onBack={() => router.back()}
          onDelete={handleDelete}
          collapsed={collapsed}
        />

        {!noteBarDismissed && (
          <View style={styles.noteBar}>
            <Ionicons name="information-circle-outline" size={13} color={Colors.navy} />
            <Text style={styles.noteText}>
              {canEdit ? (
                <>
                  Use <Text style={styles.noteTextStrong}>Edit</Text> on any section below to make changes, then{' '}
                  <Text style={styles.noteTextStrong}>Save</Text> to update just that section.
                </>
              ) : (
                <>
                  This report is <Text style={styles.noteTextStrong}>view only</Text> — only the inspector who
                  created it can make changes{report.reportStatus === 'submitted' ? ', and it has already been submitted' : ''}.
                </>
              )}
            </Text>
            <TouchableOpacity
              onPress={() => setNoteBarDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}>
              <Ionicons name="close" size={14} color={Colors.navy} />
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAwareScrollView
          ref={scrollRef as unknown as React.Ref<KeyboardAwareScrollViewRef>}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bottomOffset={150}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}>
          {activeMainTab.key === 'geninfo' && (
            <GeneralInformationView
              reportId={report.reportId}
              snapshot={report.establishmentSnapshot}
              permits={report.permitsSnapshot}
              canEdit={canEdit}
              onSaved={refetch}
              liveEstablishment={liveEstablishment}
              liveEstablishmentLoading={liveEstablishmentLoading}
              showPermits={!isWater}
            />
          )}
          {activeMainTab.key === 'purpose' &&
            (purpose ? (
              <PurposeOfInspectionView
                purposeId={report.purposeId}
                value={purpose}
                canEdit={canEdit}
                onSaved={refetch}
              />
            ) : (
              <Text style={styles.stateText}>No purpose of inspection recorded for this report.</Text>
            ))}
          {activeMainTab.key === 'compliance' &&
            (isWater ? (
              <DenrPermitsSection
                reportId={report.reportId}
                permits={report.permitsSnapshot}
                canEdit={canEdit}
                onSaved={refetch}
              />
            ) : (
              <ComplianceStatusView compliance={compliance} />
            ))}
          {isWater && compliance.kind === 'water' && (activeMainTab.key === 'watersupply' || activeMainTab.key === 'wastewaterpollution' || activeMainTab.key === 'samplingfindings') && (
            <WaterExtraSectionsView
              compliance={compliance}
              canEdit={canEdit}
              onSaved={refetch}
              mainTab={activeWaterMainTab}
              hasDp={hasDp}
              province={report.establishmentSnapshot.province}
            />
          )}
          {activeMainTab.key === 'attachments' && (
            <AttachmentsSection parentType="inspection" parentId={report.reportId} canEdit={canEdit} />
          )}
        </KeyboardAwareScrollView>
      </View>
    </ReportThemeProvider>
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
  noteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: '#1e40af',
  },
  noteTextStrong: {
    fontWeight: '700',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  stateText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.navy,
    borderRadius: 8,
    marginTop: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});
