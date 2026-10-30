import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { RowActionsButton } from '../../../components/RowActionsButton';
import { Ionicons } from '@expo/vector-icons';
import TestRenderer from 'react-test-renderer';
import { Text as SvgText } from 'react-native-svg';
import { ReportListCard } from './ReportListCard';
import { Colors } from '../../../design/colors';
import { Spacing } from '../../../design/spacing';
import { FONT_SCALING } from '../../../design/typography';
import { REPORT_TYPE_DISPLAY } from '../../../constants/reportTypeDisplay';
import type { AllReportItem } from '../hooks/useEstablishment';

// ReportListCard pulls in confirmResolveConflict -> the WatermelonDB sync
// adapter chain, which constructs a real SQLiteAdapter at import time (via
// db/database.ts) needing the native JSI binding that isn't present under
// plain Jest — same rationale as establishmentPersistence.test.ts and
// useEstablishment.test.ts. jest.mock calls are hoisted above imports by
// babel-plugin-jest-hoist regardless of where they're written, so this
// still applies before ReportListCard is ever required.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));

// getReportUrgency resolves thresholds through urgencyConfig, which returns
// the build-time ENV defaults whenever its module-level snapshot has never
// been hydrated. Nothing in this file mocks or hydrates urgencyConfig, so
// that unhydrated-snapshot state is what makes these assertions line up with
// ENV's 14/30 rather than something else. A future test that calls
// hydrateUrgencyConfig or refreshUrgencyConfig here would leak that snapshot
// into every other test in this file, since the module holds it in scope
// shared across the whole suite.

const mockConfirmResolveConflict = jest.fn();
jest.mock('../../../services/sync/syncConflictResolution', () => ({
  confirmResolveConflict: (...args: unknown[]) => mockConfirmResolveConflict(...args),
}));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

// @expo/vector-icons renders its glyph as a Text under the hood, with the
// icon's `size`/`color` props applied to that Text's style — the calendar
// icon here uses color: Colors.textMuted, same as the date Text right next
// to it, so a bare color-based lookup for the date text would double-match
// the icon's own internal glyph Text. Same technique as
// EstablishmentReportsSection.test.tsx.
const iconGlyphTexts = (r: Renderer): Set<TestRenderer.ReactTestInstance> =>
  new Set(r.root.findAllByType(Ionicons).flatMap((icon) => icon.findAllByType(Text)));

const proseTexts = (r: Renderer) => {
  const glyphs = iconGlyphTexts(r);
  return r.root.findAllByType(Text).filter((n) => !glyphs.has(n));
};

// This task made the control number resolve to Colors.textMuted too (it now
// shares the date's exact style), so a bare color-based lookup for the date
// text would double-match date + control number, on top of the calendar
// icon's own glyph Text that proseTexts() already excludes. The control
// number is already locatable unambiguously by its own text content
// (item.controlNo), so excluding it here narrows the remaining color match
// back down to exactly one. Throws if zero or more than one candidate
// remains — same zero-or-multiple guard as findIconWrap/findReportIcon
// below.
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

// Locate the report-icon wrap View by its resolved shape styles (width 38 /
// height 38 / borderRadius 8 — unique to this element in ReportListCard).
// Throws if zero or more than one match is found, per the Card/Badge
// locator convention.
const findIconWrap = (r: Renderer) => {
  const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
  const matches = views.filter((n) => {
    const flattened = flattenStyle(n.props.style);
    return flattened.width === 38 && flattened.height === 38 && flattened.borderRadius === 8;
  });
  if (matches.length === 0) {
    throw new Error('No icon wrap View found: expected a View with width===38, height===38, borderRadius===8');
  }
  if (matches.length > 1) {
    throw new Error(`Expected 1 icon wrap View but found ${matches.length}; the locator is not sufficiently specific`);
  }
  return matches[0];
};

// Locate the report-type Ionicons glyph by its unique size (17 — every
// other Ionicons usage in ReportListCard uses a different size). Throws if
// zero or more than one match is found.
const findReportIcon = (r: Renderer) => {
  const icons = r.root.findAllByType(Ionicons).filter((n) => n.props.size === 17);
  if (icons.length === 0) {
    throw new Error('No report-type Ionicons found: expected an Ionicons with size===17');
  }
  if (icons.length > 1) {
    throw new Error(`Expected 1 report-type Ionicons but found ${icons.length}; the locator is not sufficiently specific`);
  }
  return icons[0];
};

