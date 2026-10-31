import { Q } from '@nozbe/watermelondb';
import { database, collections } from '../../db/database';
import { notifySyncDataChanged } from '../../services/sync/syncEvents';
import type { Collection, Model } from '@nozbe/watermelondb';
import { COMPLIANCE_COLLECTIONS } from '../../region';
import type { RegionIndex } from '../../core/region/contract';

// The region's maps are keyed by its own unions, which are `never` for a region
// with no report types; widen to the contract's string-keyed shape once.
const complianceCollectionNames: RegionIndex['COMPLIANCE_COLLECTIONS'] = COMPLIANCE_COLLECTIONS;
const allCollections = collections as unknown as Record<string, Collection<Model> | undefined>;

// Marks a local inspection report as pending_delete. The sync pipeline
// already treats inspection_reports as a soft-delete entity end-to-end
// (see syncSchema.ts's softDelete flag and watermelonAdapter.ts's
// getPendingRecords, which buckets pending_delete rows into the push
// payload's `deleted` array) — this is the only local mutation needed to
// trigger it. The row keeps existing locally with this syncState until a
// later pull reconciles it via applyPulledChanges' softDeleteMany; callers
// must filter out pending_delete/deletedAt rows from any list/detail query
// in the meantime (see useEstablishment.ts).
//
// A report that was never pushed (still 'pending_create') has no remote
// counterpart to soft-delete — marking it 'pending_delete' would just send
// its bare id in the push payload's `deleted` array (a no-op remote
// update), while its still-pending purpose_of_inspection and compliance_*
// rows kept trying to INSERT against a report_id that will never exist
// server-side, permanently failing every future push with a foreign key
// violation. For that case, hard-delete the report and everything it owns
// instead — there's nothing to reconcile with the server.
export async function deleteInspectionReportRecord(reportId: string): Promise<void> {
  const now = new Date().toISOString();
  await database.write(async () => {
    const reportRecord = await collections.inspectionReports.find(reportId);

    if (reportRecord.syncState === 'pending_create') {
      const complianceCollectionKey = complianceCollectionNames[reportRecord.reportType];
      const complianceCollection = complianceCollectionKey ? allCollections[complianceCollectionKey] : undefined;
      if (complianceCollection) {
        const complianceRows = await complianceCollection
          .query(Q.where('reportId', reportId))
          .fetch();
        await Promise.all(complianceRows.map(row => row.destroyPermanently()));
      }

      if (reportRecord.purposeId) {
        const purposeRows = await collections.purposeOfInspection
          .query(Q.where('purposeId', reportRecord.purposeId))
          .fetch();
        await Promise.all(purposeRows.map(row => row.destroyPermanently()));
      }

      await reportRecord.destroyPermanently();
    } else {
      await reportRecord.update(rec => {
        rec.syncState = 'pending_delete';
        rec.updatedAt = now;
      });
    }
  });

  // The deleting screen already refetches its own view, but a deleted
  // report also changes derived establishment data elsewhere — e.g. the
  // compliance-tag thumbnails on Manage Establishments — that no other
  // screen would otherwise know to refresh.
  notifySyncDataChanged();
}
