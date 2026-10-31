import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { formatEstablishmentLocation } from '../../../utils/establishmentLocation';
import { ENABLED_TYPES, REPORT_TYPES, ReportTypeKey } from '../../../constants/reportTypes';
import { collections } from '../../../db/database';
import {
  useEstablishment,
  useEstablishmentReports,
  EstablishmentReportItem,
} from '../../establishments/hooks/useEstablishment';
import { TextField, DateField, SelectField, focusInput } from '../../../components/form';
import { AppText } from '../../../components/AppText';
import { PurposeOfInspectionTab } from './PurposeOfInspectionTab';
import {
  GeneralInfoFormState,
  PurposeFormState,
  buildGeneralInfoFromEstablishment,
  buildPurposeFormFromModel,
  emptyPurposeForm,
} from '../types';
import { reportFormFor } from '../../../core/region/lookup';
import type { ShellStart } from '../../../core/region/contract';
import { useHeaderScroll } from '../../home/context/HeaderScrollContext';

interface AddReportSplitPanelProps {
  estabId: string;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PrefilledRowProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  blurOnSubmit?: TextInputProps['blurOnSubmit'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onFocus?: TextInputProps['onFocus'];
}

const PrefilledRow = React.forwardRef<TextInput, PrefilledRowProps>(({
  label,
  value,
  onChangeText,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  onFocus,
}, ref) => (
  <View style={styles.prefilledRow}>
    <Text style={styles.prefilledBadge}>PREFILLED</Text>
    <Text style={styles.prefilledLabel}>{label}</Text>
    <TextInput
      ref={ref}
      style={styles.prefilledInput}
      value={value}
      onChangeText={onChangeText}
      returnKeyType={returnKeyType}
      blurOnSubmit={blurOnSubmit}
      onSubmitEditing={onSubmitEditing}
      onFocus={onFocus}
    />
  </View>
));
PrefilledRow.displayName = 'PrefilledRow';

export const AddReportSplitPanel: React.FC<AddReportSplitPanelProps> = ({ estabId }) => {
  const { establishment, loading, error, refetch } = useEstablishment(estabId);
  const { reports: pastReports, loading: reportsLoading } = useEstablishmentReports(estabId);
  const { onScroll } = useHeaderScroll();

  const [selectedType, setSelectedType] = useState<ReportTypeKey | null>(null);
  const [generalInfo, setGeneralInfo] = useState<GeneralInfoFormState | null>(null);
  const [purpose, setPurpose] = useState<PurposeFormState>(() => emptyPurposeForm(todayISO()));
  const [controlNumber, setControlNumber] = useState('');
  const [purposeMode, setPurposeMode] = useState<'new' | 'reuse'>('new');
  const [reuseSourceLabel, setReuseSourceLabel] = useState('');
  const [reuseLoading, setReuseLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const controlNumberRef = useRef<TextInput>(null);
  const managingHeadRef = useRef<TextInput>(null);
  const pcoNameRef = useRef<TextInput>(null);
  const contactPersonRef = useRef<TextInput>(null);
  const phoneFaxRef = useRef<TextInput>(null);

  useEffect(() => {
    if (establishment && !generalInfo) {
      setGeneralInfo(buildGeneralInfoFromEstablishment(establishment));
    }
  }, [establishment, generalInfo]);

  const reuseChoices = useMemo(
    () =>
      pastReports
        .filter((r): r is EstablishmentReportItem & { purposeId: string } => r.kind === 'inspection' && !!r.purposeId)
        .map(r => ({ label: `${r.title} — ${formatShortDate(r.date)}`, report: r })),
    [pastReports],
  );
  const reuseOptions = useMemo(() => reuseChoices.map(c => c.label), [reuseChoices]);

  const handleSelectReuseSource = useCallback(
    async (label: string) => {
      setReuseSourceLabel(label);
      const choice = reuseChoices.find(c => c.label === label);
      if (!choice) return;
      setReuseLoading(true);
      try {
        const model = await collections.purposeOfInspection.find(choice.report.purposeId);
        setPurpose(buildPurposeFormFromModel(model));
      } catch (err) {
        console.error('[AddReportSplitPanel] Failed to load purpose for reuse:', err);
      } finally {
        setReuseLoading(false);
      }
    },
    [reuseChoices],
  );

  const handleBack = useCallback(() => router.back(), []);
  const handleOpenForm = useCallback(() => setStarted(true), []);

  const FormShell = selectedType ? reportFormFor(selectedType)?.FormShell : undefined;
  if (started && FormShell && generalInfo) {
    const start: ShellStart = {
      estabId,
      initialGeneralInfo: generalInfo,
      initialInspectionDate: purpose.inspectionDate,
      initialPurpose: purpose,
      initialControlNumber: controlNumber,
    };
    return <FormShell start={start} />;
  }

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={Colors.navy} />
        <Text style={styles.stateText}>Loading establishment...</Text>
      </View>
    );
  }

