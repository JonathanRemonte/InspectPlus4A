import { OfflineManager, type LngLatBounds } from '@maplibre/maplibre-react-native';
import {
  MAP_STYLE_URL,
  PIN_PACK_HALF_SIZE_KM,
  PIN_PACK_MAX_ZOOM,
  PIN_PACK_MIN_ZOOM,
} from './mapConfig';

const KM_PER_DEGREE_LAT = 111.195;

// A square of ±halfSizeKm around a point, as MapLibre's [w, s, e, n].
// Longitude degrees shrink with latitude, so the east/west span is widened
// by 1/cos(lat) to keep the box square on the ground.
export function boundsAround(lat: number, lng: number, halfSizeKm: number): LngLatBounds {
  const dLat = halfSizeKm / KM_PER_DEGREE_LAT;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

// Fire-and-forget: called from the picker's Confirm while online so the
// site is viewable offline next time, and never awaited by UI. A pack of
// the same name (an establishment re-pinned, or the new-establishment
// modal's rolling `estab:pending`) is replaced, not accumulated. Errors
// only cost the cache, never the pin, so they're logged and dropped.
export async function cacheAreaAroundPin(name: string, lat: number, lng: number): Promise<void> {
  try {
    const existing = await OfflineManager.getPacks();
    for (const pack of existing) {
      if (pack.metadata?.name === name) {
        await OfflineManager.deletePack(pack.id);
      }
    }
    await OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE_URL,
        bounds: boundsAround(lat, lng, PIN_PACK_HALF_SIZE_KM),
        minZoom: PIN_PACK_MIN_ZOOM,
        maxZoom: PIN_PACK_MAX_ZOOM,
        metadata: { name },
      },
      () => {},
      (_pack, error) => {
        console.warn(`[offlinePacks] pack ${name} failed: ${error.message}`);
      },
    );
  } catch (err) {
    console.warn(`[offlinePacks] could not cache area for ${name}`, err);
  }
}
