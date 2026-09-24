import React from 'react';
import { Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { DenrPermitsSection } from './DenrPermitsSection';
import * as useEditableSectionModule from '../hooks/useEditableSection';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';

// DenrPermitsSection imports from the database layer via patchPermitsSnapshot,
// which constructs a real WatermelonDB adapter at import time (via
// db/database.ts) requiring the native JSI binding not present under Jest.
// DenrPermitsSection also imports FormSection -> useScrollToInput ->
// react-native-keyboard-controller's native binding. jest.mock calls
// are hoisted above imports by babel-plugin-jest-hoist regardless of
// where written, so these apply before DenrPermitsSection is required.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));
jest.mock('../../../services/supabase/client');
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

type Renderer = TestRenderer.ReactTestRenderer;

// Async act: @expo/vector-icons' Icon sets state when its font resolves,
// which lands after a synchronous act() and warns.
const render = async (element: React.ReactElement) => {
  let r!: Renderer;
  await TestRenderer.act(async () => { r = TestRenderer.create(element); });
  return r;
};

// Check whether the empty-state message is rendered.
// Returns true if found, false if not found (zero matches).
// Throws if multiple matches (indicates locator is not specific enough).
const hasEmptyStateText = (r: Renderer, message: string): boolean => {
  const texts = r.root.findAll((n) => n.type === Text);
  const matches = texts.filter((n) => n.props.children === message);
  if (matches.length > 1) {
    throw new Error(`Expected 0 or 1 Text node with message "${message}" but found ${matches.length}`);
  }
  return matches.length === 1;
};

// The empty-state tests below stub useEditableSection. Without this the
// stub leaks into every test that follows and they silently exercise a
// component frozen in read-only mode.
afterEach(() => jest.restoreAllMocks());

const noop = () => {};
const noopSave = async () => {};

const samplePermit = (): PermitSnapshotItem => ({
  envi_law: 'RA 8749',
  permit_type: 'Permit to Operate',
  permit_serial: 'PTO-2024-001',
  issued_date: '2024-01-15',
  expiry_date: '2025-01-15',
});

describe('DenrPermitsSection empty-state message visibility', () => {
  const emptyStateMessage = 'No permits on record for this report.';

  // Helper to create a mock useEditableSection return value
  const createMockSection = (
    permits: PermitSnapshotItem[],
    editing: boolean,
  ) => ({
    editing,
    draft: permits,
    setDraft: jest.fn(),
    startEdit: jest.fn(),
    cancel: jest.fn(),
    save: jest.fn(),
    saving: false,
    error: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the empty-state message when no permits present and NOT editing', async () => {
    // Mock useEditableSection to return editing=false with empty permits
    jest.spyOn(useEditableSectionModule, 'useEditableSection').mockReturnValue(
      createMockSection([], false),
    );

    const r = await render(
      <DenrPermitsSection
        onSave={noopSave}
        permits={[]}
        canEdit={true}
        onSaved={noop}
      />,
    );

    // With no permits and editing=false, the empty-state message should be visible
    expect(hasEmptyStateText(r, emptyStateMessage)).toBe(true);
  });

  it('does NOT render the empty-state message when no permits present but IS editing', async () => {
    // Mock useEditableSection to return editing=true with empty permits
    jest.spyOn(useEditableSectionModule, 'useEditableSection').mockReturnValue(
      createMockSection([], true),
    );

    const r = await render(
      <DenrPermitsSection
        onSave={noopSave}
        permits={[]}
        canEdit={true}
        onSaved={noop}
      />,
    );

    // With no permits but editing=true, the empty-state message should NOT be visible
    // (the user is in edit mode and should see the Add Permit button instead)
    expect(hasEmptyStateText(r, emptyStateMessage)).toBe(false);
  });

  it('does NOT render the empty-state message when permits are present and NOT editing', async () => {
    const permits = [samplePermit()];

    // Mock useEditableSection to return editing=false with actual permits
    jest.spyOn(useEditableSectionModule, 'useEditableSection').mockReturnValue(
      createMockSection(permits, false),
    );

    const r = await render(
      <DenrPermitsSection
        onSave={noopSave}
        permits={permits}
        canEdit={true}
        onSaved={noop}
      />,
    );

    // With permits present, the empty-state message should NOT be visible
    expect(hasEmptyStateText(r, emptyStateMessage)).toBe(false);
  });
});

// The section is shared: the report screens persist into the report's own
// permits snapshot, the establishment screen into the establishment's
// denrPermits. It knows only that saving is something its caller does.
describe('DenrPermitsSection delegates persistence to its caller', () => {
  const permit = (): PermitSnapshotItem => ({
    envi_law: 'RA 9275',
    permit_type: 'Discharge Permit',
    permit_serial: 'DP-1',
    issued_date: '2026-01-01',
    expiry_date: '2027-01-01',
  });

  const startEditing = async (r: TestRenderer.ReactTestRenderer) => {
    await TestRenderer.act(async () => {
      r.root
        .findAll(n => n.props?.accessibilityLabel === 'Edit' && typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
  };

  const save = async (r: TestRenderer.ReactTestRenderer) => {
    await TestRenderer.act(async () => {
      r.root
        .findAll(n => n.props?.accessibilityLabel === 'Save' && typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
  };

  it('hands the edited permits to onSave, then reports the save upward', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onSaved = jest.fn();
    const r = await render(
      <DenrPermitsSection permits={[permit()]} canEdit onSave={onSave} onSaved={onSaved} />,
    );
    await startEditing(r);
    await save(r);
    expect(onSave).toHaveBeenCalledWith([permit()]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('keeps the editor open and reports nothing upward when the save fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('offline'));
    const onSaved = jest.fn();
    const r = await render(
      <DenrPermitsSection permits={[permit()]} canEdit onSave={onSave} onSaved={onSaved} />,
    );
    await startEditing(r);
    await save(r);
    expect(onSaved).not.toHaveBeenCalled();
    expect(
      r.root.findAll(n => n.props?.accessibilityLabel === 'Save' && typeof n.props?.onPress === 'function'),
    ).not.toHaveLength(0);
  });
});
