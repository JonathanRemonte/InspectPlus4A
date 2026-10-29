import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CheckboxRow, TextField } from '../../../components/form';
import { TreatmentCheckboxGroup } from './TreatmentCheckboxGroup';
import {
  PRIMARY_TREATMENT_OPTIONS,
  BIOLOGICAL_TREATMENT_OPTIONS,
  CHEMICAL_TREATMENT_OPTIONS,
  TREATMENT_OTHERS,
  TREATMENT_OTHER_LABEL,
} from './waterChecklistData';
import {
  decodeTreatment,
  decodeWwtpComponent,
  treatmentForSave,
  wwtpComponentForSave,
  describeTreatment,
  emptyWwtpComponent,
  emptyWaterComplianceForm,
  WaterComplianceFormState,
} from './waterTypes';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { WwtpComponentsSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';

jest.mock('../../../db/database', () => ({
  database: { write: async (fn: () => Promise<void>) => fn() },
  collections: { complianceWater: { find: async () => ({ update: () => {} }) } },
}));
// components/form pulls in useScrollToInput, which touches the native
// KeyboardEvents binding at import time - not available under plain Jest
// (no device/simulator). See dpConditionsVisibility.test.tsx for the same
// stub.
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: { addListener: () => ({ remove: () => {} }) },
}));

describe('treatment option lists', () => {
  it('lists the primary treatment units from the printed form', () => {
    expect(PRIMARY_TREATMENT_OPTIONS).toEqual([
      'Screening',
      'Grit Removal',
      'Oil/Water Separator',
      'Equalization Tank',
      TREATMENT_OTHERS,
    ]);
  });

  it('lists the biological treatment units from the printed form', () => {
    expect(BIOLOGICAL_TREATMENT_OPTIONS).toEqual([
      'Activated Sludge',
      'Anaerobic Digestion',
      'Anaerobic Baffled Reactor (ABR)',
      'Reed Bed System',
      'Trickling Filter',
      'Oxidation/Stabilization Batch',
      'Sequencing Batch Reactor',
      TREATMENT_OTHERS,
    ]);
  });

  it('lists the chemical treatment units from the printed form', () => {
    expect(CHEMICAL_TREATMENT_OPTIONS).toEqual([
      'pH Adjustment',
      'Disinfection',
      'Redox',
      'Flocculation/Coagulation',
      TREATMENT_OTHERS,
    ]);
  });

  // The printed form reads "Tricking Filter". Agreed with the requester
  // that the app uses the correct term.
  it('corrects the printed form’s "Tricking Filter" typo', () => {
    expect(BIOLOGICAL_TREATMENT_OPTIONS).not.toContain('Tricking Filter');
  });

  // The record stores the bare word, as NON_WWTP_TREATMENT_OTHERS does; the
  // "(specify)" prompt is a label for the checkbox row, not a stored value.
  it('stores Others as a bare value, separate from its display label', () => {
    expect(TREATMENT_OTHERS).toBe('Others');
    expect(TREATMENT_OTHER_LABEL).toBe('Others (specify)');
  });
});

const renderGroup = (props: Partial<React.ComponentProps<typeof TreatmentCheckboxGroup>> = {}) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <TreatmentCheckboxGroup
        label="Primary"
        options={PRIMARY_TREATMENT_OPTIONS}
        selected={[]}
        other=""
        onChangeSelected={() => {}}
        onChangeOther={() => {}}
        {...props}
      />,
    );
  });
  return tree;
};

const box = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.find(n => n.type === CheckboxRow && n.props.label === label);

