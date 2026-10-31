import React from 'react';
import { Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { ReportThemeProvider, useReportAccent } from './ReportThemeProvider';
import { Colors } from '../../design/colors';
import { REPORT_TYPE_DISPLAY } from '../../constants/reportTypeDisplay';

// Report types come from the region's catalog; a region with no types has
// nothing to theme, so the per-type cases skip.
const DISPLAYS = Object.entries(REPORT_TYPE_DISPLAY);
const itWhenTypes = DISPLAYS.length > 0 ? it : it.skip;
const itWhenTwoTypes = DISPLAYS.length > 1 ? it : it.skip;
const [FIRST_KEY, FIRST] = DISPLAYS[0] ?? ['', undefined];
const [SECOND_KEY, SECOND] = DISPLAYS[1] ?? ['', undefined];

// A probe that renders whatever accent the hook hands it, so a test can read
// the resolved colour straight off the tree.
const Probe: React.FC<{ fallback: string }> = ({ fallback }) => <Text>{useReportAccent(fallback)}</Text>;

const accentOf = (element: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r.root.findByType(Text).props.children as string;
};

// The accent is the report type's own text colour — the one its list tile,
// R.A. pill and header edge already use — so a form themed by it reads as
// the same kind of report everywhere. Outside a report screen there is no
// type to take it from, and each consumer keeps the colour it always had.
describe('useReportAccent', () => {
  it('hands back the fallback outside any provider', () => {
    expect(accentOf(<Probe fallback={Colors.navy} />)).toBe(Colors.navy);
  });

  itWhenTypes("hands back the report type's text colour inside a provider", () => {
    expect(
      accentOf(
        <ReportThemeProvider reportType={FIRST_KEY}>
          <Probe fallback={Colors.navy} />
        </ReportThemeProvider>,
      ),
    ).toBe(FIRST?.textColor);
  });

  itWhenTwoTypes('themes each type with its own colour, not a shared one', () => {
    const first = accentOf(
      <ReportThemeProvider reportType={FIRST_KEY}><Probe fallback={Colors.navy} /></ReportThemeProvider>,
    );
    const second = accentOf(
      <ReportThemeProvider reportType={SECOND_KEY}><Probe fallback={Colors.navy} /></ReportThemeProvider>,
    );
    expect(first).toBe(FIRST?.textColor);
    expect(second).toBe(SECOND?.textColor);
    expect(first).not.toBe(second);
  });

  // A report written by a newer build with a type this one doesn't know
  // must still render — with the consumer's own default, not a crash.
  it('hands back the fallback for a type it does not recognise', () => {
    expect(
      accentOf(
        <ReportThemeProvider reportType="noise_monitoring">
          <Probe fallback={Colors.green} />
        </ReportThemeProvider>,
      ),
    ).toBe(Colors.green);
  });
});
