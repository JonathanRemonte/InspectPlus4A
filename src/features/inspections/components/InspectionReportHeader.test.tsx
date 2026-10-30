import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TestRenderer from 'react-test-renderer';
import { InspectionReportHeader } from './InspectionReportHeader';
import { Colors } from '../../../design/colors';
import type { TwoRowMainTabDef } from './TwoRowTabs';
import { REPORT_TYPE_DISPLAY, type ReportTypeDisplay } from '../../../constants/reportTypeDisplay';

// The header reaches the WatermelonDB adapter chain three ways — the sync
// conflict pill, the delete gate's role lookup, and the inspector-name
// resolver — none of which this file is testing. Same rationale as
// ReportListCard.test.tsx.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));
// AuthProvider transitively constructs the real Supabase client at import
// time, which throws without a configured URL. Mocked with a factory rather
// than an automock: an automock still loads the module to derive its shape,
// so it throws just the same.
jest.mock('../../../core/providers/AuthProvider', () => ({
  useAuthContext: () => ({ fullName: 'Inspector One', session: { user: { id: 'uid-1' } }, role: 'Inspector' }),
}));
jest.mock('../../../services/sync/syncConflictResolution', () => ({
  confirmResolveConflict: jest.fn(),
}));
jest.mock('../../../core/hooks/useInspectorName', () => ({
  useInspectorName: () => ({ name: 'Inspector One', loading: false }),
}));
jest.mock('../../establishments/hooks/useEstablishment', () => ({
  canManageAllRecords: () => false,
}));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

const iconGlyphTexts = (r: Renderer): Set<TestRenderer.ReactTestInstance> =>
  new Set(r.root.findAllByType(Ionicons).flatMap((icon) => icon.findAllByType(Text)));

const proseTexts = (r: Renderer) =>
  r.root.findAllByType(Text).filter((n) => !iconGlyphTexts(r).has(n));

const labels = (r: Renderer) => proseTexts(r).map((n) => n.props.children);

const tabs: TwoRowMainTabDef[] = [{ key: 'general', number: 'I', label: 'General' }];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const noop = () => {};

// The report type comes from the region's catalog; a region with no report
// types has no type colours to pin, so the type-coloured cases skip.
const TYPE_ENTRY = Object.entries(REPORT_TYPE_DISPLAY)[0];
const itWhenTyped = TYPE_ENTRY ? it : it.skip;
const TYPE_KEY = TYPE_ENTRY ? TYPE_ENTRY[0] : '';
const TYPE = TYPE_ENTRY ? TYPE_ENTRY[1] : ({} as ReportTypeDisplay);

const renderHeader = (overrides: { inspectionDate?: string; reportStatus?: string } = {}) =>
  render(
    <InspectionReportHeader
      reportId="report-1"
      establishmentName="NELTEX Philippine Hardwarehouse Co., Inc."
      establishmentLocation="Aborlan, Palawan"
      reportType={TYPE_KEY}
      reportControlNo="CTRL-1"
      inspectionDate={overrides.inspectionDate ?? daysAgo(2)}
      reportStatus={overrides.reportStatus ?? 'draft'}
      syncStatus="synced"
      inspectorUid="uid-1"
      tabs={tabs}
      activeMain="general"
      onMainChange={noop}
      onBack={noop}
    />,
  );

