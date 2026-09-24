import React from 'react';
import { BackHandler, Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import { registerPromptHandler, type PromptRequest } from '../../../services/prompt/promptService';

type Guard = ReturnType<typeof useUnsavedChangesGuard>;
let latest!: Guard;

const Probe: React.FC<{ state: unknown; onLeave: () => void; onSaveDraft: () => Promise<void> }> = ({
  state,
  onLeave,
  onSaveDraft,
}) => {
  latest = useUnsavedChangesGuard({ state, onLeave, onSaveDraft });
  return <Text>probe</Text>;
};

const render = (props: { state: unknown; onLeave: () => void; onSaveDraft: () => Promise<void> }) => {
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => { r = TestRenderer.create(<Probe {...props} />); });
  return { r, rerender: (next: typeof props) => TestRenderer.act(() => { r.update(<Probe {...next} />); }) };
};

// Stands in for PromptProvider: records what was asked and answers with
// whichever action the test names.
let prompts: PromptRequest[] = [];
let pending: { request: PromptRequest; resolve: (id: string | null) => void } | null = null;

const promptCount = () => prompts.length;

// Answers the open prompt as if the inspector tapped that button, then
// flushes the promise chain the guard attached to showPrompt.
const answerPromptWith = async (actionLabel: string) => {
  if (!pending) throw new Error('No prompt is open');
  const action = pending.request.actions?.find(a => a.label === actionLabel);
  if (!action) throw new Error(`No "${actionLabel}" action; got ${(pending.request.actions ?? []).map(a => a.label).join(', ')}`);
  const { resolve } = pending;
  pending = null;
  await TestRenderer.act(async () => { resolve(action.id); });
};

beforeEach(() => {
  jest.clearAllMocks();
  prompts = [];
  pending = null;
  registerPromptHandler((request, resolve) => {
    prompts.push(request);
    pending = { request, resolve };
  });
});

afterEach(() => registerPromptHandler(null));

describe('useUnsavedChangesGuard', () => {
  it('leaves immediately when nothing has been edited', () => {
    const onLeave = jest.fn();
    render({ state: { a: 1 }, onLeave, onSaveDraft: jest.fn() });
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(promptCount()).toBe(0);
  });

  it('asks before discarding once the form has been edited', () => {
    const onLeave = jest.fn();
    const props = { state: { a: 1 }, onLeave, onSaveDraft: jest.fn() };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).not.toHaveBeenCalled();
    expect(promptCount()).toBe(1);
  });

  it('leaves without saving when the inspector chooses to discard', async () => {
    const onLeave = jest.fn();
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const props = { state: { a: 1 }, onLeave, onSaveDraft };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    await answerPromptWith('Discard');
    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('saves the draft and then leaves', async () => {
    const onLeave = jest.fn();
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const props = { state: { a: 1 }, onLeave, onSaveDraft };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    await answerPromptWith('Save draft');
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('stays on the form when the save fails, rather than losing the edits', async () => {
    const onLeave = jest.fn();
    const onSaveDraft = jest.fn().mockRejectedValue(new Error('disk full'));
    const props = { state: { a: 1 }, onLeave, onSaveDraft };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    await answerPromptWith('Save draft');
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('treats the form as clean again after markSaved, so leaving is silent', () => {
    const onLeave = jest.fn();
    const props = { state: { a: 1 }, onLeave, onSaveDraft: jest.fn() };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.markSaved());
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(promptCount()).toBe(0);
  });

  it('prompts again for edits made after the draft was saved', () => {
    const onLeave = jest.fn();
    const props = { state: { a: 1 }, onLeave, onSaveDraft: jest.fn() };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.markSaved());
    rerender({ ...props, state: { a: 3 } });
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).not.toHaveBeenCalled();
    expect(promptCount()).toBe(1);
  });

  it('intercepts Android hardware back while dirty, and lets it through when clean', () => {
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');
    const onLeave = jest.fn();
    const props = { state: { a: 1 }, onLeave, onSaveDraft: jest.fn() };
    const { rerender } = render(props);

    const handler = addSpy.mock.calls.find(([event]) => event === 'hardwareBackPress')?.[1];
    if (!handler) throw new Error('hardwareBackPress was never subscribed');

    // Clean: the hook must not claim the event, so the navigator handles it.
    expect(handler()).toBe(false);
    expect(promptCount()).toBe(0);

    rerender({ ...props, state: { a: 2 } });
    expect(handler()).toBe(true);
    expect(promptCount()).toBe(1);
    addSpy.mockRestore();
  });
});

// useScreenFooter memoises the footer node on the deps it is given and
// setFooter re-renders this screen, so an unstable callback in those deps
// is an infinite loop - its own source comments record hitting exactly
// that. WaterFormShell passes onSaveDraft/onLeave as inline arrows, so the
// hook has to absorb their churn rather than pass it on.
describe('useUnsavedChangesGuard callback identity', () => {
  const props = () => ({
    state: { a: 1 },
    onLeave: () => {},
    onSaveDraft: async () => {},
  });

  it('keeps requestLeave stable when the caller passes fresh callbacks every render', () => {
    const { rerender } = render(props());
    const first = latest.requestLeave;
    rerender(props());
    rerender(props());
    expect(latest.requestLeave).toBe(first);
  });

  it('keeps markSaved stable too', () => {
    const { rerender } = render(props());
    const first = latest.markSaved;
    rerender(props());
    expect(latest.markSaved).toBe(first);
  });

  it('still calls the newest callbacks, not the ones captured on first render', async () => {
    const stale = jest.fn();
    const fresh = jest.fn();
    const base = { state: { a: 1 }, onSaveDraft: async () => {} };
    const { rerender } = render({ ...base, onLeave: stale });
    rerender({ ...base, state: { a: 2 }, onLeave: fresh });
    TestRenderer.act(() => latest.requestLeave());
    await answerPromptWith('Discard');
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });
});
