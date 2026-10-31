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
