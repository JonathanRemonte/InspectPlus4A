import { region } from '..';

describe('EMB4A region', () => {
  it('identifies itself as EMB4A', () => {
    expect(region.identity).toEqual({
      id: 'emb4a',
      systemName: 'EMB4A INSPECTION & MONITORING SYSTEM',
      regionLabel: 'EMB Region 4-A',
      copyrightLine: '© 2026 EMB - Environmental Management Bureau, Region 4-A',
      releaseRepo: 'JonathanRemonte/InspectPlus4A',
    });
  });

  it('offers the five CALABARZON provinces', () => {
    expect(Object.keys(region.locations.locations)).toEqual(['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal']);
  });

  it('loads barangay boundaries lazily', () => {
    const entries = region.locations.loadBoundaries();
    expect(entries.length).toBeGreaterThan(4000);
    expect(new Set(entries.map(e => e.p))).toEqual(new Set(['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal']));
  });
});
