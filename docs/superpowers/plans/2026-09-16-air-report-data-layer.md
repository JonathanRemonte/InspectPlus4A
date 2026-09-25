# Air Report Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Air Quality inspection report storable, syncable and readable against the printed EMB form — two new checklist columns on both sides of sync, and the domain files (checklist questions, form state, save/load boundary) a form screen will later plug into.

**Architecture:** `compliance_air` already exists end to end; this adds `checklist_appendix_f` and `checklist_consent_agreement` (Supabase migration + `push_changes` re-issue, WatermelonDB v16, model, sync map), extracts water's keyed-checklist save/load helpers into a shared list-parameterised module, and adds `src/features/inspections/air/{airChecklistData,airTypes}.ts` mirroring the water files. No UI.

**Tech Stack:** TypeScript, WatermelonDB 0.28 (`@nozbe/watermelondb`), Supabase Postgres (plpgsql RPCs, pgTAP tests), Jest.

**Spec:** `docs/superpowers/specs/2026-09-16-air-report-data-layer-design.md`

## Global Constraints

- Sync changes are additive only (`docs/sync-contract.md` → Backward Compatibility Rules): new columns nullable, `pull_changes` untouched, `min_supported_app_version` not raised.
- WatermelonDB: every new column is `isOptional: true`; `schema.version` and `migrations.maxVersion` move together (15 → 16) — `src/db/migrations.test.ts` enforces this.
- Local column names are camelCase; Supabase columns snake_case; `syncSchema.ts` maps between them.
- Stored checklist entries are keyed and self-describing: `{ key, legal_ref, requirement, compliant, remarks }`, with `legal_ref` = `` `${group} ${ref}` `` (or `group` when `ref` is empty). Matched by key on read, never by position.
- Checklist wording is the template's, whitespace-normalised; only the evident "Part Rule 25" → "Part 7 Rule 25" typos are corrected.
- `ENABLED_TYPES` in `src/constants/reportTypes.ts` is not touched.
- Commit messages follow the repo's conventional-commit style (`feat(air): …`, `chore(db): …`) and end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The pre-commit hook runs the full Jest suite (~100 s); that is expected.
- Work happens in the worktree `D:\Projects\InspectPlus\.claude\worktrees\air-report-data-layer` on branch `feat/air-report-data-layer`.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql` | Create: two columns + `push_changes` re-issue | 1 |
| `supabase/tests/rpc/push_changes_compliance_air.sql` | Modify: prove the new columns round-trip through push | 1 |
| `src/db/schema.ts` | Modify: v16, two `compliance_air` columns | 2 |
| `src/db/migrations.ts` | Modify: `toVersion: 16` step | 2 |
| `src/db/migrations.test.ts` | Modify: hard-coded 16/15 regex → 17/16 | 2 |
| `src/db/models/ComplianceAir.ts` | Modify: two `@json` fields, entry-shape comments | 2 |
| `src/services/sync/syncSchema.ts` | Modify: two field-map entries | 2 |
| `src/features/inspections/checklistEntries.ts` | Create: list-parameterised keyed save/load | 3 |
| `src/features/inspections/checklistEntries.test.ts` | Create | 3 |
| `src/features/inspections/water/waterTypes.ts` | Modify: delegate to `checklistEntries.ts`, keep exports | 3 |
| `src/features/inspections/air/airChecklistData.ts` | Create: five question lists + options | 4 |
| `src/features/inspections/air/airChecklistData.test.ts` | Create | 4 |
| `src/features/inspections/air/airTypes.ts` | Create: form state, save/load boundary | 5 |
| `src/features/inspections/air/airTypes.test.ts` | Create | 5 |
| `src/features/inspections/hooks/useInspectionReport.ts` | Modify: add `airChecklistGroupsFrom` beside the view types | 6 |
| `src/features/inspections/hooks/loadInspectionReportDetail.ts` | Modify: call it from the `air_monitoring` branch | 6 |
| `src/features/inspections/hooks/airComplianceView.test.ts` | Create | 6 |

---

### Task 1: Supabase migration — two checklist columns and the `push_changes` re-issue

**Files:**
- Create: `supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql`
- Modify: `supabase/tests/rpc/push_changes_compliance_air.sql`

**Interfaces:**
- Produces: columns `public.compliance_air.checklist_appendix_f jsonb` and `public.compliance_air.checklist_consent_agreement jsonb`; `push_changes` accepts `checklist_appendix_f` / `checklist_consent_agreement` keys on `compliance_air.created[]` and `compliance_air.updated[]` records.

Background: Postgres cannot alter part of a function body, so every migration that touches `push_changes` re-issues the whole function. The last one to do so is `supabase/migrations/20260915130000_add_sampling_conducted_to_compliance_water.sql` (1115 lines). This task copies it and edits only the header, the `alter table`, and the two `compliance_air` blocks. `pull_changes` emits `to_jsonb(ca)` for whole rows (see `supabase/migrations/20260813011000_add_attachments_to_pull_changes.sql:68-77`) so it needs no change.

- [ ] **Step 1: Extend the pgTAP test so it fails against the current RPC**

Edit `supabase/tests/rpc/push_changes_compliance_air.sql`:

Change `select plan(6);` to `select plan(8);`.

In the **create** payload, replace the created record with:

```json
          {
            "compliance_id": "air-push-001",
            "report_id": "rep-air-001",
            "other_observations": "Air observation",
            "remarks_recommendations": "Air recommendation",
            "checklist_appendix_f": [
              {"key": "appendix-f-s6-8-cems-installation-change-notified", "legal_ref": "Appendix F (Quality Assurance Procedures) Section 6 (8)", "requirement": "Notification has been sent to EMB for any changes made in the CEMS installation", "compliant": "Y", "remarks": ""}
            ],
            "checklist_consent_agreement": [
              {"key": "consent-dao2000-81-p7-r25-s9a-ems-18-months", "legal_ref": "For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (a)", "requirement": "EMS established within 18 months upon entering Consent Agreement with EMB", "compliant": "NA", "remarks": ""}
            ]
          }
