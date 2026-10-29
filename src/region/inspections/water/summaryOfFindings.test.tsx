import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { YesNoNAToggle } from '../../../components/form';
import { YnBadge } from '../../../features/inspections/components/ComplianceReadPrimitives';
import { WaterExtraFormSectionsView } from './WaterExtraFormSections';
import { SummaryOfFindingsSection } from './WaterComplianceEditSections';
import { buildWaterReportTabs } from './waterReportTabs';
import { WATER_FINDINGS_CHECKLIST } from './waterChecklistData';
import {
  emptyWaterComplianceForm,
  findingsEntriesForSave,
  findingsValuesFromEntries,
  WaterComplianceFormState,
} from './waterTypes';

// Section III is the printed form's "Summary of Findings" checklist - 18
// questions in four legal-reference groups, each Y / N / N/A with a remark.

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

const flatten = (node: renderer.ReactTestRendererNode | renderer.ReactTestRendererNode[] | null): string =>
  node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node.children ?? null);
const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map(t => flatten(t.children as renderer.ReactTestRendererNode[]));

describe('the checklist itself', () => {
  const byGroup = (group: string) => WATER_FINDINGS_CHECKLIST.filter(i => i.group === group);

  it('has the template\'s 18 questions in its four groups, in order', () => {
    expect(WATER_FINDINGS_CHECKLIST).toHaveLength(18);
    expect([...new Set(WATER_FINDINGS_CHECKLIST.map(i => i.group))]).toEqual([
      'DAO 2005-10',
      'DAO 1990-35',
      'DAO 1990-25',
      'Other Requirements',
    ]);
    expect(byGroup('DAO 2005-10')).toHaveLength(8);
    expect(byGroup('DAO 1990-35')).toHaveLength(3);
    expect(byGroup('DAO 1990-25')).toHaveLength(1);
    expect(byGroup('Other Requirements')).toHaveLength(6);
  });

  it('carries the printed legal references, with none on the Other Requirements', () => {
    expect(byGroup('DAO 2005-10').map(i => i.ref)).toEqual([
      'Rule 13.1', 'Rule 14.1', 'Rule 14.5', 'Rule 14.9', 'Rule 14.11', 'Rule 14.11', 'Rule 14.11', 'Rule 14.16',
    ]);
    expect(byGroup('DAO 1990-35').map(i => i.ref)).toEqual(['Sec. 4-6', 'Sec. 9', 'Sec. 10']);
    expect(byGroup('DAO 1990-25').map(i => i.ref)).toEqual(['Sec. 8']);
    expect(byGroup('Other Requirements').every(i => i.ref === '')).toBe(true);
  });

  it('gives every question a stable, unique key - three share Rule 14.11', () => {
    const keys = WATER_FINDINGS_CHECKLIST.map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(k => /^[a-z0-9-]+$/.test(k))).toBe(true);
  });

  it('reads as the printed questions, with the obvious typos corrected', () => {
    const q = WATER_FINDINGS_CHECKLIST.map(i => i.requirement);
    expect(q[0]).toBe('Does the establishment pay the required wastewater charge?');
    expect(q).toContain('Does the establishment have a discharge permit?');
    expect(q).toContain('Are the SMRs submitted quarterly and on time?');
    expect(q).toContain('Does the establishment comply with the additional requirements stated in DAO 1990-35?');
    expect(q).toContain('Is there a spill prevention contingency plan?');
    expect(q).toContain('Are there spill containment facilities available?');
    expect(q.every(s => s.endsWith('?'))).toBe(true);
  });
});

