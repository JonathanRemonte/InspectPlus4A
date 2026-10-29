import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { ENVIRONMENTAL_LAWS, getPermitTypeOptions } from '../../../constants/denrPermits';
import { FormSection, TextField, SelectField, DateField, focusInput } from '../../../components/form';
import { AppText } from '../../../components/AppText';
import { AddRowButton } from '../../../components/AddRowButton';
import { SectionEditActions } from './SectionEditActions';
import { useEditableSection } from '../hooks/useEditableSection';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';

const emptyPermit = (): PermitSnapshotItem => ({
  envi_law: '',
  permit_type: '',
  permit_serial: '',
  issued_date: '',
  expiry_date: '',
});

const ReadOnlyPermitCard = React.memo(function ReadOnlyPermitCard({ permit }: { permit: PermitSnapshotItem }) {
  return (
    <View style={styles.permitCard}>
      <View style={styles.permitCardHeader}>
        <Ionicons name="document-text-outline" size={13} color={Colors.green} />
        <AppText
          variant="marquee"
          text={[permit.envi_law, permit.permit_type].filter(Boolean).join(' — ') || 'Permit'}
          style={styles.permitCardTitle}
          containerStyle={styles.permitCardTitleContainer}
        />
      </View>
      <View style={styles.permitRow}>
        <Text style={styles.permitLabel}>Permit / Serial No.</Text>
        <AppText variant="marquee" text={permit.permit_serial || '—'} style={styles.permitValue} containerStyle={styles.permitValueContainer} />
      </View>
      <View style={styles.permitRow}>
        <Text style={styles.permitLabel}>Date Issued</Text>
        <AppText variant="single" text={permit.issued_date || '—'} style={styles.permitValue} containerStyle={styles.permitValueContainer} />
      </View>
      <View style={styles.permitRow}>
        <Text style={styles.permitLabel}>Expiry Date</Text>
        <AppText variant="single" text={permit.expiry_date || '—'} style={styles.permitValue} containerStyle={styles.permitValueContainer} />
      </View>
    </View>
  );
});

interface EditablePermitCardProps {
  index: number;
  permit: PermitSnapshotItem;
  onChange: (next: PermitSnapshotItem) => void;
  onRemove: () => void;
}

const EditablePermitCard = React.memo(function EditablePermitCard({
  index,
  permit,
  onChange,
  onRemove,
}: EditablePermitCardProps) {
  const serialRef = useRef<TextInput>(null);
  const issuedRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);

  return (
    <View style={styles.editCard}>
      <View style={styles.permitCardHeader}>
        <Text style={styles.permitCardTitle}>Permit {index + 1}</Text>
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
          ref={serialRef}
          label="Permit / Serial No."
          value={permit.permit_serial}
          onChangeText={permit_serial => onChange({ ...permit, permit_serial })}
          textCase="upper"
          placeholder="Enter permit number"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => focusInput(issuedRef.current)}
        />
      </View>
      <View style={styles.row}>
        <DateField
          ref={issuedRef}
          label="Date Issued"
          value={permit.issued_date}
          onChange={issued_date => onChange({ ...permit, issued_date })}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => focusInput(expiryRef.current)}
        />
        <DateField
          ref={expiryRef}
          label="Expiry Date"
          value={permit.expiry_date}
          onChange={expiry_date => onChange({ ...permit, expiry_date })}
          returnKeyType="done"
        />
      </View>
    </View>
  );
});

interface DenrPermitsSectionProps {
  permits: PermitSnapshotItem[];
  canEdit: boolean;
  // How this caller persists the edited list. The report screens write the
  // report's own permits snapshot; the establishment screen writes the
  // establishment's denrPermits. The section itself stays ignorant of both,
  // which is what lets one component serve both.
  onSave: (next: PermitSnapshotItem[]) => Promise<void>;
  onSaved: () => void;
}

// The permits list, editable in place, shared by the report screens and the
// establishment detail screen. For water reports it is the "3. Compliance
// Status" tab's content; for every other report type it sits inside General
// Information (see waterReportTabs.ts); on an establishment it is the last
// section of EstablishmentInfoSections.
export const DenrPermitsSection: React.FC<DenrPermitsSectionProps> = ({ permits, canEdit, onSave, onSaved }) => {
  const permitsSection = useEditableSection<PermitSnapshotItem[]>({
    value: permits,
    onSave: async next => {
      await onSave(next);
      onSaved();
    },
  });

  const updatePermitAt = (index: number, next: PermitSnapshotItem) => {
    const rows = permitsSection.draft.slice();
    rows[index] = next;
    permitsSection.setDraft(rows);
  };
  const removePermitAt = (index: number) => {
    permitsSection.setDraft(permitsSection.draft.filter((_, i) => i !== index));
  };
  const addPermit = () => permitsSection.setDraft([...permitsSection.draft, emptyPermit()]);

  return (
    <FormSection
      icon="document-outline"
      title="DENR Permits, Licenses & Clearances"
      headerRight={
        <SectionEditActions
          editing={permitsSection.editing}
          saving={permitsSection.saving}
          onStartEdit={permitsSection.startEdit}
          onCancel={permitsSection.cancel}
          onSave={permitsSection.save}
          canEdit={canEdit}
        />
      }>
      {permitsSection.draft.length === 0 && !permitsSection.editing && (
        <Text style={styles.emptyText}>No permits on record for this report.</Text>
      )}
      <View style={permitsSection.editing ? undefined : styles.permitList}>
        {permitsSection.draft.map((permit, i) =>
          permitsSection.editing ? (
            <EditablePermitCard
              key={i}
              index={i}
              permit={permit}
              onChange={next => updatePermitAt(i, next)}
              onRemove={() => removePermitAt(i)}
            />
          ) : (
            <ReadOnlyPermitCard key={i} permit={permit} />
          ),
        )}
      </View>
      {permitsSection.editing && (
        <AddRowButton label="Add Permit" onPress={addPermit} style={styles.addBtn} />
      )}
      {permitsSection.error && <Text style={styles.errorText}>{permitsSection.error}</Text>}
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
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.conflict,
    marginTop: -4,
    marginBottom: 8,
  },
  permitList: {
    gap: 12,
  },
  permitCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  editCard: {
    backgroundColor: Colors.bgMuted,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  permitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },
  permitCardTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.navy,
  },
  permitCardTitleContainer: {
    flexShrink: 1,
  },
  permitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  permitLabel: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  permitValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  permitValueContainer: {
    flexShrink: 1,
  },
  addBtn: {
    marginBottom: 8,
  },
});