describe('TreatmentCheckboxGroup', () => {
  it('offers every option as a checkbox', () => {
    const tree = renderGroup();
    PRIMARY_TREATMENT_OPTIONS.filter(o => o !== TREATMENT_OTHERS).forEach(o =>
      expect(box(tree, o)).toBeTruthy(),
    );
    expect(box(tree, TREATMENT_OTHER_LABEL)).toBeTruthy();
    expect(tree.root.findAll(n => n.type === CheckboxRow)).toHaveLength(PRIMARY_TREATMENT_OPTIONS.length);
  });

  // The row reads "Others (specify)" but ticking it records TREATMENT_OTHERS.
  it('labels the Others row with the specify prompt but records the stored value', () => {
    const onChangeSelected = jest.fn();
    const tree = renderGroup({ onChangeSelected });
    expect(tree.root.findAll(n => n.type === CheckboxRow && n.props.label === TREATMENT_OTHERS)).toHaveLength(0);
    act(() => { box(tree, TREATMENT_OTHER_LABEL).props.onToggle(); });
    expect(onChangeSelected).toHaveBeenCalledWith([TREATMENT_OTHERS]);
  });

  it('ticks the options already selected', () => {
    const tree = renderGroup({ selected: ['Screening'] });
    expect(box(tree, 'Screening').props.checked).toBe(true);
    expect(box(tree, 'Grit Removal').props.checked).toBe(false);
  });

  it('adds an option when it is ticked', () => {
    const onChangeSelected = jest.fn();
    const tree = renderGroup({ selected: ['Screening'], onChangeSelected });
    act(() => { box(tree, 'Grit Removal').props.onToggle(); });
    expect(onChangeSelected).toHaveBeenCalledWith(['Screening', 'Grit Removal']);
  });

  it('removes an option when it is unticked', () => {
    const onChangeSelected = jest.fn();
    const tree = renderGroup({ selected: ['Screening', 'Grit Removal'], onChangeSelected });
    act(() => { box(tree, 'Screening').props.onToggle(); });
    expect(onChangeSelected).toHaveBeenCalledWith(['Grit Removal']);
  });

  it('hides the free-text box until Others is ticked', () => {
    expect(renderGroup().root.findAll(n => n.type === TextField)).toHaveLength(0);
  });

  it('reveals the free-text box once Others is ticked', () => {
    const tree = renderGroup({ selected: [TREATMENT_OTHERS], other: 'Sedimentation' });
    const fields = tree.root.findAll(n => n.type === TextField);
    expect(fields).toHaveLength(1);
    expect(fields[0].props.value).toBe('Sedimentation');
  });
});

describe('decoding treatment stored by an older build', () => {
  // Rows written before this change hold a comma-separated string, because
  // the field was one free-text box hinted "Comma-separated".
  it('splits a comma-separated string into ticks', () => {
    expect(decodeTreatment('Screening, Grit Removal', PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: ['Screening', 'Grit Removal'],
      other: '',
    });
  });

  it('matches option names case-insensitively', () => {
    expect(decodeTreatment('screening', PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: ['Screening'],
      other: '',
    });
  });

  // Anything the list doesn't know is preserved rather than dropped - it's
  // what the inspector actually wrote.
  it('keeps unrecognised text under Others', () => {
    expect(decodeTreatment('Screening, Sedimentation', PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: ['Screening', TREATMENT_OTHERS],
      other: 'Sedimentation',
    });
  });

  it('takes an array as it stands', () => {
    expect(decodeTreatment(['Screening'], PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: ['Screening'],
      other: '',
    });
  });

  it('reads a missing value as nothing selected', () => {
    expect(decodeTreatment(undefined, PRIMARY_TREATMENT_OPTIONS)).toEqual({ selected: [], other: '' });
  });

  // A legacy string that named "Others" outright ticks the box; the label
  // text "Others (specify)" was never a stored value, so if a string does
  // hold it, it is treated like any other unrecognised fragment and kept.
  it('ticks Others for a legacy "others" fragment but keeps the label text as words', () => {
    expect(decodeTreatment('Screening, others', PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: ['Screening', TREATMENT_OTHERS],
      other: '',
    });
    expect(decodeTreatment('Others (specify)', PRIMARY_TREATMENT_OPTIONS)).toEqual({
      selected: [TREATMENT_OTHERS],
      other: 'Others (specify)',
    });
  });
});

