import React from 'react';
import { BackHandler, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { useReducedMotion, withDelay } from 'react-native-reanimated';
import { router } from 'expo-router';
import { SpeedDial } from './SpeedDial';
import { FAB_SIZE } from './Fab';
import { ENABLED_TYPES, REPORT_TYPES, ReportType } from '../../../constants/reportTypes';
import { Spacing } from '../../../design/spacing';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Mirrors the constant defined in SpeedDial.tsx
const FAB_EDGE_INSET = Spacing.xxxl;

// jest.mock calls are hoisted above these imports by babel-plugin-jest-hoist
// regardless of source order (see Fab.test.tsx / Skeleton.test.tsx for the
// same convention), so writing them after the imports they mock is safe and
// keeps eslint's import/first rule happy.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    ...actual,
    useReducedMotion: jest.fn(() => false),
    withDelay: jest.fn(actual.withDelay),
  };
});

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (props: Partial<React.ComponentProps<typeof SpeedDial>> = {}) => {
  let r!: Renderer;
  act(() => { r = TestRenderer.create(<SpeedDial {...props} />); });
  return r;
};

// Flattens a (possibly nested/array) RN style prop into one plain object, so
// a computed inline `bottom` merged alongside the StyleSheet.create entry
// can be asserted on directly — same helper shape as Badge.test.tsx /
// Card.test.tsx use for the same reason.
const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

// The trigger's wrapping View: pointerEvents box-none and `right: Spacing.lg`
// distinguish it from `host` (also box-none, but no `right`) and from `rows`
// (also `right: Spacing.lg`, but additionally carries `gap`). `.find()`
// throws on zero or multiple matches, so an accidental double-match (or a
// style regression that drops one of these properties) fails loudly instead
// of silently indexing into the wrong node.
const findFabWrapView = (r: Renderer) =>
  r.root.find(n => {
    if (n.type !== View) return false;
    const style = flattenStyle(n.props.style);
    return n.props.pointerEvents === 'box-none' && style.right === Spacing.lg && style.gap === undefined;
  });

// The rows container: only rendered while the dial is open, uniquely
// identified among the host's Views by carrying `gap: Spacing.md`.
const findRowsView = (r: Renderer) =>
  r.root.find(n => {
    if (n.type !== View) return false;
    const style = flattenStyle(n.props.style);
    return n.props.pointerEvents === 'box-none' && style.gap === Spacing.md;
  });

// `Touchable` forwards its props onto the `Pressable` it wraps, so a plain
// (deep) `findAll` picks up both layers for the same on-screen control.
// `TestInstance.find` uses react-test-renderer's own shallow-stop traversal
// (it does not descend past a match) and throws unless exactly one instance
// matches — the built-in equivalent of a locator that fails loudly on an
// ambiguous or missing match instead of silently indexing [0].
//
// Matched on accessibilityRole + accessibilityLabel rather than "has a
// function onPress": an unavailable report type's row is `disabled` and its
// `onPress` is `undefined` by design (see the "unavailable report types"
// suite below), so requiring onPress to be a function would make this
// locator fail to find exactly the rows that most need asserting on.
const byLabel = (r: Renderer, label: string) =>
  r.root.find(n => n.props?.accessibilityLabel === label && n.props?.accessibilityRole === 'button');

// Mirrors the pill's own `maxWidth: 200` in SpeedDial.tsx, which nothing
// else in the row shares (rowButton is a fixed 48x48 square) — used only to
// pick the pill out of the tree, not to assert a resolved token value.
const PILL_MAX_WIDTH = 200;

const findPillFor = (r: Renderer, type: ReportType) =>
  r.root.find(n => {
    if (n.type !== View) return false;
    const style = flattenStyle(n.props.style);
    return style.maxWidth === PILL_MAX_WIDTH && style.backgroundColor === type.bgColor;
  });

const findAllPills = (r: Renderer) =>
  r.root.findAll(n => {
    if (n.type !== View) return false;
    const style = flattenStyle(n.props.style);
    return style.maxWidth === PILL_MAX_WIDTH;
  });

// react-test-renderer never runs a real layout pass, so a pill's onLayout is
// only ever invoked by tests, explicitly, with a width they choose.
const layoutEvent = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 32 } } });

const ENABLED_TYPE = REPORT_TYPES.find(t => ENABLED_TYPES.includes(t.key))!;
const UNAVAILABLE_TYPES = REPORT_TYPES.filter(t => !ENABLED_TYPES.includes(t.key));

const openDial = (r: Renderer) => {
  act(() => { byLabel(r, 'Create new report').props.onPress(); });
};

