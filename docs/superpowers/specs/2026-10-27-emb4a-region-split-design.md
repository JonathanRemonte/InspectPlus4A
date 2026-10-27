# InspectPlus EMB4A (CALABARZON) and the foundation/region split

Status: approved design (umbrella). Each phase below gets its own spec →
plan → implementation cycle; this document fixes the decisions they share.

## Purpose

EMB Region IV-A (CALABARZON) needs its own InspectPlus, built on the same
foundation as the EMB4B (MIMAROPA) app, for its Chemicals and Hazardous
Waste Management Section (CHWMS) first, with other 4A sections later. Both
apps are developed at equal priority, and a fix to the shared foundation
must reach both without re-implementation.

## Decisions

| Topic | Decision |
|---|---|
| Apps | Two separate apps, two repositories. No in-app region picker. |
| Code sharing | Structured fork: 4B (`emb4b/InspectPlus`) is `upstream`; the 4A repo merges foundation changes from it. |
| 4A repo | `D:\Projects\InspectPlus (EMB4A)`, forked from 4B's history; hosted on the developer's personal GitHub account for now, transferable later. |
| 4A scope | CHWMS first (RA 6969 forms, TRC, TSD, PDSF); other 4A sections later as they send templates. |
| Backend | Separate Supabase project per region. |
| Access | Same as 4B: province/municipality assignment; developer/admin see all. |
| Signatories | In-app review/approval with pre-configured e-signatures, built in the foundation for both regions; mobile queue first, web dashboard later. |
| Workflow actions | Online-only (submit, review, recommend, approve, return). Drafting stays offline-first. |
| Memos | TRC/TSD cover memos are an optional toggle on export, filled from the report. |
| PDSF | In the first 4A release; the inspector records both Form A and Form B. |
| Establishments | Bulk import of CHWMS's existing list, then in-app creation as in 4B. |
| Control numbers | Issued by Records, not the app: a validated text field; format set per region. |

## 1. EMB4A template analysis

Source: `Downloads/Inspection Report Templates (EMB4A)/` — 12 blank
templates (`TEMPLATE/`) and 8 filled samples (`SAMPLE/`, PDF).

The 13 template files are **five distinct forms**:

| Form | Template files | Content |
|---|---|---|
| RA 6969 Monitoring/Survey (FO-CHWM-01) | HWG Monitoring, HWG Survey, HC Monitoring, Toxic Chem Monitoring, Toxic Chem Survey | Module 0 general information; Purpose (Survey/Monitoring; Title II Chemicals: PICCS, PMPIN, PCL, CCO; Title III HW: Generator, Transporter, TSD; EcoWatch, PEPP, PAB, Others); generator ID + HW-generated table (waste, class no., tons); HWMO5 generator checklist (71 Y/N/N-A rows + remarks); other observations; remarks and recommendations; documents reviewed; four signatories. |
| TRC renewal report (HWMO2) | TRC Inspection Report | Module 0; purpose (amendment/renewal); TRC number; vehicle table (conveyance, plate no., net capacity MT, owned/leased); transporter checklist; photos of conveyances by plate no. and of the holding area (garage); remarks; documents reviewed; signatories. |
| TSD renewal report | TSD Renewal Inspection Report | General information (HWMS application no., TSD registration no., PCO); treatment table (method A–F, PTO/discharge permit no. and validity, capacity MT/day, waste types); TSD checklist; process description per waste type; residual waste management; findings; numbered figures; recommendations; documents reviewed; signatories. |
| Cover memos | TRC Memo, TSD Memo (blank + filled draft each) | Memo to the EMB Director through the Chief, EQD; boilerplate paragraphs filled with company, inspection date, HWMS application no., address, and the vehicle table (TRC) or category/treatment/waste table (TSD). |
| PDSF (FO-CHWM-14, .xlsx) | PDSF | Sheet "LGU" — Form A, LGU Monthly Report; sheet "Regional Accomplishment" — Form B, Status of the PDSF (equipment, physical condition, photographs, validity, monitoring and validation team, recommending/approving signatories). Subject is an LGU facility, not an establishment. |

Further findings:

- Within the RA 6969 group the five files differ only in which Purpose box
  is ticked and in the printed approver name. The two Toxic Chem files are
  byte-identical, and the signed Toxic Chem sample uses the hazardous-waste
  checklist — so the shared body is how CHWMS works today, not a template
  error.
- "With NOV" samples are the same forms with a Notice of Violation
  recommendation in Remarks; NOV is not a separate document.
- 4A has none of 4B's Water, Air, EIA or Survey forms. 4B's Hazardous Waste
  Generators form shares DAO 2013-22 content with HWMO5 but not its layout
  (84 checklist rows vs 71; 4B adds registration, category and quarterly
  report items).