// react-native's own TouchableOpacity module (Libraries/Components/Touchable/
// TouchableOpacity.js) is itself a thin wrapper that spreads every prop it
// receives — onPress included — onto an inner, unexported class component of
// the same displayName, so a props-only predicate (e.g. matching just
// accessibilityLabel) double-matches: once on the outer wrapper fiber, once
// on the inner one. Anchoring on `n.type === TouchableOpacity` (the same
// module reference this file and ReportListCard.tsx both resolve to)
// narrows a `find`/`findAll` to the outer fiber only, exactly one per
// on-screen button — confirmed by rendering the card and logging every
// matching node before writing these locators.
const findCard = (r: Renderer, item: AllReportItem) =>
  r.root.find(
    (n) =>
      n.type === TouchableOpacity &&
      n.props?.accessibilityLabel === `${item.title} for ${item.estabName}`,
  );

// Edit/Delete used to be buttons revealed by swiping; they are now declared
// to RowActionsButton, which shows them in a menu. Asserting on the declared
// list checks the same permission gating without reaching into the menu.
const menuActionIds = (r: Renderer): string[] => {
  const buttons = r.root.findAllByType(RowActionsButton);
  return buttons.length === 0 ? [] : buttons[0].props.actions.map((a: { id: string }) => a.id);
};

const findEditButtons = (r: Renderer, _item: AllReportItem) =>
  menuActionIds(r).filter((id) => id === 'edit');

const findDeleteButtons = (r: Renderer, _item: AllReportItem) =>
  menuActionIds(r).filter((id) => id === 'delete');

// The card used to carry a separate 22x22 checkbox View with a 4px radius in
// front of the type tile. Nothing should match this shape any more — the tile
// itself is the selection control now — so this locator exists to prove the
// old element is gone rather than to find it.
const findCheckboxes = (r: Renderer) => {
  const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
  return views.filter((n) => {
    const flattened = flattenStyle(n.props.style);
    return flattened.width === 22 && flattened.height === 22 && flattened.borderRadius === 4;
  });
};

// Matched by name alone: the checkmark now sizes to the tile it sits in, and
// pinning a size here would break on any future tile resize without anything
// actually being wrong.
const findCheckmarkIcons = (r: Renderer) =>
  r.root.findAllByType(Ionicons).filter((n) => n.props.name === 'checkmark');

// Locate the ordered list of the card body's real JSX children — titleRow,
// metaRow, dateRow (which now also carries the control number as one of its
// own children — see the "date + control number row" tests below), and
// (conditionally) the sync row — by first finding the `content` View by its
// resolved shape (flex 1, minWidth 0 —
// unique to this element in ReportListCard), throwing on zero-or-multiple
// matches per the findIconWrap convention.
//
// `View` from react-native is a forwardRef wrapping a single host layer of
// the same resolved style (confirmed by inspecting the rendered tree
// directly: content.children is a single-entry array holding that host
// layer, not the five JSX siblings), so the real, order-bearing siblings
// live one level deeper still, on that host layer's own `.children`.
const findContentChildren = (r: Renderer) => {
  const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
  const matches = views.filter((n) => {
    const flattened = flattenStyle(n.props.style);
    return flattened.flex === 1 && flattened.minWidth === 0;
  });
  if (matches.length === 0) {
    throw new Error('No content View found: expected a View with flex===1, minWidth===0');
  }
  if (matches.length > 1) {
    throw new Error(`Expected 1 content View but found ${matches.length}; the locator is not sufficiently specific`);
  }
  // Every direct JSX child in this card body is itself a View/Text/
  // TouchableOpacity element, never bare text — so this cast is safe.
  const hostLayer = matches[0].children[0] as TestRenderer.ReactTestInstance;
  return hostLayer.children as TestRenderer.ReactTestInstance[];
};

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
// zero-or-multiple matches, same convention as findIconWrap/findCheckbox
// above.
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
// holds its real JSX children — same "host layer" indirection documented on
// findContentChildren above.
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

const baseItem: AllReportItem = {
  key: 'survey-1',
  kind: 'survey',
  reportId: 'r1',
  inspectorUid: 'uid-1',
  reportType: 'survey',
  title: 'Test Report',
  date: new Date().toISOString(),
  controlNo: 'CTRL-1',
  status: 'submitted',
  syncStatus: 'synced',
  estabId: 'estab-1',
  estabName: 'Test Establishment',
  estabProvince: 'Palawan',
  estabCity: 'Puerto Princesa',
};

