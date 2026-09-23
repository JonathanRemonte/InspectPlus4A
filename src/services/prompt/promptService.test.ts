import { registerPromptHandler, showPrompt, type PromptRequest } from './promptService';

type Resolve = (id: string | null) => void;

afterEach(() => registerPromptHandler(null));

describe('showPrompt', () => {
  it('hands the request to the mounted prompt UI', async () => {
    const seen: PromptRequest[] = [];
    registerPromptHandler((request, resolve) => {
      seen.push(request);
      resolve('ok');
    });
    await showPrompt({ title: 'Saved', message: 'Your draft is stored.' });
    expect(seen).toEqual([{ title: 'Saved', message: 'Your draft is stored.' }]);
  });

  it('resolves with the id of the action the inspector chose', async () => {
    registerPromptHandler((_request, resolve) => resolve('delete'));
    await expect(
      showPrompt({
        title: 'Delete report?',
        actions: [{ id: 'cancel', label: 'Cancel' }, { id: 'delete', label: 'Delete' }],
      }),
    ).resolves.toBe('delete');
  });

  it('resolves null when the prompt is dismissed without a choice', async () => {
    registerPromptHandler((_request, resolve) => resolve(null));
    await expect(showPrompt({ title: 'Anything' })).resolves.toBeNull();
  });

  // A confirm whose promise never settles would hang its caller forever, so
  // an unmounted UI has to fail closed rather than silently drop the request.
  it('resolves null and warns when no prompt UI is mounted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(showPrompt({ title: 'Nobody is listening' })).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // The UI going away must settle whatever it was holding, or an awaited
  // confirm hangs its caller forever.
  it('resolves everything outstanding with null when the prompt UI unmounts', async () => {
    registerPromptHandler(() => {});
    const shown = showPrompt({ title: 'On screen' });
    const queued = showPrompt({ title: 'Behind it' });
    registerPromptHandler(null);
    await expect(shown).resolves.toBeNull();
    await expect(queued).resolves.toBeNull();
  });

  it('shows one prompt at a time, queueing the next until the first is answered', async () => {
    const pending: { request: PromptRequest; resolve: Resolve }[] = [];
    registerPromptHandler((request, resolve) => pending.push({ request, resolve }));

    const first = showPrompt({ title: 'First' });
    const second = showPrompt({ title: 'Second' });

    expect(pending.map(p => p.request.title)).toEqual(['First']);

    pending[0].resolve('a');
    await expect(first).resolves.toBe('a');

    expect(pending.map(p => p.request.title)).toEqual(['First', 'Second']);
    pending[1].resolve('b');
    await expect(second).resolves.toBe('b');
  });
});
