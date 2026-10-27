import { region } from '..';

describe('EMB4B region', () => {
  it('identifies itself', () => {
    expect(region.identity).toEqual({
      id: 'emb4b',
      systemName: 'EMB4B INSPECTION & MONITORING SYSTEM',
      copyrightLine: '© 2026 EMB - Environmental Management Bureau, Region 4-B',
    });
  });

  it('offers the five MIMAROPA provinces', () => {
    const provinces = Object.keys(region.locations.locations);
    expect(provinces).toHaveLength(5);
    expect(provinces).toEqual(expect.arrayContaining(['Occidental Mindoro', 'Palawan']));
  });

  it('opens the map on the MIMAROPA overview', () => {
    expect(region.locations.overview).toEqual({ center: [120.5, 12.0], zoom: 7 });
  });

  it('loads barangay boundaries lazily', () => {
    const entries = region.locations.loadBoundaries();
    expect(entries.length).toBeGreaterThan(1000);
    expect(entries[0]).toEqual(expect.objectContaining({ p: expect.any(String), c: expect.any(String), b: expect.any(String) }));
  });
});