// These cases exercise the region's report types; a region with no report
// types has no rows to render, so they skip. (it.each throws on an empty
// table even inside a skipped describe, hence eachType.)
const describeWhenTypes = REPORT_TYPES.length > 0 ? describe : describe.skip;
const eachType = (list: ReportType[]) => (list.length ? it.each(list) : it.skip.each([null as unknown as ReportType]));

describeWhenTypes('SpeedDial', () => {
  let backSpy: jest.SpyInstance;

  beforeEach(() => {
    backSpy = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    (useReducedMotion as jest.Mock).mockReturnValue(false);
    (router.push as jest.Mock).mockClear();
    (withDelay as jest.Mock).mockClear();
  });

  afterEach(() => {
    backSpy.mockRestore();
  });

  it('shows no report type rows until it is opened', () => {
    const r = render();
    expect(r.root.findAll(n => n.props?.accessibilityLabel === REPORT_TYPES[0].title)).toHaveLength(0);
  });

  it('reveals a row per report type when opened', () => {
    const r = render();
    openDial(r);
    REPORT_TYPES.forEach(type => {
      expect(byLabel(r, type.title)).toBeDefined();
    });
  });

  it('labels each row with the full legal title, not the short one', () => {
    const r = render();
    openDial(r);
    // A type whose legal title differs from its short one (every EMB4B type's does).
    const longTitled = REPORT_TYPES.find(t => t.title !== t.shortTitle)!;
    expect(byLabel(r, longTitled.title)).toBeDefined();
    expect(longTitled.title).not.toBe(longTitled.shortTitle);
  });

  it('navigates to the selected report type route and closes', () => {
    const r = render();
    openDial(r);
    act(() => { byLabel(r, ENABLED_TYPE.title).props.onPress(); });

    expect(router.push).toHaveBeenCalledWith(ENABLED_TYPE.route);
    expect(r.root.findAll(n => n.props?.accessibilityLabel === ENABLED_TYPE.title)).toHaveLength(0);
  });

  // Only enabled types are pressable and expected to navigate — the
  // unavailable ones are covered by the "unavailable report types" suite
  // below, which asserts the opposite (no navigation, disabled state, a
  // "Soon" badge). REPORT_TYPES[0] ('air') used to be part of this sweep
  // before problem 3's fix; it's excluded here because it isn't enabled.
  eachType(REPORT_TYPES.filter(t => ENABLED_TYPES.includes(t.key)))(
    'presses row for $title and navigates to its own route',
    (type) => {
      const r = render();
      openDial(r);
      act(() => { byLabel(r, type.title).props.onPress(); });

      expect(router.push).toHaveBeenCalledWith(type.route);
    },
  );

  it('closes on Android hardware back instead of letting it navigate away', () => {
    const r = render();
    openDial(r);

    const handler = backSpy.mock.calls.at(-1)?.[1] as () => boolean;
    let consumed!: boolean;
    act(() => { consumed = handler(); });

    expect(consumed).toBe(true);
    expect(r.root.findAll(n => n.props?.accessibilityLabel === REPORT_TYPES[0].title)).toHaveLength(0);
  });

  it('does not register a hardware back handler while closed', () => {
    render();
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('removes the hardware back subscription when a row selection closes the dial', () => {
    const r = render();
    openDial(r);

    expect(backSpy).toHaveBeenCalledTimes(1);
    const removeSpy = (backSpy.mock.results[0].value as { remove: jest.Mock }).remove;
    expect(removeSpy).not.toHaveBeenCalled();

    act(() => { byLabel(r, ENABLED_TYPE.title).props.onPress(); });

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('removes the hardware back subscription on unmount while open, so it cannot leak past this screen', () => {
    const r = render();
    openDial(r);

    const removeSpy = (backSpy.mock.results[0].value as { remove: jest.Mock }).remove;
    expect(removeSpy).not.toHaveBeenCalled();

    act(() => { r.unmount(); });

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('skips the staggered entrance under reduced motion', () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const r = render();
    openDial(r);

    expect(byLabel(r, REPORT_TYPES[0].title)).toBeDefined();
    expect(withDelay).not.toHaveBeenCalled();
  });

  // Regression coverage for the FAB overlapping AppChrome's footer bar on
  // device: fabWrap/rows used to hardcode `bottom: Spacing.lg`, which put the
  // trigger underneath HomeFooter (and any taller screen-registered footer)
  // instead of above it. bottomInset is how AppChrome's measured footer
  // height reaches this component now.
  describe('bottom inset (footer clearance)', () => {
    const FOOTER_INSET = 40;

    it('anchors the trigger FAB_EDGE_INSET above the bottom when bottomInset is omitted', () => {
      const r = render();
      const style = flattenStyle(findFabWrapView(r).props.style);
      expect(style.bottom).toBe(FAB_EDGE_INSET);
    });

    it('stacks the rows to clear the trigger and its own inset when bottomInset is omitted', () => {
      const r = render();
      openDial(r);
      const style = flattenStyle(findRowsView(r).props.style);
      expect(style.bottom).toBe(FAB_EDGE_INSET + FAB_SIZE + Spacing.md);
    });

    it('shifts the trigger up by the measured footer inset', () => {
      const r = render({ bottomInset: FOOTER_INSET });
      const style = flattenStyle(findFabWrapView(r).props.style);
      expect(style.bottom).toBe(FAB_EDGE_INSET + FOOTER_INSET);
    });

    it('shifts the rows up by the same footer inset, still clearing the trigger by FAB_SIZE + Spacing.md', () => {
      const r = render({ bottomInset: FOOTER_INSET });
      openDial(r);
      const style = flattenStyle(findRowsView(r).props.style);
      expect(style.bottom).toBe(FAB_EDGE_INSET + FOOTER_INSET + FAB_SIZE + Spacing.md);
    });
  });

  // Problem 1: the pill used to be a plain, non-touchable View — only the
  // small icon circle responded to taps. Pill and icon now share one
  // Touchable per row, so pressing at the pill's own position must fire the
  // same navigation as pressing the icon.
  it('pressing the pill (not just the icon) triggers selection for an enabled type', () => {
    const r = render();
    openDial(r);

    const pill = findPillFor(r, ENABLED_TYPE);
    // The pill itself carries no onPress — proving it isn't independently
    // touchable — so the shared row handler must be found by walking up to
    // its nearest interactive ancestor.
    expect(pill.props.onPress).toBeUndefined();

    let ancestor = pill.parent;
    while (ancestor && typeof ancestor.props?.onPress !== 'function') {
      ancestor = ancestor.parent;
    }
    if (!ancestor) throw new Error('No pressable ancestor found above the pill');

    act(() => { ancestor!.props.onPress(); });
    expect(router.push).toHaveBeenCalledWith(ENABLED_TYPE.route);
  });

  // Problem 2: pills used to size to their own content, so "Hazwaste
  // generators" was wide and "EIA" was narrow. All six must now render at
  // the same width, and that width must come from measurement, not a
  // hardcoded constant.
  describe('uniform pill width (computed from measurement)', () => {
    it('has no explicit width on any pill before a layout has been measured', () => {
      const r = render();
      openDial(r);
      findAllPills(r).forEach(pill => {
        expect(flattenStyle(pill.props.style).width).toBeUndefined();
      });
    });

    it('converges every pill to the widest one measured', () => {
      const r = render();
      openDial(r);

      // Deliberately unsorted and not in REPORT_TYPES order, so a
      // first-wins or last-wins bug (instead of a true max) would fail this.
      const widths = [80, 143, 95, 121, 60, 110];
      expect(widths).toHaveLength(REPORT_TYPES.length);

      act(() => {
        REPORT_TYPES.forEach((type, i) => {
          findPillFor(r, type).props.onLayout(layoutEvent(widths[i]));
        });
      });

      const maxWidth = Math.max(...widths);
      REPORT_TYPES.forEach(type => {
        expect(flattenStyle(findPillFor(r, type).props.style).width).toBe(maxWidth);
      });
    });

    it('does not oscillate: re-measuring a pill that already has the applied width leaves it unchanged', () => {
      const r = render();
      openDial(r);

      const widths = [80, 143, 95, 121, 60, 110];
      act(() => {
        REPORT_TYPES.forEach((type, i) => {
          findPillFor(r, type).props.onLayout(layoutEvent(widths[i]));
        });
      });
      const maxWidth = Math.max(...widths);

      // Once `width: maxWidth` is applied, RN's next layout pass reports
      // that same explicit width back (an explicit width pins the measured
      // size — it no longer reflects content). Firing that "echo"
      // measurement repeatedly, on every row, must never grow the value
      // further and must never reset it to unset. This is the guard against
      // the measure -> apply -> re-measure loop described in SpeedDial.tsx.
      act(() => {
        for (let pass = 0; pass < 3; pass++) {
          REPORT_TYPES.forEach(type => {
            findPillFor(r, type).props.onLayout(layoutEvent(maxWidth));
          });
        }
      });

      REPORT_TYPES.forEach(type => {
        expect(flattenStyle(findPillFor(r, type).props.style).width).toBe(maxWidth);
      });
    });

    it('never shrinks an already-applied width if a later measurement reports something smaller', () => {
      const r = render();
      openDial(r);
      const [first, second] = REPORT_TYPES;

      act(() => { findPillFor(r, first).props.onLayout(layoutEvent(150)); });
      act(() => { findPillFor(r, second).props.onLayout(layoutEvent(90)); });

      expect(flattenStyle(findPillFor(r, second).props.style).width).toBe(150);
    });
  });

  // Problem 3: five of the six report types have no real form yet.
  // AddReportSplitPanel already disables them (dimmed, "Soon" badge,
  // non-pressable); the dial must match rather than silently routing into
  // the developer placeholder screen. The user was explicit that all six
  // stay visible — only their interactivity changes.
  describe('unavailable report types', () => {
    // Guards this whole suite against a future ENABLED_TYPES that lists
    // every key, which would make every `it.each` below run zero cases and
    // silently stop testing anything.
    it('has at least one unavailable type to exercise', () => {
      expect(UNAVAILABLE_TYPES.length).toBeGreaterThan(0);
    });

    eachType(UNAVAILABLE_TYPES)(
      'renders $title as disabled, with a Soon badge, and ignores a press',
      (type) => {
        const r = render();
        openDial(r);
        const row = byLabel(r, type.title);

        expect(row.props.disabled).toBe(true);
        expect(row.props.accessibilityState).toEqual({ disabled: true });
        expect(row.find(n => n.type === Text && n.props.children === 'Soon')).toBeDefined();

        // No onPress at all for a disabled row — there is nothing a press
        // could invoke, which is what actually prevents it from ever
        // reaching the placeholder screen.
        expect(row.props.onPress).toBeUndefined();
        act(() => { row.props.onPress?.(); });
        expect(router.push).not.toHaveBeenCalled();
      },
    );

    eachType(REPORT_TYPES.filter(t => ENABLED_TYPES.includes(t.key)))(
      'renders $title as available: not disabled, no Soon badge',
      (type) => {
        const r = render();
        openDial(r);
        const row = byLabel(r, type.title);

        expect(row.props.disabled).toBeFalsy();
        expect(row.props.accessibilityState).toEqual({ disabled: false });
        expect(row.findAll(n => n.type === Text && n.props.children === 'Soon')).toHaveLength(0);
      },
    );

    it('still animates unavailable rows in alongside the rest rather than skipping them', () => {
      const r = render();
      openDial(r);
      // Presence after opening (with the staggered-entrance effects run via
      // `act`) is the same check the "reveals a row per report type" test
      // above makes for every row, including unavailable ones — repeated
      // here to document that "inert" does not mean "invisible" or
      // "unanimated".
      UNAVAILABLE_TYPES.forEach(type => {
        expect(byLabel(r, type.title)).toBeDefined();
      });
    });
  });
});

// Guards the hoist in problem 3: ENABLED_TYPES must live in exactly one
// place so that enabling a report type for one surface (the dial,
// AddReportSplitPanel) can't be done without the other — a stale duplicate
// would silently disagree with this file's own ENABLED_TYPE/UNAVAILABLE_TYPES
// constants above. The region declares it (src/region/__tests__/catalog.test.ts
// pins that); the foundation only re-exports it through constants/reportTypes.ts.
describe('ENABLED_TYPES has exactly one definition, shared by both surfaces', () => {
  const declarationPattern = /\bconst\s+ENABLED_TYPES\s*[:=]/g;
  const importPattern = (source: string) =>
    /import\s*\{[^}]*\bENABLED_TYPES\b[^}]*\}\s*from\s*['"][^'"]*constants\/reportTypes['"]/.test(source);

  const facadeSource = fs.readFileSync(path.join(__dirname, '../../../constants/reportTypes.ts'), 'utf8');
  const speedDialSource = fs.readFileSync(path.join(__dirname, 'SpeedDial.tsx'), 'utf8');
  const splitPanelSource = fs.readFileSync(
    path.join(__dirname, '../../inspections/components/AddReportSplitPanel.tsx'),
    'utf8',
  );

  it('is re-exported from the region by constants/reportTypes.ts, never declared in the foundation', () => {
    expect(facadeSource.match(declarationPattern)).toBeNull();
    expect(/export\s*\{[^}]*\bENABLED_TYPES\b[^}]*\}\s*from\s*['"]\.\.\/region['"]/.test(facadeSource)).toBe(true);
    expect(speedDialSource.match(declarationPattern)).toBeNull();
    expect(splitPanelSource.match(declarationPattern)).toBeNull();
  });

  it('SpeedDial.tsx imports it rather than redeclaring it', () => {
    expect(importPattern(speedDialSource)).toBe(true);
  });

  it('AddReportSplitPanel.tsx imports it rather than redeclaring it', () => {
    expect(importPattern(splitPanelSource)).toBe(true);
  });
});
