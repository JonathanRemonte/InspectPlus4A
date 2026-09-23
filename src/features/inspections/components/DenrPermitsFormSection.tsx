import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { ENVIRONMENTAL_LAWS, getPermitTypeOptions } from '../../../constants/denrPermits';
import { FormSection, TextField, SelectField, DateField } from '../../../components/form';
import { AddRowButton } from '../../../components/AddRowButton';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';

const emptyPermit = (): PermitSnapshotItem => ({
  envi_law: '',
  permit_type: '',
  permit_serial: '',
  issued_date: '',
  expiry_date: '',
});

const PermitCard: React.FC<{
  index: number;
  permit: PermitSnapshotItem;
  onChange: (next: PermitSnapshotItem) => void;
  onRemove: () => void;
}> = ({ index, permit, onChange, onRemove }) => {

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderText}>Permit {index + 1}</Text>
        <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={Colors.conflict} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <SelectField
          label="Environmental Law"
          value={permit.envi_law}
          options={[...ENVIRONMENTAL_LAWS]}
          // Changing the law clears the permit type: the old value belongs
          // to the old law's list and would otherwise linger unselectable.
          onSelect={envi_law =>
            onChange(envi_law === permit.envi_law ? permit : { ...permit, envi_law, permit_type: '' })
          }
        />
        <SelectField
          label="Permit Type"
          value={permit.permit_type}
          options={getPermitTypeOptions(permit.envi_law)}
          onSelect={permit_type => onChange({ ...permit, permit_type })}
          placeholder={permit.envi_law ? 'Select…' : 'Select law first'}
          disabled={!permit.envi_law}
        />
</View>
      <View style={styles.row}>
        <TextField
          label="Permit / Serial No."
          value={permit.permit_serial}
          onChangeText={permit_serial => onChange({ ...permit, permit_serial })}
          textCase="upper"
          placeholder="Enter permit number"
          returnKeyType="done"
        />
      </View>
      <View style={styles.row}>
        <DateField
          label="Date Issued"
          value={permit.issued_date}
          onChange={issued_date => onChange({ ...permit, issued_date })}
        />
        <DateField
          label="Expiry Date"
          value={permit.expiry_date}
          onChange={expiry_date => onChange({ ...permit, expiry_date })}
        />
      </View>
    </View>
  );
};

interface DenrPermitsFormSectionProps {
  value: PermitSnapshotItem[];
  onChange: (value: PermitSnapshotItem[]) => void;
}

// The "3. Compliance Status" section's content for water reports —
// pulled out of GeneralInformationTab so it can render under its own tab
// instead of inside General Information. See waterReportTabs.ts.
export const DenrPermitsFormSection: React.FC<DenrPermitsFormSectionProps> = ({ value, onChange }) => {
  const updatePermitAt = (index: number, next: PermitSnapshotItem) => {
    const denrPermits = value.slice();
    denrPermits[index] = next;
    onChange(denrPermits);
  };

  const removePermitAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addPermit = () => {
    onChange([...value, emptyPermit()]);
  };

  return (
    <FormSection icon="document-outline" title="DENR Permits, Licenses & Clearances">
      {value.length === 0 && <Text style={styles.emptyText}>No permits on record yet.</Text>}
      {value.map((permit, index) => (
        <PermitCard
          key={index}
          index={index}
          permit={permit}
          onChange={next => updatePermitAt(index, next)}
          onRemove={() => removePermitAt(index)}
        />
      ))}
      <AddRowButton label="Add Permit" onPress={addPermit} style={styles.addBtn} />
    </FormSection>
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
});