- Region-specific print content: CALABARZON letterhead and PITX office
  footer; control number `R4A-YYYY-NNNNNN`; signatory chain Chief/OIC CHWMS
  → Chief EMED → Regional Director / OIC Regional Director.

## 2. Repository layout: the foundation/region split

Before the fork, 4B is restructured so every file is either foundation
(identical in both apps, edited only in 4B and merged downstream) or region
(owned by each app).

| Foundation | Region |
|---|---|
| `src/foundation/`: auth, sync engine, WatermelonDB core models (establishments, inspection reports, attachments, approvals), export render engines (docx, xlsx), location engine, UI kit and form primitives, `ChecklistSection`, approval workflow, DAO 2013-22 waste-class catalog | `src/region/`: `region.config.ts` (app name, letterhead data, control-number format, default signatories, approval chain, map bounds), location data, report-type catalog, form screens, checklist data, export mappers, compliance models, purpose-of-inspection model |
| Core Supabase migrations (`*_core_*.sql`) | Region Supabase migrations (`*_region_*.sql`), seeds, RLS tests for region tables |
| `scripts/docx-tag.js`, `scripts/docx-grid.js`, CI job templates | `assets/templates/`, icons, `app.json`, `eas.json`, `.env` |

Three known conflict points and their fixes:

1. **WatermelonDB schema and migrations.** `schema.ts` becomes
   `[...coreTables, ...regionTables]`; the schema version and migration
   list are region-owned. A foundation change exports its migration step
   as a named constant that each app appends to its own list.
   `migrationGuard` already fails loudly when a step is missing.
2. **Supabase `pull_changes` / `push_changes`.** They currently name every
   table, so a core migration redefining them would drop the other app's
   tables. They are refactored to iterate a `sync_tables` registry; core
   migrations register core tables, region migrations register region
   tables.
3. **Report-type registry.** `REPORT_TYPES`, `ENABLED_TYPES` and the
   per-type routes move into `src/region/`; foundation screens read the
   catalog through one interface instead of importing constants.

The 4A repo is created from 4B's history so merges share ancestry:
`origin` is the 4A GitHub repo, `upstream` is `emb4b/InspectPlus`. 4A
replaces the region content with CALABARZON's and gets its own
`android.package` (a distinct package, not `applicationIdSuffix`, which
breaks `expo run:android`), app name, icon, EAS project and Supabase
project. `docs/upstream-merge.md` records the merge routine; foundation
fixes always start in 4B.

## 3. EMB4A report catalog and data model

| Key | Display name | Form | Record |
|---|---|---|---|
| `hwg` | Hazardous Waste Generator | RA 6969 Monitoring/Survey | `compliance_ra6969` |
| `toxic_chem` | Toxic Chemicals | RA 6969 Monitoring/Survey | `compliance_ra6969` |
| `hc` | Health Care Waste | RA 6969 Monitoring/Survey | `compliance_ra6969` |
| `trc` | Transporter Registration (Renewal) | HWMO2 | `compliance_trc` |
| `tsd` | TSD Facility (Renewal) | TSD checklist | `compliance_tsd` |
| `pdsf` | PDSF | Form A + Form B | `pdsf_reports` |

- **RA 6969 types** are separate in lists, filters and the speed dial but
  share one form, one table and one template. Survey vs Monitoring is a
  field. Each type pre-ticks its Purpose boxes (HWG and HC → Title III
  Generator; Toxic Chem → Title II); the inspector can change them.
- **HW-generated table** rows (waste, class no., quantity in tons) pick
  from the DAO 2013-22 waste-class catalog in the foundation, which 4B's
  Hazardous Waste form will reuse.
- **Checklists** (HWMO5, HWMO2, TSD) are `ChecklistItemDef` data files
  rendered by a shared `ChecklistSection` and stored as `FindingsEntry[]`
  JSON, the pattern 4B's water checklists already use.
- **TRC** adds a vehicle table and attachments tagged *conveyance* (with
  plate no.) or *holding area*.
- **TSD** adds the treatment table, process description, residual waste
  management, and numbered figures from attachments.
- **Purpose of Inspection** is region-owned. 4A: Survey/Monitoring, Title
  II items (PICCS, PMPIN, PCL, CCO), Title III items (Generator,
  Transporter, TSD), EcoWatch, PEPP, PAB, Others; TRC uses
  New/Amendment/Renewal.
- **Memos.** The TRC and TSD export sheets offer "Include cover memo",
  which fills the memo template from the report. The HWMS application no.
  is stored on the report.
- **PDSF** introduces a second subject kind, `lgu_facilities` (LGU,
  province, municipality, coordinates, contact person). A PDSF report holds
  Form A and Form B and exports to the .xlsx template through a foundation
  xlsx fill engine.
- **Location data**: CALABARZON provinces (Cavite, Laguna, Batangas,
  Rizal, Quezon), municipalities, barangays and boundaries, generated with
  the scripts that produced MIMAROPA's. No waterbody list.

