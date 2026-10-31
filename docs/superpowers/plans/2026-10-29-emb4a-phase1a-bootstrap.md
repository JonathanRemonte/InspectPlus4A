# EMB4A Phase 1a — Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up InspectPlus EMB4A as its own app — a history-preserving fork of EMB4B that replaces only region content, syncs with its own hosted Supabase project, and ships through its own release pipeline.

**Architecture:** Two repositories. Part A runs in the 4B repo (`emb4b/InspectPlus`): the location-data scripts become region-neutral (driven by a region-owned `src/region/data/psgcSources.json`), and the database tests that assert on 4B's own tables become region-owned (`region_*` files). Part B runs in the new 4A repo (`JonathanRemonte/InspectPlus4A`), forked from 4B `develop` with `upstream` kept: it swaps `src/region/` for a CALABARZON region with an empty report catalog, starts its local database at version 1, removes 4B's compliance tables server-side, and wires identity, icon and releases. Any foundation test that turns out to depend on 4B data is fixed in 4B and merged downstream, never edited in 4A.

**Tech Stack:** Expo 55 / React Native 0.83, TypeScript 5.8, WatermelonDB, Jest, Node scripts (CommonJS), Supabase Postgres + pgTAP, EAS Build, GitHub Actions, Python 3 + Pillow (icon).

**Spec:** `docs/superpowers/specs/2026-10-29-emb4a-phase1a-bootstrap-design.md` (and the region contract described in `docs/upstream-merge.md`).

## Global Constraints

- 4A identity: package / bundle id `com.inspectplus.emb4a`; app name `InspectPlus EMB4A`; slug `inspectplus-emb4a`; scheme `inspectplus4a`; version `1.0.0`.
- 4A region strings: id `emb4a`; system name `EMB4A INSPECTION & MONITORING SYSTEM`; region label `EMB Region 4-A`; `releaseRepo: 'JonathanRemonte/InspectPlus4A'`.
- CALABARZON provinces: Batangas, Cavite, Laguna, Quezon, Rizal.
- Hosted dev project ref `fdhobiaeqoyqbywddeed`. The project URL and publishable key go only in 4A's git-ignored `.env` and in EAS environment variables — never in a tracked file (both repos are public). The database password is never written anywhere by an agent.
- 4B data must not change in Part A: `src/region/data/mimaropaBoundaries.json` byte-identical; `src/region/data/mimaropaLocations.ts` deep-equal including key order.
- 4A never edits foundation files. The region-owned set is `docs/upstream-merge.md` §2 plus the native lines added there in Task 3.
- Commits: Conventional Commits with an allowed scope; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook runs `npm test`; commit with Chocolatey's broken watchman shim hidden so the hook runs: `PATH="$(echo "$PATH" | tr ':' '\n' | grep -vi chocolatey/bin | paste -sd:)" git commit …`. Never `--no-verify`.
- Tests: `npx jest --ci --no-watchman <paths>`; lint `npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0`; types `npm run typecheck`. Android builds need `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=D:\tmp` in the same command.
- Test-account jurisdiction (deviation from the spec's "all five provinces", which the data model can't express — an account has one `province` plus municipalities): the Inspector is assigned **Laguna** and three Laguna municipalities; the Developer account sees everything.
- Developer-only actions (never done by an agent): `eas login` / `eas init`; adding `EXPO_TOKEN` to GitHub; `supabase login` and the database password; choosing hosted account passwords.

## File Structure

**Part A (4B repo)**
```
scripts/regionDefinition.js            load + validate src/region/data/psgcSources.json (new)
scripts/barangayNameMatch.js           matchFeature takes the region definition (no MIMAROPA tables)
scripts/build-barangay-boundaries.js   reads codes, envelope, paths from the definition
scripts/build-locations.js             builds LOCATIONS from the pinned PSGC address dataset (new)
scripts/__tests__/barangayNameMatch.test.js, regionDefinition.test.js, buildLocations.test.js
src/region/data/psgcSources.json       4B's region definition (new, region-owned)
src/region/data/mimaropaLocations.ts   regenerated (same data)
supabase/tests/rpc/region_*.sql        4B's compliance tests, renamed; region_sync_tables.sql (new)
supabase/tests/rls/region_table_exposure.sql  4B's compliance exposure assertions (new)
docs/upstream-merge.md                 native region lines, region test naming, psgcSources.json
```
**Part B (4A repo)**
```
src/region/{identity,locations,catalog,templates,complianceViews,index}.ts   4A versions
src/region/modules/index.ts, src/region/db/{index,tables,migrations,sync}.ts  empty 4A versions
src/region/data/psgcSources.json, calabarzonLocations.ts, calabarzonBoundaries.json
src/region/__tests__/*                 4A region tests
app.json, eas.json(projectId via app.json), android/app/build.gradle (applicationId),
android/app/src/main/res/values/strings.xml, AndroidManifest.xml (scheme), mipmaps, assets/icons
supabase/migrations/<ts>_region_emb4a_bootstrap.sql, supabase/tests/rpc/region_sync_tables.sql,
supabase/tests/rls/region_table_exposure.sql, supabase/seeds/dev/*.sql
```

---

## Part A — 4B repository

Work in a fresh worktree of `D:\Projects\InspectPlus` on branch `feat/region-neutral-location-data` from `develop` (`npm ci` in it). The main checkout holds uncommitted user edits — never stage them.

### Task 1: Region definition and a region-neutral boundary builder

**Files:**
- Create: `src/region/data/psgcSources.json`, `scripts/regionDefinition.js`, `scripts/__tests__/regionDefinition.test.js`
- Modify: `scripts/barangayNameMatch.js`, `scripts/build-barangay-boundaries.js`, `scripts/__tests__/barangayNameMatch.test.js`

**Interfaces:**
- Produces: `loadRegionDefinition(root?: string, relPath?: string) → RegionDefinition` from `scripts/regionDefinition.js`, where
  `RegionDefinition = { regionName: string, envelope: {w,s,e,n}, locations: { regionCode: string, provinceOrder: string[], extraBarangays: {province,city,barangay,note}[] }, boundaries: { provinceCodes: number[], extraMunicipalityCodes: number[], provinceByAdm2: Record<string,string>, municipalityAliases: Record<string,string>, barangayAliases: Record<string,{name:string,note:string}> }, outputs: { locations: string (absolute), boundaries: string (absolute) } }`.
- Produces: `matchFeature(props, muniNameByPsgc, index, def)` where `def` is `RegionDefinition['boundaries']`.

- [ ] **Step 1: Write the definition for 4B**

