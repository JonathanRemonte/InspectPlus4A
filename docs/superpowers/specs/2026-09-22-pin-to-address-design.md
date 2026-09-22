# Pin to Address — Design

**Date:** 2026-09-22
**Status:** Approved, awaiting implementation plan
**Extends:** `2026-09-17-map-location-picker-design.md` (same branch, same APK)

## Goal

When an inspector confirms a pin in the map location picker, the form's
Province, City/Municipality and Barangay dropdowns fill themselves from
the pin — offline, instantly, and with values that are exactly the strings
those dropdowns already offer. Latitude/Longitude move to the top of the
address block so the natural flow is pin first, then refine the street
line.

## Decisions taken during brainstorming

| Question | Decision |
|---|---|
| How a pin becomes an address | Bundled barangay boundary polygons + point-in-polygon lookup. Online reverse geocoding was rejected: it needs internet where inspectors are, returns free-text names that only fuzzily match PSGC names, and rarely knows barangays |
| Boundary dataset | `faeldon/philippines-json-maps` (MIT), 2023 PSGC, **medres** per-municipality barangay files for the 73 MIMAROPA municipalities (~1,460 polygons, ~1.9 MB raw → ~1.1 MB after trimming; ~350 KB compressed in the APK). Lowres (~6 points per ring) was rejected as too coarse near borders |
| Name authority | The app's `mimaropaLocations.ts` strings stay the source of truth for the dropdowns and stored records. PSGC polygon names are mapped to them at **build time**; the runtime never sees a PSGC name |
| Overwrite semantics | A confirm with a resolved address overwrites Province, City and Barangay. Address Line is never touched. A null address (pin outside every polygon) leaves the three fields as they were |
| Manual typing | Typing into Latitude/Longitude never triggers a lookup. Only the picker's Confirm does |
| Field order | All four forms: Establishment Name → Latitude/Longitude (+ Pin on map) → Address Line → Province / City → Barangay → Nature of Business → PSIC Code → … |
| Branch | Continues on `feat/map-location-picker` as a second spec and plan |

## Reconciliation findings (from the pre-design check)

Exact normalized-name matching of PSGC 2023 against `mimaropaLocations.ts`
covers 64/73 municipalities and ~90 % of barangays. The residue is
systematic, not random:

- Capital/alias suffixes on municipalities: `Boac (Capital)` ↔ `Boac`,
  `City Of Calapan (Capital)` ↔ `City of Calapan`, `Bulalacao (San Pedro)`,
  `El Nido (Bacuit)`, `Rizal (Marcos)`, `Santa Maria (Imelda)`, `Romblon
  (Capital)`, `Mamburao (Capital)`.
- Puerto Princesa is its own PSGC second-level unit (`1731500000`) but a
  Palawan municipality in the app.
- Barangay suffixes/variants: `Bonbon (Pob.)` ↔ `Bonbon`, `Barangay I` ↔
  `Barangay 1`, `Udalo (Camurong)` ↔ `Udalo`, `Bagong Silang Pob.`,
  diacritics (`Sofronio Española`).

These are handled by a normalizer plus a checked-in alias table; anything
still unmatched fails the build script rather than shipping a gap.

## Architecture

```
scripts/
  build-barangay-boundaries.mjs   PSGC medres files → src/data/mimaropaBoundaries.json
  barangayNameMatch.mjs           normalizer + alias table (unit-tested)
src/data/
  mimaropaBoundaries.json         [{ p, c, b, bbox, rings }] — generated, committed
src/features/location/
  resolveAddress.ts               resolveAddress(lat, lng) → ResolvedAddress | null
  pointInPolygon.ts               ray casting over flat rings with holes
```

### Build script

`node scripts/build-barangay-boundaries.mjs [--from <dir>]`

1. Reads the 73 medres `bgysubmuns-municity-17*.json` files (downloaded
   from the repo's `2023/geojson/municities/medres/` into a local
   directory; the script never runs at app build time).
2. Resolves each feature's province from `adm2_psgc` (five codes, plus
   `1731500000` → Palawan), municipality from the `municities-provdist-*`
   files' `adm3_en`, and barangay from `adm4_en`.
3. Maps each `(province, municipality, barangay)` triple to the exact
   strings in `mimaropaLocations.ts` through `barangayNameMatch.mjs`:
   - normalize both sides: NFKD → ASCII, lowercase, strip parentheticals,
     strip a trailing `pob.`/`poblacion` marker, Roman numerals → Arabic,
     drop non-alphanumerics;
   - then consult `ALIASES` (keyed by PSGC code → app string) for the
     residue.
