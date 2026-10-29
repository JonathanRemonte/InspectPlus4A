import { REPORT_TYPES, ReportType, ReportTypeKey } from '../../constants/reportTypes';
import { REPORT_TYPE_DISPLAY, ReportDataKey } from '../../constants/reportTypeDisplay';
import { Colors } from '../../design/colors';

// Locate a create-flow entry by its key. Throws instead of silently
// returning undefined if the key is missing or (impossibly, given the
// array's static literal contents) duplicated — matching the Card/Badge
// test convention of failing loudly on a mis-specific locator.
function findEntry(key: ReportTypeKey): ReportType {
  const matches = REPORT_TYPES.filter((entry) => entry.key === key);
  if (matches.length === 0) {
    throw new Error(`No REPORT_TYPES entry found for key "${key}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Expected exactly 1 REPORT_TYPES entry for key "${key}" but found ${matches.length}`);
  }
  return matches[0];
}

// entry key -> [expected dataKey, expected shortTitle], taken verbatim from the task brief's table.
const EXPECTED: Record<ReportTypeKey, [ReportDataKey, string]> = {
  air: ['air_monitoring', 'Air quality'],
  water: ['water_monitoring', 'Water quality'],
  hazwaste_generator: ['hazardous_waste', 'Hazwaste generators'],
  hazwaste_tsd: ['hazardous_waste', 'Hazwaste TSD'],
  eia: ['eia', 'EIA'],
  survey: ['survey', 'Site survey'],
};

describe('REPORT_TYPES dataKey/shortTitle', () => {
  it('has exactly the six create-flow keys', () => {
    expect(REPORT_TYPES.map((e) => e.key).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED) as [ReportTypeKey, [ReportDataKey, string]][])(
    '%s declares dataKey and shortTitle from the brief\'s table',
    (key, [expectedDataKey, expectedShortTitle]) => {
      const entry = findEntry(key);
      expect(entry.dataKey).toBe(expectedDataKey);
      expect(entry.shortTitle).toBe(expectedShortTitle);
    },
  );

  // The legitimate many-to-one: both hazwaste create-flows collapse onto the
  // same recorded-report bucket. This is the central invariant the whole
  // task exists to encode explicitly and test for.
  it('both hazwaste_generator and hazwaste_tsd map to the same hazardous_waste dataKey', () => {
    const generator = findEntry('hazwaste_generator');
    const tsd = findEntry('hazwaste_tsd');
    expect(generator.dataKey).toBe('hazardous_waste');
    expect(tsd.dataKey).toBe('hazardous_waste');
    expect(generator.dataKey).toBe(tsd.dataKey);
  });

  // Every dataKey a create-flow entry declares must actually exist as a
  // recorded-report bucket in REPORT_TYPE_DISPLAY — the whole point of the
  // typed link is that this can't silently drift apart.
  it('every dataKey resolves to a real REPORT_TYPE_DISPLAY entry', () => {
    REPORT_TYPES.forEach((entry) => {
      expect(REPORT_TYPE_DISPLAY[entry.dataKey]).toBeDefined();
    });
  });

  // The five distinct dataKey values used across all six entries must be
  // exactly the five recorded-report buckets — no create-flow entry points
  // at a sixth, nonexistent bucket, and none of the five buckets is orphaned.
  it('the set of distinct dataKeys across all entries equals the five recorded-report buckets', () => {
    const distinctDataKeys = new Set(REPORT_TYPES.map((e) => e.dataKey));
    expect([...distinctDataKeys].sort()).toEqual(
      (Object.keys(REPORT_TYPE_DISPLAY) as ReportDataKey[]).sort(),
    );
  });
});

// The speed dial once carried its own hex copy of every type's colours and
// drifted: air was changed to orange in the design palette while this file
// still said gray, so the dial disagreed with every other air surface. Each
// entry now reads the palette directly, and this pins that it stays so.
describe('REPORT_TYPES colours come from the design palette', () => {
  const PALETTE: Record<ReportTypeKey, { bg: string; border: string; text: string }> = {
    air: Colors.air,
    water: Colors.water,
    hazwaste_generator: Colors.hazwaste,
    hazwaste_tsd: Colors.warning,
    eia: Colors.eia,
    survey: Colors.survey,
  };

  it.each(Object.keys(PALETTE) as ReportTypeKey[])('%s reads Colors, not literals', key => {
    const entry = findEntry(key);
    expect(entry.bgColor).toBe(PALETTE[key].bg);
    expect(entry.borderColor).toBe(PALETTE[key].border);
    expect(entry.textColor).toBe(PALETTE[key].text);
  });

  // Gray, by decision: it is what the speed dial showed and was approved
  // against, so the palette moved to meet the dial rather than the reverse.
  it('air is the gray the speed dial always showed', () => {
    expect(Colors.air.bg).toBe('#f9fafb');
    expect(Colors.air.border).toBe('#d1d5db');
    expect(Colors.air.text).toBe('#6b7280');
  });
});
