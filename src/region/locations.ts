import type { BoundaryEntry, RegionLocations } from '../core/region/contract';
import { LOCATIONS } from './data/mimaropaLocations';

// EMB Region 4-B (MIMAROPA): Occidental Mindoro, Oriental Mindoro,
// Marinduque, Romblon and Palawan.
export const locations: RegionLocations = {
  locations: LOCATIONS,
  // Wide enough to show all five MIMAROPA provinces.
  overview: { center: [120.5, 12.0], zoom: 7 },
  // ~866 KB of polygons from scripts/build-barangay-boundaries.js; required
  // inside the function so app start never parses it.
  loadBoundaries: () => require('./data/mimaropaBoundaries.json') as BoundaryEntry[],
  outsideBoundariesLabel: 'Outside MIMAROPA barangay boundaries',
};
