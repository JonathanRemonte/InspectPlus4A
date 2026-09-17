import { OfflineManager, type LngLat } from '@maplibre/maplibre-react-native';

// OpenFreeMap: free, keyless vector tiles. One constant so the basemap can
// be swapped (e.g. to a self-hosted style) without touching the picker.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Where the picker opens when it has nothing better — no field values and
// no last GPS fix. Wide enough to show all five MIMAROPA provinces.
export const MIMAROPA_OVERVIEW: { center: LngLat; zoom: number } = {
  center: [120.5, 12.0],
  zoom: 7,
};

// Street level: a compound's buildings are distinguishable, which is what
// an inspector needs to drop the pin on the right gate.
export const PIN_ZOOM = 16;

// MapLibre keeps every tile viewed online in an ambient cache (default
// 50 MB). Raised so a week of field use doesn't evict itself.
export const AMBIENT_CACHE_BYTES = 200 * 1024 * 1024;

// The silent offline pack created around every confirmed pin — ±1 km at
// zoom 12–16 is a few hundred vector tiles, a few MB.
export const PIN_PACK_HALF_SIZE_KM = 1;
export const PIN_PACK_MIN_ZOOM = 12;
export const PIN_PACK_MAX_ZOOM = 16;

// Called once at app start. Failure here only means the default cache
// size stays in effect, so it's logged and otherwise ignored.
export async function initMapCache(): Promise<void> {
  try {
    await OfflineManager.setMaximumAmbientCacheSize(AMBIENT_CACHE_BYTES);
  } catch (err) {
    console.warn('[mapConfig] could not raise the ambient tile cache size', err);
  }
}
