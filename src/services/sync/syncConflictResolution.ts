import { resolveConflictKeepLocal } from '../../db/sync/watermelonAdapter';
import { showPrompt } from '../prompt/promptService';
import { SyncEntityName } from './syncSchema';

// Shared tap handler for the "Sync conflict" badge (EstablishmentCard,
// EstablishmentHeaderCard, ReportListCard, InspectionReportHeader) — the
// resolution entry point for option 3 of the sync-conflict discussion: keep
// the local edit and force it to win the next push. Local-only by design —
// no fetch/diff against the other device's version, just re-queues what's
// already here with a fresh updatedAt (see resolveConflictKeepLocal).
export async function confirmResolveConflict(entity: SyncEntityName, id: string, label: string): Promise<void> {
  const choice = await showPrompt({
    title: 'Sync conflict',
    message: `${label} couldn't be saved because someone else's newer change already reached the server. Keep your local version and try syncing it again?`,
    actions: [
      { id: 'cancel', label: 'Cancel', variant: 'cancel' },
      { id: 'keep', label: 'Keep my version', variant: 'default' },
    ],
  });
  if (choice !== 'keep') return;
  try {
    await resolveConflictKeepLocal(entity, id);
  } catch (err) {
    console.error('[SyncConflict] Failed to resolve locally:', err);
    void showPrompt({
      title: 'Something went wrong',
      message: 'Could not queue this record for retry. Please try again.',
      tone: 'danger',
    });
  }
}
