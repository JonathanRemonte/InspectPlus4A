import { REPORT_TYPE_DISPLAY, ReportDataKey } from '../../constants/reportTypeDisplay';
import { Colors } from '../../design/colors';

// All five recorded-report buckets the data layer actually stores.
const ALL_DATA_KEYS: ReportDataKey[] = [
  'air_monitoring',
  'water_monitoring',
  'hazardous_waste',
  'eia',
  'survey',
];

describe('REPORT_TYPE_DISPLAY', () => {
  it('has exactly the five recorded-report keys, no more and no fewer', () => {
    expect(Object.keys(REPORT_TYPE_DISPLAY).sort()).toEqual([...ALL_DATA_KEYS].sort());
  });

  it.each(ALL_DATA_KEYS)('%s resolves every field to a defined, non-empty value', (key) => {
    const entry = REPORT_TYPE_DISPLAY[key];
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.icon.length).toBeGreaterThan(0);
    expect(entry.bgColor.length).toBeGreaterThan(0);
    expect(entry.borderColor.length).toBeGreaterThan(0);
    expect(entry.textColor.length).toBeGreaterThan(0);
    expect(entry.badgeBg.length).toBeGreaterThan(0);
    expect(entry.badgeText.length).toBeGreaterThan(0);
  });

  // Each bucket's colors must be sourced from that bucket's own Colors token
  // group, not a neighbor's (the water-blue-everywhere bug was exactly this
  // kind of cross-wiring).
  it('air_monitoring resolves colors from Colors.air', () => {
    expect(REPORT_TYPE_DISPLAY.air_monitoring.bgColor).toBe(Colors.air.bg);
    expect(REPORT_TYPE_DISPLAY.air_monitoring.borderColor).toBe(Colors.air.border);
    expect(REPORT_TYPE_DISPLAY.air_monitoring.textColor).toBe(Colors.air.text);
    expect(REPORT_TYPE_DISPLAY.air_monitoring.badgeBg).toBe(Colors.air.badgeBg);
    expect(REPORT_TYPE_DISPLAY.air_monitoring.badgeText).toBe(Colors.air.badgeText);
  });

  it('water_monitoring resolves colors from Colors.water', () => {
    expect(REPORT_TYPE_DISPLAY.water_monitoring.bgColor).toBe(Colors.water.bg);
    expect(REPORT_TYPE_DISPLAY.water_monitoring.borderColor).toBe(Colors.water.border);
    expect(REPORT_TYPE_DISPLAY.water_monitoring.textColor).toBe(Colors.water.text);
    expect(REPORT_TYPE_DISPLAY.water_monitoring.badgeBg).toBe(Colors.water.badgeBg);
    expect(REPORT_TYPE_DISPLAY.water_monitoring.badgeText).toBe(Colors.water.badgeText);
  });

  it('hazardous_waste resolves colors from Colors.hazwaste', () => {
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.bgColor).toBe(Colors.hazwaste.bg);
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.borderColor).toBe(Colors.hazwaste.border);
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.textColor).toBe(Colors.hazwaste.text);
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.badgeBg).toBe(Colors.hazwaste.badgeBg);
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.badgeText).toBe(Colors.hazwaste.badgeText);
  });

  it('eia resolves colors from Colors.eia', () => {
    expect(REPORT_TYPE_DISPLAY.eia.bgColor).toBe(Colors.eia.bg);
    expect(REPORT_TYPE_DISPLAY.eia.borderColor).toBe(Colors.eia.border);
    expect(REPORT_TYPE_DISPLAY.eia.textColor).toBe(Colors.eia.text);
    expect(REPORT_TYPE_DISPLAY.eia.badgeBg).toBe(Colors.eia.badgeBg);
    expect(REPORT_TYPE_DISPLAY.eia.badgeText).toBe(Colors.eia.badgeText);
  });

  it('survey resolves colors from Colors.survey', () => {
    expect(REPORT_TYPE_DISPLAY.survey.bgColor).toBe(Colors.survey.bg);
    expect(REPORT_TYPE_DISPLAY.survey.borderColor).toBe(Colors.survey.border);
    expect(REPORT_TYPE_DISPLAY.survey.textColor).toBe(Colors.survey.text);
    expect(REPORT_TYPE_DISPLAY.survey.badgeBg).toBe(Colors.survey.badgeBg);
    expect(REPORT_TYPE_DISPLAY.survey.badgeText).toBe(Colors.survey.badgeText);
  });

  // Regression coverage for the specific drift bug: eia and survey had
  // swapped icons between REPORT_TYPES (create-flow) and the old
  // ReportListCard REPORT_ICONS (recorded-report). Assert the resolved,
  // now-correct icon names directly rather than just "is defined".
  it('eia uses document-text-outline, not survey\'s globe-outline', () => {
    expect(REPORT_TYPE_DISPLAY.eia.icon).toBe('document-text-outline');
  });

  it('survey uses globe-outline, not eia\'s document-text-outline', () => {
    expect(REPORT_TYPE_DISPLAY.survey.icon).toBe('globe-outline');
  });

  it('air_monitoring and water_monitoring keep their own distinct icons', () => {
    expect(REPORT_TYPE_DISPLAY.air_monitoring.icon).toBe('partly-sunny-outline');
    expect(REPORT_TYPE_DISPLAY.water_monitoring.icon).toBe('water-outline');
  });

  it('hazardous_waste uses the generator flow\'s warning icon for the collapsed bucket', () => {
    expect(REPORT_TYPE_DISPLAY.hazardous_waste.icon).toBe('warning-outline');
  });

  // The card renders each type as a coloured glyph on a tint of its own hue.
  // That only works as a scanning aid if every type is a saturated hue —
  // a neutral text grey reads as "no type" rather than as a type.
  //
  // Air is the one deliberate exception. It was gray, went orange to satisfy
  // this rule, and went back to gray by decision (see the comment on
  // Colors.air) — so the rule still guards the other four, and air is
  // pinned to its chosen gray separately rather than silently exempted.
  const NEUTRALS = [Colors.textPrimary, Colors.textSecondary, Colors.textMuted, Colors.textLight];
  const SATURATED_KEYS = ALL_DATA_KEYS.filter((key) => key !== 'air_monitoring');

  it.each(SATURATED_KEYS)('%s uses a saturated glyph colour, not a neutral text token', (key) => {
    expect(NEUTRALS).not.toContain(REPORT_TYPE_DISPLAY[key].textColor);
  });

  it('air_monitoring is gray by decision, matching the speed dial', () => {
    expect(REPORT_TYPE_DISPLAY.air_monitoring.textColor).toBe(Colors.textMuted);
  });

  // Two types sharing a glyph colour would make the tile useless for telling
  // them apart at a glance, which is the only job it has.
  it('gives every type a glyph colour distinct from every other type', () => {
    const glyphColors = ALL_DATA_KEYS.map((key) => REPORT_TYPE_DISPLAY[key].textColor);
    expect(new Set(glyphColors).size).toBe(ALL_DATA_KEYS.length);
  });

  it('gives every type a tile background distinct from every other type', () => {
    const tints = ALL_DATA_KEYS.map((key) => REPORT_TYPE_DISPLAY[key].bgColor);
    expect(new Set(tints).size).toBe(ALL_DATA_KEYS.length);
  });
});
