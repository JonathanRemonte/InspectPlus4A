import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';

interface UseUnsavedChangesGuardArgs<T> {
  // Everything that counts as "the inspector's work" on this screen. Compared
  // against a baseline captured on mount, so no dirty flag has to be threaded
  // through every setter and no work happens per keystroke - only when a back
  // is actually attempted.
  state: T;
  onSaveDraft: () => Promise<void>;
  onLeave: () => void;
}

// Deep-ish equality by serialisation. The form state is plain data built the
// same way on every render, so key order is stable.
const snapshot = (state: unknown): string => JSON.stringify(state);

// Guards a form against losing work to a back press. Every back path on the
// screen routes through requestLeave(); a clean form leaves silently, a dirty
// one asks first.
export function useUnsavedChangesGuard<T>({ state, onSaveDraft, onLeave }: UseUnsavedChangesGuardArgs<T>) {
  const baseline = useRef(snapshot(state));
  // Kept current so the BackHandler subscription (registered once) always
  // compares against the latest state rather than its closure's.
  const current = useRef(snapshot(state));
  current.current = snapshot(state);

  // Callers pass these as inline arrows, so they are new objects on every
  // render. Held in a ref rather than listed as dependencies: requestLeave
  // has to keep one identity for its whole life, because useScreenFooter
  // memoises the footer on the deps it is handed and setFooter re-renders
  // this screen - an unstable callback there loops forever (see
  // ScreenFooterContext). The ref is refreshed every render, so the
  // handlers that eventually run are always the current ones.
  const handlers = useRef({ onSaveDraft, onLeave });
  handlers.current = { onSaveDraft, onLeave };

  const isDirty = useCallback(() => current.current !== baseline.current, []);

  // Call after a successful save: what is on screen is now what is stored, so
  // leaving should stop prompting - until the next edit.
  const markSaved = useCallback(() => {
    baseline.current = current.current;
  }, []);

  const requestLeave = useCallback(() => {
    if (!isDirty()) {
      handlers.current.onLeave();
      return;
    }
    void showPrompt({
      title: 'Leave without saving?',
      message: 'This report has changes that have not been saved yet.',
      tone: 'danger',
      actions: [
        { id: 'stay', label: 'Keep editing', variant: 'cancel' },
        { id: 'discard', label: 'Discard', variant: 'danger' },
        { id: 'save', label: 'Save draft', variant: 'default' },
      ],
    }).then(async choice => {
      if (choice === 'discard') {
        handlers.current.onLeave();
        return;
      }
      if (choice !== 'save') return;
      try {
        await handlers.current.onSaveDraft();
        markSaved();
        handlers.current.onLeave();
      } catch {
        // The save path reports its own failure. Staying put is the
        // point: leaving now would discard exactly the work the
        // inspector just asked to keep.
      }
    });
  }, [isDirty, markSaved]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isDirty()) return false; // Let the navigator pop as usual.
      requestLeave();
      return true;
    });
    return () => subscription.remove();
  }, [isDirty, requestLeave]);

  return { requestLeave, markSaved };
}
