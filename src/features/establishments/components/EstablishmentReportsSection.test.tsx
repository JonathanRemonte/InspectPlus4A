import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import TestRenderer from 'react-test-renderer';
import { Polygon, Text as SvgText } from 'react-native-svg';
import { EstablishmentReportsSection } from './EstablishmentReportsSection';
import { REPORT_TYPE_DISPLAY, ReportDataKey } from '../../../constants/reportTypeDisplay';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { FONT_SCALING, Type } from '../../../design/typography';
import type { EstablishmentReportItem } from '../hooks/useEstablishment';
import { Badge } from '../../../components/Badge';
import { RowActionsButton } from '../../../components/RowActionsButton';

// getReportUrgency resolves thresholds through urgencyConfig, which returns
// the build-time ENV defaults whenever its module-level snapshot has never
// been hydrated. Nothing in this file mocks or hydrates urgencyConfig, so
// that unhydrated-snapshot state is what makes these assertions line up with
// ENV's 14/30 rather than something else. A future test that calls
// hydrateUrgencyConfig or refreshUrgencyConfig here would leak that snapshot
// into every other test in this file, since the module holds it in scope
// shared across the whole suite.

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

// Locate the report-icon wrap View by its resolved shape (width 38 / height
// 38 / borderRadius Radius.md — unique to this element in the row). Throws
// if zero or more than one match is found, per the ReportListCard/
// EstablishmentCard locator convention.
const findIconWrap = (r: Renderer) => {
  const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
  const matches = views.filter((n) => {
    const flattened = flattenStyle(n.props.style);
    return flattened.width === 38 && flattened.height === 38 && flattened.borderRadius === Radius.md;
  });
  if (matches.length === 0) {
    throw new Error('No icon wrap View found: expected a View with width===38, height===38, borderRadius===Radius.md');
  }
  if (matches.length > 1) {
    throw new Error(`Expected 1 icon wrap View but found ${matches.length}; the locator is not sufficiently specific`);
  }
  return matches[0];
};