const noop = () => {};

// Report types come from the region's catalog; a region with no report types
// has no rows to colour, so the per-type cases skip. (it.each throws on an
// empty table, hence eachKey.)
const TYPE_ENTRIES = Object.entries(REPORT_TYPE_DISPLAY);
const itWhenTwoTypes = TYPE_ENTRIES.length > 1 ? it : it.skip;
const [FIRST_KEY, FIRST] = TYPE_ENTRIES[0] ?? ['', undefined];
const [SECOND_KEY, SECOND] = TYPE_ENTRIES[1] ?? ['', undefined];
const eachKey = (keys: string[]) => (keys.length ? it.each(keys) : it.skip.each(['(none)']));

const ALL_DATA_KEYS = Object.keys(REPORT_TYPE_DISPLAY);

describe('ReportListCard report-type icon', () => {
  eachKey(ALL_DATA_KEYS)(
    'resolves %s icon and background/color from REPORT_TYPE_DISPLAY, not a hardcoded treatment',
    (reportType) => {
      const item: AllReportItem = { ...baseItem, reportType };
      const r = render(
        <ReportListCard
          item={item}
          currentUid="uid-1"
          canManageAll={false}
          onPress={noop}
          onEdit={noop}
          onDelete={noop}
        />,
      );

      const expected = REPORT_TYPE_DISPLAY[reportType];

      const iconWrap = findIconWrap(r);
      const wrapStyle = flattenStyle(iconWrap.props.style);
      expect(wrapStyle.backgroundColor).toBe(expected.bgColor);

      const icon = findReportIcon(r);
      expect(icon.props.name).toBe(expected.icon);
      expect(icon.props.color).toBe(expected.textColor);
    },
  );

  // The bug this task fixes: every row previously rendered with one
  // hardcoded type's background and glyph colour regardless of the report's
  // actual type. A report resolves its own type's palette, not another's.
  itWhenTwoTypes("a report resolves its own type's palette, not another type's", () => {
    const r = render(
      <ReportListCard item={{ ...baseItem, reportType: SECOND_KEY }} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );

    const wrapStyle = flattenStyle(findIconWrap(r).props.style);
    expect(wrapStyle.backgroundColor).toBe(SECOND?.bgColor);
    const icon = findReportIcon(r);
    expect(icon?.props.color).toBe(SECOND?.textColor);
    if (FIRST?.bgColor !== SECOND?.bgColor) expect(wrapStyle.backgroundColor).not.toBe(FIRST?.bgColor);
    if (FIRST?.textColor !== SECOND?.textColor) expect(icon?.props.color).not.toBe(FIRST?.textColor);
  });

  // Regression coverage for the swapped-icon bug: two types must each resolve
  // their OWN icon, not each other's (the region pins which icons).
  itWhenTwoTypes('two types resolve their own, non-swapped icons', () => {
    const firstIcon = findReportIcon(render(
      <ReportListCard item={{ ...baseItem, reportType: FIRST_KEY }} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    ));
    const secondIcon = findReportIcon(render(
      <ReportListCard item={{ ...baseItem, reportType: SECOND_KEY }} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    ));

    expect(firstIcon?.props.name).toBe(FIRST?.icon);
    expect(secondIcon?.props.name).toBe(SECOND?.icon);
    if (FIRST?.icon !== SECOND?.icon) expect(firstIcon?.props.name).not.toBe(secondIcon?.props.name);
  });

  it('falls back to a neutral treatment for an unrecognized report type', () => {
    const item: AllReportItem = { ...baseItem, reportType: 'some_future_type' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );

    const wrapStyle = flattenStyle(findIconWrap(r).props.style);
    expect(wrapStyle.backgroundColor).toBe(Colors.bgLight);

    const icon = findReportIcon(r);
    expect(icon.props.name).toBe('document-outline');
    expect(icon.props.color).toBe(Colors.textMuted);
  });
});

