// Maps PSGC 2023 polygon names (faeldon/philippines-json-maps) onto the
// exact Province / City / Barangay strings the app's dropdowns use
// (the region's LOCATIONS table). Runs at dev time only — see
// build-barangay-boundaries.js. The runtime never sees a PSGC name.

const ROMAN = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};

// Both sides go through this before comparison. Each rule exists because
// the two datasets differ in exactly that way somewhere in a region's data:
// parentheticals ("Boac (Capital)", "Udalo (Camurong)"), Pob. markers,
// Sta./Sto. abbreviations, Roman numerals ("Barangay I"), diacritics
// ("Española", "Kiñaman").
function normalizeName(s) {
  let t = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\bpob\.?(?=\s|$)|\bpoblacion\b/g, ' ');
  t = t.replace(/\bsta\.?\s+/g, 'santa ').replace(/\bsto\.?\s+/g, 'santo ');
  t = t
    .trim()
    .split(/\s+/)
    .map(w => (w in ROMAN ? String(ROMAN[w]) : w))
    .join(' ');
  return t.replace(/[^a-z0-9]/g, '');
}

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

function matchFeature(props, muniNameByPsgc, index, def) {
  const province = def.provinceByAdm2[props.adm2_psgc];
  if (!province) throw new Error(`UNMATCHED province: adm2 ${props.adm2_psgc}`);

  const city =
    def.municipalityAliases[props.adm3_psgc] ??
    pickUnique(
      index.munis.get(`${province}|${normalizeName(muniNameByPsgc[props.adm3_psgc] ?? '')}`),
      'municipality',
      `adm3 ${props.adm3_psgc} "${muniNameByPsgc[props.adm3_psgc]}" in ${province}`,
    );

  const barangay =
    def.barangayAliases[props.adm4_psgc]?.name ??
    pickUnique(
      index.brgys.get(`${province}|${city}|${normalizeName(props.adm4_en)}`),
      'barangay',
      `adm4 ${props.adm4_psgc} "${props.adm4_en}" in ${city}, ${province}`,
    );

  return { province, city, barangay };
}

module.exports = { normalizeName, buildLocationIndex, matchFeature };