// react-native's own TouchableOpacity module is a thin wrapper that spreads
// every prop it receives onto an inner, unexported class component of the
// same displayName, so a props-only predicate double-matches: once on the
// outer wrapper fiber, once on the inner one. Anchoring on
// `n.type === TouchableOpacity` (the same module reference this file and
// EstablishmentReportsSection.tsx both resolve to, and that Button.tsx also
// resolves to for the Add Report control) narrows a find/findAll to the
// outer fiber only — same convention as ReportListCard.test.tsx /
// EstablishmentCard.test.tsx.
const findRow = (r: Renderer, item: EstablishmentReportItem) =>
  r.root.find((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === item.title);

// Delete used to be a button revealed by swiping; it is now declared to
// RowActionsButton, which shows it in a menu.
const findDeleteButtons = (r: Renderer, item: EstablishmentReportItem) => {
  const menus = findRow(r, item).findAllByType(RowActionsButton);
  return menus.length === 0
    ? []
    : menus[0].props.actions.filter((a: { id: string }) => a.id === 'delete');
};

const findAddReportButton = (r: Renderer) =>
  r.root.find((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Add Report');

// @expo/vector-icons renders its glyph as a Text under the hood, with the
// icon's `size` prop applied as that Text's fontSize — that's an icon size,
// not prose, so it must be excluded before checking the type scale's floor.
// Same technique as EstablishmentCard.test.tsx.
const iconGlyphTexts = (r: Renderer): Set<TestRenderer.ReactTestInstance> =>
  new Set(r.root.findAllByType(Ionicons).flatMap((icon) => icon.findAllByType(Text)));

const proseTexts = (r: Renderer) => {
  const glyphs = iconGlyphTexts(r);
  return r.root.findAllByType(Text).filter((n) => !glyphs.has(n));
};

const allFontSizes = (r: Renderer): number[] =>
  proseTexts(r)
    .map((n) => flattenStyle(n.props.style).fontSize)
    .filter((size): size is number => typeof size === 'number');

// This task made the control number resolve to Colors.textMuted too (it now
// shares the date's exact style), so a bare color-based lookup for the date
// text would double-match date + control number, on top of the calendar
// icon's own glyph Text that proseTexts() already excludes. The control
// number is already locatable unambiguously by its own text content
// (item.controlNo), so excluding it here narrows the remaining color match
// back down to exactly one. Throws if zero or more than one candidate
// remains — same zero-or-multiple guard as findIconWrap above.
const findDateText = (r: Renderer, excluding?: TestRenderer.ReactTestInstance) => {
  const matches = proseTexts(r).filter(
    (n) => flattenStyle(n.props.style).color === Colors.textMuted && n !== excluding,
  );
  if (matches.length === 0) {
    throw new Error('No date Text found: expected a prose Text with color === Colors.textMuted');
  }
  if (matches.length > 1) {
    throw new Error(`Expected 1 date Text but found ${matches.length}; the locator is not sufficiently specific`);
  }
  return matches[0];
};

// RN defaults allowFontScaling to true when the prop is omitted entirely, as
// the date Text does — normalizing through this lets the control number's
// explicit FONT_SCALING.content and the date's implicit default be compared
// as equal.
const resolvedAllowFontScaling = (n: TestRenderer.ReactTestInstance | undefined): boolean =>
  (n?.props.allowFontScaling as boolean | undefined) ?? true;

// Locates dateRow's own direct children via the calendar icon's parent —
// throws on zero-or-multiple calendar icons so a structural change upstream
// fails loudly here rather than silently returning the wrong row.
const findDateRowChildren = (r: Renderer): TestRenderer.ReactTestInstance[] => {
  const calendarIcons = r.root.findAllByType(Ionicons).filter((n) => n.props.name === 'calendar-outline');
  if (calendarIcons.length === 0) {
    throw new Error('No calendar-outline Ionicons found: expected exactly one in the date row');
  }
  if (calendarIcons.length > 1) {
    throw new Error(`Expected 1 calendar-outline Ionicons but found ${calendarIcons.length}; the locator is not sufficiently specific`);
  }
  return calendarIcons[0].parent!.children as TestRenderer.ReactTestInstance[];
};

// The pricetag icon and the control-number text are glued together inside a
// shared container (`controlNoGroup`). This locates that container by two
// properties that are stable across a change of *alignment technique* —
// its structural position as a direct child of dateRow, and the fact that
// it (uniquely, among dateRow's children) contains the pricetag icon —
// rather than by the alignment mechanism itself (e.g. a specific style
// value like marginLeft: 'auto' or flexGrow: 1). That mechanism is exactly
// what this task changed once already (marginLeft: 'auto' -> flexGrow +
// justifyContent), and a locator pinned to it would have silently stopped
// finding anything the moment the mechanism changed again. Throws on
// zero-or-multiple matches, same convention as findIconWrap above.
const findControlNoGroup = (r: Renderer) => {
  const rowChildren = findDateRowChildren(r);
  const matches = rowChildren.filter((c) =>
    c.findAllByType(Ionicons).some((n) => n.props.name === 'pricetag-outline'),
  );
  if (matches.length === 0) {
    throw new Error('No control-number group found among dateRow children: expected one containing the pricetag icon');
  }
  if (matches.length > 1) {
    throw new Error(`Expected 1 control-number group among dateRow children but found ${matches.length}; the locator is not sufficiently specific`);
  }
  return matches[0];
};

// The group is found via a style-shape match (like findIconWrap), so it's
// the composite View instance, one level above the host layer that actually
// holds its real JSX children — react-native's View is a forwardRef
// wrapping a single host layer of the same resolved style, so the real,
// order-bearing children live one level deeper still, on that host layer's
// own `.children` (same indirection ReportListCard.test.tsx documents for
// its equivalent `content` View lookup).
const groupChildren = (group: TestRenderer.ReactTestInstance): TestRenderer.ReactTestInstance[] =>
  (group.children[0] as TestRenderer.ReactTestInstance).children as TestRenderer.ReactTestInstance[];

// The invariant two earlier attempts both broke: the control-number text
// must be able to SHRINK (so a long value still truncates) but must NEVER
// GROW. A growing child (flexGrow: 1, or the `flex: 1` shorthand that
// implies it) claims 100% of controlNoGroup's width for itself, leaving
// justifyContent: 'flex-end' on the group zero free space to distribute —
// so the text renders flush against the group's (and row's) START instead
// of its end, while every other assertion in this suite (the group's own
// flexGrow/justifyContent, the text's presence, its order in the row) stays
// green. react-test-renderer performs no Yoga layout (see the IMPORTANT
// CAVEAT below), so it can only prove the *styling contract* — never that
// Yoga actually renders the text at the row's end — which is exactly why
// this assertion is framed as an invariant on that contract (must shrink,
// must not grow) rather than pinned to one spelling of it.
const expectShrinksButNeverGrows = (style: Record<string, unknown>) => {
  expect(style.flexShrink).toBe(1);
  expect(style.flexGrow).toBeUndefined();
  expect(style.flex).toBeUndefined();
};

const noop = () => {};

const baseItem: EstablishmentReportItem = {
  key: 'inspection-1',
  kind: 'inspection',
  reportId: 'r1',
  inspectorUid: 'uid-1',
  reportType: 'water_monitoring',
  title: 'Water Monitoring Report',
  date: new Date().toISOString(),
  controlNo: 'CTRL-1',
  status: 'submitted',
  syncStatus: 'synced',
};

// The Manage Reports tab has always shown a filing-status chip on each
// card; this section showed none, so the same report read as statusless
// depending on which screen you opened it from.
describe('EstablishmentReportsSection filing-status badge', () => {
  const badgeIn = (r: Renderer, item: EstablishmentReportItem) =>
    findRow(r, item).findAllByType(Badge);

  it('marks a submitted report as Submitted', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'submitted' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    const badges = badgeIn(r, item);
    expect(badges).toHaveLength(1);
    expect(badges[0].props.label).toBe('Submitted');
    expect(badges[0].props.tone).toBe('success');
  });

  it('marks a draft report as Draft', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'draft' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    const badges = badgeIn(r, item);
    expect(badges).toHaveLength(1);
    expect(badges[0].props.label).toBe('Draft');
    expect(badges[0].props.tone).toBe('warning');
  });

  it('renders no badge when the report carries no status', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: null };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    expect(badgeIn(r, item)).toHaveLength(0);
  });
});