// An inspection report, in draft, owned by the viewer — this combination is
// what makes both showEdit and showDelete true, which in turn is what makes
// the swipe gesture enabled by default. Using it (rather than baseItem,
// where neither action shows and the gesture is already off) is what lets
// the selection-mode tests below prove selection mode is what turns the
// gesture off, not that it was off already.
const ownedDraftInspection: AllReportItem = {
  ...baseItem,
  key: 'inspection-1',
  kind: 'inspection',
  reportType: 'water_monitoring',
  inspectorUid: 'uid-1',
  status: 'draft',
};

describe('ReportListCard selection mode', () => {
  // Selection used to add a 22px checkbox in front of the report-type tile,
  // stacking two controls in the leading gutter and growing it from 62px to
  // 96px. The tile is now the control itself, so the gutter is the same width
  // in both modes.
  const renderSelectable = (selected: boolean) =>
    render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        selectable
        selected={selected}
        onPress={noop}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={noop}
      />,
    );

  it('adds no separate checkbox in selection mode — the type tile is the control', () => {
    expect(findCheckboxes(renderSelectable(false))).toHaveLength(0);
    expect(findCheckboxes(renderSelectable(true))).toHaveLength(0);
  });

  it('leaves the tile completely untouched when not selectable', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const tile = flattenStyle(findIconWrap(r).props.style);
    expect(tile.borderWidth).toBeUndefined();
    expect(tile.backgroundColor).not.toBe(Colors.navy);
    expect(findCheckmarkIcons(r)).toHaveLength(0);
  });

  // The ring is what the old checkbox wore. Without it an unselected tile in
  // selection mode is indistinguishable from a normal one, and nothing on the
  // card says it is tappable state.
  it('rings the tile but keeps the type glyph when selectable and unselected', () => {
    const r = renderSelectable(false);
    const tile = flattenStyle(findIconWrap(r).props.style);

    expect(tile.borderWidth).toBe(1.5);
    // Not Colors.border — that hairline is close to invisible on a pale type
    // tint, confirmed on device, and the ring is the only thing saying the
    // row is pickable.
    expect(tile.borderColor).toBe(Colors.textLight);
    expect(tile.backgroundColor).not.toBe(Colors.navy);
    expect(findCheckmarkIcons(r)).toHaveLength(0);
    expect(findReportIcon(r)).toBeDefined();
  });

  it('flips the tile to a navy checkmark when selected — the same fill as every other filled control', () => {
    const r = renderSelectable(true);
    const tile = flattenStyle(findIconWrap(r).props.style);

    expect(tile.backgroundColor).toBe(Colors.navy);
    expect(findCheckmarkIcons(r)).toHaveLength(1);
    // The ring would double up with the filled state.
    expect(tile.borderWidth).toBeUndefined();
  });

  it('opens the report on press when not selectable, and never touches onToggleSelect', () => {
    const onPress = jest.fn();
    const onToggleSelect = jest.fn();
    const r = render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        onPress={onPress}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={onToggleSelect}
      />,
    );

    TestRenderer.act(() => {
      findCard(r, ownedDraftInspection).props.onPress();
    });

    expect(onPress).toHaveBeenCalledWith(ownedDraftInspection);
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('toggles selection instead of opening the report when selectable, and never touches onPress', () => {
    const onPress = jest.fn();
    const onToggleSelect = jest.fn();
    const r = render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        selectable
        onPress={onPress}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={onToggleSelect}
      />,
    );

    TestRenderer.act(() => {
      findCard(r, ownedDraftInspection).props.onPress();
    });

    expect(onToggleSelect).toHaveBeenCalledWith(ownedDraftInspection);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders a disabled selector with the reason and ignores taps', () => {
    const onToggleSelect = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      r = TestRenderer.create(
        <ReportListCard
          item={ownedDraftInspection}
          currentUid="uid-1"
          canManageAll={false}
          onPress={noop}
          onEdit={noop}
          onDelete={noop}
          selectable
          selectDisabled
          selectDisabledReason="No template yet"
          onToggleSelect={onToggleSelect}
        />,
      );
    });
    expect(JSON.stringify(r.toJSON())).toContain('No template yet');
    TestRenderer.act(() => {
      findCard(r, ownedDraftInspection).props.onPress();
    });
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('exposes accessibilityRole="button" and no accessibilityState when not selectable', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const card = findCard(r, ownedDraftInspection);
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityState).toBeUndefined();
  });

  it('exposes accessibilityRole="checkbox" and a checked accessibilityState reflecting `selected`', () => {
    const r = render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        selectable
        selected
        onPress={noop}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={noop}
      />,
    );
    const card = findCard(r, ownedDraftInspection);
    expect(card.props.accessibilityRole).toBe('checkbox');
    expect(card.props.accessibilityState).toEqual({ checked: true });
  });

  it('reflects selected=false in accessibilityState too, not just selected=true', () => {
    const r = render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        selectable
        selected={false}
        onPress={noop}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={noop}
      />,
    );
    expect(findCard(r, ownedDraftInspection).props.accessibilityState).toEqual({ checked: false });
  });
});

