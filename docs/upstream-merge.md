# Upstream Merge Guide

How the EMB4B repo (this one) and a sibling region repo (EMB4A, CALABARZON) share code.

## 1. The two repos

EMB4B (`emb4b/InspectPlus`) is the upstream. The EMB4A repo has a remote named `upstream` pointing at it (on a fresh clone: `git remote add upstream https://github.com/emb4b/InspectPlus.git`). `develop` is 4B's integration branch, so 4A merges `upstream/develop`. Foundation fixes always start in 4B and reach 4A by merge.

## 2. Foundation vs region

**Foundation** (owned by 4B, merged into 4A as-is): everything outside `src/region/`, the `_core_` migrations in `supabase/migrations/`, `scripts/`, and the CI workflows in `.github/workflows/`.

**Region** (owned by each region repo, never merged across): `src/region/**` (including the identity: system name, copyright line, `regionLabel` and `releaseRepo`), the `_region_` migrations, `assets/templates/**`, `assets/icons/**`, `app.json`, `eas.json`, `.env*`, and `supabase/seeds/**`.

A region repo never edits foundation files. If it needs a foundation change, make it in 4B first and merge it down.

## 3. Entry points and the contract

Foundation code reaches region code only through three entry points:

| Import | Kind | Provides |
| --- | --- | --- |
| `src/region` | light | identity, locations, catalog, templates, compliance view types, `DOCUMENTS_REVIEWED_OPTIONS` |
| `src/region/db` | leaf | tables, models, migrations, sync entities/DTOs/parent dependencies, `regionCollectionsFor` |
| `src/region/modules` | heavy | `reportDataModules` (`loadCompliance`, `ComplianceView`, `detailTabs`, `renderDetailTab`, `permitsInDetailTabs`, `mapExport`), `reportForms`, `mapSurveyBundle` |

The shape each entry point must have is `src/core/region/contract.ts`. `src/core/region/assertRegion.ts` checks the region against it at compile time, so contract drift makes `tsc` fail. `src/core/region/` is foundation and may be imported anywhere.

The ESLint boundary rule forbids importing anything under `**/region/**` except `region/db`, `region/modules` and `core/region/**`. It checks only `import` and `export ... from`; `require()` and `jest.mock()` paths are not checked, so keep those honest by hand.

`src/region/modules` is heavy (it pulls in forms and screens), so only these foundation hosts import it: `src/app/(app)/inspection/new.tsx`, `AddReportSplitPanel`, `InspectionReportDetailScreen`, `ComplianceStatusView`, `loadInspectionReportDetail`, and `src/features/export/mappers/index.ts`. A test that imports one of these hosts needs `jest.mock`s for `src/db/database` and the Supabase client (see `src/region/__tests__/modules.test.ts`).

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

Contract drift shows up at `typecheck`: update 4A's `src/region` to the new contract. `src/db/__tests__/schemaSnapshot.test.ts` and `src/services/sync/syncRegistry.test.ts` pin the assembled schema and sync registry; these are among the foundation tests listed in §7 that currently pin 4B data.

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
- Several foundation tests still pin 4B region data: `src/constants/reportTypes.test.ts`, `src/constants/reportTypeDisplay.test.ts`, `src/features/export/templates/index.test.ts`, `src/features/export/signatories.test.ts`, `src/db/__tests__/schemaSnapshot.test.ts`, `src/services/sync/syncRegistry.test.ts` and `src/features/home/components/SpeedDial.test.tsx`. They are scheduled to move into `src/region/__tests__` before the Phase 1 fork; until then a 4A merge will see them fail, and the fix is to move them, not to edit them in place.
- The export render and contract tests (`src/features/export/render/*.test.ts`) and their fixtures (`src/features/export/mappers/fixtures.ts`) exercise 4B's templates with 4B sample data. A region that replaces the templates replaces those fixtures and expected tags in the same change.
- Some foundation pieces are shaped to 4B's printed forms and need to become pluggable for 4A: `src/constants/denrPermits.ts` (omits LLDA clearances) and `src/features/export/mappers/common.ts` (`VERIFY_ITEMS`, `PERMIT_ROWS`/`PERMIT_MATCHERS`, the hwms documents row).