`src/region/data/psgcSources.json` (region-owned data; values are 4B's current hard-coded tables, moved verbatim):

```json
{
  "regionName": "MIMAROPA",
  "envelope": { "w": 114.0, "s": 7.0, "e": 123.5, "n": 14.5 },
  "locations": {
    "regionCode": "17",
    "provinceOrder": ["Occidental Mindoro", "Oriental Mindoro", "Marinduque", "Romblon", "Palawan"],
    "extraBarangays": [
      { "province": "Occidental Mindoro", "city": "San Jose", "barangay": "Naibuan", "note": "Created after the 2021 address dataset; present in PSGC 2023 boundaries" }
    ]
  },
  "boundaries": {
    "provinceCodes": [1704000000, 1705100000, 1705200000, 1705300000, 1705900000],
    "extraMunicipalityCodes": [1731500000],
    "provinceByAdm2": {
      "1704000000": "Marinduque",
      "1705100000": "Occidental Mindoro",
      "1705200000": "Oriental Mindoro",
      "1705300000": "Palawan",
      "1705900000": "Romblon",
      "1731500000": "Palawan"
    },
    "municipalityAliases": { "1731500000": "Puerto Princesa City (Capital)" },
    "barangayAliases": {
      "1704003020": { "name": "Pingan", "note": "PSGC \"Pinggan\", Gasan" },
      "1704005026": { "name": "Kiñaman", "note": "PSGC \"Kinyaman\", Santa Cruz" },
      "1705104009": { "name": "Surville (Pob.)", "note": "PSGC \"Sorville\", Lubang" },
      "1705104012": { "name": "Banaag At Pag-Asa (Pob.)", "note": "PSGC \"Banaag ng Pag-asa\", Lubang" },
      "1705209010": { "name": "Lumangbayan", "note": "PSGC \"Lumambayan\", Pinamalayan" },
      "1705901004": { "name": "Camod-Om", "note": "PSGC \"Comod-om\", Alcantara" },
      "1705907004": { "name": "Camandao", "note": "PSGC \"Camandag\", Looc (Romblon)" },
      "1705911002": { "name": "Binongahan", "note": "PSGC \"Binonga-an\", San Agustin" },
      "1705911006": { "name": "Cagbuaya", "note": "PSGC \"Cagbo-aya\", San Agustin" },
      "1705911013": { "name": "Binugusan", "note": "PSGC \"Hinugusan\", San Agustin" }
    }
  },
  "outputs": {
    "locations": "src/region/data/mimaropaLocations.ts",
    "boundaries": "src/region/data/mimaropaBoundaries.json"
  }
}
```

- [ ] **Step 2: Write the failing tests**

`scripts/__tests__/regionDefinition.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadRegionDefinition } = require('../regionDefinition');

function writeDef(def) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'region-def-'));
  fs.mkdirSync(path.join(root, 'src/region/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/region/data/psgcSources.json'), JSON.stringify(def));
  return root;
}

const VALID = {
  regionName: 'Test',
  envelope: { w: 1, s: 2, e: 3, n: 4 },
  locations: { regionCode: '99', provinceOrder: ['A'], extraBarangays: [] },
  boundaries: { provinceCodes: [1], extraMunicipalityCodes: [], provinceByAdm2: { 1: 'A' }, municipalityAliases: {}, barangayAliases: {} },
  outputs: { locations: 'src/region/data/aLocations.ts', boundaries: 'src/region/data/aBoundaries.json' },
};

describe('loadRegionDefinition', () => {
  it('loads the definition and resolves output paths against the repo root', () => {
    const root = writeDef(VALID);
    const def = loadRegionDefinition(root);
    expect(def.regionName).toBe('Test');
    expect(def.outputs.locations).toBe(path.join(root, 'src/region/data/aLocations.ts'));
    expect(def.outputs.boundaries).toBe(path.join(root, 'src/region/data/aBoundaries.json'));
  });

  it('rejects a definition missing a required section', () => {
    const root = writeDef({ ...VALID, boundaries: undefined });
    expect(() => loadRegionDefinition(root)).toThrow(/boundaries/);
  });

  it('rejects a province code with no province name', () => {
    const root = writeDef({ ...VALID, boundaries: { ...VALID.boundaries, provinceCodes: [1, 2] } });
    expect(() => loadRegionDefinition(root)).toThrow(/provinceByAdm2 has no entry for 2/);
  });
});
```

In `scripts/__tests__/barangayNameMatch.test.js`: change the require to `const { normalizeName, buildLocationIndex, matchFeature } = require('../barangayNameMatch');`, delete the `describe('PROVINCE_BY_ADM2', …)` block (that data now lives in the 4B region definition), and add above `describe('matchFeature', …)`:

```js
// A self-contained definition — the foundation test must not depend on any
// one region's data.
const DEF = {
  provinceByAdm2: { 1705300000: 'Palawan', 1705900000: 'Romblon', 1731500000: 'Palawan' },
  municipalityAliases: { 1731500000: 'Puerto Princesa City (Capital)' },
  barangayAliases: { 1705911013: { name: 'Binugusan', note: 'test alias' } },
};
```

then pass `DEF` as the fourth argument in every `matchFeature(...)` call, and replace the two alias assertions `expect(MUNICIPALITY_ALIASES[1731500000]).toBe(...)` / `expect(BARANGAY_ALIASES[1705911013]).toBe(...)` with `expect(DEF.municipalityAliases[1731500000]).toBe('Puerto Princesa City (Capital)')` / `expect(DEF.barangayAliases[1705911013].name).toBe('Binugusan')`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest --ci --no-watchman scripts/__tests__/regionDefinition.test.js scripts/__tests__/barangayNameMatch.test.js`
Expected: FAIL — `Cannot find module '../regionDefinition'`; matchFeature tests fail because the 4th argument is ignored.

- [ ] **Step 4: Implement**

`scripts/regionDefinition.js`:

```js
// Loads the region definition (src/region/data/psgcSources.json) the
// location-data builders run from — which PSGC codes, names and outputs make
// up this repo's region. The file is region-owned; these scripts are not.
const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = 'src/region/data/psgcSources.json';

function loadRegionDefinition(root = path.resolve(__dirname, '..'), relPath = DEFAULT_PATH) {
  const def = JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
  for (const key of ['regionName', 'envelope', 'locations', 'boundaries', 'outputs']) {
    if (!def[key]) throw new Error(`${relPath}: missing "${key}"`);
  }
  for (const code of [...def.boundaries.provinceCodes, ...def.boundaries.extraMunicipalityCodes]) {
    if (!def.boundaries.provinceByAdm2[code]) throw new Error(`${relPath}: provinceByAdm2 has no entry for ${code}`);
  }
  return {
    ...def,
    outputs: {
      locations: path.join(root, def.outputs.locations),
      boundaries: path.join(root, def.outputs.boundaries),
    },
  };
}

module.exports = { loadRegionDefinition, DEFAULT_PATH };
```

`scripts/barangayNameMatch.js`:
- Change the header's "(src/data/mimaropaLocations.ts)" to "(the region's LOCATIONS table)".
- Keep the comment above `normalizeName` but replace "somewhere in MIMAROPA" with "somewhere in a region's data".
- Delete `PROVINCE_BY_ADM2`, `MUNICIPALITY_ALIASES`, `BARANGAY_ALIASES` (now in the definition).
- `matchFeature(props, muniNameByPsgc, index, def)`: use `def.provinceByAdm2[props.adm2_psgc]`, `def.municipalityAliases[props.adm3_psgc]`, and `def.barangayAliases[props.adm4_psgc]?.name` where the constants were used.
- `module.exports = { normalizeName, buildLocationIndex, matchFeature };`

`scripts/build-barangay-boundaries.js`:
- Header: replace "Builds src/data/mimaropaBoundaries.json" with "Builds the region's barangay boundary bundle (path from src/region/data/psgcSources.json)" and "for the 73 MIMAROPA municipalities" with "for the region's municipalities".
- Replace `PROVINCE_CODES`, `PUERTO_PRINCESA`, `OUT`, `LOCATIONS_TS` with `const def = loadRegionDefinition();` and use `def.boundaries.provinceCodes`, `def.boundaries.extraMunicipalityCodes`, `def.outputs.boundaries`, `def.outputs.locations`.
- `muniCodes` becomes `[...Object.keys(muniNameByPsgc).map(Number), ...def.boundaries.extraMunicipalityCodes].sort()`.
- Replace `PROVINCE_BY_ADM2[...]` with `def.boundaries.provinceByAdm2[...]`; pass `def.boundaries` as the 4th argument to both `matchFeature` calls.
- Replace `MIMAROPA_ENVELOPE` with `def.envelope`; error text `BBOX OUTSIDE ${def.regionName}`; keep its comment generic ("the region's envelope, generously padded").
- Update the require of `./barangayNameMatch` to drop the deleted names and add `const { loadRegionDefinition } = require('./regionDefinition');`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --ci --no-watchman scripts/__tests__`
Expected: PASS.

- [ ] **Step 6: Prove 4B's bundle is unchanged**

Run: `node scripts/build-barangay-boundaries.js && git diff --exit-code --stat src/region/data/mimaropaBoundaries.json && echo IDENTICAL`
Expected: the "Wrote N polygons…" line, then `IDENTICAL`. Any diff means the refactor changed behavior — fix the code, never commit a changed bundle.

- [ ] **Step 7: Commit**

```bash
git add scripts/regionDefinition.js scripts/barangayNameMatch.js scripts/build-barangay-boundaries.js scripts/__tests__/regionDefinition.test.js scripts/__tests__/barangayNameMatch.test.js src/region/data/psgcSources.json
git commit -m "refactor(region): drive the boundary builder from a region definition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Locations generator

**Files:**
- Create: `scripts/build-locations.js`, `scripts/__tests__/buildLocations.test.js`
- Modify (regenerated): `src/region/data/mimaropaLocations.ts`

**Interfaces:**
- Consumes: `loadRegionDefinition` (Task 1).
- Produces: `buildLocations({ provinces, cities, barangays }, locationsDef) → Record<string, Record<string, string[]>>`; `renderLocationsModule(locations) → string`.

- [ ] **Step 1: Write the failing test**

`scripts/__tests__/buildLocations.test.js`:

```js
const { buildLocations, renderLocationsModule } = require('../build-locations');

const DATA = {
  provinces: [
    { province_code: '9901', province_name: 'Beta', region_code: '99' },
    { province_code: '9902', province_name: 'Alpha', region_code: '99' },
    { province_code: '1001', province_name: 'Elsewhere', region_code: '10' },
  ],
  cities: [
    { city_code: '990101', city_name: 'Zeta City', province_code: '9901' },
    { city_code: '990102', city_name: 'Aston', province_code: '9901' },
    { city_code: '990201', city_name: 'Moro', province_code: '9902' },
  ],
  barangays: [
    { brgy_name: 'Poblacion', city_code: '990101' },
    { brgy_name: 'Bagong Silang', city_code: '990101' },
    { brgy_name: 'Ilaya', city_code: '990102' },
    { brgy_name: 'San Roque', city_code: '990201' },
  ],
};

const DEF = { regionCode: '99', provinceOrder: ['Beta', 'Alpha'], extraBarangays: [] };

describe('buildLocations', () => {
  it('keeps the definition’s province order and the dataset’s city order, and sorts barangays', () => {
    const out = buildLocations(DATA, DEF);
    expect(Object.keys(out)).toEqual(['Beta', 'Alpha']);
    expect(Object.keys(out.Beta)).toEqual(['Zeta City', 'Aston']);
    expect(out.Beta['Zeta City']).toEqual(['Bagong Silang', 'Poblacion']);
  });

  it('adds extra barangays in sorted position', () => {
    const out = buildLocations(DATA, { ...DEF, extraBarangays: [{ province: 'Alpha', city: 'Moro', barangay: 'Aguado', note: 'new' }] });
    expect(out.Alpha.Moro).toEqual(['Aguado', 'San Roque']);
  });

  it('rejects a province order that does not match the region’s provinces', () => {
    expect(() => buildLocations(DATA, { ...DEF, provinceOrder: ['Beta'] })).toThrow(/provinceOrder/);
  });

  it('rejects an extra barangay the dataset already has', () => {
    expect(() =>
      buildLocations(DATA, { ...DEF, extraBarangays: [{ province: 'Alpha', city: 'Moro', barangay: 'San Roque', note: '' }] }),
    ).toThrow(/already in the dataset/);
  });

  it('renders a TypeScript module exporting LOCATIONS', () => {
    const src = renderLocationsModule({ A: { B: ['C'] } });
    expect(src).toMatch(/^\/\/ Generated by scripts\/build-locations\.js/);
    expect(src).toContain('export const LOCATIONS: Record<string, Record<string, string[]>> = {');
    expect(src.trimEnd().endsWith('};')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --ci --no-watchman scripts/__tests__/buildLocations.test.js`
Expected: FAIL — `Cannot find module '../build-locations'`.

- [ ] **Step 3: Implement**

`scripts/build-locations.js`:

```js
#!/usr/bin/env node
// Builds the region's province -> city/municipality -> barangay table (the
// LOCATIONS the address dropdowns cascade through, bundled for offline use)
// from the PSGC-derived isaacdarcilla/philippine-addresses dataset, using the
// region definition in src/region/data/psgcSources.json.
//
// Usage:
//   node scripts/build-locations.js            # downloads into node_modules/.cache/psgc-addresses
//   node scripts/build-locations.js --from DIR # reads province.json / city.json / barangay.json from DIR

const fs = require('fs');
const path = require('path');
const { loadRegionDefinition } = require('./regionDefinition');

// Pinned to the commit `main` pointed at on 2026-10-29 (via
// `gh api repos/isaacdarcilla/philippine-addresses/commits/main --jq .sha`)
// so a regeneration can't silently pull different names.
const BASE = 'https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/d089df345669c13ebe8f9152c68c952aaccbb513';

async function fetchJson(file, dir) {
  const cached = path.join(dir, file);
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${res.status} fetching ${file}`);
  const text = await res.text();
  const parsed = JSON.parse(text); // throw before caching a bad body
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cached, text);
  return parsed;
}

function buildLocations({ provinces, cities, barangays }, def) {
  const regional = provinces.filter(p => p.region_code === def.regionCode);
  const names = regional.map(p => p.province_name).sort();
  if (JSON.stringify(names) !== JSON.stringify([...def.provinceOrder].sort())) {
    throw new Error(`provinceOrder [${def.provinceOrder.join(', ')}] does not match region ${def.regionCode}'s provinces [${names.join(', ')}]`);
  }
  const out = {};
  for (const name of def.provinceOrder) {
    const province = regional.find(p => p.province_name === name);
    out[name] = {};
    for (const city of cities.filter(c => c.province_code === province.province_code)) {
      out[name][city.city_name] = barangays.filter(b => b.city_code === city.city_code).map(b => b.brgy_name);
    }
  }
  for (const extra of def.extraBarangays) {
    const list = out[extra.province]?.[extra.city];
    if (!list) throw new Error(`extraBarangays: no ${extra.city}, ${extra.province}`);
    if (list.includes(extra.barangay)) throw new Error(`extraBarangays: ${extra.barangay} is already in the dataset — remove the extra`);
    list.push(extra.barangay);
  }
  for (const byCity of Object.values(out)) {
    for (const city of Object.keys(byCity)) byCity[city].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

function renderLocationsModule(locations) {
  return [
    '// Generated by scripts/build-locations.js from src/region/data/psgcSources.json',
    '// and the PSGC-derived isaacdarcilla/philippine-addresses dataset (pinned in the',
    '// script). Do not edit by hand — change the region definition and regenerate.',
    `export const LOCATIONS: Record<string, Record<string, string[]>> = ${JSON.stringify(locations, null, 2)};`,
    '',
  ].join('\n');
}

async function main() {
  const def = loadRegionDefinition();
  const fromIdx = process.argv.indexOf('--from');
  const dir = fromIdx >= 0 ? process.argv[fromIdx + 1] : path.join(__dirname, '..', 'node_modules', '.cache', 'psgc-addresses');
  const [provinces, cities, barangays] = await Promise.all(
    ['province.json', 'city.json', 'barangay.json'].map(f => fetchJson(f, dir)),
  );
  const locations = buildLocations({ provinces, cities, barangays }, def.locations);
  fs.writeFileSync(def.outputs.locations, renderLocationsModule(locations));
  const count = Object.values(locations).reduce((n, byCity) => n + Object.values(byCity).reduce((m, b) => m + b.length, 0), 0);
  console.log(`Wrote ${Object.keys(locations).length} provinces, ${count} barangays to ${path.relative(process.cwd(), def.outputs.locations)}.`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildLocations, renderLocationsModule };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --ci --no-watchman scripts/__tests__/buildLocations.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Regenerate 4B's table and prove the data is identical**

```bash
git show HEAD:src/region/data/mimaropaLocations.ts > "$TMP/old-locations.ts"
node scripts/build-locations.js
node -e "
const fs=require('fs');const load=f=>{const s=fs.readFileSync(f,'utf8');return JSON.parse(s.slice(s.indexOf('= {')+2).trim().replace(/;\$/,''));};
const a=load(process.argv[1]),b=load(process.argv[2]);
console.log(JSON.stringify(a)===JSON.stringify(b)?'SAME DATA AND ORDER':'DIFFERENT');" "$TMP/old-locations.ts" src/region/data/mimaropaLocations.ts
```
(`$TMP` is any scratch directory.) Expected: `SAME DATA AND ORDER`. `JSON.stringify` compares key order too. Then `node scripts/build-barangay-boundaries.js && git diff --exit-code --stat src/region/data/mimaropaBoundaries.json` must still show no change (the boundary builder reads this table).

- [ ] **Step 6: Run the region tests and commit**

Run: `npx jest --ci --no-watchman src/region scripts`
Expected: PASS.

```bash
git add scripts/build-locations.js scripts/__tests__/buildLocations.test.js src/region/data/mimaropaLocations.ts
git commit -m "feat(region): generate a region's locations table from the PSGC dataset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Region-own the database tests that assert 4B tables; document native region lines

**Files:**
- Rename: the 8 `supabase/tests/rpc/{pull,push}_changes_compliance_*.sql` → `supabase/tests/rpc/region_{pull,push}_changes_compliance_*.sql`
- Create: `supabase/tests/rpc/region_sync_tables.sql`, `supabase/tests/rls/region_table_exposure.sql`
- Modify: `supabase/tests/rpc/sync_tables_registry.sql`, `supabase/tests/rls/graphql_table_exposure.sql`, `docs/upstream-merge.md`

- [ ] **Step 1: Rename the compliance tests**

```bash
for f in supabase/tests/rpc/{pull,push}_changes_compliance_*.sql; do git mv "$f" "supabase/tests/rpc/region_$(basename "$f")"; done
```

- [ ] **Step 2: Make the registry test region-neutral**

Replace `supabase/tests/rpc/sync_tables_registry.sql` with (foundation rules only; plan 9):

```sql
begin;

select plan(9);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'core'),
  array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports', 'attachments'],
  'the foundation tables are registered, parents before children, attachments last'
);

select is(
  (select count(*)::int from public.sync_tables where owner = 'region' and sync_order not between 100 and 899),
  0,
  'every region table sits in the region band 100-899'
);

select is(
  (select max(sync_order) from public.sync_tables) ,
  (select sync_order from public.sync_tables where table_name = 'attachments'),
  'attachments is synced last'
);

select is(has_table_privilege('anon', 'public.sync_tables', 'SELECT'), false, 'anon cannot read sync_tables');

select is(has_table_privilege('authenticated', 'public.sync_tables', 'SELECT'), true, 'authenticated can read sync_tables');

select is(
  (select count(*)::int from public.sync_tables t
    where not has_function_privilege('authenticated', t.push_handler::oid, 'EXECUTE')
       or not has_function_privilege('authenticated', t.pull_handler::oid, 'EXECUTE')),
  0,
  'authenticated can execute every registered push and pull handler'
);

select is(
  (select count(*)::int from public.sync_tables t
    where has_function_privilege('anon', t.push_handler::oid, 'EXECUTE')
       or has_function_privilege('anon', t.pull_handler::oid, 'EXECUTE')),
  0,
  'anon cannot call any push or pull handler directly'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.pull_changes(0)->'changes') k),
  (select array_agg(table_name order by table_name) from public.sync_tables),
  'pull_changes emits exactly one key per registered table'
);

select is(
  public.push_changes('{}'::jsonb),
  '{"status": "ok"}'::jsonb,
  'an empty push still answers {"status":"ok"} with no conflicts key'
);

select * from finish();

rollback;
```

`supabase/tests/rpc/region_sync_tables.sql` (4B's own registry rows):

```sql
begin;

select plan(1);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'region'),
  array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'],
  'EMB4B registers its four compliance tables, in push order'
);

select * from finish();

rollback;
```

- [ ] **Step 3: Split the exposure test**

In `supabase/tests/rls/graphql_table_exposure.sql`, move every assertion that names a `compliance_*` table into a new `supabase/tests/rls/region_table_exposure.sql` with the same `begin; select plan(N); … select * from finish(); rollback;` frame (N = the number moved), and lower the original file's `plan(…)` by the same N. Assertion text is moved unchanged.

- [ ] **Step 4: Document the new region-owned pieces**

In `docs/upstream-merge.md` §2, add to the region-owned list:
- `src/region/data/psgcSources.json` (the region definition the location scripts read);
- database tests named `supabase/tests/**/region_*.sql`;
- in the native Android project, only these lines: `applicationId` in `android/app/build.gradle`, `app_name` in `android/app/src/main/res/values/strings.xml`, the app scheme (`<data android:scheme="…"/>` after the `VIEW` intent) in `android/app/src/main/AndroidManifest.xml`, and the launcher icons under `android/app/src/main/res/mipmap-*`.

Add to §4 a short "Regenerating location data" paragraph: `node scripts/build-locations.js` then `node scripts/build-barangay-boundaries.js`, both reading `src/region/data/psgcSources.json`; the boundary builder refuses to write until every polygon and every barangay match, and new aliases or extra barangays go in the region definition.

- [ ] **Step 5: Verify and commit**

Run: `npx jest --ci --no-watchman scripts src/region && npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 && npm run typecheck`
Expected: PASS. If Docker Desktop is running, also `npx supabase start && npx supabase db reset && npx supabase test db` (all files pass); otherwise CI's `ci/supabase-db-tests` is the check.

```bash
git add supabase/tests docs/upstream-merge.md
git commit -m "test(supabase): region-own the database tests that assert EMB4B tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Ship Part A

- [ ] **Step 1:** Push `feat/region-neutral-location-data` and open a PR against `develop` (body: what moved, that 4B data is byte-identical / deep-equal, the test split). Wait for CI green (`ci/supabase-db-tests` included).
- [ ] **Step 2:** Merge with a merge commit (the human approves the merge). Delete the branch.

---

## Part B — 4A repository

### Task 5: Fork into the 4A repository

- [ ] **Step 1: Clone and push history**

The folder exists and is empty; `git clone` accepts an empty target directory:

```bash
git clone --branch develop https://github.com/emb4b/InspectPlus.git "/d/Projects/InspectPlus (EMB4A)"
cd "/d/Projects/InspectPlus (EMB4A)"
git remote rename origin upstream
git remote add origin https://github.com/JonathanRemonte/InspectPlus4A.git
git push -u origin develop
git push origin develop:main
git remote -v
```
Expected: `origin` → InspectPlus4A, `upstream` → emb4b/InspectPlus; GitHub shows `develop` and `main`.

- [ ] **Step 2: Branch and install**

```bash
git switch -c feat/emb4a-bootstrap
npm ci
```
Create `.env` (git-ignored — verify with `git check-ignore .env`):
```
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=https://fdhobiaeqoyqbywddeed.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the publishable key the developer supplied>
```

All later Part B tasks commit on `feat/emb4a-bootstrap`.

### Task 6: Identity, app config and icon

**Files:**
- Modify: `src/region/identity.ts`, `app.json`, `android/app/build.gradle` (applicationId line only), `android/app/src/main/res/values/strings.xml`, `android/app/src/main/AndroidManifest.xml` (scheme line only)
- Create: `assets/icons/app_icon_night_mode.png` (replaced with badged artwork), regenerated `android/app/src/main/res/mipmap-*/ic_launcher*.webp`
- Test: `src/region/__tests__/region.test.ts`

- [ ] **Step 1: Write the failing identity test**

Replace the identity assertion in `src/region/__tests__/region.test.ts` with:

```ts
  it('identifies itself as EMB4A', () => {
    expect(region.identity).toEqual({
      id: 'emb4a',
      systemName: 'EMB4A INSPECTION & MONITORING SYSTEM',
      regionLabel: 'EMB Region 4-A',
      copyrightLine: '© 2026 EMB - Environmental Management Bureau, Region 4-A',
      releaseRepo: 'JonathanRemonte/InspectPlus4A',
    });
  });
```
(Remove the file's 4B-only assertions about MIMAROPA provinces and overview; Task 7 adds CALABARZON ones.) Run it: FAIL (still 4B identity).

- [ ] **Step 2: Implement identity and app config**

`src/region/identity.ts` values per the test. `app.json`: `name` `InspectPlus EMB4A`, `slug` `inspectplus-emb4a`, `scheme` `inspectplus4a`, `version` `1.0.0`, `ios.bundleIdentifier` and `android.package` `com.inspectplus.emb4a`, remove `extra.eas.projectId` (Task 12 sets the new one), keep `owner`. Permission strings mentioning "InspectPlus" become "InspectPlus EMB4A". `android/app/build.gradle`: `applicationId 'com.inspectplus.emb4a'` (leave `namespace 'com.inspectplus'` — it is the Kotlin package, not the install id). `strings.xml`: `<string name="app_name">InspectPlus EMB4A</string>`. `AndroidManifest.xml`: `<data android:scheme="inspectplus4a"/>`.

- [ ] **Step 3: Badge the icon**

Run this one-off (not committed) from the repo root, then the existing generator:

```bash
python - <<'EOF'
from PIL import Image, ImageDraw, ImageFont
p = "assets/icons/app_icon_night_mode.png"
im = Image.open(p).convert("RGBA"); w, h = im.size
r = int(w * 0.22); cx, cy = w - r - int(w * 0.04), h - r - int(h * 0.04)
d = ImageDraw.Draw(im)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(22, 163, 74, 255), outline=(255, 255, 255, 255), width=max(2, w // 64))
try:
    font = ImageFont.truetype("arialbd.ttf", int(r * 1.0))
except OSError:
    font = ImageFont.load_default()
d.text((cx, cy), "4A", fill=(255, 255, 255, 255), font=font, anchor="mm")
im.save(p)
EOF
python scripts/generate_app_icon.py
```
Expected: `wrote …ic_launcher.webp and …ic_launcher_round.webp` for five densities. Open `assets/icons/app_icon_night_mode.png` and confirm a legible green "4A" disc in the lower-right corner.

- [ ] **Step 4: Verify and commit**

Run: `npx jest --ci --no-watchman src/region/__tests__/region.test.ts` (PASS for the identity case).

```bash
git add src/region/identity.ts src/region/__tests__/region.test.ts app.json android/app/build.gradle android/app/src/main/res android/app/src/main/AndroidManifest.xml assets/icons/app_icon_night_mode.png
git commit -m "feat(region): give the app its EMB4A identity and icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: CALABARZON locations and boundaries

**Files:**
- Modify: `src/region/data/psgcSources.json` (4A definition), `src/region/locations.ts`
- Create: `src/region/data/calabarzonLocations.ts`, `src/region/data/calabarzonBoundaries.json` (generated)
- Delete: `src/region/data/mimaropaLocations.ts`, `src/region/data/mimaropaBoundaries.json`, `src/region/__tests__/resolveAddress.mimaropa.test.ts`
- Test: `src/region/__tests__/region.test.ts`, `src/region/__tests__/resolveAddress.calabarzon.test.ts`

- [ ] **Step 1: Write the 4A definition**

`src/region/data/psgcSources.json`:

```json
{
  "regionName": "CALABARZON",
  "envelope": { "w": 120.4, "s": 12.9, "e": 123.0, "n": 15.0 },
  "locations": {
    "regionCode": "04",
    "provinceOrder": ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"],
    "extraBarangays": []
  },
  "boundaries": {
    "provinceCodes": [401000000, 402100000, 403400000, 405600000, 405800000],
    "extraMunicipalityCodes": [431200000],
    "provinceByAdm2": {
      "401000000": "Batangas",
      "402100000": "Cavite",
      "403400000": "Laguna",
      "405600000": "Quezon",
      "405800000": "Rizal",
      "431200000": "Quezon"
    },
    "municipalityAliases": { "431200000": "Lucena City (Capital)" },
    "barangayAliases": {}
  },
  "outputs": {
    "locations": "src/region/data/calabarzonLocations.ts",
    "boundaries": "src/region/data/calabarzonBoundaries.json"
  }
}
```
Lucena City is a highly-urbanised city coded at province level in the boundary source (like Puerto Princesa in 4B) but listed under Quezon in the address dataset.

- [ ] **Step 2: Generate, then reconcile until the boundary builder accepts**

```bash
node scripts/build-locations.js
node scripts/build-barangay-boundaries.js
```
The boundary builder writes nothing until every polygon matches exactly one app barangay and every app barangay has a polygon. For each problem it prints:
- `UNMATCHED barangay: adm4 <code> "<PSGC name>" in <city>, <province>` with a near-identical app name in the same city → add `"<code>": { "name": "<app name>", "note": "PSGC \"<PSGC name>\", <city>" }` to `barangayAliases`;
- `UNMATCHED barangay` with no counterpart (created after the 2021 address dataset) → add `{ "province", "city", "barangay": "<PSGC name, title-cased like its neighbours>", "note": "Created after the 2021 address dataset; present in PSGC 2023 boundaries" }` to `extraBarangays` and rerun `build-locations.js` first;
- `UNMATCHED municipality` → add a `municipalityAliases` entry;
- `NO POLYGON: <barangay>, <city>, <province>` → a barangay the 2021 dataset has but 2023 PSGC merged or renamed: find the PSGC record (same city) and add an alias in the other direction, or, if it no longer exists, record that finding in the PR description and stop for a ruling;
- `BBOX OUTSIDE CALABARZON` → widen `envelope` only if the polygon is genuinely in CALABARZON (e.g. Polillo/Alabat islands), never to hide a wrong coordinate;
- `CENTROID MISMATCH` or `DUPLICATE` → stop and report; do not work around.

Repeat until it prints `Wrote N polygons for M barangays…`. Every alias and extra keeps a `note`.

- [ ] **Step 3: Point the region at the new data**

`src/region/locations.ts`:

```ts
import type { BoundaryEntry, RegionLocations } from '../core/region/contract';
import { LOCATIONS } from './data/calabarzonLocations';

// EMB Region 4-A (CALABARZON): Batangas, Cavite, Laguna, Quezon and Rizal.
export const locations: RegionLocations = {
  locations: LOCATIONS,
  // Frames all five provinces, Quezon's eastern coast included.
  overview: { center: [121.7, 14.0], zoom: 7 },
  // Polygons from scripts/build-barangay-boundaries.js; required inside the
  // function so app start never parses it.
  loadBoundaries: () => require('./data/calabarzonBoundaries.json') as BoundaryEntry[],
  outsideBoundariesLabel: 'Outside CALABARZON barangay boundaries',
};
```

Delete the MIMAROPA data files and `resolveAddress.mimaropa.test.ts` (`git rm`).

- [ ] **Step 4: Add the CALABARZON tests**

In `src/region/__tests__/region.test.ts` add:

```ts
  it('offers the five CALABARZON provinces', () => {
    expect(Object.keys(region.locations.locations)).toEqual(['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal']);
  });

  it('loads barangay boundaries lazily', () => {
    const entries = region.locations.loadBoundaries();
    expect(entries.length).toBeGreaterThan(4000);
    expect(new Set(entries.map(e => e.p))).toEqual(new Set(['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal']));
  });
```

`src/region/__tests__/resolveAddress.calabarzon.test.ts`:

```ts
import { region } from '..';
import { formatResolvedAddress, resolveAddress } from '../../features/location/resolveAddress';

// One point per province, inside each named city.
describe('resolveAddress in CALABARZON', () => {
  it.each([
    [14.2117, 121.1653, 'Laguna'], // Calamba City hall area
    [13.7565, 121.0583, 'Batangas'], // Batangas City
    [14.4791, 120.8970, 'Cavite'], // Cavite City
    [13.9373, 121.6170, 'Quezon'], // Lucena City
    [14.5865, 121.1753, 'Rizal'], // Antipolo City
  ])('places %f, %f in %s', (lat, lng, province) => {
    const address = resolveAddress(lat, lng);
    expect(address?.province).toBe(province);
    expect(region.locations.locations[province][address!.city]).toContain(address!.barangay);
  });

  it('labels a point in the sea as outside CALABARZON', () => {
    expect(resolveAddress(13.0, 120.0)).toBeNull();
    expect(formatResolvedAddress(null)).toBe('Outside CALABARZON barangay boundaries');
  });
});
```
Check `resolveAddress`'s exported signature in `src/features/location/resolveAddress.ts` and match it (it takes coordinates and returns `ResolvedAddress | null`). These coordinates are approximate city centres, not yet checked against the polygons: run the test, and for any point that resolves to `null` or the wrong province, replace it with the centre of a barangay bbox of that city taken from `calabarzonBoundaries.json` (and update the comment). Never loosen an assertion to make a point pass.

- [ ] **Step 5: Verify and commit**

Run: `npx jest --ci --no-watchman src/region/__tests__/region.test.ts src/region/__tests__/resolveAddress.calabarzon.test.ts scripts`
Expected: PASS.

```bash
git add -A src/region/data src/region/locations.ts src/region/__tests__
git commit -m "feat(region): bundle CALABARZON locations and barangay boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Empty report catalog, modules and views; remove 4B region content

**Files:**
- Replace: `src/region/catalog.ts`, `src/region/templates.ts`, `src/region/complianceViews.ts`, `src/region/index.ts`, `src/region/modules/index.ts`
- Delete: `src/region/inspections/`, `src/region/compliance/`, `src/region/export/`, `src/region/data/waterbodies.ts`, `src/region/data/waterbodies.test.ts`, `src/region/data/mimaropaWaterbodies.ts`, `assets/templates/` (the `.docx` files, `originals/`, `recipes/`, `*.tags.md`), and the 4B region tests: `src/region/__tests__/{catalog,modules,reportTypes,reportTypeDisplay,templates,signatories,templateContract,renderTemplates}.test.ts`
- Create: `src/region/__tests__/catalog.test.ts`, `src/region/__tests__/modules.test.ts` (4A versions)

- [ ] **Step 1: Write the failing 4A tests**

`src/region/__tests__/catalog.test.ts`:

```ts
import { COMPLIANCE_COLLECTIONS, COMPLIANCE_TAGS, ENABLED_TYPES, REPORT_TYPES, REPORT_TYPE_DISPLAY, TEMPLATES } from '..';

// EMB4A has no report types until the CHWMS forms land (Phase 3).
describe('EMB4A report-type catalog', () => {
  it('is empty', () => {
    expect(REPORT_TYPES).toEqual([]);
    expect(ENABLED_TYPES).toEqual([]);
    expect(REPORT_TYPE_DISPLAY).toEqual({});
    expect(COMPLIANCE_TAGS).toEqual([]);
    expect(COMPLIANCE_COLLECTIONS).toEqual({});
    expect(TEMPLATES).toEqual({});
  });
});
```

`src/region/__tests__/modules.test.ts`:

```ts
jest.mock('../../db/database', () => ({ collections: {}, database: {} }));

import { mapSurveyBundle, reportDataModules, reportForms } from '../modules';

describe('EMB4A report modules', () => {
  it('registers no report types and no survey export yet', () => {
    expect(reportDataModules).toEqual({});
    expect(reportForms).toEqual({});
    expect(mapSurveyBundle).toBeUndefined();
  });
});
```
Run them: FAIL.

- [ ] **Step 2: Replace the region files**

`src/region/catalog.ts`:

```ts
import type { ComplianceTagEntry, ReportType, ReportTypeDisplay } from '../core/region/contract';
import type { RegionCollections } from './db';

// EMB Region 4-A (CALABARZON). No report types yet: the CHWMS forms (RA 6969
// monitoring/survey, TRC, TSD, PDSF) arrive in Phase 3 of the region split
// (docs/superpowers/specs/2026-10-27-emb4a-region-split-design.md).
export type ReportTypeKey = never;
export type ReportDataKey = never;

export const ENABLED_TYPES: ReportTypeKey[] = [];
export const REPORT_TYPES: ReportType<ReportTypeKey, ReportDataKey>[] = [];
export const REPORT_TYPE_DISPLAY: Record<ReportDataKey, ReportTypeDisplay> = {};
export const DATA_KEY_TO_CREATE_KEY: Partial<Record<ReportDataKey, ReportTypeKey>> = {};

// Survey reports stay a foundation kind until Phase 2; EMB4A creates none, but
// the tag the foundation adds for one keeps its name.
export type ComplianceTag = 'Survey';
export const SURVEY_COMPLIANCE_TAG: ComplianceTag = 'Survey';
export const COMPLIANCE_TAGS: ComplianceTagEntry<ReportTypeKey, ReportDataKey, ComplianceTag>[] = [];

export const COMPLIANCE_COLLECTIONS: Partial<Record<ReportDataKey, keyof RegionCollections>> = {};

// The "documents reviewed" checklist the shared export block prints; EMB4A's
// forms define their own in Phase 3.
export const DOCUMENTS_REVIEWED_OPTIONS: string[] = [];
```

`src/region/templates.ts`:

```ts
import type { Approvers, TemplateEntry } from '../features/export/templates';

// No export templates until EMB4A's forms exist (Phase 3).
export const TEMPLATES: Partial<Record<string, TemplateEntry>> = {};
export const UNUSED_CHECKBOXES: Record<string, number> = {};
export const SURVEY_TEMPLATE_KEY = 'survey';

// Blank until EMB4A's signatories are configured; the export sheet lets the
// inspector fill them in.
export const FALLBACK_APPROVERS: Approvers = {
  recommendingName: '',
  recommendingPosition: '',
  approverName: '',
  approverPosition: '',
};
```

`src/region/complianceViews.ts`:

```ts
// EMB4A has no compliance views until its forms exist (Phase 3).
export type RegionComplianceView = never;
```

`src/region/modules/index.ts`:

```ts
// The src/region/modules entry point. EMB4A registers no report types until
// Phase 3; see src/region/catalog.ts.
import type { MapContext, SurveyBundle, TemplateData } from '../../features/export/types';
import type { ReportDataModule, ReportFormModule } from '../../core/region/contract';
import type { ReportDataKey, ReportTypeKey } from '../catalog';

export const reportDataModules: Partial<Record<ReportDataKey, ReportDataModule>> = {};
export const reportForms: Partial<Record<ReportTypeKey, ReportFormModule>> = {};
export const mapSurveyBundle: ((bundle: SurveyBundle, ctx: MapContext) => TemplateData) | undefined = undefined;
```

`src/region/index.ts`:

```ts
// EMB Region 4-A (CALABARZON). The light entry point: data the foundation
// reads at module scope. Heavy per-type UI lives behind src/region/modules.
import { identity } from './identity';
import { locations } from './locations';

export const region = {
  identity,
  locations,
};

export * from './catalog';
export * from './templates';
export type { RegionComplianceView } from './complianceViews';
```

Delete the directories and files listed under **Files** with `git rm -r`.

- [ ] **Step 3: Run the region tests**

Run: `npx jest --ci --no-watchman src/region`
Expected: the region tests PASS. `npm run typecheck` is expected to fail in foundation files that still name 4B types (e.g. `src/core/region/assertRegion.ts` requiring `WaterComplianceView`, `src/features/export/mappers/fixtures.ts`) — record every failing file and error in the report; Task 11 resolves them upstream. Do not edit any foundation file here.

- [ ] **Step 4: Commit**

```bash
git add -A src/region assets/templates
git commit -m "feat(region): start EMB4A with an empty report catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(If the hook's `npm test` fails only in foundation tests recorded in Step 3, stop and report — Task 11 runs before anything else is committed.)

### Task 9: Local database from version 1

**Files:**
- Replace: `src/region/db/index.ts`, `src/region/db/tables.ts`, `src/region/db/migrations.ts`, `src/region/db/sync.ts`
- Delete: `src/region/db/models/`, `src/region/db/migrations.test.ts`, `src/region/__tests__/schemaSnapshot.test.ts`, `src/region/__tests__/syncRegistry.test.ts` and their snapshots
- Create: `src/region/__tests__/schemaSnapshot.test.ts`, `src/region/__tests__/syncRegistry.test.ts` (4A versions)

- [ ] **Step 1: Write the failing tests**

`src/region/__tests__/schemaSnapshot.test.ts`:

```ts
import { schema } from '../../db/schema';

// Pins EMB4A's assembled local schema. Regenerate only for an intended change.
describe('EMB4A local schema', () => {
  it('is version 1 with only the foundation tables', () => {
    expect(schema.version).toBe(1);
    expect(Object.keys(schema.tables).sort()).toEqual(
      ['attachments', 'establishments', 'inspection_reports', 'purpose_of_inspection', 'survey_reports'],
    );
  });

  it('keeps every table and column', () => {
    const tables = Object.keys(schema.tables)
      .sort()
      .map(name => ({ name, columns: schema.tables[name].columnArray.map(c => ({ ...c })) }));
    expect(tables).toMatchSnapshot();
  });
});
```

`src/region/__tests__/syncRegistry.test.ts`:

```ts
import { PARENT_DEPENDENCIES } from '../../db/sync/collectPushChanges';
import { syncSchema } from '../../services/sync/syncSchema';

describe('EMB4A sync registry', () => {
  it('syncs only the foundation entities', () => {
    expect(Object.keys(syncSchema)).toEqual([
      'establishments',
      'purpose_of_inspection',
      'inspection_reports',
      'survey_reports',
      'attachments',
    ]);
  });

  it('adds no parent dependencies of its own', () => {
    expect(PARENT_DEPENDENCIES.every(d => !d.childEntity.startsWith('compliance_'))).toBe(true);
  });
});
```
Run: FAIL (version 16, compliance tables).

- [ ] **Step 2: Replace the region db**

`src/region/db/tables.ts`:
```ts
import type { TableSchema } from '@nozbe/watermelondb';

// EMB4A has no region tables until its forms exist (Phase 3).
export const regionTables: TableSchema[] = [];
```

`src/region/db/migrations.ts`:
```ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// EMB4A's local migration history. It starts at version 1: no device ever held
// EMB4B's store, so EMB4B's sixteen steps are not carried. A foundation change
// to a core table adds its step here at EMB4A's next version
// (docs/upstream-merge.md §5).
export const migrations = schemaMigrations({ migrations: [] });
```

`src/region/db/sync.ts`:
```ts
// EMB4A's synced region tables — none until Phase 3.
import type { ParentDependency } from '../../db/sync/collectPushChanges';
import type { SyncEntitySchema } from '../../services/sync/syncSchema';

export type RegionSyncEntityName = never;
export const regionSyncEntities: Record<RegionSyncEntityName, SyncEntitySchema> = {};
export const regionParentDependencies: ParentDependency[] = [];
export type RegionDtoMap = Record<never, never>;
```

`src/region/db/index.ts`:
```ts
// The src/region/db entry point. A leaf: src/db/schema.ts and
// src/db/database.ts import it, so nothing here may import src/db/database.
import type { Database } from '@nozbe/watermelondb';
import { migrations } from './migrations';
import { regionTables } from './tables';

export { regionParentDependencies, regionSyncEntities } from './sync';
export type { RegionDtoMap, RegionSyncEntityName } from './sync';

export const regionDb = {
  schemaVersion: 1,
  tables: regionTables,
  migrations,
  modelClasses: [],
};

// Spread into src/db/database.ts's `collections`; EMB4A has no region tables.
export function regionCollectionsFor(_database: Database) {
  return {};
}

export type RegionCollections = ReturnType<typeof regionCollectionsFor>;
```

Check `schemaMigrations({ migrations: [] })` yields `maxVersion` 1 (WatermelonDB defaults an empty list to version 1); if it does not, `src/db/migrationGuard.ts` will throw at startup — report it rather than editing the guard.

- [ ] **Step 3: Write the snapshot and verify**

Run: `npx jest --ci=false --no-watchman src/region/__tests__/schemaSnapshot.test.ts src/region/__tests__/syncRegistry.test.ts`
Expected: PASS, 1 snapshot written.

- [ ] **Step 4: Commit**

```bash
git add -A src/region/db src/region/__tests__
git commit -m "feat(db): start EMB4A's local schema at version 1 with no region tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Server bootstrap migration, database tests and seeds

**Files:**
- Create: `supabase/migrations/20261030090000_region_emb4a_bootstrap.sql`, `supabase/tests/rpc/region_sync_tables.sql` (4A version), `supabase/tests/rls/region_table_exposure.sql` (4A version), `supabase/seeds/dev/001_dev_developer_emb4a.sql`, `supabase/seeds/dev/002_dev_inspector_emb4a.sql`
- Delete: `supabase/tests/rpc/region_{pull,push}_changes_compliance_*.sql`, `supabase/seeds/dev/00{1..7}_dev_*.sql` (4B's)

- [ ] **Step 1: The bootstrap migration**

`supabase/migrations/20261030090000_region_emb4a_bootstrap.sql`:

```sql
begin;

-- EMB4A starts with no region tables. The fork inherits EMB4B's four
-- compliance tables; remove them in the order docs/upstream-merge.md §6
-- requires (registry rows, then handlers, then tables), and drop EMB4B's
-- report_type check (EMB4A's types arrive with its forms in Phase 3).

delete from public.sync_tables
  where table_name in ('compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia');

drop function public.push_compliance_air(jsonb);
drop function public.push_compliance_water(jsonb);
drop function public.push_compliance_hazwaste(jsonb);
drop function public.push_compliance_eia(jsonb);
drop function public.pull_compliance_air(bigint);
drop function public.pull_compliance_water(bigint);
drop function public.pull_compliance_hazwaste(bigint);
drop function public.pull_compliance_eia(bigint);

drop table public.compliance_air;
drop table public.compliance_water;
drop table public.compliance_hazwaste;
drop table public.compliance_eia;

alter table public.inspection_reports drop constraint inspection_reports_report_type_check;

commit;
```

- [ ] **Step 2: Region database tests**

Delete the eight `region_*_compliance_*.sql` files. Replace `supabase/tests/rpc/region_sync_tables.sql` with:

```sql
begin;

select plan(2);

select is(
  (select count(*)::int from public.sync_tables where owner = 'region'),
  0,
  'EMB4A registers no region tables yet'
);

select is(
  (select count(*)::int from information_schema.tables where table_schema = 'public' and table_name like 'compliance\_%'),
  0,
  'EMB4B''s compliance tables are gone'
);

select * from finish();

rollback;
```

Replace `supabase/tests/rls/region_table_exposure.sql` with the same frame and `select plan(1); select pass('EMB4A has no region tables to expose');`.

- [ ] **Step 3: Local seeds**

Delete 4B's seed files. Create two test-only seeds following the structure of the deleted `002_dev_inspector_jvremonte.sql` (auth.users with every token column `''`, auth.identities, public.user_accounts, public.inspector_municipalities):
- `001_dev_developer_emb4a.sql`: email `developer@emb4a.test`, password `Test@1234`, username `developer`, role `Developer`, region `Region 4A CALABARZON`, province `Laguna`, no municipalities, a fixed UUID of your choosing.
- `002_dev_inspector_emb4a.sql`: email `inspector1@emb4a.test`, password `Test@1234`, username `inspector1`, role `Inspector`, region `Region 4A CALABARZON`, province `Laguna`, municipalities = the first three city keys of `Laguna` in `src/region/data/calabarzonLocations.ts`, spelled exactly as there.
Each file starts with the header comment "Local dev login account, seeded on every `supabase db reset`. Test-only — never runs against a hosted or production database."

- [ ] **Step 4: Verify and commit**

If Docker is running: `npx supabase start && npx supabase db reset && npx supabase test db` — every file passes, and logging in to Studio's auth list shows the two accounts. Otherwise CI covers it.

```bash
git add -A supabase
git commit -m "feat(supabase): remove EMB4B's compliance tables and seed EMB4A test accounts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Foundation tests that depend on 4B data — fix upstream

Foundation tests and test fixtures may still assume EMB4B's region (e.g. `src/features/export/mappers/fixtures.ts` imports `WaterComplianceView`; `src/core/region/assertRegion.ts` requires it; tests that `it.each` over a catalog that is now empty). These are fixed **in 4B** and merged down.

- [ ] **Step 1: List them**

In the 4A repo: `npm run typecheck` and `npx jest --ci --no-watchman`. Record every failing foundation file (outside `src/region/`, `supabase/seeds`, `supabase/tests/**/region_*`).

- [ ] **Step 2: Fix each one in 4B**, on a 4B branch `test/region-neutral-foundation-tests` (fresh 4B worktree), with exactly one of:
  - **Move it to the region** when it asserts 4B data (e.g. the shared export fixtures and `mappers/common.test.ts`, `mappers/index.test.ts`, `exportReports.test.ts`): `node scripts/move-module.js <file> src/region/__tests__/export/<file name>`. Drop `WaterComplianceView` from `RegionTypeExportsCheck` in `src/core/region/assertRegion.ts` and from the contract's doc comment once no foundation file imports it.
  - **Make it region-neutral** when it tests shared behavior but iterates region data: derive cases from the catalog and guard the empty case, e.g.

    ```ts
    const ENABLED = REPORT_TYPES.filter(t => ENABLED_TYPES.includes(t.key));
    const describeWhenEnabled = ENABLED.length > 0 ? describe : describe.skip;
    ```
    and for `it.each(list)` use `(list.length ? it.each(list) : it.skip.each([[undefined]]))`.
  4B's full suite, lint and typecheck must stay green. Update `docs/upstream-merge.md` §7 for anything moved. Open the PR, CI green, merge (human approves).

- [ ] **Step 3: Merge upstream into 4A**

```bash
git fetch upstream
git merge upstream/develop
```
Resolve conflicts only by taking 4A's side for region-owned paths and 4B's side for foundation paths. Then `npm run typecheck`, `npx jest --ci --no-watchman`, lint — all green. Repeat Steps 1-3 if anything new appears.

- [ ] **Step 4: Open the 4A PR**

Push `feat/emb4a-bootstrap` to `origin` and open a PR into 4A `develop` (`gh pr create --repo JonathanRemonte/InspectPlus4A`). CI: `ci/lint-typecheck`, `ci/test`, `ci/supabase-db-tests` green (`ci/eas-build` runs only on pushes to `develop`/`main`). Merge (human approves).

### Task 12: Hosted backend, releases and the device check (developer-assisted)

- [ ] **Step 1 (developer): link and push the database**

```bash
npx supabase login
npx supabase link --project-ref fdhobiaeqoyqbywddeed
npx supabase db push
```
The developer enters the database password at the prompt. Expected: every migration applied, ending with `20261030090000_region_emb4a_bootstrap.sql`.

- [ ] **Step 2 (developer): create the accounts**

In the hosted project's SQL editor, run `supabase/scripts/create_user_account.sql` twice with its "Fill in" block set to the two accounts of Task 10 Step 3 (`v_region` `Region 4A CALABARZON`; the developer chooses real passwords, not `Test@1234`).

- [ ] **Step 3 (developer + agent): EAS project and secrets**

Developer: `npx eas login`, then `npx eas init` in the 4A repo (writes `extra.eas.projectId` to `app.json` — commit it on a branch and merge by PR). Developer: create an Expo access token and `gh secret set EXPO_TOKEN --repo JonathanRemonte/InspectPlus4A`. Agent, after `npx eas whoami` succeeds:

```bash
for envname in preview production; do
  npx eas env:create --environment "$envname" --name EXPO_PUBLIC_SUPABASE_URL --value https://fdhobiaeqoyqbywddeed.supabase.co --visibility plaintext --non-interactive
  npx eas env:create --environment "$envname" --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$PUBLISHABLE_KEY" --visibility plaintext --non-interactive
done
```
with `PUBLISHABLE_KEY` read from 4A's `.env`, never echoed.

- [ ] **Step 4: Release check**

The merge into 4A `develop` (Task 11 Step 4 or the projectId PR) triggers `ci/eas-build`. Expected: a pre-release `v1.0.0-dev.<run>` with `inspectplus.apk` on 4A's GitHub Releases.

- [ ] **Step 5: Device check**

Build and install the 4A dev client (`JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=D:\tmp npx expo run:android`; on MIUI allow USB installs), start Metro for 4A on port 8082 (`npx expo start --dev-client --port 8082` with `adb reverse tcp:8082 tcp:8082`) if 4B's Metro holds 8081. On the phone, with 4B still installed:
1. The launcher shows both apps; 4A's icon has the "4A" badge and the name InspectPlus EMB4A.
2. Log in as `inspector1@emb4a.test`; the header reads EMB4A and the greeting EMB Region 4-A.
3. Add an establishment in Laguna using the map picker — the pin resolves to a CALABARZON barangay.
4. Sync Now; the establishment row appears in the hosted project's Table Editor (`establishments`).
5. Install the pre-release APK from Step 4 over a clean install — it opens and reaches the hosted backend.
