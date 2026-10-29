import React from 'react';
import { View, Text } from 'react-native';
import { FormSection, TextField } from '../../components/form';
import type { ChecklistGroup } from '../../features/inspections/hooks/useInspectionReport';
import {
  SimpleTable,
  ChecklistList,
  ConditionsList,
  NarrativeAndDocuments,
  styles,
} from '../../features/inspections/components/ComplianceReadPrimitives';
import type { RegionComplianceView } from '../complianceViews';

const ChecklistGroups: React.FC<{ groups: ChecklistGroup[] }> = ({ groups }) => {
  const populated = groups.filter(g => g.items.length > 0);
  if (populated.length === 0) return <Text style={styles.emptyText}>No checklist entries recorded.</Text>;
  return (
    <View>
      {populated.map(group => (
        <View key={group.title} style={styles.checklistGroup}>
          <Text style={styles.checklistGroupTitle}>{group.title}</Text>
          <ChecklistList items={group.items} />
        </View>
      ))}
    </View>
  );
};

// ── Type-specific views ──────────────────────────────────────────────────────

export const HazwasteComplianceSection: React.FC<{ compliance: RegionComplianceView }> = ({ compliance: c }) =>
  c.kind === 'hazwaste' ? (
    <View>
      <FormSection icon="warning-outline" title="Hazardous Waste Generator">
        <View style={styles.row}>
          <TextField label="Hazardous Waste ID No." value={c.hazwasteGeneratorId || '—'} readOnly />
          <TextField label="Date Issued" value={c.hazwasteIdDateIssued || '—'} readOnly />
        </View>
      </FormSection>

      <FormSection icon="cube-outline" title="Waste Types Generated">
        <SimpleTable
          columns={[
            { key: 'waste_generating_process', label: 'Generating Process' },
            { key: 'type_of_hazardous_waste', label: 'Type of Waste' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'unit', label: 'Unit' },
          ]}
          rows={c.wasteTypesGenerated}
        />
      </FormSection>

      <FormSection icon="checkbox-outline" title="Compliance Checklists — DAO 2013-22">
        <ChecklistGroups groups={c.checklists} />
      </FormSection>

      <FormSection icon="document-text-outline" title="HWID Conditions">
        <ConditionsList items={c.hwidConditions} />
      </FormSection>

      <NarrativeAndDocuments
        otherObservations={c.otherObservations}
        remarksRecommendations={c.remarksRecommendations}
        documentsReviewed={c.documentsReviewed}
      />
    </View>
  ) : null;

export const AirComplianceSection: React.FC<{ compliance: RegionComplianceView }> = ({ compliance: c }) =>
  c.kind === 'air' ? (
    <View>
      <FormSection icon="partly-sunny-outline" title="Emission Sources">
        <SimpleTable
          columns={[
            { key: 'source_no', label: 'Source No.' },
            { key: 'type', label: 'Type' },
            { key: 'fuel_type', label: 'Fuel Type' },
            { key: 'rated_capacity', label: 'Rated Capacity' },
          ]}
          rows={c.emissionSources}
        />
      </FormSection>

      <FormSection icon="checkbox-outline" title="Compliance Checklists">
        <ChecklistGroups groups={c.checklists} />
      </FormSection>

      <FormSection icon="document-text-outline" title="Permit to Operate Conditions">
        <ConditionsList items={c.ptoConditions} />
      </FormSection>

      <NarrativeAndDocuments
        otherObservations={c.otherObservations}
        remarksRecommendations={c.remarksRecommendations}
        documentsReviewed={c.documentsReviewed}
      />
    </View>
  ) : null;

export const EiaComplianceSection: React.FC<{ compliance: RegionComplianceView }> = ({ compliance: c }) =>
  c.kind === 'eia' ? (
    <View>
      <FormSection icon="list-outline" title="Checklist — Revised DAO 2003-30">
        <ChecklistList items={c.checklistDao200330} />
      </FormSection>

      <FormSection icon="document-text-outline" title="ECC / EMP Conditions">
        <ConditionsList items={c.eccEmpConditions} />
      </FormSection>

      <NarrativeAndDocuments
        otherObservations={c.otherObservations}
        remarksRecommendations={c.remarksRecommendations}
        documentsReviewed={c.documentsReviewed}
      />
    </View>
  ) : null;
