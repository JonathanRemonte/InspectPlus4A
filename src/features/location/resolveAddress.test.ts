import { formatResolvedAddress, resolveAddress } from './resolveAddress';
import { pointInPolygon } from './pointInPolygon';

type Entry = { p: string; c: string; b: string; bbox: number[]; rings: number[][] };
// Same lazy require the module uses; typed loosely on purpose.
const entries = require('../../data/mimaropaBoundaries.json') as Entry[];

describe('resolveAddress', () => {
  it('resolves a point inside Brgy. Cabigaan, Aborlan, Palawan', () => {
    expect(resolveAddress(9.45777, 118.47504)).toEqual({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' });
  });

  it('returns null for a point in the sea (the MIMAROPA overview centre)', () => {
    expect(resolveAddress(12.0, 120.5)).toBeNull();
  });

  it('returns null for coordinates far outside the region', () => {
    expect(resolveAddress(14.5995, 120.9842)).toBeNull(); // Manila
  });

  it('resolves every polygon whose vertex centroid lies inside it back to its own barangay', () => {
    let checked = 0;
    let mismatches = 0;
    for (const e of entries) {
      const ring = e.rings[0];
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < ring.length; i += 2) {
        sx += ring[i];
        sy += ring[i + 1];
      }
      const lng = sx / (ring.length / 2);
      const lat = sy / (ring.length / 2);
      if (!pointInPolygon(lng, lat, e.rings)) continue; // concave: centroid may fall outside
      checked += 1;
      const got = resolveAddress(lat, lng);
      if (!got || got.province !== e.p || got.city !== e.c || got.barangay !== e.b) mismatches += 1;
    }
    expect(checked).toBeGreaterThan(1000);
    // Overlapping simplified borders can hand a centroid to a neighbour;
    // that must stay rare.
    expect(mismatches / checked).toBeLessThan(0.02);
  });
});

describe('formatResolvedAddress', () => {
  it('formats a resolved address', () => {
    expect(formatResolvedAddress({ province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' })).toBe('Brgy. Cabigaan, Aborlan, Palawan');
  });
  it('formats null as the outside-boundaries note', () => {
    expect(formatResolvedAddress(null)).toBe('Outside MIMAROPA barangay boundaries');
  });
});