4. **Fails** (non-zero exit, listing every offender) if any polygon maps to
   nothing, if two polygons map to the same app barangay, or if any app
   barangay has no polygon. The generated file is only written when the
   mapping is complete in both directions.
5. Writes `src/data/mimaropaBoundaries.json`: an array of
   `{ p: string, c: string, b: string, bbox: [w, s, e, n], rings: number[][] }`
   where `rings[0]` is the outer ring and the rest are holes, each ring a
   flat `[lng, lat, lng, lat, …]` array rounded to 5 dp; a MultiPolygon
   becomes one entry per polygon (same `p/c/b`). The file starts with no
   header (JSON), so the provenance and license note lives in
   `resolveAddress.ts` next to the `require`.

### Runtime lookup

```ts
export interface ResolvedAddress { province: string; city: string; barangay: string }
export function resolveAddress(lat: number, lng: number): ResolvedAddress | null
```

- Lazily `require()`s the JSON on first call (Metro executes modules on
  first require, so app start pays nothing).
- Bbox prefilter, then `pointInPolygon(lng, lat, rings)` — ray casting;
  a point inside the outer ring and inside any hole is outside.
- First hit wins; on-border ambiguity is accepted (a pin exactly on a
  boundary line is a coin toss either way and the inspector can correct
  the dropdown).
- Returns the app's own strings, so callers assign them straight to the
  cascading `SelectField`s, whose option lists derive from those values.

### Picker

- Readout gains a second line under the coordinates, resolved on every
  settled region change: `Brgy. Cabigaan, Aborlan, Palawan`. When null:
  `Outside MIMAROPA barangay boundaries` in muted text.
- `PickedLocation` becomes `{ lat: number; lng: number; address: ResolvedAddress | null }`.
  Confirm resolves once more from the rounded coordinates so the payload
  and the readout can't disagree.

### `CoordinateFields`

`onChange(next: { lat: string; lng: string; address?: ResolvedAddress | null })`
— typed edits omit `address`; a picker confirm passes it (possibly null).
Nothing else changes on the component.

### Forms (four call sites)

Each `onChange` handler applies the address when present:

```ts
onChange={({ lat, lng, address }) =>
  setForm({ ...form, geoLat: lat, geoLng: lng, ...(address ? { province: address.province, city: address.city, barangay: address.barangay } : {}) })}
```

and the lat/lng row moves to directly under Establishment Name (above
Address Line) in all four forms. Focus chain: Name → Latitude → Longitude
→ Address Line → (Nature of Business …). Province/City/Barangay are
`SelectField`s and never take keyboard focus, as today.

## Error handling

| Situation | Behaviour |
|---|---|
| Pin outside every polygon (sea, another region) | Readout shows the muted "Outside…" line; Confirm still returns coordinates with `address: null`; dropdowns untouched |
| Bundle fails to load (should be impossible — it's a static module) | `resolveAddress` catches, warns once, returns null; the picker behaves as "outside" |
| Build script can't map a polygon / a barangay has no polygon | Script exits non-zero listing offenders; nothing is written |
| Two polygons claim the same app barangay | Build failure (duplicate) — surfaces a bad alias |

## Testing

- `scripts/__tests__/barangayNameMatch.test.js` — normalizer cases from
  the reconciliation list above; alias lookup; duplicate detection.
- `pointInPolygon.test.ts` — square, concave shape, hole, on-vertex,
  outside bbox.
- `resolveAddress.test.ts` — against the real bundle: a known point inside
  Brgy. Cabigaan, Aborlan resolves; a point in the sea returns null; every
  entry's bbox centroid resolves to *some* address (sanity over the whole
  file).
- `LocationPickerModal.test.tsx` — address line updates on region change;
  Confirm payload carries the resolved address; null case shows the
  "Outside…" text.
- `CoordinateFields.test.tsx` — typed edit passes no `address`; confirm
  passes it through.
- `EstablishmentInfoSections.test.tsx` — confirming a pin in edit mode
  sets Province/City/Barangay and leaves Address Line alone; the saved
  patch carries the new values.

## Out of scope

- Reverse geocoding of any kind.
- Resolving an address from manually typed coordinates.
- Street/address-line inference.
- Regions outside MIMAROPA.