// A single report has no count to give, so this screen carries the state
// instead — and in the same words as the corner ribbon its card wears in the
// list, so the report does not read as two different things in two places.
describe('InspectionReportHeader due indicator', () => {
  const findUrgencyChip = (r: Renderer) => {
    const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
    const matches = views.filter(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        /^(Overdue|Due in)/.test(n.props.accessibilityLabel),
    );
    if (matches.length > 1) {
      throw new Error(`Expected at most 1 urgency chip but found ${matches.length}`);
    }
    return matches[0];
  };

  it('shows nothing for a draft that is not flagged yet', () => {
    const r = renderHeader({ inspectionDate: daysAgo(2) });
    expect(findUrgencyChip(r)).toBeUndefined();
  });

  it('shows nothing for a submitted report, however old', () => {
    const r = renderHeader({ inspectionDate: daysAgo(400), reportStatus: 'submitted' });
    expect(findUrgencyChip(r)).toBeUndefined();
  });

  // The urgency line is a solid strip under the address — the saturated hue
  // the list card's ribbon paints with, white text on it — rather than a
  // third pill in the badge column. Stacked as a pill it ran the column
  // taller than the two-line title block and left a dead band under the
  // address, and it was the same pale amber as the Draft pill beside it, so
  // the two read as one. As a saturated strip it fills that band and is
  // meant to alarm: a draft nearing its deadline should not look calm.
  const urgencyText = (r: Renderer, chip: TestRenderer.ReactTestInstance) =>
    chip.findAllByType(Text).find((n) => !iconGlyphTexts(r).has(n))!;

  it('carries the overdue state in the ribbon\'s own wording', () => {
    const r = renderHeader({ inspectionDate: daysAgo(45) });
    const chip = findUrgencyChip(r);

    expect(flattenStyle(chip.props.style).backgroundColor).toBe(Colors.hazwaste.text);
    expect(flattenStyle(urgencyText(r, chip).props.style).color).toBe(Colors.textWhite);
    expect(chip.props.accessibilityLabel).toBe('Overdue by 15 days');
    expect(labels(r)).toContain('15d late');
  });

  it('carries the due-soon state in the ribbon\'s own wording', () => {
    const r = renderHeader({ inspectionDate: daysAgo(15) });
    const chip = findUrgencyChip(r);

    expect(flattenStyle(chip.props.style).backgroundColor).toBe(Colors.warning.text);
    expect(flattenStyle(urgencyText(r, chip).props.style).color).toBe(Colors.textWhite);
    expect(chip.props.accessibilityLabel).toBe('Due in 15 days');
    expect(labels(r)).toContain('15d left');
  });

  // The whole card takes the list card's flagged tint and a thick edge in
  // the ribbon's hue, so the report is visibly flagged the moment the screen
  // opens and stays flagged through the collapse — the edge and tint are the
  // parts of the card that never change shape.
  const findCard = (r: Renderer) =>
    r.root.find(
      (n) =>
        n.type === View &&
        flattenStyle(n.props.style).marginHorizontal === 12 &&
        flattenStyle(n.props.style).borderRadius === 14,
    );

  it('tints the card and thickens its edge for a due-soon draft', () => {
    const card = flattenStyle(findCard(renderHeader({ inspectionDate: daysAgo(15) })).props.style);
    expect(card.backgroundColor).toBe(Colors.warning.bg);
    expect(card.borderColor).toBe(Colors.warning.border);
    expect(card.borderLeftWidth).toBe(5);
    expect(card.borderLeftColor).toBe(Colors.warning.text);
  });

  it('tints the card red for an overdue draft', () => {
    const card = flattenStyle(findCard(renderHeader({ inspectionDate: daysAgo(45) })).props.style);
    expect(card.backgroundColor).toBe(Colors.hazwaste.bg);
    expect(card.borderLeftColor).toBe(Colors.hazwaste.text);
  });

  // Identity versus alarm. Border and edge always say what kind of report
  // this is; tint and stamp say only that its deadline is close. So an
  // unflagged card wears its type's colours on a white ground, and a flagged
  // one hands border and edge over to the urgency hue along with the tint.
  // Hazwaste's own red is the overdue red, which is exactly why the type
  // never tints: an overdue hazwaste report has to look different from a
  // hazwaste report.
  itWhenTyped('gives an unflagged card its type’s border and edge on a white ground', () => {
    const card = flattenStyle(findCard(renderHeader({ inspectionDate: daysAgo(2) })).props.style);
    expect(card.backgroundColor).toBe(Colors.white);
    expect(card.borderColor).toBe(TYPE.borderColor);
    expect(card.borderLeftWidth).toBe(5);
    expect(card.borderLeftColor).toBe(TYPE.textColor);
  });

  // The three meta chips (date, control number, inspector) follow the card:
  // type tint when it is plain, white when it is tinted so they sit on the
  // alarm colour rather than sinking into it.
  const findMetaChips = (r: Renderer) =>
    r.root.findAll(
      (n) =>
        n.type === View &&
        flattenStyle(n.props.style).borderRadius === 8 &&
        flattenStyle(n.props.style).paddingHorizontal === 9,
    );

  itWhenTyped('tints the meta chips with the report type on an unflagged card', () => {
    const chips = findMetaChips(renderHeader({ inspectionDate: daysAgo(2) }));
    expect(chips).toHaveLength(3);
    chips.forEach((chip) => {
      expect(flattenStyle(chip.props.style).backgroundColor).toBe(TYPE.bgColor);
      expect(flattenStyle(chip.props.style).borderColor).toBe(TYPE.borderColor);
    });
  });

  // Only the fill changes on a flagged card. Border and icon keep the type
  // colour, as the R.A. pill beside them does — a chip that went grey all
  // over read as a generic chip, not as a water chip that happens to be
  // sitting on an alarm.
  itWhenTyped('turns the meta chips white on a flagged card but keeps their type border and icon', () => {
    const r = renderHeader({ inspectionDate: daysAgo(15) });
    const chips = findMetaChips(r);
    expect(chips).toHaveLength(3);
    chips.forEach((chip) => {
      expect(flattenStyle(chip.props.style).backgroundColor).toBe(Colors.white);
      expect(flattenStyle(chip.props.style).borderColor).toBe(TYPE.borderColor);
      expect(chip.findByType(Ionicons).props.color).toBe(TYPE.textColor);
    });
  });

  // The tile is the largest coloured element on the card and the one the
  // list card already paints in the type's colours, with the type's own
  // glyph. A brand-green document glyph here made the same report look like
  // two different kinds of thing on the list and on its own screen.
  const findTile = (r: Renderer) =>
    r.root.findAll((n) => n.type === Ionicons && n.props.name === TYPE.icon)[0];

  itWhenTyped("paints the type tile with the type's glyph and colours, like the list card", () => {
    const glyph = findTile(renderHeader({ inspectionDate: daysAgo(2) }));
    expect(glyph).toBeDefined();
    expect(glyph.props.color).toBe(TYPE.textColor);
    // Walk up to the tile box: the nearest ancestor carrying a backgroundColor.
    let box = glyph.parent;
    while (box && flattenStyle(box.props.style).backgroundColor === undefined) box = box.parent;
    expect(flattenStyle(box!.props.style).backgroundColor).toBe(TYPE.bgColor);
  });

  itWhenTyped('keeps the type tile in type colours even on a flagged card', () => {
    expect(findTile(renderHeader({ inspectionDate: daysAgo(15) })).props.color).toBe(TYPE.textColor);
  });

  itWhenTyped('paints the location pin in the type colour', () => {
    const r = renderHeader({ inspectionDate: daysAgo(2) });
    const pin = r.root.findAll((n) => n.type === Ionicons && n.props.name === 'location')[0];
    expect(pin.props.color).toBe(TYPE.textColor);
  });

  // The Draft pill is pale amber; the due-soon tint is pale amber. On a
  // flagged card the pill goes white with an outline in its own colour so
  // the two stop being the same colour.
  const findStatusPill = (r: Renderer) =>
    r.root.findAll((n) => n.type === Text && n.props.children === 'Draft')[0].parent!;

  it('outlines the Draft pill on a flagged card so it does not sink into the tint', () => {
    const pill = flattenStyle(findStatusPill(renderHeader({ inspectionDate: daysAgo(15) })).props.style);
    expect(pill.backgroundColor).toBe(Colors.white);
    expect(pill.borderWidth).toBe(1);
    expect(pill.borderColor).toBe(Colors.warning.text);
  });

  it('leaves the Draft pill filled on an unflagged card', () => {
    const pill = flattenStyle(findStatusPill(renderHeader({ inspectionDate: daysAgo(2) })).props.style);
    expect(pill.backgroundColor).toBe(Colors.warning.badgeBg);
    expect(pill.borderWidth).toBeUndefined();
  });

  // The Draft/Submitted chip says where the report stands with filing; the
  // urgency line says how that is going against the clock. They are different
  // facts and both belong.
  it('sits beside the Draft chip rather than replacing it', () => {
    const r = renderHeader({ inspectionDate: daysAgo(45) });
    expect(labels(r)).toContain('Draft');
    expect(labels(r)).toContain('15d late');
  });

  // Placement: the top of the badge column, above the status pill. That is
  // the slot the eye goes to for a card's status, so the alarm takes it. It
  // fits there now because the law pill is gone — the tile, pin, chips, edge
  // and tabs all say the type, and the law is a function of the type, so
  // the pill was saying it a seventh time. Two lines on the left, two pills
  // on the right: the card balances without a stamp under the address.
  it('sits at the top of the badge column, above the status pill', () => {
    const r = renderHeader({ inspectionDate: daysAgo(15) });
    const stamp = findUrgencyChip(r);
    const pill = findStatusPill(r);
    // Same column: both live inside the badge group. Render order alone
    // can't tell "under the address" from "top of the badge column", since
    // both precede Draft; containment can. (Not a parent comparison: the
    // two locators land at different depths of RN's composite/host View
    // pairs, and a failing toBe on test instances pretty-prints whole trees
    // and exhausts the heap.)
    const badgeGroup = r.root.findAll(
      (n) =>
        n.type === View &&
        flattenStyle(n.props.style).flexDirection === 'column' &&
        flattenStyle(n.props.style).alignItems === 'flex-end',
    )[0];
    const contains = (node: TestRenderer.ReactTestInstance) =>
      badgeGroup.findAll((n) => n === node).length > 0;
    expect(contains(stamp)).toBe(true);
    expect(contains(pill)).toBe(true);
    const order = labels(r);
    expect(order.indexOf('15d left')).toBeLessThan(order.indexOf('Draft'));
  });

  it('no longer shows a law pill — the type is carried everywhere else', () => {
    const r = renderHeader({ inspectionDate: daysAgo(2) });
    expect(labels(r)).not.toContain('R.A. 9275');
  });
});
