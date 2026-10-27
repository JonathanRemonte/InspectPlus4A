import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { database, collections } from '../../../db/database';
import {
  FormSection,
  TextField,
  SelectField,
  ComboInput,
  DateField,
  TimeField,
  RadioGroup,
  DynamicRowTable,
  ChecklistTable,
  YesNoNAToggle,
  CheckboxRow,
  focusInput,
} from '../../../components/form';
import type { DynamicRow, ChecklistValue } from '../../../components/form';
import { AddRowButton } from '../../../components/AddRowButton';
import { SectionEditActions } from '../components/SectionEditActions';
import { useEditableSection } from '../hooks/useEditableSection';
import {
  SimpleTable,
  DetailCard,
  ChecklistList,
  ConditionsList,
  DocumentsChips,
  YnBadge,
  styles as sharedStyles,
} from '../components/ComplianceReadPrimitives';
import type { WaterComplianceView as WaterComplianceData } from '../hooks/useInspectionReport';
import {
  WATER_FINDINGS_CHECKLIST,
  DOCUMENTS_REVIEWED_OPTIONS,
  WATER_SOURCE_TYPES,
  WASTEWATER_USE_TYPES,
  ABSTRACTED_WATER_SOURCES,
  abstractedWaterSourceSpecifics,
  NON_WWTP_TREATMENT_OPTIONS,
  NON_WWTP_TREATMENT_OTHERS,
  NON_WWTP_TREATMENT_PROMPT,
  NON_WWTP_TREATMENT_OTHER_LABEL,
  PRIMARY_TREATMENT_OPTIONS,
  BIOLOGICAL_TREATMENT_OPTIONS,
  CHEMICAL_TREATMENT_OPTIONS,
  WWTP_TYPE_OPTIONS,
  WWTP_TYPE_OTHERS,
  WWTP_CONDITION_OPTIONS,
  WWTP_CONDITION_OTHERS,
  SAMPLING_CLASSIFICATION_OPTIONS,
  WATER_QUALITY_PARAMETERS,
} from './waterChecklistData';
import { TreatmentCheckboxGroup } from './TreatmentCheckboxGroup';
import {
  WwtpDetailCard,
  WwtpComponentCard,
  SamplingPointCard,
  SamplingParameterRow,
  DpConditionRow,
  PreviousInspectionState,
  emptyWwtpDetail,
  emptyWwtpComponent,
  emptySamplingPoint,
  emptySamplingParameter,
  emptyDpCondition,
  nonWwtpTreatmentFor,
  describeNonWwtpTreatment,
  decodeReceivingBodyOfWater,
  wwtpDetailForSave,
  describeReceivingBodyOfWater,
  decodeWwtpComponent,
  wwtpComponentForSave,
  describeTreatment,
  wwtpTypeOtherForSave,
  describeWwtpType,
  wwtpConditionOtherForSave,
  describeWwtpCondition,
  wwtpConstructionForSave,
  samplingForSave,
  describeSampling,
  findingsEntriesForSave,
  findingsValuesFromEntries,
  StoredFindingsEntry,
  previousInspectionForSave,
} from './waterTypes';
import type { ComplianceWater } from '../../../region/db';
import type { WaterMainTabDef } from './waterReportTabs';
import { getWaterbodyGroups, WATERBODY_NOT_LISTED } from '../../../constants/waterbodies';

const YES_NO = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

async function patchComplianceWater(complianceId: string, patch: Partial<ComplianceWater>) {
  await database.write(async () => {
    const rec = await collections.complianceWater.find(complianceId);
    await rec.update(r => {
      Object.assign(r, patch);
      r.syncState = 'pending_update';
    });
  });
}

// ── Water Sources ───────────────────────────────────────────────────────────

