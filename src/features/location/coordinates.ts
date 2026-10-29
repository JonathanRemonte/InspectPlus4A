import type { LngLat } from '@maplibre/maplibre-react-native';
import { REGION_OVERVIEW, PIN_ZOOM } from './mapConfig';

// Every form keeps lat/lng as the strings the inspector typed (see
// GeneralInfoFormState.geoLat/geoLng); these are the only places that
// turn them into numbers and back.

export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Both fields as one usable pair, or nothing — a form with only a latitude
// typed in has no point to open the map on.
export function parseLatLng(lat: string, lng: string): { lat: number; lng: number } | null {
  const parsedLat = parseCoordinate(lat);
  const parsedLng = parseCoordinate(lng);
  if (parsedLat == null || parsedLng == null || !isValidLatLng(parsedLat, parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

// 6 dp ≈ 0.1 m — more than a hand-placed pin can claim, and short enough
// to read in a form field.
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

interface ResolveInitialCameraArgs {
  lat: string;
  lng: string;
  lastFix: { lat: number; lng: number } | null;
}

// Where the picker opens: the caller's own values first (editing a known
// site must start on that site), then wherever the phone last was, then a
// regional overview. MapLibre takes [lng, lat].
export function resolveInitialCamera({ lat, lng, lastFix }: ResolveInitialCameraArgs): {
  center: LngLat;
  zoom: number;
} {
  const fromFields = parseLatLng(lat, lng);
  if (fromFields) {
    return { center: [fromFields.lng, fromFields.lat], zoom: PIN_ZOOM };
  }
  if (lastFix && isValidLatLng(lastFix.lat, lastFix.lng)) {
    return { center: [lastFix.lng, lastFix.lat], zoom: PIN_ZOOM };
  }
  return REGION_OVERVIEW;
}
