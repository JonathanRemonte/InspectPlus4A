import { database, collections } from '../../db/database';
import type { PermitSnapshotItem } from '../../services/sync/syncTypes';

// Writes a report's own copy of the establishment's permits. A report keeps
// the permits it was filed with, so editing the establishment's list later
// never rewrites what a past inspection recorded - see the permits section
// on the establishment detail screen for the other side of that.
export async function patchPermitsSnapshot(reportId: string, permits: PermitSnapshotItem[]): Promise<void> {
  await database.write(async () => {
    const rec = await collections.inspectionReports.find(reportId);
    await rec.update(r => {
      r.permitsSnapshot = permits;
      r.updatedAt = new Date().toISOString();
      r.syncState = 'pending_update';
    });
  });
}
