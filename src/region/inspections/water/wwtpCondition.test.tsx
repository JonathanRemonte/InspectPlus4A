import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { DateField, RadioGroup, SelectField, TextField } from '../../../components/form';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { WwtpConditionSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import {
  emptyWaterComplianceForm,
  wwtpConditionOtherForSave,
  describeWwtpCondition,
  wwtpConstructionForSave,
  WaterComplianceFormState,
} from './waterTypes';

// Same capture as wwtpTypeOther.test.tsx: the round-trip tests below assert
// on what patchComplianceWater actually wrote, not on the mock's return.
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

const byLabel = (tree: renderer.ReactTestRenderer, type: React.ElementType, label: string) =>
  tree.root.findAll(n => n.type === type && n.props.label === label);

const CONSTRUCTION_LABELS: [React.ElementType, string][] = [
  [RadioGroup, 'Reported to EMB/LLDA?'],
  [TextField, 'Units under construction or being modified'],
  [DateField, 'Estimated date of completion'],
  [TextField, 'Treatment units utilized to treat wastewater'],
];

const constructionFields = (tree: renderer.ReactTestRenderer) =>
  CONSTRUCTION_LABELS.flatMap(([type, label]) => byLabel(tree, type, label));

const withWwtp = (patch: Partial<WaterComplianceFormState>): WaterComplianceFormState => ({
  ...emptyWaterComplianceForm(),
  hasWwtp: 'yes',
  ...patch,
});

describe('Condition of the WWTP — Others (create form, section 5E)', () => {
  it('hides the specify box until Others is chosen', () => {
    const tree = renderForm(withWwtp({ wwtpCondition: 'Properly Maintained' }));
    expect(byLabel(tree, TextField, 'Specify the condition')).toHaveLength(0);
  });

  it('reveals the specify box once Others is chosen', () => {
    const tree = renderForm(withWwtp({ wwtpCondition: 'Others' }));
    expect(byLabel(tree, TextField, 'Specify the condition')).toHaveLength(1);
  });

  it('records what is typed', () => {
    const onChange = jest.fn();
    const tree = renderForm(withWwtp({ wwtpCondition: 'Others' }), onChange);
    act(() => { byLabel(tree, TextField, 'Specify the condition')[0].props.onChangeText('Under repair'); });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wwtpConditionOther: 'Under repair' }));
  });
});

describe('Condition of the WWTP — under construction (create form, section 5E)', () => {
  it('asks questions 3-6 only once question 2 is Yes', () => {
    expect(constructionFields(renderForm(withWwtp({ wwtpUnderConstruction: null })))).toHaveLength(0);
    expect(constructionFields(renderForm(withWwtp({ wwtpUnderConstruction: 'no' })))).toHaveLength(0);
    expect(constructionFields(renderForm(withWwtp({ wwtpUnderConstruction: 'yes' })))).toHaveLength(4);
  });

  it('records each answer', () => {
    const onChange = jest.fn();
    const tree = renderForm(withWwtp({ wwtpUnderConstruction: 'yes' }), onChange);
    act(() => { byLabel(tree, RadioGroup, 'Reported to EMB/LLDA?')[0].props.onChange('yes'); });
    act(() => { byLabel(tree, TextField, 'Units under construction or being modified')[0].props.onChangeText('Aeration tank'); });
    act(() => { byLabel(tree, DateField, 'Estimated date of completion')[0].props.onChange('2026-12-01'); });
    act(() => { byLabel(tree, TextField, 'Treatment units utilized to treat wastewater')[0].props.onChangeText('Septic tank'); });
    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ wwtpConstructionReported: 'yes' }));
    expect(onChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ wwtpConstructionUnits: 'Aeration tank' }));
    expect(onChange).toHaveBeenNthCalledWith(3, expect.objectContaining({ wwtpConstructionCompletionDate: '2026-12-01' }));
    expect(onChange).toHaveBeenNthCalledWith(4, expect.objectContaining({ wwtpTreatmentUnitsUtilized: 'Septic tank' }));
  });

  it('asks nothing about construction when there is no WWTP', () => {
    const tree = renderForm({ ...emptyWaterComplianceForm(), hasWwtp: 'no', wwtpUnderConstruction: 'yes' });
    expect(constructionFields(tree)).toHaveLength(0);
  });
});

describe('what reaches the record', () => {
  it('stores the specify text when Others is the condition', () => {
    expect(wwtpConditionOtherForSave('Others', ' Under repair ')).toBe('Under repair');
  });

  it('drops specify text left behind by a re-picked condition', () => {
    expect(wwtpConditionOtherForSave('Properly Maintained', 'Under repair')).toBe('');
  });

  const answers = {
    wwtpConstructionReported: 'yes' as const,
    wwtpConstructionUnits: ' Aeration tank ',
    wwtpConstructionCompletionDate: '2026-12-01',
    wwtpTreatmentUnitsUtilized: ' Septic tank ',
  };

  it('stores questions 3-6 when the plant is under construction', () => {
    expect(wwtpConstructionForSave(true, answers)).toEqual({
      wwtpConstructionReported: true,
      wwtpConstructionUnits: 'Aeration tank',
      wwtpConstructionCompletionDate: '2026-12-01',
      wwtpTreatmentUnitsUtilized: 'Septic tank',
    });
  });

  it('keeps an unanswered question 3 as null rather than No', () => {
    expect(wwtpConstructionForSave(true, { ...answers, wwtpConstructionReported: null }).wwtpConstructionReported).toBeNull();
  });

  // Answers stranded by flipping question 2 back to No would describe
  // construction work on a plant the record also says is not under
  // construction - the same rule wwtpTypeOtherForSave applies.
  it('drops questions 3-6 when the plant is not under construction', () => {
    const cleared = {
      wwtpConstructionReported: null,
      wwtpConstructionUnits: null,
      wwtpConstructionCompletionDate: null,
      wwtpTreatmentUnitsUtilized: null,
    };
    expect(wwtpConstructionForSave(false, answers)).toEqual(cleared);
    expect(wwtpConstructionForSave(null, answers)).toEqual(cleared);
  });
});

