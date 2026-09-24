import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { PromptProvider } from './PromptProvider';
import { showPrompt } from '../../services/prompt/promptService';

type Renderer = TestRenderer.ReactTestRenderer;

let mounted: Renderer | null = null;

const render = async () => {
  let r!: Renderer;
  await TestRenderer.act(async () => { r = TestRenderer.create(<PromptProvider><Text>app</Text></PromptProvider>); });
  mounted = r;
  return r;
};

// The prompt service holds its queue at module scope, so a prompt left
// unanswered by one test would queue ahead of the next test's.
afterEach(async () => {
  await TestRenderer.act(async () => { mounted?.unmount(); });
  mounted = null;
});

const button = (r: Renderer, label: string) => {
  const matches = r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === label);
  if (matches.length !== 1) throw new Error(`Expected 1 "${label}" button, found ${matches.length}`);
  return matches[0];
};

const texts = (r: Renderer) =>
  r.root.findAllByType(Text).map(n => n.props.children).filter(c => typeof c === 'string');

describe('PromptProvider', () => {
  it('shows no modal until something asks for one', async () => {
    const r = await render();
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
  });

  it('renders the title, message and each action', async () => {
    const r = await render();
    await TestRenderer.act(async () => {
      void showPrompt({
        title: 'Delete report?',
        message: 'This water report will be removed.',
        actions: [{ id: 'cancel', label: 'Cancel', variant: 'cancel' }, { id: 'delete', label: 'Delete', variant: 'danger' }],
      });
    });
    expect(r.root.findAllByType(Modal)[0].props.visible).toBe(true);
    expect(texts(r)).toEqual(expect.arrayContaining(['Delete report?', 'This water report will be removed.', 'Cancel', 'Delete']));
  });

  it('resolves with the chosen action and closes', async () => {
    const r = await render();
    let choice: string | null | undefined;
    await TestRenderer.act(async () => {
      void showPrompt({
        title: 'Delete report?',
        actions: [{ id: 'cancel', label: 'Cancel' }, { id: 'delete', label: 'Delete' }],
      }).then(c => { choice = c; });
    });
    await TestRenderer.act(async () => { button(r, 'Delete').props.onPress(); });
    expect(choice).toBe('delete');
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
  });

  it('gives a plain notice a single dismiss button', async () => {
    const r = await render();
    let choice: string | null | undefined;
    await TestRenderer.act(async () => {
      void showPrompt({ title: 'Draft saved' }).then(c => { choice = c; });
    });
    expect(texts(r)).toEqual(expect.arrayContaining(['Draft saved', 'OK']));
    await TestRenderer.act(async () => { button(r, 'OK').props.onPress(); });
    expect(choice).toBe('ok');
  });

  it('resolves null when dismissed with the close button', async () => {
    const r = await render();
    let choice: string | null | undefined;
    await TestRenderer.act(async () => {
      void showPrompt({
        title: 'Delete report?',
        actions: [{ id: 'cancel', label: 'Cancel' }, { id: 'delete', label: 'Delete' }],
      }).then(c => { choice = c; });
    });
    await TestRenderer.act(async () => { button(r, 'Close').props.onPress(); });
    expect(choice).toBeNull();
  });

  it('resolves null when Android hardware back dismisses it', async () => {
    const r = await render();
    let choice: string | null | undefined;
    await TestRenderer.act(async () => {
      void showPrompt({ title: 'Delete report?', actions: [{ id: 'delete', label: 'Delete' }] }).then(c => { choice = c; });
    });
    await TestRenderer.act(async () => { r.root.findAllByType(Modal)[0].props.onRequestClose(); });
    expect(choice).toBeNull();
  });

  it('shows a queued prompt once the first is answered', async () => {
    const r = await render();
    await TestRenderer.act(async () => {
      void showPrompt({ title: 'First', actions: [{ id: 'a', label: 'A' }] });
      void showPrompt({ title: 'Second', actions: [{ id: 'b', label: 'B' }] });
    });
    expect(texts(r)).toEqual(expect.arrayContaining(['First']));
    await TestRenderer.act(async () => { button(r, 'A').props.onPress(); });
    expect(texts(r)).toEqual(expect.arrayContaining(['Second']));
  });
});
