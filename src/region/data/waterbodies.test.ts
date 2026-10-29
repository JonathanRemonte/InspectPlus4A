import { WATERBODIES } from './mimaropaWaterbodies';
import { getWaterbodyGroups, WATERBODY_NOT_LISTED } from './waterbodies';

// Both sets of figures are printed in the source PDF's own summary table, so
// they are an independent check on the extraction rather than a restatement
// of it. If the dataset is ever regenerated from a newer list, these move
// only alongside that document's own figures.
//
// A waterbody carrying several classifications is offered once per class -
// an outlet discharges into one stretch of a river, and that stretch's
// standard is the one that binds - so the dropdown holds one option per
// classification assigned (125), not one per waterbody (102).
const WATERBODIES_PER_PROVINCE = {
  'Occidental Mindoro': 13,
  'Oriental Mindoro': 24,
  Marinduque: 8,
  Romblon: 7,
  Palawan: 50,
};
const OPTIONS_PER_PROVINCE = {
  'Occidental Mindoro': 14,
  'Oriental Mindoro': 25,
  Marinduque: 11,
  Romblon: 8,
  Palawan: 67,
};

const allOptions = () => Object.values(WATERBODIES).flatMap(gs => gs.flatMap(g => g.options));
const optionsOf = (province: string) => WATERBODIES[province].flatMap(g => g.options);
// The name is everything before the final parenthesised class. Some names
// carry their own parentheses - 'Aramaywan River (Narra Stream)' - so only
// the last group is stripped.
const nameOf = (option: string) => option.replace(/\s\([^()]*\)$/, '');

describe('bundled waterbody dataset', () => {
  it('offers one option per classification the source PDF assigns', () => {
    expect(allOptions()).toHaveLength(125);
  });

  it('covers every waterbody the source PDF counts', () => {
    expect(new Set(allOptions().map(nameOf)).size).toBe(102);
  });

  it.each(Object.entries(OPTIONS_PER_PROVINCE))('%s: offers %s options', (province, expected) => {
    expect(optionsOf(province as string)).toHaveLength(expected as number);
  });

  it.each(Object.entries(WATERBODIES_PER_PROVINCE))('%s: covers %s waterbodies', (province, expected) => {
    expect(new Set(optionsOf(province as string).map(nameOf)).size).toBe(expected as number);
  });

  // One class per option. A qualifier may follow the class - 'assigned',
  // 'brackish mangrove' - and is told apart from a second class by case:
  // classes are upper-case letters, qualifiers start lower-case.
  it('renders every option as "Name (Class)" with a single class', () => {
    allOptions().forEach(option =>
      expect(option).toMatch(/^.+ \([A-Z]{1,2}(, [a-z][A-Za-z ]*)?\)$/),
    );
  });

  it('splits a waterbody with several classifications into one option per class', () => {
    const marinduque = optionsOf('Marinduque');
    expect(marinduque).toEqual(expect.arrayContaining(['Tawiran River (A)', 'Tawiran River (B)', 'Tawiran River (C)']));
    expect(marinduque).toEqual(expect.arrayContaining(['Ulan Bay (SB)', 'Ulan Bay (SC)']));
    expect(marinduque).not.toContain('Tawiran River (A, B, C)');
    expect(marinduque).not.toContain('Ulan Bay (SB, SC)');
  });

  // These three carry a qualifier on a single class, not a second class.
  // 'C, assigned' means "provisionally C", and 'SC, brackish mangrove' says
  // what kind of SC water it is. Neither is two options.
  it('keeps a qualifier with its class rather than splitting it off', () => {
    const orMin = optionsOf('Oriental Mindoro');
    const palawan = optionsOf('Palawan');
    expect(orMin).toContain('Madugo River (C, assigned)');
    expect(orMin).toContain('Pinamalayan River (C, assigned)');
    expect(palawan).toContain('Rio Tuba River (SC, brackish mangrove)');
    expect(orMin).not.toContain('Madugo River (assigned)');
    expect(palawan).not.toContain('Rio Tuba River (brackish mangrove)');
  });

  it('keeps a split waterbody’s options adjacent', () => {
    const marinduque = optionsOf('Marinduque');
    const tawiran = marinduque.filter(o => nameOf(o) === 'Tawiran River');
    const first = marinduque.indexOf(tawiran[0]);
    expect(marinduque.slice(first, first + tawiran.length)).toEqual(tawiran);
  });

  // The generator's count gates never inspect an individual name, so a
  // section heading bleeding into a name band during coordinate-based
  // extraction (e.g. 'Balanacan River WATERBODY (C)') could ship undetected.
  // This is an independent check on the name portion specifically.
  it('never carries a section-heading artifact in a name', () => {
    const HEADING_TOKENS = [
      'WATERBODY',
      'WATERBODIES',
      'CLASSIFICATION',
      'For Classification',
      'PRINCIPAL RIVERS',
      'MINOR RIVERS',
    ];
    allOptions().forEach(option => {
      HEADING_TOKENS.forEach(token => expect(nameOf(option)).not.toContain(token));
    });
  });

  it('orders groups principal, then minor, then other', () => {
    // Romblon has no principal rivers at all, so the assertion is about
    // relative order rather than a fixed list.
    const ORDER = ['Principal Rivers', 'Minor Rivers', 'Other Waterbodies'];
    Object.values(WATERBODIES).forEach(groups => {
      const positions = groups.map(g => ORDER.indexOf(g.label));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(positions).not.toContain(-1);
    });
  });
});

describe('getWaterbodyGroups', () => {
  it('returns only the named province’s waterbodies', () => {
    const groups = getWaterbodyGroups('Marinduque');
    expect(groups.flatMap(g => g.options)).toContain('Boac River (C)');
    expect(groups.flatMap(g => g.options)).not.toContain('Honda Bay (SB)');
  });

  // An establishment outside MIMAROPA, or one whose province was never
  // filled in, would otherwise face a dropdown with nothing in it. A long
  // list beats a dead control.
  it('falls back to every province when the province is unknown', () => {
    expect(getWaterbodyGroups('Cebu').flatMap(g => g.options)).toHaveLength(125);
  });

  it('falls back to every province when the province is blank', () => {
    expect(getWaterbodyGroups('').flatMap(g => g.options)).toHaveLength(125);
  });

  it('offers a not-listed escape hatch', () => {
    expect(WATERBODY_NOT_LISTED).toBe('Not listed (specify)');
  });
});
