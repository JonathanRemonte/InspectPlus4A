import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { WaterExtraSectionsView } from './WaterComplianceEditSections';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { buildWaterReportTabs, establishmentHasDischargePermit } from './waterReportTabs';
import { emptyWaterComplianceForm } from './waterTypes';
import type { WaterComplianceView } from '../..';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';

// WaterComplianceEditSections imports database/collections (via
// patchComplianceWater) which constructs a real WatermelonDB SQLiteAdapter
// at import time — needs the native JSI binding, absent under plain Jest.
// Same stub used by establishmentPersistence.test.ts.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));

// components/form pulls in useScrollToInput, which touches the native
// KeyboardEvents binding at import time — not available under plain Jest
// (no device/simulator), so it's stubbed the same way App.test.tsx's
// native modules are implicitly stubbed by jest-expo.
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: { addListener: () => ({ remove: () => {} }) },
}));

// Counts exact-match occurrences of `text`, both as rendered Text children
// and as a TextInput's `placeholder` prop (placeholders live in props, not
// children, in react-test-renderer's JSON tree).
function countOccurrences(json: unknown, text: string): number {
  if (json == null) return 0;
  if (typeof json === 'string') return json === text ? 1 : 0;
  if (Array.isArray(json)) return json.reduce((sum: number, n) => sum + countOccurrences(n, text), 0);
  if (typeof json === 'object') {
    const node = json as { children?: unknown; props?: Record<string, unknown> };
    const placeholderMatch = node.props?.placeholder === text ? 1 : 0;
    return placeholderMatch + countOccurrences(node.children, text);
  }
  return 0;
}

function baseCompliance(): WaterComplianceView {
  return {
    kind: 'water',
    complianceId: 'c1',
    waterSources: [],
    wastewaterSources: [],
    abstractedWaterQuality: [],
    nonWwtpTreatment: {},
    hasWwtp: null,
    wwtpType: null,
    wwtpTypeOther: null,
    wwtpDetails: [],
    wwtpComponents: [],
    wwtpCondition: null,
    wwtpConditionOther: null,
    wwtpUnderConstruction: null,
    wwtpConstructionReported: null,
    wwtpConstructionUnits: null,
    wwtpConstructionCompletionDate: null,
    wwtpTreatmentUnitsUtilized: null,
    samplingConducted: null,
    samplingClassification: null,
    samplingPoints: [],
    previousInspectionSummary: { hasRecords: null, dateOfSampling: '', samplingStation: '', samplingTime: '', typeOfSample: '', parameters: [] },
    checklistDao200510: [],
    dpConditions: [{ conditionNo: '1', description: 'Effluent within limits', compliant: null, remarks: '' }],
    otherObservations: null,
    remarksRecommendations: null,
    documentsReviewed: [],
  };
}

const samplingFindingsTab = buildWaterReportTabs().find(t => t.key === 'samplingfindings')!;

describe('establishmentHasDischargePermit', () => {
  it('is true when a permit is typed as a Discharge Permit', () => {
    const permits: PermitSnapshotItem[] = [
      { envi_law: 'RA 9275', permit_type: 'Discharge Permit', permit_serial: 'DP-1', issued_date: '', expiry_date: '' },
    ];
    expect(establishmentHasDischargePermit(permits)).toBe(true);
  });

  it('is false when there is no discharge permit on record', () => {
    const permits: PermitSnapshotItem[] = [
      { envi_law: 'RA 8749', permit_type: 'Permit to Operate', permit_serial: 'PTO-1', issued_date: '', expiry_date: '' },
    ];
    expect(establishmentHasDischargePermit(permits)).toBe(false);
    expect(establishmentHasDischargePermit([])).toBe(false);
  });
});

describe('DP conditions Edit-button visibility (view screen)', () => {
  it('shows an Edit button for every section-6 subsection, including DP conditions, when the establishment has a DP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraSectionsView
          compliance={baseCompliance()}
          canEdit
          onSaved={() => {}}
          mainTab={samplingFindingsTab}
          hasDp
          province="Marinduque"
        />,
      );
    });
    const json = tree!.toJSON();
    // Sampling Points, Previous Inspection, Summary of Findings, DP
    // Conditions, Observations — one Edit button each.
    expect(countOccurrences(json, 'Edit')).toBe(5);
    expect(countOccurrences(json, 'No discharge permit on record for this establishment — compliance to DP conditions doesn\'t apply.')).toBe(0);
  });

  it('hides only the DP conditions Edit button, and shows the read-only remarks note, when there is no DP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraSectionsView
          compliance={baseCompliance()}
          canEdit
          onSaved={() => {}}
          mainTab={samplingFindingsTab}
          hasDp={false}
          province="Marinduque"
        />,
      );
    });
    const json = tree!.toJSON();
    expect(countOccurrences(json, 'Edit')).toBe(4);
    expect(countOccurrences(json, 'No discharge permit on record for this establishment — compliance to DP conditions doesn\'t apply.')).toBe(1);
  });
});

describe('DP conditions field visibility (create form)', () => {
  it('shows the editable DP condition fields when the establishment has a DP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView
          value={emptyWaterComplianceForm()}
          onChange={() => {}}
          mainTab={samplingFindingsTab}
          hasDp
          province="Marinduque"
        />,
      );
    });
    expect(countOccurrences(tree!.toJSON(), 'Condition description')).toBe(1);
  });

  it('shows only the read-only remarks note, no editable fields, when there is no DP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView
          value={emptyWaterComplianceForm()}
          onChange={() => {}}
          mainTab={samplingFindingsTab}
          hasDp={false}
          province="Marinduque"
        />,
      );
    });
    const json = tree!.toJSON();
    expect(countOccurrences(json, 'Condition description')).toBe(0);
    expect(countOccurrences(json, 'No discharge permit on record for this establishment — compliance to DP conditions doesn\'t apply.')).toBe(1);
  });
});
