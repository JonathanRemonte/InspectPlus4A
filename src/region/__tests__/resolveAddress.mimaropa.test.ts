import { formatResolvedAddress, resolveAddress } from '../../features/location/resolveAddress';
import { pointInPolygon } from '../../features/location/pointInPolygon';
import { region } from '..';

type Entry = { p: string; c: string; b: string; bbox: number[]; rings: number[][] };
// Same loader the module uses; typed loosely on purpose.
const entries = region.locations.loadBoundaries() as Entry[];

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

  // Tagwak (Boac, Marinduque) lies entirely inside Pawa's simplified
  // polygon, and "Pawa" sorts first alphabetically — under a first-hit
  // tie-break no coordinate could ever resolve to Tagwak. This is Tagwak's
  // own vertex centroid (verified inside its ring by the same ray-casting
  // logic pointInPolygon uses), rounded to the bundle's 5 dp.
  it('resolves a point inside Tagwak to Tagwak, not the enclosing Pawa polygon', () => {
    expect(resolveAddress(13.44483, 121.8763)).toEqual({ province: 'Marinduque', city: 'Boac (Capital)', barangay: 'Tagwak' });
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
    // Measured over the real bundle: 1811 centroids pass the concave
    // filter above. Expected 0 mismatches now that resolveAddress breaks
    // ties by smallest bbox area instead of first hit — that rule is what
    // fixed the one mismatch this sweep used to find (Tagwak's centroid
    // used to resolve to the enclosing Pawa polygon; see the Tagwak test
    // above).
    expect(checked).toBeGreaterThan(1700);
    expect(mismatches).toBe(0);
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