```

Directly after the existing `'push_changes inserts one compliance_air row'` assertion, add:

```sql
select is(
  (
    select checklist_appendix_f->0->>'compliant'
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  'Y',
  'push_changes stores checklist_appendix_f on create'
);
```

In the **update** payload, replace the updated record with:

```json
          {
            "compliance_id": "air-push-001",
            "report_id": "rep-air-001",
            "other_observations": "Updated air observation",
            "remarks_recommendations": "Updated air recommendation",
            "checklist_appendix_f": [],
            "checklist_consent_agreement": [
              {"key": "consent-dao2000-81-p7-r25-s9a-ems-18-months", "legal_ref": "For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (a)", "requirement": "EMS established within 18 months upon entering Consent Agreement with EMB", "compliant": "N", "remarks": "No EMS yet"}
            ]
          }
```

Directly after the existing `'push_changes updates an existing compliance_air row'` assertion, add:

```sql
select is(
  (
    select checklist_consent_agreement->0->>'remarks'
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  'No EMS yet',
  'push_changes updates checklist_consent_agreement on upsert'
);
```

- [ ] **Step 2: Run the RPC test to see it fail (if a local Supabase stack is available)**

CI runs `supabase test db` on every push (`docs/ci-cd.md`). Locally this needs Docker Desktop running and the Supabase CLI via npx:

```bash
npx supabase start && npx supabase db reset && npx supabase test db
```

Expected before the migration: `push_changes_compliance_air.sql` fails — the two new assertions return NULL (columns do not exist, and `push_changes` ignores unknown keys, so the rows insert without them).

If Docker is not available, skip this step and rely on the structural checks in Step 5 and on CI. Say so in the task report.

- [ ] **Step 3: Create the migration from the last `push_changes` re-issue**

```bash
cp supabase/migrations/20260915130000_add_sampling_conducted_to_compliance_water.sql supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql
```

Then edit the new file. Replace everything from the first line through the end of the existing `alter table public.compliance_water … ;` statement (the lines before `create or replace function public.push_changes`) with:

```sql
begin;

-- ─────────────────────────────────────────────────────────────────────────
-- compliance_air gains two checklist columns. The printed Air Monitoring
-- form's compliance checklist (Table 7) has five groups; the table was
-- created with columns for three of them. The two it lacked:
--
--   checklist_appendix_f          "Appendix F (Quality Assurance
--                                 Procedures)" — the thirteen CEMS
--                                 questions citing 40 CFR 60 Appendix F
--                                 Sections 6–8 (template rows 45–57)
--   checklist_consent_agreement   "For Facilities Engaged with Consent
--                                 Agreement" — DAO 2000-81 Part 7 Rule 25
--                                 Section 9 (a)/(b) (template rows 59–60)
--
-- Both hold the same keyed entry shape as the other checklist_* columns:
--   [{ key, legal_ref, requirement, compliant: 'Y'|'N'|'NA', remarks }]
-- See src/features/inspections/air/airChecklistData.ts for the questions.
--
-- Additive per docs/sync-contract.md's Backward Compatibility Rules: both
-- columns are nullable, and a client that has not yet shipped the fields
-- simply omits them from its push payload, leaving NULL.
--
-- pull_changes needs no change: it emits to_jsonb(ca) for whole
-- compliance_air rows, so the new columns reach the client as soon as
-- they exist.
--
-- Full body re-issued, based on
-- 20260915130000_add_sampling_conducted_to_compliance_water.sql (the last
-- migration to redefine push_changes) — because Postgres has no way to
-- alter one column of a function body, the whole thing must be redefined;
-- the only changes are the compliance_air insert column lists, their
-- values, and the update loop's on-conflict set.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.compliance_air
  add column if not exists checklist_appendix_f jsonb,
  add column if not exists checklist_consent_agreement jsonb;

```

Now edit the **created compliance_air** block. Find:

```sql
      insert into public.compliance_air (
        compliance_id, report_id, emission_sources, checklist_dao_2004_26,
        checklist_dao_2000_81, checklist_emb_mc, pto_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_air_record->>'compliance_id',
        compliance_air_record->>'report_id',
        coalesce(compliance_air_record->'emission_sources', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2004_26', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2000_81', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_emb_mc', '[]'::jsonb),
        coalesce(compliance_air_record->'pto_conditions', '[]'::jsonb),
        compliance_air_record->>'other_observations',
        compliance_air_record->>'remarks_recommendations',
        coalesce(compliance_air_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
```

and replace with:

```sql
      insert into public.compliance_air (
        compliance_id, report_id, emission_sources, checklist_dao_2004_26,
        checklist_dao_2000_81, checklist_emb_mc, checklist_appendix_f,
        checklist_consent_agreement, pto_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_air_record->>'compliance_id',
        compliance_air_record->>'report_id',
        coalesce(compliance_air_record->'emission_sources', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2004_26', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2000_81', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_emb_mc', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_appendix_f', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_consent_agreement', '[]'::jsonb),
        coalesce(compliance_air_record->'pto_conditions', '[]'::jsonb),
        compliance_air_record->>'other_observations',
        compliance_air_record->>'remarks_recommendations',
        coalesce(compliance_air_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
```

Then the **updated compliance_air** block. Find the second occurrence of the same `insert into public.compliance_air (…) values (…)` (the one followed by `on conflict (compliance_id) do update set`) and apply the identical column-list and values edit. Then find:

```sql
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        emission_sources = excluded.emission_sources,
        checklist_dao_2004_26 = excluded.checklist_dao_2004_26,
        checklist_dao_2000_81 = excluded.checklist_dao_2000_81,
        checklist_emb_mc = excluded.checklist_emb_mc,
        pto_conditions = excluded.pto_conditions,
```

and replace with:

```sql
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        emission_sources = excluded.emission_sources,
        checklist_dao_2004_26 = excluded.checklist_dao_2004_26,
        checklist_dao_2000_81 = excluded.checklist_dao_2000_81,
        checklist_emb_mc = excluded.checklist_emb_mc,
        checklist_appendix_f = excluded.checklist_appendix_f,
        checklist_consent_agreement = excluded.checklist_consent_agreement,
        pto_conditions = excluded.pto_conditions,
```

Leave every other line of the function exactly as copied.

- [ ] **Step 4: Run the RPC test to see it pass (if a local stack is available)**

```bash
npx supabase db reset && npx supabase test db
```

Expected: all RPC and RLS test files pass, `push_changes_compliance_air.sql` reporting 8/8.

- [ ] **Step 5: Structural check — the diff against the previous re-issue touches only the intended blocks**

```bash
diff supabase/migrations/20260915130000_add_sampling_conducted_to_compliance_water.sql supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql
```

Expected: hunks only in (a) the header comment and `alter table`, (b) the two `compliance_air` insert column lists and values, (c) the `on conflict … do update set` list. No hunk should mention `compliance_water`, `compliance_hazwaste`, `compliance_eia`, `attachments`, `survey`, `establishments` or `purpose_of_inspection`. Also confirm both new column names appear the expected number of times:

```bash
grep -c "checklist_appendix_f" supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql
grep -c "checklist_consent_agreement" supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql
```

Expected: 7 and 7 (header ×1, `alter table` ×1, created insert column list ×1 + value ×1, updated insert column list ×1 + value ×1, on-conflict set ×1; `excluded.` on the same line counts once).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql supabase/tests/rpc/push_changes_compliance_air.sql
git commit -m "$(cat <<'EOF'
feat(air): add the Appendix F and Consent Agreement checklist columns

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: WatermelonDB v16 — schema, migration, model, sync map

**Files:**
- Modify: `src/db/schema.ts:28` (version) and `:177-192` (compliance_air table)
- Modify: `src/db/migrations.ts:198-209` (append a v16 step)
- Modify: `src/db/migrations.test.ts:40` (hard-coded version regex)
- Modify: `src/db/models/ComplianceAir.ts`
- Modify: `src/services/sync/syncSchema.ts:179-200`

**Interfaces:**
- Produces: `ComplianceAir.checklistAppendixF: any[]` and `ComplianceAir.checklistConsentAgreement: any[]` (JSON-backed), synced as `checklist_appendix_f` / `checklist_consent_agreement`.

- [ ] **Step 1: Update the one hard-coded version assertion so the suite fails until the bump lands**

In `src/db/migrations.test.ts`, change:

```ts
      /schema version 16 .* migrations only reach 15/,
```

to:

```ts
      /schema version 17 .* migrations only reach 16/,
```

- [ ] **Step 2: Run the migrations test to see it fail**

```bash
npx jest src/db/migrations.test.ts
```

Expected: FAIL — `is what database.ts checks…` throws with "schema version 16 … migrations only reach 15", not matching the new regex.

- [ ] **Step 3: Bump the schema and add the columns**

In `src/db/schema.ts`, change `version: 15,` to `version: 16,`.

In the `compliance_air` table, replace:

```ts
        { name: 'checklistEmbMc',         type: 'string', isOptional: true },
        { name: 'ptoConditions',          type: 'string', isOptional: true },
```

with:

```ts
        { name: 'checklistEmbMc',         type: 'string', isOptional: true },
        // Table 7's fourth and fifth groups - the CEMS quality-assurance
        // questions and the two Consent Agreement ones. Added after the
        // table; NULL on rows written before, read as [] by the model.
        { name: 'checklistAppendixF',     type: 'string', isOptional: true },
        { name: 'checklistConsentAgreement', type: 'string', isOptional: true },
        { name: 'ptoConditions',          type: 'string', isOptional: true },
```

- [ ] **Step 4: Add the migration step**

In `src/db/migrations.ts`, after the `toVersion: 15` block's closing `},` and before the closing `],` of `migrations`, add:

```ts
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'compliance_air',
          columns: [
            { name: 'checklistAppendixF', type: 'string', isOptional: true },
            { name: 'checklistConsentAgreement', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
```

- [ ] **Step 5: Run the migrations test to see it pass**

```bash
npx jest src/db/migrations.test.ts
```

Expected: PASS, including "every column a migration adds exists in the schema with the same type".

- [ ] **Step 6: Extend the model and rewrite its shape comments**

Replace the whole of `src/db/models/ComplianceAir.ts` with:

```ts
import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);

export class ComplianceAir extends Model {
  static table = 'compliance_air';

  // ── Identifiers ─────────────────────────────────────────────────────────────
  @field('complianceId')         complianceId!: string;
  @field('reportId')             reportId!: string;

  // ── Emission sources (Table 6) ───────────────────────────────────────────────
  // Each item: { source_no, type, rated_capacity, fuel_type,
  //              fuel_quantity, operating_capacity, control_facility, notes }
  @json('emissionSources', asArray)    emissionSources!: any[];

  // ── Checklists (Table 7) ─────────────────────────────────────────────────────
  // One column per printed group, in template order. Each item is keyed and
  // self-describing - { key, legal_ref, requirement, compliant: 'Y'|'N'|'NA',
  // remarks } - so a stored report reads on its own and answers are matched
  // by key, never by position. Questions and keys live in
  // src/features/inspections/air/airChecklistData.ts; the save/load boundary
  // is airChecklistsForSave / airChecklistsFromRecord in airTypes.ts.
  @json('checklistDao200426', asArray) checklistDao200426!: any[];
  @json('checklistDao200081', asArray) checklistDao200081!: any[];
  @json('checklistEmbMc', asArray)     checklistEmbMc!: any[];
  // The DAO 2004-26 "Quarterly submission of self-monitoring report" entry
  // additionally carries quarters: ('Q1'|'Q2'|'Q3'|'Q4')[] - the four tick
  // boxes the form prints beside it. Kept whatever the Y/N/NA answer: ticks
  // plus an N is a coherent record of partial submission.
  @json('checklistAppendixF', asArray) checklistAppendixF!: any[];
  @json('checklistConsentAgreement', asArray) checklistConsentAgreement!: any[];

  // ── Permit to Operate conditions (Table 8) ───────────────────────────────────
  // Each item: { condition_no, description, compliant: 'Y'|'N'|'NA', remarks }
  @json('ptoConditions', asArray)      ptoConditions!: any[];

  // ── Narrative fields (Table 9) ───────────────────────────────────────────────
  @field('otherObservations')          otherObservations!: string | null;
  @field('remarksRecommendations')     remarksRecommendations!: string | null;

  // ── Documents reviewed (Table 9) ─────────────────────────────────────────────
  // Values from AIR_DOCUMENTS_REVIEWED_OPTIONS: 'Record File Folder' |
  // 'Synology' | 'OPMS' | 'IIS Transactions' | 'CMR Online' | 'SMR Online' |
  // 'PCO Online' | 'Others'
  @json('documentsReviewed', asArray)  documentsReviewed!: string[];

  // ↓ 'syncState' instead of 'syncStatus' — avoids collision with
  //   WatermelonDB's internal Model.syncStatus property
  @field('syncState')                  syncState!: string;
}
```

- [ ] **Step 7: Add the sync field mappings**

In `src/services/sync/syncSchema.ts`, inside `compliance_air.fields`, replace:

```ts
      checklist_emb_mc:        'checklistEmbMc',
      pto_conditions:          'ptoConditions',
```

with:

```ts
      checklist_emb_mc:        'checklistEmbMc',
      checklist_appendix_f:    'checklistAppendixF',
      checklist_consent_agreement: 'checklistConsentAgreement',
      pto_conditions:          'ptoConditions',
```

- [ ] **Step 8: Typecheck and run the db + sync tests**

```bash
npm run typecheck
npx jest src/db src/services/sync
```

Expected: typecheck clean; all suites pass.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts src/db/migrations.ts src/db/migrations.test.ts src/db/models/ComplianceAir.ts src/services/sync/syncSchema.ts
git commit -m "$(cat <<'EOF'
feat(air): store and sync the two new checklist columns locally

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Shared keyed-checklist save/load (`checklistEntries.ts`), water delegating

**Files:**
- Create: `src/features/inspections/checklistEntries.ts`
- Create: `src/features/inspections/checklistEntries.test.ts`
- Modify: `src/features/inspections/water/waterTypes.ts` (the `// ── Summary of Findings` block, currently the `FindingsEntry` … `findingsValuesFromEntries` definitions)

**Interfaces:**
- Consumes: `ChecklistItemDef`, `ChecklistValue`, `YnValue` from `src/components/form`.
- Produces:
  ```ts
  export interface FindingsEntry { key: string; legal_ref: string; requirement: string; compliant: YnValue; remarks: string; }
  export type StoredFindingsEntry = Partial<FindingsEntry> | Record<string, unknown>;
  export function checklistEntriesForSave(defs: readonly ChecklistItemDef[], values: readonly ChecklistValue[]): FindingsEntry[];
  export function checklistValuesFromEntries(defs: readonly ChecklistItemDef[], entries: readonly StoredFindingsEntry[]): ChecklistValue[];
  export function legalRefFor(def: ChecklistItemDef): string;
  ```
  `waterTypes.ts` keeps exporting `FindingsEntry`, `StoredFindingsEntry`, `findingsEntriesForSave(values)` and `findingsValuesFromEntries(entries)` with unchanged signatures.

- [ ] **Step 1: Write the failing test**

Create `src/features/inspections/checklistEntries.test.ts`:

```ts
import type { ChecklistItemDef, ChecklistValue } from '../../components/form';
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  legalRefFor,
} from './checklistEntries';

// A stored checklist answer is matched to its question by key, never by
// position, and every entry carries its citation and wording as they
// stood when it was answered. These are the rules water's Summary of
// Findings settled on; air reuses them against five lists.

const DEFS: ChecklistItemDef[] = [
  { key: 'a', group: 'DAO 1', ref: 'Rule 1', requirement: 'First?' },
  { key: 'b', group: 'DAO 1', ref: 'Rule 2', requirement: 'Second?' },
  { key: 'c', group: 'Other', ref: '', requirement: 'Third?' },
];

const VALUES: ChecklistValue[] = [
  { compliant: 'Y', remarks: '' },
  { compliant: 'N', remarks: 'late' },
  { compliant: 'NA', remarks: '' },
];

describe('legalRefFor', () => {
  it('joins group and ref, or falls back to the group alone', () => {
    expect(legalRefFor(DEFS[0])).toBe('DAO 1 Rule 1');
    expect(legalRefFor(DEFS[2])).toBe('Other');
    expect(legalRefFor({ key: 'x', ref: 'Sec 9', requirement: 'q' })).toBe('Sec 9');
  });
});

describe('checklistEntriesForSave', () => {
  it('writes one self-describing entry per question, in list order', () => {
    expect(checklistEntriesForSave(DEFS, VALUES)).toEqual([
      { key: 'a', legal_ref: 'DAO 1 Rule 1', requirement: 'First?', compliant: 'Y', remarks: '' },
      { key: 'b', legal_ref: 'DAO 1 Rule 2', requirement: 'Second?', compliant: 'N', remarks: 'late' },
      { key: 'c', legal_ref: 'Other', requirement: 'Third?', compliant: 'NA', remarks: '' },
    ]);
  });

  it('treats a missing value as unanswered rather than throwing', () => {
    expect(checklistEntriesForSave(DEFS, [VALUES[0]])[2]).toEqual({
      key: 'c', legal_ref: 'Other', requirement: 'Third?', compliant: null, remarks: '',
    });
  });
});

describe('checklistValuesFromEntries', () => {
  it('round-trips what was saved', () => {
    expect(checklistValuesFromEntries(DEFS, checklistEntriesForSave(DEFS, VALUES))).toEqual(VALUES);
  });

  it('matches by key, so a reordered record still lands on the right questions', () => {
    const entries = checklistEntriesForSave(DEFS, VALUES);
    const shuffled = [entries[2], entries[0], entries[1]];
    expect(checklistValuesFromEntries(DEFS, shuffled)).toEqual(VALUES);
  });

  it('drops entries the list no longer knows and blanks questions it has no entry for', () => {
    const legacy = [
      { legal_ref: 'Section 1', requirement: 'Retired placeholder', compliant: 'Y', remarks: 'x' },
      { key: 'b', compliant: 'N', remarks: 'kept' },
    ];
    expect(checklistValuesFromEntries(DEFS, legacy)).toEqual([
      { compliant: null, remarks: '' },
      { compliant: 'N', remarks: 'kept' },
      { compliant: null, remarks: '' },
    ]);
  });

  it('tolerates a non-string remarks value from an older build', () => {
    expect(checklistValuesFromEntries(DEFS, [{ key: 'a', compliant: 'Y', remarks: null }])[0]).toEqual({
      compliant: 'Y', remarks: '',
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx jest src/features/inspections/checklistEntries.test.ts
```

Expected: FAIL — `Cannot find module './checklistEntries'`.

- [ ] **Step 3: Create the module**

Create `src/features/inspections/checklistEntries.ts`:

```ts
import type { ChecklistItemDef, ChecklistValue, YnValue } from '../../components/form';

// The stored form of a compliance-checklist answer, shared by every
// checklist_* column on the compliance tables. The form holds one
// {compliant, remarks} per question, in list order; the record holds the
// same answers keyed and self-describing - each entry carries the
// question's key, citation and wording as they stood when it was answered
// - so a stored report reads on its own and survives the list being
// reordered or revised.
export interface FindingsEntry {
  key: string;
  legal_ref: string;
  requirement: string;
  compliant: YnValue;
  remarks: string;
}

// An entry as it comes back off a record: our own FindingsEntry, the
// detail hook's looser ChecklistEntry, or whatever an older build wrote.
export type StoredFindingsEntry = Partial<FindingsEntry> | Record<string, unknown>;

// "DAO 2004-26 Rule 19 Section 1", or just the group when the question has
// no citation of its own, or just the ref when it has no group.
export function legalRefFor(def: ChecklistItemDef): string {
  return [def.group, def.ref].filter(Boolean).join(' ');
}

export function checklistEntriesForSave(
  defs: readonly ChecklistItemDef[],
  values: readonly ChecklistValue[],
): FindingsEntry[] {
  return defs.map((def, i) => ({
    key: def.key,
    legal_ref: legalRefFor(def),
    requirement: def.requirement,
    compliant: values[i]?.compliant ?? null,
    remarks: values[i]?.remarks ?? '',
  }));
}

// Answers are matched by key, never by position. Entries the list doesn't
// know are dropped, so an old report opens blank there rather than with
// answers under the wrong questions.
export function checklistValuesFromEntries(
  defs: readonly ChecklistItemDef[],
  entries: readonly StoredFindingsEntry[],
): ChecklistValue[] {
  const byKey = new Map<string, StoredFindingsEntry>();
  for (const e of entries) if (typeof e.key === 'string') byKey.set(e.key, e);
  return defs.map(def => {
    const e = byKey.get(def.key);
    return {
      compliant: (e?.compliant as YnValue) ?? null,
      remarks: typeof e?.remarks === 'string' ? e.remarks : '',
    };
  });
}
```

- [ ] **Step 4: Run it to see it pass**

```bash
npx jest src/features/inspections/checklistEntries.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Make water delegate**

In `src/features/inspections/water/waterTypes.ts`, add to the imports at the top of the file:

```ts
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  type FindingsEntry,
  type StoredFindingsEntry,
} from '../checklistEntries';
```

Then replace the whole `// ── Summary of Findings` block — from that heading comment through the closing `}` of `findingsValuesFromEntries` — with:

```ts
// ── Summary of Findings ──────────────────────────────────────────────────────
// The keyed, self-describing entry shape and the key-matching read live in
// ../checklistEntries.ts, shared with the air report. These are that
// mechanism bound to this form's list. (Still under the
// checklist_dao_2005_10 column; renaming it isn't worth a push_changes
// re-issue.)

export type { FindingsEntry, StoredFindingsEntry };

export function findingsEntriesForSave(values: ChecklistValue[]): FindingsEntry[] {
  return checklistEntriesForSave(WATER_FINDINGS_CHECKLIST, values);
}

// Answers are matched by key, never by position. Entries the current list
// doesn't know - the retired "Section N" placeholders - are dropped, so an
// old report opens blank here rather than with answers under the wrong
// questions.
export function findingsValuesFromEntries(entries: readonly StoredFindingsEntry[]): ChecklistValue[] {
  return checklistValuesFromEntries(WATER_FINDINGS_CHECKLIST, entries);
}
```

If `YnValue` is now unused in `waterTypes.ts`'s import line, leave it — it is still used by `SamplingParameterRow` and `DpConditionRow`. Run lint to be sure.

- [ ] **Step 6: Prove water is unchanged**

```bash
npm run typecheck
npm run lint
npx jest src/features/inspections/water src/features/inspections/checklistEntries.test.ts
```

Expected: typecheck and lint clean; every water suite passes unchanged, notably `summaryOfFindings.test.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/features/inspections/checklistEntries.ts src/features/inspections/checklistEntries.test.ts src/features/inspections/water/waterTypes.ts
git commit -m "$(cat <<'EOF'
refactor(reports): share the keyed checklist save and load between report types

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `airChecklistData.ts` — the five question lists

**Files:**
- Create: `src/features/inspections/air/airChecklistData.ts`
- Create: `src/features/inspections/air/airChecklistData.test.ts`

**Interfaces:**
- Consumes: `ChecklistItemDef` from `src/components/form`; `DOCUMENTS_REVIEWED_OPTIONS` from `../water/waterChecklistData`.
- Produces:
  ```ts
  export const AIR_CHECKLIST_DAO_2004_26: ChecklistItemDef[];        // 11
  export const AIR_CHECKLIST_DAO_2000_81: ChecklistItemDef[];        // 12
  export const AIR_CHECKLIST_EMB_MC: ChecklistItemDef[];             // 14
  export const AIR_CHECKLIST_APPENDIX_F: ChecklistItemDef[];         // 13
  export const AIR_CHECKLIST_CONSENT_AGREEMENT: ChecklistItemDef[];  //  2
  export const AIR_CHECKLIST_GROUPS: readonly { title: string; items: ChecklistItemDef[] }[]; // the five, template order
  export const SMR_QUARTER_KEY = 'dao2004-26-r19-s12-quarterly-smr';
  export const SMR_QUARTERS: readonly ['Q1', 'Q2', 'Q3', 'Q4'];
  export type SmrQuarter = (typeof SMR_QUARTERS)[number];
  export const AIR_DOCUMENTS_REVIEWED_OPTIONS: string[];
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/inspections/air/airChecklistData.test.ts`:

```ts
import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  AIR_CHECKLIST_GROUPS,
  AIR_DOCUMENTS_REVIEWED_OPTIONS,
  SMR_QUARTER_KEY,
  SMR_QUARTERS,
} from './airChecklistData';
import { DOCUMENTS_REVIEWED_OPTIONS } from '../water/waterChecklistData';

// Table 7 of the printed Air Monitoring form: 52 questions in five groups.
// The counts are the template's, row for row (see the spec's Table 7
// table), so a dropped or duplicated transcription shows up here.

describe('the air checklist matches the printed form', () => {
  it('has the template\u2019s question count in each group', () => {
    expect(AIR_CHECKLIST_DAO_2004_26).toHaveLength(11);
    expect(AIR_CHECKLIST_DAO_2000_81).toHaveLength(12);
    expect(AIR_CHECKLIST_EMB_MC).toHaveLength(14);
    expect(AIR_CHECKLIST_APPENDIX_F).toHaveLength(13);
    expect(AIR_CHECKLIST_CONSENT_AGREEMENT).toHaveLength(2);
  });

  it('lists the groups in template order', () => {
    expect(AIR_CHECKLIST_GROUPS.map(g => g.title)).toEqual([
      'DAO 2004-26',
      'DAO 2000-81',
      'EMB Memorandum Circulars',
      'Appendix F (Quality Assurance Procedures)',
      'For Facilities Engaged with Consent Agreement',
    ]);
    expect(AIR_CHECKLIST_GROUPS.map(g => g.items)).toEqual([
      AIR_CHECKLIST_DAO_2004_26,
      AIR_CHECKLIST_DAO_2000_81,
      AIR_CHECKLIST_EMB_MC,
      AIR_CHECKLIST_APPENDIX_F,
      AIR_CHECKLIST_CONSENT_AGREEMENT,
    ]);
  });

  it('gives every question a unique key across all five groups', () => {
    const keys = AIR_CHECKLIST_GROUPS.flatMap(g => g.items.map(i => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(52);
  });

  it('gives every question its printed group, a citation and wording', () => {
    for (const group of AIR_CHECKLIST_GROUPS) {
      for (const item of group.items) {
        expect(item.group).toBe(group.title);
        expect(item.ref.trim()).not.toBe('');
        expect(item.requirement.trim()).not.toBe('');
      }
    }
  });

  it('corrects the template\u2019s "Part Rule 25" typo', () => {
    const refs = AIR_CHECKLIST_DAO_2000_81.map(i => i.ref);
    expect(refs.some(r => r.startsWith('Part Rule'))).toBe(false);
    expect(refs).toContain('Part 7 Rule 25 Section 5 a (3)');
    expect(refs).toContain('Part 7 Rule 25 Section 13d');
  });

  it('names the quarterly-SMR question so its Q1\u2013Q4 ticks have a home', () => {
    const smr = AIR_CHECKLIST_DAO_2004_26.find(i => i.key === SMR_QUARTER_KEY);
    expect(smr?.requirement).toBe('Quarterly submission of self-monitoring report');
    expect(SMR_QUARTERS).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('adds Record File Folder ahead of the shared documents list', () => {
    expect(AIR_DOCUMENTS_REVIEWED_OPTIONS).toEqual(['Record File Folder', ...DOCUMENTS_REVIEWED_OPTIONS]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx jest src/features/inspections/air/airChecklistData.test.ts
```

Expected: FAIL — `Cannot find module './airChecklistData'`.

- [ ] **Step 3: Transcribe the template**

Create `src/features/inspections/air/airChecklistData.ts`:

```ts
import type { ChecklistItemDef } from '../../../components/form';
import { DOCUMENTS_REVIEWED_OPTIONS } from '../water/waterChecklistData';

// Table 7 of the printed Air Monitoring form - the compliance checklist,
// question for question and in its order, one list per printed group.
// Wording follows the template with whitespace normalised and its evident
// typos corrected ("Part Rule 25" -> "Part 7 Rule 25"); citations are
// otherwise as printed, and a row that inherits its citation from the row
// above (blank first cell on the form) repeats it here so every entry is
// self-describing.
//
// Keys, not positions, identify a stored answer (see airChecklistsForSave
// in airTypes.ts): several questions share one citation, and the list will
// be revised.

export const AIR_CHECKLIST_DAO_2004_26: ChecklistItemDef[] = [
  { key: 'dao2004-26-r19-s1-valid-pto', group: 'DAO 2004-26', ref: 'Rule 19 Section 1', requirement: 'All emission sources have a valid Permit to Operate' },
  { key: 'dao2004-26-r19-s3-as-built-conforms', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'As built design of the installation conforms with submitted engineering plans and specifications' },
  { key: 'dao2004-26-r19-s3-control-facilities-operational', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Declared control facilities are installed and operational' },
  { key: 'dao2004-26-r19-s3-located-as-proposed', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Installation is located as proposed on the vicinity map (plant and machinery layout)' },
  { key: 'dao2004-26-r19-s3-design-capacity-within-declared', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Facility design capacity is within the capacity declared in application for permit to operate' },
  { key: 'dao2004-26-r19-s5-temporary-pto-valid', group: 'DAO 2004-26', ref: 'Rule 19 Section 5', requirement: 'Temporary Permit to Operate is still valid' },
  { key: 'dao2004-26-r19-s6-renewal-filed-30-days', group: 'DAO 2004-26', ref: 'Rule 19 Section 6', requirement: 'Application for renewal has been filed for expiring Permit to Operate 30 days before permit expiration date' },
  { key: 'dao2004-26-r19-s9-pto-displayed', group: 'DAO 2004-26', ref: 'Rule 19 Section 9', requirement: 'Permit to Operate displayed conspicuously upon the installation or in an accessible/visible place near the installation' },
  { key: 'dao2004-26-r19-s9-pto-conditions-complied', group: 'DAO 2004-26', ref: 'Rule 19 Section 9', requirement: 'Conditions of the Permit to Operate are complied with' },
  { key: 'dao2004-26-r19-s11-operational-problems-notified-24h', group: 'DAO 2004-26', ref: 'Rule 19 Section 11', requirement: 'Plant operational problems notification submitted to EMB within 24 hours of occurrence' },
  { key: 'dao2004-26-r19-s12-quarterly-smr', group: 'DAO 2004-26', ref: 'Rule 19 Section 12', requirement: 'Quarterly submission of self-monitoring report' },
];

// The form prints four tick boxes - Q1 to Q4 - beside the quarterly-SMR
// question in place of a plain Y/N/NA. They are stored on that entry as
// `quarters`; see airChecklistsForSave.
export const SMR_QUARTER_KEY = 'dao2004-26-r19-s12-quarterly-smr';
export const SMR_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type SmrQuarter = (typeof SMR_QUARTERS)[number];

export const AIR_CHECKLIST_DAO_2000_81: ChecklistItemDef[] = [
  { key: 'dao2000-81-p7-r25-s5a1-no-dark-smoke-measures', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (1)', requirement: 'Person in charge of the plant/ equipment has sufficient measures to ensure that no dark smoke is discharging from any stack in the establishment (e.g. window view of stack, mirror to reflect top of stack, smoke, density indicator, CCTV, etc.)' },
  { key: 'dao2000-81-p7-r25-s5a2-oil-burning-heaters', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (2)', requirement: 'All oil-burning equipment has heaters capable of heating oil to a temperature appropriate for the oil and burner' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-power-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is fossil fuel-fired power plant over 10MW rating installed with Continuous Emission Monitoring System (CEMS) for particulates, sulfur oxide and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-petroleum-refinery', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is petroleum refinery/petrochemical industry installed with CEMS for particulates, sulfur oxide, and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-copper-smelter', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is primary copper smelter installed with CEMS for particulates, sulfur oxide and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-steel-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is steel plant installed with CEMS for particulates and sulfur oxide' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-ferro-alloy', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is ferro-alloy production facility installed with CEMS for particulates' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-cement-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is a cement plant installed with CEMS for particulates' },
  { key: 'dao2000-81-p7-r25-s5b-misc-equipment-pcf', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5b', requirement: 'Miscellaneous equipment like re-heating furnace, smoke oven, bake oven, coffee heaters, varnish kettles, etc. are installed with pollution control facilities.' },
  { key: 'dao2000-81-p7-r25-s13a-dust-controls', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13a', requirement: 'Establishment has precautionary controls for dusts generated during vehicular movement, transportation of materials, construction, etc. (List controls identified)' },
  { key: 'dao2000-81-p7-r25-s13b-voc-controls', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13b', requirement: 'Establishment has precautionary controls for volatile organic compounds or organic solvent emissions generated during storing, pumping, handling, processing, etc. (List controls identified)' },
  { key: 'dao2000-81-p7-r25-s13d-no-open-burning', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13d', requirement: 'No open burning activity in the establishment' },
];

// Rows 32-43 of the form carry no citation of their own and sit under
// "MC 2007-003 (2)"; that citation is repeated on each.
export const AIR_CHECKLIST_EMB_MC: ChecklistItemDef[] = [
  { key: 'emb-mc-2009-004-gensets-1250kw-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2009-004', requirement: 'Standby Gensets with capacity greater than or equal to 1,250 KW undergo annual emission testing (with 3 test runs). These gensets should not have the potential to emit more than 100 ton/year of regulated pollutant.' },
  { key: 'emb-mc-2007-003-boiler-251hp-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rate at greater than or equal to 251HP undergo bi-annual emission testing (with 3 test runs)' },
  { key: 'emb-mc-2007-003-sources-100tpy-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have potential to emit equal to or greater than 100 tons per year of regulated pollutant undergo bi-annual emission testing (with 3 test runs).' },
  { key: 'emb-mc-2007-003-boiler-100-250hp-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rated between 100 to 250 HP undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-genset-600-1249kw-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Diesel generator rated at 600 to 1,249 KW undergo annual testing (3 test runs)' },
  { key: 'emb-mc-2007-003-sources-30-100tpy-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have the potential to emit greater than 30 but less than 100 tons per year of regulated pollutant undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-hap-sources-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Sources of emissions of hazardous air pollutants included in PCL (DAO 1998-58) undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-steel-making-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of steel-making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-ferro-alloy-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of ferro-alloy making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-glass-making-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of glass-making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-boiler-99hp-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rated at 99HP or less undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-genset-599kw-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Diesel generator rated at 599KW or less undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-sources-10-30tpy-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have potential to emit at least 10 tons per year but less than 30 tons per year of regulated pollutant undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-bunker-fuel-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Sources using Bunker Fuel Oil, blended fuels involving Bunker Fuel Oil, or sulfur content of 1% or more undergo bi-annual emission testing' },
];

// Printed as a sub-heading inside the EMB MC block, but these thirteen cite
// 40 CFR 60 Appendix F sections rather than memorandum circulars, and were
// asked for as their own column (checklist_appendix_f).
export const AIR_CHECKLIST_APPENDIX_F: ChecklistItemDef[] = [
  { key: 'appendix-f-s6-8-cems-installation-change-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (8)', requirement: 'Notification has been sent to EMB for any changes made in the CEMS installation' },
  { key: 'appendix-f-s6-8-cems-qaqc-plan-change-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (8)', requirement: 'Notification has been sent to EMB for any changes made in the CEMS quality assurance and quality control plan' },
  { key: 'appendix-f-s6-5-cems-audited-40cfr60', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (5)', requirement: 'Each CEMS is audited and conducted in accordance to 40 CFR part 60 Appendix F' },
  { key: 'appendix-f-s6-6-rata-annual', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (6)', requirement: 'Relative Accuracy Test Audit (RATA) is performed annually by industries in the presence of EMB personnel' },
  { key: 'appendix-f-s6-7-calibration-gases-quarterly-audit', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (7)', requirement: 'Calibration gases are subject to audit or relative accuracy audit test every quarter' },
  { key: 'appendix-f-s6-7-alternative-audits-approved', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (7)', requirement: 'Other alternative quarterly audits employed by the establishment are approved by EMB' },
  { key: 'appendix-f-s6-9-malfunction-7-days-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (9)', requirement: 'EMB Director and Regional Director have been notified of CEMS malfunction that lasted seven (7) consecutive days' },
  { key: 'appendix-f-s7-1-startup-shutdown-records', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 7 (1)', requirement: 'Records of occurrence and duration of any start-up, shut-down or malfunction in the operation of any source or control facility is available in the establishment' },
  { key: 'appendix-f-s7-2-cems-maintenance-records', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 7 (2)', requirement: 'Records of audits, performance testing, evaluations, calibration checks, adjustments and maintenance of any continuous emission monitors that have been installed pursuant to Rule IX Section 5 DAO 2008-81 are available in the establishment' },
  { key: 'appendix-f-s8-1-smr-excess-emissions', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (1)', requirement: 'SMR includes data on the time intervals, date and magnitude of excess emissions, nature and cause of the excess, corrective actions taken, and preventive measures adopted.' },
  { key: 'appendix-f-s8-2-smr-averaging-period', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (2)', requirement: 'SMR includes information on the averaging period used for data reporting corresponding to the averaging period specified in the emission test period used to determine compliance with an emission standard for the pollutant/source category in question.' },
  { key: 'appendix-f-s8-3-smr-inoperative-periods', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (3)', requirement: 'SMR includes information on time and date for each period during which the continuous monitoring system was inoperative and the nature of system repairs and adjustments made in the CEMS/COMS' },
  { key: 'appendix-f-s8-4-smr-75-percent-capture', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (4)', requirement: 'SMR data measurements are within 75% data capture rate?' },
];

// Cite DAO 2000-81 but are printed under their own heading and apply only
// to establishments under a Consent Agreement; their own column
// (checklist_consent_agreement) rather than folded into DAO 2000-81.
export const AIR_CHECKLIST_CONSENT_AGREEMENT: ChecklistItemDef[] = [
  { key: 'consent-dao2000-81-p7-r25-s9a-ems-18-months', group: 'For Facilities Engaged with Consent Agreement', ref: 'DAO 2000-81 Part 7 Rule 25 Section 9 (a)', requirement: 'EMS established within 18 months upon entering Consent Agreement with EMB' },
  { key: 'consent-dao2000-81-p7-r25-s9b-emp-6-months', group: 'For Facilities Engaged with Consent Agreement', ref: 'DAO 2000-81 Part 7 Rule 25 Section 9 (b)', requirement: 'Environmental Management Plan derived from EMS process submitted within 6 months after entering Consent Agreement with EMB' },
];

// The five groups as the form prints them, in its order - what a read-only
// view iterates and what the column-per-group storage is keyed to.
export const AIR_CHECKLIST_GROUPS: readonly { title: string; items: ChecklistItemDef[] }[] = [
  { title: 'DAO 2004-26', items: AIR_CHECKLIST_DAO_2004_26 },
  { title: 'DAO 2000-81', items: AIR_CHECKLIST_DAO_2000_81 },
  { title: 'EMB Memorandum Circulars', items: AIR_CHECKLIST_EMB_MC },
  { title: 'Appendix F (Quality Assurance Procedures)', items: AIR_CHECKLIST_APPENDIX_F },
  { title: 'For Facilities Engaged with Consent Agreement', items: AIR_CHECKLIST_CONSENT_AGREEMENT },
];

// Table 9's "List of Documents Reviewed". The air form prints "Record File
// Folder" as its first box; the water form's list (which the rest of this
// is) lacks it. Its own constant so the water form's checkbox row does not
// change under the air work.
export const AIR_DOCUMENTS_REVIEWED_OPTIONS: string[] = [
  'Record File Folder',
  ...DOCUMENTS_REVIEWED_OPTIONS,
];
```

- [ ] **Step 4: Run it to see it pass**

```bash
npx jest src/features/inspections/air/airChecklistData.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Spot-check the transcription against the template (optional — needs the export branch)**

The grid-dump script and the original templates live on `feat/export-reports` (`scripts/docx-grid.js`, `assets/templates/originals/Air Monitoring.docx`), not on `develop`, so they are absent from this worktree. The spec's row ranges and the 11/12/14/13/2 counts were taken from that dump when the spec was written. If the main checkout at `D:\Projects\InspectPlus` is still on `feat/export-reports`, the check can be run there read-only:

```bash
node "D:/Projects/InspectPlus/scripts/docx-grid.js" "D:/Projects/InspectPlus/assets/templates/originals/Air Monitoring.docx" | sed -n '/^TABLE 7/,/^TABLE 8/p' | grep "| 3:∅ | 4:∅ | 5:∅" | grep -v " 2:∅ |" | grep -v "2:Appendix F" | wc -l
```

Expected: `52` — the Table 7 rows with the three empty Y/N/N-A cells *and* a requirement in cell 2, i.e. questions. (Header rows 1–3, 16, 29 and 58 lack the empty answer cells; the Q3/Q4 continuation row 15 has them but an empty cell 2, and the row-44 "Appendix F" sub-heading has them with the heading in cell 2 — the two `grep -v`s drop those.) If the main checkout is on another branch, skip this step and say so in the task report — the test in Step 1 already pins the counts.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/features/inspections/air/airChecklistData.ts src/features/inspections/air/airChecklistData.test.ts
git commit -m "$(cat <<'EOF'
feat(air): transcribe the Air Monitoring form's compliance checklist

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `airTypes.ts` — form state and the save/load boundary

**Files:**
- Create: `src/features/inspections/air/airTypes.ts`
- Create: `src/features/inspections/air/airTypes.test.ts`

**Interfaces:**
- Consumes: `DynamicRow`, `ChecklistValue`, `YnValue` from `src/components/form`; everything Task 4 exports; `checklistEntriesForSave`, `checklistValuesFromEntries`, `FindingsEntry`, `StoredFindingsEntry` from Task 3.
- Produces:
  ```ts
  export type EmissionSourceRow = DynamicRow;
  export const EMISSION_SOURCE_KEYS: readonly ['source_no','type','rated_capacity','fuel_type','fuel_quantity','operating_capacity','control_facility','notes'];
  export interface PtoConditionRow { conditionNo: string; description: string; compliant: YnValue; remarks: string; }
  export interface PtoConditionEntry { condition_no: string; description: string; compliant: YnValue; remarks: string; }
  export interface AirChecklistFormValues { checklistDao200426: ChecklistValue[]; checklistDao200081: ChecklistValue[]; checklistEmbMc: ChecklistValue[]; checklistAppendixF: ChecklistValue[]; checklistConsentAgreement: ChecklistValue[]; smrQuarters: SmrQuarter[]; }
  export interface AirComplianceFormState extends AirChecklistFormValues { emissionSources: EmissionSourceRow[]; ptoConditions: PtoConditionRow[]; documentsReviewed: string[]; otherObservations: string; remarksRecommendations: string; }
  export interface AirChecklistRecord { checklistDao200426: FindingsEntry[]; checklistDao200081: FindingsEntry[]; checklistEmbMc: FindingsEntry[]; checklistAppendixF: FindingsEntry[]; checklistConsentAgreement: FindingsEntry[]; }
  export type StoredAirChecklistRecord = { [K in keyof AirChecklistRecord]?: readonly StoredFindingsEntry[] | null };
  export function emptyEmissionSource(sourceNo: string): EmissionSourceRow;
  export function emptyPtoCondition(conditionNo: string): PtoConditionRow;
  export function emptyAirComplianceForm(): AirComplianceFormState;
  export function airChecklistsForSave(form: AirChecklistFormValues): AirChecklistRecord;
  export function airChecklistsFromRecord(record: StoredAirChecklistRecord): AirChecklistFormValues;
  export function ptoConditionsForSave(rows: readonly PtoConditionRow[]): PtoConditionEntry[];
  export function ptoConditionsFromRecord(entries: readonly Record<string, unknown>[]): PtoConditionRow[];
  export function describeSmrQuarters(quarters: readonly string[]): string;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/inspections/air/airTypes.test.ts`:

```ts
import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  SMR_QUARTER_KEY,
} from './airChecklistData';
import {
  airChecklistsForSave,
  airChecklistsFromRecord,
  describeSmrQuarters,
  emptyAirComplianceForm,
  ptoConditionsForSave,
  ptoConditionsFromRecord,
  EMISSION_SOURCE_KEYS,
} from './airTypes';

// The boundary between the air form's state and the compliance_air record:
// five keyed checklists (plus the quarterly-SMR ticks riding on one entry),
// PTO conditions snake_cased for storage, and the empty form a screen
// starts from.

describe('emptyAirComplianceForm', () => {
  it('starts with one numbered emission source and one numbered PTO condition', () => {
    const form = emptyAirComplianceForm();
    expect(form.emissionSources).toHaveLength(1);
    expect(form.emissionSources[0].source_no).toBe('1');
    expect(Object.keys(form.emissionSources[0]).sort()).toEqual([...EMISSION_SOURCE_KEYS].sort());
    expect(form.ptoConditions).toEqual([{ conditionNo: '1', description: '', compliant: null, remarks: '' }]);
  });

  it('holds one unanswered value per question in each of the five lists', () => {
    const form = emptyAirComplianceForm();
    expect(form.checklistDao200426).toHaveLength(AIR_CHECKLIST_DAO_2004_26.length);
    expect(form.checklistDao200081).toHaveLength(AIR_CHECKLIST_DAO_2000_81.length);
    expect(form.checklistEmbMc).toHaveLength(AIR_CHECKLIST_EMB_MC.length);
    expect(form.checklistAppendixF).toHaveLength(AIR_CHECKLIST_APPENDIX_F.length);
    expect(form.checklistConsentAgreement).toHaveLength(AIR_CHECKLIST_CONSENT_AGREEMENT.length);
    expect(form.checklistEmbMc.every(v => v.compliant === null && v.remarks === '')).toBe(true);
    expect(form.smrQuarters).toEqual([]);
    expect(form.documentsReviewed).toEqual([]);
    expect(form.otherObservations).toBe('');
    expect(form.remarksRecommendations).toBe('');
  });
});

describe('airChecklistsForSave / airChecklistsFromRecord', () => {
  const answered = () => {
    const form = emptyAirComplianceForm();
    form.checklistDao200426[0] = { compliant: 'Y', remarks: '' };
    form.checklistDao200081[3] = { compliant: 'NA', remarks: 'no CEMS' };
    form.checklistEmbMc[13] = { compliant: 'N', remarks: 'no bunker test' };
    form.checklistAppendixF[12] = { compliant: 'Y', remarks: '' };
    form.checklistConsentAgreement[1] = { compliant: 'N', remarks: 'EMP pending' };
    form.smrQuarters = ['Q1', 'Q3'];
    return form;
  };

  it('writes all five columns as keyed, self-describing entries', () => {
    const record = airChecklistsForSave(answered());
    expect(record.checklistDao200426[0]).toEqual({
      key: 'dao2004-26-r19-s1-valid-pto',
      legal_ref: 'DAO 2004-26 Rule 19 Section 1',
      requirement: 'All emission sources have a valid Permit to Operate',
      compliant: 'Y',
      remarks: '',
    });
    expect(record.checklistConsentAgreement[1]).toMatchObject({
      key: 'consent-dao2000-81-p7-r25-s9b-emp-6-months',
      legal_ref: 'For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (b)',
      compliant: 'N',
      remarks: 'EMP pending',
    });
    expect(record.checklistAppendixF).toHaveLength(13);
  });

  it('rides the SMR quarters on the quarterly-SMR entry and nowhere else', () => {
    const record = airChecklistsForSave(answered());
    const smr = record.checklistDao200426.find(e => e.key === SMR_QUARTER_KEY);
    expect(smr).toMatchObject({ quarters: ['Q1', 'Q3'] });
    const others = record.checklistDao200426.filter(e => e.key !== SMR_QUARTER_KEY);
    expect(others.every(e => !('quarters' in e))).toBe(true);
  });

  it('keeps the quarters whatever the Y/N/NA answer', () => {
    const form = answered();
    form.checklistDao200426[10] = { compliant: 'N', remarks: 'Q2 and Q4 missing' };
    const smr = airChecklistsForSave(form).checklistDao200426.find(e => e.key === SMR_QUARTER_KEY);
    expect(smr).toMatchObject({ compliant: 'N', quarters: ['Q1', 'Q3'] });
  });

  it('round-trips through the record', () => {
    const form = answered();
    const back = airChecklistsFromRecord(airChecklistsForSave(form));
    expect(back).toEqual({
      checklistDao200426: form.checklistDao200426,
      checklistDao200081: form.checklistDao200081,
      checklistEmbMc: form.checklistEmbMc,
      checklistAppendixF: form.checklistAppendixF,
      checklistConsentAgreement: form.checklistConsentAgreement,
      smrQuarters: ['Q1', 'Q3'],
    });
  });

  it('reads a row written before the new columns existed as blank there', () => {
    const back = airChecklistsFromRecord({
      checklistDao200426: airChecklistsForSave(answered()).checklistDao200426,
      checklistAppendixF: null,
    });
    expect(back.checklistDao200426[0]).toEqual({ compliant: 'Y', remarks: '' });
    expect(back.checklistAppendixF).toEqual(emptyAirComplianceForm().checklistAppendixF);
    expect(back.checklistConsentAgreement).toEqual(emptyAirComplianceForm().checklistConsentAgreement);
  });

  it('filters quarters to the four it knows, keeping form order, and defaults to none', () => {
    const entries = airChecklistsForSave(answered()).checklistDao200426.map(e =>
      e.key === SMR_QUARTER_KEY ? { ...e, quarters: ['Q4', 'Q9', 'Q1', 'q2'] } : e,
    );
    expect(airChecklistsFromRecord({ checklistDao200426: entries }).smrQuarters).toEqual(['Q1', 'Q4']);
    expect(airChecklistsFromRecord({ checklistDao200426: [{ key: SMR_QUARTER_KEY, compliant: 'Y' }] }).smrQuarters).toEqual([]);
    expect(airChecklistsFromRecord({}).smrQuarters).toEqual([]);
  });
});

describe('ptoConditionsForSave / ptoConditionsFromRecord', () => {
  it('snake_cases rows and drops those with no description', () => {
    expect(ptoConditionsForSave([
      { conditionNo: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { conditionNo: '2', description: '   ', compliant: null, remarks: 'stray' },
      { conditionNo: '3', description: 'Quarterly SMR', compliant: 'N', remarks: 'Q2 late' },
    ])).toEqual([
      { condition_no: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { condition_no: '3', description: 'Quarterly SMR', compliant: 'N', remarks: 'Q2 late' },
    ]);
  });

  it('reads stored entries back as form rows, tolerating missing keys', () => {
    expect(ptoConditionsFromRecord([
      { condition_no: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { description: 'No remarks key', compliant: null },
    ])).toEqual([
      { conditionNo: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { conditionNo: '', description: 'No remarks key', compliant: null, remarks: '' },
    ]);
  });
});

describe('describeSmrQuarters', () => {
  it('lists the ticked quarters or a dash', () => {
    expect(describeSmrQuarters(['Q1', 'Q3'])).toBe('Q1, Q3');
    expect(describeSmrQuarters([])).toBe('\u2014');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx jest src/features/inspections/air/airTypes.test.ts
```

Expected: FAIL — `Cannot find module './airTypes'`.

- [ ] **Step 3: Create the module**

Create `src/features/inspections/air/airTypes.ts`:

```ts
import type { DynamicRow, ChecklistValue, YnValue } from '../../../components/form';
import {
  checklistEntriesForSave,
  checklistValuesFromEntries,
  type FindingsEntry,
  type StoredFindingsEntry,
} from '../checklistEntries';
import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  SMR_QUARTER_KEY,
  SMR_QUARTERS,
  type SmrQuarter,
} from './airChecklistData';

// ── Emission sources (Table 6) ───────────────────────────────────────────────
// One row per emission source. snake_case: written straight through to
// emission_sources, matching the shape documented on the ComplianceAir
// model and read by AirComplianceView. The form's single "Fuel Type &
// Quantity" cell is two fields here and joined at export.
export type EmissionSourceRow = DynamicRow;

export const EMISSION_SOURCE_KEYS = [
  'source_no',
  'type',
  'rated_capacity',
  'fuel_type',
  'fuel_quantity',
  'operating_capacity',
  'control_facility',
  'notes',
] as const;

export function emptyEmissionSource(sourceNo: string): EmissionSourceRow {
  const row: EmissionSourceRow = {};
  for (const key of EMISSION_SOURCE_KEYS) row[key] = '';
  row.source_no = sourceNo;
  return row;
}

// ── Permit to Operate conditions (Table 8) ───────────────────────────────────
// camelCase in the form, the way water's DpConditionRow is; the record
// holds the snake_case shape every other conditions column already uses
// ({condition_no, description, compliant, remarks}) so a reader written
// for hazwaste's or water's conditions reads these too.
export interface PtoConditionRow {
  conditionNo: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export interface PtoConditionEntry {
  condition_no: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export const emptyPtoCondition = (conditionNo: string): PtoConditionRow => ({
  conditionNo,
  description: '',
  compliant: null,
  remarks: '',
});

// A condition with nothing written in it is a blank row the inspector
// added and never used, not a condition - same rule water applies to its
// discharge-permit conditions.
export function ptoConditionsForSave(rows: readonly PtoConditionRow[]): PtoConditionEntry[] {
  return rows
    .filter(r => r.description.trim() !== '')
    .map(r => ({
      condition_no: r.conditionNo,
      description: r.description,
      compliant: r.compliant,
      remarks: r.remarks,
    }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function ptoConditionsFromRecord(entries: readonly Record<string, unknown>[]): PtoConditionRow[] {
  return entries.map(e => ({
    conditionNo: str(e.condition_no),
    description: str(e.description),
    compliant: (e.compliant as YnValue) ?? null,
    remarks: str(e.remarks),
  }));
}

// ── Checklists (Table 7) ─────────────────────────────────────────────────────
// Five lists, one per printed group and per compliance_air column. The form
// holds them positionally (one ChecklistValue per question, in list order);
// the record holds keyed, self-describing entries - see ../checklistEntries.

export interface AirChecklistFormValues {
  checklistDao200426: ChecklistValue[];
  checklistDao200081: ChecklistValue[];
  checklistEmbMc: ChecklistValue[];
  checklistAppendixF: ChecklistValue[];
  checklistConsentAgreement: ChecklistValue[];
  // The Q1-Q4 ticks the form prints beside DAO 2004-26 Rule 19 Section 12.
  // Stored on that entry as `quarters` - see airChecklistsForSave.
  smrQuarters: SmrQuarter[];
}

export interface AirChecklistRecord {
  checklistDao200426: FindingsEntry[];
  checklistDao200081: FindingsEntry[];
  checklistEmbMc: FindingsEntry[];
  checklistAppendixF: FindingsEntry[];
  checklistConsentAgreement: FindingsEntry[];
}

// The record as it comes off the model or the detail hook: any column may
// be missing or null on a row written before it existed.
export type StoredAirChecklistRecord = {
  [K in keyof AirChecklistRecord]?: readonly StoredFindingsEntry[] | null;
};

const blankValues = (n: number): ChecklistValue[] =>
  Array.from({ length: n }, () => ({ compliant: null, remarks: '' }));

// All five columns at once, so a caller can't save four and forget one.
//
// The quarters ride on the quarterly-SMR entry whatever its Y/N/NA answer.
// This differs from water's "no stranded text" rule deliberately: an
// unticked Others beside free text contradicts the boxes, but "Q1 and Q2
// ticked, answer N" is a coherent record - it says which quarters were
// submitted and that the obligation was not met.
export function airChecklistsForSave(form: AirChecklistFormValues): AirChecklistRecord {
  const quarters = form.smrQuarters.filter(q => (SMR_QUARTERS as readonly string[]).includes(q));
  return {
    checklistDao200426: checklistEntriesForSave(AIR_CHECKLIST_DAO_2004_26, form.checklistDao200426).map(e =>
      e.key === SMR_QUARTER_KEY ? { ...e, quarters } : e,
    ),
    checklistDao200081: checklistEntriesForSave(AIR_CHECKLIST_DAO_2000_81, form.checklistDao200081),
    checklistEmbMc: checklistEntriesForSave(AIR_CHECKLIST_EMB_MC, form.checklistEmbMc),
    checklistAppendixF: checklistEntriesForSave(AIR_CHECKLIST_APPENDIX_F, form.checklistAppendixF),
    checklistConsentAgreement: checklistEntriesForSave(AIR_CHECKLIST_CONSENT_AGREEMENT, form.checklistConsentAgreement),
  };
}

// Quarters come back in SMR_QUARTERS order (Q1..Q4), filtered to the four
// the form knows; anything else an older or foreign build wrote is dropped.
function smrQuartersFrom(entries: readonly StoredFindingsEntry[]): SmrQuarter[] {
  const smr = entries.find(e => e.key === SMR_QUARTER_KEY) as Record<string, unknown> | undefined;
  const stored = Array.isArray(smr?.quarters) ? (smr.quarters as unknown[]) : [];
  return SMR_QUARTERS.filter(q => stored.includes(q));
}

export function airChecklistsFromRecord(record: StoredAirChecklistRecord): AirChecklistFormValues {
  const read = (defs: typeof AIR_CHECKLIST_DAO_2004_26, entries: readonly StoredFindingsEntry[] | null | undefined) =>
    checklistValuesFromEntries(defs, entries ?? []);
  return {
    checklistDao200426: read(AIR_CHECKLIST_DAO_2004_26, record.checklistDao200426),
    checklistDao200081: read(AIR_CHECKLIST_DAO_2000_81, record.checklistDao200081),
    checklistEmbMc: read(AIR_CHECKLIST_EMB_MC, record.checklistEmbMc),
    checklistAppendixF: read(AIR_CHECKLIST_APPENDIX_F, record.checklistAppendixF),
    checklistConsentAgreement: read(AIR_CHECKLIST_CONSENT_AGREEMENT, record.checklistConsentAgreement),
    smrQuarters: smrQuartersFrom(record.checklistDao200426 ?? []),
  };
}

// One line for read-only views: 'Q1, Q3', or a dash when none are ticked.
export function describeSmrQuarters(quarters: readonly string[]): string {
  return quarters.length === 0 ? '\u2014' : quarters.join(', ');
}

// ── Whole form ───────────────────────────────────────────────────────────────

export interface AirComplianceFormState extends AirChecklistFormValues {
  emissionSources: EmissionSourceRow[];
  ptoConditions: PtoConditionRow[];
  documentsReviewed: string[];
  otherObservations: string;
  remarksRecommendations: string;
}

export function emptyAirComplianceForm(): AirComplianceFormState {
  return {
    emissionSources: [emptyEmissionSource('1')],
    checklistDao200426: blankValues(AIR_CHECKLIST_DAO_2004_26.length),
    checklistDao200081: blankValues(AIR_CHECKLIST_DAO_2000_81.length),
    checklistEmbMc: blankValues(AIR_CHECKLIST_EMB_MC.length),
    checklistAppendixF: blankValues(AIR_CHECKLIST_APPENDIX_F.length),
    checklistConsentAgreement: blankValues(AIR_CHECKLIST_CONSENT_AGREEMENT.length),
    smrQuarters: [],
    ptoConditions: [emptyPtoCondition('1')],
    documentsReviewed: [],
    otherObservations: '',
    remarksRecommendations: '',
  };
}
```

- [ ] **Step 4: Run it to see it pass**

```bash
npx jest src/features/inspections/air/airTypes.test.ts
```

Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npm run typecheck
npm run lint
git add src/features/inspections/air/airTypes.ts src/features/inspections/air/airTypes.test.ts
git commit -m "$(cat <<'EOF'
feat(air): add the air form state and its save/load boundary

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Read side — five checklist groups in template order

**Files:**
- Modify: `src/features/inspections/hooks/useInspectionReport.ts` (add the helper beside the `AirComplianceView` / `ChecklistGroup` / `ChecklistEntry` declarations)
- Modify: `src/features/inspections/hooks/loadInspectionReportDetail.ts:160-179` (the `air_monitoring` branch — the call site)
- Test: `src/features/inspections/hooks/airComplianceView.test.ts`

**Interfaces:**
- Consumes: `AIR_CHECKLIST_GROUPS` (Task 4) for the titles; `ComplianceAir.checklistAppendixF` / `.checklistConsentAgreement` (Task 2).
- Produces: `AirComplianceView.checklists` has five `ChecklistGroup`s, titled and ordered as the form prints them.

**Amended 2026-09-25 (Ruling 5).** The plan originally put both the helper and the call site in `useInspectionReport.ts`. Since then `develop` landed `refactor(reports): pull the report-detail loader out of useInspectionReport`, which moved the `air_monitoring` branch verbatim into `loadInspectionReportDetail.ts`. The helper stays in `useInspectionReport.ts` (that is where `AirComplianceView`, `ChecklistGroup` and `ChecklistEntry` are declared, and the loader already imports types from it); only the call site moves.

This branch of the loader is only exercised for `air_monitoring` reports, which nothing creates yet, so the existing loader tests do not reach it; the change is covered by typecheck plus a targeted assertion below.

- [ ] **Step 1: Write the failing test**

Create `src/features/inspections/hooks/airComplianceView.test.ts`:

```ts
import { AIR_CHECKLIST_GROUPS } from '../air/airChecklistData';
import { airChecklistGroupsFrom } from './useInspectionReport';

// useInspectionReport pulls in the native SQLite adapter and the supabase
// client transitively, neither of which loads under Jest — same two mocks
// src/features/establishments/hooks/useEstablishment.test.ts:8-19 uses.
// jest.mock calls are hoisted above the imports.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

// The detail screen's read-only view of an air report lists the checklist
// groups as the printed form does - all five, in its order - so a reviewer
// reading the app and a reviewer holding the paper see the same sequence.

describe('airChecklistGroupsFrom', () => {
  it('yields the five printed groups in template order, empty columns as []', () => {
    const groups = airChecklistGroupsFrom({
      checklistDao200426: [{ key: 'a', compliant: 'Y' }],
      checklistDao200081: [],
      checklistEmbMc: [],
      checklistAppendixF: undefined,
      checklistConsentAgreement: null,
    });
    expect(groups.map(g => g.title)).toEqual(AIR_CHECKLIST_GROUPS.map(g => g.title));
    expect(groups[0].items).toEqual([{ key: 'a', compliant: 'Y' }]);
    expect(groups[3].items).toEqual([]);
    expect(groups[4].items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx jest src/features/inspections/hooks/airComplianceView.test.ts
```

Expected: FAIL — `airChecklistGroupsFrom` is not exported from `./useInspectionReport`.

- [ ] **Step 3: Add the helper and use it**

In `src/features/inspections/hooks/useInspectionReport.ts`, add to the imports:

```ts
import { AIR_CHECKLIST_GROUPS } from '../air/airChecklistData';
```

Note this makes `useInspectionReport.ts` import a value (not just a type) for the first time from the air feature folder; that is fine — it already imports values from `../types` and `../../establishments/hooks/useEstablishment`.

Directly above `export interface AirComplianceView {`, add:

```ts
// The five checklist columns as the form prints them, in its order. Exported
// for its test; the hook is the only production caller.
export function airChecklistGroupsFrom(c: {
  checklistDao200426?: ChecklistEntry[] | null;
  checklistDao200081?: ChecklistEntry[] | null;
  checklistEmbMc?: ChecklistEntry[] | null;
  checklistAppendixF?: ChecklistEntry[] | null;
  checklistConsentAgreement?: ChecklistEntry[] | null;
}): ChecklistGroup[] {
  const columns = [
    c.checklistDao200426,
    c.checklistDao200081,
    c.checklistEmbMc,
    c.checklistAppendixF,
    c.checklistConsentAgreement,
  ];
  return AIR_CHECKLIST_GROUPS.map((g, i) => ({ title: g.title, items: columns[i] ?? [] }));
}
```

Then in `src/features/inspections/hooks/loadInspectionReportDetail.ts`, add to its imports:

```ts
import { airChecklistGroupsFrom } from './useInspectionReport';
```

(it already has `import type { ComplianceView, InspectionReportSummary } from './useInspectionReport';` — add this as a separate value import beside it.)

In that file's `air_monitoring` branch, replace:

```ts
        checklists: [
          { title: 'DAO 2000-81', items: c.checklistDao200081 ?? [] },
          { title: 'DAO 2004-26', items: c.checklistDao200426 ?? [] },
          { title: 'EMB Memorandum Circular', items: c.checklistEmbMc ?? [] },
        ],
```

with:

```ts
        checklists: airChecklistGroupsFrom(c),
```

- [ ] **Step 4: Run it to see it pass, then typecheck and lint**

```bash
npx jest src/features/inspections/hooks/airComplianceView.test.ts
npm run typecheck
npm run lint
```

Expected: PASS; typecheck and lint clean. If typecheck complains that `ComplianceAir`'s `any[]` fields don't fit `ChecklistEntry[]`, that is a false alarm from `any` widening — it should not; `any[]` is assignable to `ChecklistEntry[]`. If it does complain, report it rather than loosening the helper's parameter type.

- [ ] **Step 5: Commit**

```bash
git add src/features/inspections/hooks/useInspectionReport.ts src/features/inspections/hooks/loadInspectionReportDetail.ts src/features/inspections/hooks/airComplianceView.test.ts
git commit -m "$(cat <<'EOF'
feat(air): read all five checklist groups in the form's order

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final verification

**Files:** none new.

- [ ] **Step 1: Full checks**

```bash
npm run typecheck
npm run lint
npm test
```

Expected: typecheck and lint clean; every suite passes. Baseline on this branch after the 2026-09-25 rebase onto develop is **119 suites / 1251 tests**; this plan adds four test files (checklistEntries, airChecklistData, airTypes, airComplianceView), so expect **123 suites** and roughly 1285 tests.

Note: a cold run with an empty Jest cache was observed to fail 2 tests once, with the immediate warm re-run fully green. If you hit a failure, re-run before investigating; if it reproduces warm, it is real — investigate and report it.

- [ ] **Step 2: Confirm the branch is only what the spec asked for**

```bash
git log --oneline develop..HEAD
git diff --stat develop..HEAD
```

Use `git log --oneline develop..HEAD` and `git diff --stat develop..HEAD`.

Expected: eight commits (spec, plan, Tasks 1–6). The diffstat touches only the files in this plan's file map plus the spec and this plan. Nothing under `src/app/`, `src/components/`, `src/constants/reportTypes.ts`, or `assets/`.

- [ ] **Step 3: Report**

State plainly: which checks ran and their results, whether the pgTAP RPC test was run locally or left to CI, and that the branch is ready for review via superpowers:finishing-a-development-branch.
