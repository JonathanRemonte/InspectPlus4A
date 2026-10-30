import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TestRenderer from 'react-test-renderer';
import { FormSection } from './FormSection';
import { Colors } from '../../design/colors';
import { Spacing } from '../../design/spacing';
import { Type } from '../../design/typography';
import { ReportThemeProvider } from '../../core/providers/ReportThemeProvider';
import { REPORT_TYPE_DISPLAY } from '../../constants/reportTypeDisplay';

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity).filter(Boolean) as Record<string, unknown>[]));

// The AppText-rendered title is the only Text node this component's own
// StyleSheet drives; it is uniquely identified by color + fontWeight among
// this component's own Text nodes (children are opaque - AppText/Ionicons
// internals - which is exactly why this component's siblings resolve their
// own text by style rather than content).
const findTitle = (r: Renderer) =>
  r.root.find(
    (n) => n.type === Text && flattenStyle(n.props.style).color === Colors.navy
      && flattenStyle(n.props.style).fontWeight === '700',
  );

const findSectionWrap = (r: Renderer) =>
  r.root.find((n) => n.type === View && flattenStyle(n.props.style).marginBottom !== undefined);

describe('FormSection token resolution', () => {
  it("resolves the title's fontSize/lineHeight to Type.subheading", () => {
    const r = render(<FormSection title="General Information">{null}</FormSection>);
    const style = flattenStyle(findTitle(r)?.props.style);
    expect(style.fontSize).toBe(Type.subheading.fontSize);
    expect(style.lineHeight).toBe(Type.subheading.lineHeight);
  });

  it('resolves the section-separating marginBottom to Spacing.xxl, not the old bare 28', () => {
    const r = render(<FormSection title="General Information">{null}</FormSection>);
    const style = flattenStyle(findSectionWrap(r)?.props.style);
    expect(style.marginBottom).toBe(Spacing.xxl);
  });

  it('resolves the title row gap to Spacing.sm, not the old bare 7', () => {
    const r = render(<FormSection title="General Information">{null}</FormSection>);
    const titleRow = r.root.find(
      (n) => n.type === View && flattenStyle(n.props.style).justifyContent === 'space-between',
    );
    expect(flattenStyle(titleRow.props.style).gap).toBe(Spacing.sm);
  });
});

describe('FormSection legibility guarantee', () => {
  it('renders nothing below Type.caption.fontSize with an icon and headerRight present', () => {
    const r = render(
      <FormSection title="DENR Permits, Licenses & Clearances" icon="document-text" headerRight={<Text>Edit</Text>}>
        <Text>Body content</Text>
      </FormSection>,
    );
    const glyphs = new Set(r.root.findAllByType(Ionicons).flatMap((icon) => icon.findAllByType(Text)));
    const sizes = r.root
      .findAllByType(Text)
      .filter((n) => !glyphs.has(n) && n.props.children !== 'Edit' && n.props.children !== 'Body content')
      .map((n) => flattenStyle(n.props.style).fontSize)
      .filter((size): size is number => typeof size === 'number');
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });

  it('renders nothing below Type.caption.fontSize with no icon and no headerRight', () => {
    const r = render(<FormSection title="Compliance Checklists">{null}</FormSection>);
    const sizes = r.root
      .findAllByType(Text)
      .map((n) => flattenStyle(n.props.style).fontSize)
      .filter((size): size is number => typeof size === 'number');
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(Type.caption.fontSize));
  });
});

describe('FormSection behavior (unchanged by this task)', () => {
  it('renders the icon only when provided', () => {
    const withIcon = render(<FormSection title="X" icon="document-text">{null}</FormSection>);
    const withoutIcon = render(<FormSection title="X">{null}</FormSection>);
    expect(withIcon.root.findAllByType(Ionicons)).toHaveLength(1);
    expect(withoutIcon.root.findAllByType(Ionicons)).toHaveLength(0);
  });

  it('renders headerRight only when provided', () => {
    const r = render(
      <FormSection title="X" headerRight={<Text testID="header-right">Edit</Text>}>{null}</FormSection>,
    );
    // Text's own module wraps an inner host-level instance sharing the same
    // props, so `findAllByProps` alone double-matches (composite + host) -
    // anchoring on `n.type === Text` keeps this to the outer fiber only,
    // the same convention used for TouchableOpacity elsewhere in this suite.
    expect(r.root.findAll((n) => n.type === Text && n.props.testID === 'header-right')).toHaveLength(1);
  });

  it("renders the given children below the title row", () => {
    const r = render(
      <FormSection title="X">
        <Text testID="section-body">Body</Text>
      </FormSection>,
    );
    expect(r.root.findAll((n) => n.type === Text && n.props.testID === 'section-body')).toHaveLength(1);
  });
});

// The section icon takes the report's accent when a report screen provides
// one, so every section of a water form carries a trace of water blue. It is
// the only thing that changes: the title stays navy and the rule stays grey,
// because the icon is identity and those are structure. Off a report screen
// there is no accent and the icon keeps its navy.
// The report type comes from the region's catalog; a region with no report
// types has no accent to pin, so the accented cases skip.
const ACCENTED = Object.entries(REPORT_TYPE_DISPLAY)[0];
const itWhenAccented = ACCENTED ? it : it.skip;
const [ACCENT_KEY, ACCENT_DISPLAY] = ACCENTED ?? ['', undefined];

describe('FormSection report accent', () => {
  const iconColor = (element: React.ReactElement) => {
    let r!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => { r = TestRenderer.create(element); });
    return r.root.findByType(Ionicons).props.color;
  };

  it('paints the icon navy outside a report screen', () => {
    expect(iconColor(<FormSection icon="water-outline" title="Water Sources"><Text>x</Text></FormSection>)).toBe(
      Colors.navy,
    );
  });

  itWhenAccented("paints the icon in the report type's accent inside one", () => {
    expect(
      iconColor(
        <ReportThemeProvider reportType={ACCENT_KEY}>
          <FormSection icon="water-outline" title="Water Sources"><Text>x</Text></FormSection>
        </ReportThemeProvider>,
      ),
    ).toBe(ACCENT_DISPLAY?.textColor);
  });

  itWhenAccented('leaves the title navy even when the icon is accented', () => {
    let r!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      r = TestRenderer.create(
        <ReportThemeProvider reportType={ACCENT_KEY}>
          <FormSection icon="water-outline" title="Water Sources"><Text>x</Text></FormSection>
        </ReportThemeProvider>,
      );
    });
    const title = r.root.findAll((n) => n.type === Text && n.props.children === 'Water Sources')[0];
    expect(flattenStyle(title.props.style).color).toBe(Colors.navy);
  });
});
