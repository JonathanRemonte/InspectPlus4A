import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { ComboInput, FormSection, TimeField } from '../../../components/form';
import type { YnValue } from '../../../components/form';
import { YnBadge } from '../../../features/inspections/components/ComplianceReadPrimitives';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { PreviousInspectionSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import { WATER_QUALITY_PARAMETERS } from './waterChecklistData';
import {
  emptyWaterComplianceForm,
  emptySamplingParameter,
  PreviousInspectionState,
  WaterComplianceFormState,
} from './waterTypes';

// Section II's parameter rows are the same rows section I has, so every
// change made there (samplingParameters.test.tsx) is asserted here too.

const mockPatches: Record<string, unknown>[] = [];
jest.mock('../../../db/database', () => ({
  database: { write: async (fn: () => Promise<void>) => fn() },
  collections: {
    complianceWater: {
      find: async () => ({
        update: (fn: (rec: Record<string, unknown>) => void) => {
          const rec: Record<string, unknown> = {};
          fn(rec);
          mockPatches.push(rec);
        },
      }),
    },
  },
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: { addListener: () => ({ remove: () => {} }) },
}));

const samplingTab = buildWaterReportTabs().find(t => t.key === 'samplingfindings')!;

const previous = (remarks = '', compliant: YnValue = null): PreviousInspectionState => ({
  hasRecords: 'yes',
  dateOfSampling: '2025-03-04',
  samplingStation: 'Outfall',
  samplingTime: '9:00 AM',
  typeOfSample: 'Grab',
  parameters: [{ ...emptySamplingParameter(), remarks, compliant }],
});

const renderForm = (onChange: (v: WaterComplianceFormState) => void = () => {}) => {
  const value: WaterComplianceFormState = { ...emptyWaterComplianceForm(), previousInspection: previous() };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <WaterExtraFormSectionsView value={value} onChange={onChange} mainTab={samplingTab} hasDp={false} province="Marinduque" />,
    );
  });
  return tree;
};

const renderEditSection = (remarks = '', compliant: YnValue = null) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <PreviousInspectionSection complianceId="c1" value={previous(remarks, compliant)} canEdit onSaved={() => {}} />,
    );
  });
  return tree;
};
const startEdit = (tree: renderer.ReactTestRenderer) => {
  const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
  act(() => { edit.props.onStartEdit(); });
  return tree;
};
const renderEdit = () => startEdit(renderEditSection());
const flatten = (node: renderer.ReactTestRendererNode | renderer.ReactTestRendererNode[] | null): string =>
  node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node.children ?? null);

// The create form renders every subsection of the tab together, and III
// and IV have Remarks inputs of their own - so queries are scoped to the
// "II. Previous Inspection" FormSection, which on the edit screen is the
// whole tree.
const scope = (tree: renderer.ReactTestRenderer) =>
  tree.root.find(n => n.type === FormSection && n.props.title === 'II. Previous Inspection');
const previousCombos = (tree: renderer.ReactTestRenderer) =>
  scope(tree).findAll(n => n.type === ComboInput && n.props.title === 'Parameter');
const byPlaceholder = (tree: renderer.ReactTestRenderer, placeholder: string) =>
  scope(tree).findAll(n => n.type === TextInput && n.props.placeholder === placeholder);

describe.each([
  ['create form', renderForm],
  ['edit screen', renderEdit],
])('Previous Inspection parameters (%s)', (_, render) => {
  it('offers the parameter names from the same typeable dropdown', () => {
    const combos = previousCombos(render());
    expect(combos).toHaveLength(1);
    expect(combos[0].props.options).toBe(WATER_QUALITY_PARAMETERS);
  });

  it('gives the DENR standard a full-width, multiline field', () => {
    const standards = byPlaceholder(render(), 'DENR Standard');
    expect(standards).toHaveLength(1);
    expect(standards[0].props.multiline).toBe(true);
  });

  it('picks the sampling time from a time picker', () => {
    expect(scope(render()).findAll(n => n.type === TimeField && n.props.label === 'Sampling Time')).toHaveLength(1);
  });

  it('offers a Remarks input per parameter', () => {
    expect(byPlaceholder(render(), 'Remarks')).toHaveLength(1);
  });
});

describe('what the create form records for a previous parameter', () => {
  it('writes the name and the remark', () => {
    const onChange = jest.fn();
    const tree = renderForm(onChange);
    act(() => { previousCombos(tree)[0].props.onChangeText('BOD'); });
    act(() => { byPlaceholder(tree, 'Remarks')[0].props.onChangeText('Within limit'); });
    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
      previousInspection: expect.objectContaining({ parameters: [expect.objectContaining({ parameterName: 'BOD' })] }),
    }));
    expect(onChange).toHaveBeenNthCalledWith(2, expect.objectContaining({
      previousInspection: expect.objectContaining({ parameters: [expect.objectContaining({ remarks: 'Within limit' })] }),
    }));
  });
});

describe('the previous-inspection read-only card', () => {
  beforeEach(() => {
    mockPatches.length = 0;
  });

  it('shows the remark and the Compliant? badge for each parameter', () => {
    const tree = renderEditSection('Within limit', 'Y');
    expect(flatten(tree.toJSON())).toContain('Within limit');
    const badges = tree.root.findAllByType(YnBadge);
    expect(badges).toHaveLength(1);
    expect(badges[0].props.value).toBe('Y');
  });

  it('round-trips an edited remark through save', async () => {
    const tree = startEdit(renderEditSection('old'));
    act(() => { byPlaceholder(tree, 'Remarks')[0].props.onChangeText('Within limit'); });
    const actions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
    await act(async () => { await actions[0].props.onSave(); });
    expect(mockPatches).toEqual([
      expect.objectContaining({
        previousInspectionSummary: expect.objectContaining({ parameters: [expect.objectContaining({ remarks: 'Within limit' })] }),
      }),
    ]);
  });
});
