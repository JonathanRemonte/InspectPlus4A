# Upstream Merge Guide

How the EMB4B repo (this one) and a sibling region repo (EMB4A, CALABARZON) share code.

## 1. The two repos

EMB4B (`emb4b/InspectPlus`) is the upstream. The EMB4A repo has a remote named `upstream` pointing at it (on a fresh clone: `git remote add upstream https://github.com/emb4b/InspectPlus.git`). `develop` is 4B's integration branch, so 4A merges `upstream/develop`. Foundation fixes always start in 4B and reach 4A by merge.

## 2. Foundation vs region

**Foundation** (owned by 4B, merged into 4A as-is): everything outside `src/region/`, the `_core_` migrations in `supabase/migrations/`, `scripts/`, and the CI workflows in `.github/workflows/`.

**Region** (owned by each region repo, never merged across): `src/region/**` (including the identity: system name, copyright line, `regionLabel` and `releaseRepo`), the `_region_` migrations, `assets/templates/**`, `assets/icons/**`, `app.json`, `eas.json`, `.env*`, and `supabase/seeds/**`. Also region-owned:

- `src/region/data/psgcSources.json` (the region definition the location scripts read);
- database tests named `supabase/tests/**/region_*.sql`;
- in the native Android project, only these lines: `applicationId` in `android/app/build.gradle`, `app_name` in `android/app/src/main/res/values/strings.xml`, the app scheme (`<data android:scheme="..."/>` after the `VIEW` intent) in `android/app/src/main/AndroidManifest.xml`, and the launcher icons under `android/app/src/main/res/mipmap-*`.

A region repo never edits foundation files. If it needs a foundation change, make it in 4B first and merge it down.

## 3. Entry points and the contract

Foundation code reaches region code only through three entry points:

| Import | Kind | Provides |
| --- | --- | --- |
| `src/region` | light | identity, locations, catalog, templates, compliance view types, `DOCUMENTS_REVIEWED_OPTIONS` |
| `src/region/db` | leaf | tables, models, migrations, sync entities/DTOs/parent dependencies, `regionCollectionsFor` |
| `src/region/modules` | heavy | `reportDataModules` (`loadCompliance`, `ComplianceView`, `detailTabs`, `renderDetailTab`, `permitsInDetailTabs`, `mapExport`), `reportForms`, `mapSurveyBundle` |

The shape each entry point must have is `src/core/region/contract.ts`. `src/core/region/assertRegion.ts` checks the region against it at compile time, so contract drift makes `tsc` fail. `src/core/region/` is foundation, but `lookup.ts` there is heavy (it imports `src/region/modules`, so it pulls in forms, screens and the DB) despite its location; the rest of `src/core/region/` is light.

The ESLint boundary rule forbids importing anything under `**/region/**` except `region/db`, `region/modules` and `core/region/**`. It checks only `import` and `export ... from`; `require()` and `jest.mock()` paths are not checked, so keep those honest by hand.

`src/region/modules` is heavy (it pulls in forms and screens), so only two foundation files import it: `src/core/region/lookup.ts` (`reportDataModuleFor`, `reportFormFor`) and `src/features/export/mappers/index.ts` (which imports `mapSurveyBundle` directly). The host screens reach the modules through `lookup.ts`: `src/app/(app)/inspection/new.tsx`, `AddReportSplitPanel`, `InspectionReportDetailScreen`, `ComplianceStatusView` and `loadInspectionReportDetail` (plus `mappers/index.ts` for `reportDataModuleFor`). Importing any of these pulls in `lookup.ts`, so the same test mocks apply. A test that imports `lookup.ts` or one of these hosts needs `jest.mock`s for `src/db/database` and the Supabase client (see `src/region/__tests__/modules.test.ts`).

Keep 4A's `never`-keyed catalog typechecking: foundation looks up region registries by the stored string through `reportDataModuleFor` / `reportFormFor` and the widened maps (`REPORT_TYPE_DISPLAY`, `COMPLIANCE_COLLECTIONS`), never by indexing into a region-typed record with `x as ReportDataKey`. With an empty catalog `ReportDataKey` is `never`, and such an index stops compiling.

