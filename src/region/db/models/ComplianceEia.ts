import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);

export class ComplianceEia extends Model {
  static table = 'compliance_eia';

  // ── Identifiers ─────────────────────────────────────────────────────────────
  @field('complianceId')         complianceId!: string;
  @field('reportId')             reportId!: string;

  // ── Checklists (Revised DAO 2003-30) ─────────────────────────────────────────
  // Each item: { legal_ref (Chapter 2-3 section), requirement,
  //              compliant: 'Y'|'N'|'NA', remarks }
  @json('checklistDao200330', asArray) checklistDao200330!: any[];

  // ── ECC/EMP conditions ───────────────────────────────────────────────────────
  // Each item: { condition_no, requirement, relevant_ecc_no, ecc_description,
  //              compliant: 'Y'|'N'|'NA', proof_of_compliance }
  // Covers items 1-17 per revised DAO 2003-30
  @json('eccEmpConditions', asArray)   eccEmpConditions!: any[];

  // ── Narrative fields ─────────────────────────────────────────────────────────
  @field('otherObservations')          otherObservations!: string | null;
  @field('remarksRecommendations')     remarksRecommendations!: string | null;

  // Documents: 'Synology' | 'OPMS' | 'IIS Transactions' | 'CMR Online' |
  //            'SMR Online' | 'PCO Online' | 'Others'
  @json('documentsReviewed', asArray)  documentsReviewed!: string[];

  // ↓ 'syncState' instead of 'syncStatus' — avoids collision with
  //   WatermelonDB's internal Model.syncStatus property
  @field('syncState')                  syncState!: string;
}