describe('summarising for a read-only view', () => {
  it('folds the specify text into the Others it belongs to', () => {
    expect(describeWwtpCondition('Others', 'Under repair')).toBe('Others: Under repair');
  });

  it('shows a listed condition as it stands', () => {
    expect(describeWwtpCondition('Properly Maintained', '')).toBe('Properly Maintained');
  });

  it('shows an em dash when nothing was recorded', () => {
    expect(describeWwtpCondition('', '')).toBe('—');
  });
});

describe('Condition of the WWTP (edit screen, section 5E)', () => {
  type Stored = React.ComponentProps<typeof WwtpConditionSection>['value'];
  const stored: Stored = {
    wwtpCondition: 'Others',
    wwtpConditionOther: 'Under repair',
    wwtpUnderConstruction: true,
    wwtpConstructionReported: false,
    wwtpConstructionUnits: 'Aeration tank',
    wwtpConstructionCompletionDate: '2026-12-01',
    wwtpTreatmentUnitsUtilized: 'Septic tank',
  };

  const renderSection = (value: Partial<Stored>) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WwtpConditionSection
          complianceId="c1"
          value={{ ...stored, ...value }}
          canEdit
          onSaved={() => {}}
        />,
      );
    });
    return tree;
  };

  const startEdit = (tree: renderer.ReactTestRenderer) => {
    const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
    act(() => { edit.props.onStartEdit(); });
  };

  const save = async (tree: renderer.ReactTestRenderer) => {
    const actions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
    await act(async () => { await actions[0].props.onSave(); });
  };

  it('shows every stored answer on the read-only view', () => {
    const json = JSON.stringify(renderSection({}).toJSON());
    expect(json).toContain('Others: Under repair');
    expect(json).toContain('Aeration tank');
    expect(json).toContain('2026-12-01');
    expect(json).toContain('Septic tank');
  });

  it('shows only questions 1-2 on the read-only view when not under construction', () => {
    const json = JSON.stringify(renderSection({ wwtpUnderConstruction: false, wwtpConstructionUnits: 'stale' }).toJSON());
    expect(json).not.toContain('Reported to EMB/LLDA');
    expect(json).not.toContain('stale');
  });

  it('reveals questions 3-6 while editing a plant under construction', () => {
    const tree = renderSection({});
    startEdit(tree);
    expect(constructionFields(tree)).toHaveLength(4);
    expect(byLabel(tree, TextField, 'Specify the condition')).toHaveLength(1);
  });

  it('hides questions 3-6 while editing a plant not under construction', () => {
    const tree = renderSection({ wwtpUnderConstruction: false });
    startEdit(tree);
    expect(constructionFields(tree)).toHaveLength(0);
  });

  describe('round-trips the answers through save', () => {
    beforeEach(() => {
      mockPatches.length = 0;
    });

    it('writes newly typed answers to the record', async () => {
      const tree = renderSection({
        wwtpConditionOther: null,
        wwtpConstructionReported: null,
        wwtpConstructionUnits: null,
        wwtpConstructionCompletionDate: null,
        wwtpTreatmentUnitsUtilized: null,
      });
      startEdit(tree);
      act(() => { byLabel(tree, TextField, 'Specify the condition')[0].props.onChangeText('Under repair'); });
      act(() => { byLabel(tree, RadioGroup, 'Reported to EMB/LLDA?')[0].props.onChange('yes'); });
      act(() => { byLabel(tree, TextField, 'Units under construction or being modified')[0].props.onChangeText('Aeration tank'); });
      act(() => { byLabel(tree, DateField, 'Estimated date of completion')[0].props.onChange('2026-12-01'); });
      act(() => { byLabel(tree, TextField, 'Treatment units utilized to treat wastewater')[0].props.onChangeText('Septic tank'); });
      await save(tree);
      expect(mockPatches).toEqual([
        expect.objectContaining({
          wwtpCondition: 'Others',
          wwtpConditionOther: 'Under repair',
          wwtpUnderConstruction: true,
          wwtpConstructionReported: true,
          wwtpConstructionUnits: 'Aeration tank',
          wwtpConstructionCompletionDate: '2026-12-01',
          wwtpTreatmentUnitsUtilized: 'Septic tank',
        }),
      ]);
    });

    it('drops questions 3-6 when question 2 is flipped to No before saving', async () => {
      const tree = renderSection({});
      startEdit(tree);
      act(() => {
        byLabel(tree, RadioGroup, 'Under Construction / Rehabilitation?')[0].props.onChange('no');
      });
      await save(tree);
      expect(mockPatches).toEqual([
        expect.objectContaining({
          wwtpUnderConstruction: false,
          wwtpConstructionReported: null,
          wwtpConstructionUnits: null,
          wwtpConstructionCompletionDate: null,
          wwtpTreatmentUnitsUtilized: null,
        }),
      ]);
    });

    it('drops the specify text when re-picking a listed condition before saving', async () => {
      const tree = renderSection({});
      startEdit(tree);
      act(() => {
        tree.root.find(n => n.type === SelectField && n.props.label === 'WWTP Condition').props.onSelect('Properly Maintained');
      });
      await save(tree);
      expect(mockPatches).toEqual([
        expect.objectContaining({ wwtpCondition: 'Properly Maintained', wwtpConditionOther: null }),
      ]);
    });
  });
});