describe('ReportListCard actions hidden while selecting', () => {
  // ownedDraftInspection has both showEdit and showDelete true, so this is
  // the exact case where a dimmed selectable card (or the "No template yet"
  // one) could otherwise let the Edit/Delete buttons show through behind it.
  it('renders neither Edit nor Delete when selectable', () => {
    const r = render(
      <ReportListCard
        item={ownedDraftInspection}
        currentUid="uid-1"
        canManageAll={false}
        selectable
        onPress={noop}
        onEdit={noop}
        onDelete={noop}
        onToggleSelect={noop}
      />,
    );
    expect(findEditButtons(r, ownedDraftInspection)).toHaveLength(0);
    expect(findDeleteButtons(r, ownedDraftInspection)).toHaveLength(0);
  });

  it('still renders Edit and Delete for the same owned draft report when not selectable', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, ownedDraftInspection)).toHaveLength(1);
    expect(findDeleteButtons(r, ownedDraftInspection)).toHaveLength(1);
  });
});


describe('ReportListCard Edit/Delete visibility (unchanged by this task)', () => {
  it('shows both Edit and Delete for a draft inspection report owned by the viewer', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, ownedDraftInspection)).toHaveLength(1);
    expect(findDeleteButtons(r, ownedDraftInspection)).toHaveLength(1);
  });

  it('hides Edit but keeps Delete once an owned inspection report is submitted', () => {
    const submitted: AllReportItem = { ...ownedDraftInspection, status: 'submitted' };
    const r = render(
      <ReportListCard item={submitted} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, submitted)).toHaveLength(0);
    expect(findDeleteButtons(r, submitted)).toHaveLength(1);
  });

  it('hides both Edit and Delete for a draft inspection report the viewer does not own and cannot manage', () => {
    const othersReport: AllReportItem = { ...ownedDraftInspection, inspectorUid: 'someone-else' };
    const r = render(
      <ReportListCard item={othersReport} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, othersReport)).toHaveLength(0);
    expect(findDeleteButtons(r, othersReport)).toHaveLength(0);
  });

  it('shows both Edit and Delete for a report the viewer does not own when canManageAll is true (Developer account)', () => {
    const othersReport: AllReportItem = { ...ownedDraftInspection, inspectorUid: 'someone-else' };
    const r = render(
      <ReportListCard item={othersReport} currentUid="uid-1" canManageAll onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, othersReport)).toHaveLength(1);
    expect(findDeleteButtons(r, othersReport)).toHaveLength(1);
  });

  it('never shows Edit or Delete for a survey report, even when owned and manageable', () => {
    const surveyReport: AllReportItem = { ...ownedDraftInspection, kind: 'survey' };
    const r = render(
      <ReportListCard item={surveyReport} currentUid="uid-1" canManageAll onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(findEditButtons(r, surveyReport)).toHaveLength(0);
    expect(findDeleteButtons(r, surveyReport)).toHaveLength(0);
  });
});