describe('decoding a whole stored component row', () => {
  it('carries a legacy row across to the new shape', () => {
    expect(
      decodeWwtpComponent({
        outletNo: '1',
        primaryTreatment: 'Screening',
        biologicalTreatment: 'Activated Sludge',
        chemicalTreatment: 'Disinfection',
        otherTreatment: 'none',
      }),
    ).toEqual({
      outletNo: '1',
      wwtp: '',
      primaryTreatment: ['Screening'],
      primaryTreatmentOther: '',
      biologicalTreatment: ['Activated Sludge'],
      biologicalTreatmentOther: '',
      chemicalTreatment: ['Disinfection'],
      chemicalTreatmentOther: '',
      otherTreatment: 'none',
    });
  });

  // A row this build wrote keeps its specify text in its own key, and the
  // array beside it holds only the Others tick - so there are no unmatched
  // fragments for the decode to rebuild the text from, and it has to take
  // the stored one or the inspector's words vanish on re-open.
  it('keeps the specify text a row of the current shape stored beside the tick', () => {
    expect(
      decodeWwtpComponent({
        outletNo: '1',
        primaryTreatment: ['Screening', TREATMENT_OTHERS],
        primaryTreatmentOther: 'Sedimentation',
      }),
    ).toMatchObject({
      primaryTreatment: ['Screening', TREATMENT_OTHERS],
      primaryTreatmentOther: 'Sedimentation',
    });
  });

  // If an option is later renamed, a row saved under the old name carries an
  // array entry the list no longer recognises *and* a specify text of its
  // own. Both are the inspector's words; the recovered fragment must not
  // displace the stored text, or the text vanishes on re-open.
  it('keeps both a retired array entry and the stored specify text', () => {
    const decoded = decodeWwtpComponent({
      outletNo: '1',
      primaryTreatment: ['Screening', 'Retired Option Name'],
      primaryTreatmentOther: 'Sedimentation',
    });
    expect(decoded.primaryTreatment).toEqual(['Screening', TREATMENT_OTHERS]);
    expect(decoded.primaryTreatmentOther).toContain('Retired Option Name');
    expect(decoded.primaryTreatmentOther).toContain('Sedimentation');
  });
});

describe('what reaches the record', () => {
  it('keeps free text alongside an Others tick', () => {
    expect(treatmentForSave([TREATMENT_OTHERS], ' Sedimentation ')).toEqual({
      selected: [TREATMENT_OTHERS],
      other: 'Sedimentation',
    });
  });

  it('drops free text left behind by an unticked Others', () => {
    expect(treatmentForSave(['Screening'], 'Sedimentation')).toEqual({
      selected: ['Screening'],
      other: '',
    });
  });
});

