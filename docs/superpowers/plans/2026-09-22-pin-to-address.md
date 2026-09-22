# Pin to Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirming a pin in the map picker fills Province / City / Barangay from bundled PSGC barangay boundaries (offline, exact dropdown strings), and the Latitude/Longitude row moves to the top of the address block in all four forms.

**Architecture:** A dev-time Node script downloads the 73 MIMAROPA medres barangay files from `faeldon/philippines-json-maps`, maps every polygon to the app's own `mimaropaLocations.ts` strings (normalizer + alias table, failing on any gap), and writes `src/data/mimaropaBoundaries.json`. At runtime `resolveAddress(lat, lng)` does a bbox-prefiltered ray-cast point-in-polygon over that file. The picker shows the resolved address live and returns it on Confirm; `CoordinateFields` passes it through; the four forms apply it to their Province/City/Barangay state.

**Tech Stack:** Node 24 (`.nvmrc`) CommonJS scripts (like `scripts/docx-*.js`), Jest via `jest-expo` + `react-test-renderer`, TypeScript, React Native / Expo 55. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-22-pin-to-address-design.md` (extends `docs/superpowers/specs/2026-09-17-map-location-picker-design.md`)

## Global Constraints

- Branch: `feat/map-location-picker` (checked out; the map picker is already implemented there). The working tree may contain the user's own uncommitted edits to `android/app/build.gradle`, `package.json` (the `android` script), `.claude/launch.json` and `android/app/src/debug/res/` — **never stage, commit, or revert those**; stage only the files each task names.
- Data source: `https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/…` — MIT licence, PSGC as of 31 Dec 2023. Files: `provdists/lowres/municities-provdist-<adm2>.0.001.json` (municipality names), `municities/medres/bgysubmuns-municity-<adm3>.0.01.json` (barangay polygons), `municities/hires/bgysubmuns-municity-<adm3>.0.1.json` (fallback for the 3 barangays whose medres geometry is `null`: PSGC 1704001054 Tagwak, 1705215008 Concepcion, 1705321004 Pag-Asa).
- Province codes (adm2 → app province): `1704000000` Marinduque, `1705100000` Occidental Mindoro, `1705200000` Oriental Mindoro, `1705300000` Palawan, `1705900000` Romblon, `1731500000` Palawan (Puerto Princesa, a highly-urbanised city coded at province level; its municipality code is also `1731500000` and its app name is `Puerto Princesa City (Capital)`).
- The app's dropdown strings in `src/data/mimaropaLocations.ts` are the only names that may appear in the generated bundle or in any resolved address. One additive change to that file is required: add `"Naibuan"` to `Occidental Mindoro → San Jose` (a real PSGC 2023 barangay the older dataset lacks).
- Generated file: `src/data/mimaropaBoundaries.json`, an array of `{ p, c, b, bbox: [w, s, e, n], rings: number[][] }`, coordinates rounded to 5 dp, `rings[0]` outer, rest holes, one entry per polygon (a MultiPolygon yields several entries with the same `p/c/b`). Committed to git.
- Copy (verbatim): address line format `Brgy. <barangay>, <city>, <province>`; null case `Outside MIMAROPA barangay boundaries`.
- Field order in all four forms: Establishment Name → (Former Establishment Name where the form has it) → **Latitude / Longitude + Pin on map** → Address Line → Province / City → Barangay → Nature of Business → PSIC Code → …. Focus chain: … Former Name (or Name) → Latitude → Longitude → Address → Nature → PSIC → whatever followed PSIC before the map-picker branch (Inspection Date in `NewEstablishmentModal`; Product in `EstablishmentInfoSections`; `isNonOperational ? sinceRef : hoursRef` in the two report-side forms).
- On Confirm with a non-null address, Province, City and Barangay are overwritten; Address Line is never touched; typed edits to Latitude/Longitude never resolve an address.
- New `.tsx` code must use tokens from `src/design/*` — no raw hex colour, no numeric `fontSize`/`borderRadius` (drift-guard test).
- Commits: conventional commits, scope from `auth|sync|snapshot|air|water|hazwaste|eia|survey|establishments|reports|ci|repo|db|supabase|router`, ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The Husky pre-commit hook runs the full Jest suite; before each commit also run `npm run typecheck && npm run lint`.
- Tests: `npx jest <path>`. Scripts are CommonJS `.js` with tests in `scripts/__tests__/*.test.js` (ESLint gives `scripts/**` the node+jest env and allows `require`).

---

## File map

| File | Responsibility |
|---|---|
| `scripts/barangayNameMatch.js` (+ `scripts/__tests__/barangayNameMatch.test.js`) | `normalizeName`, alias tables, `buildLocationIndex`, `matchFeature` |
| `scripts/build-barangay-boundaries.js` | download/read PSGC files → validate mapping → write `src/data/mimaropaBoundaries.json` |
| `src/data/mimaropaLocations.ts` | + `"Naibuan"` under San Jose |
| `src/data/mimaropaBoundaries.json` | generated bundle (committed) |
| `src/features/location/pointInPolygon.ts` (+ test) | ray casting over flat rings with holes |
| `src/features/location/resolveAddress.ts` (+ test) | `ResolvedAddress`, `formatResolvedAddress`, `resolveAddress` |
| `src/features/location/components/LocationPickerModal.tsx` (+ test) | live address line; `PickedLocation.address` |
| `src/features/location/components/CoordinateFields.tsx` (+ test) | `onChange` carries `address` |
| `src/features/inspections/components/NewEstablishmentModal.tsx` | apply address; reorder |
| `src/features/establishments/components/EstablishmentInfoSections.tsx` (+ test) | apply address; reorder |
| `src/features/inspections/components/GeneralInformationTab.tsx` | apply address; reorder |
| `src/features/inspections/components/GeneralInformationView.tsx` | apply address; reorder |
| `docs/superpowers/specs/2026-09-22-pin-to-address-design.md`, `docs/ci-cd.md` | status; how to regenerate the bundle |

---

### Task 1: Name matcher (`scripts/barangayNameMatch.js`)

**Files:**
- Create: `scripts/barangayNameMatch.js`
- Test: `scripts/__tests__/barangayNameMatch.test.js`

**Interfaces:**
- Produces (CommonJS exports):
  - `normalizeName(s: string): string`
  - `PROVINCE_BY_ADM2: Record<number, string>`
  - `MUNICIPALITY_ALIASES: Record<number, string>` (adm3 code → app city string)
  - `BARANGAY_ALIASES: Record<number, string>` (adm4 code → app barangay string)
  - `buildLocationIndex(locations): { munis: Map<string, string[]>, brgys: Map<string, string[]> }` — keys `${province}|${norm}` and `${province}|${city}|${norm}`
  - `matchFeature(props: { adm2_psgc, adm3_psgc, adm4_psgc, adm4_en }, muniNameByPsgc: Record<number, string>, index): { province, city, barangay }` — throws `Error` whose message starts with `UNMATCHED` or `AMBIGUOUS`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/barangayNameMatch.test.js`:

```js
const {
  normalizeName,
  buildLocationIndex,
  matchFeature,
  PROVINCE_BY_ADM2,
  MUNICIPALITY_ALIASES,
  BARANGAY_ALIASES,
} = require('../barangayNameMatch');

describe('normalizeName', () => {
  it.each([
    ['Boac (Capital)', 'boac'],
    ['City Of Calapan (Capital)', 'cityofcalapan'],
    ['City of Calapan', 'cityofcalapan'],
    ['Bonbon (Pob.)', 'bonbon'],
    ['Bagong Silang Pob.', 'bagongsilang'],
    ['Barangay I', 'barangay1'],
    ['Barangay IV', 'barangay4'],
    ['Udalo (Camurong)', 'udalo'],
    ['Sta. Rita', 'santarita'],
    ['Santa Rita (Bungahan)', 'santarita'],
    ['Sto. Niño', 'santonino'],
    ['Santo Niño', 'santonino'],
    ['Sofronio Española', 'sofronioespanola'],
    ['Apo-Aporawan', 'apoaporawan'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe('PROVINCE_BY_ADM2', () => {
  it('maps the five provinces and Puerto Princesa to app province names', () => {
    expect(PROVINCE_BY_ADM2).toEqual({
      1704000000: 'Marinduque',
      1705100000: 'Occidental Mindoro',
      1705200000: 'Oriental Mindoro',
      1705300000: 'Palawan',
      1705900000: 'Romblon',
      1731500000: 'Palawan',
    });
  });
});

const LOCATIONS = {
  Palawan: {
    Aborlan: ['Apo-Aporawan', 'Cabigaan', 'Poblacion'],
    'Puerto Princesa City (Capital)': ['Masikap', 'San Pedro'],
  },
  Romblon: {
    'San Agustin': ['Binongahan', 'Cagbuaya', 'Binugusan'],
    Odiongan: ['Poblacion (Ligaya)', 'Poblacion (Liwanag)'],
  },
};

describe('matchFeature', () => {
  const index = buildLocationIndex(LOCATIONS);
  const munis = { 1705301000: 'Aborlan', 1705911000: 'San Agustin', 1705909000: 'Odiongan' };

  it('matches by normalized name', () => {
    expect(
      matchFeature({ adm2_psgc: 1705300000, adm3_psgc: 1705301000, adm4_psgc: 1705301005, adm4_en: 'Cabigaan' }, munis, index),
    ).toEqual({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' });
  });

  it('resolves the municipality through MUNICIPALITY_ALIASES when the PSGC name is absent', () => {
    expect(MUNICIPALITY_ALIASES[1731500000]).toBe('Puerto Princesa City (Capital)');
    expect(
      matchFeature({ adm2_psgc: 1731500000, adm3_psgc: 1731500000, adm4_psgc: 1731500030, adm4_en: 'Masikap' }, munis, index),
    ).toEqual({ province: 'Palawan', city: 'Puerto Princesa City (Capital)', barangay: 'Masikap' });
  });

  it('resolves a barangay through BARANGAY_ALIASES before normalization', () => {
    expect(BARANGAY_ALIASES[1705911013]).toBe('Binugusan');
    expect(
      matchFeature({ adm2_psgc: 1705900000, adm3_psgc: 1705911000, adm4_psgc: 1705911013, adm4_en: 'Hinugusan' }, munis, index),
    ).toEqual({ province: 'Romblon', city: 'San Agustin', barangay: 'Binugusan' });
  });

  it('throws UNMATCHED when nothing maps', () => {
    expect(() =>
      matchFeature({ adm2_psgc: 1705300000, adm3_psgc: 1705301000, adm4_psgc: 1705301099, adm4_en: 'Nowhere' }, munis, index),
    ).toThrow(/^UNMATCHED/);
  });

  it('throws AMBIGUOUS when normalization collapses two app names into one', () => {
    expect(() =>
      matchFeature({ adm2_psgc: 1705900000, adm3_psgc: 1705909000, adm4_psgc: 1705909001, adm4_en: 'Poblacion' }, munis, index),
    ).toThrow(/^AMBIGUOUS/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest scripts/__tests__/barangayNameMatch.test.js`
Expected: FAIL — `Cannot find module '../barangayNameMatch'`.

- [ ] **Step 3: Create `scripts/barangayNameMatch.js`**

```js
// Maps PSGC 2023 polygon names (faeldon/philippines-json-maps) onto the
// exact Province / City / Barangay strings the app's dropdowns use
// (src/data/mimaropaLocations.ts). Runs at dev time only — see
// build-barangay-boundaries.js. The runtime never sees a PSGC name.

const ROMAN = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};

// Both sides go through this before comparison. Each rule exists because
// the two datasets differ in exactly that way somewhere in MIMAROPA:
// parentheticals ("Boac (Capital)", "Udalo (Camurong)"), Pob. markers,
// Sta./Sto. abbreviations, Roman numerals ("Barangay I"), diacritics
// ("Española", "Kiñaman").
function normalizeName(s) {
  let t = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\bpob\.?\b|\bpoblacion\b/g, ' ');
  t = t.replace(/\bsta\.?\s+/g, 'santa ').replace(/\bsto\.?\s+/g, 'santo ');
  t = t
    .trim()
    .split(/\s+/)
    .map(w => (w in ROMAN ? String(ROMAN[w]) : w))
    .join(' ');
  return t.replace(/[^a-z0-9]/g, '');
}

const PROVINCE_BY_ADM2 = {
  1704000000: 'Marinduque',
  1705100000: 'Occidental Mindoro',
  1705200000: 'Oriental Mindoro',
  1705300000: 'Palawan',
  1705900000: 'Romblon',
  // Puerto Princesa is a highly-urbanised city coded at province level in
  // PSGC but a Palawan municipality in the app.
  1731500000: 'Palawan',
};

// adm3 code → app city string, for municipalities the provdist files
// don't name (Puerto Princesa) — checked before normalization.
const MUNICIPALITY_ALIASES = {
  1731500000: 'Puerto Princesa City (Capital)',
};

// adm4 code → app barangay string, for the residue normalization can't
// bridge (spelling variants between the two datasets) — checked before
// normalization. Keep this list short: add a rule to normalizeName
// instead when a pattern repeats.
const BARANGAY_ALIASES = {
  1704003020: 'Pingan', // PSGC "Pinggan", Gasan
  1704005026: 'Kiñaman', // PSGC "Kinyaman", Santa Cruz
  1705104009: 'Surville (Pob.)', // PSGC "Sorville", Lubang
  1705104012: 'Banaag At Pag-Asa (Pob.)', // PSGC "Banaag ng Pag-asa", Lubang
  1705209010: 'Lumangbayan', // PSGC "Lumambayan", Pinamalayan
  1705901004: 'Camod-Om', // PSGC "Comod-om", Alcantara
  1705907004: 'Camandao', // PSGC "Camandag", Looc (Romblon)
  1705911002: 'Binongahan', // PSGC "Binonga-an", San Agustin
  1705911006: 'Cagbuaya', // PSGC "Cagbo-aya", San Agustin
  1705911013: 'Binugusan', // PSGC "Hinugusan", San Agustin
};

// Normalized-name → [app names]. A key with more than one name is a
// collision that only an alias can resolve.
function buildLocationIndex(locations) {
  const munis = new Map();
  const brgys = new Map();
  for (const [province, cities] of Object.entries(locations)) {
    for (const [city, barangays] of Object.entries(cities)) {
      const mk = `${province}|${normalizeName(city)}`;
      munis.set(mk, [...(munis.get(mk) ?? []), city]);
      for (const barangay of barangays) {
        const bk = `${province}|${city}|${normalizeName(barangay)}`;
        brgys.set(bk, [...(brgys.get(bk) ?? []), barangay]);
      }
    }
  }
  return { munis, brgys };
}

function pickUnique(candidates, kind, detail) {
  if (!candidates || candidates.length === 0) throw new Error(`UNMATCHED ${kind}: ${detail}`);
  if (candidates.length > 1) throw new Error(`AMBIGUOUS ${kind}: ${detail} → ${candidates.join(' | ')}`);
  return candidates[0];
}

function matchFeature(props, muniNameByPsgc, index) {
  const province = PROVINCE_BY_ADM2[props.adm2_psgc];
  if (!province) throw new Error(`UNMATCHED province: adm2 ${props.adm2_psgc}`);

  const city =
    MUNICIPALITY_ALIASES[props.adm3_psgc] ??
    pickUnique(
      index.munis.get(`${province}|${normalizeName(muniNameByPsgc[props.adm3_psgc] ?? '')}`),
      'municipality',
      `adm3 ${props.adm3_psgc} "${muniNameByPsgc[props.adm3_psgc]}" in ${province}`,
    );

  const barangay =
    BARANGAY_ALIASES[props.adm4_psgc] ??
    pickUnique(
      index.brgys.get(`${province}|${city}|${normalizeName(props.adm4_en)}`),
      'barangay',
      `adm4 ${props.adm4_psgc} "${props.adm4_en}" in ${city}, ${province}`,
    );

  return { province, city, barangay };
}

module.exports = {
  normalizeName,
  PROVINCE_BY_ADM2,
  MUNICIPALITY_ALIASES,
  BARANGAY_ALIASES,
  buildLocationIndex,
  matchFeature,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest scripts/__tests__/barangayNameMatch.test.js`
Expected: PASS (14 normalize cases + 1 + 5 = 20 tests).

- [ ] **Step 5: Lint and commit**

Run: `npm run lint` (the `lint` script only covers `src/`, but CI runs `eslint .`; run `npx eslint scripts` too). Expected: clean.

```bash
git add scripts/barangayNameMatch.js scripts/__tests__/barangayNameMatch.test.js
git commit -m "feat(establishments): add the PSGC-to-app barangay name matcher

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Build script and generated bundle

**Files:**
- Create: `scripts/build-barangay-boundaries.js`
- Modify: `src/data/mimaropaLocations.ts` (add `"Naibuan"`)
- Create (generated): `src/data/mimaropaBoundaries.json`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `src/data/mimaropaBoundaries.json` in the Global Constraints shape, regenerated with `node scripts/build-barangay-boundaries.js` (no npm script — `package.json` carries the user's own uncommitted edit and must not be touched).

- [ ] **Step 1: Add the missing barangay to the app dataset**

In `src/data/mimaropaLocations.ts`, under `"Occidental Mindoro"` → `"San Jose"`, insert `"Naibuan",` in alphabetical position (after `"Murtha"` if present, otherwise between the entries that sort around it). Verify with `grep -n '"Naibuan"' src/data/mimaropaLocations.ts`.

- [ ] **Step 2: Create `scripts/build-barangay-boundaries.js`**

```js
#!/usr/bin/env node
// Builds src/data/mimaropaBoundaries.json — the barangay polygons the map
// picker uses to turn a pin into Province / City / Barangay offline.
//
// Source: faeldon/philippines-json-maps (MIT), 2023 PSGC. Medres
// per-municipality barangay files for the 73 MIMAROPA municipalities;
// the three barangays whose medres geometry is null are taken from hires.
//
// Usage:
//   node scripts/build-barangay-boundaries.js            # downloads into node_modules/.cache/psgc-boundaries
//   node scripts/build-barangay-boundaries.js --from DIR # reads previously downloaded files from DIR
//
// Refuses to write the bundle unless every polygon maps to exactly one app
// barangay and every app barangay has at least one polygon.

const fs = require('fs');
const path = require('path');
const {
  PROVINCE_BY_ADM2,
  buildLocationIndex,
  matchFeature,
} = require('./barangayNameMatch');

const BASE = 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson';
const PROVINCE_CODES = [1704000000, 1705100000, 1705200000, 1705300000, 1705900000];
const PUERTO_PRINCESA = 1731500000;
const OUT = path.join(__dirname, '..', 'src', 'data', 'mimaropaBoundaries.json');
const LOCATIONS_TS = path.join(__dirname, '..', 'src', 'data', 'mimaropaLocations.ts');
const DECIMALS = 5;

function loadLocations() {
  // The TS file is a JSON object literal after `= {` — the same slice the
  // waterbodies generator relies on.
  const src = fs.readFileSync(LOCATIONS_TS, 'utf8');
  const start = src.indexOf('= {') + 2;
  return JSON.parse(src.slice(start).trim().replace(/;$/, ''));
}

async function fetchJson(relPath, dir) {
  const file = path.join(dir, path.basename(relPath));
  if (!fs.existsSync(file)) {
    const res = await fetch(`${BASE}/${relPath}`);
    if (!res.ok) throw new Error(`${res.status} fetching ${relPath}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, await res.text());
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const round = n => Math.round(n * 10 ** DECIMALS) / 10 ** DECIMALS;

// GeoJSON ring [[lng, lat], …] → flat [lng, lat, lng, lat, …], closing
// vertex dropped (ray casting wraps around itself).
function flattenRing(ring) {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  const out = [];
  for (const [lng, lat] of pts) out.push(round(lng), round(lat));
  return out;
}

function polygonEntry(base, polygonCoords) {
  const rings = polygonCoords.map(flattenRing);
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (let i = 0; i < rings[0].length; i += 2) {
    w = Math.min(w, rings[0][i]); e = Math.max(e, rings[0][i]);
    s = Math.min(s, rings[0][i + 1]); n = Math.max(n, rings[0][i + 1]);
  }
  return { ...base, bbox: [w, s, e, n], rings };
}

async function main() {
  const fromIdx = process.argv.indexOf('--from');
  const dir = fromIdx >= 0 ? process.argv[fromIdx + 1] : path.join(__dirname, '..', 'node_modules', '.cache', 'psgc-boundaries');

  const locations = loadLocations();
  const index = buildLocationIndex(locations);

  // Municipality names come from the province-level files; Puerto Princesa
  // is not in any of them and is aliased in barangayNameMatch.js.
  const muniNameByPsgc = {};
  for (const code of PROVINCE_CODES) {
    const fc = await fetchJson(`provdists/lowres/municities-provdist-${code}.0.001.json`, dir);
    for (const f of fc.features) muniNameByPsgc[f.properties.adm3_psgc] = f.properties.adm3_en;
  }
  const muniCodes = [...Object.keys(muniNameByPsgc).map(Number), PUERTO_PRINCESA].sort();

  const entries = [];
  const errors = [];
  for (const code of muniCodes) {
    const medres = await fetchJson(`municities/medres/bgysubmuns-municity-${code}.0.01.json`, dir);
    let hires = null;
    for (const feature of medres.features) {
      const props = feature.properties;
      if (!PROVINCE_BY_ADM2[props.adm2_psgc]) { errors.push(`unknown adm2 ${props.adm2_psgc}`); continue; }
      let match;
      try {
        match = matchFeature(props, muniNameByPsgc, index);
      } catch (err) {
        errors.push(err.message);
        continue;
      }
      let geometry = feature.geometry;
      if (!geometry) {
        hires = hires ?? (await fetchJson(`municities/hires/bgysubmuns-municity-${code}.0.1.json`, dir));
        geometry = hires.features.find(f => f.properties.adm4_psgc === props.adm4_psgc)?.geometry ?? null;
        if (!geometry) { errors.push(`no geometry at any resolution: adm4 ${props.adm4_psgc} "${props.adm4_en}"`); continue; }
      }
      const base = { p: match.province, c: match.city, b: match.barangay };
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
      for (const polygon of polygons) entries.push(polygonEntry(base, polygon));
    }
  }

  // Completeness in both directions.
  const seenByKey = new Map();
  for (const e of entries) seenByKey.set(`${e.p}|${e.c}|${e.b}`, (seenByKey.get(`${e.p}|${e.c}|${e.b}`) ?? 0) + 1);
  const psgcPerKey = new Map();
  for (const code of muniCodes) {
    const medres = JSON.parse(fs.readFileSync(path.join(dir, `bgysubmuns-municity-${code}.0.01.json`), 'utf8'));
    for (const f of medres.features) {
      try {
        const m = matchFeature(f.properties, muniNameByPsgc, index);
        const key = `${m.province}|${m.city}|${m.barangay}`;
        psgcPerKey.set(key, [...(psgcPerKey.get(key) ?? []), f.properties.adm4_psgc]);
      } catch { /* already reported above */ }
    }
  }
  for (const [key, codes] of psgcPerKey) {
    if (new Set(codes).size > 1) errors.push(`DUPLICATE: ${key} claimed by adm4 ${[...new Set(codes)].join(', ')}`);
  }
  for (const [province, cities] of Object.entries(locations)) {
    for (const [city, barangays] of Object.entries(cities)) {
      for (const barangay of barangays) {
        if (!seenByKey.has(`${province}|${city}|${barangay}`)) errors.push(`NO POLYGON: ${barangay}, ${city}, ${province}`);
      }
    }
  }

  if (errors.length) {
    console.error(`build-barangay-boundaries: ${errors.length} problem(s); nothing written.`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  entries.sort((a, b) => a.p.localeCompare(b.p) || a.c.localeCompare(b.c) || a.b.localeCompare(b.b));
  fs.writeFileSync(OUT, JSON.stringify(entries));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`Wrote ${entries.length} polygons for ${seenByKey.size} barangays to ${path.relative(process.cwd(), OUT)} (${kb} KB).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script**

Run: `node scripts/build-barangay-boundaries.js`
Expected: downloads 5 + 73 (+ up to 3 hires) files into `node_modules/.cache/psgc-boundaries/` (network required once), then prints `Wrote 1597 polygons for 1460 barangays to src/data/mimaropaBoundaries.json (~800 KB).` — the polygon count is 1,460 features plus the extra polygons of the 137 MultiPolygons, so accept any count in the 1,550–1,650 range; the barangay count must be exactly 1460 (1,459 in the app dataset + Naibuan).

If the script exits 1, read the listed problems: an `UNMATCHED barangay` means a spelling variant not covered — add it to `BARANGAY_ALIASES` in `scripts/barangayNameMatch.js` with a comment naming the PSGC spelling (never edit `mimaropaLocations.ts` beyond Naibuan); `NO POLYGON` for an app barangay means its PSGC feature was aliased elsewhere or misspelled — fix the alias. Re-run until it writes. Report every alias you had to add.

- [ ] **Step 4: Sanity-check the output**

Run:
```bash
node -e "const d=require('./src/data/mimaropaBoundaries.json');console.log(d.length,new Set(d.map(e=>e.p+'|'+e.c+'|'+e.b)).size,d[0]);const bad=d.filter(e=>e.rings[0].length<6||e.bbox[0]>e.bbox[2]||e.bbox[1]>e.bbox[3]);console.log('bad',bad.length)"
```
Expected: `<polygons> 1460 { p: 'Marinduque', c: 'Boac', b: '…', bbox: [...], rings: [[...]] }` and `bad 0`.

- [ ] **Step 5: Verify and commit**

Run: `npx jest scripts && npm run typecheck && npm run lint && npx eslint scripts`
Expected: clean. (`mimaropaBoundaries.json` is not linted; `driftGuard` scans `.tsx` only.)

```bash
git add scripts/build-barangay-boundaries.js src/data/mimaropaLocations.ts src/data/mimaropaBoundaries.json
git commit -m "feat(establishments): bundle MIMAROPA barangay boundaries for offline pin-to-address

Generated from faeldon/philippines-json-maps (MIT, PSGC 2023) by
scripts/build-barangay-boundaries.js, which refuses to write unless every
polygon maps to exactly one dropdown barangay and vice versa. Adds
Naibuan (San Jose, Occidental Mindoro) to the location dataset.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `pointInPolygon` and `resolveAddress`

**Files:**
- Create: `src/features/location/pointInPolygon.ts`
- Test: `src/features/location/pointInPolygon.test.ts`
- Create: `src/features/location/resolveAddress.ts`
- Test: `src/features/location/resolveAddress.test.ts`

**Interfaces:**
- Produces:
  - `pointInRing(lng: number, lat: number, ring: number[]): boolean` and `pointInPolygon(lng: number, lat: number, rings: number[][]): boolean` (outer ring minus holes).
  - `interface ResolvedAddress { province: string; city: string; barangay: string }`
  - `resolveAddress(lat: number, lng: number): ResolvedAddress | null`
  - `formatResolvedAddress(a: ResolvedAddress | null): string` — `Brgy. <b>, <c>, <p>` or `Outside MIMAROPA barangay boundaries`.

- [ ] **Step 1: Write the failing `pointInPolygon` tests**

Create `src/features/location/pointInPolygon.test.ts`:

```ts
import { pointInPolygon, pointInRing } from './pointInPolygon';

// Flat [lng, lat, …] rings, closing vertex omitted.
const square = [0, 0, 10, 0, 10, 10, 0, 10];
const hole = [4, 4, 6, 4, 6, 6, 4, 6];
// Concave "C": a square with a notch cut from the right side.
const cShape = [0, 0, 10, 0, 10, 3, 4, 3, 4, 7, 10, 7, 10, 10, 0, 10];

describe('pointInRing', () => {
  it('is true inside and false outside a square', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(11, 5, square)).toBe(false);
    expect(pointInRing(5, -1, square)).toBe(false);
  });
  it('handles a concave ring', () => {
    expect(pointInRing(2, 5, cShape)).toBe(true);
    expect(pointInRing(7, 5, cShape)).toBe(false); // inside the notch
    expect(pointInRing(7, 1, cShape)).toBe(true);
  });
  it('treats a point on a vertex or edge consistently (no exception, boolean result)', () => {
    expect(typeof pointInRing(0, 0, square)).toBe('boolean');
    expect(typeof pointInRing(5, 0, square)).toBe('boolean');
  });
});

describe('pointInPolygon', () => {
  it('excludes holes', () => {
    expect(pointInPolygon(5, 5, [square, hole])).toBe(false);
    expect(pointInPolygon(2, 2, [square, hole])).toBe(true);
  });
  it('is false outside the outer ring even with holes present', () => {
    expect(pointInPolygon(20, 20, [square, hole])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/location/pointInPolygon.test.ts`
Expected: FAIL — `Cannot find module './pointInPolygon'`.

- [ ] **Step 3: Create `pointInPolygon.ts`**

```ts
// Ray casting over flat [lng, lat, lng, lat, …] rings (closing vertex
// omitted) — the shape mimaropaBoundaries.json stores, so the lookup never
// allocates per point.

export function pointInRing(lng: number, lat: number, ring: number[]): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// rings[0] is the outer boundary; the rest are holes.
export function pointInPolygon(lng: number, lat: number, rings: number[][]): boolean {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/location/pointInPolygon.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing `resolveAddress` tests**

Create `src/features/location/resolveAddress.test.ts`:

```ts
import { formatResolvedAddress, resolveAddress } from './resolveAddress';
import { pointInPolygon } from './pointInPolygon';

type Entry = { p: string; c: string; b: string; bbox: number[]; rings: number[][] };
// Same lazy require the module uses; typed loosely on purpose.
const entries = require('../../data/mimaropaBoundaries.json') as Entry[];

describe('resolveAddress', () => {
  it('resolves a point inside Brgy. Cabigaan, Aborlan, Palawan', () => {
    expect(resolveAddress(9.45777, 118.47504)).toEqual({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' });
  });

  it('returns null for a point in the sea (the MIMAROPA overview centre)', () => {
    expect(resolveAddress(12.0, 120.5)).toBeNull();
  });

  it('returns null for coordinates far outside the region', () => {
    expect(resolveAddress(14.5995, 120.9842)).toBeNull(); // Manila
  });

  it('resolves every polygon whose vertex centroid lies inside it back to its own barangay', () => {
    let checked = 0;
    let mismatches = 0;
    for (const e of entries) {
      const ring = e.rings[0];
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < ring.length; i += 2) {
        sx += ring[i];
        sy += ring[i + 1];
      }
      const lng = sx / (ring.length / 2);
      const lat = sy / (ring.length / 2);
      if (!pointInPolygon(lng, lat, e.rings)) continue; // concave: centroid may fall outside
      checked += 1;
      const got = resolveAddress(lat, lng);
      if (!got || got.province !== e.p || got.city !== e.c || got.barangay !== e.b) mismatches += 1;
    }
    expect(checked).toBeGreaterThan(1000);
    // Overlapping simplified borders can hand a centroid to a neighbour;
    // that must stay rare.
    expect(mismatches / checked).toBeLessThan(0.02);
  });
});

describe('formatResolvedAddress', () => {
  it('formats a resolved address', () => {
    expect(formatResolvedAddress({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' })).toBe('Brgy. Cabigaan, Aborlan, Palawan');
  });
  it('formats null as the outside-boundaries note', () => {
    expect(formatResolvedAddress(null)).toBe('Outside MIMAROPA barangay boundaries');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx jest src/features/location/resolveAddress.test.ts`
Expected: FAIL — `Cannot find module './resolveAddress'`.

- [ ] **Step 7: Create `resolveAddress.ts`**

```ts
import { pointInPolygon } from './pointInPolygon';

export interface ResolvedAddress {
  province: string;
  city: string;
  barangay: string;
}

interface BoundaryEntry {
  p: string;
  c: string;
  b: string;
  bbox: [number, number, number, number]; // west, south, east, north
  rings: number[][];
}

let entries: BoundaryEntry[] | null = null;

// The bundle is ~800 KB of polygons generated by
// scripts/build-barangay-boundaries.js from faeldon/philippines-json-maps
// (MIT, PSGC 2023). Required lazily so app start never parses it; Metro
// executes a module on its first require.
function loadEntries(): BoundaryEntry[] {
  if (entries) return entries;
  try {
    entries = require('../../data/mimaropaBoundaries.json') as BoundaryEntry[];
  } catch (err) {
    console.warn('[resolveAddress] boundary bundle unavailable', err);
    entries = [];
  }
  return entries;
}

// The Province / City / Barangay the pin sits in — exactly the strings the
// address dropdowns offer, so callers assign them straight into form state.
// First polygon hit wins; a pin exactly on a border is a coin toss either
// way and the inspector can correct the dropdown.
export function resolveAddress(lat: number, lng: number): ResolvedAddress | null {
  for (const e of loadEntries()) {
    const [w, s, east, n] = e.bbox;
    if (lng < w || lng > east || lat < s || lat > n) continue;
    if (pointInPolygon(lng, lat, e.rings)) {
      return { province: e.p, city: e.c, barangay: e.b };
    }
  }
  return null;
}

export function formatResolvedAddress(address: ResolvedAddress | null): string {
  if (!address) return 'Outside MIMAROPA barangay boundaries';
  return `Brgy. ${address.barangay}, ${address.city}, ${address.province}`;
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx jest src/features/location/resolveAddress.test.ts`
Expected: PASS (6 tests). If the Cabigaan assertion fails because a neighbouring polygon's bbox+ring claims the point first, replace the test point with the centroid printed by `node -e "const d=require('./src/data/mimaropaBoundaries.json');const e=d.find(x=>x.b==='Cabigaan'&&x.c==='Aborlan');const r=e.rings[0];let x=0,y=0;for(let i=0;i<r.length;i+=2){x+=r[i];y+=r[i+1]}console.log(y/(r.length/2),x/(r.length/2))"` and note it in the report.

- [ ] **Step 9: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: clean (the `.json` `require` is allowed by the Expo ESLint config's asset allow-list).

```bash
git add src/features/location/pointInPolygon.ts src/features/location/pointInPolygon.test.ts src/features/location/resolveAddress.ts src/features/location/resolveAddress.test.ts
git commit -m "feat(establishments): resolve a pin to its barangay from the bundled boundaries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Picker shows the resolved address and returns it

**Files:**
- Modify: `src/features/location/components/LocationPickerModal.tsx`
- Test: `src/features/location/components/LocationPickerModal.test.tsx`

**Interfaces:**
- Consumes: `resolveAddress`, `formatResolvedAddress`, `ResolvedAddress` (Task 3).
- Produces: `PickedLocation` becomes `{ lat: number; lng: number; address: ResolvedAddress | null }`; new `Text` with `testID="address-readout"`.

- [ ] **Step 1: Add the failing tests**

In `LocationPickerModal.test.tsx`, add after the existing `jest.mock('../offlinePacks', …)` line:

```ts
jest.mock('../resolveAddress', () => {
  const actual = jest.requireActual('../resolveAddress');
  return { ...actual, resolveAddress: jest.fn() };
});
```

Add imports at the top:

```ts
import { resolveAddress } from '../resolveAddress';
```

and a typed handle plus a default next to `mockLocation`:

```ts
const mockResolveAddress = resolveAddress as jest.Mock;
const CABIGAAN = { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' };
```

In `beforeEach`, add: `mockResolveAddress.mockReturnValue(null);`

Add a helper next to `readout`:

```ts
const addressReadout = (r: Renderer) =>
  r.root.findAll(n => n.type === Text && n.props.testID === 'address-readout')[0].props.children;
```

Add a new describe block:

```tsx
describe('LocationPickerModal — resolved address', () => {
  it('shows the outside note when the pin resolves to nothing', async () => {
    const r = await render(<LocationPickerModal {...baseProps} initialLat="12.0" initialLng="120.5" />);
    expect(addressReadout(r)).toBe('Outside MIMAROPA barangay boundaries');
  });

  it('resolves live as the map settles', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    mockResolveAddress.mockReturnValue(CABIGAAN);
    await moveMap(r, 118.47504, 9.45777);
    expect(mockResolveAddress).toHaveBeenLastCalledWith(9.45777, 118.47504);
    expect(addressReadout(r)).toBe('Brgy. Cabigaan, Aborlan, Palawan');
  });

  it('confirms with the address resolved from the rounded coordinates', async () => {
    const onConfirm = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} onConfirm={onConfirm} />);
    mockResolveAddress.mockReturnValue(CABIGAAN);
    await moveMap(r, 118.4750412345, 9.4577712345);
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(mockResolveAddress).toHaveBeenLastCalledWith(9.457771, 118.475041);
    expect(onConfirm).toHaveBeenCalledWith({ lat: 9.457771, lng: 118.475041, address: CABIGAAN });
  });

  it('confirms with address null when the pin is outside every barangay', async () => {
    const onConfirm = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} initialLat="12.0" initialLng="120.5" onConfirm={onConfirm} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ lat: 12, lng: 120.5, address: null });
  });
});
```

Update the two existing confirm assertions so they include the new field:
- `expect(onConfirm).toHaveBeenCalledWith({ lat: 11.144988, lng: 119.395123 })` → `…({ lat: 11.144988, lng: 119.395123, address: null })`
- `expect(baseProps.onConfirm).toHaveBeenCalledWith({ lat: 11.144, lng: 119.395 })` → `…({ lat: 11.144, lng: 119.395, address: null })`

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/location/components/LocationPickerModal.test.tsx`
Expected: the four new tests FAIL (no `address-readout`; payload lacks `address`), the two updated confirm tests FAIL on the missing `address` key; everything else passes.

- [ ] **Step 3: Implement**

In `LocationPickerModal.tsx`:

Add the import after the `useDeviceLocation` import:

```ts
import { formatResolvedAddress, resolveAddress, type ResolvedAddress } from '../resolveAddress';
```

Change `PickedLocation`:

```ts
export interface PickedLocation {
  lat: number;
  lng: number;
  // The barangay the pin sits in, or null outside every MIMAROPA polygon —
  // see resolveAddress.ts. Callers apply it to Province/City/Barangay.
  address: ResolvedAddress | null;
}
```

Derive the live address from `center` (a plain derivation, no extra state — `resolveAddress` is sub-millisecond):

```ts
  const liveAddress = useMemo(() => resolveAddress(center.lat, center.lng), [center]);
```

(place it right after the `showBanner` line.)

Change `handleConfirm`:

```ts
  const handleConfirm = useCallback(() => {
    const lat = roundCoordinate(center.lat);
    const lng = roundCoordinate(center.lng);
    // Resolved from the rounded pair so the payload can't disagree with
    // what the readout showed for these exact coordinates.
    const picked: PickedLocation = { lat, lng, address: resolveAddress(lat, lng) };
    if (online) void cacheAreaAroundPin(packName, lat, lng);
    onConfirm(picked);
  }, [center, online, packName, onConfirm]);
```

In the JSX, directly under the coordinate readout `Text` (before the `gps.message &&` block), add:

```tsx
          <Text
            style={liveAddress ? styles.addressReadout : styles.addressReadoutMuted}
            testID="address-readout"
            numberOfLines={2}>
            {formatResolvedAddress(liveAddress)}
          </Text>
```

Add styles after `readout`:

```ts
  addressReadout: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: Spacing.xxs,
  },
  addressReadoutMuted: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    color: Colors.textMuted,
    marginTop: Spacing.xxs,
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/location/components/LocationPickerModal.test.tsx && npx jest src/design`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck, lint, commit**

`npm run typecheck` will now fail in `CoordinateFields.test.tsx` (its `onConfirm({ lat, lng })` call lacks `address`) — that is Task 5's job. To keep this commit green, update that one call in `CoordinateFields.test.tsx` to `picker.props.onConfirm({ lat: 11.144988, lng: 119.395123, address: null })` and stage it here; its expectation (`onChange` called with `{ lat, lng }`) still holds because `CoordinateFields` ignores `address` until Task 5.

Run: `npm run typecheck && npm run lint`
Expected: clean.

```bash
git add src/features/location/components/LocationPickerModal.tsx src/features/location/components/LocationPickerModal.test.tsx src/features/location/components/CoordinateFields.test.tsx
git commit -m "feat(establishments): show and return the pin's barangay in the map picker

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `CoordinateFields` passes the address through

**Files:**
- Modify: `src/features/location/components/CoordinateFields.tsx`
- Test: `src/features/location/components/CoordinateFields.test.tsx`

**Interfaces:**
- Produces: `onChange: (next: { lat: string; lng: string; address?: ResolvedAddress | null }) => void` — typed edits omit `address`; a picker confirm passes it (possibly null). Exported type `CoordinateChange` for callers.

- [ ] **Step 1: Update/add tests**

In `CoordinateFields.test.tsx`, change the confirm test's expectation to:

```ts
    TestRenderer.act(() =>
      picker.props.onConfirm({ lat: 11.144988, lng: 119.395123, address: { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' } }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      lat: '11.144988',
      lng: '119.395123',
      address: { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' },
    });
```

Add two tests to the describe block:

```tsx
  it('passes a null address through unchanged on confirm', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="" lng="" onChange={onChange} packName="estab:pending" />);
    TestRenderer.act(() => pinButtons(r)[0].props.onPress());
    TestRenderer.act(() => r.root.findByType(LocationPickerModal).props.onConfirm({ lat: 12, lng: 120.5, address: null }));
    expect(onChange).toHaveBeenCalledWith({ lat: '12', lng: '120.5', address: null });
  });

  it('never attaches an address to a typed edit', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={onChange} packName="estab:pending" />);
    const [latInput] = r.root.findAllByType(TextInput);
    TestRenderer.act(() => latInput.props.onChangeText('12'));
    expect(onChange).toHaveBeenLastCalledWith({ lat: '12', lng: '119.395' });
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('address');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/location/components/CoordinateFields.test.tsx`
Expected: the confirm test and the null-address test FAIL (`address` missing from the `onChange` payload); the typed-edit test passes already.

- [ ] **Step 3: Implement**

In `CoordinateFields.tsx`:

```ts
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal';
import type { ResolvedAddress } from '../resolveAddress';

// What the row reports back. `address` is present only when the picker
// confirmed a pin (null when the pin sat outside every barangay); a typed
// edit carries coordinates alone, so a form never overwrites its address
// dropdowns mid-typing.
export interface CoordinateChange {
  lat: string;
  lng: string;
  address?: ResolvedAddress | null;
}

export interface CoordinateFieldsProps {
  lat: string;
  lng: string;
  onChange: (next: CoordinateChange) => void;
  …
```

and

```ts
  const handleConfirm = (picked: PickedLocation) => {
    setPickerOpen(false);
    onChange({ lat: String(picked.lat), lng: String(picked.lng), address: picked.address });
  };
```

The two typed-edit `onChange` calls stay exactly `onChange({ lat: next, lng })` / `onChange({ lat, lng: next })`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/location/components/CoordinateFields.test.tsx && npm run typecheck && npm run lint`
Expected: PASS (8 tests); typecheck clean (callers' `({ lat, lng }) =>` destructuring still type-checks against `CoordinateChange`).

- [ ] **Step 5: Commit**

```bash
git add src/features/location/components/CoordinateFields.tsx src/features/location/components/CoordinateFields.test.tsx
git commit -m "feat(establishments): carry the resolved barangay through CoordinateFields

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Forms apply the address and move Latitude/Longitude up

**Files:**
- Modify: `src/features/inspections/components/NewEstablishmentModal.tsx`
- Modify: `src/features/establishments/components/EstablishmentInfoSections.tsx`
- Test: `src/features/establishments/components/EstablishmentInfoSections.test.tsx`
- Modify: `src/features/inspections/components/GeneralInformationTab.tsx`
- Modify: `src/features/inspections/components/GeneralInformationView.tsx`

**Interfaces:**
- Consumes: `CoordinateChange` semantics from Task 5 (`address` present ⇒ overwrite Province/City/Barangay).

A shared helper keeps the four handlers identical. Create `src/features/location/applyResolvedAddress.ts`:

```ts
import type { ResolvedAddress } from './resolveAddress';

// The three dropdown fields a confirmed pin overwrites — as a partial so
// each form spreads it into its own state shape. Undefined address (a
// typed edit) or null address (pin outside every barangay) changes nothing.
export function addressPatch(address: ResolvedAddress | null | undefined): {
  province?: string;
  city?: string;
  barangay?: string;
} {
  if (!address) return {};
  return { province: address.province, city: address.city, barangay: address.barangay };
}
```

- [ ] **Step 1: Write the failing establishment-section test**

In `EstablishmentInfoSections.test.tsx`, add to the imports:

```ts
import { LocationPickerModal } from '../../location/components/LocationPickerModal';
import { SelectField } from '../../../components/form';
```

(`SelectField` is re-exported from `components/form`; `FormSection` is already imported from there — extend that import line.)

Append inside `describe('EstablishmentInfoSections Establishment Details validation', …)`:

```tsx
  it('fills Province, City and Barangay from a confirmed pin and leaves the address line alone', async () => {
    const onSaved = jest.fn();
    const r = render(
      <EstablishmentInfoSections
        establishment={{ ...baseEstablishment, addressLine: '2713 Zamora St.', province: 'Romblon', city: 'Odiongan', barangay: 'Dapawan' }}
        canEdit
        onSaved={onSaved}
      />,
    );
    let section = startEditingDetails(r);
    await TestRenderer.act(async () => {
      section.findByType(LocationPickerModal).props.onConfirm({
        lat: 9.45777,
        lng: 118.47504,
        address: { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' },
      });
    });
    section = findSection(r, DETAILS_TITLE);
    const selectValues = Object.fromEntries(section.findAllByType(SelectField).map(n => [n.props.label, n.props.value]));
    expect(selectValues).toMatchObject({ Province: 'Palawan', 'City / Municipality': 'Aborlan', Barangay: 'Cabigaan' });
    const addressInput = section.findAll(n => n.type === TextInput && n.props.placeholder === 'Street / building / lot no. (if known)')[0];
    expect(addressInput.props.value).toBe('2713 Zamora St.');

    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });
    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: expect.objectContaining({
        province: 'Palawan',
        city: 'Aborlan',
        barangay: 'Cabigaan',
        geoLat: 9.45777,
        geoLng: 118.47504,
        addressLine: '2713 Zamora St.',
      }),
    });
  });

  it('keeps the dropdowns when the confirmed pin has no barangay', async () => {
    const r = render(
      <EstablishmentInfoSections establishment={{ ...baseEstablishment, province: 'Romblon', city: 'Odiongan', barangay: 'Dapawan' }} canEdit onSaved={jest.fn()} />,
    );
    let section = startEditingDetails(r);
    await TestRenderer.act(async () => {
      section.findByType(LocationPickerModal).props.onConfirm({ lat: 12, lng: 120.5, address: null });
    });
    section = findSection(r, DETAILS_TITLE);
    const selectValues = Object.fromEntries(section.findAllByType(SelectField).map(n => [n.props.label, n.props.value]));
    expect(selectValues).toMatchObject({ Province: 'Romblon', 'City / Municipality': 'Odiongan', Barangay: 'Dapawan' });
  });
```

Check the SelectField label for the city in `EstablishmentInfoSections.tsx` (it may be `City / Municipality`); use whatever the file has.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/establishments/components/EstablishmentInfoSections.test.tsx`
Expected: the first new test FAILS (dropdowns still Romblon/Odiongan/Dapawan); the second passes already.

- [ ] **Step 3: `EstablishmentInfoSections.tsx`**

Import: `import { addressPatch } from '../../location/applyResolvedAddress';`

Move the `<CoordinateFields …/>` element from below the Nature/PSIC row to directly **above** the Address row (after the Former Establishment Name block). Its new props:

```tsx
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng, address }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng, ...addressPatch(address) }))}
        readOnly={!details.editing}
        packName={`estab:${establishment.estabId}`}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(addressRef.current)}
      />
```

Focus chain: Former Establishment Name's `onSubmitEditing` → `focusInput(latRef.current)` (it currently targets `addressRef`); Address stays → `natureRef`; PSIC Code's `onSubmitEditing` → `focusInput(productRef.current)` (it currently targets `latRef`).

- [ ] **Step 4: `NewEstablishmentModal.tsx`**

Import `addressPatch` the same way. Move `<CoordinateFields …/>` to directly above the Address Line row (right after the Establishment Name field). New props:

```tsx
            <CoordinateFields
              lat={form.geoLat}
              lng={form.geoLng}
              onChange={({ lat, lng, address }) => setForm({ ...form, geoLat: lat, geoLng: lng, ...addressPatch(address) })}
              packName="estab:pending"
              latRef={latRef}
              lngRef={lngRef}
              onLngSubmitEditing={() => focusInput(addressRef.current)}
              onLatFocus={() => scrollToInput(latRef)}
              onLngFocus={() => scrollToInput(lngRef)}
            />
```

Focus chain: Establishment Name → `focusInput(latRef.current)` (was `addressRef`); Address Line stays → `natureRef`; PSIC Code → `focusInput(inspectionDateRef.current)` (was `latRef`).

- [ ] **Step 5: `GeneralInformationTab.tsx`**

Import `addressPatch`. Move `<CoordinateFields …/>` to directly above the Address row (after the Former Establishment Name block). New props:

```tsx
        <CoordinateFields
          lat={value.geoLat}
          lng={value.geoLng}
          onChange={({ lat, lng, address }) => onChange({ ...value, geoLat: lat, geoLng: lng, ...addressPatch(address) })}
          packName={estabId ? `estab:${estabId}` : 'estab:pending'}
          latRef={latRef}
          lngRef={lngRef}
          onLngSubmitEditing={() => focusInput(addressRef.current)}
        />
```

Focus chain: Former Establishment Name → `focusInput(latRef.current)` (was `addressRef`); Address → `natureRef` unchanged; PSIC Code → `focusInput(isNonOperational ? sinceRef.current : hoursRef.current)` (was `latRef`).

- [ ] **Step 6: `GeneralInformationView.tsx`**

Same as Step 5 with `details.setDraft`:

```tsx
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng, address }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng, ...addressPatch(address) }))}
        readOnly={!details.editing}
        packName={estabId ? `estab:${estabId}` : 'estab:pending'}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(addressRef.current)}
        latChangeNote={liveDetails ? liveRecordNote(details.draft.geoLat, liveDetails.geoLat) : undefined}
        lngChangeNote={liveDetails ? liveRecordNote(details.draft.geoLng, liveDetails.geoLng) : undefined}
      />
