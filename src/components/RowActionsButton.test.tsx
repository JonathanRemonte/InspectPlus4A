import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { RowActionsButton } from './RowActionsButton';

type Renderer = TestRenderer.ReactTestRenderer;

// react-native's View is a function component under jest-expo, not a host
// component, so createNodeMock never fires and measureInWindow is inert -
// the measurement path cannot be exercised here. That is exactly why the
// menu opens on the press rather than on the measurement; placement itself
// is covered by popoverPosition.test.ts.
const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const menuButton = (r: Renderer) =>
  r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'More actions');

const openMenu = async (r: Renderer) => {
  await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
};

const isOpen = (r: Renderer) => r.root.findAllByType(Modal).length > 0;

const actionRow = (r: Renderer, label: string) => {
  const matches = r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === label);
  if (matches.length !== 1) throw new Error(`Expected 1 "${label}" row, found ${matches.length}`);
  return matches[0];
};

// The dismiss backdrop is a Pressable covering the screen. Pressable is a
// wrapper component here, so it is located by its label and handler rather
// than by type, which would match neither the wrapper nor its inner node
// reliably.
const backdrop = (r: Renderer) => {
  const matches = r.root.findAll(
    n => n.props?.accessibilityLabel === 'Dismiss menu' && typeof n.props?.onPress === 'function',
  );
  if (matches.length === 0) throw new Error('No dismiss backdrop found');
  return matches[0];
};

const labels = (r: Renderer) =>
  r.root.findAllByType(Text).map(n => n.props.children).filter(c => typeof c === 'string');

describe('RowActionsButton', () => {
  it('renders nothing when the row has no actions available to this user', () => {
    const r = render(<RowActionsButton title="Report" actions={[]} />);
    expect(menuButton(r)).toHaveLength(0);
  });

  it('shows no popover until the button is pressed', () => {
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: jest.fn() }]} />);
    expect(isOpen(r)).toBe(false);
  });

  it('opens a popover listing every action', async () => {
    const r = render(
      <RowActionsButton
        title="Report"
        actions={[
          { id: 'edit', label: 'Edit', onSelect: jest.fn() },
          { id: 'delete', label: 'Delete', variant: 'danger', onSelect: jest.fn() },
        ]}
      />,
    );
    await openMenu(r);
    expect(isOpen(r)).toBe(true);
    expect(labels(r)).toEqual(expect.arrayContaining(['Edit', 'Delete']));
  });

  // Tapping outside is how an anchored popover is dismissed, so a Cancel row
  // would only add height to say what the backdrop already says.
  it('offers no Cancel row', async () => {
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: jest.fn() }]} />);
    await openMenu(r);
    expect(labels(r)).not.toContain('Cancel');
  });

  it('shows no title, icon or close button — only the actions', async () => {
    const r = render(<RowActionsButton title="Water Monitoring Report" actions={[{ id: 'delete', label: 'Delete', onSelect: jest.fn() }]} />);
    await openMenu(r);
    expect(labels(r)).toEqual(['Delete']);
    expect(r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Close')).toHaveLength(0);
  });

  it('runs only the action that was chosen, and closes', async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const r = render(
      <RowActionsButton
        title="Report"
        actions={[
          { id: 'edit', label: 'Edit', onSelect: onEdit },
          { id: 'delete', label: 'Delete', onSelect: onDelete },
        ]}
      />,
    );
    await openMenu(r);
    await TestRenderer.act(async () => { actionRow(r, 'Delete').props.onPress(); });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(isOpen(r)).toBe(false);
  });

  it('runs nothing when the backdrop is tapped', async () => {
    const onDelete = jest.fn();
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: onDelete }]} />);
    await openMenu(r);
    await TestRenderer.act(async () => { backdrop(r).props.onPress(); });
    expect(onDelete).not.toHaveBeenCalled();
    expect(isOpen(r)).toBe(false);
  });

  it('runs nothing when Android hardware back dismisses it', async () => {
    const onDelete = jest.fn();
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: onDelete }]} />);
    await openMenu(r);
    await TestRenderer.act(async () => { r.root.findAllByType(Modal)[0].props.onRequestClose(); });
    expect(onDelete).not.toHaveBeenCalled();
    expect(isOpen(r)).toBe(false);
  });

  it('still opens, positioned, when the platform declines to measure the button', async () => {
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: jest.fn() }]} />);
    await openMenu(r);
    const positioned = r.root.findAll(n => {
      const style = Object.assign({}, ...[n.props?.style].flat(Infinity).filter(Boolean));
      return style.position === 'absolute' && typeof style.top === 'number' && typeof style.left === 'number';
    });
    expect(positioned.length).toBeGreaterThan(0);
  });
});