describe('reconciling a whole component card for save', () => {
  // Both entry paths write a component card through this one function, so a
  // fourth stage or a rename only has to be handled here - not once per
  // call site with nothing pinning the second one.
  it('reconciles all three stages independently', () => {
    const card = {
      ...emptyWwtpComponent('1'),
      primaryTreatment: [TREATMENT_OTHERS],
      primaryTreatmentOther: ' Sedimentation ',
      biologicalTreatment: ['Activated Sludge'],
      biologicalTreatmentOther: 'stray text',
      chemicalTreatment: [TREATMENT_OTHERS],
      chemicalTreatmentOther: ' Ferric chloride ',
    };
    expect(wwtpComponentForSave(card)).toEqual({
      ...card,
      primaryTreatmentOther: 'Sedimentation',
      biologicalTreatmentOther: '',
      chemicalTreatmentOther: 'Ferric chloride',
    });
  });

  it('keeps a stage’s text when that stage’s Others is ticked', () => {
    const card = {
      ...emptyWwtpComponent('1'),
      primaryTreatment: [TREATMENT_OTHERS],
      primaryTreatmentOther: 'Sedimentation',
    };
    expect(wwtpComponentForSave(card).primaryTreatmentOther).toBe('Sedimentation');
  });

  it('drops a stage’s text when that stage’s Others is not ticked', () => {
    const card = {
      ...emptyWwtpComponent('1'),
      primaryTreatment: ['Screening'],
      primaryTreatmentOther: 'Sedimentation',
    };
    expect(wwtpComponentForSave(card).primaryTreatmentOther).toBe('');
  });

  // A fourth stage or a rename that updates one path and leaves the other
  // is exactly the defect this helper closes off - pin that one stage's
  // text cannot end up reconciled under another stage's key.
  it('does not let one stage’s text leak into another', () => {
    const card = {
      ...emptyWwtpComponent('1'),
      primaryTreatment: ['Screening'],
      primaryTreatmentOther: 'stray',
      biologicalTreatment: [TREATMENT_OTHERS],
      biologicalTreatmentOther: 'Anaerobic notes',
      chemicalTreatment: [],
      chemicalTreatmentOther: '',
    };
    const saved = wwtpComponentForSave(card);
    expect(saved.primaryTreatmentOther).toBe('');
    expect(saved.biologicalTreatmentOther).toBe('Anaerobic notes');
    expect(saved.chemicalTreatmentOther).toBe('');
  });
});

describe('summarising for a read-only card', () => {
  it('joins the ticked options', () => {
    expect(describeTreatment(['Screening', 'Grit Removal'], '')).toBe('Screening, Grit Removal');
  });

  it('folds the free text into the Others tick it belongs to', () => {
    expect(describeTreatment(['Screening', TREATMENT_OTHERS], 'Sedimentation')).toBe(
      'Screening, Others: Sedimentation',
    );
  });

  it('shows an em dash when nothing was recorded', () => {
    expect(describeTreatment([], '')).toBe('—');
  });
});

const wastewaterTab = buildWaterReportTabs().find(t => t.key === 'wastewaterpollution')!;

function renderForm(
  value: WaterComplianceFormState,
  onChange: (v: WaterComplianceFormState) => void = () => {},
) {
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
}

const withOneComponent = (patch: Partial<ReturnType<typeof emptyWwtpComponent>> = {}) => ({
  ...emptyWaterComplianceForm(),
  hasWwtp: 'yes' as const,
  wwtpComponents: [{ ...emptyWwtpComponent('1'), ...patch }],
});

const group = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.find(n => n.type === TreatmentCheckboxGroup && n.props.label === label);

describe('Components of the WWTP (create form, section 5D)', () => {
  // The printed form's section D has a WWTP column beside Outlet No. Without
  // it a report describing two plants gives no way to tell which one a
  // component set belongs to.
  it('offers a WWTP column beside the outlet number', () => {
    const tree = renderForm(withOneComponent());
    expect(tree.root.findAll(n => n.type === TextField && n.props.label === 'WWTP')).toHaveLength(1);
  });

  it('records what is typed into the WWTP column', () => {
    const onChange = jest.fn();
    const tree = renderForm(withOneComponent(), onChange);
    const field = tree.root.find(n => n.type === TextField && n.props.label === 'WWTP');
    act(() => { field.props.onChangeText('Septic Tank'); });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wwtpComponents: [expect.objectContaining({ wwtp: 'Septic Tank' })],
      }),
    );
  });

  it('offers all three treatment stages as checkbox groups', () => {
    const tree = renderForm(withOneComponent());
    expect(group(tree, 'Primary')).toBeTruthy();
    expect(group(tree, 'Biological')).toBeTruthy();
    expect(group(tree, 'Chemical')).toBeTruthy();
  });

  it('records a ticked treatment unit', () => {
    const onChange = jest.fn();
    const tree = renderForm(withOneComponent(), onChange);
    act(() => { group(tree, 'Primary').props.onChangeSelected(['Screening']); });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wwtpComponents: [expect.objectContaining({ primaryTreatment: ['Screening'] })],
      }),
    );
  });

  // Each stage keeps its own specify text, so "Sedimentation" under Primary
  // can't leak into Chemical.
  it('keeps each stage’s specify text separate', () => {
    const onChange = jest.fn();
    const tree = renderForm(withOneComponent(), onChange);
    act(() => { group(tree, 'Chemical').props.onChangeOther('Ferric chloride'); });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wwtpComponents: [
          expect.objectContaining({ chemicalTreatmentOther: 'Ferric chloride', primaryTreatmentOther: '' }),
        ],
      }),
    );
  });
});

