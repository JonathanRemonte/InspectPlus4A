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

  it('loads barangay boundaries lazily', () => {
    const entries = region.locations.loadBoundaries();
    expect(entries.length).toBeGreaterThan(1000);
    expect(entries[0]).toEqual(expect.objectContaining({ p: expect.any(String), c: expect.any(String), b: expect.any(String) }));
  });
});
