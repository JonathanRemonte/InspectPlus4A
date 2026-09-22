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

// Pinned to the commit `master` pointed at on 2026-09-22 (via
// `gh api repos/faeldon/philippines-json-maps/commits/master --jq .sha`),
// not `master` itself, so a future regeneration can't silently pull
// different upstream geometry than the bundle currently committed.
const BASE = 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/8eeead560246863c8c820c31ca6fbca81a279477/2023/geojson';
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
    const text = await res.text();
    // Parse before caching: an HTML error page or a truncated body must
    // throw here, not get written to disk and look like a hard parse
    // failure on every run afterwards.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`invalid JSON fetching ${BASE}/${relPath}: ${err.message}`);
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
    return parsed;
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

// Ray casting over flat [lng, lat, lng, lat, …] rings — a small CommonJS
// copy of src/features/location/pointInPolygon.ts, which is the source of
// truth. This script can't `require` that TypeScript module directly, so
// this mirror exists purely to validate geometry at build time; keep it in
// sync with pointInPolygon.ts if that logic ever changes.
function pointInRing(lng, lat, ring) {
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

function pointInPolygon(lng, lat, rings) {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

// Mirrors resolveAddress.ts's smallest-bbox-area tie-break, so this
// validation exercises the same rule the app applies at runtime.
function resolveBySmallestBbox(allEntries, lat, lng) {
  let best = null;
  let bestArea = Infinity;
  for (const e of allEntries) {
    const [w, s, east, n] = e.bbox;
    if (lng < w || lng > east || lat < s || lat > n) continue;
    if (!pointInPolygon(lng, lat, e.rings)) continue;
    const area = (east - w) * (n - s);
    if (area < bestArea) {
      bestArea = area;
      best = e;
    }
  }
  return best;
}

// MIMAROPA's envelope, generously padded — anything outside this is not a
// simplification artifact, it's a bad coordinate (wrong axis order, wrong
// units, a stray feature from another region).
const MIMAROPA_ENVELOPE = { w: 114.0, s: 7.0, e: 123.5, n: 14.5 };

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

  // Geometry sanity, write-blocking like the checks above. Name matching
  // can be perfect and the geometry still be garbage (wrong axis order, a
  // simplification bug, a barangay fully swallowed by a neighbour's
  // polygon) — neither of the checks above would catch that.
  for (const e of entries) {
    const [w, s, east, n] = e.bbox;
    if (w < MIMAROPA_ENVELOPE.w || s < MIMAROPA_ENVELOPE.s || east > MIMAROPA_ENVELOPE.e || n > MIMAROPA_ENVELOPE.n) {
      errors.push(`BBOX OUTSIDE MIMAROPA: ${e.b}, ${e.c}, ${e.p} bbox=[${e.bbox.join(', ')}]`);
    }
  }
  for (const e of entries) {
    const ring = e.rings[0];
    let sx = 0;
    let sy = 0;
    const count = ring.length / 2;
    for (let i = 0; i < ring.length; i += 2) {
      sx += ring[i];
      sy += ring[i + 1];
    }
    const lng = sx / count;
    const lat = sy / count;
    if (!pointInPolygon(lng, lat, e.rings)) continue; // concave: centroid may fall outside its own polygon
    const resolved = resolveBySmallestBbox(entries, lat, lng);
    if (!resolved || resolved.p !== e.p || resolved.c !== e.c || resolved.b !== e.b) {
      const got = resolved ? `${resolved.b}, ${resolved.c}, ${resolved.p}` : 'null';
      errors.push(`CENTROID MISMATCH: ${e.b}, ${e.c}, ${e.p} centroid resolves to ${got}`);
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
