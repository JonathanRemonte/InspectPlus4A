// The current region's provinces, cities/municipalities and barangays (see
// src/region/locations.ts) — the region every sample fixture and constant in
// this app is scoped to. Not an exhaustive PH province list. Backed by the
// bundled dataset so address entry can cascade Province -> City/Municipality
// -> Barangay while staying fully offline.
import { region } from '../region';

const LOCATIONS = region.locations.locations;

export const PROVINCE_OPTIONS = Object.keys(LOCATIONS);

export function getCityOptions(province: string): string[] {
  return province ? Object.keys(LOCATIONS[province] ?? {}) : [];
}

export function getBarangayOptions(province: string, city: string): string[] {
  if (!province || !city) return [];
  return LOCATIONS[province]?.[city] ?? [];
}
