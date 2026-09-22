import { OfflineManager } from '@maplibre/maplibre-react-native';
import { AMBIENT_CACHE_BYTES, MAP_STYLE_URL, MIMAROPA_OVERVIEW, initMapCache } from './mapConfig';

describe('mapConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('points at the OpenFreeMap Liberty style and a MIMAROPA overview camera', () => {
    expect(MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(MIMAROPA_OVERVIEW).toEqual({ center: [120.5, 12.0], zoom: 7 });
  });

  it('raises the ambient cache ceiling to 200 MB', async () => {
    await initMapCache();
    expect(OfflineManager.setMaximumAmbientCacheSize).toHaveBeenCalledWith(AMBIENT_CACHE_BYTES);
    expect(AMBIENT_CACHE_BYTES).toBe(200 * 1024 * 1024);
  });

  it('never throws when the native module rejects', async () => {
    (OfflineManager.setMaximumAmbientCacheSize as jest.Mock).mockRejectedValueOnce(new Error('no native'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initMapCache()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