## 4. Approval workflow and e-signatures (foundation)

States: `draft → submitted → reviewed → recommended → approved`. Any
reviewer can **return** with a required comment, moving the report to
`returned`, which the inspector can edit and resubmit.

- One RPC, `act_on_report(report_id, action, comment)`, enforces the
  state machine, the acting user's assignment and the lock. Actions are
  online-only.
- The chain comes from region config, plus an `approval_assignees` table
  naming the user for each step. 4A: Reviewed by (Chief/OIC CHWMS) →
  Recommending Approval (Chief EMED) → Approved by (RD/OIC RD). 4B sets its
  own chain and may leave the feature switched off.
- A submitted report is locked for its inspector. Every action writes a
  `report_approvals` row: step, user, action, timestamp, comment, and
  snapshots of name, position and signature version — later changes (for
  example "OIC, Regional Director" → "Regional Director") never alter a
  signed report.
- Signatures are transparent PNGs, uploaded by an admin for every
  signatory (inspectors included, for "Prepared by"), stored in a private
  `signatures` bucket. A signature is applied only by its owner's own
  action.
- Export: approved reports print signature image, name, position and date
  in each slot through the docx image pass; unapproved reports export with
  names only and a visible DRAFT marker.
- Mobile UI: a "For my action" queue on Home with a count badge, a
  read-only review screen with Approve/Return, and an approval timeline on
  every report. A web dashboard follows later on the same RPCs.
- Accepted trade-off: exporting an approved report downloads the
  approvers' signature images to the exporting device. Downloads use
  short-lived signed URLs, issued only for approval rows the user can
  already read. Server-side rendering of final documents would avoid this
  and is the upgrade path if required.

## 5. Backend, access and import (EMB4A)

- New Supabase project with its own URL, keys and buckets (`attachments`,
  `signatures`). 4A inherits 4B's migrations up to the fork; after the
  registry refactor, a 4A region migration drops the 4B-only tables
  (`compliance_water`, `compliance_air`, `compliance_eia`,
  `survey_reports`) and creates 4A's (`compliance_ra6969`,
  `compliance_trc`, `compliance_tsd`, `lgu_facilities`, `pdsf_reports`).
  Core migrations arrive by upstream merge in timestamp order.
- Access matches 4B: assignment to CALABARZON provinces/municipalities
  scopes establishments and LGU facilities; developer/admin see all.
  Approvers are `approval_assignees` rows, not new roles, so an OIC
  substitution is a one-row change. Every new table gets RLS tests in
  `supabase/tests/rls/`.
- Import: an `import-establishments` script (CSV → dry-run report →
  upsert, deduplicated by normalized name and address) and a matching LGU
  facility import. The CHWMS list format is to be supplied before that
  step.
- Accounts and signatures are provisioned by admin scripts extending
  `supabase/scripts/create_user_account.sql`.
- Control number: a text field validated against the region's format
  (`R4A-YYYY-NNNNNN` for 4A).

## 6. Phasing

| Phase | Repo | Delivers | Done when |
|---|---|---|---|
| 0. Split | 4B | Foundation/region restructure; `sync_tables` registry RPCs; schema assembled from core + region tables; `docs/upstream-merge.md` | 4B unchanged in behavior: lint, typecheck, jest and RLS tests green; device smoke test without a local DB reset |
| 1. Bootstrap 4A | 4A | Fork with `upstream`; package id, name, icon, EAS project; Supabase project; CALABARZON location data; region config | A 4A test inspector logs in, adds an establishment, syncs it to the 4A backend; both apps installed side by side |
| 2. Foundation features | 4B → merged into 4A | Approval workflow, RPC and queue UI; signatures and signed export; waste-class catalog; `ChecklistSection`; xlsx fill engine | State-machine and RLS tests pass; a report goes draft → approved with signatures in both apps |
| 3. 4A forms | 4A | RA 6969 form (HWG/Toxic Chem/HC) and export → TRC + memo → TSD + memo → PDSF → establishment and LGU import | Each template has a contract test; exports match the sample PDFs field for field |
| 4. Later | both | Web review dashboard; further 4A sections | — |

Phases 0, 1 and 2 are sequential. Phase 3 starts on the RA 6969 form once
Phase 1 lands and adopts the approval workflow when Phase 2 merges in. 4B's
own roadmap (Air export, EIA, Hazardous Waste form) continues in
`src/region/` in parallel.

## Testing

Existing patterns apply in both repos: Jest unit tests for mappers,
checklist data and state transitions; `templateContract.test.ts` for every
template; SQL RLS tests for every table and the approval RPC; a device
check at the end of each phase.

## Open inputs

- CHWMS's establishment and LGU facility list (format and source) — needed
  for the import step in Phase 3.
- Signature PNGs and the approver roster for each region — needed to
  finish Phase 2.