describe('EstablishmentReportsSection report row token resolution', () => {
  it('resolves the icon wrap background and radius from tokens', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const style = flattenStyle(findIconWrap(r).props.style);
    expect(style.backgroundColor).toBe(Colors.water.bg);
    expect(style.borderRadius).toBe(Radius.md);
  });

  const ALL_DATA_KEYS: ReportDataKey[] = [
    'air_monitoring',
    'water_monitoring',
    'hazardous_waste',
    'eia',
    'survey',
  ];

  it.each(ALL_DATA_KEYS)(
    'resolves %s icon and background/color from REPORT_TYPE_DISPLAY, not a hardcoded water treatment',
    (reportType) => {
      const item: EstablishmentReportItem = { ...baseItem, reportType };
      const r = render(
        <EstablishmentReportsSection
          reports={[item]}
          currentUid="uid-1"
          canManageAll={false}
          onAddReport={noop}
          onOpenReport={noop}
          onDeleteReport={noop}
        />,
      );
      const expected = REPORT_TYPE_DISPLAY[reportType];

      const wrapStyle = flattenStyle(findIconWrap(r).props.style);
      expect(wrapStyle.backgroundColor).toBe(expected.bgColor);

      const icon = r.root.findAllByType(Ionicons).find((n) => n.props.size === 17);
      expect(icon?.props.name).toBe(expected.icon);
      expect(icon?.props.color).toBe(expected.textColor);
    },
  );

  // The bug this task fixes: every row previously rendered with a
  // hardcoded backgroundColor: Colors.water.bg / color: Colors.water.text
  // regardless of the report's actual type. Assert an air report resolves
  // to the air palette specifically, not water's.
  it('an air_monitoring report does not render with the water palette', () => {
    const item: EstablishmentReportItem = { ...baseItem, reportType: 'air_monitoring' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );

    const wrapStyle = flattenStyle(findIconWrap(r).props.style);
    expect(wrapStyle.backgroundColor).not.toBe(Colors.water.bg);
    expect(wrapStyle.backgroundColor).toBe(Colors.air.bg);

    const icon = r.root.findAllByType(Ionicons).find((n) => n.props.size === 17);
    expect(icon?.props.color).not.toBe(Colors.water.text);
    expect(icon?.props.color).toBe(Colors.air.text);
  });

  // Regression coverage for the specific swapped-icon bug: eia and survey
  // must each resolve their OWN icon, not each other's — matches
  // ReportListCard's equivalent coverage.
  it('eia and survey resolve distinct, non-swapped icons', () => {
    const eiaItem: EstablishmentReportItem = { ...baseItem, reportType: 'eia' };
    const surveyItem: EstablishmentReportItem = { ...baseItem, reportType: 'survey' };

    const eiaR = render(
      <EstablishmentReportsSection reports={[eiaItem]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    const surveyR = render(
      <EstablishmentReportsSection reports={[surveyItem]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );

    const eiaIcon = eiaR.root.findAllByType(Ionicons).find((n) => n.props.size === 17);
    const surveyIcon = surveyR.root.findAllByType(Ionicons).find((n) => n.props.size === 17);

    expect(eiaIcon?.props.name).toBe('document-text-outline');
    expect(surveyIcon?.props.name).toBe('globe-outline');
    expect(eiaIcon?.props.name).not.toBe(surveyIcon?.props.name);
  });

  it('falls back to a neutral treatment for an unrecognized report type', () => {
    const item: EstablishmentReportItem = { ...baseItem, reportType: 'some_future_type' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const wrapStyle = flattenStyle(findIconWrap(r).props.style);
    expect(wrapStyle.backgroundColor).toBe(Colors.bgLight);

    const icon = r.root.findAllByType(Ionicons).find((n) => n.props.size === 17);
    expect(icon?.props.name).toBe('document-outline');
    expect(icon?.props.color).toBe(Colors.textMuted);
  });

  it('resolves the title and date text sizes from the type scale', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    // Title is the only prose text colored Colors.textPrimary in the row —
    // same locator technique as EstablishmentCard.test.tsx's "name" text,
    // which sidesteps AppText/MarqueeText's internal Text structure.
    const titleText = proseTexts(r).find((n) => flattenStyle(n.props.style).color === Colors.textPrimary);
    // Excludes the control number: it now also resolves to Colors.textMuted
    // (this task's fix), so a bare color-based lookup would double-match it.
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateStyle = flattenStyle(findDateText(r, controlNoText).props.style);
    expect(flattenStyle(titleText?.props.style).fontSize).toBe(Type.body.fontSize);
    expect(flattenStyle(titleText?.props.style).lineHeight).toBe(Type.body.lineHeight);
    expect(dateStyle.fontSize).toBe(Type.label.fontSize);
    expect(dateStyle.lineHeight).toBe(Type.label.lineHeight);
  });

  // This task's fix: the control number used to opt out of OS font scaling
  // (FONT_SCALING.tabular) and use a monospace family, because it sat alone
  // on its own line where an over-long value would overflow. It now shares
  // the date row, and numberOfLines={1}/ellipsizeMode="tail" (asserted in
  // the "date + control number row" describe block below) make it truncate
  // instead of overflow — the truncation is what protects the row now, so
  // it no longer needs a scaling opt-out and instead matches the date's
  // style exactly, family included.
  it('resolves the control number style from Type.label (matching the date), with OS font scaling matching the date too', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    const controlNoStyle = flattenStyle(controlNoText?.props.style);
    const dateStyle = flattenStyle(dateText.props.style);
    // The bug this task fixes: the control number used to resolve
    // Type.caption (11/14) while the date beside it resolves Type.label
    // (12/16) — two different sizes on one row don't share a baseline.
    expect(controlNoStyle.fontSize).toBe(Type.label.fontSize);
    expect(controlNoStyle.lineHeight).toBe(Type.label.lineHeight);
    // No more 'monospace' override — the control number now uses the same
    // (default) font family as the date, compared directly rather than
    // pinned to a literal so this keeps failing if either side drifts.
    expect(controlNoStyle.fontFamily).toBe(dateStyle.fontFamily);
    expect(resolvedAllowFontScaling(controlNoText)).toBe(resolvedAllowFontScaling(dateText));
    expect(resolvedAllowFontScaling(controlNoText)).toBe(true);
    // Also pins the actual prop to the named policy token, confirming the
    // source switched to FONT_SCALING.content specifically (not just some
    // other truthy value that happens to match the date's default).
    expect(controlNoText?.props.allowFontScaling).toBe(FONT_SCALING.content);
  });

  it("falls back to 'No control number yet' when controlNo is null", () => {
    const item: EstablishmentReportItem = { ...baseItem, controlNo: null };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(r.root.findAllByType(Text).some((n) => n.props.children === 'No control number yet')).toBe(true);
  });
});

describe('EstablishmentReportsSection date + control number row', () => {
  // Combining the two previously-separate lines is the point of this task —
  // this asserts real row MEMBERSHIP: the date sits directly in dateRow,
  // and the control number is reachable through its own end-aligned group
  // (also a direct child of dateRow), rather than either being split back
  // onto its own line below the row.
  it('renders the date directly in the row and the control number inside its own end-aligned group, not on separate lines', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    expect(calendarIcon).toBeDefined();
    const rowChildren = calendarIcon!.parent!.children;

    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    const group = findControlNoGroup(r);

    expect(rowChildren).toContain(dateText);
    expect(rowChildren).toContain(group);
    // The control number itself is no longer a direct child of dateRow —
    // it's nested one level deeper, inside the group — but it is still
    // reachable through it, which is what "same row" now means.
    expect(rowChildren).not.toContain(controlNoText);
    expect(group.findAllByType(Text)).toContain(controlNoText);
  });

  // The bug this task fixes: the control number used to sit immediately
  // after the date. This asserts the actual ORDER of dateRow's real
  // children — the calendar icon and date first, the control-number group
  // last — which is exactly what would fail if the control number went
  // back to sitting right after the date instead of being pushed to the
  // end of the row.
  it('places the date first and the control-number group last in the date row', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    const rowChildren = calendarIcon!.parent!.children;
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    const group = findControlNoGroup(r);

    expect(rowChildren[0]).toBe(calendarIcon);
    expect(rowChildren[1]).toBe(dateText);
    expect(rowChildren[rowChildren.length - 1]).toBe(group);
  });

  // The bug this task fixes: the date and control number now sit side by
  // side on one row but used to resolve two different sizes/lineHeights
  // (Type.label vs Type.caption), and different colours/families on top of
  // that. Asserting direct comparisons between the two resolved values —
  // rather than each pinned separately to a token — is what keeps this test
  // failing if either side drifts back out of sync, independent of which
  // token wins. Mirrors ReportListCard.test.tsx's equivalent assertion.
  it("resolves the control number's fontSize, lineHeight, color and font family to exactly match the date's", () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    const dateStyle = flattenStyle(dateText?.props.style);
    const controlNoStyle = flattenStyle(controlNoText?.props.style);

    expect(controlNoStyle.fontSize).toBe(dateStyle.fontSize);
    expect(controlNoStyle.lineHeight).toBe(dateStyle.lineHeight);

    // The two are meant to read as one style now that they share a row —
    // colour and font family (no more 'monospace' override) both now match
    // the date's exactly, instead of the date/control-number colour
    // distinction the row used to carry.
    expect(controlNoStyle.color).toBe(dateStyle.color);
    expect(controlNoStyle.color).toBe(Colors.textMuted);
    expect(controlNoStyle.fontFamily).toBe(dateStyle.fontFamily);
  });

  // The pricetag icon must travel with the control number as one unit — the
  // real trap this guards against is the icon being stranded mid-row while
  // only the text gets pushed to the end.
  it('renders the pricetag icon inside the same container as the control-number text, so it cannot be stranded mid-row', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    const pricetagIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'pricetag-outline');
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    expect(pricetagIcon).toBeDefined();
    expect(controlNoText).toBeDefined();

    const group = findControlNoGroup(r);
    const children = groupChildren(group);
    expect(children).toContain(pricetagIcon);
    expect(children).toContain(controlNoText);

    // Immediately before the control number text, mirroring how the
    // calendar icon precedes the date at the start of the row.
    const iconIndex = children.indexOf(pricetagIcon!);
    const textIndex = children.indexOf(controlNoText!);
    expect(iconIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBe(iconIndex + 1);

    // Decorative: the control number text right beside it already carries
    // the meaning, so this icon must stay out of the accessibility tree —
    // same convention as Button.tsx's own icons.
    expect(pricetagIcon?.props.importantForAccessibility).toBe('no');

    // Matches the calendar icon's own size/color treatment so the two icons
    // in this row read as one family.
    expect(pricetagIcon?.props.size).toBe(calendarIcon?.props.size);
    expect(pricetagIcon?.props.color).toBe(calendarIcon?.props.color);

    // Never squeezed within the group.
    expect(flattenStyle(pricetagIcon?.props.style).flexShrink).toBe(0);
  });

  it('never lets a long control number push the urgency badge out of the row, clip the date, or dislodge the group from the end of the row', () => {
    const longControlNo = 'CTRL-2026-0000001-EXTREMELY-LONG-CONTROL-NUMBER-VALUE';
    const item: EstablishmentReportItem = {
      ...baseItem,
      status: 'draft',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      controlNo: longControlNo,
    };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );

    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    const rowChildren = calendarIcon!.parent!.children;

    // The control number is the element that shrinks/truncates
    // (flexShrink: 1, numberOfLines 1) — the date and its icon are pinned
    // (flexShrink: 0) so neither can be squeezed out by it. The urgency badge
    // is no longer part of this row at all: it moved to the row's corner,
    // which is what took the pressure off this line in the first place.
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === longControlNo);
    expect(controlNoText).toBeDefined();

    // The date text is still present and untouched — it's the control
    // number that gives way, not the date. Located excluding the control
    // number, since both now resolve to Colors.textMuted (this task's fix).
    const dateText = findDateText(r, controlNoText);
    expect(dateText).toBeDefined();

    // Must shrink to truncate, but must never grow — see
    // expectShrinksButNeverGrows above for why a growing child would defeat
    // the group's flex-end alignment.
    expectShrinksButNeverGrows(flattenStyle(controlNoText?.props.style));
    expect(controlNoText?.props.numberOfLines).toBe(1);
    expect(flattenStyle(dateText?.props.style).flexShrink).toBe(0);

    const pricetagIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'pricetag-outline');
    expect(pricetagIcon).toBeDefined();
    expect(flattenStyle(pricetagIcon?.props.style).flexShrink).toBe(0);

    // Even a value long enough to force truncation must not reorder the
    // row: date (with its icon) first, the control-number group still last.
    const group = findControlNoGroup(r);
    expect(rowChildren[0]).toBe(calendarIcon);
    expect(rowChildren.indexOf(dateText)).toBeLessThan(rowChildren.indexOf(group));
    expect(rowChildren[rowChildren.length - 1]).toBe(group);
  });

  // The flip side of the long-control-number test above: a short value must
  // not fall back to sitting right after the date either — the group's
  // flexGrow: 1 + justifyContent: 'flex-end' keeps it pinned to the end of
  // the row regardless of how little space it actually needs.
  //
  // IMPORTANT CAVEAT: react-test-renderer performs no Yoga/flexbox layout
  // at all — flattenStyle() below only confirms the *styling contract*
  // (which properties are declared and with what values), never that Yoga
  // actually resolves them into the group sitting flush against the row's
  // right edge on a real device. That gap is exactly what let BOTH earlier
  // attempts ship looking done while pixel-identical to no alignment at
  // all: first marginLeft: 'auto' (a no-op alongside the row's own `gap` on
  // some RN versions), then flex: 1 on the control-number text itself (which
  // grows to fill controlNoGroup, leaving flex-end nothing to push against)
  // — every style-applied assertion in this file passed both times.
  // expectShrinksButNeverGrows below closes the second gap specifically by
  // pinning the *contract* the text must satisfy; confirming the group truly
  // lands at the end of the row (with visible empty space between it and
  // the date/badge for a short value like this one) still requires a real
  // device or simulator check, not this suite.
  it('keeps a short control number at the end of the row (right-aligned), not sitting immediately after the date', () => {
    const item: EstablishmentReportItem = {
      ...baseItem,
      status: 'draft',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      controlNo: 'C-1',
    };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );

    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    const rowChildren = calendarIcon!.parent!.children;
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === 'C-1');
    const dateText = findDateText(r, controlNoText);
    const group = findControlNoGroup(r);

    // The mechanism: the group grows to claim the row's remaining space
    // (flexGrow: 1) and right-aligns its own children within that space
    // (justifyContent: 'flex-end'), regardless of the control number's own
    // width. Asserted as the pair that together express "end-aligned",
    // rather than pinning a single property name — so a future swap of
    // *which* flex properties accomplish this doesn't reflexively break
    // this test the way the marginLeft: 'auto' pin did.
    const groupStyle = flattenStyle(group.props.style);
    expect(groupStyle.flexGrow).toBe(1);
    expect(groupStyle.justifyContent).toBe('flex-end');

    // This is exactly the scenario the flex: 1 regression broke: a short
    // value doesn't need to truncate, but a growing text still consumes all
    // of the group's width regardless, defeating flex-end. Pinning the
    // group's own contract (above) isn't enough on its own — see
    // expectShrinksButNeverGrows above.
    expectShrinksButNeverGrows(flattenStyle(controlNoText?.props.style));

    expect(rowChildren[0]).toBe(calendarIcon);
    expect(rowChildren.indexOf(dateText)).toBeLessThan(rowChildren.indexOf(group));
    expect(rowChildren[rowChildren.length - 1]).toBe(group);
  });
});

