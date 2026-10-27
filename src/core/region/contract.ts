// What the foundation needs from a region. Each region repo (EMB4B, EMB4A)
// implements it through three entry points — src/region, src/region/db and
// src/region/modules — and src/core/region/assertRegion.ts makes tsc fail
// when an entry point drifts from these shapes. See docs/upstream-merge.md.

export interface RegionIdentity {
  /** Stable id, e.g. 'emb4b'. */
  id: string;
  /** The header lockup line, e.g. 'EMB4B INSPECTION & MONITORING SYSTEM'. */
  systemName: string;
  /** The home footer line. */
  copyrightLine: string;
}

/** The `src/region` entry point. */
export interface RegionIndex {
  region: {
    identity: RegionIdentity;
    locations: RegionLocations;
  };
}

/** One simplified barangay polygon, as scripts/build-barangay-boundaries.js emits it. */
export interface BoundaryEntry {
  p: string; // province
  c: string; // city/municipality
  b: string; // barangay
  bbox: [number, number, number, number]; // west, south, east, north
  rings: number[][];
}

export interface RegionLocations {
  /** province -> city/municipality -> barangays, bundled for offline address entry. */
  locations: Record<string, Record<string, string[]>>;
  /** Where the map picker opens with no pin and no GPS fix. */
  overview: { center: [number, number]; zoom: number };
  /** The barangay boundary polygons. Large: call lazily, never at module scope. */
  loadBoundaries(): BoundaryEntry[];
  /** Shown when a pin falls outside every boundary. */
  outsideBoundariesLabel: string;
}
