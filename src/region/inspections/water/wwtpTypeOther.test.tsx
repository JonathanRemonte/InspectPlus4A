import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SelectField, TextField } from '../../../components/form';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { WwtpTypeSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import {
  emptyWaterComplianceForm,
  wwtpTypeOtherForSave,
  describeWwtpType,
  WaterComplianceFormState,
} from './waterTypes';

// A bare stub (`update: () => {}`) would let the edit screen's save() resolve
// without proving what it actually wrote - see nonWwtpTreatment.test.tsx,
// which captures patches for the same reason. mockPatches lets the
// round-trip tests below assert on the record, not just the mock's return.
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

const wastewaterTab = buildWaterReportTabs().find(t => t.key === 'wastewaterpollution')!;

const renderForm = (
  value: WaterComplianceFormState,
  onChange: (v: WaterComplianceFormState) => void = () => {},
) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <WaterExtraFormSectionsView
        value={value}
        onChange={onChange}
        mainTab={wastewaterTab}
        hasDp={false}
        province="Marinduque"
      />,
    );
  });
  return tree;
};

const specifyBoxes = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll(n => n.type === TextField && n.props.label === 'Specify the type of WWTP');

describe('Type of WWTP — Others (create form, section 5B)', () => {
  it('hides the specify box until Others is chosen', () => {
    const tree = renderForm({ ...emptyWaterComplianceForm(), hasWwtp: 'yes', wwtpType: 'Physical' });
    expect(specifyBoxes(tree)).toHaveLength(0);
  });

  it('reveals the specify box once Others is chosen', () => {
    const tree = renderForm({ ...emptyWaterComplianceForm(), hasWwtp: 'yes', wwtpType: 'Others' });
    expect(specifyBoxes(tree)).toHaveLength(1);
  });

  it('records what is typed', () => {
    const onChange = jest.fn();
    const tree = renderForm(
      { ...emptyWaterComplianceForm(), hasWwtp: 'yes', wwtpType: 'Others' },
      onChange,
    );
    act(() => { specifyBoxes(tree)[0].props.onChangeText('Membrane bioreactor'); });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ wwtpTypeOther: 'Membrane bioreactor' }),
    );
  });

  it('asks nothing about the type when there is no WWTP', () => {
    const tree = renderForm({ ...emptyWaterComplianceForm(), hasWwtp: 'no', wwtpType: 'Others' });
    expect(specifyBoxes(tree)).toHaveLength(0);
  });
});

describe('what reaches the record', () => {
  it('stores the text when Others is the type', () => {
    expect(wwtpTypeOtherForSave('Others', ' Membrane bioreactor ')).toBe('Membrane bioreactor');
  });

  // Text stranded by re-picking a real type would contradict the choice
  // beside it - the same rule nonWwtpTreatmentFor applies.
  it('drops text left behind by a re-picked type', () => {
    expect(wwtpTypeOtherForSave('Physical', 'Membrane bioreactor')).toBe('');
  });
});

describe('summarising for a read-only view', () => {
  it('folds the text into the Others it belongs to', () => {
    expect(describeWwtpType('Others', 'Membrane bioreactor')).toBe('Others: Membrane bioreactor');
  });

  it('shows a listed type as it stands', () => {
    expect(describeWwtpType('Physical', '')).toBe('Physical');
  });

  it('shows an em dash when nothing was recorded', () => {
    expect(describeWwtpType('', '')).toBe('—');
  });
});

describe('Type of WWTP — Others (edit screen, section 5B)', () => {
  const renderSection = (wwtpType: string | null, wwtpTypeOther: string | null) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WwtpTypeSection
          complianceId="c1"
          value={wwtpType}
          otherValue={wwtpTypeOther}
          canEdit
          onSaved={() => {}}
        />,
      );
    });
    return tree;
  };

  it('shows the specify text on the read-only view', () => {
    const tree = renderSection('Others', 'Membrane bioreactor');
    expect(JSON.stringify(tree.toJSON())).toContain('Others: Membrane bioreactor');
  });

  it('reveals the specify box when editing an Others type', () => {
    const tree = renderSection('Others', 'Membrane bioreactor');
    const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
    act(() => { edit.props.onStartEdit(); });
    expect(tree.root.findAll(n => n.type === TextField && n.props.label === 'Specify the type of WWTP'))
      .toHaveLength(1);
  });

  it('does not reveal it for a listed type', () => {
    const tree = renderSection('Physical', '');
    const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
    act(() => { edit.props.onStartEdit(); });
    expect(tree.root.findAll(n => n.type === TextField && n.props.label === 'Specify the type of WWTP'))
      .toHaveLength(0);
  });

  // The read path (decoding wwtpType/wwtpTypeOther into the draft) and the
  // write path (wwtpTypeOtherForSave reconciling the draft back down) have
  // to agree, or a value typed here would never reach the record. Asserting
  // only on rendered output - as the tests above do - can't catch that; this
  // drives an actual save() and inspects what patchComplianceWater received.
  describe('round-trips the specify text through save', () => {
    beforeEach(() => {
      mockPatches.length = 0;
    });

    it('writes newly typed specify text to the record', async () => {
      const tree = renderSection('Others', '');
      const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
      act(() => { edit.props.onStartEdit(); });
      act(() => { specifyBoxes(tree)[0].props.onChangeText('Membrane bioreactor'); });
      const saveActions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
      await act(async () => { await saveActions[0].props.onSave(); });
      expect(mockPatches).toEqual([
        expect.objectContaining({ wwtpType: 'Others', wwtpTypeOther: 'Membrane bioreactor' }),
      ]);
    });

    it('drops the specify text when re-picking a listed type before saving', async () => {
      const tree = renderSection('Others', 'Membrane bioreactor');
      const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
      act(() => { edit.props.onStartEdit(); });
      act(() => {
        tree.root.find(n => n.type === SelectField && n.props.label === 'WWTP Type').props.onSelect('Physical');
      });
      const saveActions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
      await act(async () => { await saveActions[0].props.onSave(); });
      expect(mockPatches).toEqual([
        expect.objectContaining({ wwtpType: 'Physical', wwtpTypeOther: null }),
      ]);
    });
  });
});