describe('EstablishmentReportsSection urgency ribbon', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const renderOne = (item: EstablishmentReportItem) =>
    render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );

  // The ribbon's wrapper is the only node in the row declaring an explicit
  // accessibilityRole of 'text'.
  const findRibbon = (r: Renderer) => {
    const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
    const matches = views.filter((n) => n.props.accessibilityRole === 'text');
    if (matches.length > 1) {
      throw new Error(`Expected at most 1 ribbon but found ${matches.length}`);
    }
    return matches[0];
  };

  const bandLabel = (r: Renderer) => r.root.findByType(SvgText).props.children;

  it('fills the band with the saturated overdue hue and tints the row to match', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'draft', date: daysAgo(31) };
    const r = renderOne(item);

    expect(r.root.findByType(Polygon).props.fill).toBe(Colors.hazwaste.text);
    expect(bandLabel(r)).toBe('1d late');
    expect(findRibbon(r).props.accessibilityLabel).toBe('Overdue by 1 day');

    const rowStyle = flattenStyle(findRow(r, item).props.style);
    expect(rowStyle.borderColor).toBe(Colors.hazwaste.border);
    expect(rowStyle.backgroundColor).toBe(Colors.hazwaste.bg);
  });

  it('fills the band with the saturated due-soon hue and tints the row to match', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'draft', date: daysAgo(15) };
    const r = renderOne(item);

    expect(r.root.findByType(Polygon).props.fill).toBe(Colors.warning.text);
    expect(bandLabel(r)).toBe('15d left');
    expect(findRibbon(r).props.accessibilityLabel).toBe('Due in 15 days');

    const rowStyle = flattenStyle(findRow(r, item).props.style);
    expect(rowStyle.borderColor).toBe(Colors.warning.border);
    expect(rowStyle.backgroundColor).toBe(Colors.warning.bg);
  });

  it('renders the ribbon inside the row, clear of the date row', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'draft', date: daysAgo(45) };
    const r = renderOne(item);

    const ribbon = findRibbon(r);
    expect(findRow(r, item).findAll((n) => n === ribbon)).toHaveLength(1);

    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    expect(calendarIcon!.parent!.children).not.toContain(ribbon);
  });

  // An absolutely positioned overlay, so it must not push the row open the
  // way the reserved padding band it replaced used to.
  it('costs a flagged row no extra height over a calm one', () => {
    const flagged: EstablishmentReportItem = { ...baseItem, status: 'draft', date: daysAgo(45) };
    const calm: EstablishmentReportItem = { ...baseItem, status: 'draft', date: daysAgo(2) };

    const flaggedStyle = flattenStyle(findRow(renderOne(flagged), flagged).props.style);
    const calmStyle = flattenStyle(findRow(renderOne(calm), calm).props.style);

    expect(flaggedStyle.paddingTop).toBeUndefined();
    expect(flaggedStyle.padding).toBe(Spacing.md);
    expect(flaggedStyle.padding).toBe(calmStyle.padding);
  });

  it('shows no ribbon on an unflagged draft', () => {
    expect(findRibbon(renderOne({ ...baseItem, status: 'draft', date: daysAgo(2) }))).toBeUndefined();
  });

  it('shows no ribbon for a submitted report regardless of age', () => {
    const item: EstablishmentReportItem = { ...baseItem, status: 'submitted', date: daysAgo(90) };
    expect(findRibbon(renderOne(item))).toBeUndefined();
  });
});