```

placed directly above the Address row; Former Establishment Name → `latRef`; PSIC Code → `isNonOperational ? sinceRef : hoursRef`.

- [ ] **Step 7: Run everything**

Run: `npx jest src/features/establishments src/features/location src/features/inspections && npm run typecheck && npm run lint`
Expected: all green, including the two new tests.

- [ ] **Step 8: Commit**

```bash
git add src/features/location/applyResolvedAddress.ts src/features/inspections/components/NewEstablishmentModal.tsx src/features/establishments/components/EstablishmentInfoSections.tsx src/features/establishments/components/EstablishmentInfoSections.test.tsx src/features/inspections/components/GeneralInformationTab.tsx src/features/inspections/components/GeneralInformationView.tsx
git commit -m "feat(establishments): fill Province, City and Barangay from a confirmed pin

Latitude/Longitude move to the top of the address block in all four
forms so the flow is pin first, then the street line.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-pin-to-address-design.md` (status line)
- Modify: `docs/ci-cd.md`

- [ ] **Step 1: Spec status**

Change the spec's `**Status:**` line to `**Status:** Implemented — see docs/superpowers/plans/2026-09-22-pin-to-address.md`.

- [ ] **Step 2: Regeneration note**

In `docs/ci-cd.md`, after the "Native dependencies" bullet added by the map-picker work, add:

```markdown
- **Barangay boundary bundle.** `src/data/mimaropaBoundaries.json` is
  generated, not hand-edited: `node scripts/build-barangay-boundaries.js` downloads the PSGC
  2023 medres files from `faeldon/philippines-json-maps` (MIT) and refuses
  to write unless every polygon maps to exactly one dropdown barangay in
  `src/data/mimaropaLocations.ts` and vice versa. Re-run it after changing
  that dataset or `scripts/barangayNameMatch.js`.
```

- [ ] **Step 3: Verify and commit**

Run: `npm test` (full) — expected all green.

```bash
git add docs/superpowers/specs/2026-09-22-pin-to-address-design.md docs/ci-cd.md
git commit -m "docs(repo): mark pin-to-address implemented and document the boundary bundle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand-off note for the PR**

Add to the device checklist: pin on a known site → the three dropdowns change and Address Line does not; pin in the sea → readout says "Outside MIMAROPA barangay boundaries" and the dropdowns keep their values; the readout line updates while panning.
