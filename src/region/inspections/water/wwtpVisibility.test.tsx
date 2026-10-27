import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { WaterExtraSectionsView } from './WaterComplianceEditSections';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { buildWaterReportTabs } from './waterReportTabs';
import { emptyWaterComplianceForm } from './waterTypes';
import type { WaterComplianceView } from '../..';

// See dpConditionsVisibility.test.tsx for why these mocks are needed.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: { addListener: () => ({ remove: () => {} }) },
}));

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

function baseCompliance(hasWwtp: boolean | null): WaterComplianceView {
  return {
    kind: 'water',
    complianceId: 'c1',
    waterSources: [],
    wastewaterSources: [],
    abstractedWaterQuality: [],
    nonWwtpTreatment: {},
    hasWwtp,
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
    dpConditions: [],
    otherObservations: null,
    remarksRecommendations: null,
    documentsReviewed: [],
  };
}

const NOT_APPLICABLE_TEXT = "No WWTP on record for this establishment — this doesn't apply.";
const wastewaterPollutionTab = buildWaterReportTabs().find(t => t.key === 'wastewaterpollution')!;

describe('WWTP subsection visibility (view screen)', () => {
  it('shows an Edit button for every subsection, with no not-applicable remark, when there is a WWTP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraSectionsView compliance={baseCompliance(true)} canEdit onSaved={() => {}} mainTab={wastewaterPollutionTab} hasDp={false} province="Marinduque" />,
      );
    });
    const json = tree!.toJSON();
    // Type of Wastewater Treatment System, Type of WWTP, WWTP Details,
    // Components of the WWTP, Condition of the WWTP — one Edit button each.
    expect(countOccurrences(json, 'Edit')).toBe(5);
    expect(countOccurrences(json, NOT_APPLICABLE_TEXT)).toBe(0);
  });

  it('hides the Edit button and shows the not-applicable remark for subsections B-E when there is no WWTP', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraSectionsView compliance={baseCompliance(false)} canEdit onSaved={() => {}} mainTab={wastewaterPollutionTab} hasDp={false} province="Marinduque" />,
      );
    });
    const json = tree!.toJSON();
    // Only subsection A (Type of Wastewater Treatment System) keeps its Edit button.
    expect(countOccurrences(json, 'Edit')).toBe(1);
    expect(countOccurrences(json, NOT_APPLICABLE_TEXT)).toBe(4);
  });

  it('leaves subsections B-E editable when the answer is unset', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraSectionsView compliance={baseCompliance(null)} canEdit onSaved={() => {}} mainTab={wastewaterPollutionTab} hasDp={false} province="Marinduque" />,
      );
    });
    const json = tree!.toJSON();
    expect(countOccurrences(json, 'Edit')).toBe(5);
    expect(countOccurrences(json, NOT_APPLICABLE_TEXT)).toBe(0);
  });
});

describe('WWTP subsection field visibility (create form)', () => {
  it('shows the editable WWTP fields when "Has WWTP?" is yes', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView
          value={{ ...emptyWaterComplianceForm(), hasWwtp: 'yes' }}
          onChange={() => {}}
          mainTab={wastewaterPollutionTab}
          hasDp={false}
          province="Marinduque"
        />,
      );
    });
    expect(countOccurrences(tree!.toJSON(), 'WWTP Type')).toBe(1);
    expect(countOccurrences(tree!.toJSON(), NOT_APPLICABLE_TEXT)).toBe(0);
  });

  it('shows only the not-applicable remark for subsections B-E when "Has WWTP?" is no', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView
          value={{ ...emptyWaterComplianceForm(), hasWwtp: 'no' }}
          onChange={() => {}}
          mainTab={wastewaterPollutionTab}
          hasDp={false}
          province="Marinduque"
        />,
      );
    });
    const json = tree!.toJSON();
    expect(countOccurrences(json, 'WWTP Type')).toBe(0);
    expect(countOccurrences(json, NOT_APPLICABLE_TEXT)).toBe(4);
    expect(countOccurrences(json, 'Subsections B-E will be marked as not applicable.')).toBe(1);
  });
});
