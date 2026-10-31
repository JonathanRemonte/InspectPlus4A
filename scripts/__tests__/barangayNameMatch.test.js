const { normalizeName, buildLocationIndex, matchFeature } = require('../barangayNameMatch');

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

// A self-contained definition — the foundation test must not depend on any
// one region's data.
const DEF = {
  provinceByAdm2: { 1705300000: 'Palawan', 1705900000: 'Romblon', 1731500000: 'Palawan' },
  municipalityAliases: { 1731500000: 'Puerto Princesa City (Capital)' },
  barangayAliases: { 1705911013: { name: 'Binugusan', note: 'test alias' } },
};

describe('matchFeature', () => {
  const index = buildLocationIndex(LOCATIONS);
  const munis = { 1705301000: 'Aborlan', 1705911000: 'San Agustin', 1705909000: 'Odiongan' };

  it('matches by normalized name', () => {
    expect(
      matchFeature({ adm2_psgc: 1705300000, adm3_psgc: 1705301000, adm4_psgc: 1705301005, adm4_en: 'Cabigaan' }, munis, index, DEF),
    ).toEqual({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' });
  });

  it('resolves the municipality through municipalityAliases when the PSGC name is absent', () => {
    expect(DEF.municipalityAliases[1731500000]).toBe('Puerto Princesa City (Capital)');
    expect(
      matchFeature({ adm2_psgc: 1731500000, adm3_psgc: 1731500000, adm4_psgc: 1731500030, adm4_en: 'Masikap' }, munis, index, DEF),
    ).toEqual({ province: 'Palawan', city: 'Puerto Princesa City (Capital)', barangay: 'Masikap' });
  });

  it('resolves a barangay through barangayAliases before normalization', () => {
    expect(DEF.barangayAliases[1705911013].name).toBe('Binugusan');
    expect(
      matchFeature({ adm2_psgc: 1705900000, adm3_psgc: 1705911000, adm4_psgc: 1705911013, adm4_en: 'Hinugusan' }, munis, index, DEF),
    ).toEqual({ province: 'Romblon', city: 'San Agustin', barangay: 'Binugusan' });
  });

  it('throws UNMATCHED when nothing maps', () => {
    expect(() =>
      matchFeature({ adm2_psgc: 1705300000, adm3_psgc: 1705301000, adm4_psgc: 1705301099, adm4_en: 'Nowhere' }, munis, index, DEF),
    ).toThrow(/^UNMATCHED/);
  });

  it('throws AMBIGUOUS when normalization collapses two app names into one', () => {
    expect(() =>
      matchFeature({ adm2_psgc: 1705900000, adm3_psgc: 1705909000, adm4_psgc: 1705909001, adm4_en: 'Poblacion' }, munis, index, DEF),
    ).toThrow(/^AMBIGUOUS/);
  });
});