  if (error || !establishment) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.conflict} />
        <Text style={styles.stateText}>{error || 'Establishment not found.'}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={error ? refetch : handleBack}
          activeOpacity={0.8}>
          <Text style={styles.retryText}>{error ? 'Retry' : 'Go Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const location = formatEstablishmentLocation(establishment);
  const selectedMeta = selectedType ? REPORT_TYPES.find(t => t.key === selectedType) ?? null : null;

  return (
    <View style={styles.flex}>
      <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={Colors.navy} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <KeyboardAwareScrollView
        ref={scrollRef as unknown as React.Ref<KeyboardAwareScrollViewRef>}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bottomOffset={150}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        <View style={styles.estabCard}>
          <View style={styles.estabIcon}>
            <Ionicons name="business" size={20} color={Colors.textWhite} />
          </View>
          <View style={styles.estabInfo}>
            <AppText variant="marquee" text={establishment.name} style={styles.estabName} />
            <View style={styles.estabLocationRow}>
              <Text style={styles.estabLocationPin}>📍</Text>
              <AppText
                variant="marquee"
                text={location}
                style={styles.estabLocation}
                containerStyle={styles.estabLocationContainer}
              />
            </View>
          </View>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Step {selectedType ? 2 : 1} of 2</Text>
          </View>
        </View>

        <View style={styles.panels}>
          {/* Left column — report type list */}
          <View style={styles.leftCol}>
            <Text style={styles.colLabel}>REPORT TYPE</Text>
            <View style={styles.typeList}>
              {REPORT_TYPES.map(item => {
                const enabled = ENABLED_TYPES.includes(item.key);
                const isSelected = selectedType === item.key;
                const IconAsset = item.iconAsset;
                return (
                  <TouchableOpacity
                    key={item.key}
                    disabled={!enabled}
                    activeOpacity={0.75}
                    onPress={() => setSelectedType(item.key)}
                    style={[
                      styles.typeRow,
                      {
                        borderLeftColor: isSelected ? item.textColor : 'transparent',
                        backgroundColor: isSelected ? item.bgColor : Colors.white,
                      },
                      !enabled && styles.typeRowDisabled,
                    ]}>
                    <View style={styles.typeIconWrap}>
                      {IconAsset && <IconAsset width={26} height={26} opacity={enabled ? 1 : 0.4} />}
                    </View>
                    <View style={styles.typeTextWrap}>
                      <AppText
                        variant="multiline"
                        text={item.title}
                        style={[styles.typeTitle, !enabled && styles.typeTitleDisabled]}
                      />
                      <Text style={[styles.typeLaw, { color: enabled ? item.textColor : Colors.textLight }]}>
                        {item.law}
                      </Text>
                    </View>
                    {enabled ? (
                      isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: item.textColor }]}>
                          <Ionicons name="checkmark" size={11} color={Colors.textWhite} />
                        </View>
                      )
                    ) : (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonBadgeText}>Soon</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Right column — pre-filled details + purpose of inspection */}
          <View style={styles.rightCol}>
            {!selectedMeta || !generalInfo ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Choose a report type</Text>
                <Text style={styles.emptySub}>The pre-filled details form will appear here.</Text>
              </View>
            ) : (
              <View>
                <View style={styles.selectedHeader}>
                  {selectedMeta.iconAsset && <selectedMeta.iconAsset width={20} height={20} />}
                  <Text style={styles.selectedTitle}>{selectedMeta.title}</Text>
                </View>

                <View style={styles.prefillBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
                  <Text style={styles.prefillBadgeText}>Pre-filled from establishment master record</Text>
                </View>

                <View style={styles.fieldRow}>
                  <DateField
                    label="Inspection Date"
                    value={purpose.inspectionDate}
                    onChange={v => setPurpose({ ...purpose, inspectionDate: v })}
                    required
                    style={styles.fieldHalf}
                  />
                  <TextField
                    ref={controlNumberRef}
                    label="Report Control Number"
                    value={controlNumber}
                    onChangeText={setControlNumber}
                    placeholder="e.g. EMB-2026-XXXXX"
                    style={styles.fieldHalf}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusInput(managingHeadRef.current)}

                  />
                </View>

                <View style={styles.prefilledFields}>
                  <PrefilledRow
                    ref={managingHeadRef}
                    label="Managing Head"
                    value={generalInfo.managingHeadName}
                    onChangeText={v => setGeneralInfo({ ...generalInfo, managingHeadName: v })}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusInput(pcoNameRef.current)}

                  />
                  <PrefilledRow
                    ref={pcoNameRef}
                    label="PCO Name"
                    value={generalInfo.pcoName}
                    onChangeText={v => setGeneralInfo({ ...generalInfo, pcoName: v })}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusInput(contactPersonRef.current)}

                  />
                  <PrefilledRow
                    ref={contactPersonRef}
                    label="Contact Person"
                    value={generalInfo.contactPersonName}
                    onChangeText={v => setGeneralInfo({ ...generalInfo, contactPersonName: v })}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusInput(phoneFaxRef.current)}

                  />
                  <PrefilledRow
                    ref={phoneFaxRef}
                    label="Phone / Fax"
                    value={generalInfo.phoneFax}
                    onChangeText={v => setGeneralInfo({ ...generalInfo, phoneFax: v })}
                    returnKeyType="done"

                  />
                </View>
                <Text style={styles.prefillNote}>
                  Editable here — full detail lives in the General Information tab once the report opens.
                </Text>

                <View style={styles.purposeHeader}>
                  <Text style={styles.purposeHeaderTitle}>Purpose of Inspection</Text>
                  <View style={styles.purposeModeRow}>
                    <TouchableOpacity
                      style={[styles.purposeModeBtn, purposeMode === 'new' && styles.purposeModeBtnActive]}
                      onPress={() => setPurposeMode('new')}
                      activeOpacity={0.75}>
                      <Text
                        style={[
                          styles.purposeModeBtnText,
                          purposeMode === 'new' && styles.purposeModeBtnTextActive,
                        ]}>
                        Start New
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.purposeModeBtn, purposeMode === 'reuse' && styles.purposeModeBtnActive]}
                      onPress={() => setPurposeMode('reuse')}
                      activeOpacity={0.75}>
                      <Text
                        style={[
                          styles.purposeModeBtnText,
                          purposeMode === 'reuse' && styles.purposeModeBtnTextActive,
                        ]}>
                        Reuse Existing
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {purposeMode === 'reuse' && (
                  <View style={styles.reuseWrap}>
                    {reportsLoading ? (
                      <View style={styles.reuseLoadingRow}>
                        <ActivityIndicator size="small" color={Colors.navy} />
                        <Text style={styles.reuseLoadingText}>Loading establishment history...</Text>
                      </View>
                    ) : reuseOptions.length === 0 ? (
                      <Text style={styles.noReuseText}>No past reports yet for this establishment.</Text>
                    ) : (
                      <>
                        <SelectField
                          label="Copy purpose from"
                          value={reuseSourceLabel}
                          options={reuseOptions}
                          onSelect={handleSelectReuseSource}
                          placeholder="Select a past report…"
                        />
                        {reuseLoading && <ActivityIndicator size="small" color={Colors.navy} />}
                        {!reuseLoading && reuseSourceLabel !== '' && (
                          <View style={styles.reuseConfirm}>
                            <Ionicons name="checkmark" size={12} color={Colors.green} />
                            <Text style={styles.reuseConfirmText}>
                              Purpose of inspection copied from {reuseSourceLabel}.
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}

                <PurposeOfInspectionTab value={purpose} onChange={setPurpose} />

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleBack} activeOpacity={0.8}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.openBtn, { backgroundColor: selectedMeta.textColor }]}
                    onPress={handleOpenForm}
                    activeOpacity={0.8}>
                    <Text style={styles.openBtnText}>Open {selectedMeta.title} Form →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.navy,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
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
  estabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  estabIcon: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  estabInfo: {
    flex: 1,
    minWidth: 0,
  },
  estabName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  estabLocation: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  estabLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  estabLocationPin: {
    fontSize: 11.5,
  },
  estabLocationContainer: {
    flex: 1,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  stepPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.navy,
  },
  panels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  leftCol: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 220,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.textLight,
    marginBottom: 10,
  },
  typeList: {
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  typeRowDisabled: {
    opacity: 0.55,
  },
  typeIconWrap: {
    width: 26,
    height: 26,
    flexShrink: 0,
  },
  typeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  typeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 15,
  },
  typeTitleDisabled: {
    color: Colors.textMuted,
  },
  typeLaw: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  soonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.bgLight,
    flexShrink: 0,
  },
  soonBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  rightCol: {
    flexGrow: 2,
    flexBasis: 260,
    minWidth: 260,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 11.5,
    color: Colors.textLight,
    textAlign: 'center',
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  prefillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
  },
  prefillBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#14532d',
    flexShrink: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  fieldHalf: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 160,
  },
  prefilledFields: {
    gap: 8,
    marginBottom: 4,
  },
  prefilledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
  },
  prefilledBadge: {
    fontSize: 8.5,
    fontWeight: '800',
    color: Colors.green,
    backgroundColor: Colors.greenMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexShrink: 0,
  },
  prefilledLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textLight,
    width: 88,
    flexShrink: 0,
  },
  prefilledInput: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.textPrimary,
    padding: 0,
    minWidth: 0,
  },
  prefillNote: {
    fontSize: 10.5,
    color: Colors.textLight,
    marginTop: 10,
    marginBottom: 16,
  },
  purposeHeader: {
    marginBottom: 10,
  },
  purposeHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  purposeModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  purposeModeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  purposeModeBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  purposeModeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  purposeModeBtnTextActive: {
    color: Colors.textWhite,
  },
  reuseWrap: {
    marginBottom: 8,
  },
  reuseLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  reuseLoadingText: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  noReuseText: {
    fontSize: 11.5,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  reuseConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: -6,
    marginBottom: 8,
  },
  reuseConfirmText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#14532d',
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: Colors.bgLight,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  openBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9,
  },
  openBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});
