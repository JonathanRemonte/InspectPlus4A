import type { BoundaryEntry, RegionLocations } from '../core/region/contract';
import { LOCATIONS } from './data/calabarzonLocations';

// EMB Region 4-A (CALABARZON): Batangas, Cavite, Laguna, Quezon and Rizal.
export const locations: RegionLocations = {
  locations: LOCATIONS,
  // Frames all five provinces, Quezon's eastern coast included.
  overview: { center: [121.7, 14.0], zoom: 7 },
  // Polygons from scripts/build-barangay-boundaries.js; required inside the
  // function so app start never parses it.
  loadBoundaries: () => require('./data/calabarzonBoundaries.json') as BoundaryEntry[],
  outsideBoundariesLabel: 'Outside CALABARZON barangay boundaries',
};
