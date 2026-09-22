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
