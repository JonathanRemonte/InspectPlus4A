import React from 'react';
import { Alert, BackHandler, Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

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

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
// The button the modal's caller would tap, by its label.
const tapAlertButton = async (label: string) => {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const button = (buttons ?? []).find(b => b.text === label);
  if (!button) throw new Error(`No "${label}" button; got ${(buttons ?? []).map(b => b.text).join(', ')}`);
  await TestRenderer.act(async () => { await button.onPress?.(); });
};

beforeEach(() => jest.clearAllMocks());

describe('useUnsavedChangesGuard', () => {
  it('leaves immediately when nothing has been edited', () => {
    const onLeave = jest.fn();
    render({ state: { a: 1 }, onLeave, onSaveDraft: jest.fn() });
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('asks before discarding once the form has been edited', () => {
    const onLeave = jest.fn();
    const props = { state: { a: 1 }, onLeave, onSaveDraft: jest.fn() };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    expect(onLeave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves without saving when the inspector chooses to discard', async () => {
    const onLeave = jest.fn();
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const props = { state: { a: 1 }, onLeave, onSaveDraft };
    const { rerender } = render(props);
    rerender({ ...props, state: { a: 2 } });
    TestRenderer.act(() => latest.requestLeave());
    await tapAlertButton('Discard');
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
    await tapAlertButton('Save draft');
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
    await tapAlertButton('Save draft');
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
    expect(alertSpy).not.toHaveBeenCalled();
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
    expect(alertSpy).toHaveBeenCalledTimes(1);
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
    expect(alertSpy).not.toHaveBeenCalled();

    rerender({ ...props, state: { a: 2 } });
    expect(handler()).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });
});
