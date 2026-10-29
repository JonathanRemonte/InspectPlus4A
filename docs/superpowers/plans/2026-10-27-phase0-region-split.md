# Phase 0 — Foundation/Region Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure EMB4B InspectPlus so every 4B-specific piece of knowledge lives under `src/region/` (plus region-owned SQL migrations), behind a typed contract, with zero behavior change — so the EMB4A fork (Phase 1) can replace region content without editing foundation files.

**Architecture:** Foundation is *everything outside `src/region/`*. Foundation reaches region code only through three entry points: `src/region` (light data: identity, locations, report-type catalog, template registry, view types), `src/region/db` (a leaf: WatermelonDB tables, models, migrations, sync entities — safe for `src/db` to import without a cycle) and `src/region/modules` (heavy per-type UI and logic: compliance loaders and views, detail tabs, form screens, export mappers). An ESLint rule enforces the boundary and `src/core/region/assertRegion.ts` makes `tsc` fail when a region's entry points drift from `src/core/region/contract.ts`. Old foundation paths (`src/constants/reportTypes.ts`, `reportTypeDisplay.ts`, `provinces.ts`, `src/features/export/templates/index.ts`) stay as thin facades over the region so their many importers and test mocks don't change. On the server, `push_changes`/`pull_changes` become dispatchers over a `sync_tables` registry of per-table handler functions, so a region can add or change its tables without redefining a shared function.

**Tech Stack:** Expo 55 / React Native 0.83, TypeScript 5.8, WatermelonDB 0.28, Jest (jest-expo), ESLint 8.57 (`eslint-config-expo`), Supabase Postgres + pgTAP (`supabase test db`).

**Spec:** `docs/superpowers/specs/2026-10-27-emb4a-region-split-design.md` (Section 2 and Phase 0 row of Section 6), amended alongside this plan with the decisions taken while planning (listed under Global Constraints).

## Global Constraints

