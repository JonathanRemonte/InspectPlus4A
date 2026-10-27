import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { RadioGroup } from '../../../components/form';
import { AddRowButton } from '../../../components/AddRowButton';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { SamplingPointsSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import {
  emptyWaterComplianceForm,
  emptySamplingPoint,
  samplingForSave,
  describeSampling,
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

const samplingTab = buildWaterReportTabs().find(t => t.key === 'samplingfindings')!;

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
        mainTab={samplingTab}
        hasDp={false}
        province="Marinduque"
      />,
    );
  });
  return tree;
};

const radios = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.type === RadioGroup && n.props.label === label);
const addPointButtons = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll(n => n.type === AddRowButton && n.props.label === 'Add Sampling Point');
// Every rendered string joined in order, so a heading built from several
// text nodes ("Point ", "1") still reads as "Point 1".
const flatten = (node: renderer.ReactTestRendererNode | renderer.ReactTestRendererNode[] | null): string =>
  node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node.children ?? null);
const text = (tree: renderer.ReactTestRenderer) => flatten(tree.toJSON());

const CONDUCTED = 'Was water quality sampling conducted?';
const CLASSIFICATION = 'Sampling classification';

const form = (patch: Partial<WaterComplianceFormState>): WaterComplianceFormState => ({
  ...emptyWaterComplianceForm(),
  ...patch,
});

describe('Water Quality Sampling — conducted? (create form, section 6I)', () => {
  it('asks whether sampling was conducted before anything else', () => {
    const tree = renderForm(form({}));
    expect(radios(tree, CONDUCTED)).toHaveLength(1);
    expect(radios(tree, CLASSIFICATION)).toHaveLength(0);
    expect(addPointButtons(tree)).toHaveLength(0);
  });

  it('offers ambient / effluent / both and the sampling points once Yes', () => {
    const tree = renderForm(form({ samplingConducted: 'yes' }));
    const classification = radios(tree, CLASSIFICATION);
    expect(classification).toHaveLength(1);
    expect(classification[0].props.options.map((o: { label: string }) => o.label)).toEqual(['Ambient', 'Effluent', 'Both']);
    expect(addPointButtons(tree)).toHaveLength(1);
  });

  it('marks the sampling points not applicable once No', () => {
    const tree = renderForm(form({ samplingConducted: 'no', samplingPoints: [emptySamplingPoint('1')] }));
    expect(radios(tree, CLASSIFICATION)).toHaveLength(0);
    expect(addPointButtons(tree)).toHaveLength(0);
    expect(text(tree)).toContain('not applicable');
    expect(text(tree)).not.toContain('Point 1');
  });

  it('records the answers', () => {
    const onChange = jest.fn();
    const tree = renderForm(form({ samplingConducted: 'yes' }), onChange);
    act(() => { radios(tree, CONDUCTED)[0].props.onChange('no'); });
    act(() => { radios(tree, CLASSIFICATION)[0].props.onChange('Effluent'); });
    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ samplingConducted: 'no' }));
    expect(onChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ samplingClassification: 'Effluent' }));
  });
});

describe('what reaches the record', () => {
  const points = [emptySamplingPoint('1')];

  it('stores the classification and points when sampling was conducted', () => {
    expect(samplingForSave('yes', 'Both', points)).toEqual({
      samplingConducted: true,
      samplingClassification: 'Both',
      samplingPoints: points,
    });
  });

  it('keeps an unanswered classification as null', () => {
    expect(samplingForSave(true, '', points).samplingClassification).toBeNull();
  });

  // Points stranded by flipping the answer to No would list sampling the
  // record also says did not happen - the same rule wwtpConstructionForSave
  // applies.
  it('drops the classification and points when sampling was not conducted', () => {
    expect(samplingForSave('no', 'Both', points)).toEqual({
      samplingConducted: false,
      samplingClassification: null,
      samplingPoints: [],
    });
  });

  // An older report never answered the question; its points stand.
  it('leaves an unanswered report and its points alone', () => {
    expect(samplingForSave(null, '', points)).toEqual({
      samplingConducted: null,
      samplingClassification: null,
      samplingPoints: points,
    });
  });
});

describe('summarising for a read-only view', () => {
  it('names the classification when sampling was conducted', () => {
    expect(describeSampling(true, 'Ambient')).toBe('Yes — Ambient');
    expect(describeSampling(true, null)).toBe('Yes');
  });

  it('says not applicable when it was not', () => {
    expect(describeSampling(false, null)).toBe('No — not applicable');
  });

  it('shows an em dash when never asked', () => {
    expect(describeSampling(null, null)).toBe('—');
  });
});

describe('Water Quality Sampling — conducted? (edit screen, section 6I)', () => {
  type Stored = React.ComponentProps<typeof SamplingPointsSection>['value'];
  const renderSection = (value: Stored) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SamplingPointsSection complianceId="c1" value={value} canEdit onSaved={() => {}} />,
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

  it('shows the answer and classification on the read-only view', () => {
    const tree = renderSection({ samplingConducted: true, samplingClassification: 'Effluent', samplingPoints: [emptySamplingPoint('1')] });
    expect(text(tree)).toContain('Yes — Effluent');
    expect(text(tree)).toContain('Point 1');
  });

  it('shows not applicable instead of the points when sampling was not conducted', () => {
    const tree = renderSection({ samplingConducted: false, samplingClassification: null, samplingPoints: [emptySamplingPoint('1')] });
    expect(text(tree)).toContain('not applicable');
    expect(text(tree)).not.toContain('Point 1');
  });

  it('still lists the points of a report that was never asked', () => {
    const tree = renderSection({ samplingConducted: null, samplingClassification: null, samplingPoints: [emptySamplingPoint('1')] });
    expect(text(tree)).toContain('Point 1');
  });

  it('hides the classification and Add button while editing a No', () => {
    const tree = renderSection({ samplingConducted: false, samplingClassification: null, samplingPoints: [] });
    startEdit(tree);
    expect(radios(tree, CONDUCTED)).toHaveLength(1);
    expect(radios(tree, CLASSIFICATION)).toHaveLength(0);
    expect(addPointButtons(tree)).toHaveLength(0);
  });

  describe('round-trips the answers through save', () => {
    beforeEach(() => {
      mockPatches.length = 0;
    });

    it('writes a newly answered Yes with its classification', async () => {
      const tree = renderSection({ samplingConducted: null, samplingClassification: null, samplingPoints: [] });
      startEdit(tree);
      act(() => { radios(tree, CONDUCTED)[0].props.onChange('yes'); });
      act(() => { radios(tree, CLASSIFICATION)[0].props.onChange('Both'); });
      act(() => { addPointButtons(tree)[0].props.onPress(); });
      await save(tree);
      expect(mockPatches).toEqual([
        expect.objectContaining({
          samplingConducted: true,
          samplingClassification: 'Both',
          samplingPoints: [expect.objectContaining({ pointNo: '1' })],
        }),
      ]);
    });

    it('drops the points and classification when flipped to No before saving', async () => {
      const tree = renderSection({ samplingConducted: true, samplingClassification: 'Ambient', samplingPoints: [emptySamplingPoint('1')] });
      startEdit(tree);
      act(() => { radios(tree, CONDUCTED)[0].props.onChange('no'); });
      await save(tree);
      expect(mockPatches).toEqual([
        expect.objectContaining({ samplingConducted: false, samplingClassification: null, samplingPoints: [] }),
      ]);
    });
  });
});