export const WaterSourcesSection: React.FC<{
  complianceId: string;
  value: DynamicRow[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const section = useEditableSection<DynamicRow[]>({
    value,
    onSave: async rows => {
      await patchComplianceWater(complianceId, {
        waterSources: rows.filter(r => r.source_type?.trim()),
      });
      onSaved();
    },
  });

  return (
    <FormSection
      icon="water-outline"
      title="A. Water Sources"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <DynamicRowTable
          columns={[
            { key: 'source_type', label: 'Source Type', width: 140, type: 'select', options: WATER_SOURCE_TYPES },
            { key: 'daily_m3', label: 'Daily Volume (m³)', width: 100, type: 'number', placeholder: '0' },
            { key: 'annual_m3', label: 'Annual Volume (m³)', width: 100, type: 'number', placeholder: '0' },
            { key: 'specify', label: 'Specify', width: 140, placeholder: 'Details' },
          ]}
          rows={section.draft}
          onChange={rows => section.setDraft(rows)}
          addLabel="Add Water Source"
        />
      ) : (
        <SimpleTable
          columns={[
            { key: 'source_type', label: 'Source Type' },
            { key: 'daily_m3', label: 'Daily (m³)' },
            { key: 'annual_m3', label: 'Annual (m³)' },
            { key: 'specify', label: 'Specify' },
          ]}
          rows={section.draft}
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Wastewater Sources ──────────────────────────────────────────────────────

export const WastewaterSourcesSection: React.FC<{
  complianceId: string;
  value: DynamicRow[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const section = useEditableSection<DynamicRow[]>({
    value,
    onSave: async rows => {
      await patchComplianceWater(complianceId, {
        wastewaterSources: rows.filter(r => r.use_type?.trim()),
      });
      onSaved();
    },
  });

  return (
    <FormSection
      icon="funnel-outline"
      title="B. Wastewater Sources"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <DynamicRowTable
          columns={[
            { key: 'use_type', label: 'Use Type', width: 130, type: 'select', options: WASTEWATER_USE_TYPES },
            { key: 'consumed_m3_day', label: 'Consumed (m³/day)', width: 110, type: 'number', placeholder: '0' },
            { key: 'generated_m3_day', label: 'Generated (m³/day)', width: 110, type: 'number', placeholder: '0' },
            { key: 'outlet_info', label: 'Outlet Info', width: 150, placeholder: 'Outlet No./Location' },
          ]}
          rows={section.draft}
          onChange={rows => section.setDraft(rows)}
          addLabel="Add Wastewater Source"
        />
      ) : (
        <SimpleTable
          columns={[
            { key: 'use_type', label: 'Use Type' },
            { key: 'consumed_m3_day', label: 'Consumed (m³/day)' },
            { key: 'generated_m3_day', label: 'Generated (m³/day)' },
            { key: 'outlet_info', label: 'Outlet Info' },
          ]}
          rows={section.draft}
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Abstracted Water Quality ─────────────────────────────────────────────────

export const AbstractedWaterQualitySection: React.FC<{
  complianceId: string;
  value: DynamicRow[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const section = useEditableSection<DynamicRow[]>({
    value,
    onSave: async rows => {
      await patchComplianceWater(complianceId, {
        abstractedWaterQuality: rows.filter(r => r.source?.trim()),
      });
      onSaved();
    },
  });

  return (
    <FormSection
      icon="flask-outline"
      title="C. Quality of Abstracted Water"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <DynamicRowTable
          columns={[
            // Combo, not select: the two lists cover the sources this office
            // actually samples, but an inspector who meets one they don't
            // name still has to be able to write it down.
            { key: 'source', label: 'Source', width: 130, type: 'combo', options: ABSTRACTED_WATER_SOURCES, placeholder: 'Select' },
            {
              key: 'specify',
              label: 'Specify',
              width: 130,
              type: 'combo',
              dependsOn: 'source',
              options: abstractedWaterSourceSpecifics,
              placeholder: 'Select',
            },
            { key: 'bod_cod', label: 'BOD/COD', width: 90, placeholder: 'mg/L' },
            { key: 'tss', label: 'TSS', width: 80, placeholder: 'mg/L' },
            { key: 'avfp', label: 'AVFP', width: 80, placeholder: 'mg/L' },
            { key: 'heavy_metal', label: 'Heavy Metal', width: 110, placeholder: 'mg/L' },
          ]}
          rows={section.draft}
          onChange={rows => section.setDraft(rows)}
          addLabel="Add Water Quality Entry"
        />
      ) : (
        <SimpleTable
          columns={[
            { key: 'source', label: 'Source' },
            { key: 'specify', label: 'Specify' },
            { key: 'bod_cod', label: 'BOD/COD' },
            { key: 'tss', label: 'TSS' },
            { key: 'heavy_metal', label: 'Heavy Metal' },
          ]}
          rows={section.draft}
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Wastewater Treatment Plant (WWTP) — split into its 5 template
// subsections (5A-5E), each independently editable/savable, matching the
// per-subsection tab navigation. See waterReportTabs.ts. Subsections B-E
// describe the WWTP itself, so once 5A records no WWTP on site they're
// read-only "doesn't apply" remarks instead of editable content.

export const WwtpUnavailableSection: React.FC<{ title: string }> = ({ title }) => (
  <FormSection icon="business-outline" title={title}>
    <Text style={sharedStyles.emptyText}>No WWTP on record for this establishment — this doesn't apply.</Text>
  </FormSection>
);

// The WWTP question and the treatment systems that answer *replaces* are
// one section because they are one decision: 5A asks what treats this
// establishment's wastewater, and "a WWTP" and "a septic tank" are two
// answers to it. Editing them together also lets the draft hold both while
// an inspector changes their mind, with only the save narrowing it - see
// nonWwtpTreatmentFor.
interface TreatmentSystemDraft {
  hasWwtp: boolean | null;
  systems: string[];
  other: string;
}

export const TreatmentSystemTypeSection: React.FC<{
  complianceId: string;
  hasWwtp: boolean | null;
  nonWwtpTreatment: Record<string, unknown>;
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, hasWwtp, nonWwtpTreatment, canEdit, onSaved }) => {
  const section = useEditableSection<TreatmentSystemDraft>({
    value: {
      hasWwtp,
      systems: Array.isArray(nonWwtpTreatment.systems) ? (nonWwtpTreatment.systems as string[]) : [],
      other: typeof nonWwtpTreatment.other === 'string' ? nonWwtpTreatment.other : '',
    },
    onSave: async draft => {
      await patchComplianceWater(complianceId, {
        hasWwtp: draft.hasWwtp,
        nonWwtpTreatment: nonWwtpTreatmentFor(draft.hasWwtp === false, draft.systems, draft.other),
      });
      onSaved();
    },
  });

  const toggleSystem = (option: string) =>
    section.setDraft(prev => ({
      ...prev,
      systems: prev.systems.includes(option)
        ? prev.systems.filter(s => s !== option)
        : [...prev.systems, option],
    }));

  return (
    <FormSection
      icon="construct-outline"
      title="A. Type of Wastewater Treatment System"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <RadioGroup
          label="Has WWTP?"
          options={YES_NO}
          value={section.draft.hasWwtp == null ? null : section.draft.hasWwtp ? 'yes' : 'no'}
          onChange={v => section.setDraft(prev => ({ ...prev, hasWwtp: v === 'yes' }))}
        />
      ) : (
        <TextField
          label="Has WWTP?"
          value={section.draft.hasWwtp == null ? '—' : section.draft.hasWwtp ? 'Yes' : 'No'}
          readOnly
        />
      )}
      {section.draft.hasWwtp === false && (
        <>
          {section.editing ? (
            <>
              <Text style={styles.fieldLabel}>{NON_WWTP_TREATMENT_PROMPT}</Text>
              {NON_WWTP_TREATMENT_OPTIONS.map(option => (
                <CheckboxRow
                  key={option}
                  label={option}
                  checked={section.draft.systems.includes(option)}
                  onToggle={() => toggleSystem(option)}
                />
              ))}
              {section.draft.systems.includes(NON_WWTP_TREATMENT_OTHERS) && (
                <TextField
                  label={NON_WWTP_TREATMENT_OTHER_LABEL}
                  value={section.draft.other}
                  onChangeText={t => section.setDraft(prev => ({ ...prev, other: t }))}
                  placeholder="e.g. Grease trap"
                />
              )}
            </>
          ) : (
            <TextField
              label="Treatment System"
              value={describeNonWwtpTreatment(section.draft.systems, section.draft.other)}
              readOnly
            />
          )}
          {/* Last, not first - see the matching note on the create form. */}
          <Text style={sharedStyles.emptyText}>Subsections B-E are marked as not applicable.</Text>
        </>
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

export const WwtpTypeSection: React.FC<{
  complianceId: string;
  value: string | null;
  otherValue: string | null;
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, otherValue, canEdit, onSaved }) => {
  const section = useEditableSection<{ wwtpType: string; wwtpTypeOther: string }>({
    value: { wwtpType: value || '', wwtpTypeOther: otherValue || '' },
    onSave: async draft => {
      await patchComplianceWater(complianceId, {
        wwtpType: draft.wwtpType || null,
        wwtpTypeOther: wwtpTypeOtherForSave(draft.wwtpType, draft.wwtpTypeOther) || null,
      });
      onSaved();
    },
  });

  return (
    <FormSection
      icon="business-outline"
      title="B. Type of WWTP"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <>
          <SelectField
            label="WWTP Type"
            value={section.draft.wwtpType}
            options={WWTP_TYPE_OPTIONS}
            onSelect={v => section.setDraft({ ...section.draft, wwtpType: v })}
          />
          {section.draft.wwtpType === WWTP_TYPE_OTHERS && (
            <TextField
              label="Specify the type of WWTP"
              value={section.draft.wwtpTypeOther}
              onChangeText={t => section.setDraft({ ...section.draft, wwtpTypeOther: t })}
              placeholder="e.g. Membrane bioreactor"
              returnKeyType="done"
            />
          )}
        </>
      ) : (
        <TextField
          label="WWTP Type"
          value={describeWwtpType(section.draft.wwtpType, section.draft.wwtpTypeOther)}
          readOnly
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

export const WwtpDetailsSection: React.FC<{
  complianceId: string;
  value: WwtpDetailCard[];
  canEdit: boolean;
  onSaved: () => void;
  province: string;
}> = ({ complianceId, value, canEdit, onSaved, province }) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  const section = useEditableSection<WwtpDetailCard[]>({
    // A stored row holds one string; the form needs it split into the
    // dropdown's selection and the specify box beside it.
    value: value.map(d => {
      const { selection, other } = decodeReceivingBodyOfWater(d.receivingBodyOfWater, province);
      return { ...d, receivingBodyOfWater: selection, receivingBodyOfWaterOther: other };
    }),
    onSave: async wwtpDetails => {
      await patchComplianceWater(complianceId, {
        wwtpDetails: wwtpDetails.map(d => wwtpDetailForSave(d)),
      });
      onSaved();
    },
  });

  // The escape hatch is its own trailing group, never folded into an EMB
  // classification heading, and filing it under one would read as though
  // "Not listed (specify)" were itself a classified waterbody.
  // getWaterbodyGroups returns the bundled dataset's own arrays, so we
  // spread into a new outer array rather than pushing into any of its
  // groups' option arrays.
  const waterbodyGroups = React.useMemo(
    () => [
      ...getWaterbodyGroups(province),
      { label: 'Not on the list', options: [WATERBODY_NOT_LISTED] },
    ],
    [province],
  );

  const updateDetail = (i: number, patch: Partial<WwtpDetailCard>) => {
    const rows = section.draft.slice();
    rows[i] = { ...rows[i], ...patch };
    section.setDraft(rows);
  };
  const removeDetail = (i: number) => section.setDraft(section.draft.filter((_, idx) => idx !== i));
  const addDetail = () => section.setDraft([...section.draft, emptyWwtpDetail(String(section.draft.length + 1))]);

  return (
    <FormSection
      icon="list-outline"
      title="C. WWTP Details"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      <Text style={sharedStyles.subTitle}>WWTP Details (per outlet)</Text>
      {section.draft.length === 0 && !section.editing && (
        <Text style={sharedStyles.emptyText}>No WWTP outlet details recorded.</Text>
      )}
      {section.draft.map((d, i) => {
        const k = (field: string) => `wwtpDetail:${i}:${field}`;
        return section.editing ? (
          <View key={i} style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Outlet {d.outletNo}</Text>
              <TouchableOpacity onPress={() => removeDetail(i)}>
                <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TextField
                ref={setRef(k('outletNo'))}
                label="Outlet No."
                value={d.outletNo}
                onChangeText={t => updateDetail(i, { outletNo: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('wwtpDetail'))}

              />
              <TextField
                ref={setRef(k('wwtpDetail'))}
                label="WWTP Detail"
                value={d.wwtpDetail}
                onChangeText={t => updateDetail(i, { wwtpDetail: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('dateOfInstallation'))}

              />
            </View>
            <View style={styles.row}>
              <DateField
                ref={setRef(k('dateOfInstallation'))}
                label="Date of Installation"
                value={d.dateOfInstallation}
                onChange={t => updateDetail(i, { dateOfInstallation: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('designCapacity'))}

              />
              <TextField
                ref={setRef(k('designCapacity'))}
                label="Design Capacity"
                value={d.designCapacity}
                onChangeText={t => updateDetail(i, { designCapacity: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('annualMaintenanceCost'))}

              />
            </View>
            <View style={styles.row}>
              <TextField
                ref={setRef(k('annualMaintenanceCost'))}
                label="Annual Maintenance Cost"
                value={d.annualMaintenanceCost}
                onChangeText={t => updateDetail(i, { annualMaintenanceCost: t })}
                keyboardType="numeric"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('outletLocation'))}

              />
              <TextField
                ref={setRef(k('outletLocation'))}
                label="Outlet Location"
                value={d.outletLocation}
                onChangeText={t => updateDetail(i, { outletLocation: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('flowMeterDevice'))}

              />
            </View>
            <View style={styles.row}>
              <SelectField
                label="Receiving Body of Water (Water Classification)"
                value={d.receivingBodyOfWater}
                groups={waterbodyGroups}
                onSelect={v => updateDetail(i, { receivingBodyOfWater: v })}
              />
              <TextField
                ref={setRef(k('flowMeterDevice'))}
                label="Flow Meter Device"
                value={d.flowMeterDevice}
                onChangeText={t => updateDetail(i, { flowMeterDevice: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('flowRate'))}

              />
            </View>
            {d.receivingBodyOfWater === WATERBODY_NOT_LISTED && (
              <View style={styles.row}>
                <TextField
                  ref={setRef(k('receivingBodyOfWaterOther'))}
                  label="Specify"
                  value={d.receivingBodyOfWaterOther}
                  onChangeText={t => updateDetail(i, { receivingBodyOfWaterOther: t })}
                  placeholder="e.g. Sapa Creek"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => focus(k('flowRate'))}
                />
              </View>
            )}
            <View style={styles.row}>
              <TextField
                ref={setRef(k('flowRate'))}
                label="Flow Rate"
                value={d.flowRate}
                onChangeText={t => updateDetail(i, { flowRate: t })}
                returnKeyType="done"

              />
            </View>
          </View>
        ) : (
          <DetailCard
            key={i}
            title={`Outlet ${d.outletNo}`}
            fields={[
              { label: 'WWTP Detail', value: d.wwtpDetail },
              { label: 'Date of Installation', value: d.dateOfInstallation },
              { label: 'Design Capacity', value: d.designCapacity },
              { label: 'Annual Maintenance Cost', value: d.annualMaintenanceCost },
              { label: 'Outlet Location', value: d.outletLocation },
              { label: 'Receiving Body of Water (Water Classification)', value: describeReceivingBodyOfWater(d) },
              { label: 'Flow Meter Device', value: d.flowMeterDevice },
              { label: 'Flow Rate', value: d.flowRate },
            ]}
          />
        );
      })}
      {section.editing && <AddRowButton style={styles.addBtn} label="Add WWTP Outlet Detail" onPress={addDetail} />}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// `value` arrives as stored JSON rather than WwtpComponentCard[]: rows
// written before section 5D became checkboxes hold a comma-separated string
// where each treatment array now is, so the shape is only settled once
// decodeWwtpComponent has read it.
export const WwtpComponentsSection: React.FC<{
  complianceId: string;
  value: Record<string, unknown>[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  const section = useEditableSection<WwtpComponentCard[]>({
    // Rows written by an older build hold comma-separated strings where the
    // arrays now are; decodeWwtpComponent reads both shapes.
    value: value.map(c => decodeWwtpComponent(c)),
    onSave: async wwtpComponents => {
      await patchComplianceWater(complianceId, {
        wwtpComponents: wwtpComponents.map(c => wwtpComponentForSave(c)),
      });
      onSaved();
    },
  });

  const updateComponent = (i: number, patch: Partial<WwtpComponentCard>) => {
    const rows = section.draft.slice();
    rows[i] = { ...rows[i], ...patch };
    section.setDraft(rows);
  };
  const removeComponent = (i: number) => section.setDraft(section.draft.filter((_, idx) => idx !== i));
  const addComponent = () => section.setDraft([...section.draft, emptyWwtpComponent(String(section.draft.length + 1))]);

  return (
    <FormSection
      icon="layers-outline"
      title="D. Components of the WWTP"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      <Text style={sharedStyles.subTitle}>WWTP Treatment Components (per outlet)</Text>
      {section.draft.length === 0 && !section.editing && (
        <Text style={sharedStyles.emptyText}>No treatment components recorded.</Text>
      )}
      {section.draft.map((c, i) => {
        const k = (field: string) => `wwtpComponent:${i}:${field}`;
        return section.editing ? (
          <View key={i} style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Outlet {c.outletNo}</Text>
              <TouchableOpacity onPress={() => removeComponent(i)}>
                <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TextField
                ref={setRef(k('outletNo'))}
                label="Outlet No."
                value={c.outletNo}
                onChangeText={t => updateComponent(i, { outletNo: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('wwtp'))}

              />
              {/* Chain ends here: what follows is checkbox groups, not text,
                  so there is nothing left for "next" to reach. */}
              <TextField
                ref={setRef(k('wwtp'))}
                label="WWTP"
                value={c.wwtp}
                onChangeText={t => updateComponent(i, { wwtp: t })}
                placeholder="e.g. Septic Tank"
                returnKeyType="done"

              />
            </View>
            <TreatmentCheckboxGroup
              label="Primary"
              options={PRIMARY_TREATMENT_OPTIONS}
              selected={c.primaryTreatment}
              other={c.primaryTreatmentOther}
              onChangeSelected={v => updateComponent(i, { primaryTreatment: v })}
              onChangeOther={v => updateComponent(i, { primaryTreatmentOther: v })}
            />
            <TreatmentCheckboxGroup
              label="Biological"
              options={BIOLOGICAL_TREATMENT_OPTIONS}
              selected={c.biologicalTreatment}
              other={c.biologicalTreatmentOther}
              onChangeSelected={v => updateComponent(i, { biologicalTreatment: v })}
              onChangeOther={v => updateComponent(i, { biologicalTreatmentOther: v })}
            />
            <TreatmentCheckboxGroup
              label="Chemical"
              options={CHEMICAL_TREATMENT_OPTIONS}
              selected={c.chemicalTreatment}
              other={c.chemicalTreatmentOther}
              onChangeSelected={v => updateComponent(i, { chemicalTreatment: v })}
              onChangeOther={v => updateComponent(i, { chemicalTreatmentOther: v })}
            />
            <View style={styles.row}>
              <TextField
                ref={setRef(k('otherTreatment'))}
                label="Others"
                value={c.otherTreatment}
                onChangeText={t => updateComponent(i, { otherTreatment: t })}
                returnKeyType="done"

              />
            </View>
          </View>
        ) : (
          <DetailCard
            key={i}
            title={`Outlet ${c.outletNo}`}
            fields={[
              { label: 'WWTP', value: c.wwtp },
              { label: 'Primary', value: describeTreatment(c.primaryTreatment, c.primaryTreatmentOther) },
              { label: 'Biological', value: describeTreatment(c.biologicalTreatment, c.biologicalTreatmentOther) },
              { label: 'Chemical', value: describeTreatment(c.chemicalTreatment, c.chemicalTreatmentOther) },
              { label: 'Others', value: c.otherTreatment },
            ]}
          />
        );
      })}
      {section.editing && <AddRowButton style={styles.addBtn} label="Add WWTP Treatment Components" onPress={addComponent} />}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

interface WwtpConditionFields {
  wwtpCondition: string | null;
  wwtpConditionOther: string | null;
  wwtpUnderConstruction: boolean | null;
  wwtpConstructionReported: boolean | null;
  wwtpConstructionUnits: string | null;
  wwtpConstructionCompletionDate: string | null;
  wwtpTreatmentUnitsUtilized: string | null;
}

// The draft holds the record's nulls as the form's empty strings so the
// inputs below never see null; wwtpConstructionForSave turns them back.
interface WwtpConditionDraft {
  wwtpCondition: string;
  wwtpConditionOther: string;
  wwtpUnderConstruction: boolean | null;
  wwtpConstructionReported: boolean | null;
  wwtpConstructionUnits: string;
  wwtpConstructionCompletionDate: string;
  wwtpTreatmentUnitsUtilized: string;
}

const yesNo = (v: boolean | null): 'yes' | 'no' | null => (v == null ? null : v ? 'yes' : 'no');
const yesNoLabel = (v: boolean | null): string => (v == null ? '—' : v ? 'Yes' : 'No');

export const WwtpConditionSection: React.FC<{
  complianceId: string;
  value: WwtpConditionFields;
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const section = useEditableSection<WwtpConditionDraft>({
    value: {
      wwtpCondition: value.wwtpCondition || '',
      wwtpConditionOther: value.wwtpConditionOther || '',
      wwtpUnderConstruction: value.wwtpUnderConstruction,
      wwtpConstructionReported: value.wwtpConstructionReported,
      wwtpConstructionUnits: value.wwtpConstructionUnits || '',
      wwtpConstructionCompletionDate: value.wwtpConstructionCompletionDate || '',
      wwtpTreatmentUnitsUtilized: value.wwtpTreatmentUnitsUtilized || '',
    },
    onSave: async draft => {
      await patchComplianceWater(complianceId, {
        wwtpCondition: draft.wwtpCondition || null,
        wwtpConditionOther: wwtpConditionOtherForSave(draft.wwtpCondition, draft.wwtpConditionOther) || null,
        wwtpUnderConstruction: draft.wwtpUnderConstruction,
        ...wwtpConstructionForSave(draft.wwtpUnderConstruction, {
          ...draft,
          wwtpConstructionReported: yesNo(draft.wwtpConstructionReported),
        }),
      });
      onSaved();
    },
  });

  const { draft } = section;
  // Questions 3-6 on the printed form only apply to a plant under
  // construction or rehabilitation, so they follow question 2 - on the
  // read-only view too, where a stale answer would otherwise sit under a No.
  const underConstruction = draft.wwtpUnderConstruction === true;

  return (
    <FormSection
      icon="pulse-outline"
      title="E. Condition of the WWTP"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <>
          <View style={styles.row}>
            <SelectField label="WWTP Condition" value={draft.wwtpCondition} options={WWTP_CONDITION_OPTIONS} onSelect={v => section.setDraft(d => ({ ...d, wwtpCondition: v }))} />
            <RadioGroup
              label="Under Construction / Rehabilitation?"
              options={YES_NO}
              value={yesNo(draft.wwtpUnderConstruction)}
              onChange={v => section.setDraft(d => ({ ...d, wwtpUnderConstruction: v === 'yes' }))}
            />
          </View>
          {draft.wwtpCondition === WWTP_CONDITION_OTHERS && (
            <TextField
              label="Specify the condition"
              value={draft.wwtpConditionOther}
              onChangeText={t => section.setDraft(d => ({ ...d, wwtpConditionOther: t }))}
              placeholder="e.g. Under repair"
              returnKeyType="done"
            />
          )}
          {underConstruction && (
            <>
              <RadioGroup
                label="Reported to EMB/LLDA?"
                options={YES_NO}
                value={yesNo(draft.wwtpConstructionReported)}
                onChange={v => section.setDraft(d => ({ ...d, wwtpConstructionReported: v === 'yes' }))}
              />
              <TextField
                label="Units under construction or being modified"
                value={draft.wwtpConstructionUnits}
                onChangeText={t => section.setDraft(d => ({ ...d, wwtpConstructionUnits: t }))}
                placeholder="e.g. Aeration tank, clarifier"
                returnKeyType="next"
              />
              <View style={styles.row}>
                <DateField
                  label="Estimated date of completion"
                  value={draft.wwtpConstructionCompletionDate}
                  onChange={t => section.setDraft(d => ({ ...d, wwtpConstructionCompletionDate: t }))}
                />
                <TextField
                  label="Treatment units utilized to treat wastewater"
                  value={draft.wwtpTreatmentUnitsUtilized}
                  onChangeText={t => section.setDraft(d => ({ ...d, wwtpTreatmentUnitsUtilized: t }))}
                  placeholder="e.g. Septic tank"
                  returnKeyType="done"
                />
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.row}>
            <TextField label="WWTP Condition" value={describeWwtpCondition(draft.wwtpCondition, draft.wwtpConditionOther)} readOnly />
            <TextField label="Under Construction?" value={yesNoLabel(draft.wwtpUnderConstruction)} readOnly />
          </View>
          {underConstruction && (
            <>
              <View style={styles.row}>
                <TextField label="Reported to EMB/LLDA?" value={yesNoLabel(draft.wwtpConstructionReported)} readOnly />
                <TextField label="Estimated date of completion" value={draft.wwtpConstructionCompletionDate || '—'} readOnly />
              </View>
              <TextField label="Units under construction or being modified" value={draft.wwtpConstructionUnits || '—'} readOnly />
              <TextField label="Treatment units utilized to treat wastewater" value={draft.wwtpTreatmentUnitsUtilized || '—'} readOnly />
            </>
          )}
        </>
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Sampling Points ─────────────────────────────────────────────────────────

interface SamplingFields {
  samplingConducted: boolean | null;
  samplingClassification: string | null;
  samplingPoints: SamplingPointCard[];
}

interface SamplingDraft {
  conducted: boolean | null;
  classification: string;
  points: SamplingPointCard[];
}

const SAMPLING_CLASSIFICATION = SAMPLING_CLASSIFICATION_OPTIONS.map(o => ({ label: o, value: o }));

export const SamplingPointsSection: React.FC<{
  complianceId: string;
  value: SamplingFields;
  canEdit: boolean;
  onSaved: () => void;
}> = ({
  complianceId,
  value,
  canEdit,
  onSaved,
}) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  const section = useEditableSection<SamplingDraft>({
    value: {
      conducted: value.samplingConducted,
      classification: value.samplingClassification || '',
      points: value.samplingPoints,
    },
    onSave: async draft => {
      await patchComplianceWater(complianceId, samplingForSave(draft.conducted, draft.classification, draft.points));
      onSaved();
    },
  });

  const setPoints = (points: SamplingPointCard[]) => section.setDraft(d => ({ ...d, points }));
  const updatePoint = (i: number, patch: Partial<SamplingPointCard>) => {
    const rows = section.draft.points.slice();
    rows[i] = { ...rows[i], ...patch };
    setPoints(rows);
  };
  const removePoint = (i: number) => setPoints(section.draft.points.filter((_, idx) => idx !== i));
  const addPoint = () => setPoints([...section.draft.points, emptySamplingPoint(String(section.draft.points.length + 1))]);

  const addParameter = (pointIndex: number) => {
    const rows = section.draft.points.slice();
    rows[pointIndex] = { ...rows[pointIndex], parameters: [...rows[pointIndex].parameters, emptySamplingParameter()] };
    setPoints(rows);
  };
  const updateParameter = (pointIndex: number, paramIndex: number, patch: Partial<SamplingParameterRow>) => {
    const rows = section.draft.points.slice();
    const params = rows[pointIndex].parameters.slice();
    params[paramIndex] = { ...params[paramIndex], ...patch };
    rows[pointIndex] = { ...rows[pointIndex], parameters: params };
    setPoints(rows);
  };
  const removeParameter = (pointIndex: number, paramIndex: number) => {
    const rows = section.draft.points.slice();
    rows[pointIndex] = { ...rows[pointIndex], parameters: rows[pointIndex].parameters.filter((_, idx) => idx !== paramIndex) };
    setPoints(rows);
  };

  return (
    <FormSection
      icon="flask-outline"
      title="I. Water Quality Sampling"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <>
          <RadioGroup
            label="Was water quality sampling conducted?"
            options={YES_NO}
            value={section.draft.conducted == null ? null : section.draft.conducted ? 'yes' : 'no'}
            onChange={v => section.setDraft(d => ({ ...d, conducted: v === 'yes' }))}
          />
          {section.draft.conducted === true && (
            <RadioGroup
              label="Sampling classification"
              options={SAMPLING_CLASSIFICATION}
              value={section.draft.classification || null}
              onChange={v => section.setDraft(d => ({ ...d, classification: v }))}
            />
          )}
        </>
      ) : (
        <TextField
          label="Sampling conducted?"
          value={describeSampling(section.draft.conducted, section.draft.classification || null)}
          readOnly
        />
      )}
      {/* A No hides the points rather than clearing them; samplingForSave
          drops them on save. A report never asked (null) still shows what
          it recorded. */}
      {section.draft.conducted === false && (
        <Text style={sharedStyles.emptyText}>No sampling conducted — sampling points are not applicable.</Text>
      )}
      {section.draft.conducted !== false && section.draft.points.length === 0 && !section.editing && (
        <Text style={sharedStyles.emptyText}>No sampling points recorded.</Text>
      )}
      {section.draft.conducted !== false && section.draft.points.map((pt, i) => {
        const k = (field: string) => `samplingPoint:${i}:${field}`;
        const pk = (pi: number, field: string) => `samplingParam:${i}:${pi}:${field}`;
        return section.editing ? (
          <View key={i} style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Point {pt.pointNo}</Text>
              <TouchableOpacity onPress={() => removePoint(i)}>
                <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TextField
                ref={setRef(k('pointNo'))}
                label="Point No."
                value={pt.pointNo}
                onChangeText={t => updatePoint(i, { pointNo: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('samplingStation'))}

              />
              <TextField
                ref={setRef(k('samplingStation'))}
                label="Sampling Station"
                value={pt.samplingStation}
                onChangeText={t => updatePoint(i, { samplingStation: t })}
                placeholder="e.g. Influent"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('samplingTime'))}

              />
            </View>
            <View style={styles.row}>
              <TimeField
                ref={setRef(k('samplingTime'))}
                label="Sampling Time"
                value={pt.samplingTime}
                onChange={t => updatePoint(i, { samplingTime: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('typeOfSample'))}
              />
              <TextField
                ref={setRef(k('typeOfSample'))}
                label="Sample Type"
                value={pt.typeOfSample}
                onChangeText={t => updatePoint(i, { typeOfSample: t })}
                placeholder="Grab / Composite"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(k('remarks'))}

              />
            </View>
            <View style={styles.row}>
              <TextField
                ref={setRef(k('remarks'))}
                label="Result Analysis"
                value={pt.remarks}
                onChangeText={t => updatePoint(i, { remarks: t })}
                returnKeyType={pt.parameters.length > 0 ? 'next' : 'done'}
                blurOnSubmit={pt.parameters.length === 0}
                onSubmitEditing={() => focus(pk(0, 'name'))}

              />
            </View>

            <Text style={styles.paramHeading}>Parameters</Text>
            {pt.parameters.map((param, pi) => {
              const isLastParam = pi === pt.parameters.length - 1;
              return (
                <View key={pi} style={styles.paramEditRow}>
                  <View style={styles.paramTopLine}>
                    <ComboInput
                      ref={setRef(pk(pi, 'name'))}
                      style={styles.paramNameInput}
                      title="Parameter"
                      options={WATER_QUALITY_PARAMETERS}
                      value={param.parameterName}
                      onChangeText={t => updateParameter(i, pi, { parameterName: t })}
                      placeholder="Parameter name"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(pk(pi, 'value'))}
                    />
                    <YesNoNAToggle value={param.compliant} onChange={c => updateParameter(i, pi, { compliant: c })} />
                    <TouchableOpacity onPress={() => removeParameter(i, pi)}>
                      <Ionicons name="close-circle" size={18} color={Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.paramFieldsRow}>
                    <TextInput
                      ref={setRef(pk(pi, 'value'))}
                      style={styles.paramSmallInput}
                      value={param.value}
                      onChangeText={t => updateParameter(i, pi, { value: t })}
                      placeholder="Value"
                      placeholderTextColor={Colors.textLight}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(pk(pi, 'unit'))}

                    />
                    <TextInput
                      ref={setRef(pk(pi, 'unit'))}
                      style={styles.paramSmallInput}
                      value={param.unit}
                      onChangeText={t => updateParameter(i, pi, { unit: t })}
                      placeholder="Unit"
                      placeholderTextColor={Colors.textLight}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(pk(pi, 'standard'))}
                    />
                  </View>
                  {/* Its own line, not a third of one - see the create
                      form's note on the same field. */}
                  <TextInput
                    ref={setRef(pk(pi, 'standard'))}
                    style={styles.paramStandardInput}
                    value={param.denrStandard}
                    onChangeText={t => updateParameter(i, pi, { denrStandard: t })}
                    placeholder="DENR Standard"
                    placeholderTextColor={Colors.textLight}
                    multiline
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focus(pk(pi, 'remarks'))}
                  />
                  <TextInput
                    ref={setRef(pk(pi, 'remarks'))}
                    style={styles.paramRemarksInput}
                    value={param.remarks}
                    onChangeText={t => updateParameter(i, pi, { remarks: t })}
                    placeholder="Remarks"
                    placeholderTextColor={Colors.textLight}
                    returnKeyType={isLastParam ? 'done' : 'next'}
                    blurOnSubmit={isLastParam}
                    onSubmitEditing={() => focus(pk(pi + 1, 'name'))}
                  />
                </View>
              );
            })}
            <AddRowButton style={styles.addBtn} label="Add Parameter" onPress={() => addParameter(i)} />
          </View>
        ) : (
          <View key={i} style={sharedStyles.samplingCard}>
            <Text style={sharedStyles.detailCardTitle}>Point {pt.pointNo} — {pt.samplingStation || '—'}</Text>
            <Text style={sharedStyles.samplingMeta}>{pt.samplingTime || '—'} · {pt.typeOfSample || '—'}</Text>
            {!!pt.remarks && <Text style={sharedStyles.checklistRemarks}>{pt.remarks}</Text>}
            {pt.parameters.map((param, pi) => (
              <View key={pi} style={sharedStyles.paramRow}>
                <View style={sharedStyles.checklistTopLine}>
                  <Text style={sharedStyles.checklistRequirement}>{param.parameterName || '—'}</Text>
                  <View style={styles.paramResult}>
                    <Text style={styles.paramValueText}>{param.value} {param.unit}</Text>
                    <YnBadge value={param.compliant} />
                  </View>
                </View>
                <Text style={sharedStyles.checklistRef}>Standard: {param.denrStandard || '—'}</Text>
                {!!param.remarks && <Text style={sharedStyles.checklistRemarks}>{param.remarks}</Text>}
              </View>
            ))}
          </View>
        );
      })}
      {section.editing && section.draft.conducted === true && (
        <AddRowButton style={styles.addBtn} label="Add Sampling Point" onPress={addPoint} />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Previous Inspection Summary ─────────────────────────────────────────────

export const PreviousInspectionSection: React.FC<{
  complianceId: string;
  value: PreviousInspectionState;
  canEdit: boolean;
  onSaved: () => void;
}> = ({ complianceId, value, canEdit, onSaved }) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  const section = useEditableSection<PreviousInspectionState>({
    value,
    onSave: async fields => {
      await patchComplianceWater(complianceId, {
        previousInspectionSummary: previousInspectionForSave(fields),
      });
      onSaved();
    },
  });

  const addParameter = () =>
    section.setDraft(d => ({ ...d, parameters: [...d.parameters, emptySamplingParameter()] }));
  const updateParameter = (i: number, patch: Partial<SamplingParameterRow>) => {
    const params = section.draft.parameters.slice();
    params[i] = { ...params[i], ...patch };
    section.setDraft(d => ({ ...d, parameters: params }));
  };
  const removeParameter = (i: number) =>
    section.setDraft(d => ({ ...d, parameters: d.parameters.filter((_, idx) => idx !== i) }));

  const hasData = !!section.draft.dateOfSampling || section.draft.parameters.length > 0;
  // The gate answers for the whole section. While editing, the fields
  // appear on a Yes and not before - an unanswered report opens on the
  // question alone. The read-only card is more lenient: a No shows only
  // the not-applicable note, but a report never asked (null) still shows
  // whatever it recorded rather than hiding data behind a question it
  // was never asked.
  const noRecords = section.draft.hasRecords === 'no';
  const showFields = section.editing ? section.draft.hasRecords === 'yes' : !noRecords;

  return (
    <FormSection
      icon="time-outline"
      title="II. Previous Inspection"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <RadioGroup
          label="Any previous sampling inspection records?"
          options={YES_NO}
          value={section.draft.hasRecords}
          onChange={v => section.setDraft(d => ({ ...d, hasRecords: v as 'yes' | 'no' }))}
        />
      ) : (
        <TextField
          label="Previous sampling inspection records?"
          value={section.draft.hasRecords == null ? '—' : section.draft.hasRecords === 'yes' ? 'Yes' : 'No'}
          readOnly
        />
      )}
      {noRecords && (
        <Text style={sharedStyles.emptyText}>No previous sampling inspection records — this section is not applicable.</Text>
      )}
      {!showFields ? null : !hasData && !section.editing ? (
        <Text style={sharedStyles.emptyText}>No previous inspection summary recorded.</Text>
      ) : (
        <>
          <View style={styles.row}>
            {section.editing ? (
              <DateField
                ref={setRef('dateOfSampling')}
                label="Date of Sampling"
                value={section.draft.dateOfSampling}
                onChange={t => section.setDraft(d => ({ ...d, dateOfSampling: t }))}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus('samplingStation')}
              />
            ) : (
              <TextField label="Date of Sampling" value={section.draft.dateOfSampling || '—'} readOnly />
            )}
            <TextField
              ref={setRef('samplingStation')}
              label="Sampling Station"
              value={section.draft.samplingStation}
              readOnly={!section.editing}
              onChangeText={t => section.setDraft(d => ({ ...d, samplingStation: t }))}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focus('samplingTime')}
            />
          </View>
          <View style={styles.row}>
            <TimeField
              ref={setRef('samplingTime')}
              label="Sampling Time"
              value={section.draft.samplingTime}
              readOnly={!section.editing}
              onChange={t => section.setDraft(d => ({ ...d, samplingTime: t }))}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focus('typeOfSample')}
            />
            <TextField
              ref={setRef('typeOfSample')}
              label="Sample Type"
              value={section.draft.typeOfSample}
              readOnly={!section.editing}
              onChangeText={t => section.setDraft(d => ({ ...d, typeOfSample: t }))}
              returnKeyType="done"
            />
          </View>

          <Text style={styles.paramHeading}>Parameters</Text>
          {section.editing ? (
            <>
              {section.draft.parameters.map((param, pi) => {
                const isLastParam = pi === section.draft.parameters.length - 1;
                const pk = (field: string) => `prevparam:${pi}:${field}`;
                return (
                  <View key={pi} style={styles.paramEditRow}>
                    <View style={styles.paramTopLine}>
                      <ComboInput
                        ref={setRef(pk('name'))}
                        style={styles.paramNameInput}
                        title="Parameter"
                        options={WATER_QUALITY_PARAMETERS}
                        value={param.parameterName}
                        onChangeText={t => updateParameter(pi, { parameterName: t })}
                        placeholder="Parameter name"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => focus(pk('value'))}
                      />
                      <YesNoNAToggle value={param.compliant} onChange={c => updateParameter(pi, { compliant: c })} />
                      <TouchableOpacity onPress={() => removeParameter(pi)}>
                        <Ionicons name="close-circle" size={18} color={Colors.conflict} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.paramFieldsRow}>
                      <TextInput
                        ref={setRef(pk('value'))}
                        style={styles.paramSmallInput}
                        value={param.value}
                        onChangeText={t => updateParameter(pi, { value: t })}
                        placeholder="Value"
                        placeholderTextColor={Colors.textLight}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => focus(pk('unit'))}

                      />
                      <TextInput
                        ref={setRef(pk('unit'))}
                        style={styles.paramSmallInput}
                        value={param.unit}
                        onChangeText={t => updateParameter(pi, { unit: t })}
                        placeholder="Unit"
                        placeholderTextColor={Colors.textLight}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => focus(pk('standard'))}
                      />
                    </View>
                    {/* Same row as section I's - see the note there. */}
                    <TextInput
                      ref={setRef(pk('standard'))}
                      style={styles.paramStandardInput}
                      value={param.denrStandard}
                      onChangeText={t => updateParameter(pi, { denrStandard: t })}
                      placeholder="DENR Standard"
                      placeholderTextColor={Colors.textLight}
                      multiline
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(pk('remarks'))}
                    />
                    <TextInput
                      ref={setRef(pk('remarks'))}
                      style={styles.paramRemarksInput}
                      value={param.remarks}
                      onChangeText={t => updateParameter(pi, { remarks: t })}
                      placeholder="Remarks"
                      placeholderTextColor={Colors.textLight}
                      returnKeyType={isLastParam ? 'done' : 'next'}
                      blurOnSubmit={isLastParam}
                      onSubmitEditing={() => focus(`prevparam:${pi + 1}:name`)}
                    />
                  </View>
                );
              })}
              <AddRowButton style={styles.addBtn} label="Add Parameter" onPress={addParameter} />
            </>
          ) : (
            section.draft.parameters.map((param, pi) => (
              <View key={pi} style={sharedStyles.paramRow}>
                <View style={sharedStyles.checklistTopLine}>
                  <Text style={sharedStyles.checklistRequirement}>{param.parameterName || '—'}</Text>
                  <View style={styles.paramResult}>
                    <Text style={styles.paramValueText}>{param.value} {param.unit}</Text>
                    <YnBadge value={param.compliant} />
                  </View>
                </View>
                <Text style={sharedStyles.checklistRef}>Standard: {param.denrStandard || '—'}</Text>
                {!!param.remarks && <Text style={sharedStyles.checklistRemarks}>{param.remarks}</Text>}
              </View>
            ))
          )}
        </>
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Summary of Findings — Checklist, DAO 2005-10 ────────────────────────────

export const SummaryOfFindingsSection: React.FC<{
  complianceId: string;
  // The stored entries as they are; answers are matched to the current
  // checklist by key - see findingsValuesFromEntries.
  value: readonly StoredFindingsEntry[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({
  complianceId,
  value,
  canEdit,
  onSaved,
}) => {
  const section = useEditableSection<ChecklistValue[]>({
    value: findingsValuesFromEntries(value),
    onSave: async fields => {
      await patchComplianceWater(complianceId, {
        checklistDao200510: findingsEntriesForSave(fields),
      });
      onSaved();
    },
  });

  return (
    <FormSection
      icon="clipboard-outline"
      title="III. Summary of Findings"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <ChecklistTable
          items={WATER_FINDINGS_CHECKLIST}
          values={section.draft}
          onChange={(i, patch) => {
            const rows = section.draft.slice();
            rows[i] = { ...rows[i], ...patch };
            section.setDraft(rows);
          }}
        />
      ) : (
        <ChecklistList
          items={WATER_FINDINGS_CHECKLIST.map((def, i) => ({
            group: def.group,
            legal_ref: def.ref,
            requirement: def.requirement,
            compliant: section.draft[i]?.compliant ?? null,
            remarks: section.draft[i]?.remarks ?? null,
          }))}
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Discharge Permit Conditions ────────────────────────────────────────────
// No discharge permit on record for this establishment — the itemized
// conditions table doesn't apply, so this stands in for it, read only. See
// establishmentHasDischargePermit in waterReportTabs.ts.

export const DpConditionsUnavailableSection: React.FC = () => (
  <FormSection icon="checkbox-outline" title="IV. Compliance to DP Conditions">
    <Text style={sharedStyles.emptyText}>
      No discharge permit on record for this establishment — compliance to DP conditions doesn't apply.
    </Text>
  </FormSection>
);

export const DpConditionsSection: React.FC<{
  complianceId: string;
  value: DpConditionRow[];
  canEdit: boolean;
  onSaved: () => void;
}> = ({
  complianceId,
  value,
  canEdit,
  onSaved,
}) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  const section = useEditableSection<DpConditionRow[]>({
    value,
    onSave: async fields => {
      await patchComplianceWater(complianceId, {
        dpConditions: fields.filter(c => c.description?.trim()),
      });
      onSaved();
    },
  });

  const updateCondition = (i: number, patch: Partial<DpConditionRow>) => {
    const rows = section.draft.slice();
    rows[i] = { ...rows[i], ...patch };
    section.setDraft(rows);
  };
  const removeCondition = (i: number) => section.setDraft(section.draft.filter((_, idx) => idx !== i));
  const addCondition = () => section.setDraft([...section.draft, emptyDpCondition(String(section.draft.length + 1))]);

  return (
    <FormSection
      icon="checkbox-outline"
      title="IV. Compliance to DP Conditions"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      {section.editing ? (
        <>
          {section.draft.map((c, i) => {
            const isLast = i === section.draft.length - 1;
            const k = (field: string) => `dp:${i}:${field}`;
            return (
              <View key={i} style={styles.dpRow}>
                <View style={styles.dpTopLine}>
                  <TextInput
                    ref={setRef(k('no'))}
                    style={styles.dpConditionNo}
                    value={c.conditionNo}
                    onChangeText={t => updateCondition(i, { conditionNo: t })}
                    placeholder="No."
                    placeholderTextColor={Colors.textLight}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focus(k('desc'))}

                  />
                  <TextInput
                    ref={setRef(k('desc'))}
                    style={styles.dpDescription}
                    value={c.description}
                    onChangeText={t => updateCondition(i, { description: t })}
                    placeholder="Condition description"
                    placeholderTextColor={Colors.textLight}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focus(k('remarks'))}

                  />
                  <YesNoNAToggle value={c.compliant} onChange={v => updateCondition(i, { compliant: v })} />
                  <TouchableOpacity onPress={() => removeCondition(i)}>
                    <Ionicons name="close-circle" size={18} color={Colors.conflict} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={setRef(k('remarks'))}
                  style={styles.dpRemarks}
                  value={c.remarks}
                  onChangeText={t => updateCondition(i, { remarks: t })}
                  placeholder="Remarks"
                  placeholderTextColor={Colors.textLight}
                  returnKeyType={isLast ? 'done' : 'next'}
                  blurOnSubmit={isLast}
                  onSubmitEditing={() => focus(`dp:${i + 1}:no`)}

                />
              </View>
            );
          })}
          <AddRowButton style={styles.addBtn} label="Add Condition" onPress={addCondition} />
        </>
      ) : (
        <ConditionsList
          items={section.draft.map(c => ({
            condition_no: c.conditionNo,
            description: c.description,
            compliant: c.compliant,
            remarks: c.remarks,
          }))}
        />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Observations & Recommendations ─────────────────────────────────────────

interface ObservationsFields {
  otherObservations: string;
  remarksRecommendations: string;
  documentsReviewed: string[];
}

export const ObservationsSection: React.FC<{
  complianceId: string;
  value: ObservationsFields;
  canEdit: boolean;
  onSaved: () => void;
}> = ({
  complianceId,
  value,
  canEdit,
  onSaved,
}) => {
  const observationsRef = useRef<TextInput>(null);
  const remarksRef = useRef<TextInput>(null);

  const section = useEditableSection<ObservationsFields>({
    value,
    onSave: async fields => {
      await patchComplianceWater(complianceId, {
        otherObservations: fields.otherObservations.trim() || null,
        remarksRecommendations: fields.remarksRecommendations.trim() || null,
        documentsReviewed: fields.documentsReviewed,
      });
      onSaved();
    },
  });

  const toggleDocument = (doc: string) => {
    const has = section.draft.documentsReviewed.includes(doc);
    section.setDraft(d => ({
      ...d,
      documentsReviewed: has ? d.documentsReviewed.filter(x => x !== doc) : [...d.documentsReviewed, doc],
    }));
  };

  return (
    <FormSection
      icon="clipboard-outline"
      title="V. Observations and Recommendations"
      headerRight={
        <SectionEditActions editing={section.editing} saving={section.saving} onStartEdit={section.startEdit} onCancel={section.cancel} onSave={section.save} canEdit={canEdit} />
      }>
      <TextField
        ref={observationsRef}
        label="Other Observations"
        value={section.draft.otherObservations}
        readOnly={!section.editing}
        onChangeText={t => section.setDraft(d => ({ ...d, otherObservations: t }))}
        multiline
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => focusInput(remarksRef.current)}

      />
      <TextField
        ref={remarksRef}
        label="Remarks & Recommendations"
        value={section.draft.remarksRecommendations}
        readOnly={!section.editing}
        onChangeText={t => section.setDraft(d => ({ ...d, remarksRecommendations: t }))}
        multiline
        returnKeyType="done"

      />
      <Text style={sharedStyles.docsLabel}>Documents Reviewed</Text>
      {section.editing ? (
        <View style={styles.docsGrid}>
          {DOCUMENTS_REVIEWED_OPTIONS.map(doc => (
            <View key={doc} style={styles.docItem}>
              <CheckboxRow label={doc} checked={section.draft.documentsReviewed.includes(doc)} onToggle={() => toggleDocument(doc)} />
            </View>
          ))}
        </View>
      ) : (
        <DocumentsChips documents={section.draft.documentsReviewed} />
      )}
      {section.error && <Text style={styles.errorText}>{section.error}</Text>}
    </FormSection>
  );
};

// ── Top-level stacked view ───────────────────────────────────────────────
// Renders every subsection of the active main tab in template order, top
// to bottom, each headed by its marker (A-E or I-V) — the tab bar itself
// only switches between the 6 main sections (see TwoRowTabs), so
// subsections are page content, not separate tabs.

interface WaterExtraSectionsViewProps {
  compliance: WaterComplianceData;
  canEdit: boolean;
  onSaved: () => void;
  mainTab: WaterMainTabDef;
  hasDp: boolean;
  province: string;
}

export const WaterExtraSectionsView: React.FC<WaterExtraSectionsViewProps> = ({
  compliance,
  canEdit,
  onSaved,
  mainTab,
  hasDp,
  province,
}) => {
  const complianceId = compliance.complianceId;

  const renderSection = (subKey: string): React.ReactNode => {
    switch (subKey) {
      case 'waterSources':
        return <WaterSourcesSection complianceId={complianceId} value={compliance.waterSources as DynamicRow[]} canEdit={canEdit} onSaved={onSaved} />;
      case 'wastewaterSources':
        return <WastewaterSourcesSection complianceId={complianceId} value={compliance.wastewaterSources as DynamicRow[]} canEdit={canEdit} onSaved={onSaved} />;
      case 'abstractedWaterQuality':
        return <AbstractedWaterQualitySection complianceId={complianceId} value={compliance.abstractedWaterQuality as DynamicRow[]} canEdit={canEdit} onSaved={onSaved} />;
      case 'treatmentSystemType':
        return (
          <TreatmentSystemTypeSection
            complianceId={complianceId}
            hasWwtp={compliance.hasWwtp}
            nonWwtpTreatment={compliance.nonWwtpTreatment}
            canEdit={canEdit}
            onSaved={onSaved}
          />
        );
      case 'wwtpType':
        return compliance.hasWwtp === false ? (
          <WwtpUnavailableSection title="B. Type of WWTP" />
        ) : (
          <WwtpTypeSection
            complianceId={complianceId}
            value={compliance.wwtpType}
            otherValue={compliance.wwtpTypeOther}
            canEdit={canEdit}
            onSaved={onSaved}
          />
        );
      case 'wwtpDetails':
        return compliance.hasWwtp === false ? (
          <WwtpUnavailableSection title="C. WWTP Details" />
        ) : (
          <WwtpDetailsSection complianceId={complianceId} value={compliance.wwtpDetails} canEdit={canEdit} onSaved={onSaved} province={province} />
        );
      case 'wwtpComponents':
        return compliance.hasWwtp === false ? (
          <WwtpUnavailableSection title="D. Components of the WWTP" />
        ) : (
          <WwtpComponentsSection complianceId={complianceId} value={compliance.wwtpComponents} canEdit={canEdit} onSaved={onSaved} />
        );
      case 'wwtpCondition':
        return compliance.hasWwtp === false ? (
          <WwtpUnavailableSection title="E. Condition of the WWTP" />
        ) : (
          <WwtpConditionSection
            complianceId={complianceId}
            value={{
              wwtpCondition: compliance.wwtpCondition,
              wwtpConditionOther: compliance.wwtpConditionOther,
              wwtpUnderConstruction: compliance.wwtpUnderConstruction,
              wwtpConstructionReported: compliance.wwtpConstructionReported,
              wwtpConstructionUnits: compliance.wwtpConstructionUnits,
              wwtpConstructionCompletionDate: compliance.wwtpConstructionCompletionDate,
              wwtpTreatmentUnitsUtilized: compliance.wwtpTreatmentUnitsUtilized,
            }}
            canEdit={canEdit}
            onSaved={onSaved}
          />
        );
      case 'samplingPoints':
        return (
          <SamplingPointsSection
            complianceId={complianceId}
            value={{
              samplingConducted: compliance.samplingConducted,
              samplingClassification: compliance.samplingClassification,
              samplingPoints: compliance.samplingPoints,
            }}
            canEdit={canEdit}
            onSaved={onSaved}
          />
        );
      case 'previousInspection':
        return <PreviousInspectionSection complianceId={complianceId} value={compliance.previousInspectionSummary} canEdit={canEdit} onSaved={onSaved} />;
      case 'summaryOfFindings':
        return <SummaryOfFindingsSection complianceId={complianceId} value={compliance.checklistDao200510} canEdit={canEdit} onSaved={onSaved} />;
      case 'dpConditions':
        return hasDp ? (
          <DpConditionsSection complianceId={complianceId} value={compliance.dpConditions} canEdit={canEdit} onSaved={onSaved} />
        ) : (
          <DpConditionsUnavailableSection />
        );
      case 'observations':
        return (
          <ObservationsSection
            complianceId={complianceId}
            value={{
              otherObservations: compliance.otherObservations || '',
              remarksRecommendations: compliance.remarksRecommendations || '',
              documentsReviewed: compliance.documentsReviewed,
            }}
            canEdit={canEdit}
            onSaved={onSaved}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View>
      {(mainTab.subTabs ?? []).map(sub => (
        <View key={sub.key}>{renderSection(sub.key)}</View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // Deliberately identical to RadioGroup's own `label` style (see
  // components/form/RadioGroup.tsx): the treatment prompt and the
  // "Has WWTP?" radio above it are two halves of one question, so the
  // prompt must read as a field label, not as the uppercase section header
  // `subTitle` would make it. nonWwtpTreatment.test.tsx asserts the two
  // resolve to the same style in the same render, so they cannot drift.
  fieldLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    color: Colors.navy,
    letterSpacing: 0.3,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  row: {
    flexDirection: 'row',
    gap: 14,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.conflict,
    marginTop: 4,
  },
  addBtn: {
    marginBottom: 8,
  },
  editCard: {
    backgroundColor: Colors.bgMuted,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  paramHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 6,
  },
  paramEditRow: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  paramTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  // ComboInput brings its own border, padding and type; only the flex
  // placement in the top line is this file's to set.
  paramNameInput: {
    flex: 1,
  },
  paramFieldsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  paramStandardInput: {
    fontSize: 11.5,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  paramRemarksInput: {
    fontSize: 11.5,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  paramSmallInput: {
    flex: 1,
    fontSize: 11.5,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  // Value and its Compliant? badge sit together at the line's end, so the
  // eye reads "what was measured -> did it pass" in one sweep.
  paramResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paramValueText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dpRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dpTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dpConditionNo: {
    width: 40,
    fontSize: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    textAlign: 'center',
  },
  dpDescription: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dpRemarks: {
    fontSize: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  docsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docItem: {
    width: '48%',
  },
});
