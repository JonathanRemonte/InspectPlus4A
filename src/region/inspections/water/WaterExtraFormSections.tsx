import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import {
  FormSection,
  TextField,
  ComboInput,
  SelectField,
  DateField,
  TimeField,
  RadioGroup,
  YesNoNAToggle,
  DynamicRowTable,
  ChecklistTable,
  CheckboxRow,
  focusInput,
} from '../../../components/form';
import { AddRowButton } from '../../../components/AddRowButton';
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
  WaterComplianceFormState,
  emptySamplingPoint,
  emptySamplingParameter,
  emptyWwtpDetail,
  emptyWwtpComponent,
  emptyDpCondition,
  SamplingParameterRow,
} from './waterTypes';
import type { WaterMainTabDef } from './waterReportTabs';
import { getWaterbodyGroups, WATERBODY_NOT_LISTED } from '../../data/waterbodies';

const YES_NO = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

const SAMPLING_CLASSIFICATION = SAMPLING_CLASSIFICATION_OPTIONS.map(o => ({ label: o, value: o }));

interface WaterExtraFormSectionsViewProps {
  value: WaterComplianceFormState;
  onChange: (value: WaterComplianceFormState) => void;
  mainTab: WaterMainTabDef;
  hasDp: boolean;
  province: string;
}

