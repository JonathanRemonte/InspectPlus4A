import React from 'react';
import { Text } from 'react-native';
import { FormSection } from '../../../components/form';

import { reportDataModuleFor } from '../../../core/region/lookup';
import type { ComplianceView } from '../hooks/useInspectionReport';
import { styles } from './ComplianceReadPrimitives';

interface ComplianceStatusViewProps {
  compliance: ComplianceView;
  reportType: string;
}

// ── Empty state ─────────────────────────────────────────────────────────────

const EmptyCompliance: React.FC = () => (
  <FormSection icon="information-circle-outline" title="Compliance Status">
    <Text style={styles.emptyText}>No compliance data has been recorded for this report yet.</Text>
  </FormSection>
);

// The flat "Compliance Status" tab. Each report type's view is region-owned
// (src/region/modules); types that render their own compliance tabs, like
// EMB4B water, never reach this component.
export const ComplianceStatusView: React.FC<ComplianceStatusViewProps> = ({ compliance, reportType }) => {
  if (compliance.kind === 'none') return <EmptyCompliance />;
  const Section = reportDataModuleFor(reportType)?.ComplianceView;
  return Section ? <Section compliance={compliance} /> : <EmptyCompliance />;
};