describe('ReportListCard sync flag placement', () => {
  afterEach(() => {
    mockConfirmResolveConflict.mockClear();
  });

  // The bug this task fixes: the sync flag used to sit between metaRow and
  // dateRow, mid-card. This asserts actual render ORDER — not just that the
  // row exists — so it would fail against the old position.
  //
  // The control number no longer has its own top-level slot in `children` —
  // it now lives inside the dateRow alongside the date (see the "date +
  // control number row" describe block below) — so this looks up the dateRow
  // itself (the child that contains the control-number Text) rather than the
  // control number directly, and asserts THAT row sits strictly before the
  // sync row.
  it('renders the pending-sync row after every other element in the card body, including the date/control-number row', () => {
    const item: AllReportItem = { ...baseItem, syncStatus: 'pending' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const children = findContentChildren(r);
    expect(children.length).toBeGreaterThan(1);

    const lastChild = children[children.length - 1];
    expect(lastChild.findAllByType(Ionicons).some((n) => n.props.name === 'cloud-upload-outline')).toBe(true);

    // The date/control-number row — previously ending in a separate,
    // now-removed controlNo child — must still sit strictly earlier than the
    // sync row.
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === item.controlNo);
    expect(controlNoText).toBeDefined();
    const dateRowChild = children.find((c) => c.findAllByType(Text).includes(controlNoText!));
    expect(dateRowChild).toBeDefined();
    const dateRowIndex = children.indexOf(dateRowChild!);
    expect(dateRowIndex).toBeGreaterThanOrEqual(0);
    expect(dateRowIndex).toBeLessThan(children.length - 1);
  });

  it('renders the conflict-sync row after every other element in the card body, including the date/control-number row', () => {
    const item: AllReportItem = { ...baseItem, syncStatus: 'conflict' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const children = findContentChildren(r);
    expect(children.length).toBeGreaterThan(1);

    const lastChild = children[children.length - 1];
    expect(lastChild.findAllByType(Ionicons).some((n) => n.props.name === 'alert-circle-outline')).toBe(true);

    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === item.controlNo);
    expect(controlNoText).toBeDefined();
    const dateRowChild = children.find((c) => c.findAllByType(Text).includes(controlNoText!));
    expect(dateRowChild).toBeDefined();
    const dateRowIndex = children.indexOf(dateRowChild!);
    expect(dateRowIndex).toBeGreaterThanOrEqual(0);
    expect(dateRowIndex).toBeLessThan(children.length - 1);
  });

  it('shows only the pending row, never the conflict row, when syncStatus is "pending"', () => {
    const item: AllReportItem = { ...baseItem, syncStatus: 'pending' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'cloud-upload-outline')).toBe(true);
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'alert-circle-outline')).toBe(false);
  });

  it('shows only the conflict row, never the pending row, when syncStatus is "conflict"', () => {
    const item: AllReportItem = { ...baseItem, syncStatus: 'conflict' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'alert-circle-outline')).toBe(true);
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'cloud-upload-outline')).toBe(false);
  });

  it('shows neither sync row when syncStatus is "synced"', () => {
    const r = render(
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'cloud-upload-outline')).toBe(false);
    expect(r.root.findAllByType(Ionicons).some((n) => n.props.name === 'alert-circle-outline')).toBe(false);
  });

  it('still resolves and fires confirmResolveConflict when the (now-last) conflict row is pressed', () => {
    const item: AllReportItem = { ...baseItem, syncStatus: 'conflict' };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const children = findContentChildren(r);
    const conflictRow = children[children.length - 1];

    TestRenderer.act(() => {
      conflictRow.props.onPress();
    });

    // baseItem.kind is 'survey', so the conflict resolves against
    // 'survey_reports' — the branch's condition is unchanged by the move.
    expect(mockConfirmResolveConflict).toHaveBeenCalledWith('survey_reports', item.reportId, item.title);
  });
});