// Renders every subsection of the active main tab in template order, top to
// bottom, each headed by its marker (A-E or I-V) — sections 4 (water
// supply), 5 (wastewater pollution), and 6 (sampling and compliance
// findings) of the water report's create form. See waterReportTabs.ts for
// the tab structure and its view-mode counterpart, WaterExtraSectionsView
// in WaterComplianceEditSections.tsx.
export const WaterExtraFormSectionsView: React.FC<WaterExtraFormSectionsViewProps> = ({
  value,
  onChange,
  mainTab,
  hasDp,
  province,
}) => {
  const fieldRefs = useRef<Record<string, TextInput | null>>({});
  const focus = (key: string) => focusInput(fieldRefs.current[key]);
  const setRef = (key: string) => (el: TextInput | null) => { fieldRefs.current[key] = el; };

  // The dropdown offers this establishment's own province plus a way to say
  // "none of these" - see getWaterbodyGroups for the out-of-region fallback.
  // The not-listed option is its own trailing, ungrouped-feeling group
  // rather than folded into "Other Waterbodies": that group is a real EMB
  // classification heading, and filing the escape hatch under it would read
  // as though "Not listed (specify)" were itself a classified waterbody.
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

  const set = <K extends keyof WaterComplianceFormState>(key: K, v: WaterComplianceFormState[K]) =>
    onChange({ ...value, [key]: v });

  // ── WWTP details / components card helpers ─────────────────────────────────
  const addWwtpDetail = () =>
    set('wwtpDetails', [...value.wwtpDetails, emptyWwtpDetail(String(value.wwtpDetails.length + 1))]);
  const updateWwtpDetail = (i: number, patch: Partial<typeof value.wwtpDetails[number]>) => {
    const rows = value.wwtpDetails.slice();
    rows[i] = { ...rows[i], ...patch };
    set('wwtpDetails', rows);
  };
  const removeWwtpDetail = (i: number) => set('wwtpDetails', value.wwtpDetails.filter((_, idx) => idx !== i));

  const addWwtpComponent = () =>
    set('wwtpComponents', [...value.wwtpComponents, emptyWwtpComponent(String(value.wwtpComponents.length + 1))]);
  const updateWwtpComponent = (i: number, patch: Partial<typeof value.wwtpComponents[number]>) => {
    const rows = value.wwtpComponents.slice();
    rows[i] = { ...rows[i], ...patch };
    set('wwtpComponents', rows);
  };
  const removeWwtpComponent = (i: number) => set('wwtpComponents', value.wwtpComponents.filter((_, idx) => idx !== i));

  // ── Sampling points + nested parameters ─────────────────────────────────────
  const addSamplingPoint = () =>
    set('samplingPoints', [...value.samplingPoints, emptySamplingPoint(String(value.samplingPoints.length + 1))]);
  const updateSamplingPoint = (i: number, patch: Partial<typeof value.samplingPoints[number]>) => {
    const rows = value.samplingPoints.slice();
    rows[i] = { ...rows[i], ...patch };
    set('samplingPoints', rows);
  };
  const removeSamplingPoint = (i: number) => set('samplingPoints', value.samplingPoints.filter((_, idx) => idx !== i));

  const addParameter = (pointIndex: number) => {
    const rows = value.samplingPoints.slice();
    rows[pointIndex] = {
      ...rows[pointIndex],
      parameters: [...rows[pointIndex].parameters, emptySamplingParameter()],
    };
    set('samplingPoints', rows);
  };
  const updateParameter = (pointIndex: number, paramIndex: number, patch: Partial<SamplingParameterRow>) => {
    const rows = value.samplingPoints.slice();
    const params = rows[pointIndex].parameters.slice();
    params[paramIndex] = { ...params[paramIndex], ...patch };
    rows[pointIndex] = { ...rows[pointIndex], parameters: params };
    set('samplingPoints', rows);
  };
  const removeParameter = (pointIndex: number, paramIndex: number) => {
    const rows = value.samplingPoints.slice();
    rows[pointIndex] = {
      ...rows[pointIndex],
      parameters: rows[pointIndex].parameters.filter((_, idx) => idx !== paramIndex),
    };
    set('samplingPoints', rows);
  };

  // ── Previous inspection summary parameters ─────────────────────────────────
  const addPrevParameter = () =>
    set('previousInspection', {
      ...value.previousInspection,
      parameters: [...value.previousInspection.parameters, emptySamplingParameter()],
    });
  const updatePrevParameter = (i: number, patch: Partial<SamplingParameterRow>) => {
    const params = value.previousInspection.parameters.slice();
    params[i] = { ...params[i], ...patch };
    set('previousInspection', { ...value.previousInspection, parameters: params });
  };
  const removePrevParameter = (i: number) =>
    set('previousInspection', {
      ...value.previousInspection,
      parameters: value.previousInspection.parameters.filter((_, idx) => idx !== i),
    });

  // ── DP conditions ────────────────────────────────────────────────────────────
  const addDpCondition = () =>
    set('dpConditions', [...value.dpConditions, emptyDpCondition(String(value.dpConditions.length + 1))]);
  const updateDpCondition = (i: number, patch: Partial<typeof value.dpConditions[number]>) => {
    const rows = value.dpConditions.slice();
    rows[i] = { ...rows[i], ...patch };
    set('dpConditions', rows);
  };
  const removeDpCondition = (i: number) => {
    if (value.dpConditions.length <= 1) return;
    set('dpConditions', value.dpConditions.filter((_, idx) => idx !== i));
  };

  // Appends rather than reordering, so the ticks read in the order the
  // inspector made them.
  const toggleNonWwtpSystem = (option: string) => {
    const has = value.nonWwtpSystems.includes(option);
    set(
      'nonWwtpSystems',
      has ? value.nonWwtpSystems.filter(s => s !== option) : [...value.nonWwtpSystems, option],
    );
  };

  const toggleDocumentReviewed = (doc: string) => {
    const has = value.documentsReviewed.includes(doc);
    set(
      'documentsReviewed',
      has ? value.documentsReviewed.filter(d => d !== doc) : [...value.documentsReviewed, doc],
    );
  };

  const renderSection = (subKey: string): React.ReactNode => {
    switch (subKey) {
      case 'waterSources':
        return (
          <FormSection icon="water-outline" title="A. Water Sources">
            <DynamicRowTable
              columns={[
                { key: 'source_type', label: 'Source Type', width: 140, type: 'select', options: WATER_SOURCE_TYPES },
                { key: 'daily_m3', label: 'Daily Volume (m³)', width: 100, type: 'number', placeholder: '0' },
                { key: 'annual_m3', label: 'Annual Volume (m³)', width: 100, type: 'number', placeholder: '0' },
                { key: 'specify', label: 'Specify', width: 140, placeholder: 'Details' },
              ]}
              rows={value.waterSources}
              onChange={waterSources => set('waterSources', waterSources)}
              addLabel="Add Water Source"
            />
          </FormSection>
        );

      case 'wastewaterSources':
        return (
          <FormSection icon="funnel-outline" title="B. Wastewater Sources">
            <DynamicRowTable
              columns={[
                { key: 'use_type', label: 'Use Type', width: 130, type: 'select', options: WASTEWATER_USE_TYPES },
                { key: 'consumed_m3_day', label: 'Consumed (m³/day)', width: 110, type: 'number', placeholder: '0' },
                { key: 'generated_m3_day', label: 'Generated (m³/day)', width: 110, type: 'number', placeholder: '0' },
                { key: 'outlet_info', label: 'Outlet Info', width: 150, placeholder: 'Outlet No./Location' },
              ]}
              rows={value.wastewaterSources}
              onChange={wastewaterSources => set('wastewaterSources', wastewaterSources)}
              addLabel="Add Wastewater Source"
            />
          </FormSection>
        );

      case 'abstractedWaterQuality':
        return (
          <FormSection icon="flask-outline" title="C. Quality of Abstracted Water">
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
              rows={value.abstractedWaterQuality}
              onChange={abstractedWaterQuality => set('abstractedWaterQuality', abstractedWaterQuality)}
              addLabel="Add Water Quality Entry"
            />
          </FormSection>
        );

      case 'treatmentSystemType':
        return (
          <FormSection icon="construct-outline" title="A. Type of Wastewater Treatment System">
            <RadioGroup label="Has WWTP?" options={YES_NO} value={value.hasWwtp} onChange={v => set('hasWwtp', v as 'yes' | 'no')} />
            {value.hasWwtp === 'no' && (
              <>
                {/* No WWTP doesn't mean no treatment - this is where the
                    septic tank or oil/water separator actually gets
                    recorded. Hidden rather than cleared when Has WWTP flips
                    back to yes; nonWwtpTreatmentForSave is what keeps the
                    stored report consistent. */}
                <Text style={styles.fieldLabel}>{NON_WWTP_TREATMENT_PROMPT}</Text>
                {NON_WWTP_TREATMENT_OPTIONS.map(option => (
                  <CheckboxRow
                    key={option}
                    label={option}
                    checked={value.nonWwtpSystems.includes(option)}
                    onToggle={() => toggleNonWwtpSystem(option)}
                  />
                ))}
                {value.nonWwtpSystems.includes(NON_WWTP_TREATMENT_OTHERS) && (
                  <TextField
                    ref={setRef('nonWwtpOther')}
                    label={NON_WWTP_TREATMENT_OTHER_LABEL}
                    value={value.nonWwtpOther}
                    onChangeText={t => set('nonWwtpOther', t)}
                    placeholder="e.g. Grease trap"
                    returnKeyType="done"
                  />
                )}
                {/* Last, not first: the remark reports a consequence of the
                    answer above rather than being part of asking it, so it
                    closes the subsection instead of splitting the question
                    from the systems that answer it. */}
                <Text style={styles.emptyText}>Subsections B-E will be marked as not applicable.</Text>
              </>
            )}
          </FormSection>
        );

      case 'wwtpType':
        if (value.hasWwtp === 'no') {
          return (
            <FormSection icon="business-outline" title="B. Type of WWTP">
              <Text style={styles.emptyText}>No WWTP on record for this establishment — this doesn't apply.</Text>
            </FormSection>
          );
        }
        return (
          <FormSection icon="business-outline" title="B. Type of WWTP">
            <SelectField
              label="WWTP Type"
              value={value.wwtpType}
              options={WWTP_TYPE_OPTIONS}
              onSelect={v => set('wwtpType', v)}
            />
            {value.wwtpType === WWTP_TYPE_OTHERS && (
              <TextField
                ref={setRef('wwtpTypeOther')}
                label="Specify the type of WWTP"
                value={value.wwtpTypeOther}
                onChangeText={t => set('wwtpTypeOther', t)}
                placeholder="e.g. Membrane bioreactor"
                returnKeyType="done"
              />
            )}
          </FormSection>
        );

      case 'wwtpDetails':
        if (value.hasWwtp === 'no') {
          return (
            <FormSection icon="list-outline" title="C. WWTP Details">
              <Text style={styles.emptyText}>No WWTP on record for this establishment — this doesn't apply.</Text>
            </FormSection>
          );
        }
        return (
          <FormSection icon="list-outline" title="C. WWTP Details">
            <Text style={styles.subTitle}>WWTP Details (per outlet)</Text>
            {value.wwtpDetails.map((d, i) => {
              const k = (field: string) => `wwtpDetail:${i}:${field}`;
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderText}>Outlet {d.outletNo}</Text>
                    <TouchableOpacity onPress={() => removeWwtpDetail(i)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.row}>
                    <TextField
                      ref={setRef(k('outletNo'))}
                      label="Outlet No."
                      value={d.outletNo}
                      onChangeText={t => updateWwtpDetail(i, { outletNo: t })}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('wwtpDetail'))}
                    />
                    <TextField
                      ref={setRef(k('wwtpDetail'))}
                      label="WWTP Detail"
                      value={d.wwtpDetail}
                      onChangeText={t => updateWwtpDetail(i, { wwtpDetail: t })}
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
                      onChange={t => updateWwtpDetail(i, { dateOfInstallation: t })}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('designCapacity'))}
                    />
                    <TextField
                      ref={setRef(k('designCapacity'))}
                      label="Design Capacity"
                      value={d.designCapacity}
                      onChangeText={t => updateWwtpDetail(i, { designCapacity: t })}
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
                      onChangeText={t => updateWwtpDetail(i, { annualMaintenanceCost: t })}
                      keyboardType="numeric"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('outletLocation'))}
                    />
                    <TextField
                      ref={setRef(k('outletLocation'))}
                      label="Outlet Location"
                      value={d.outletLocation}
                      onChangeText={t => updateWwtpDetail(i, { outletLocation: t })}
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
                      onSelect={v => updateWwtpDetail(i, { receivingBodyOfWater: v })}
                    />
                    <TextField
                      ref={setRef(k('flowMeterDevice'))}
                      label="Flow Meter Device"
                      value={d.flowMeterDevice}
                      onChangeText={t => updateWwtpDetail(i, { flowMeterDevice: t })}
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
                        onChangeText={t => updateWwtpDetail(i, { receivingBodyOfWaterOther: t })}
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
                      onChangeText={t => updateWwtpDetail(i, { flowRate: t })}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              );
            })}
            <AddRowButton style={styles.addBtn} label="Add WWTP Outlet Detail" onPress={addWwtpDetail} />
          </FormSection>
        );

      case 'wwtpComponents':
        if (value.hasWwtp === 'no') {
          return (
            <FormSection icon="layers-outline" title="D. Components of the WWTP">
              <Text style={styles.emptyText}>No WWTP on record for this establishment — this doesn't apply.</Text>
            </FormSection>
          );
        }
        return (
          <FormSection icon="layers-outline" title="D. Components of the WWTP">
            <Text style={styles.subTitle}>WWTP Treatment Components (per outlet)</Text>
            {value.wwtpComponents.map((c, i) => {
              const k = (field: string) => `wwtpComponent:${i}:${field}`;
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderText}>Outlet {c.outletNo}</Text>
                    <TouchableOpacity onPress={() => removeWwtpComponent(i)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.row}>
                    <TextField
                      ref={setRef(k('outletNo'))}
                      label="Outlet No."
                      value={c.outletNo}
                      onChangeText={t => updateWwtpComponent(i, { outletNo: t })}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('wwtp'))}
                    />
                    {/* Chain ends here: what follows is checkbox groups, not
                        text, so there is nothing left for "next" to reach. */}
                    <TextField
                      ref={setRef(k('wwtp'))}
                      label="WWTP"
                      value={c.wwtp}
                      onChangeText={t => updateWwtpComponent(i, { wwtp: t })}
                      placeholder="e.g. Septic Tank"
                      returnKeyType="done"
                    />
                  </View>
                  <TreatmentCheckboxGroup
                    label="Primary"
                    options={PRIMARY_TREATMENT_OPTIONS}
                    selected={c.primaryTreatment}
                    other={c.primaryTreatmentOther}
                    onChangeSelected={v => updateWwtpComponent(i, { primaryTreatment: v })}
                    onChangeOther={v => updateWwtpComponent(i, { primaryTreatmentOther: v })}
                  />
                  <TreatmentCheckboxGroup
                    label="Biological"
                    options={BIOLOGICAL_TREATMENT_OPTIONS}
                    selected={c.biologicalTreatment}
                    other={c.biologicalTreatmentOther}
                    onChangeSelected={v => updateWwtpComponent(i, { biologicalTreatment: v })}
                    onChangeOther={v => updateWwtpComponent(i, { biologicalTreatmentOther: v })}
                  />
                  <TreatmentCheckboxGroup
                    label="Chemical"
                    options={CHEMICAL_TREATMENT_OPTIONS}
                    selected={c.chemicalTreatment}
                    other={c.chemicalTreatmentOther}
                    onChangeSelected={v => updateWwtpComponent(i, { chemicalTreatment: v })}
                    onChangeOther={v => updateWwtpComponent(i, { chemicalTreatmentOther: v })}
                  />
                  <View style={styles.row}>
                    <TextField
                      ref={setRef(k('otherTreatment'))}
                      label="Others"
                      value={c.otherTreatment}
                      onChangeText={t => updateWwtpComponent(i, { otherTreatment: t })}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              );
            })}
            <AddRowButton style={styles.addBtn} label="Add WWTP Treatment Components" onPress={addWwtpComponent} />
          </FormSection>
        );

      case 'wwtpCondition':
        if (value.hasWwtp === 'no') {
          return (
            <FormSection icon="pulse-outline" title="E. Condition of the WWTP">
              <Text style={styles.emptyText}>No WWTP on record for this establishment — this doesn't apply.</Text>
            </FormSection>
          );
        }
        return (
          <FormSection icon="pulse-outline" title="E. Condition of the WWTP">
            <View style={styles.row}>
              <SelectField label="WWTP Condition" value={value.wwtpCondition} options={WWTP_CONDITION_OPTIONS} onSelect={v => set('wwtpCondition', v)} />
              <RadioGroup
                label="Under Construction / Rehabilitation?"
                options={YES_NO}
                value={value.wwtpUnderConstruction}
                onChange={v => set('wwtpUnderConstruction', v as 'yes' | 'no')}
              />
            </View>
            {value.wwtpCondition === WWTP_CONDITION_OTHERS && (
              <TextField
                ref={setRef('wwtpConditionOther')}
                label="Specify the condition"
                value={value.wwtpConditionOther}
                onChangeText={t => set('wwtpConditionOther', t)}
                placeholder="e.g. Under repair"
                returnKeyType="done"
              />
            )}
            {/* Questions 3-6 on the printed form only apply to a plant under
                construction or rehabilitation, so they follow question 2. */}
            {value.wwtpUnderConstruction === 'yes' && (
              <>
                <RadioGroup
                  label="Reported to EMB/LLDA?"
                  options={YES_NO}
                  value={value.wwtpConstructionReported}
                  onChange={v => set('wwtpConstructionReported', v as 'yes' | 'no')}
                />
                <TextField
                  ref={setRef('wwtpConstructionUnits')}
                  label="Units under construction or being modified"
                  value={value.wwtpConstructionUnits}
                  onChangeText={t => set('wwtpConstructionUnits', t)}
                  placeholder="e.g. Aeration tank, clarifier"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => focus('wwtpConstructionCompletionDate')}
                />
                <View style={styles.row}>
                  <DateField
                    ref={setRef('wwtpConstructionCompletionDate')}
                    label="Estimated date of completion"
                    value={value.wwtpConstructionCompletionDate}
                    onChange={t => set('wwtpConstructionCompletionDate', t)}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focus('wwtpTreatmentUnitsUtilized')}
                  />
                  <TextField
                    ref={setRef('wwtpTreatmentUnitsUtilized')}
                    label="Treatment units utilized to treat wastewater"
                    value={value.wwtpTreatmentUnitsUtilized}
                    onChangeText={t => set('wwtpTreatmentUnitsUtilized', t)}
                    placeholder="e.g. Septic tank"
                    returnKeyType="done"
                  />
                </View>
              </>
            )}
          </FormSection>
        );

      case 'samplingPoints':
        return (
          <FormSection icon="flask-outline" title="I. Water Quality Sampling">
            <RadioGroup
              label="Was water quality sampling conducted?"
              options={YES_NO}
              value={value.samplingConducted}
              onChange={v => set('samplingConducted', v as 'yes' | 'no')}
            />
            {value.samplingConducted === 'yes' && (
              <RadioGroup
                label="Sampling classification"
                options={SAMPLING_CLASSIFICATION}
                value={value.samplingClassification || null}
                onChange={v => set('samplingClassification', v)}
              />
            )}
            {/* Points are hidden rather than cleared when the answer flips
                to No; samplingForSave is what keeps the stored report
                consistent. Unanswered still shows nothing to add - the
                question comes first. */}
            {value.samplingConducted === 'no' && (
              <Text style={styles.emptyText}>No sampling conducted — sampling points are not applicable.</Text>
            )}
            {value.samplingConducted === 'yes' && value.samplingPoints.map((pt, i) => {
              const k = (field: string) => `samplingPoint:${i}:${field}`;
              const pk = (pi: number, field: string) => `samplingParam:${i}:${pi}:${field}`;
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderText}>Point {pt.pointNo}</Text>
                    <TouchableOpacity onPress={() => removeSamplingPoint(i)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.row}>
                    <TextField
                      ref={setRef(k('pointNo'))}
                      label="Point No."
                      value={pt.pointNo}
                      onChangeText={t => updateSamplingPoint(i, { pointNo: t })}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('samplingStation'))}
                    />
                    <TextField
                      ref={setRef(k('samplingStation'))}
                      label="Sampling Station"
                      value={pt.samplingStation}
                      onChangeText={t => updateSamplingPoint(i, { samplingStation: t })}
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
                      onChange={t => updateSamplingPoint(i, { samplingTime: t })}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('typeOfSample'))}
                    />
                    <TextField
                      ref={setRef(k('typeOfSample'))}
                      label="Sample Type"
                      value={pt.typeOfSample}
                      onChangeText={t => updateSamplingPoint(i, { typeOfSample: t })}
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
                      onChangeText={t => updateSamplingPoint(i, { remarks: t })}
                      returnKeyType={pt.parameters.length > 0 ? 'next' : 'done'}
                      blurOnSubmit={pt.parameters.length === 0}
                      onSubmitEditing={() => focus(pk(0, 'name'))}
                    />
                  </View>

                  <Text style={styles.paramHeading}>Parameters</Text>
                  {pt.parameters.map((param, pi) => {
                    const isLastParam = pi === pt.parameters.length - 1;
                    return (
                      <View key={pi} style={styles.paramRow}>
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
                        {/* Its own line, not a third of one: a standard is
                            rarely a bare number ("50 mg/L (Class C, DAO
                            2016-08)"), so it gets the width and the height
                            to hold that. */}
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
                  <AddRowButton style={styles.addBtn} label="Add Parameter" onPress={() => addParameter(i)} small />
                </View>
              );
            })}
            {value.samplingConducted === 'yes' && (
              <AddRowButton style={styles.addBtn} label="Add Sampling Point" onPress={addSamplingPoint} />
            )}
          </FormSection>
        );

      case 'previousInspection': {
        const prev = value.previousInspection;
        return (
          <FormSection icon="time-outline" title="II. Previous Inspection">
            <RadioGroup
              label="Any previous sampling inspection records?"
              options={YES_NO}
              value={prev.hasRecords}
              onChange={v => set('previousInspection', { ...prev, hasRecords: v as 'yes' | 'no' })}
            />
            {/* Fields are hidden rather than cleared when the answer flips
                to No; previousInspectionForSave is what keeps the stored
                report consistent. Unanswered shows nothing yet - the
                question comes first. */}
            {prev.hasRecords === 'no' && (
              <Text style={styles.emptyText}>No previous sampling inspection records — this section is not applicable.</Text>
            )}
            {prev.hasRecords === 'yes' && (
              <>
            <View style={styles.row}>
              <DateField
                label="Date of Sampling"
                value={value.previousInspection.dateOfSampling}
                onChange={t => set('previousInspection', { ...value.previousInspection, dateOfSampling: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus('prev:samplingStation')}
              />
              <TextField
                ref={setRef('prev:samplingStation')}
                label="Sampling Station"
                value={value.previousInspection.samplingStation}
                onChangeText={t => set('previousInspection', { ...value.previousInspection, samplingStation: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus('prev:samplingTime')}
              />
            </View>
            <View style={styles.row}>
              <TimeField
                ref={setRef('prev:samplingTime')}
                label="Sampling Time"
                value={value.previousInspection.samplingTime}
                onChange={t => set('previousInspection', { ...value.previousInspection, samplingTime: t })}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus('prev:typeOfSample')}
              />
              <TextField
                ref={setRef('prev:typeOfSample')}
                label="Sample Type"
                value={value.previousInspection.typeOfSample}
                onChangeText={t => set('previousInspection', { ...value.previousInspection, typeOfSample: t })}
                returnKeyType={value.previousInspection.parameters.length > 0 ? 'next' : 'done'}
                blurOnSubmit={value.previousInspection.parameters.length === 0}
                onSubmitEditing={() => focus('prevparam:0:name')}
              />
            </View>
            <Text style={styles.paramHeading}>Parameters</Text>
            {value.previousInspection.parameters.map((param, pi) => {
              const isLastParam = pi === value.previousInspection.parameters.length - 1;
              const pk = (field: string) => `prevparam:${pi}:${field}`;
              return (
                <View key={pi} style={styles.paramRow}>
                  <View style={styles.paramTopLine}>
                    <ComboInput
                      ref={setRef(pk('name'))}
                      style={styles.paramNameInput}
                      title="Parameter"
                      options={WATER_QUALITY_PARAMETERS}
                      value={param.parameterName}
                      onChangeText={t => updatePrevParameter(pi, { parameterName: t })}
                      placeholder="Parameter name"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(pk('value'))}
                    />
                    <YesNoNAToggle value={param.compliant} onChange={c => updatePrevParameter(pi, { compliant: c })} />
                    <TouchableOpacity onPress={() => removePrevParameter(pi)}>
                      <Ionicons name="close-circle" size={18} color={Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.paramFieldsRow}>
                    <TextInput
                      ref={setRef(pk('value'))}
                      style={styles.paramSmallInput}
                      value={param.value}
                      onChangeText={t => updatePrevParameter(pi, { value: t })}
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
                      onChangeText={t => updatePrevParameter(pi, { unit: t })}
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
                    onChangeText={t => updatePrevParameter(pi, { denrStandard: t })}
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
                    onChangeText={t => updatePrevParameter(pi, { remarks: t })}
                    placeholder="Remarks"
                    placeholderTextColor={Colors.textLight}
                    returnKeyType={isLastParam ? 'done' : 'next'}
                    blurOnSubmit={isLastParam}
                    onSubmitEditing={() => focus(`prevparam:${pi + 1}:name`)}
                  />
                </View>
              );
            })}
            <AddRowButton style={styles.addBtn} label="Add Parameter" onPress={addPrevParameter} small />
              </>
            )}
          </FormSection>
        );
      }

      case 'summaryOfFindings':
        return (
          <FormSection icon="clipboard-outline" title="III. Summary of Findings">
            <ChecklistTable
              items={WATER_FINDINGS_CHECKLIST}
              values={value.checklistDao200510}
              onChange={(i, patch) => {
                const rows = value.checklistDao200510.slice();
                rows[i] = { ...rows[i], ...patch };
                set('checklistDao200510', rows);
              }}
            />
          </FormSection>
        );

      case 'dpConditions':
        if (!hasDp) {
          return (
            <FormSection icon="checkbox-outline" title="IV. Compliance to DP Conditions">
              <Text style={styles.emptyText}>
                No discharge permit on record for this establishment — compliance to DP conditions doesn't apply.
              </Text>
            </FormSection>
          );
        }
        return (
          <FormSection icon="checkbox-outline" title="IV. Compliance to DP Conditions">
            {value.dpConditions.map((c, i) => {
              const isLast = i === value.dpConditions.length - 1;
              const k = (field: string) => `dp:${i}:${field}`;
              return (
                <View key={i} style={styles.dpRow}>
                  <View style={styles.dpTopLine}>
                    <TextInput
                      ref={setRef(k('no'))}
                      style={styles.dpConditionNo}
                      value={c.conditionNo}
                      onChangeText={t => updateDpCondition(i, { conditionNo: t })}
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
                      onChangeText={t => updateDpCondition(i, { description: t })}
                      placeholder="Condition description"
                      placeholderTextColor={Colors.textLight}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focus(k('remarks'))}
                    />
                    <YesNoNAToggle value={c.compliant} onChange={v => updateDpCondition(i, { compliant: v })} />
                    <TouchableOpacity onPress={() => removeDpCondition(i)} disabled={value.dpConditions.length <= 1}>
                      <Ionicons name="close-circle" size={18} color={value.dpConditions.length <= 1 ? Colors.borderLight : Colors.conflict} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    ref={setRef(k('remarks'))}
                    style={styles.dpRemarks}
                    value={c.remarks}
                    onChangeText={t => updateDpCondition(i, { remarks: t })}
                    placeholder="Remarks"
                    placeholderTextColor={Colors.textLight}
                    returnKeyType={isLast ? 'done' : 'next'}
                    blurOnSubmit={isLast}
                    onSubmitEditing={() => focus(`dp:${i + 1}:no`)}
                  />
                </View>
              );
            })}
            <AddRowButton style={styles.addBtn} label="Add Condition" onPress={addDpCondition} />
          </FormSection>
        );

      case 'observations':
        return (
          <FormSection icon="clipboard-outline" title="V. Observations and Recommendations">
            <TextField
              ref={setRef('observations')}
              label="Other Observations"
              value={value.otherObservations}
              onChangeText={t => set('otherObservations', t)}
              multiline
              placeholder="Other observations noted during the inspection…"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focus('remarksRecommendations')}
            />
            <TextField
              ref={setRef('remarksRecommendations')}
              label="Remarks & Recommendations"
              value={value.remarksRecommendations}
              onChangeText={t => set('remarksRecommendations', t)}
              multiline
              placeholder="Inspector remarks and recommendations…"
              returnKeyType="done"
            />
            <Text style={styles.label}>Documents Reviewed</Text>
            <View style={styles.docsGrid}>
              {DOCUMENTS_REVIEWED_OPTIONS.map(doc => (
                <View key={doc} style={styles.docItem}>
                  <CheckboxRow
                    label={doc}
                    checked={value.documentsReviewed.includes(doc)}
                    onToggle={() => toggleDocumentReviewed(doc)}
                  />
                </View>
              ))}
            </View>
          </FormSection>
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
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
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
  subTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.bgMuted,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  addBtn: {
    marginBottom: 8,
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
  paramRow: {
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
    letterSpacing: 0.3,
    marginBottom: 8,
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
