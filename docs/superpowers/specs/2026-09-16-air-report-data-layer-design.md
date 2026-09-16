# Air inspection report — data layer

Status: approved design. Branch `feat/air-report-data-layer` off `develop`
(85dc31f).

Prepare everything below the screen for the Air Quality inspection report,
using the printed EMB form (`assets/templates/originals/Air Monitoring.docx`)
as the source of truth: the storage the report needs on both sides of sync,
and the domain files — checklist definitions, form-state types and the
save/load boundary — that a form screen will later plug into. The form
screen itself is a separate branch; this one ends with air storable,
syncable and readable, not enterable.

## Purpose

`compliance_air` already exists end to end — Supabase table, `push_changes`
/ `pull_changes` handling, WatermelonDB table and `ComplianceAir` model,
`syncSchema` field map, delete wiring in `reportPersistence.ts`, and a
read-only `AirComplianceView` in `useInspectionReport.ts`. It was designed
before the printed form was transcribed, so two things are missing:

1. The form's compliance checklist (Table 7) has **five** printed groups;
   the table has three checklist columns. Two groups have nowhere to go.
2. Nothing in the codebase says what the air questions *are*. Water has
   `waterChecklistData.ts` (the questions, keyed) and `waterTypes.ts`
   (form state, `*ForSave` rules); air has only the model's shape comments.

Everything else in the template already fits the existing columns.

## 1. What the template asks

Air-specific sections of `Air Monitoring.docx`, by table index as
`scripts/docx-grid.js` reports them:

| Table | Section | Existing column | Fit |
|---|---|---|---|
| 6 | Emission Source Data Information — No., Type (Brand/Model), Rated Capacity, Fuel Type & Quantity, Operating Capacity, Control Facility, Notes | `emission_sources` jsonb | Fits. Item shape already `{source_no, type, rated_capacity, fuel_type, fuel_quantity, operating_capacity, control_facility, notes}`; the template's single "Fuel Type & Quantity" cell is an export-time join. |
| 7 | Compliance checklist, 52 questions in five groups | `checklist_dao_2004_26`, `checklist_dao_2000_81`, `checklist_emb_mc` | **Two groups missing** — see §2. |
| 8 | Compliance to PTO Conditions — No., Description, Yes/No/N/A, Remarks | `pto_conditions` jsonb | Fits. `{condition_no, description, compliant, remarks}`. |
| 9 | Other Observations; Remarks and Recommendations; List of Documents Reviewed | `other_observations`, `remarks_recommendations`, `documents_reviewed` | Fits. |

Tables 1–5 and 10 (general information, purpose, permits, signatures) are
shared with every inspection type and come from `inspection_reports` and
its snapshots; not this branch's concern.

### Table 7 groups

Row numbers are Table 7's, as printed. Header rows are not questions.

| Group (as printed) | Rows | Questions | Column |
|---|---|---|---|
| DAO 2004-26 | 4–14 | 11 | `checklist_dao_2004_26` (existing) |
| DAO 2000-81 | 17–28 | 12 | `checklist_dao_2000_81` (existing) |
| EMB Memorandum Circulars | 30–43 | 14 | `checklist_emb_mc` (existing) |
| Appendix F (Quality Assurance Procedures) | 45–57 | 13 | `checklist_appendix_f` (**new**) |
| For Facilities Engaged with Consent Agreement | 59–60 | 2 | `checklist_consent_agreement` (**new**) |

Row 44 ("Appendix F (Quality Assurance Procedures)") is printed as a
sub-heading inside the EMB MC block, but its thirteen questions cite
40 CFR 60 Appendix F sections, not memorandum circulars, and were asked
for as their own column. Rows 59–60 cite DAO 2000-81 but are printed under
their own heading and only apply to establishments under a Consent
Agreement; they also get their own column rather than being folded into
`checklist_dao_2000_81`.

