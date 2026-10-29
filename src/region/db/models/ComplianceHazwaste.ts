import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);

export class ComplianceHazwaste extends Model {
  static table = 'compliance_hazwaste';

  // ── Identifiers ─────────────────────────────────────────────────────────────
  @field('complianceId')               complianceId!: string;
  @field('reportId')                   reportId!: string;

  // ── Generator registration ───────────────────────────────────────────────────
  @field('hazwasteGeneratorId')        hazwasteGeneratorId!: string | null;
  @field('hazwasteIdDateIssued')       hazwasteIdDateIssued!: string | null;

  // ── Waste types ──────────────────────────────────────────────────────────────
  // Each item: { waste_generating_process, type_of_hazardous_waste, quantity, unit }
  @json('wasteTypesGenerated', asArray)        wasteTypesGenerated!: any[];

  // ── Checklists (DAO 2013-22) ─────────────────────────────────────────────────
  // Each item: { legal_ref, requirement, compliant: 'Y'|'N'|'NA', remarks }
  @json('checklistRegistration', asArray)      checklistRegistration!: any[];
  @json('checklistStorage', asArray)           checklistStorage!: any[];
  @json('checklistPackaging', asArray)         checklistPackaging!: any[];
  @json('checklistLabeling', asArray)          checklistLabeling!: any[];
  @json('checklistTransport', asArray)         checklistTransport!: any[];
  @json('checklistEmergency', asArray)         checklistEmergency!: any[];
  @json('checklistPersonnelTraining', asArray) checklistPersonnelTraining!: any[];
  @json('checklistManifestSystem', asArray)    checklistManifestSystem!: any[];

  // ── HWID conditions ──────────────────────────────────────────────────────────
  // Each item: { condition_no, description, compliant: 'Y'|'N'|'NA', remarks }
  @json('hwidConditions', asArray)             hwidConditions!: any[];

  // ── Narrative fields ─────────────────────────────────────────────────────────
  @field('otherObservations')                  otherObservations!: string | null;
  @field('remarksRecommendations')             remarksRecommendations!: string | null;
  @json('documentsReviewed', asArray)          documentsReviewed!: string[];

  // ↓ 'syncState' instead of 'syncStatus' — avoids collision with
  //   WatermelonDB's internal Model.syncStatus property
  @field('syncState')                          syncState!: string;
}
