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
  };
}
