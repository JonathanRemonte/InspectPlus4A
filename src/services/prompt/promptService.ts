// The app's confirm/notice prompts, as an imperative call that returns what
// the inspector chose. This shape (rather than a <Modal visible> per screen)
// is what lets plain modules - syncConflictResolution, updateRequiredAlert,
// useAttachments - prompt at all, and keeps every call site a single
// statement, the way Alert.alert was before it.
//
// PromptProvider mounts the UI and registers the handler; see
// core/providers/PromptProvider.tsx.

export type PromptVariant = 'cancel' | 'default' | 'danger';

export interface PromptAction {
  // Returned by showPrompt when this action is chosen.
  id: string;
  label: string;
  variant?: PromptVariant;
}

export interface PromptRequest {
  title: string;
  message?: string;
  // Colours the header. 'danger' for anything that destroys or overwrites.
  tone?: 'info' | 'danger';
  // Omitted for a plain notice, which gets a single dismiss button.
  actions?: PromptAction[];
  // 'buttons' (default) puts the actions in a footer row - a confirm.
  // 'list' stacks them full-width as a menu of choices; see
  // components/RowActionsButton.tsx.
  layout?: 'buttons' | 'list';
}

type Resolve = (id: string | null) => void;
type PromptHandler = (request: PromptRequest, resolve: Resolve) => void;

let handler: PromptHandler | null = null;
const queue: { request: PromptRequest; resolve: Resolve }[] = [];
let showing = false;

function pump(): void {
  if (showing || queue.length === 0) return;
  const next = queue[0];
  if (!handler) return;
  showing = true;
  handler(next.request, id => {
    showing = false;
    queue.shift();
    next.resolve(id);
    pump();
  });
}

// Called by PromptProvider on mount, and with null on unmount. Unmounting
// settles anything outstanding with null: nothing can answer those prompts
// any more, and a caller awaiting a confirm must not hang. Same fail-closed
// answer showPrompt gives when no UI is mounted at all.
export function registerPromptHandler(next: PromptHandler | null): void {
  handler = next;
  if (handler) {
    pump();
    return;
  }
  showing = false;
  const outstanding = queue.splice(0, queue.length);
  for (const entry of outstanding) entry.resolve(null);
}

// Resolves with the chosen action's id, or null if the prompt was dismissed
// without choosing (backdrop, close button, hardware back).
export function showPrompt(request: PromptRequest): Promise<string | null> {
  if (!handler) {
    // Failing closed: a caller awaiting a confirm must not hang, and "no
    // choice" is the safe answer for every destructive prompt in the app.
    console.warn('[promptService] No prompt UI mounted; dismissing:', request.title);
    return Promise.resolve(null);
  }
  return new Promise<string | null>(resolve => {
    queue.push({ request, resolve });
    pump();
  });
}
