// EMB Region 4-B (MIMAROPA). The light entry point: data the foundation
// reads at module scope. Heavy per-type UI lives behind src/region/modules.
import { identity } from './identity';
import { locations } from './locations';

export const region = {
  identity,
  locations,
};

export * from './catalog';
export type {
  AirComplianceView,
  EiaComplianceView,
  HazwasteComplianceView,
  RegionComplianceView,
  WaterComplianceView,
} from './complianceViews';
