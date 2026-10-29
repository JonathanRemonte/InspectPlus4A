# InspectPlus EMB4A — Phase 1a: bootstrap the 4A app

Status: approved design. Implements the first half of Phase 1 of
[`2026-10-27-emb4a-region-split-design.md`](2026-10-27-emb4a-region-split-design.md);
the dockerized self-host kit and per-target build profiles are Phase 1b,
specified separately.

## Purpose

Phase 0 (PRs #4 and #5) left EMB4B with every region-specific piece under
`src/region/` and region-owned migrations, behind a typed contract. Phase 1a
uses that boundary to stand up InspectPlus EMB4A as its own app: a fork of the
4B repository that replaces only region content, syncs with its own backend,
and ships through its own release pipeline. No 4A report forms yet — those are
Phase 3.

## Decisions

| Topic | Decision |
|---|---|
| Repository | `JonathanRemonte/InspectPlus4A` (public), local folder `D:\Projects\InspectPlus (EMB4A)`; `upstream` is `emb4b/InspectPlus` |
| Branches | `develop` (integration, pre-release APKs) and `main` (releases), as in 4B |
| Identity | Android package and iOS bundle id `com.inspectplus.emb4a`; app name **InspectPlus EMB4A**; slug `inspectplus-emb4a`; scheme `inspectplus4a`; version restarts at `1.0.0` |
| Icon | 4B's icon with a "4A" badge, generated with `scripts/generate_app_icon.py` |
| Dev backend | Hosted Supabase project `fdhobiaeqoyqbywddeed` (free tier), built only from migrations; 4B keeps its local Docker stack |
| Client keys | Project URL and publishable key in 4A's git-ignored `.env` and in EAS environment variables — never in tracked files (both repos are public) |
| Releases | 4A's own EAS project and GitHub Releases, same pipeline as 4B |
| Hosting | Undecided (EMB4A on-prem or VPS); portability first — Phase 1b |

## 1. Order of work

1. **4B foundation PR — region-neutral location scripts.** The boundary
   builder (`scripts/build-barangay-boundaries.js`, with
   `scripts/barangayNameMatch.js`) has MIMAROPA hard-coded, and
   `src/region/data/mimaropaLocations.ts` was built once by hand from the
   isaacdarcilla PSGC dataset with no script in the repo. The PR:
   - gives the boundary builder a region definition input (province names,
     their source PSGC codes, the output path);
   - adds `scripts/build-locations.js`, which builds a region's
     province → city/municipality → barangay table from the same pinned PSGC
     dataset and the same region definition;
   - adds 4B's region definition and regenerates 4B's data through both
     scripts. The boundary bundle must be byte-identical to today's; the
     locations table must hold exactly the same provinces, cities and barangays
     (deep-equal — formatting may differ), and the existing script tests keep
     passing.

   This is the only 4B change; 4A must not edit foundation files
   (`docs/upstream-merge.md` §2).
2. **Fork.** Clone 4B `develop` (after the PR above merges), push its full
   history to `JonathanRemonte/InspectPlus4A` as `develop`, and create `main`
   from it. Add `upstream`. History is kept so foundation fixes merge with a
   shared ancestor; GitHub's fork button is not usable (the repository already
   exists) and a history-less copy would break upstream merges.
3. **4A region work**, only in region-owned paths (§2 below), on a 4A
   branch merged to 4A `develop` by pull request.

## 2. 4A region content

