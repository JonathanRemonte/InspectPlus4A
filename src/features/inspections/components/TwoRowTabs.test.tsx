import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { TwoRowTabs, TwoRowMainTabDef } from './TwoRowTabs';
import { ReportThemeProvider } from '../../../core/providers/ReportThemeProvider';
import { Colors } from '../../../constants/colors';
import { REPORT_TYPE_DISPLAY } from '../../../constants/reportTypeDisplay';

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

const tabs: TwoRowMainTabDef[] = [
  { key: 'geninfo', number: '1', label: 'General Information' },
  { key: 'purpose', number: '2', label: 'Purpose of Inspection' },
];

const render = (element: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

// The active tab is the one that can't share a colour with a resting tab, so
// it is where the accent goes: its top edge and its label. Everything else
// about the tab strip — resting tabs, borders, the muted labels — is
// structure and stays as it was.
const activeTab = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.type === TouchableOpacity).find((n) => flattenStyle(n.props.style).borderTopWidth === 3)!;
const activeLabel = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.type === Text && n.props.children === 'General Information')[0];

// The report type comes from the region's catalog; with no report types there
// is no accent to pin, so the accented cases skip.
const ACCENTED = Object.entries(REPORT_TYPE_DISPLAY)[0];
const itWhenAccented = ACCENTED ? it : it.skip;
const [ACCENT_KEY, ACCENT_DISPLAY] = ACCENTED ?? ['', undefined];

describe('TwoRowTabs report accent', () => {
  it('keeps the active tab brand green outside a report screen', () => {
    const r = render(<TwoRowTabs tabs={tabs} activeMain="geninfo" onMainChange={() => {}} />);
    expect(flattenStyle(activeTab(r).props.style).borderTopColor).toBe(Colors.green);
    expect(flattenStyle(activeLabel(r).props.style).color).toBe(Colors.green);
  });

  itWhenAccented("paints the active tab in the report type's accent inside one", () => {
    const r = render(
      <ReportThemeProvider reportType={ACCENT_KEY}>
        <TwoRowTabs tabs={tabs} activeMain="geninfo" onMainChange={() => {}} />
      </ReportThemeProvider>,
    );
    expect(flattenStyle(activeTab(r).props.style).borderTopColor).toBe(ACCENT_DISPLAY?.textColor);
    expect(flattenStyle(activeLabel(r).props.style).color).toBe(ACCENT_DISPLAY?.textColor);
  });

  itWhenAccented('leaves a resting tab’s label muted whatever the accent', () => {
    const r = render(
      <ReportThemeProvider reportType={ACCENT_KEY}>
        <TwoRowTabs tabs={tabs} activeMain="geninfo" onMainChange={() => {}} />
      </ReportThemeProvider>,
    );
    const resting = r.root.findAll((n) => n.type === Text && n.props.children === 'Purpose of Inspection')[0];
    expect(flattenStyle(resting.props.style).color).toBe(Colors.textMuted);
  });
});