describe('EstablishmentReportsSection delete visibility', () => {
  it('shows Delete for an inspection report the viewer owns', () => {
    const item: EstablishmentReportItem = { ...baseItem, kind: 'inspection', inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(findDeleteButtons(r, item)).toHaveLength(1);
  });

  it('shows Delete for a report the viewer does not own when canManageAll is true (Developer account)', () => {
    const item: EstablishmentReportItem = { ...baseItem, kind: 'inspection', inspectorUid: 'someone-else' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(findDeleteButtons(r, item)).toHaveLength(1);
  });

  it('hides Delete for an inspection report the viewer does not own', () => {
    const item: EstablishmentReportItem = { ...baseItem, kind: 'inspection', inspectorUid: 'someone-else' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(findDeleteButtons(r, item)).toHaveLength(0);
  });

  it('never shows Delete for a survey report, even when owned and manageable', () => {
    const item: EstablishmentReportItem = { ...baseItem, kind: 'survey', inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(findDeleteButtons(r, item)).toHaveLength(0);
  });
});

describe('EstablishmentReportsSection press wiring', () => {
  it('opens the report on press', () => {
    const onOpenReport = jest.fn();
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={onOpenReport}
        onDeleteReport={noop}
      />,
    );
    TestRenderer.act(() => {
      findRow(r, baseItem).props.onPress();
    });
    expect(onOpenReport).toHaveBeenCalledWith(baseItem);
  });

  it('deletes the report when the delete action is pressed', () => {
    const onDeleteReport = jest.fn();
    const item: EstablishmentReportItem = { ...baseItem, kind: 'inspection', inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={onDeleteReport}
      />,
    );
    const [deleteAction] = findDeleteButtons(r, item);
    TestRenderer.act(() => deleteAction.onSelect());
    expect(onDeleteReport).toHaveBeenCalledWith(item);
  });

  it('calls onAddReport when the header Add Report button is pressed', () => {
    const onAddReport = jest.fn();
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={onAddReport}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    TestRenderer.act(() => {
      findAddReportButton(r).props.onPress();
    });
    expect(onAddReport).toHaveBeenCalledTimes(1);
  });
});

describe('EstablishmentReportsSection button hierarchy', () => {
  // The button hierarchy this task establishes: exactly one filled `primary`
  // button per screen, and every section-header action is `sm` `outline`.
  // EstablishmentHeaderCard's own "Add Report" is the screen's one primary
  // action, so this section-header "Add Report" must not also be filled —
  // two filled navy buttons on the same screen was the bug.
  it('renders Add Report as outline, not primary, at sm size', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[baseItem]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const style = flattenStyle(findAddReportButton(r).props.style);
    expect(style.minHeight).toBe(32); // sm
    expect(style.backgroundColor).toBe(Colors.white); // outline, not primary's navy fill
    expect(style.borderColor).toBe(Colors.navy);
  });
});

describe('EstablishmentReportsSection loading and empty states (unchanged by this task)', () => {
  it('shows a spinner and no rows while loading', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[]}
        loading
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(r.root.findAllByProps({ size: 'small' }).length).toBeGreaterThan(0);
    expect(r.root.findAllByType(GestureDetector)).toHaveLength(0);
  });

  it('shows the empty-state message when there are no reports and not loading', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    expect(
      r.root.findAllByType(Text).some((n) => n.props.children === 'No reports filed yet for this establishment.'),
    ).toBe(true);
    expect(r.root.findAllByType(GestureDetector)).toHaveLength(0);
  });
});

