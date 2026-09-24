import React from 'react';
import { TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { RowActionsButton } from './RowActionsButton';
import { registerPromptHandler, type PromptRequest } from '../services/prompt/promptService';

type Renderer = TestRenderer.ReactTestRenderer;

let prompts: PromptRequest[] = [];
let pending: { request: PromptRequest; resolve: (id: string | null) => void } | null = null;

beforeEach(() => {
  prompts = [];
  pending = null;
  registerPromptHandler((request, resolve) => {
    prompts.push(request);
    pending = { request, resolve };
  });
});
afterEach(() => registerPromptHandler(null));

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

const menuButton = (r: Renderer) =>
  r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'More actions');

// Answers the open menu as if that row had been tapped.
const choose = async (label: string) => {
  if (!pending) throw new Error('No menu is open');
  const action = pending.request.actions?.find(a => a.label === label);
  if (!action) throw new Error(`No "${label}" in the menu`);
  const { resolve } = pending;
  pending = null;
  await TestRenderer.act(async () => { resolve(action.id); });
};

const dismiss = async () => {
  if (!pending) throw new Error('No menu is open');
  const { resolve } = pending;
  pending = null;
  await TestRenderer.act(async () => { resolve(null); });
};

describe('RowActionsButton', () => {
  it('renders nothing when the row has no actions available to this user', () => {
    const r = render(<RowActionsButton title="Report" actions={[]} />);
    expect(menuButton(r)).toHaveLength(0);
  });

  it('opens a list-layout menu titled after the row', async () => {
    const r = render(
      <RowActionsButton title="Water Monitoring Report" actions={[{ id: 'delete', label: 'Delete', onSelect: jest.fn() }]} />,
    );
    await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].title).toBe('Water Monitoring Report');
    expect(prompts[0].layout).toBe('list');
  });

  it('offers every action plus a way out, in order', async () => {
    const r = render(
      <RowActionsButton
        title="Report"
        actions={[
          { id: 'edit', label: 'Edit', onSelect: jest.fn() },
          { id: 'delete', label: 'Delete', variant: 'danger', onSelect: jest.fn() },
        ]}
      />,
    );
    await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
    expect(prompts[0].actions?.map(a => a.label)).toEqual(['Edit', 'Delete', 'Cancel']);
    expect(prompts[0].actions?.[1].variant).toBe('danger');
  });

  it('runs only the action that was chosen', async () => {
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
    await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
    await choose('Delete');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('runs nothing when the menu is dismissed', async () => {
    const onDelete = jest.fn();
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: onDelete }]} />);
    await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
    await dismiss();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('runs nothing when Cancel is chosen', async () => {
    const onDelete = jest.fn();
    const r = render(<RowActionsButton title="Report" actions={[{ id: 'delete', label: 'Delete', onSelect: onDelete }]} />);
    await TestRenderer.act(async () => { menuButton(r)[0].props.onPress(); });
    await choose('Cancel');
    expect(onDelete).not.toHaveBeenCalled();
  });
});