describe('ReportListCard date + control number row', () => {
  // Combining the two previously-separate lines is the point of this task —
  // this asserts real row MEMBERSHIP: the date sits directly in dateRow,
  // and the control number is reachable through its own end-aligned group
  // (also a direct child of dateRow), rather than either being split back
  // onto its own line below the row.
  it('renders the date directly in the row and the control number inside its own end-aligned group, not on separate lines', () => {
    const r = render(
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    expect(calendarIcon).toBeDefined();
    const rowChildren = calendarIcon!.parent!.children;

    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    const group = findControlNoGroup(r);

    expect(dateText).toBeDefined();
    expect(controlNoText).toBeDefined();
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
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
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

  // The pricetag icon must travel with the control number as one unit — the
  // real trap this guards against is the icon being stranded mid-row while
  // only the text gets pushed to the end.
  it('renders the pricetag icon inside the same container as the control-number text, so it cannot be stranded mid-row', () => {
    const r = render(
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
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

  // This task's fix: the control number used to opt out of OS font scaling
  // (FONT_SCALING.tabular) because it sat alone on its own line, where an
  // over-long value would overflow. It now shares the date row, and
  // numberOfLines={1}/ellipsizeMode="tail" (asserted below) make it truncate
  // instead of overflow — the truncation is what protects the row now, so
  // the control number no longer needs a scaling opt-out and instead scales
  // with the OS font exactly like the date.
  it('keeps the control number truncating to a single line, now scaling with the OS font exactly like the date', () => {
    const r = render(
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    const controlNoText = r.root.findAllByType(Text).find((n) => n.props.children === baseItem.controlNo);
    const dateText = findDateText(r, controlNoText);
    expect(controlNoText?.props.numberOfLines).toBe(1);
    expect(controlNoText?.props.ellipsizeMode).toBe('tail');
    // Compared against the date's own resolved value (not a separate token
    // pin) so this keeps failing if either side drifts back out of sync.
    expect(resolvedAllowFontScaling(controlNoText)).toBe(resolvedAllowFontScaling(dateText));
    expect(resolvedAllowFontScaling(controlNoText)).toBe(true);
    // Also pins the actual prop to the named policy token, confirming the
    // source switched to FONT_SCALING.content specifically (not just some
    // other truthy value that happens to match the date's default).
    expect(controlNoText?.props.allowFontScaling).toBe(FONT_SCALING.content);
  });

  // The bug this task fixes: the date and control number now sit side by
  // side on one row but used to resolve two different sizes/lineHeights
  // (Type.label vs Type.caption), and different colours/families on top of
  // that. Asserting direct comparisons between the two resolved values —
  // rather than each pinned separately to a token — is what keeps this test
  // failing if either side drifts back out of sync, independent of which
  // token wins.
  it("resolves the control number's fontSize, lineHeight, color and font family to exactly match the date's", () => {
    const r = render(
      <ReportListCard item={baseItem} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
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

  it('never lets a long control number clip the date or dislodge the group from the end of the row', () => {
    const longControlNo = 'CTRL-2026-0000001-EXTREMELY-LONG-CONTROL-NUMBER-VALUE';
    const item: AllReportItem = {
      ...baseItem,
      status: 'draft',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      controlNo: longControlNo,
    };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );

    const calendarIcon = r.root.findAllByType(Ionicons).find((n) => n.props.name === 'calendar-outline');
    const rowChildren = calendarIcon!.parent!.children;

    // The control number is the element that shrinks/truncates
    // (flexShrink: 1, numberOfLines 1) — the date and its icon are pinned
    // (flexShrink: 0) so neither can be squeezed out by it. The urgency badge
    // is no longer part of this row at all: it moved to the card's corner,
    // which is what took the pressure off this row in the first place.
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
    const item: AllReportItem = {
      ...baseItem,
      status: 'draft',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      controlNo: 'C-1',
    };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
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

  it("falls back to 'No control number yet' when controlNo is null", () => {
    const item: AllReportItem = { ...baseItem, controlNo: null };
    const r = render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(Text).some((n) => n.props.children === 'No control number yet')).toBe(true);
  });
});

// Urgency used to render as a chip inside the card — first inline in the date
// row, then in the title row's badge slot. It is now a banner wrapping the
// card's top-left corner, which handed the badge slot back to filing status.
describe('ReportListCard urgency ribbon', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const renderCard = (item: AllReportItem) =>
    render(
      <ReportListCard item={item} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );

  // The ribbon's wrapper is the only node in the card declaring an explicit
  // accessibilityRole of 'text' — Badge.tsx sets no accessibility props at
  // all, so this cannot collide with the Draft/Submitted chip.
  const findRibbon = (r: Renderer) => {
    const views = r.root.findAll((n) => (n.type as any)?.name === 'View' || n.type === View);
    const matches = views.filter((n) => n.props.accessibilityRole === 'text');
    if (matches.length > 1) {
      throw new Error(`Expected at most 1 ribbon but found ${matches.length}`);
    }
    return matches[0];
  };

  const bandLabel = (r: Renderer) => r.root.findByType(SvgText).props.children;
  const chipLabels = (r: Renderer) => proseTexts(r).map((n) => n.props.children);

  it('wraps the corner with an abbreviated overdue count', () => {
    const r = renderCard({ ...baseItem, status: 'draft', date: daysAgo(45) });
    expect(findRibbon(r)).toBeDefined();
    expect(bandLabel(r)).toBe('15d late');
  });

  it('abbreviates remaining runway the same way', () => {
    const r = renderCard({ ...baseItem, status: 'draft', date: daysAgo(15) });
    expect(bandLabel(r)).toBe('15d left');
  });

  it('spells the label out in full for screen readers', () => {
    const r = renderCard({ ...baseItem, status: 'draft', date: daysAgo(45) });
    expect(findRibbon(r).props.accessibilityLabel).toBe('Overdue by 15 days');
  });

  // The ribbon carries urgency, so the badge slot no longer has to say two
  // things at once — a flagged draft shows both, in different places.
  it('keeps the Draft chip alongside the ribbon', () => {
    const r = renderCard({ ...baseItem, status: 'draft', date: daysAgo(45) });
    expect(findRibbon(r)).toBeDefined();
    expect(chipLabels(r)).toContain('Draft');
  });

  // The ribbon was briefly suppressed in selection mode, back when a separate
  // checkbox sat in this corner and the band crossed it. The type tile is the
  // selection control now, so the corner is free and the Export tab gets the
  // same day counts as every other list.
  it('still shows the ribbon in selection mode', () => {
    const item: AllReportItem = { ...baseItem, status: 'draft', date: daysAgo(45) };
    const r = render(
      <ReportListCard
        item={item}
        currentUid="uid-1"
        canManageAll={false}
        onPress={noop}
        onEdit={noop}
        onDelete={noop}
        selectable
        onToggleSelect={noop}
      />,
    );
    expect(findRibbon(r)).toBeDefined();
    expect(bandLabel(r)).toBe('15d late');
  });

  it('shows no ribbon on a draft that is not flagged', () => {
    const r = renderCard({ ...baseItem, status: 'draft', date: daysAgo(2) });
    expect(findRibbon(r)).toBeUndefined();
    expect(chipLabels(r)).toContain('Draft');
  });

  it('shows no ribbon on a submitted report, however old', () => {
    const r = renderCard({ ...baseItem, status: 'submitted', date: daysAgo(400) });
    expect(findRibbon(r)).toBeUndefined();
    expect(chipLabels(r)).toContain('Submitted');
  });

  // The ribbon is an absolutely positioned overlay, so it must not push the
  // card open the way the reserved padding band it replaced used to.
  it('costs a flagged card no extra height over a calm one', () => {
    const flagged: AllReportItem = { ...baseItem, status: 'draft', date: daysAgo(45) };
    const calm: AllReportItem = { ...baseItem, status: 'draft', date: daysAgo(2) };

    const flaggedStyle = flattenStyle(findCard(renderCard(flagged), flagged).props.style);
    const calmStyle = flattenStyle(findCard(renderCard(calm), calm).props.style);

    expect(flaggedStyle.paddingTop).toBeUndefined();
    expect(flaggedStyle.padding).toBe(Spacing.md);
    expect(flaggedStyle.padding).toBe(calmStyle.padding);
  });

  it('still tints the whole card by urgency level', () => {
    const overdue: AllReportItem = { ...baseItem, status: 'draft', date: daysAgo(45) };
    const overdueCard = flattenStyle(findCard(renderCard(overdue), overdue).props.style);
    expect(overdueCard.borderColor).toBe(Colors.hazwaste.border);
    expect(overdueCard.backgroundColor).toBe(Colors.hazwaste.bg);

    const dueSoon: AllReportItem = { ...baseItem, status: 'draft', date: daysAgo(15) };
    const dueSoonCard = flattenStyle(findCard(renderCard(dueSoon), dueSoon).props.style);
    expect(dueSoonCard.borderColor).toBe(Colors.warning.border);
    expect(dueSoonCard.backgroundColor).toBe(Colors.warning.bg);
  });
});

// The home screen's tab pager is a horizontal pagingEnabled ScrollView, so a
// horizontal drag that starts on a card is contested between the two. These
// cards only ever travel LEFT (translateX is clamped to <= 0), so claiming
// rightward drags too - which activeOffsetX([-10, 10]) did - stole a gesture
// the card had no use for and made swiping back a tab nearly impossible on
// top of a list. Claiming leftward only, and failing fast rightward, hands
// every right-swipe to the pager.

describe('ReportListCard has no swipe gesture', () => {
  it('carries no GestureDetector, so horizontal drags belong to the tab pager', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="uid-1" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(GestureDetector)).toHaveLength(0);
  });

  it('shows no overflow menu when the user may neither edit nor delete', () => {
    const r = render(
      <ReportListCard item={ownedDraftInspection} currentUid="someone-else" canManageAll={false} onPress={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(r.root.findAllByType(RowActionsButton)).toHaveLength(0);
  });
});