describe('EstablishmentReportsSection legibility guarantee', () => {
  // The legibility guarantee this task exists to enforce: no text node's
  // resolved fontSize ever falls below the type scale's floor, Type.caption
  // (11), in any branch — loading, empty, a plain report, an overdue report
  // with the delete action visible, or a due-soon report without it.
  it('renders nothing below Type.caption.fontSize while loading', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[]}
        loading
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const sizes = allFontSizes(r);
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });

  it('renders nothing below Type.caption.fontSize in the empty state', () => {
    const r = render(
      <EstablishmentReportsSection
        reports={[]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const sizes = allFontSizes(r);
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });

  it('renders nothing below Type.caption.fontSize for an overdue, owned, deletable inspection report', () => {
    const item: EstablishmentReportItem = {
      ...baseItem,
      kind: 'inspection',
      inspectorUid: 'uid-1',
      status: 'draft',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const sizes = allFontSizes(r);
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });

  it('renders nothing below Type.caption.fontSize for a due-soon survey report with no delete action', () => {
    const item: EstablishmentReportItem = {
      ...baseItem,
      kind: 'survey',
      status: 'draft',
      date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      controlNo: null,
    };
    const r = render(
      <EstablishmentReportsSection
        reports={[item]}
        currentUid="uid-1"
        canManageAll={false}
        onAddReport={noop}
        onOpenReport={noop}
        onDeleteReport={noop}
      />,
    );
    const sizes = allFontSizes(r);
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });
});

// Swipe-to-reveal was replaced by an overflow menu: it was invisible until
// discovered, and on the home screen it fought the horizontal tab pager for
// the same drags. These rows are on the detail screen, but all three
// swipeable rows changed together so they behave alike.
describe('EstablishmentReportsSection row actions', () => {
  const rowFor = (r: Renderer, item: EstablishmentReportItem) => findRow(r, item);

  it('offers Delete in a menu for a report the viewer owns', () => {
    const item: EstablishmentReportItem = { ...baseItem, inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    const menus = rowFor(r, item).findAllByType(RowActionsButton);
    expect(menus).toHaveLength(1);
    expect(menus[0].props.actions.map((a: { label: string }) => a.label)).toEqual(['Delete']);
  });

  it('shows no menu for a report the viewer may not delete', () => {
    const item: EstablishmentReportItem = { ...baseItem, inspectorUid: 'someone-else' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    expect(rowFor(r, item).findAllByType(RowActionsButton)).toHaveLength(0);
  });

  it('deletes the report when that menu action is chosen', () => {
    const onDeleteReport = jest.fn();
    const item: EstablishmentReportItem = { ...baseItem, inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={onDeleteReport} />,
    );
    const action = rowFor(r, item).findByType(RowActionsButton).props.actions[0];
    TestRenderer.act(() => action.onSelect());
    expect(onDeleteReport).toHaveBeenCalledWith(item);
  });

  it('carries no swipe gesture', () => {
    const item: EstablishmentReportItem = { ...baseItem, inspectorUid: 'uid-1' };
    const r = render(
      <EstablishmentReportsSection reports={[item]} currentUid="uid-1" canManageAll={false} onAddReport={noop} onOpenReport={noop} onDeleteReport={noop} />,
    );
    expect(r.root.findAllByType(GestureDetector)).toHaveLength(0);
  });
});