describe('what reaches the record', () => {
  const values = WATER_FINDINGS_CHECKLIST.map((_, i) => ({
    compliant: i === 1 ? ('Y' as const) : null,
    remarks: i === 1 ? 'DP No. 123' : '',
  }));

  it('writes one self-describing entry per question, keyed', () => {
    const entries = findingsEntriesForSave(values);
    expect(entries).toHaveLength(18);
    expect(entries[1]).toEqual({
      key: WATER_FINDINGS_CHECKLIST[1].key,
      legal_ref: 'DAO 2005-10 Rule 14.1',
      requirement: 'Does the establishment have a discharge permit?',
      compliant: 'Y',
      remarks: 'DP No. 123',
    });
    // No reference on an Other Requirements question.
    expect(entries[17].legal_ref).toBe('Other Requirements');
  });

  it('reads answers back by key, not position', () => {
    const entries = findingsEntriesForSave(values);
    const shuffled = [...entries].reverse();
    expect(findingsValuesFromEntries(shuffled)).toEqual(values);
  });

  // Reports written against the old six "Section N" placeholders carry no
  // keys; they open blank on the new list rather than mis-mapping by index.
  it('ignores entries from the retired checklist', () => {
    const legacy = [
      { legal_ref: 'Section 3', compliant: 'Y', remarks: 'old' },
      { legal_ref: 'Section 4', compliant: 'N', remarks: '' },
    ];
    const blank = findingsValuesFromEntries(legacy);
    expect(blank).toHaveLength(18);
    expect(blank.every(v => v.compliant === null && v.remarks === '')).toBe(true);
  });
});

describe('III. Summary of Findings (create form)', () => {
  const renderForm = (onChange: (v: WaterComplianceFormState) => void = () => {}) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <WaterExtraFormSectionsView value={emptyWaterComplianceForm()} onChange={onChange} mainTab={samplingTab} hasDp={false} province="Marinduque" />,
      );
    });
    return tree;
  };

  it('starts with one blank answer per question', () => {
    expect(emptyWaterComplianceForm().checklistDao200510).toHaveLength(18);
  });

  it('lays the questions out under their four group headings', () => {
    const t = texts(renderForm());
    for (const heading of ['DAO 2005-10', 'DAO 1990-35', 'DAO 1990-25', 'Other Requirements']) {
      expect(t).toContain(heading);
    }
    expect(t).toContain('Does the establishment have a discharge permit?');
    expect(t).toContain('Are there spill containment facilities available?');
  });

  it('records an answer against the right question', () => {
    const onChange = jest.fn();
    const tree = renderForm(onChange);
    // Toggles render in checklist order; section III's are the only ones on
    // an otherwise empty tab (no sampling points, no DP conditions).
    const toggles = tree.root.findAllByType(YesNoNAToggle);
    expect(toggles).toHaveLength(18);
    act(() => { toggles[1].props.onChange('Y'); });
    const next = onChange.mock.calls[0][0] as WaterComplianceFormState;
    expect(next.checklistDao200510[1]).toEqual({ compliant: 'Y', remarks: '' });
    expect(next.checklistDao200510[0]).toEqual({ compliant: null, remarks: '' });
  });
});

describe('III. Summary of Findings (edit screen)', () => {
  type Stored = React.ComponentProps<typeof SummaryOfFindingsSection>['value'];
  const renderSection = (value: Stored) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<SummaryOfFindingsSection complianceId="c1" value={value} canEdit onSaved={() => {}} />);
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

  it('shows every question with its answer, grouped, on the read-only card', () => {
    const stored = findingsEntriesForSave(
      WATER_FINDINGS_CHECKLIST.map((_, i) => ({ compliant: i === 3 ? ('N' as const) : null, remarks: i === 3 ? 'Expired' : '' })),
    );
    const tree = renderSection(stored);
    const t = texts(tree);
    expect(t).toContain('DAO 1990-35');
    expect(t).toContain('Is the permit available and valid?');
    expect(t).toContain('Expired');
    const badges = tree.root.findAllByType(YnBadge);
    expect(badges).toHaveLength(18);
    expect(badges[3].props.value).toBe('N');
  });

  it('round-trips an answer through save, keyed', async () => {
    const tree = startEdit(renderSection([]));
    const toggles = tree.root.findAllByType(YesNoNAToggle);
    expect(toggles).toHaveLength(18);
    act(() => { toggles[17].props.onChange('NA'); });
    const actions = tree.root.findAll(n => n.props?.onSave != null && n.props?.onStartEdit != null);
    await act(async () => { await actions[0].props.onSave(); });
    const saved = mockPatches[0].checklistDao200510 as { key: string; compliant: string | null }[];
    expect(saved).toHaveLength(18);
    expect(saved[17]).toEqual(expect.objectContaining({ key: WATER_FINDINGS_CHECKLIST[17].key, compliant: 'NA' }));
  });
});