const renderComponentsSection = (rows: Record<string, unknown>[]) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <WwtpComponentsSection complianceId="c1" value={rows as never} canEdit onSaved={() => {}} />,
    );
  });
  return tree;
};

const startEditing = (tree: renderer.ReactTestRenderer) => {
  const edit = tree.root.findAll(n => typeof n.props.onStartEdit === 'function')[0];
  act(() => { edit.props.onStartEdit(); });
};

describe('Components of the WWTP (edit screen, section 5D)', () => {
  it('summarises the ticked units on the read-only card', () => {
    const tree = renderComponentsSection([
      { outletNo: '1', wwtp: 'STP-1', primaryTreatment: ['Screening', 'Grit Removal'] },
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain('Screening, Grit Removal');
  });

  it('shows the WWTP name on the read-only card', () => {
    const tree = renderComponentsSection([{ outletNo: '1', wwtp: 'STP-1' }]);
    expect(JSON.stringify(tree.toJSON())).toContain('STP-1');
  });

  // The card summarises what the decode made of a legacy row, so the reader
  // sees the inspector's own words under the tick they now sit beneath -
  // not the raw stored string.
  it('folds a legacy row’s unrecognised text into Others on the card', () => {
    const tree = renderComponentsSection([
      { outletNo: '1', primaryTreatment: 'Screening, Sedimentation' },
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain('Screening, Others: Sedimentation');
  });

  // A report written by an older build stored one comma-separated string.
  it('ticks the boxes a legacy comma-separated row named', () => {
    const tree = renderComponentsSection([
      { outletNo: '1', primaryTreatment: 'Screening, Grit Removal' },
    ]);
    startEditing(tree);
    const primary = tree.root.find(
      n => n.type === TreatmentCheckboxGroup && n.props.label === 'Primary',
    );
    expect(primary.props.selected).toEqual(['Screening', 'Grit Removal']);
  });

  it('preserves a legacy value the option list doesn’t know', () => {
    const tree = renderComponentsSection([
      { outletNo: '1', primaryTreatment: 'Screening, Sedimentation' },
    ]);
    startEditing(tree);
    const primary = tree.root.find(
      n => n.type === TreatmentCheckboxGroup && n.props.label === 'Primary',
    );
    expect(primary.props.selected).toContain(TREATMENT_OTHERS);
    expect(primary.props.other).toBe('Sedimentation');
  });

  // Re-opening a report this build saved must find the specify text where
  // that save put it - in its own key, not in the array beside it.
  it('re-opens a saved specify text into its box', () => {
    const tree = renderComponentsSection([
      {
        outletNo: '1',
        primaryTreatment: ['Screening', TREATMENT_OTHERS],
        primaryTreatmentOther: 'Sedimentation',
      },
    ]);
    startEditing(tree);
    const primary = tree.root.find(
      n => n.type === TreatmentCheckboxGroup && n.props.label === 'Primary',
    );
    expect(primary.props.other).toBe('Sedimentation');
  });

  it('offers a WWTP field when editing', () => {
    const tree = renderComponentsSection([{ outletNo: '1' }]);
    startEditing(tree);
    expect(tree.root.findAll(n => n.type === TextField && n.props.label === 'WWTP')).toHaveLength(1);
  });
});
