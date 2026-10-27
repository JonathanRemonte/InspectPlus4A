import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckboxRow, TextField } from '../../../components/form';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { Colors } from '../../../constants/colors';
import { TREATMENT_OTHERS, TREATMENT_OTHER_LABEL } from './waterChecklistData';

interface TreatmentCheckboxGroupProps {
  label: string;
  options: string[];
  selected: string[];
  other: string;
  onChangeSelected: (next: string[]) => void;
  onChangeOther: (next: string) => void;
}

// One stage of a WWTP's treatment train - Primary, Biological or Chemical.
// The same question three times per outlet card, in both the create form and
// the edit screen, so it lives here rather than being written out six times.
export const TreatmentCheckboxGroup: React.FC<TreatmentCheckboxGroupProps> = ({
  label,
  options,
  selected,
  other,
  onChangeSelected,
  onChangeOther,
}) => {
  const toggle = (option: string) =>
    onChangeSelected(
      selected.includes(option) ? selected.filter(o => o !== option) : [...selected, option],
    );

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {/* The record stores TREATMENT_OTHERS; only the row an inspector reads
          carries the "(specify)" prompt - same split as the non-WWTP
          treatment list in WaterExtraFormSections. */}
      {options.map(option => (
        <CheckboxRow
          key={option}
          label={option === TREATMENT_OTHERS ? TREATMENT_OTHER_LABEL : option}
          checked={selected.includes(option)}
          onToggle={() => toggle(option)}
        />
      ))}
      {selected.includes(TREATMENT_OTHERS) && (
        <TextField
          label={`${label} — ${TREATMENT_OTHER_LABEL}`}
          value={other}
          onChangeText={onChangeOther}
          placeholder="e.g. Sedimentation"
          returnKeyType="done"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { marginBottom: Spacing.lg },
  // Matches WaterExtraFormSections.tsx's own `fieldLabel` (see that file):
  // this group label is answering a field-level question, same as the
  // non-WWTP treatment prompt it sits alongside conceptually, not a section
  // header.
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    color: Colors.navy,
    letterSpacing: 0.3,
    marginBottom: Spacing.sm,
  },
});