## 4. Merging upstream into 4A

```
git fetch upstream && git merge upstream/develop
npm ci
npm run typecheck
npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0
npx jest --ci
npx supabase db reset && npx supabase test db
```

`supabase db reset` needs a running local stack (`npx supabase start`, which needs Docker).

Contract drift shows up at `typecheck`: update 4A's `src/region` to the new contract. The region's own tests pin its exact schema and sync registry (`src/region/__tests__/schemaSnapshot.test.ts`, `syncRegistry.test.ts`); 4A keeps its own versions of those. The foundation's tests (`src/db/__tests__/schema.test.ts`, `src/services/sync/syncSchema.test.ts`) check only region-neutral rules and must pass unchanged in both repos.

**Regenerating location data.** Run `node scripts/build-locations.js` then `node scripts/build-barangay-boundaries.js`; both read `src/region/data/psgcSources.json`. The boundary builder refuses to write until every polygon and every barangay match, so new aliases or extra barangays go in the region definition. `excludedBarangays` drops a 2021 address-dataset barangay that the PSGC 2023 boundaries no longer have (a merge or dissolution), each with a `note`; pair it with an `extraBarangays` entry when the barangay was renamed or merged into a new name.

## 5. WatermelonDB versions

The schema version (`regionDb.schemaVersion`, currently 16) and the migration list (`src/region/db/migrations.ts`) are region-owned. When a foundation change touches a core table, 4B bumps its version and adds the step to its own `src/region/db/migrations.ts`. The 4A merge must append the same step to 4A's list at 4A's next version. `src/db/migrationGuard.ts` crashes the app at launch if the version and the migration list disagree. Never ship a release in that state.

## 6. Server sync registry

Sync is driven by `public.sync_tables` (see [`sync-contract.md`](sync-contract.md#server-registry)). A new region table needs a `_region_` migration that adds `push_<table>` and `pull_<table>` handlers and a `sync_tables` row with `owner = 'region'` and a `sync_order` in the region band 100-899. Never redefine `push_changes` or `pull_changes` in a region.

To remove a region table, delete its `sync_tables` row first, then drop its `push_`/`pull_` handlers, then drop the table. `regproc` columns create no dependency, so a dangling row (handler dropped, row left) breaks every push and pull.

`inspection_reports.report_type` has a check constraint listing 4B's values. A region redefines it in a `_region_` migration:

```sql
alter table public.inspection_reports
  drop constraint inspection_reports_report_type_check,
  add constraint inspection_reports_report_type_check
    check (report_type in (...));
```

## 7. Known Phase 0 limits

- `purpose_of_inspection` and `survey_reports` (tables, models, sync, UI) are still foundation; they become pluggable in Phase 2. Until then 4A keeps the `survey_reports` table empty and leaves `survey` out of its catalog.
- Tests that pin 4B data live in `src/region/__tests__` and are region-owned: the catalog and display pins (`reportTypes`, `reportTypeDisplay`, `catalog`), the approver and signatory defaults (`templates`, `signatories`), the schema and sync-registry snapshots, and the export template contract and render tests (`templateContract`, `renderTemplates`). 4A replaces them with its own.
- The shared export fixtures and the tests that use them carry 4B sample data, so they are region-owned too: `src/region/export/fixtures.ts` and `src/region/__tests__/export/{common,index,exportReports}.test.ts` (moved from `src/features/export`). They still exercise the foundation's shared export block (`mapCommon`, `mapBundle`, `exportReports`); 4A drops them with the rest of 4B's region tests and writes its own when its forms land.
- Some foundation pieces are shaped to 4B's printed forms and need to become pluggable for 4A: `src/constants/denrPermits.ts` (omits LLDA clearances) and `src/features/export/mappers/common.ts` (`VERIFY_ITEMS`, `PERMIT_ROWS`/`PERMIT_MATCHERS`, the hwms documents row).
