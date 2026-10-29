import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FormSection, RadioGroup } from '../../../components/form';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { PreviousInspectionSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import {
  emptyWaterComplianceForm,
  emptySamplingParameter,
  previousInspectionForSave,
  PreviousInspectionState,
  WaterComplianceFormState,
} from './waterTypes';

// Section II's gate: whether any previous sampling inspection records exist
// at all. Same shape as section I's "sampling conducted?" gate.

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
const HAS_RECORDS = 'Any previous sampling inspection records?';

const previous = (hasRecords: PreviousInspectionState['hasRecords']): PreviousInspectionState => ({
  hasRecords,
  dateOfSampling: '2025-03-04',
  samplingStation: 'Outfall',
  samplingTime: '9:00 AM',
  typeOfSample: 'Grab',
  parameters: [emptySamplingParameter()],
});

const flatten = (node: renderer.ReactTestRendererNode | renderer.ReactTestRendererNode[] | null): string =>
  node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node.children ?? null);
const scope = (tree: renderer.ReactTestRenderer) =>
  tree.root.find(n => n.type === FormSection && n.props.title === 'II. Previous Inspection');
const radios = (tree: renderer.ReactTestRenderer, label: string) =>
  scope(tree).findAll(n => n.type === RadioGroup && n.props.label === label);
const dateFields = (tree: renderer.ReactTestRenderer) =>
  scope(tree).findAll(n => n.props?.label === 'Date of Sampling' && typeof n.type !== 'string');
// Section I is unanswered in every fixture here and section IV says
// "doesn't apply", so "not applicable" on this tab can only be section II's.
const sectionText = (tree: renderer.ReactTestRenderer) => flatten(tree.toJSON());

describe('II. Previous Inspection — records? (create form)', () => {
  const renderForm = (hasRecords: PreviousInspectionState['hasRecords'], onChange: (v: WaterComplianceFormState) => void = () => {}) => {
    const value: WaterComplianceFormState = { ...emptyWaterComplianceForm(), previousInspection: previous(hasRecords) };
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView value={value} onChange={onChange} mainTab={samplingTab} hasDp={false} province="Marinduque" />,
      );
    });
    return tree;
  };

  it('asks whether records exist before showing the fields', () => {
    const tree = renderForm(null);
    expect(radios(tree, HAS_RECORDS)).toHaveLength(1);
    expect(dateFields(tree)).toHaveLength(0);
  });

  it('shows the fields once Yes', () => {
    expect(dateFields(renderForm('yes')).length).toBeGreaterThanOrEqual(1);
  });

  it('marks the section not applicable once No', () => {
    const tree = renderForm('no');
    expect(dateFields(tree)).toHaveLength(0);
    expect(sectionText(tree)).toContain('not applicable');
  });

  it('records the answer', () => {
    const onChange = jest.fn();
    const tree = renderForm(null, onChange);
    act(() => { radios(tree, HAS_RECORDS)[0].props.onChange('yes'); });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ previousInspection: expect.objectContaining({ hasRecords: 'yes' }) }),
    );
  });
});

describe('what reaches the record', () => {
  it('stores the summary with hasRecords true when there are records', () => {
    expect(previousInspectionForSave(previous('yes'))).toEqual({ ...previous('yes'), hasRecords: true });
  });

  // Fields stranded by flipping to No would describe a previous sampling
  // the record also says never happened - the same rule samplingForSave
  // applies.
  it('stores only hasRecords false when there are none', () => {
    expect(previousInspectionForSave(previous('no'))).toEqual({ hasRecords: false });
  });

  // A report from before the question existed keeps the old rule: the
  // summary is what was typed if a date was, otherwise nothing.
  it('leaves an unanswered report on the old rule', () => {
    const { hasRecords: _unanswered, ...fields } = previous(null);
    expect(previousInspectionForSave(previous(null))).toEqual(fields);
    expect(previousInspectionForSave({ ...previous(null), dateOfSampling: '' })).toEqual({});
  });
});

describe('II. Previous Inspection — records? (edit screen)', () => {
  const renderSection = (value: PreviousInspectionState) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<PreviousInspectionSection complianceId="c1" value={value} canEdit onSaved={() => {}} />);
    });
    return tree;
  };
  const startEdit = (tree: renderer.ReactTestRenderer) => {
    const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
    act(() => { edit.props.onStartEdit(); });
    return tree;
  };

  beforeEach(() => {
    mockPatches.length = 0;
  });

  it('shows not applicable instead of the fields when there are no records', () => {
    const tree = renderSection(previous('no'));
    expect(flatten(tree.toJSON())).toContain('not applicable');
    expect(flatten(tree.toJSON())).not.toContain('Outfall');
  });

  // The read-only card never hides what a report recorded: one written
  // before the question existed still shows its summary.
  it('still shows the recorded summary of a report that was never asked', () => {
    expect(flatten(renderSection(previous(null)).toJSON())).toContain('Outfall');
  });

  // Editing is the other way round: the fields appear on a Yes, not by
  // default - so an unanswered report opens on the question alone.
  it('keeps the fields hidden while editing until Yes is chosen', () => {
    for (const answer of [null, 'no'] as const) {
      const tree = startEdit(renderSection(previous(answer)));
      expect(radios(tree, HAS_RECORDS)).toHaveLength(1);
      expect(dateFields(tree)).toHaveLength(0);
    }
    const tree = startEdit(renderSection(previous(null)));
    act(() => { radios(tree, HAS_RECORDS)[0].props.onChange('yes'); });
    expect(dateFields(tree).length).toBeGreaterThanOrEqual(1);
  });

  it('drops the fields when flipped to No before saving', async () => {
    const tree = startEdit(renderSection(previous('yes')));
    act(() => { radios(tree, HAS_RECORDS)[0].props.onChange('no'); });
    const actions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
    await act(async () => { await actions[0].props.onSave(); });
    expect(mockPatches).toEqual([{ previousInspectionSummary: { hasRecords: false }, syncState: 'pending_update' }]);
  });
});