| Area | Content |
|---|---|
| `src/region/identity.ts` | id `emb4a`; system name `EMB4A INSPECTION & MONITORING SYSTEM`; region label `EMB Region 4-A`; copyright line naming Region 4-A; `releaseRepo: 'JonathanRemonte/InspectPlus4A'` |
| `src/region/locations.ts` + `data/` | CALABARZON — Cavite, Laguna, Batangas, Rizal, Quezon — cities/municipalities and barangays plus barangay boundary polygons, built with the generalized scripts from the same pinned sources 4B uses; map overview framing all five provinces; outside-boundary label naming CALABARZON |
| `src/region/catalog.ts` | Empty: no create entries, no display entries, no compliance tags, no compliance collections. Types (`ReportTypeKey`, `ReportDataKey`, `ComplianceTag`) are `never`-based so the contract still typechecks |
| `src/region/templates.ts` | No templates; fallback approvers are blank strings until 4A's signatories are configured |
| `src/region/modules` | `reportDataModules = {}`, `reportForms = {}`, no `mapSurveyBundle` |
| `src/region/complianceViews.ts` | No views (`RegionComplianceView` is `never`) |
| `src/region/db` | `schemaVersion: 1`, no region tables, an empty migration list (`maxVersion` 1), no region sync entities or parent dependencies. 4A devices never held 4B's local database, so 4B's 16 local steps are not carried; future foundation steps are added at 4A's next version |
| Region tests | 4A's own: identity, CALABARZON locations (five provinces, boundaries load), empty catalog and modules, schema/sync snapshots. 4B's region tests and snapshots are removed from the 4A repo |
| `assets/` | 4B's `.docx` templates and their recipes/tag docs removed; icons replaced with the badged set |
| `app.json`, `eas.json` | identity values above; new EAS project id; build profiles unchanged in shape |
| `supabase/seeds/` | 4B's dev seeds (real 4B staff) replaced with test-only 4A accounts |

Foundation code is untouched. If any of the above turns out to need a
foundation change, that change is made in 4B first and merged downstream.

## 3. Server database

- 4A inherits every 4B migration through the fork, then adds
  `<timestamp>_region_emb4a_bootstrap.sql`, which:
  - deletes the four `compliance_*` rows from `public.sync_tables`, then drops
    their `push_`/`pull_` handlers, then drops the tables — the order
    `docs/upstream-merge.md` §6 requires;
  - drops `inspection_reports_report_type_check` (it lists 4B's types; Phase 3
    adds 4A's).
- Applied to the hosted project with `supabase link --project-ref
  fdhobiaeqoyqbywddeed` and `supabase db push`. The project's database password
  is entered by the developer at the prompt and is never stored in the repo.
- 4A's pgTAP suite is the inherited one minus the tests for the dropped
  compliance tables, plus a test that the registry holds only the five
  foundation tables.

## 4. Test accounts

- Local seeds (`supabase/seeds/dev/`) create `inspector1@emb4a.test`
  (Inspector, all five CALABARZON provinces) and one developer account.
- The hosted project gets the same two accounts through a SQL script the
  developer runs once in the Supabase SQL editor; passwords are chosen then and
  never committed.

## 5. Releases and CI

- New EAS project under the developer's Expo account (`eas init`, interactive).
- EAS environment variables `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the `preview` and `production` profiles
  point at the hosted dev project until Phase 1b introduces per-target
  profiles. The app reads the publishable key through the existing
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` variable, as 4B does.
- `EXPO_TOKEN` added to the 4A repository's GitHub secrets by the developer.
- The inherited workflows run unchanged: lint/typecheck, tests, database tests,
  and `ci/eas-build`, which publishes pre-release APKs from `develop` and full
  releases from `main` to 4A's GitHub Releases.

## Done when

- 4B's location-script PR is merged and 4B's data is byte-identical.
- 4A's CI is green, including `ci/supabase-db-tests`.
- On a phone with both apps installed side by side, a 4A test inspector logs
  in, adds a CALABARZON establishment (map picker resolves a CALABARZON
  barangay), and syncs; the row is visible in the hosted project.
- A `develop` push publishes a 4A pre-release APK that opens and reaches the
  hosted backend.

## Developer actions

Each once, and not delegable: `eas login` / `eas init`; adding `EXPO_TOKEN` to
the 4A repository; `supabase login` and the database password at
`supabase link`; running the account script and choosing passwords.

## Out of scope

The self-host kit, deployment targets and build profiles (Phase 1b); the
approval workflow, signatures and waste-class catalog (Phase 2); 4A's report
forms, templates and memos (Phase 3).
