import { OfflineManager } from '@maplibre/maplibre-react-native';
import { boundsAround, cacheAreaAroundPin } from './offlinePacks';
import { MAP_STYLE_URL, PIN_PACK_MAX_ZOOM, PIN_PACK_MIN_ZOOM } from './mapConfig';

const manager = OfflineManager as unknown as {
  getPacks: jest.Mock;
  deletePack: jest.Mock;
  createPack: jest.Mock;
};

describe('boundsAround', () => {
  it('returns a [west, south, east, north] box about 2 km across for a 1 km half-size', () => {
    const [west, south, east, north] = boundsAround(11.144, 119.395, 1);
    // 1 km of latitude ≈ 0.008993°; longitude widens by 1/cos(lat) at 11°N.
    expect(north - south).toBeCloseTo(0.017986, 4);
    expect(east - west).toBeCloseTo(0.018324, 4);
    expect((north + south) / 2).toBeCloseTo(11.144, 6);
    expect((east + west) / 2).toBeCloseTo(119.395, 6);
  });
});

describe('cacheAreaAroundPin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    manager.getPacks.mockResolvedValue([]);
  });

  it('creates a pack named in metadata around the pin at the configured zooms', async () => {
    await cacheAreaAroundPin('estab:abc', 11.144, 119.395);
    expect(manager.createPack).toHaveBeenCalledTimes(1);
    const [options, onProgress, onError] = manager.createPack.mock.calls[0];
    expect(options).toEqual({
      mapStyle: MAP_STYLE_URL,
      bounds: boundsAround(11.144, 119.395, 1),
      minZoom: PIN_PACK_MIN_ZOOM,
      maxZoom: PIN_PACK_MAX_ZOOM,
      metadata: { name: 'estab:abc' },
    });
    expect(typeof onProgress).toBe('function');
    expect(typeof onError).toBe('function');
  });

  it('deletes an existing pack with the same name before creating the new one', async () => {
    manager.getPacks.mockResolvedValue([
      { id: 'old-1', metadata: { name: 'estab:abc' } },
      { id: 'other', metadata: { name: 'estab:zzz' } },
    ]);
    await cacheAreaAroundPin('estab:abc', 11.144, 119.395);
    expect(manager.deletePack).toHaveBeenCalledTimes(1);
    expect(manager.deletePack).toHaveBeenCalledWith('old-1');
    expect(manager.createPack).toHaveBeenCalledTimes(1);
  });

  it('swallows native errors and only warns', async () => {
    manager.createPack.mockRejectedValueOnce(new Error('tile limit'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(cacheAreaAroundPin('estab:abc', 11.144, 119.395)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
