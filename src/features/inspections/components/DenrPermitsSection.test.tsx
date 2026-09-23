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

const noop = () => {};

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
        reportId="report-1"
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
        reportId="report-1"
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
        reportId="report-1"
        permits={permits}
        canEdit={true}
        onSaved={noop}
      />,
    );

    // With permits present, the empty-state message should NOT be visible
    expect(hasEmptyStateText(r, emptyStateMessage)).toBe(false);
  });
});
