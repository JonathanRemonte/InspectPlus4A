// Ray casting over flat [lng, lat, lng, lat, …] rings (closing vertex
// omitted) — the shape mimaropaBoundaries.json stores, so the lookup never
// allocates per point.

export function pointInRing(lng: number, lat: number, ring: number[]): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// rings[0] is the outer boundary; the rest are holes.
export function pointInPolygon(lng: number, lat: number, rings: number[][]): boolean {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}
