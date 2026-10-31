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