Row 14 (DAO 2004-26 Rule 19 Section 12, "Quarterly submission of
self-monitoring report") carries four extra tick boxes — Q1, Q2, Q3, Q4 —
in place of a plain Y/N/NA. See §3 for how those are stored.

Row 19's "Note: This can be deleted if not applicable" is a template
authoring note, not a question; the six CEMS rows (19–24) are simply
answered N/A when they do not apply.

## 2. Storage

### Supabase — one migration

`supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql`:

```sql
alter table public.compliance_air
  add column if not exists checklist_appendix_f jsonb,
  add column if not exists checklist_consent_agreement jsonb;
```

then a full re-issue of `push_changes`, based on
`20260915130000_add_sampling_conducted_to_compliance_water.sql` (the last
migration to redefine it). The only edits are in the `compliance_air`
created-insert and updated-upsert blocks: the two new columns join the
column lists, their values are `coalesce(record->'…', '[]'::jsonb)` like
the other checklists, and the `on conflict … do update set` gains both.

`pull_changes` needs no change: it emits `to_jsonb(ca)` for whole rows, so
new columns flow to the client automatically. The migration header says
so, so the next person does not go looking.

Additive per `docs/sync-contract.md`'s Backward Compatibility Rules: both
columns are nullable; an installed client that does not send them leaves
them NULL. `min_supported_app_version` is not raised.

### WatermelonDB — schema v15 → v16

`src/db/schema.ts`: `compliance_air` gains

```ts
{ name: 'checklistAppendixF',        type: 'string', isOptional: true },
{ name: 'checklistConsentAgreement', type: 'string', isOptional: true },
```

`src/db/migrations.ts`: a `toVersion: 16` step with the matching
`addColumns`.

`src/db/models/ComplianceAir.ts`: two `@json(…, asArray)` fields, and the
header comments rewritten to describe the keyed entry shape in §3 rather
than the positional one the file currently claims.

`src/services/sync/syncSchema.ts`: `compliance_air.fields` gains
`checklist_appendix_f: 'checklistAppendixF'` and
`checklist_consent_agreement: 'checklistConsentAgreement'`.

### Read side

`useInspectionReport.ts`'s `AirComplianceView.checklists` grows from three
groups to five and is put in template order — DAO 2004-26, DAO 2000-81,
EMB Memorandum Circulars, Appendix F (Quality Assurance Procedures), For
Facilities Engaged with Consent Agreement. (Today it lists 2000-81 before
2004-26.) `ChecklistEntry`'s index signature already admits the optional
`quarters` key.

## 3. Domain layer — `src/features/inspections/air/`

Two files, mirroring `water/waterChecklistData.ts` and `water/waterTypes.ts`.
No components, no screens, no routes. `ENABLED_TYPES` in
`constants/reportTypes.ts` is untouched — air stays visibly "Soon".

### `airChecklistData.ts`

Five `ChecklistItemDef[]` constants, one per column, each in template order
with a stable `key`, the printed `group`, the printed `ref` and the
question's wording:

```
AIR_CHECKLIST_DAO_2004_26          11 items
AIR_CHECKLIST_DAO_2000_81          12 items
AIR_CHECKLIST_EMB_MC               14 items
AIR_CHECKLIST_APPENDIX_F           13 items
AIR_CHECKLIST_CONSENT_AGREEMENT     2 items
```

Conventions, following water's:

- **Keys** are `<group-slug>-<ref-slug>-<short-topic>`, e.g.
  `dao2004-26-r19-s1-valid-pto`, `emb-mc-2007-003-boiler-251hp-biannual`,
  `appendix-f-s6-8-cems-installation-change-notified`,
  `consent-dao2000-81-p7-r25-s9a-ems-18-months`. Keys are unique across
  all five lists (tested), since a reader may see them side by side.
- **`ref`** is the citation as printed for the first row of a citation
  block; rows that inherit a citation from the row above (blank first
  cell) repeat it, so every entry is self-describing. Evident typos are
  corrected: "Part Rule 25 Section 5 a (3)" and "Part Rule 25 Section 13d"
  → "Part 7 Rule 25 …". Rows 32–43 inherit "MC 2007-003 (2)" as printed.
- **`requirement`** is the wording as printed, whitespace normalised,
  the row-19 authoring note dropped.
- **`group`** is the printed heading: `'DAO 2004-26'`, `'DAO 2000-81'`,
  `'EMB Memorandum Circulars'`, `'Appendix F (Quality Assurance
  Procedures)'`, `'For Facilities Engaged with Consent Agreement'`.

Also exported:

- `SMR_QUARTER_KEY` — the key of the row-14 entry — and
  `SMR_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const`.
- `AIR_DOCUMENTS_REVIEWED_OPTIONS` — Table 9's list: `'Record File
  Folder'`, then water's `DOCUMENTS_REVIEWED_OPTIONS` verbatim. The air
  template prints "Record File Folder" as its first box; water's list
  lacks it. Kept as its own constant rather than editing water's, so the
  water form's checkbox row does not change under this branch.

### `airTypes.ts`

Form state and the save/load boundary. Shapes:

```ts
// Table 6, one row per emission source. snake_case: written straight
// through to emission_sources, matching the shape already documented on
// the model and read by AirComplianceView.
export type EmissionSourceRow = DynamicRow;   // keys below
//   source_no, type, rated_capacity, fuel_type, fuel_quantity,
//   operating_capacity, control_facility, notes

// Table 8. camelCase in the form, the way water's DpConditionRow is;
// converted to the model's snake_case {condition_no, description,
// compliant, remarks} by ptoConditionsForSave so the stored row matches
// what ConditionEntry / the hazwaste and water conditions already look like.
export interface PtoConditionRow {
  conditionNo: string;
  description: string;
  compliant: YnValue;
  remarks: string;
}

export interface AirComplianceFormState {
  emissionSources: EmissionSourceRow[];
  checklistDao200426: ChecklistValue[];       // positional, in list order
  checklistDao200081: ChecklistValue[];
  checklistEmbMc: ChecklistValue[];
  checklistAppendixF: ChecklistValue[];
  checklistConsentAgreement: ChecklistValue[];
  smrQuarters: string[];                       // subset of SMR_QUARTERS
  ptoConditions: PtoConditionRow[];
  documentsReviewed: string[];
  otherObservations: string;
  remarksRecommendations: string;
}

export function emptyAirComplianceForm(): AirComplianceFormState;
//   one blank emission source with source_no '1'; every checklist
//   {compliant: null, remarks: ''} per item; smrQuarters []; one blank
//   PTO condition '1'; the rest empty.
```

**Stored checklist entries** use the shape water settled on
(`FindingsEntry`), keyed and self-describing:

```ts
{ key, legal_ref, requirement, compliant, remarks }
```

with `legal_ref` = `` `${group} ${ref}` `` (or `group` alone when `ref` is
empty). The row-14 entry additionally carries `quarters: string[]`.

**Save/load helpers.** Water's `findingsEntriesForSave` /
`findingsValuesFromEntries` are bound to `WATER_FINDINGS_CHECKLIST`. Air
needs the same logic against five lists, so the mechanism moves to a
shared, list-parameterised pair in
`src/features/inspections/checklistEntries.ts`:

```ts
export function checklistEntriesForSave(defs: ChecklistItemDef[], values: ChecklistValue[]): FindingsEntry[];
export function checklistValuesFromEntries(defs: ChecklistItemDef[], entries: readonly StoredFindingsEntry[]): ChecklistValue[];
```

Same rules as today: answers are matched by key, never by position;
entries whose key the list no longer knows are dropped on read; every
entry written carries its citation and wording as they stood when it was
answered. `FindingsEntry` and `StoredFindingsEntry` move there too.
`waterTypes.ts` keeps exporting `findingsEntriesForSave`,
`findingsValuesFromEntries`, `FindingsEntry` and `StoredFindingsEntry`
with unchanged signatures, now delegating / re-exporting — its callers and
tests do not change.

On top of that, `airTypes.ts` exports:

```ts
// All five columns at once, so a caller can't save four and forget one.
export function airChecklistsForSave(form: AirComplianceFormState): {
  checklistDao200426: FindingsEntry[];
  checklistDao200081: FindingsEntry[];
  checklistEmbMc: FindingsEntry[];
  checklistAppendixF: FindingsEntry[];
  checklistConsentAgreement: FindingsEntry[];
};
export function airChecklistsFromRecord(record: {
  checklistDao200426?: readonly StoredFindingsEntry[];
  checklistDao200081?: readonly StoredFindingsEntry[];
  checklistEmbMc?: readonly StoredFindingsEntry[];
  checklistAppendixF?: readonly StoredFindingsEntry[];
  checklistConsentAgreement?: readonly StoredFindingsEntry[];
}): Pick<
  AirComplianceFormState,
  | 'checklistDao200426' | 'checklistDao200081' | 'checklistEmbMc'
  | 'checklistAppendixF' | 'checklistConsentAgreement' | 'smrQuarters'
>;

export function ptoConditionsForSave(rows: PtoConditionRow[]): ConditionEntry[];
//   drops rows with a blank description (as water drops blank dpConditions),
//   maps conditionNo → condition_no.
export function ptoConditionsFromRecord(entries: readonly Record<string, unknown>[]): PtoConditionRow[];

export function describeSmrQuarters(quarters: readonly string[]): string;  // 'Q1, Q3' or '—'
```

**Quarters rule.** `airChecklistsForSave` writes `smrQuarters` onto the
row-14 entry as `quarters`, whatever the Y/N/NA answer. This differs from
water's "no stranded text" rule deliberately: an unticked "Others" beside
free text contradicts the boxes, but "Q1, Q2 ticked, answer N" is a
coherent record — it says which quarters were submitted and that the
obligation was not met. `airChecklistsFromRecord` reads `quarters` back
from that entry (filtered to `SMR_QUARTERS`, order preserved), defaulting
to `[]`.

## 4. Testing

TDD throughout; each file below is written red first.

- `airChecklistData.test.ts` — group sizes 11/12/14/13/2; keys unique
  across all five lists; `SMR_QUARTER_KEY` present in the DAO 2004-26
  list; every entry has non-empty `group` and `requirement`.
- `checklistEntries.test.ts` — round-trip save → load; key-matched read
  survives a reordered list; unknown keys dropped; `legal_ref` composition
  with and without `ref`. Water's existing `summaryOfFindings.test.tsx`
  keeps passing unchanged, proving the delegation.
- `airTypes.test.ts` — `emptyAirComplianceForm` sizes; five-way save/load
  round-trip; quarters preserved on N; quarters filtered to the four
  known values; `ptoConditionsForSave` drops blank rows and snake_cases;
  `describeSmrQuarters`.
- `src/db/migrations.test.ts` — extended for v16 the way v13–15 are.
- Any existing test asserting the `compliance_air` field map or schema
  column list is updated rather than loosened.
- `npm run typecheck`, `npm run lint`, `npm test` all green before the
  branch is offered for review.

There is no UI to exercise in the preview, so no browser verification.

## Out of scope

- The air form screen, edit sections, tabs and routing; `ENABLED_TYPES`.
- The air export mapper and tagging Tables 6–8 in
  `assets/templates/recipes/air.json` (lives on `feat/export-reports`).
- Any change to water's stored shapes or the water form.
- Renaming the three existing checklist columns.
