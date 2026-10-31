// EMB Region 4-A (CALABARZON). The light entry point: data the foundation
// reads at module scope. Heavy per-type UI lives behind src/region/modules.
import { identity } from './identity';
import { locations } from './locations';

export const region = {
  identity,
  locations,
};

export * from './catalog';
export * from './templates';
export type { RegionComplianceView } from './complianceViews';