- **Zero behavior change.** 4B must look and behave exactly as before. WatermelonDB schema version stays **16**; no new local migration steps. Push/pull payloads and responses are byte-for-byte the same shape.
- **Boundary rule:** files outside `src/region/` may import region code only via `src/region`, `src/region/db` or `src/region/modules` (ESLint group `['**/region/**', '!**/region/db', '!**/region/modules']`). Region files may import anything.
- **No folder move of foundation code** (decided 2026-10-27, replaces the spec's `src/foundation/`): foundation stays at its current paths.
- **Stays foundation in Phase 0:** `establishments`, `inspection_reports`, `purpose_of_inspection`, `survey_reports`, `attachments` (tables, models, sync, UI). Making purpose-of-inspection and non-establishment kinds (survey, PDSF) pluggable moves to Phase 2. **Region-owned in Phase 0:** the four `compliance_*` tables and everything type-specific listed in the tasks.
- **Region SQL:** migration file names carry `_core_` or `_region_` after the timestamp (`<14-digit timestamp>_core_<name>.sql`). New migrations in this plan use timestamps `20261028090000`–`20261028090200`.
- **Moves use `node scripts/move-module.js <from> <to>`** (Task 1) so imports are rewritten in one pass; never hand-edit paths after a `git mv`.
- **Commands:** tests `npx jest --ci --no-watchman <paths>`; lint `npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0`; types `npm run typecheck`; SQL `npx supabase start && npx supabase db reset && npx supabase test db` (needs Docker Desktop running; CI runs the same in `.github/workflows/supabase-db.yml`).
- **Commits:** Conventional Commits with an allowed scope (Task 1 adds `region`). Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook runs `npm test`; if Watchman cannot start in the executing shell, run `npx jest --ci --no-watchman` yourself, and ask the user before committing with `--no-verify`.
- **Branch:** `refactor/region-split` off `docs/emb4a-region-split-design` (which is `develop` plus the spec and this plan). Never check out a branch with a lower WatermelonDB schema version while Metro serves a connected device (the device store resets).

## File Structure

```
src/core/region/
  contract.ts          types the foundation requires from a region (grows per task)
  assertRegion.ts      compile-time check: region entry points satisfy the contract
src/region/
  index.ts             light entry point (identity, locations, catalog, templates, view types)
  identity.ts          app strings (system name, footer)
  locations.ts         provinces/cities/barangays, map overview, boundary loader
  catalog.ts           create entries, display vocabulary, compliance tags
  templates.ts         docx template registry + default approvers
  complianceViews.ts   Water/Hazwaste/Air/Eia compliance view types
  data/                mimaropaLocations.ts, mimaropaBoundaries.json, mimaropaWaterbodies.ts, waterbodies.ts
  db/                  index.ts (leaf entry), tables.ts, sync.ts, migrations.ts, models/Compliance*.ts
  compliance/          loaders.ts, ComplianceSections.tsx, waterDetail.tsx
  inspections/         water/, air/ (moved from src/features/inspections/)
  export/              water.ts, survey.ts (moved mappers)
  modules/index.ts     heavy entry point (reportDataModules, reportForms, mapSurveyBundle)
  __tests__/           region tests
scripts/move-module.js           move + import rewrite tool
supabase/migrations/20261028090000_core_sync_tables_registry.sql
supabase/migrations/20261028090100_region_sync_handlers_compliance.sql
supabase/migrations/20261028090200_core_sync_dispatch_via_registry.sql
supabase/tests/rpc/sync_tables_registry.sql
docs/upstream-merge.md
```

---

### Task 1: Move tool, boundary rule, region skeleton with identity

**Files:**
- Create: `scripts/move-module.js`, `scripts/__tests__/moveModule.test.js`
- Create: `src/core/region/contract.ts`, `src/core/region/assertRegion.ts`
- Create: `src/region/index.ts`, `src/region/identity.ts`, `src/region/__tests__/boundary.test.ts`, `src/region/__tests__/region.test.ts`
- Modify: `.eslintrc.js`, `commitlint.config.js`
- Modify: `src/components/BrandLockup.tsx:43`, `src/features/home/components/HomeHeader.tsx:221`, `src/features/home/components/HomeFooter.tsx:40`

**Interfaces:**
- Produces: `moveModule({ root, from, to, move, scanDirs? }): string[]` (CLI `node scripts/move-module.js <from> <to>`); `RegionIdentity`, `RegionIndex` in `contract.ts`; `region.identity` from `src/region`.

- [ ] **Step 1: Create the branch**

Branch from the docs branch so the spec and this plan travel with the work (it is `develop` plus those two documents):

```bash
git switch -c refactor/region-split docs/emb4a-region-split-design
```

- [ ] **Step 2: Write the failing move-tool test**

`scripts/__tests__/moveModule.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { moveModule } = require('../move-module');

function setup(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'move-module-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return root;
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fsMove = (a, b) => {
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.renameSync(a, b);
};

describe('moveModule', () => {
  it('moves a directory and rewrites imports into it, out of it and within it', () => {
    const root = setup({
      'src/features/inspections/water/Form.tsx':
        "import { save } from '../hooks/save';\nimport { util } from './util';\n",
      'src/features/inspections/water/util.ts': 'export const util = 1;\n',
      'src/features/inspections/hooks/save.ts': 'export const save = 1;\n',
      'src/app/new.tsx':
        "import { Form } from '../features/inspections/water/Form';\njest.mock('../features/inspections/water/util');\n",
    });
    moveModule({ root, from: 'src/features/inspections/water', to: 'src/region/inspections/water', move: fsMove });
    expect(read(root, 'src/region/inspections/water/Form.tsx')).toBe(
      "import { save } from '../../../features/inspections/hooks/save';\nimport { util } from './util';\n",
    );
    expect(read(root, 'src/app/new.tsx')).toBe(
      "import { Form } from '../region/inspections/water/Form';\njest.mock('../region/inspections/water/util');\n",
    );
  });

  it('moves single files, extensionless and with an extension', () => {
    const root = setup({
      'src/data/boundaries.json': '[]',
      'src/data/locations.ts': 'export const L = {};\n',
      'src/constants/provinces.ts':
        "import { L } from '../data/locations';\nconst b = require('../data/boundaries.json');\n",
    });
    moveModule({ root, from: 'src/data/locations.ts', to: 'src/region/data/locations.ts', move: fsMove });
    moveModule({ root, from: 'src/data/boundaries.json', to: 'src/region/data/boundaries.json', move: fsMove });
    expect(read(root, 'src/constants/provinces.ts')).toBe(
      "import { L } from '../region/data/locations';\nconst b = require('../region/data/boundaries.json');\n",
    );
  });

  it('does not touch a sibling whose name only starts with the moved name', () => {
    const root = setup({
      'src/data/a.ts': 'export const a = 1;\n',
      'src/database/b.ts': 'export const b = 1;\n',
      'src/x.ts': "import { a } from './data/a';\nimport { b } from './database/b';\n",
    });
    const changed = moveModule({ root, from: 'src/data', to: 'src/region/data', move: fsMove });
    expect(read(root, 'src/x.ts')).toBe("import { a } from './region/data/a';\nimport { b } from './database/b';\n");
    expect(changed).toEqual([path.join(root, 'src/x.ts')]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest --ci --no-watchman scripts/__tests__/moveModule.test.js`
Expected: FAIL — `Cannot find module '../move-module'`.

- [ ] **Step 4: Write the move tool**

`scripts/move-module.js`:

```js
#!/usr/bin/env node
// Moves a file or directory and rewrites every relative import that points
// into, out of, or within it, across src/, __tests__/ and jest.setup.js —
// so a move never leaves broken imports for tsc to report one at a time.
// Used by the region split (docs/superpowers/plans/2026-10-27-phase0-region-split.md).
//
//   node scripts/move-module.js src/features/inspections/water src/region/inspections/water
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
// from '…' · import '…' · import('…') · require('…') · jest.mock('…') · jest.requireActual('…')
const SPECIFIER = /((?:from|import|require|jest\.mock|jest\.requireActual)\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\2/g;

const stripExt = p => p.replace(/\.(ts|tsx|js|jsx)$/, '');

function listSourceFiles(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return SOURCE_FILE.test(target) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    out.push(...listSourceFiles(path.join(target, entry.name)));
  }
  return out;
}

function toSpecifier(fromDir, target) {
  const rel = path.relative(fromDir, target).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function moveModule({ root, from, to, move, scanDirs = ['src', '__tests__', 'jest.setup.js'] }) {
  const fromAbs = path.resolve(root, from);
  const toAbs = path.resolve(root, to);
  if (!fs.existsSync(fromAbs)) throw new Error(`move-module: ${from} does not exist`);
  const isFile = fs.statSync(fromAbs).isFile();
  // Import specifiers omit .ts/.tsx, so a moved source file is matched without its extension.
  const fromKey = isFile ? stripExt(fromAbs) : fromAbs;
  const toKey = isFile ? stripExt(toAbs) : toAbs;

  const relocate = p => {
    if (p === fromKey || p === fromAbs) return p === fromAbs ? toAbs : toKey;
    if (p.startsWith(fromKey + path.sep)) return toKey + p.slice(fromKey.length);
    return null;
  };

  const files = scanDirs.flatMap(d => listSourceFiles(path.resolve(root, d)));
  move(fromAbs, toAbs);

  const changed = [];
  for (const oldPath of files) {
    const newPath = relocate(oldPath) ?? oldPath;
    const oldDir = path.dirname(oldPath);
    const newDir = path.dirname(newPath);
    const before = fs.readFileSync(newPath, 'utf8');
    const after = before.replace(SPECIFIER, (match, prefix, quote, spec) => {
      const target = path.resolve(oldDir, spec);
      const next = toSpecifier(newDir, relocate(target) ?? target);
      return next === spec ? match : `${prefix}${quote}${next}${quote}`;
    });
    if (after !== before) {
      fs.writeFileSync(newPath, after);
      changed.push(newPath);
    }
  }
  return changed;
}

if (require.main === module) {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) {
    console.error('usage: node scripts/move-module.js <from> <to>');
    process.exit(1);
  }
  const root = path.resolve(__dirname, '..');
  const changed = moveModule({
    root,
    from,
    to,
    move: (a, b) => {
      fs.mkdirSync(path.dirname(b), { recursive: true });
      execFileSync('git', ['mv', a, b], { cwd: root, stdio: 'inherit' });
    },
  });
  console.log(`moved ${from} -> ${to}; rewrote imports in ${changed.length} file(s)`);
}

module.exports = { moveModule };
```

- [ ] **Step 5: Run the move-tool test to verify it passes**

Run: `npx jest --ci --no-watchman scripts/__tests__/moveModule.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing boundary and identity tests**

`src/region/__tests__/boundary.test.ts`:

```ts
import { ESLint } from 'eslint';
import * as path from 'path';

// The foundation/region boundary (docs/upstream-merge.md): outside
// src/region/, region code is reachable only through its three entry points.
const eslint = new ESLint({ cwd: path.resolve(__dirname, '../../..') });

async function errorsFor(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import x from '${specifier}';\nexport default x;\n`, { filePath });
  return result.messages.filter(m => m.ruleId === 'no-restricted-imports').map(m => m.message);
}

describe('region boundary', () => {
  it.each(['../region', '../region/db', '../region/modules'])('lets foundation import the entry point %s', async spec => {
    expect(await errorsFor('src/features/example.ts', spec)).toEqual([]);
  });

  it.each(['../region/catalog', '../region/inspections/water/Form', '../region/db/models/ComplianceWater'])(
    'blocks foundation from importing region internals (%s)',
    async spec => {
      expect(await errorsFor('src/features/example.ts', spec)).toHaveLength(1);
    },
  );

  it('lets region code import its own internals', async () => {
    expect(await errorsFor('src/region/modules/example.ts', '../inspections/water/Form')).toEqual([]);
  });
});
```

`src/region/__tests__/region.test.ts`:

```ts
import { region } from '..';

describe('EMB4B region', () => {
  it('identifies itself', () => {
    expect(region.identity).toEqual({
      id: 'emb4b',
      systemName: 'EMB4B INSPECTION & MONITORING SYSTEM',
      copyrightLine: '© 2026 EMB - Environmental Management Bureau, Region 4-B',
    });
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npx jest --ci --no-watchman src/region/__tests__`
Expected: FAIL — `region.test.ts` cannot find module `..`; `boundary.test.ts` "blocks…" cases get `[]` instead of one error.

- [ ] **Step 8: Add the boundary rule and the commit scope**

In `.eslintrc.js`, append to `overrides`:

```js
    {
      // The foundation/region boundary — see docs/upstream-merge.md. Outside
      // src/region/, region code is reachable only through its entry points:
      // src/region (light data), src/region/db (a leaf src/db can import
      // without a cycle) and src/region/modules (per-type UI and logic).
      files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
      excludedFiles: ['src/region/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/region/**', '!**/region/db', '!**/region/modules'],
                message: 'Import region code only through src/region, src/region/db or src/region/modules (docs/upstream-merge.md).',
              },
            ],
          },
        ],
      },
    },
```

In `commitlint.config.js`, add `'region'` after `'router'` in the scope list.

- [ ] **Step 9: Create the contract, the identity and the region entry point**

`src/core/region/contract.ts`:

```ts
// What the foundation needs from a region. Each region repo (EMB4B, EMB4A)
// implements it through three entry points — src/region, src/region/db and
// src/region/modules — and src/core/region/assertRegion.ts makes tsc fail
// when an entry point drifts from these shapes. See docs/upstream-merge.md.

export interface RegionIdentity {
  /** Stable id, e.g. 'emb4b'. */
  id: string;
  /** The header lockup line, e.g. 'EMB4B INSPECTION & MONITORING SYSTEM'. */
  systemName: string;
  /** The home footer line. */
  copyrightLine: string;
}

/** The `src/region` entry point. */
export interface RegionIndex {
  region: {
    identity: RegionIdentity;
  };
}
```

`src/region/identity.ts`:

```ts
import type { RegionIdentity } from '../core/region/contract';

export const identity: RegionIdentity = {
  id: 'emb4b',
  systemName: 'EMB4B INSPECTION & MONITORING SYSTEM',
  copyrightLine: '© 2026 EMB - Environmental Management Bureau, Region 4-B',
};
```

`src/region/index.ts`:

```ts
// EMB Region 4-B (MIMAROPA). The light entry point: data the foundation
// reads at module scope. Heavy per-type UI lives behind src/region/modules.
import { identity } from './identity';

export const region = {
  identity,
};
```

`src/core/region/assertRegion.ts`:

```ts
// Compile-time only — never imported at runtime. tsc fails here when this
// repo's region entry points stop satisfying the foundation contract.
import * as regionIndex from '../../region';
import type { RegionIndex } from './contract';

export const regionIndexCheck: RegionIndex = regionIndex;
```

- [ ] **Step 10: Read the branding strings from the region**

`src/components/BrandLockup.tsx` — add `import { region } from '../region';` and replace the literal text `EMB4B INSPECTION & MONITORING SYSTEM` (line 43) with `{region.identity.systemName}`.
`src/features/home/components/HomeHeader.tsx` — add `import { region } from '../../../region';` and replace the same literal (line 221) with `{region.identity.systemName}`.
`src/features/home/components/HomeFooter.tsx` — add `import { region } from '../../../region';` and replace `© 2026 EMB - Environmental Management Bureau, Region 4-B` (line 40) with `{region.identity.copyrightLine}`.

- [ ] **Step 11: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/region scripts src/components src/features/home && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS; no lint errors.

- [ ] **Step 12: Commit**

```bash
git add scripts/move-module.js scripts/__tests__/moveModule.test.js .eslintrc.js commitlint.config.js src/core/region src/region src/components/BrandLockup.tsx src/features/home/components/HomeHeader.tsx src/features/home/components/HomeFooter.tsx
git commit -m "refactor(region): add the region boundary, contract and identity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Region locations

**Files:**
- Move: `src/data/mimaropaLocations.ts` → `src/region/data/mimaropaLocations.ts`; `src/data/mimaropaBoundaries.json` → `src/region/data/mimaropaBoundaries.json`
- Move: `src/features/location/resolveAddress.test.ts` → `src/region/__tests__/resolveAddress.mimaropa.test.ts`
- Create: `src/region/locations.ts`
- Modify: `src/core/region/contract.ts`, `src/region/index.ts`, `src/region/__tests__/region.test.ts`
- Modify: `src/constants/provinces.ts:7`, `src/features/location/mapConfig.ts:7-12`, `src/features/location/coordinates.ts:2,58`, `src/features/location/resolveAddress.ts:9-15,24-31,72`
- Modify tests: `src/features/location/mapConfig.test.ts`, `coordinates.test.ts`, `components/LocationPickerModal.test.tsx`

**Interfaces:**
- Consumes: `moveModule` CLI (Task 1).
- Produces: `RegionLocations`, `BoundaryEntry` in `contract.ts`; `region.locations`; `REGION_OVERVIEW` in `mapConfig.ts` (replaces `MIMAROPA_OVERVIEW`).

- [ ] **Step 1: Write the failing test**

Append to `src/region/__tests__/region.test.ts`:

```ts
  it('offers the five MIMAROPA provinces', () => {
    const provinces = Object.keys(region.locations.locations);
    expect(provinces).toHaveLength(5);
    expect(provinces).toEqual(expect.arrayContaining(['Occidental Mindoro', 'Palawan']));
  });

  it('opens the map on the MIMAROPA overview', () => {
    expect(region.locations.overview).toEqual({ center: [120.5, 12.0], zoom: 7 });
  });

  it('loads barangay boundaries lazily', () => {
    const entries = region.locations.loadBoundaries();
    expect(entries.length).toBeGreaterThan(1000);
    expect(entries[0]).toEqual(expect.objectContaining({ p: expect.any(String), c: expect.any(String), b: expect.any(String) }));
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman src/region/__tests__/region.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'locations')`.

- [ ] **Step 3: Move the data**

```bash
node scripts/move-module.js src/data/mimaropaLocations.ts src/region/data/mimaropaLocations.ts
node scripts/move-module.js src/data/mimaropaBoundaries.json src/region/data/mimaropaBoundaries.json
node scripts/move-module.js src/features/location/resolveAddress.test.ts src/region/__tests__/resolveAddress.mimaropa.test.ts
```

(`src/data/mimaropaWaterbodies.ts` stays until Task 8 — only water code uses it.)

- [ ] **Step 4: Add the contract types and the region locations**

Append to `src/core/region/contract.ts`:

```ts
/** One simplified barangay polygon, as scripts/build-barangay-boundaries.js emits it. */
export interface BoundaryEntry {
  p: string; // province
  c: string; // city/municipality
  b: string; // barangay
  bbox: [number, number, number, number]; // west, south, east, north
  rings: number[][];
}

export interface RegionLocations {
  /** province -> city/municipality -> barangays, bundled for offline address entry. */
  locations: Record<string, Record<string, string[]>>;
  /** Where the map picker opens with no pin and no GPS fix. */
  overview: { center: [number, number]; zoom: number };
  /** The barangay boundary polygons. Large: call lazily, never at module scope. */
  loadBoundaries(): BoundaryEntry[];
  /** Shown when a pin falls outside every boundary. */
  outsideBoundariesLabel: string;
}
```

and change `RegionIndex` to:

```ts
export interface RegionIndex {
  region: {
    identity: RegionIdentity;
    locations: RegionLocations;
  };
}
```

`src/region/locations.ts`:

```ts
import type { BoundaryEntry, RegionLocations } from '../core/region/contract';
import { LOCATIONS } from './data/mimaropaLocations';

// EMB Region 4-B (MIMAROPA): Occidental Mindoro, Oriental Mindoro,
// Marinduque, Romblon and Palawan.
export const locations: RegionLocations = {
  locations: LOCATIONS,
  // Wide enough to show all five MIMAROPA provinces.
  overview: { center: [120.5, 12.0], zoom: 7 },
  // ~866 KB of polygons from scripts/build-barangay-boundaries.js; required
  // inside the function so app start never parses it.
  loadBoundaries: () => require('./data/mimaropaBoundaries.json') as BoundaryEntry[],
  outsideBoundariesLabel: 'Outside MIMAROPA barangay boundaries',
};
```

In `src/region/index.ts` add `import { locations } from './locations';` and add `locations,` to the `region` object.

- [ ] **Step 5: Point the foundation at the region**

`src/constants/provinces.ts` — replace `import { LOCATIONS } from '../region/data/mimaropaLocations';` (the move rewrote it) with:

```ts
import { region } from '../region';

const LOCATIONS = region.locations.locations;
```

and change the file's header comment's "EMB Region 4-B provinces…" sentence to "The current region's provinces, cities/municipalities and barangays (see src/region/locations.ts)".

`src/features/location/mapConfig.ts` — replace the `MIMAROPA_OVERVIEW` block (lines 7–12) with:

```ts
// Where the picker opens when it has nothing better — no field values and
// no last GPS fix. Set per region in src/region/locations.ts.
export const REGION_OVERVIEW: { center: LngLat; zoom: number } = region.locations.overview;
```

and add `import { region } from '../../region';` at the top.

`src/features/location/coordinates.ts` — rename both uses of `MIMAROPA_OVERVIEW` to `REGION_OVERVIEW`.

`src/features/location/resolveAddress.ts` — delete the local `interface BoundaryEntry` (lines 9–15) and add `import type { BoundaryEntry } from '../../core/region/contract';` and `import { region } from '../../region';`. In `loadEntries`, replace the `require(...)` line with `entries = region.locations.loadBoundaries();`. In `formatResolvedAddress`, replace the literal with `region.locations.outsideBoundariesLabel`.

- [ ] **Step 6: Update the tests that named MIMAROPA**

`src/region/__tests__/resolveAddress.mimaropa.test.ts` — replace its `const entries = require(...) as Entry[];` line with:

```ts
import { region } from '..';

const entries = region.locations.loadBoundaries() as Entry[];
```

`src/features/location/mapConfig.test.ts`, `coordinates.test.ts`, `components/LocationPickerModal.test.tsx` — rename `MIMAROPA_OVERVIEW` to `REGION_OVERVIEW` in imports and assertions. In `mapConfig.test.ts` change `expect(MIMAROPA_OVERVIEW).toEqual({ center: [120.5, 12.0], zoom: 7 })` to `expect(REGION_OVERVIEW).toBe(region.locations.overview)` and add `import { region } from '../../region';`. In `LocationPickerModal.test.tsx`, if the expected `'Outside MIMAROPA barangay boundaries'` comes from the real `formatResolvedAddress`, replace it with `region.locations.outsideBoundariesLabel` (importing `region` from `'../../../region'`); if the test's own `jest.mock('../resolveAddress', …)` returns that string, leave it.

- [ ] **Step 7: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/region src/features/location src/constants && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS. `grep -rn "MIMAROPA_OVERVIEW\|data/mimaropaLocations\|data/mimaropaBoundaries" src` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add -A src/region src/core/region src/constants/provinces.ts src/features/location src/data
git commit -m "refactor(region): move MIMAROPA locations and boundaries behind the region

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Report-type catalog and compliance tags

**Files:**
- Create: `src/region/catalog.ts`, `src/region/__tests__/catalog.test.ts`
- Modify: `src/core/region/contract.ts`, `src/region/index.ts`
- Rewrite as facades: `src/constants/reportTypes.ts`, `src/constants/reportTypeDisplay.ts`
- Modify: `src/features/inspections/reportTypeMeta.ts:7-12`, `src/features/establishments/types/index.ts:30-37`, `src/features/establishments/hooks/useEstablishment.ts:71-79,197`, `src/features/establishments/components/EstablishmentCard.tsx:36-42`, `src/features/establishments/components/ManageEstablishmentsTab.tsx:27-33`
- Modify tests: `src/features/establishments/components/EstablishmentReportsSection.test.tsx:263`, `ReportListCard.test.tsx:290`

**Interfaces:**
- Produces (from `src/region`): `REPORT_TYPES`, `ENABLED_TYPES`, `type ReportTypeKey`, `REPORT_TYPE_DISPLAY`, `type ReportDataKey`, `DATA_KEY_TO_CREATE_KEY`, `COMPLIANCE_TAGS`, `SURVEY_COMPLIANCE_TAG`, `type ComplianceTag`. Contract: `ReportType<K, D>`, `ReportTypeDisplay`, `ComplianceTagEntry<K, D, T>`.
- Facades keep exporting the same names from `src/constants/reportTypes.ts` and `src/constants/reportTypeDisplay.ts`.

- [ ] **Step 1: Write the failing catalog test**

`src/region/__tests__/catalog.test.ts`:

```ts
import {
  COMPLIANCE_TAGS,
  DATA_KEY_TO_CREATE_KEY,
  ENABLED_TYPES,
  REPORT_TYPES,
  REPORT_TYPE_DISPLAY,
  SURVEY_COMPLIANCE_TAG,
} from '..';

describe('EMB4B report-type catalog', () => {
  it('lists the six create entries in speed-dial order with only water enabled', () => {
    expect(REPORT_TYPES.map(t => t.key)).toEqual(['air', 'water', 'hazwaste_generator', 'hazwaste_tsd', 'eia', 'survey']);
    expect(ENABLED_TYPES).toEqual(['water']);
  });

  it('has a display entry for every data key a create entry produces', () => {
    for (const t of REPORT_TYPES) expect(REPORT_TYPE_DISPLAY[t.dataKey]).toBeDefined();
  });

  it('maps stored report types back to their create entry', () => {
    expect(DATA_KEY_TO_CREATE_KEY).toEqual({
      air_monitoring: 'air',
      water_monitoring: 'water',
      hazardous_waste: 'hazwaste_generator',
      eia: 'eia',
    });
  });

  it('keeps the establishment compliance-tag vocabulary', () => {
    expect(COMPLIANCE_TAGS.map(t => t.tag)).toEqual(['Air Monitoring', 'Water Monitoring', 'Hazwaste', 'EIA', 'Survey']);
    expect(SURVEY_COMPLIANCE_TAG).toBe('Survey');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman src/region/__tests__/catalog.test.ts`
Expected: FAIL — the named exports are `undefined`.

- [ ] **Step 3: Add the contract types**

Append to `src/core/region/contract.ts` (add `import type React from 'react';`, `import type { SvgProps } from 'react-native-svg';` and `import type { Ionicons } from '@expo/vector-icons';` at the top):

```ts
/** One entry in the create surfaces (home speed dial, Add Report panel). */
export interface ReportType<K extends string = string, D extends string = string> {
  key: K;
  /** Which recorded-report bucket (inspection_reports.report_type) this create flow produces. */
  dataKey: D;
  /** Compact label for the speed dial; the full `title` stays the accessibility label. */
  shortTitle: string;
  law: string;
  title: string;
  iconName: string; // Ionicons name
  iconLibrary: 'Ionicons' | 'MaterialCommunityIcons';
  /** Custom illustration used instead of the icon font glyph when set. */
  iconAsset?: React.FC<SvgProps>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  route: string;
}

/** How an already-recorded report of one data key is labeled and colored. */
export interface ReportTypeDisplay {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
}

/** An establishment-level rollup tag, its stored report type (null for survey_reports) and its create entry. */
export interface ComplianceTagEntry<K extends string = string, D extends string = string, T extends string = string> {
  tag: T;
  dataKey: D | null;
  createKey: K;
}
```

and extend `RegionIndex` with:

```ts
  REPORT_TYPES: ReportType[];
  ENABLED_TYPES: string[];
  REPORT_TYPE_DISPLAY: Record<string, ReportTypeDisplay>;
  DATA_KEY_TO_CREATE_KEY: Partial<Record<string, string>>;
  COMPLIANCE_TAGS: ComplianceTagEntry[];
  SURVEY_COMPLIANCE_TAG: string;
```

- [ ] **Step 4: Create the region catalog**

`src/region/catalog.ts`. Build it from the current files, verbatim:

```ts
import type { ComplianceTagEntry, ReportType, ReportTypeDisplay } from '../core/region/contract';
import { Colors } from '../design/colors';

// ── Create entries ───────────────────────────────────────────────────────────
export type ReportTypeKey = 'air' | 'water' | 'hazwaste_generator' | 'hazwaste_tsd' | 'eia' | 'survey';

// ── Recorded-report vocabulary ───────────────────────────────────────────────
export type ReportDataKey = 'air_monitoring' | 'water_monitoring' | 'hazardous_waste' | 'eia' | 'survey';
```

then copy, unchanged:
- from `src/constants/reportTypes.ts`: the `ENABLED_TYPES` comment and declaration and the whole `REPORT_TYPES` array, typing it `ReportType<ReportTypeKey, ReportDataKey>[]`. Fix each `require('../../assets/icons/<x>.svg')` — the path is identical from `src/region/`, so leave it.
- from `src/constants/reportTypeDisplay.ts`: its header comment and the `REPORT_TYPE_DISPLAY` object, typed `Record<ReportDataKey, ReportTypeDisplay>`.
- from `src/features/inspections/reportTypeMeta.ts`: the `DB_TYPE_TO_KEY` object and its comment, renamed `export const DATA_KEY_TO_CREATE_KEY: Partial<Record<ReportDataKey, ReportTypeKey>>`.

Then append:

```ts
// ── Establishment compliance tags ────────────────────────────────────────────
// The rollup labels on establishment cards and the Manage Establishments
// filter, in filter order. 'Survey' comes from survey_reports, not from
// inspection_reports.report_type, so its dataKey is null.
export type ComplianceTag = 'Air Monitoring' | 'Water Monitoring' | 'Hazwaste' | 'EIA' | 'Survey';

export const SURVEY_COMPLIANCE_TAG: ComplianceTag = 'Survey';

export const COMPLIANCE_TAGS: ComplianceTagEntry<ReportTypeKey, ReportDataKey, ComplianceTag>[] = [
  { tag: 'Air Monitoring', dataKey: 'air_monitoring', createKey: 'air' },
  { tag: 'Water Monitoring', dataKey: 'water_monitoring', createKey: 'water' },
  { tag: 'Hazwaste', dataKey: 'hazardous_waste', createKey: 'hazwaste_generator' },
  { tag: 'EIA', dataKey: 'eia', createKey: 'eia' },
  { tag: SURVEY_COMPLIANCE_TAG, dataKey: null, createKey: 'survey' },
];
```

In `src/region/index.ts` add `export * from './catalog';`.

- [ ] **Step 5: Turn the old constants into facades**

`src/constants/reportTypes.ts` — replace the whole file with:

```ts
// Facade: the report-type catalog is region-owned (src/region/catalog.ts).
// Kept so this path's importers and test mocks don't change.
import type { ReportType as ContractReportType } from '../core/region/contract';
import type { ReportDataKey, ReportTypeKey } from '../region';

export { ENABLED_TYPES, REPORT_TYPES } from '../region';
export type { ReportTypeKey } from '../region';
export type ReportType = ContractReportType<ReportTypeKey, ReportDataKey>;
```

`src/constants/reportTypeDisplay.ts` — replace the whole file with:

```ts
// Facade: the recorded-report vocabulary is region-owned (src/region/catalog.ts).
export { REPORT_TYPE_DISPLAY } from '../region';
export type { ReportDataKey } from '../region';
export type { ReportTypeDisplay } from '../core/region/contract';
```

- [ ] **Step 6: Derive the remaining per-type tables from the catalog**

`src/features/inspections/reportTypeMeta.ts` — delete `DB_TYPE_TO_KEY` and its comment; import `DATA_KEY_TO_CREATE_KEY` and `type ReportDataKey` from `'../../region'`; change the lookup to `const key = DATA_KEY_TO_CREATE_KEY[reportType as ReportDataKey];`.

`src/features/establishments/types/index.ts` — replace the `ComplianceTag` union (lines 33–37) with `export type { ComplianceTag } from '../../../region';`.

`src/features/establishments/hooks/useEstablishment.ts` — replace the `REPORT_TYPE_TO_TAG` literal and the three comment lines above it (lines 71–79) with:

```ts
// Report type → establishment compliance tag; survey_reports add
// SURVEY_COMPLIANCE_TAG separately (see below). Region-owned vocabulary.
const REPORT_TYPE_TO_TAG: Record<string, ComplianceTag> = Object.fromEntries(
  COMPLIANCE_TAGS.filter(t => t.dataKey !== null).map(t => [t.dataKey, t.tag]),
);
```

importing `COMPLIANCE_TAGS, SURVEY_COMPLIANCE_TAG` from `'../../../region'`, and change `tagSet.add('Survey')` (line 197) to `tagSet.add(SURVEY_COMPLIANCE_TAG)`.

`src/features/establishments/components/EstablishmentCard.tsx` — replace the `TAG_TO_REPORT_TYPE_KEY` literal (lines 36–42) with:

```ts
const TAG_TO_REPORT_TYPE_KEY: Record<ComplianceTag, ReportTypeKey> = Object.fromEntries(
  COMPLIANCE_TAGS.map(t => [t.tag, t.createKey]),
) as Record<ComplianceTag, ReportTypeKey>;
```

importing `COMPLIANCE_TAGS` from `'../../../region'`.

`src/features/establishments/components/ManageEstablishmentsTab.tsx` — replace the `COMPLIANCE_TAG_OPTIONS` literal (lines 27–33) with `const COMPLIANCE_TAG_OPTIONS: ComplianceTag[] = COMPLIANCE_TAGS.map(t => t.tag);`, importing `COMPLIANCE_TAGS` from `'../../../region'`.

- [ ] **Step 7: Make the two foundation tests region-agnostic**

In `EstablishmentReportsSection.test.tsx` (line 263) and `ReportListCard.test.tsx` (line 290), replace the literal `ALL_DATA_KEYS: ReportDataKey[] = [ … ]` array with:

```ts
const ALL_DATA_KEYS = Object.keys(REPORT_TYPE_DISPLAY) as ReportDataKey[];
```

- [ ] **Step 8: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/region src/constants src/features/establishments src/features/inspections src/features/home && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS, including the existing `reportTypes.test.ts` and `reportTypeDisplay.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add -A src/region src/core/region src/constants src/features/inspections/reportTypeMeta.ts src/features/establishments
git commit -m "refactor(region): move the report-type catalog and compliance tags into the region

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Local database split

**Files:**
- Create: `src/db/__tests__/schemaSnapshot.test.ts` (and its `__snapshots__/` file, generated)
- Move: `src/db/models/Compliance{Air,Water,Hazwaste,Eia}.ts` → `src/region/db/models/`; `src/db/migrations.ts` → `src/region/db/migrations.ts`; `src/db/migrations.test.ts` → `src/region/db/migrations.test.ts`
- Create: `src/region/db/index.ts`, `src/region/db/tables.ts`
- Modify: `src/core/region/contract.ts`, `src/core/region/assertRegion.ts`, `src/db/schema.ts`, `src/db/database.ts`, `src/db/models/index.ts`, `src/db/migrationGuard.ts:22`, `src/features/inspections/reportPersistence.ts:5-10,36-41`, `src/region/catalog.ts`

**Interfaces:**
- Produces (from `src/region/db`): `regionDb: { schemaVersion; tables; migrations; modelClasses }`, `regionCollectionsFor(db)`, `type RegionCollections`, the four model classes. From `src/region`: `COMPLIANCE_COLLECTIONS: Partial<Record<ReportDataKey, keyof RegionCollections>>`. `collections` in `src/db/database.ts` keeps every existing key (`complianceWater`, …).

- [ ] **Step 1: Write the characterization test (before moving anything)**

`src/db/__tests__/schemaSnapshot.test.ts`:

```ts
import { schema } from '../schema';

// Pins the assembled local schema across the region split: same version,
// same tables, same columns. Regenerate only for an intended schema change.
describe('local schema', () => {
  it('is version 16', () => {
    expect(schema.version).toBe(16);
  });

  it('keeps every table and column', () => {
    const tables = Object.keys(schema.tables)
      .sort()
      .map(name => ({ name, columns: schema.tables[name].columnArray.map(c => ({ ...c })) }));
    expect(tables).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run it to record the snapshot from the current code**

Run: `npx jest --ci=false --no-watchman src/db/__tests__/schemaSnapshot.test.ts`
Expected: PASS, "1 snapshot written". Commit it on its own so the refactor is checked against the pre-move schema:

```bash
git add src/db/__tests__
git commit -m "test(db): pin the local schema before the region split

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Move the compliance models and the migrations**

```bash
node scripts/move-module.js src/db/models/ComplianceAir.ts src/region/db/models/ComplianceAir.ts
node scripts/move-module.js src/db/models/ComplianceWater.ts src/region/db/models/ComplianceWater.ts
node scripts/move-module.js src/db/models/ComplianceHazwaste.ts src/region/db/models/ComplianceHazwaste.ts
node scripts/move-module.js src/db/models/ComplianceEia.ts src/region/db/models/ComplianceEia.ts
node scripts/move-module.js src/db/migrations.ts src/region/db/migrations.ts
node scripts/move-module.js src/db/migrations.test.ts src/region/db/migrations.test.ts
```

- [ ] **Step 4: Create the region tables and the db entry point**

`src/region/db/tables.ts` — move the four `tableSchema({ name: 'compliance_air' … })`, `compliance_water`, `compliance_hazwaste` and `compliance_eia` blocks (with their section comments) out of `src/db/schema.ts` (currently lines 177–297), verbatim:

```ts
import { tableSchema, type TableSchema } from '@nozbe/watermelondb';

// EMB4B's region tables. Column conventions are the foundation's — see the
// header of src/db/schema.ts (camelCase locals, syncState, updated_at).
export const regionTables: TableSchema[] = [
  // …the four tableSchema({...}) blocks, unchanged…
];
```

Append to `src/core/region/contract.ts` (add `import type { Database, Model, TableSchema } from '@nozbe/watermelondb';` and `import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';`):

```ts
/** The `src/region/db` entry point: a leaf — it must not import src/db/database. */
export interface RegionDbIndex {
  regionDb: {
    /** WatermelonDB schema version. Region-owned: bump it for core or region table changes. */
    schemaVersion: number;
    /** Region tables only; src/db/schema.ts adds the foundation's. */
    tables: TableSchema[];
    /** The full migration history, foundation steps included (see docs/upstream-merge.md). */
    migrations: SchemaMigrations;
    modelClasses: (typeof Model)[];
  };
  regionCollectionsFor(database: Database): Record<string, unknown>;
}
```

`src/region/db/index.ts`:

```ts
// The src/region/db entry point. A leaf: src/db/schema.ts and
// src/db/database.ts import it, so nothing here may import src/db/database.
import type { Database } from '@nozbe/watermelondb';
import { migrations } from './migrations';
import { ComplianceAir } from './models/ComplianceAir';
import { ComplianceEia } from './models/ComplianceEia';
import { ComplianceHazwaste } from './models/ComplianceHazwaste';
import { ComplianceWater } from './models/ComplianceWater';
import { regionTables } from './tables';

export { ComplianceAir, ComplianceEia, ComplianceHazwaste, ComplianceWater };

export const regionDb = {
  schemaVersion: 16,
  tables: regionTables,
  migrations,
  modelClasses: [ComplianceAir, ComplianceWater, ComplianceHazwaste, ComplianceEia],
};

// Spread into src/db/database.ts's `collections`, so every existing
// collections.complianceX call site (and test mock) keeps working.
export function regionCollectionsFor(database: Database) {
  return {
    complianceAir: database.collections.get<ComplianceAir>('compliance_air'),
    complianceWater: database.collections.get<ComplianceWater>('compliance_water'),
    complianceHazwaste: database.collections.get<ComplianceHazwaste>('compliance_hazwaste'),
    complianceEia: database.collections.get<ComplianceEia>('compliance_eia'),
  };
}

export type RegionCollections = ReturnType<typeof regionCollectionsFor>;
```

Add to `src/core/region/assertRegion.ts`:

```ts
import * as regionDbIndex from '../../region/db';
import type { RegionDbIndex } from './contract';

export const regionDbIndexCheck: RegionDbIndex = regionDbIndex;
```

(merge the `import type` into the existing one.)

- [ ] **Step 5: Assemble the schema and the database from foundation + region**

`src/db/schema.ts` — after the header comment, replace `export const schema = appSchema({ version: 16, tables: [` … `] });` with foundation tables only plus the region's:

```ts
import { regionDb } from '../region/db';

// Foundation tables. Region tables (compliance_* in EMB4B) come from
// src/region/db/tables.ts; the version is region-owned (src/region/db).
const foundationTables = [
  // …establishments, purpose_of_inspection, inspection_reports,
  // survey_reports and attachments tableSchema blocks, unchanged…
];

export const schema = appSchema({
  version: regionDb.schemaVersion,
  tables: [...foundationTables, ...regionDb.tables],
});
```

`src/db/database.ts`:
- Replace `import { migrations } from './migrations';` with `import { regionDb, regionCollectionsFor } from '../region/db';`.
- Remove `ComplianceAir, ComplianceWater, ComplianceHazwaste, ComplianceEia` from the `./models` import.
- `assertMigrationsCoverSchema(schema, regionDb.migrations);` and `migrations: regionDb.migrations,` in the adapter.
- `modelClasses: [Establishment, InspectionReport, SurveyReport, PurposeOfInspection, Attachment, ...regionDb.modelClasses],`
- In `collections`, delete the four `compliance*` lines and add `...regionCollectionsFor(database),` as the last entry.

`src/db/models/index.ts` — delete the four `Compliance*` export lines. Then run `npm run typecheck`; every error of the form "Module '…/db/models' has no exported member 'ComplianceX'" is fixed by importing that model from `src/region/db` instead (e.g. in `src/features/inspections/water/WaterComplianceEditSections.tsx:90`, `import type { ComplianceWater } from '../../../region/db';`).

`src/db/migrationGuard.ts` — in the error message, change `src/db/migrations.ts` to `src/region/db/migrations.ts`.

- [ ] **Step 6: Make report deletion read the region's compliance collections**

Append to `src/region/catalog.ts`:

```ts
import type { RegionCollections } from './db';

// Which compliance collection holds each stored report type's row; deleting
// a report also removes it. Report types without one have no entry.
export const COMPLIANCE_COLLECTIONS: Partial<Record<ReportDataKey, keyof RegionCollections>> = {
  air_monitoring: 'complianceAir',
  water_monitoring: 'complianceWater',
  hazardous_waste: 'complianceHazwaste',
  eia: 'complianceEia',
};
```

(put the `import type` with the other imports at the top of the file). Add `COMPLIANCE_COLLECTIONS: Partial<Record<string, string>>;` to `RegionIndex` in the contract.

`src/features/inspections/reportPersistence.ts` — delete `REPORT_TYPE_TO_COMPLIANCE_COLLECTION` (lines 5–10) and change line 36 to:

```ts
      const complianceCollectionKey = COMPLIANCE_COLLECTIONS[reportRecord.reportType as ReportDataKey];
```

importing `COMPLIANCE_COLLECTIONS` and `type ReportDataKey` from `'../../region'`.

- [ ] **Step 7: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/db src/region src/features/inspections && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS; `schemaSnapshot.test.ts` matches the snapshot written in Step 2 without updating it.

- [ ] **Step 8: Commit**

```bash
git add -A src/db src/region src/core/region src/features
git commit -m "refactor(db): assemble the local schema from foundation and region tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sync client split

**Files:**
- Create: `src/services/sync/syncRegistry.test.ts` (and its snapshot)
- Create: `src/region/db/sync.ts`
- Modify: `src/region/db/index.ts`, `src/core/region/contract.ts`
- Modify: `src/services/sync/syncSchema.ts:1-11,24,179-297`, `src/services/sync/syncTypes.ts:19-44,250-320`, `src/db/sync/collectPushChanges.ts:82-117`, `src/db/sync/watermelonAdapter.ts:13-34`

**Interfaces:**
- Consumes: `regionDb` (Task 4).
- Produces (from `src/region/db`): `regionSyncEntities: Record<RegionSyncEntityName, SyncEntitySchema>`, `regionParentDependencies: ParentDependency[]`, `type RegionSyncEntityName`, `type RegionDtoMap`, the four `Compliance*DTO` interfaces. From `collectPushChanges.ts`: `export interface ParentDependency`, `export const PARENT_DEPENDENCIES`. `syncSchema` keeps the same keys in the same order.

- [ ] **Step 1: Export the parent dependencies and write the characterization test**

In `src/db/sync/collectPushChanges.ts`, change `interface ParentDependency` to `export interface ParentDependency` and `const PARENT_DEPENDENCIES` to `export const PARENT_DEPENDENCIES`.

`src/services/sync/syncRegistry.test.ts`:

```ts
import { PARENT_DEPENDENCIES } from '../../db/sync/collectPushChanges';
import { syncSchema } from './syncSchema';

// Pins the client-side sync registry across the region split.
describe('sync registry', () => {
  it('keeps entity order (parents before children, attachments last)', () => {
    expect(Object.keys(syncSchema)).toEqual([
      'establishments',
      'purpose_of_inspection',
      'inspection_reports',
      'survey_reports',
      'compliance_air',
      'compliance_water',
      'compliance_hazwaste',
      'compliance_eia',
      'attachments',
    ]);
  });

  it('keeps every entity schema', () => {
    expect(syncSchema).toMatchSnapshot();
  });

  it('keeps every parent dependency', () => {
    expect(PARENT_DEPENDENCIES).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run it to record the snapshots, then commit**

Run: `npx jest --ci=false --no-watchman src/services/sync/syncRegistry.test.ts`
Expected: PASS, "2 snapshots written".

```bash
git add src/services/sync/syncRegistry.test.ts src/services/sync/__snapshots__ src/db/sync/collectPushChanges.ts
git commit -m "test(sync): pin the sync registry before the region split

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Create the region sync entities**

`src/region/db/sync.ts`:

```ts
// EMB4B's synced tables: field maps, DTO shapes and push-order parent
// dependencies. Type-only imports from the foundation keep this a leaf.
import type { ParentDependency } from '../../db/sync/collectPushChanges';
import type { SyncEntitySchema } from '../../services/sync/syncSchema';
import type { JsonArray, JsonObject } from '../../services/sync/syncTypes';

export type RegionSyncEntityName = 'compliance_air' | 'compliance_water' | 'compliance_hazwaste' | 'compliance_eia';

export const regionSyncEntities: Record<RegionSyncEntityName, SyncEntitySchema> = {
  // …the compliance_air, compliance_water, compliance_hazwaste and
  // compliance_eia entries moved verbatim from syncSchema.ts (lines 179–297)…
};

export const regionParentDependencies: ParentDependency[] = [
  { childEntity: 'compliance_air', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_water', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_hazwaste', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
  { childEntity: 'compliance_eia', parentEntity: 'inspection_reports', foreignKeyField: 'report_id' },
];

// …ComplianceAirDTO, ComplianceWaterDTO, ComplianceHazwasteDTO and
// ComplianceEiaDTO moved verbatim from syncTypes.ts (lines 250–320),
// each now `export interface`…

export interface RegionDtoMap {
  compliance_air: ComplianceAirDTO;
  compliance_water: ComplianceWaterDTO;
  compliance_hazwaste: ComplianceHazwasteDTO;
  compliance_eia: ComplianceEiaDTO;
}
```

Import only the `syncTypes` helper types the moved DTOs actually use (`JsonArray`, `JsonObject`, `ISODateTimeString`, …) — `tsc` lists any missing ones.

In `src/region/db/index.ts` add:

```ts
export { regionParentDependencies, regionSyncEntities } from './sync';
export type { RegionDtoMap, RegionSyncEntityName } from './sync';
export type { ComplianceAirDTO, ComplianceEiaDTO, ComplianceHazwasteDTO, ComplianceWaterDTO } from './sync';
```

Extend `RegionDbIndex` in the contract with:

```ts
  regionSyncEntities: Record<string, unknown>;
  regionParentDependencies: { childEntity: string; parentEntity: string; foreignKeyField: string }[];
```

- [ ] **Step 4: Assemble the foundation sync registry**

`src/services/sync/syncSchema.ts`:

```ts
import { regionSyncEntities, type RegionSyncEntityName } from '../../region/db';

export type FoundationSyncEntityName =
  | 'establishments'
  | 'purpose_of_inspection'
  | 'inspection_reports'
  | 'survey_reports'
  | 'attachments';

export type SyncEntityName = FoundationSyncEntityName | RegionSyncEntityName;
```

replacing the old `SyncEntityName` union (lines 1–10). Rename `export const syncSchema: Record<SyncEntityName, SyncEntitySchema> = {` to `const foundationSyncSchema: Record<FoundationSyncEntityName, SyncEntitySchema> = {`, delete the four compliance entries (moved in Step 3), and add after it:

```ts
// Attachments go last: they can reference a row of any other table.
const { attachments, ...foundationParents } = foundationSyncSchema;

export const syncSchema: Record<SyncEntityName, SyncEntitySchema> = {
  ...foundationParents,
  ...regionSyncEntities,
  attachments,
};
```

`src/services/sync/syncTypes.ts` — delete the four `Compliance*DTO` interfaces and replace `PullChangesResponse` and `PushChangesPayload` (lines 19–44) with:

```ts
import type { RegionDtoMap } from '../../region/db';

interface FoundationDtoMap {
  establishments: EstablishmentDTO;
  purpose_of_inspection: PurposeOfInspectionDTO;
  inspection_reports: InspectionReportDTO;
  survey_reports: SurveyReportDTO;
  attachments: AttachmentDTO;
}

type SyncDtoMap = FoundationDtoMap & RegionDtoMap;

export interface PullChangesResponse {
  changes: { [K in keyof SyncDtoMap]: SyncEntityChanges<SyncDtoMap[K]> };
  timestamp: number;
}

export type PushChangesPayload = { [K in keyof SyncDtoMap]?: SyncEntityChanges<SyncDtoMap[K]> };
```

(put the `import type` with the file's imports). If anything imported a `Compliance*DTO` from `syncTypes`, `tsc` will say so; import it from `src/region/db` instead.

`src/db/sync/collectPushChanges.ts` — replace the four `compliance_*` entries in `PARENT_DEPENDENCIES` with a spread, keeping the attachments entries last:

```ts
export const PARENT_DEPENDENCIES: ParentDependency[] = [
  { childEntity: 'purpose_of_inspection', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  { childEntity: 'inspection_reports', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  { childEntity: 'inspection_reports', parentEntity: 'purpose_of_inspection', foreignKeyField: 'purpose_id' },
  { childEntity: 'survey_reports', parentEntity: 'establishments', foreignKeyField: 'estab_id' },
  ...regionParentDependencies,
  { childEntity: 'attachments', parentEntity: 'inspection_reports', foreignKeyField: 'inspection_report_id' },
  { childEntity: 'attachments', parentEntity: 'survey_reports', foreignKeyField: 'survey_report_id' },
];
```

importing `regionParentDependencies` from `'../../region/db'`.

`src/db/sync/watermelonAdapter.ts` — replace the `collectionFor` switch (lines 13–34) with:

```ts
// Every sync entity name is its WatermelonDB table name (see syncSchema.ts).
function collectionFor(entity: SyncEntityName): Collection<Model> {
  return database.collections.get<Model>(entity);
}
```

importing `database` from `'../database'` and dropping the now-unused `collections` import if nothing else uses it.

- [ ] **Step 5: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/services/sync src/db src/region && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS; `syncRegistry.test.ts` matches its committed snapshots unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A src/services/sync src/db/sync src/region src/core/region
git commit -m "refactor(sync): register region sync entities through the region db entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Server sync registry with per-table handlers

**Files:**
- Create: `supabase/migrations/20261028090000_core_sync_tables_registry.sql`
- Create: `supabase/migrations/20261028090100_region_sync_handlers_compliance.sql`
- Create: `supabase/migrations/20261028090200_core_sync_dispatch_via_registry.sql`
- Create: `supabase/tests/rpc/sync_tables_registry.sql`
- Source (read-only): `supabase/migrations/20260916100000_add_checklist_columns_to_compliance_air.sql` (current `push_changes`), `supabase/migrations/20260813011000_add_attachments_to_pull_changes.sql` (current `pull_changes`)

**Interfaces:**
- Produces: table `public.sync_tables(table_name, sync_order, push_handler regproc, pull_handler regproc, owner)`; for each synced table `public.push_<table>(p_changes jsonb) returns text[]` (ids of updated rows declined as conflicts) and `public.pull_<table>(last_pulled_at bigint) returns jsonb` (`{created, updated, deleted}`); `push_changes(jsonb)` and `pull_changes(bigint)` keep their signatures and response shapes.

Three migrations so every intermediate state works: registry and foundation handlers first, then region handlers, then the dispatcher swap.

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/rpc/sync_tables_registry.sql`:

```sql
begin;

select plan(6);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables),
  array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports',
        'compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia', 'attachments'],
  'sync_tables lists every synced table, parents before children'
);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'region'),
  array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'],
  'the compliance tables are region-owned'
);

select is(has_table_privilege('anon', 'public.sync_tables', 'SELECT'), false, 'anon cannot read sync_tables');

select is(
  has_function_privilege('anon', 'public.push_compliance_air(jsonb)', 'EXECUTE'),
  false,
  'anon cannot call a push handler directly'
);

select ok(
  (public.pull_changes(0)->'changes') ?& array['establishments', 'compliance_water', 'attachments'],
  'pull_changes emits one key per registered table'
);

select is(
  public.push_changes('{}'::jsonb),
  '{"status": "ok"}'::jsonb,
  'an empty push still answers {"status":"ok"} with no conflicts key'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Start Docker Desktop, then run: `npx supabase start && npx supabase db reset && npx supabase test db`
Expected: `sync_tables_registry.sql` FAILS (`relation "public.sync_tables" does not exist`); every other test passes.

- [ ] **Step 3: Write the registry and the foundation handlers**

`supabase/migrations/20261028090000_core_sync_tables_registry.sql` starts with:

```sql
begin;

-- ─────────────────────────────────────────────────────────────────────────
-- The sync registry. push_changes / pull_changes used to name every table
-- in one ~1,100-line body, so adding a column to any table redefined both
-- functions — and a foundation change would overwrite a region's tables.
-- Each synced table now has its own push_<table> / pull_<table> handler,
-- registered here; 20261028090200 turns the two RPCs into dispatchers over
-- this table. Foundation rows live in _core_ migrations, region rows in
-- _region_ ones (docs/upstream-merge.md).
--
-- Handler bodies are the per-table blocks of
-- 20260916100000_add_checklist_columns_to_compliance_air.sql (push) and
-- 20260813011000_add_attachments_to_pull_changes.sql (pull), unchanged
-- apart from reading p_changes (the table's {created, updated, deleted})
-- and returning their conflict ids. Same order, same SQL, same errors.
-- ─────────────────────────────────────────────────────────────────────────

create table public.sync_tables (
  table_name   text primary key,
  sync_order   integer not null unique,
  push_handler regproc not null, -- (p_changes jsonb) returns text[]
  pull_handler regproc not null, -- (last_pulled_at bigint) returns jsonb
  owner        text not null check (owner in ('core', 'region'))
);

alter table public.sync_tables enable row level security;
create policy "authenticated can read the sync registry"
  on public.sync_tables for select to authenticated using (true);
-- Read-only for signed-in users (the dispatchers run as the caller); only
-- migrations write it.
revoke all on public.sync_tables from anon, authenticated;
grant select on public.sync_tables to authenticated;
```

Then one pull handler per foundation table — the matching block of the current `pull_changes`, as a `language sql` function:

```sql
create or replace function public.pull_establishments(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(e)) from public.establishments e
      where floor(extract(epoch from e.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_purpose_of_inspection(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(p)) from public.purpose_of_inspection p
      where floor(extract(epoch from p.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_inspection_reports(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ir)) from public.inspection_reports ir
      where ir.deleted_at is null
        and floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(ir.report_id) from public.inspection_reports ir
      where ir.deleted_at is not null
        and floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;

create or replace function public.pull_survey_reports(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(sr)) from public.survey_reports sr
      where sr.deleted_at is null
        and floor(extract(epoch from sr.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(sr.survey_id) from public.survey_reports sr
      where sr.deleted_at is not null
        and floor(extract(epoch from sr.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;

create or replace function public.pull_attachments(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(a)) from public.attachments a
      where a.deleted_at is null
        and floor(extract(epoch from a.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(a.attachment_id) from public.attachments a
      where a.deleted_at is not null
        and floor(extract(epoch from a.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;
```

Then one push handler per foundation table, cut from the current `push_changes` body (source file `20260916100000_…sql`):

| Handler | Source lines | Record variable | Old conflict array |
|---|---|---|---|
| `push_establishments` | 71–235 | `establishment_record` | `v_conflicts_establishments` |
| `push_purpose_of_inspection` | 236–335 | `purpose_record` | `v_conflicts_purpose` |
| `push_inspection_reports` | 336–437 | `inspection_report_record` | `v_conflicts_reports` |
| `push_survey_reports` | 438–589 | `survey_record` | `v_conflicts_survey` |
| `push_attachments` | 1005–1109 | `attachment_record` | `v_conflicts_attachments` |

Each handler has exactly this frame, with the source lines pasted in as the body and two textual substitutions applied to them: `changes->'<table>'->` becomes `p_changes->`, and the table's old conflict-array name becomes `v_conflicts`. The `raise exception 'push_changes: …'` messages stay as they are. The complete compliance_air handler in Step 4 is a worked example of the result.

```sql
create or replace function public.push_<table>(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  <record variable> jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- <source lines, substituted>
  return v_conflicts;
end;
$$;
```

Close the migration with the grants and the foundation registry rows:

```sql
do $$
declare
  t text;
begin
  foreach t in array array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports', 'attachments'] loop
    execute format('revoke all on function public.push_%s(jsonb) from public, anon', t);
    execute format('grant execute on function public.push_%s(jsonb) to authenticated', t);
    execute format('revoke all on function public.pull_%s(bigint) from public, anon', t);
    execute format('grant execute on function public.pull_%s(bigint) to authenticated', t);
  end loop;
end;
$$;

insert into public.sync_tables (table_name, sync_order, push_handler, pull_handler, owner) values
  ('establishments',        10,  'public.push_establishments',        'public.pull_establishments',        'core'),
  ('purpose_of_inspection', 20,  'public.push_purpose_of_inspection', 'public.pull_purpose_of_inspection', 'core'),
  ('inspection_reports',    30,  'public.push_inspection_reports',    'public.pull_inspection_reports',    'core'),
  ('survey_reports',        40,  'public.push_survey_reports',        'public.pull_survey_reports',        'core'),
  ('attachments',           900, 'public.push_attachments',           'public.pull_attachments',           'core');

commit;
```

- [ ] **Step 4: Write the region handlers**

`supabase/migrations/20261028090100_region_sync_handlers_compliance.sql`:

```sql
begin;

-- EMB4B's region tables in the sync registry (see 20261028090000). Bodies
-- are the compliance_* blocks of
-- 20260916100000_add_checklist_columns_to_compliance_air.sql, unchanged.
-- sync_order 100-199 is the region's band: after inspection_reports (their
-- parent), before attachments.

create or replace function public.push_compliance_air(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  compliance_air_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
  loop
    begin
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
    exception when others then
      raise exception 'push_changes: compliance_air insert failed (compliance_id=%, report_id=%): %',
        compliance_air_record->>'compliance_id', compliance_air_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated compliance_air (upsert, tracks conflicts)
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
  loop
    begin
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
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        emission_sources = excluded.emission_sources,
        checklist_dao_2004_26 = excluded.checklist_dao_2004_26,
        checklist_dao_2000_81 = excluded.checklist_dao_2000_81,
        checklist_emb_mc = excluded.checklist_emb_mc,
        checklist_appendix_f = excluded.checklist_appendix_f,
        checklist_consent_agreement = excluded.checklist_consent_agreement,
        pto_conditions = excluded.pto_conditions,
        other_observations = excluded.other_observations,
        remarks_recommendations = excluded.remarks_recommendations,
        documents_reviewed = excluded.documents_reviewed;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts := array_append(v_conflicts, compliance_air_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_air upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_air_record->>'compliance_id', compliance_air_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_air
    where compliance_id = trim(both '"' from compliance_air_record::text);
  end loop;

  return v_conflicts;
end;
$$;
```

Add `push_compliance_water` (source lines 680–826, `compliance_water_record`, `v_conflicts_water`), `push_compliance_hazwaste` (827–933, `compliance_hazwaste_record`, `v_conflicts_hazwaste`) and `push_compliance_eia` (934–1004, `compliance_eia_record`, `v_conflicts_eia`) the same way. Then the four pull handlers — each compliance block of the current `pull_changes`:

```sql
create or replace function public.pull_compliance_air(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ca)) from public.compliance_air ca
      join public.inspection_reports ir on ir.report_id = ca.report_id
      where floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;
```

and `pull_compliance_water` (alias `cw`), `pull_compliance_hazwaste` (`ch`), `pull_compliance_eia` (`ce`) identically. Close with:

```sql
do $$
declare
  t text;
begin
  foreach t in array array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'] loop
    execute format('revoke all on function public.push_%s(jsonb) from public, anon', t);
    execute format('grant execute on function public.push_%s(jsonb) to authenticated', t);
    execute format('revoke all on function public.pull_%s(bigint) from public, anon', t);
    execute format('grant execute on function public.pull_%s(bigint) to authenticated', t);
  end loop;
end;
$$;

insert into public.sync_tables (table_name, sync_order, push_handler, pull_handler, owner) values
  ('compliance_air',      100, 'public.push_compliance_air',      'public.pull_compliance_air',      'region'),
  ('compliance_water',    110, 'public.push_compliance_water',    'public.pull_compliance_water',    'region'),
  ('compliance_hazwaste', 120, 'public.push_compliance_hazwaste', 'public.pull_compliance_hazwaste', 'region'),
  ('compliance_eia',      130, 'public.push_compliance_eia',      'public.pull_compliance_eia',      'region');

commit;
```

- [ ] **Step 5: Check the extraction mechanically**

Run: `grep -n "changes->'" supabase/migrations/20261028090000_core_sync_tables_registry.sql supabase/migrations/20261028090100_region_sync_handlers_compliance.sql`
Expected: no output (every handler reads `p_changes`).

Run: `grep -c "v_conflicts_" supabase/migrations/20261028090000_core_sync_tables_registry.sql supabase/migrations/20261028090100_region_sync_handlers_compliance.sql`
Expected: `0` for both files.

- [ ] **Step 6: Swap the RPCs to dispatchers**

`supabase/migrations/20261028090200_core_sync_dispatch_via_registry.sql`:

```sql
begin;

-- push_changes / pull_changes become dispatchers over public.sync_tables
-- (20261028090000). Same signatures, same response shapes: handlers run in
-- sync_order — the order the old single body ran its table blocks in — and
-- conflicts are reported only for tables that have some.

create or replace function public.push_changes(changes jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t record;
  v_ids text[];
  v_conflicts jsonb := '{}'::jsonb;
begin
  for t in select table_name, push_handler from public.sync_tables order by sync_order loop
    execute format('select %s($1)', t.push_handler)
      into v_ids
      using coalesce(changes->t.table_name, '{}'::jsonb);
    if coalesce(array_length(v_ids, 1), 0) > 0 then
      v_conflicts := v_conflicts || jsonb_build_object(t.table_name, to_jsonb(v_ids));
    end if;
  end loop;

  return jsonb_strip_nulls(jsonb_build_object(
    'status', 'ok',
    'conflicts', case when v_conflicts = '{}'::jsonb then null else v_conflicts end
  ));
end;
$$;

create or replace function public.pull_changes(last_pulled_at bigint default 0)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t record;
  v_entity jsonb;
  v_changes jsonb := '{}'::jsonb;
begin
  for t in select table_name, pull_handler from public.sync_tables order by sync_order loop
    execute format('select %s($1)', t.pull_handler) into v_entity using last_pulled_at;
    v_changes := v_changes || jsonb_build_object(t.table_name, v_entity);
  end loop;

  return jsonb_build_object(
    'changes', v_changes,
    'timestamp', floor(extract(epoch from now()) * 1000)::bigint
  );
end;
$$;

commit;
```

- [ ] **Step 7: Run the whole database suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: every file passes — `sync_tables_registry.sql` and all existing `supabase/tests/rpc/*` and `supabase/tests/rls/*` files, unmodified. A failing existing RPC test means a handler body differs from its source block: diff the handler against the source line range from the table in Step 3.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261028090000_core_sync_tables_registry.sql supabase/migrations/20261028090100_region_sync_handlers_compliance.sql supabase/migrations/20261028090200_core_sync_dispatch_via_registry.sql supabase/tests/rpc/sync_tables_registry.sql
git commit -m "refactor(supabase): dispatch push_changes and pull_changes through a sync table registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Compliance views and the report detail screen via region modules

**Files:**
- Create: `src/region/complianceViews.ts`, `src/region/compliance/loaders.ts`, `src/region/compliance/ComplianceSections.tsx`, `src/region/compliance/waterDetail.tsx`, `src/region/modules/index.ts`, `src/region/__tests__/modules.test.ts`
- Modify: `src/core/region/contract.ts`, `src/core/region/assertRegion.ts`, `src/region/index.ts`
- Modify: `src/features/inspections/hooks/useInspectionReport.ts:8-13,65-140`, `src/features/inspections/hooks/loadInspectionReportDetail.ts:7,84-191`, `src/features/inspections/components/ComplianceStatusView.tsx`, `src/features/inspections/components/InspectionReportDetailScreen.tsx:22-27,128-137,217-237`
- Modify (importers of the moved view types): files under `src/features/inspections/water/` and `src/features/export/` that import `WaterComplianceView` (or another per-type view) from `useInspectionReport`

**Interfaces:**
- Consumes: `collections` (Task 4), catalog types (Task 3).
- Produces: contract `ReportDataModule`, `DetailTabProps`, `RegionModulesIndex`; from `src/region`: `type RegionComplianceView` and the four per-type view types; from `src/region/modules`: `reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>>`. `ComplianceStatusView` gains a required `reportType: string` prop.

- [ ] **Step 1: Write the failing modules test**

`src/region/__tests__/modules.test.ts`:

```ts
jest.mock('../../db/database', () => ({ collections: {}, database: {} }));

import { COMPLIANCE_COLLECTIONS } from '..';
import { reportDataModules } from '../modules';

describe('EMB4B report data modules', () => {
  it('has a compliance loader for every report type with a compliance collection', () => {
    for (const dataKey of Object.keys(COMPLIANCE_COLLECTIONS)) {
      expect(reportDataModules[dataKey as keyof typeof reportDataModules]?.loadCompliance).toEqual(expect.any(Function));
    }
  });

  it('gives water its own detail tabs and every other type the flat compliance view', () => {
    expect(reportDataModules.water_monitoring?.detailTabs?.().map(t => t.key)).toContain('watersupply');
    expect(reportDataModules.water_monitoring?.renderDetailTab).toEqual(expect.any(Function));
    for (const key of ['air_monitoring', 'hazardous_waste', 'eia'] as const) {
      expect(reportDataModules[key]?.ComplianceView).toBeDefined();
      expect(reportDataModules[key]?.detailTabs).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman src/region/__tests__/modules.test.ts`
Expected: FAIL — `Cannot find module '../modules'`.

- [ ] **Step 3: Move the per-type view types into the region**

`src/region/complianceViews.ts` — move `WaterComplianceView`, `HazwasteComplianceView`, `AirComplianceView` and `EiaComplianceView` (with their comments) out of `useInspectionReport.ts` verbatim, then add:

```ts
import type { ChecklistEntry, ChecklistGroup, ConditionEntry } from '../features/inspections/hooks/useInspectionReport';
import type {
  DpConditionRow,
  PreviousInspectionState,
  SamplingPointCard,
  WwtpDetailCard,
} from '../features/inspections/water/waterTypes';

// …the four interfaces…

export type RegionComplianceView =
  | WaterComplianceView
  | HazwasteComplianceView
  | AirComplianceView
  | EiaComplianceView;
```

In `src/region/index.ts` add:

```ts
export type {
  AirComplianceView,
  EiaComplianceView,
  HazwasteComplianceView,
  RegionComplianceView,
  WaterComplianceView,
} from './complianceViews';
```

In `useInspectionReport.ts` delete the four interfaces and the `../water/waterTypes` type import (lines 8–13), and replace the `ComplianceView` union with:

```ts
import type { RegionComplianceView } from '../../../region';

// What the detail screen holds for a report's compliance row: one of the
// region's per-type views (src/region/complianceViews.ts), or none yet.
export type ComplianceView = RegionComplianceView | { kind: 'none' };
```

Run `npm run typecheck`; for each "has no exported member 'WaterComplianceView'" (or Air/Hazwaste/Eia) error, import that type from the region entry point instead — e.g. from `src/features/inspections/water/*`, `import type { WaterComplianceView } from '../../../region';`.

- [ ] **Step 4: Add the module contract**

Append to `src/core/region/contract.ts`:

```ts
import type { TwoRowMainTabDef } from '../../features/inspections/components/TwoRowTabs';
import type { ComplianceView, InspectionReportSummary } from '../../features/inspections/hooks/useInspectionReport';

/** What the report detail screen hands a region-owned tab. */
export interface DetailTabProps {
  report: InspectionReportSummary;
  compliance: ComplianceView;
  tabKey: string;
  canEdit: boolean;
  refetch: () => void;
}

/** Everything type-specific about one stored report type (inspection_reports.report_type). */
export interface ReportDataModule {
  /** Reads the report's compliance row; null when none exists yet. */
  loadCompliance(reportId: string): Promise<Exclude<ComplianceView, { kind: 'none' }> | null>;
  /** The flat "Compliance Status" read view. Omit when renderDetailTab owns the compliance tab. */
  ComplianceView?: React.ComponentType<{ compliance: Exclude<ComplianceView, { kind: 'none' }> }>;
  /** Replaces DEFAULT_REPORT_DETAIL_TABS for this type. */
  detailTabs?(): TwoRowMainTabDef[];
  /**
   * Renders any tab the foundation doesn't own (it owns general, purpose and
   * attachments). Return null for tabs this type doesn't render.
   */
  renderDetailTab?(props: DetailTabProps): React.ReactNode;
}

/** The `src/region/modules` entry point. */
export interface RegionModulesIndex {
  reportDataModules: Partial<Record<string, ReportDataModule>>;
}
```

and in `assertRegion.ts` add:

```ts
import * as regionModulesIndex from '../../region/modules';
// (add RegionModulesIndex to the contract import)
export const regionModulesIndexCheck: RegionModulesIndex = regionModulesIndex;
```

- [ ] **Step 5: Move the compliance loaders**

`src/region/compliance/loaders.ts`:

```ts
import { Q } from '@nozbe/watermelondb';
import { collections } from '../../db/database';
import { airChecklistGroupsFrom } from '../../features/inspections/air/airChecklistGroups';
import type { AirComplianceView, EiaComplianceView, HazwasteComplianceView, WaterComplianceView } from '../complianceViews';

export async function loadWaterCompliance(reportId: string): Promise<WaterComplianceView | null> {
  const rows = await collections.complianceWater.query(Q.where('reportId', reportId)).fetch();
  const c = rows[0];
  if (!c) return null;
  return {
    kind: 'water',
    // …the remaining fields exactly as in loadInspectionReportDetail.ts's
    // water branch (complianceId … documentsReviewed)…
  };
}
```

and likewise `loadHazwasteCompliance` (from the `hazardous_waste` branch, `collections.complianceHazwaste`), `loadAirCompliance` (from the `air_monitoring` branch, `collections.complianceAir`, using `airChecklistGroupsFrom(c)`), and `loadEiaCompliance` (from the `eia` branch, `collections.complianceEia`) — each returning the branch's object literal unchanged, or `null` when there is no row.

In `loadInspectionReportDetail.ts`, delete the whole `if (reportModel.reportType === 'water_monitoring') { … } else if … ` chain (lines 84–191) and the `airChecklistGroupsFrom` import, and write:

```ts
  // The compliance row is type-specific; the region module for this report
  // type knows its table and shape (src/region/modules).
  const dataModule = reportDataModules[reportModel.reportType as ReportDataKey];
  const complianceView: ComplianceView = (await dataModule?.loadCompliance(reportModel.reportId)) ?? { kind: 'none' };
```

importing `reportDataModules` from `'../../../region/modules'` and `type ReportDataKey` from `'../../../region'`.

- [ ] **Step 6: Move the flat compliance views**

`src/region/compliance/ComplianceSections.tsx` — move from `ComplianceStatusView.tsx`, verbatim, the `ChecklistGroups` helper (lines 17–29) and the three components from the `// ── Type-specific views` comment up to the `// Water reports don't reach this component` comment. Rename them `HazwasteComplianceSection`, `AirComplianceSection`, `EiaComplianceSection`, change each prop from `{ c }` to `{ compliance: c }`, and export them. Imports: `React`, `View`/`Text` from `react-native`, `FormSection`/`TextField` from `'../../components/form'`, `ChecklistGroup` (type) from `'../../features/inspections/hooks/useInspectionReport'`, the read primitives from `'../../features/inspections/components/ComplianceReadPrimitives'`, and the view types from `'../complianceViews'`. Type each prop as the module contract passes it and narrow inside:

```tsx
export const AirComplianceSection: React.FC<{ compliance: RegionComplianceView }> = ({ compliance: c }) =>
  c.kind === 'air' ? (
    // …the original AirComplianceView JSX, unchanged…
  ) : null;
```

`ComplianceStatusView.tsx` keeps `EmptyCompliance` and becomes:

```tsx
interface ComplianceStatusViewProps {
  compliance: ComplianceView;
  reportType: string;
}

// The flat "Compliance Status" tab. Each report type's view is region-owned
// (src/region/modules); types that render their own compliance tabs, like
// EMB4B water, never reach this component.
export const ComplianceStatusView: React.FC<ComplianceStatusViewProps> = ({ compliance, reportType }) => {
  if (compliance.kind === 'none') return <EmptyCompliance />;
  const Section = reportDataModules[reportType as ReportDataKey]?.ComplianceView;
  return Section ? <Section compliance={compliance} /> : <EmptyCompliance />;
};
```

importing `reportDataModules` from `'../../../region/modules'` and `type ReportDataKey` from `'../../../region'`; drop the imports only the moved components used.

- [ ] **Step 7: Move water's detail tabs out of the detail screen**

`src/region/compliance/waterDetail.tsx`:

```tsx
import React from 'react';
import type { DetailTabProps } from '../../core/region/contract';
import { DenrPermitsSection } from '../../features/inspections/components/DenrPermitsSection';
import { patchPermitsSnapshot } from '../../features/inspections/permitsSnapshotPersistence';
import { WaterExtraSectionsView } from '../../features/inspections/water/WaterComplianceEditSections';
import { buildWaterReportTabs, establishmentHasDischargePermit } from '../../features/inspections/water/waterReportTabs';

const WATER_SECTION_TABS = ['watersupply', 'wastewaterpollution', 'samplingfindings'];

// Water reports get the full 1-6 section/subsection tab menu from the
// report template instead of DEFAULT_REPORT_DETAIL_TABS.
export function waterDetailTabs() {
  return buildWaterReportTabs({ includeAttachments: true });
}

export function renderWaterDetailTab({ report, compliance, tabKey, canEdit, refetch }: DetailTabProps): React.ReactNode {
  if (tabKey === 'compliance') {
    return (
      <DenrPermitsSection
        permits={report.permitsSnapshot}
        canEdit={canEdit}
        onSave={next => patchPermitsSnapshot(report.reportId, next)}
        onSaved={refetch}
      />
    );
  }
  if (compliance.kind === 'water' && WATER_SECTION_TABS.includes(tabKey)) {
    const tabs = waterDetailTabs();
    return (
      <WaterExtraSectionsView
        compliance={compliance}
        canEdit={canEdit}
        onSaved={refetch}
        mainTab={tabs.find(t => t.key === tabKey) ?? tabs[0]}
        hasDp={establishmentHasDischargePermit(report.permitsSnapshot)}
        province={report.establishmentSnapshot.province}
      />
    );
  }
  return null;
}
```

- [ ] **Step 8: Create the modules entry point**

`src/region/modules/index.ts`:

```ts
// The src/region/modules entry point: per-type UI and logic. Imported only
// by the foundation's host screens (detail screen, Add Report panel, the
// new-inspection route, the export mapper) — never at module scope by
// anything those screens' children import, which keeps it cycle-free.
import type { ReportDataModule } from '../../core/region/contract';
import type { ReportDataKey } from '../catalog';
import { AirComplianceSection, EiaComplianceSection, HazwasteComplianceSection } from '../compliance/ComplianceSections';
import { loadAirCompliance, loadEiaCompliance, loadHazwasteCompliance, loadWaterCompliance } from '../compliance/loaders';
import { renderWaterDetailTab, waterDetailTabs } from '../compliance/waterDetail';

export const reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>> = {
  water_monitoring: {
    loadCompliance: loadWaterCompliance,
    detailTabs: waterDetailTabs,
    renderDetailTab: renderWaterDetailTab,
  },
  air_monitoring: { loadCompliance: loadAirCompliance, ComplianceView: AirComplianceSection },
  hazardous_waste: { loadCompliance: loadHazwasteCompliance, ComplianceView: HazwasteComplianceSection },
  eia: { loadCompliance: loadEiaCompliance, ComplianceView: EiaComplianceSection },
};
```

- [ ] **Step 9: Make the detail screen generic**

In `InspectionReportDetailScreen.tsx`:
- Delete the imports of `ComplianceStatusView`'s neighbours that move out — `DenrPermitsSection`, `patchPermitsSnapshot`, `WaterExtraSectionsView`, `buildWaterReportTabs`, `establishmentHasDischargePermit` — and the `WATER_REPORT_TYPE` constant (line 27).
- Add `import { reportDataModules } from '../../../region/modules';` and `import type { ReportDataKey } from '../../../region';`.
- Replace lines 129–137 (the `isWater` / `hasDp` / `waterTabs` / `tabs` / `activeMainTab` / `activeWaterMainTab` block and its comment) with:

```tsx
  // A report type may bring its own tab menu (EMB4B water's 1-6 sections);
  // everything else keeps DEFAULT_REPORT_DETAIL_TABS. See src/region/modules.
  const dataModule = reportDataModules[report.reportType as ReportDataKey];
  const tabs = dataModule?.detailTabs?.() ?? DEFAULT_REPORT_DETAIL_TABS;
  const activeMainTab = tabs.find(t => t.key === activeMain) ?? tabs[0];
```

- Replace the `compliance` tab and water-sections blocks (lines 217–237, from `{activeMainTab.key === 'compliance' &&` through the closing `)}` of the `WaterExtraSectionsView` block) with:

```tsx
          {dataModule?.renderDetailTab
            ? dataModule.renderDetailTab({ report, compliance, tabKey: activeMainTab.key, canEdit, refetch })
            : activeMainTab.key === 'compliance' && (
                <ComplianceStatusView compliance={compliance} reportType={report.reportType} />
              )}
```

- [ ] **Step 10: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman src/region src/features/inspections src/features/export && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: all PASS, including the existing `loadInspectionReportDetail.test.ts` unchanged.

- [ ] **Step 11: Commit**

```bash
git add -A src/region src/core/region src/features/inspections src/features/export
git commit -m "refactor(reports): load and show compliance through region report modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Report forms via region modules; move water and air into the region

**Files:**
- Modify: `src/core/region/contract.ts`, `src/region/modules/index.ts`, `src/region/__tests__/modules.test.ts`
- Modify: `src/app/(app)/inspection/new.tsx:6,13-15`, `src/features/inspections/components/AddReportSplitPanel.tsx:35,146-155`, `src/features/inspections/water/WaterInspectionFormScreen.tsx:49-55`
- Move: `src/features/inspections/water/` → `src/region/inspections/water/`; `src/features/inspections/air/` → `src/region/inspections/air/`; `src/constants/waterbodies.ts` (+ `.test.ts`) → `src/region/data/`; `src/data/mimaropaWaterbodies.ts` → `src/region/data/`

**Interfaces:**
- Consumes: `reportDataModules` (Task 7).
- Produces: contract `ShellStart`, `ReportFormModule`; `reportForms: Partial<Record<ReportTypeKey, ReportFormModule>>` from `src/region/modules`; `RegionModulesIndex.reportForms`.

- [ ] **Step 1: Write the failing test**

Append to `src/region/__tests__/modules.test.ts` (and add `reportForms` to its `'../modules'` import):

```ts
  it('opens water — the only enabled create entry — through both form surfaces', () => {
    expect(reportForms.water?.NewFormScreen).toBeDefined();
    expect(reportForms.water?.FormShell).toBeDefined();
    expect(Object.keys(reportForms)).toEqual(['water']);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman src/region/__tests__/modules.test.ts`
Expected: FAIL — `reportForms` is `undefined`.

- [ ] **Step 3: Move `ShellStart` into the contract and add the form module**

Append to `src/core/region/contract.ts`:

```ts
import type { GeneralInfoFormState, PurposeFormState } from '../../features/inspections/types';

/** What the Add Report panel already collected when it opens a type's form. */
export interface ShellStart {
  estabId: string | null; // null when creating a brand-new establishment
  initialGeneralInfo: GeneralInfoFormState;
  initialInspectionDate?: string;
  initialPurpose?: PurposeFormState;
  initialControlNumber?: string;
}

/** The forms for one create entry (REPORT_TYPES key). */
export interface ReportFormModule {
  /** Rendered by /inspection/new?type=<key>. */
  NewFormScreen?: React.ComponentType;
  /** Rendered by the establishment's Add Report panel once the shared steps are done. */
  FormShell?: React.ComponentType<{ start: ShellStart }>;
}
```

and add `reportForms: Partial<Record<string, ReportFormModule>>;` to `RegionModulesIndex`.

In `WaterInspectionFormScreen.tsx`, delete the local `export interface ShellStart { … }` (lines 49–55) and add `import type { ShellStart } from '../../../core/region/contract';`. In `src/region/modules/index.ts` add:

```ts
import type { ReportFormModule } from '../../core/region/contract';
import type { ReportTypeKey } from '../catalog';
import { WaterFormShell, WaterInspectionFormScreen } from '../../features/inspections/water/WaterInspectionFormScreen';

export const reportForms: Partial<Record<ReportTypeKey, ReportFormModule>> = {
  water: { NewFormScreen: WaterInspectionFormScreen, FormShell: WaterFormShell },
};
```

(merge the `import type` lines with the existing ones).

- [ ] **Step 4: Route both form surfaces through `reportForms`**

`src/app/(app)/inspection/new.tsx` — delete the `WaterInspectionFormScreen` import and replace the `if (type === 'water') { … }` block with:

```tsx
  const form = type ? reportForms[type as ReportTypeKey] : undefined;
  if (form?.NewFormScreen) {
    return <form.NewFormScreen />;
  }
```

importing `reportForms` from `'../../../region/modules'` and `type ReportTypeKey` from `'../../../region'`.

`src/features/inspections/components/AddReportSplitPanel.tsx` — replace `import { WaterFormShell, ShellStart } from '../water/WaterInspectionFormScreen';` with `import { reportForms } from '../../../region/modules';` and `import type { ShellStart } from '../../../core/region/contract';`, then replace `if (started && selectedType === 'water' && generalInfo) {` … `return <WaterFormShell start={start} />;` with:

```tsx
  const FormShell = selectedType ? reportForms[selectedType]?.FormShell : undefined;
  if (started && FormShell && generalInfo) {
    const start: ShellStart = {
      estabId,
      initialGeneralInfo: generalInfo,
      initialInspectionDate: purpose.inspectionDate,
      initialPurpose: purpose,
      initialControlNumber: controlNumber,
    };
    return <FormShell start={start} />;
  }
```

- [ ] **Step 5: Run tests before the move**

Run: `npx jest --ci --no-watchman src/region src/features/inspections src/app && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Move water, air and the waterbody data into the region**

```bash
node scripts/move-module.js src/features/inspections/water src/region/inspections/water
node scripts/move-module.js src/features/inspections/air src/region/inspections/air
node scripts/move-module.js src/constants/waterbodies.ts src/region/data/waterbodies.ts
node scripts/move-module.js src/constants/waterbodies.test.ts src/region/data/waterbodies.test.ts
node scripts/move-module.js src/data/mimaropaWaterbodies.ts src/region/data/mimaropaWaterbodies.ts
```

`src/data/` is now empty; remove the directory if git left it.

- [ ] **Step 7: Clear remaining boundary violations**

Run: `npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0`
Expected: no errors. If a foundation file still imports a moved file directly, route it through an entry point: a view type → `src/region`; a module → `src/region/modules`. If a foundation *test* imports a moved file, it is testing region behavior — move it next to that code with `node scripts/move-module.js`.

- [ ] **Step 8: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: the full suite PASSES.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "refactor(water): open report forms through region modules and move water and air into the region

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Export templates and mappers via the region

**Files:**
- Create: `src/region/templates.ts`
- Move: `src/features/export/mappers/water.ts` (+ `water.test.ts`) → `src/region/export/`; `src/features/export/mappers/survey.ts` (+ `survey.test.ts`) → `src/region/export/`
- Modify: `src/core/region/contract.ts`, `src/region/index.ts`, `src/region/modules/index.ts`, `src/region/__tests__/modules.test.ts`
- Modify: `src/features/export/templates/index.ts`, `src/features/export/mappers/index.ts`, `src/features/export/mappers/primitives.ts`

**Interfaces:**
- Consumes: `reportDataModules` (Task 7).
- Produces: `ReportDataModule.mapExport?(bundle: InspectionBundle, ctx: MapContext): TemplateData`; `mapSurveyBundle` from `src/region/modules`; `unusedBoxes(count)` exported from `primitives.ts`; `TEMPLATES`, `UNUSED_CHECKBOXES`, `SURVEY_TEMPLATE_KEY`, `FALLBACK_APPROVERS` from `src/region` (re-exported unchanged by `src/features/export/templates/index.ts`).

- [ ] **Step 1: Write the failing test**

Append to `src/region/__tests__/modules.test.ts` (add `mapSurveyBundle` to the `'../modules'` import):

```ts
  it('can export every report type that has a template', () => {
    for (const key of ['water_monitoring', 'air_monitoring', 'hazardous_waste', 'eia'] as const) {
      expect(reportDataModules[key]?.mapExport).toEqual(expect.any(Function));
    }
    expect(mapSurveyBundle).toEqual(expect.any(Function));
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman src/region/__tests__/modules.test.ts`
Expected: FAIL — `mapExport` is `undefined`.

- [ ] **Step 3: Move the template registry data into the region**

`src/region/templates.ts` — move from `src/features/export/templates/index.ts`, verbatim with their comments: `WATER_APPROVERS`, `HAZWASTE_APPROVERS`, `TEMPLATES`, `UNUSED_CHECKBOXES`, `SURVEY_TEMPLATE_KEY`. Fix each `require('../../../../assets/templates/<file>.docx')` to `require('../../assets/templates/<file>.docx')`. Import `type { Approvers, TemplateEntry }` from `'../features/export/templates'`. Export `TEMPLATES`, `UNUSED_CHECKBOXES`, `SURVEY_TEMPLATE_KEY`, and add:

```ts
// Printed on any report type without its own approver pair.
export const FALLBACK_APPROVERS: Approvers = WATER_APPROVERS;
```

Add `export * from './templates';` to `src/region/index.ts`, and add to `RegionIndex` in the contract (with `import type { Approvers, TemplateEntry } from '../../features/export/templates';`):

```ts
  TEMPLATES: Partial<Record<string, TemplateEntry>>;
  UNUSED_CHECKBOXES: Record<string, number>;
  SURVEY_TEMPLATE_KEY: string;
  FALLBACK_APPROVERS: Approvers;
```

`src/features/export/templates/index.ts` keeps `Approvers`, `TemplateEntry`, `templateFor`, `hasTemplate` and `defaultApproversFor`, and re-exports the data so its importers and tests don't change:

```ts
import { FALLBACK_APPROVERS, SURVEY_TEMPLATE_KEY, TEMPLATES } from '../../../region';

// The template files, approver defaults and unused-checkbox counts are
// region-owned (src/region/templates.ts); the lookups stay here.
export { SURVEY_TEMPLATE_KEY, TEMPLATES, UNUSED_CHECKBOXES } from '../../../region';
```

and in `defaultApproversFor`, replace `?? WATER_APPROVERS` with `?? FALLBACK_APPROVERS`.

- [ ] **Step 4: Move the mappers and dispatch through the modules**

```bash
node scripts/move-module.js src/features/export/mappers/water.ts src/region/export/water.ts
node scripts/move-module.js src/features/export/mappers/water.test.ts src/region/export/water.test.ts
node scripts/move-module.js src/features/export/mappers/survey.ts src/region/export/survey.ts
node scripts/move-module.js src/features/export/mappers/survey.test.ts src/region/export/survey.test.ts
```

In `src/features/export/mappers/primitives.ts`, move `unusedBoxes` there from `mappers/index.ts` and export it:

```ts
// Fills the template's pre-existing ☐ glyphs that no field maps to
// (unused_1 … unused_N) so they print unticked.
export function unusedBoxes(count: number): TemplateData {
  const out: TemplateData = {};
  for (let i = 1; i <= count; i += 1) out[`unused_${i}`] = UNTICKED;
  return out;
}
```

Add `mapExport?(bundle: InspectionBundle, ctx: MapContext): TemplateData;` to `ReportDataModule` in the contract (with `import type { InspectionBundle, MapContext, SurveyBundle, TemplateData } from '../../features/export/types';`), and `mapSurveyBundle?: (bundle: SurveyBundle, ctx: MapContext) => TemplateData;` to `RegionModulesIndex`.

In `src/region/modules/index.ts`:

```ts
import { mapCommon } from '../../features/export/mappers/common';
import { unusedBoxes } from '../../features/export/mappers/primitives';
import type { InspectionBundle, MapContext } from '../../features/export/types';
import { mapSurvey } from '../export/survey';
import { mapWater } from '../export/water';
import { UNUSED_CHECKBOXES } from '../templates';

// Types whose template has no type-specific tags yet: the shared block
// only, plus their pre-existing checkboxes printed unticked.
const mapCommonOnly = (dataKey: ReportDataKey) => (bundle: InspectionBundle, ctx: MapContext) => ({
  ...mapCommon(bundle, ctx),
  ...unusedBoxes(UNUSED_CHECKBOXES[dataKey] ?? 0),
});

export const mapSurveyBundle = mapSurvey;
```

and add `mapExport: mapWater` to `water_monitoring`, `mapExport: mapCommonOnly('air_monitoring')` to `air_monitoring`, `mapExport: mapCommonOnly('hazardous_waste')` to `hazardous_waste`, and `mapExport: mapCommonOnly('eia')` to `eia`.

`src/features/export/mappers/index.ts` becomes:

```ts
import { mapSurveyBundle, reportDataModules } from '../../../region/modules';
import type { ReportDataKey } from '../../../region';
import type { MapContext, ReportBundle, TemplateData } from '../types';

// Each report type's mapper is region-owned (src/region/modules).
export function mapBundle(bundle: ReportBundle, ctx: MapContext): TemplateData {
  if (bundle.kind === 'survey') {
    if (!mapSurveyBundle) throw new Error('No mapper for survey reports');
    return mapSurveyBundle(bundle, ctx);
  }
  const mapExport = reportDataModules[bundle.report.reportType as ReportDataKey]?.mapExport;
  if (!mapExport) throw new Error(`No mapper for report type ${bundle.report.reportType}`);
  return mapExport(bundle, ctx);
}
```

- [ ] **Step 5: Drop the last hard-coded report type in the export tab**

`src/features/establishments/components/ExportReportsTab.tsx:79` seeds the signatory sheet with `emptySignatories(fullName, 'inspection', 'water_monitoring')`; its own comment says that value is never shown (`openSheet` overwrites it). Change the third argument to `''` — `defaultApproversFor` then returns `FALLBACK_APPROVERS`, and the foundation no longer names a 4B type.

- [ ] **Step 6: Run tests, lint and typecheck**

Run: `npx jest --ci --no-watchman && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: the full suite PASSES — including `templateContract.test.ts`, `renderTemplates.test.ts`, `templates/index.test.ts` and `mappers/index.test.ts`, unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "refactor(reports): register export templates and mappers through the region

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Upstream-merge guide, docs and spec amendment

**Files:**
- Create: `docs/upstream-merge.md`
- Modify: `docs/sync-contract.md`, `README.md` (Project structure, Exporting reports)

- [ ] **Step 1: Write `docs/upstream-merge.md`**

It must cover, in this order:
1. **The two repos**: 4B (`emb4b/InspectPlus`) is upstream; 4A's `upstream` remote points at it. Foundation fixes always start in 4B.
2. **What is foundation**: everything outside `src/region/`, plus `_core_` migrations, `scripts/`, CI workflows. **What is region**: `src/region/**`, `_region_` migrations, `assets/templates/**`, `assets/icons/**`, `app.json`, `eas.json`, `.env*`, `supabase/seeds/**`. Region repos never edit foundation files; a needed foundation change goes to 4B first.
3. **The three entry points and the contract**: `src/region` (light), `src/region/db` (leaf), `src/region/modules` (heavy); `src/core/region/contract.ts`; `assertRegion.ts` makes `tsc` fail on drift; the ESLint rule guards imports.
4. **Merging upstream into 4A**: `git fetch upstream && git merge upstream/develop`, then `npm ci`, `npm run typecheck` (contract drift shows up here), `npx eslint …`, `npx jest --ci`, `npx supabase db reset && npx supabase test db`.
5. **WatermelonDB versions**: the schema version and migration list are region-owned (`src/region/db`). A foundation change to a core table bumps 4B's version and adds its step in 4B's `src/region/db/migrations.ts`; the 4A merge must append the same step to 4A's own list at 4A's next version. `migrationGuard` crashes the app at launch if a step is missing — never let a release ship that way.
6. **Server sync registry**: a new region table means a `_region_` migration with `push_<table>`/`pull_<table>` handlers and a `sync_tables` row (region `sync_order` band 100–899); never redefine `push_changes`/`pull_changes` in a region. `inspection_reports.report_type`'s check constraint lists 4B's values; a region redefines it in a `_region_` migration (`alter table public.inspection_reports drop constraint inspection_reports_report_type_check, add constraint … check (report_type in (…)))`.
7. **Known Phase 0 limits**: `purpose_of_inspection` and `survey_reports` (tables, models, sync, UI) are still foundation — pluggable in Phase 2; 4A keeps the `survey_reports` table empty and leaves `survey` out of its catalog until then. The export render and contract tests (`src/features/export/render/*.test.ts`) and their fixtures (`src/features/export/mappers/fixtures.ts`) exercise 4B's templates with 4B sample data; a region that replaces the templates replaces those fixtures and expected tags in the same change.

- [ ] **Step 2: Update the other docs**

- `docs/sync-contract.md`: add a "Server registry" section — `public.sync_tables`, the handler signatures from Task 6, ordering by `sync_order`, unchanged payload/response shapes.
- `README.md`: in Project structure add `region/  # region-owned code (EMB4B) — see docs/upstream-merge.md` under `src/`, and point the `src/features/inspections/water` reference implementation path to `src/region/inspections/water`; in "Exporting reports" mention that the template registry is `src/region/templates.ts`.

(The spec was already amended with this plan's decisions when the plan was written.)

- [ ] **Step 3: Refresh the knowledge graph**

Run: `graphify update .`
Expected: completes without error.

- [ ] **Step 4: Commit**

```bash
git add docs README.md graphify-out
git commit -m "docs(repo): document the region boundary and the upstream merge routine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Full verification

- [ ] **Step 1: Static checks and the full test suites**

Run: `npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck && npx jest --ci --no-watchman`
Expected: no lint errors, no type errors, every test passes.

Run: `npx supabase db reset && npx supabase test db`
Expected: every pgTAP file passes.

- [ ] **Step 2: Check nothing 4B-specific is left in the foundation**

Run: `grep -rnE "mimaropa|MIMAROPA|compliance_(water|air|eia|hazwaste)|Compliance(Water|Air|Hazwaste|Eia)\b|'water_monitoring'|'hazardous_waste'|'air_monitoring'" src --include=*.ts --include=*.tsx | grep -v "^src/region/" | grep -v "\.test\.\|__tests__\|__snapshots__\|src/features/export/mappers/fixtures.ts"`
Expected: no output. (`fixtures.ts` is test-support data, a documented Phase 0 limit — see `docs/upstream-merge.md`.) Anything printed is a foundation file still naming 4B vocabulary — route it through the region before finishing.

- [ ] **Step 3: Device smoke test (schema version unchanged, so no local migration runs)**

With the dev build installed on the phone and on this branch: `npx expo start --dev-client --clear` (restart Metro — moved assets need a fresh graph). On the device:
1. Existing establishments and reports are still listed (no local store reset).
2. The header and footer show the EMB4B strings.
3. The home speed dial lists the six types, with only water enabled.
4. Open an existing water report: all water tabs render, Compliance shows the DENR permits section, Attachments loads.
5. If an air, hazwaste or EIA report exists, its Compliance tab shows the flat view.
6. Create a water report from an establishment's Add Report panel and from the speed dial; save a draft; tap Sync Now — no errors.
7. Open the map picker: it starts on the MIMAROPA overview, and a dropped pin resolves to a barangay.
8. Export a water report to .docx — the file opens with the same content as before.

- [ ] **Step 4: Report**

Summarize what passed, with the command output, and anything that could not be checked (for example the pgTAP suite if Docker was unavailable — CI's `ci/supabase-db-tests` then covers it on push).
