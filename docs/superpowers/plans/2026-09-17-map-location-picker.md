# Map Location Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Pin on map" control beside every Latitude/Longitude pair opens a full-screen MapLibre map with a centre crosshair and a GPS button; confirming writes the pin into the two fields, and the area around the pin is cached for offline use automatically.

**Architecture:** One new feature module `src/features/location/` holds a pure coordinate helper, an offline-pack helper, a device-location hook, the `LocationPickerModal`, and a `CoordinateFields` row component that the four existing forms drop in where their hand-rolled Latitude/Longitude rows are today. The picker owns no persistence — callers keep lat/lng as strings in the state they already have.

**Tech Stack:** React Native 0.83 / Expo 55, `@maplibre/maplibre-react-native` 11.3 (OpenFreeMap Liberty style), `expo-location` (already a dependency), `@react-native-community/netinfo` (already a dependency), Jest via `jest-expo` with `react-test-renderer`.

**Spec:** `docs/superpowers/specs/2026-09-17-map-location-picker-design.md`

## Global Constraints

- Branch: `feat/map-location-picker` (already created off `develop`; the spec is committed on it).
- Dependency: `@maplibre/maplibre-react-native@^11.3.10`. Its config plugin goes in `app.json` `plugins` with **no** props. Nothing under `android/` is edited by hand.
- Basemap style URL: `https://tiles.openfreemap.org/styles/liberty`, held in one constant.
- MIMAROPA overview camera: centre `[120.5, 12.0]` (lng, lat), zoom `7`. Pin zoom: `16`.
- Ambient cache ceiling: `200 * 1024 * 1024` bytes. Pin pack: ~2 km square (±1 km), zoom `12`–`16`, metadata `{ name: 'estab:<estabId>' | 'estab:pending' }`.
- GPS: `Location.Accuracy.High`, 15 s timeout via `withTimeout`. The picker never auto-locates on open.
- Coordinates returned by the picker are rounded to 6 dp. Valid ranges: lat −90…90, lng −180…180.
- Copy (verbatim): picker title `Pin Location`; confirm button `Use this location`; cancel `Cancel`; offline banner `No map tiles available offline — your pin and GPS position still work.`; GPS notes `Location permission was denied.`, `Location services are turned off.`, `Couldn't get a GPS fix. Try again outdoors.`
- New `.tsx` files must import `Colors`, `Spacing`, `Radius`, `Type` from `src/design/*` and contain **no raw hex colour literals and no numeric `fontSize`/`borderRadius`** — `src/design/__tests__/driftGuard.test.ts` fails the suite otherwise. (`height`, `width`, padding numbers are fine.)
- Every commit message must pass commitlint: `type(scope): subject` with scope from `auth|sync|snapshot|air|water|hazwaste|eia|survey|establishments|reports|ci|repo|db|supabase|router`. End every commit body with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- The Husky pre-commit hook runs the whole Jest suite; a commit only lands when the suite is green.
- Run tests with `npx jest <path>` (PowerShell: same). Full checks: `npm run lint`, `npm run typecheck`, `npm test`.
- Existing form order convention: on `NewEstablishmentModal` and `EstablishmentInfoSections` the lat/lng row moves **below** Nature of Business / PSIC Code (the report-side forms already have that order).

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `app.json` | Dependency + config plugin registration |
| `jest.setup.js` | Global mocks for `@maplibre/maplibre-react-native`, `@react-native-community/netinfo`, `expo-location` |
| `src/features/location/mapConfig.ts` | Style URL, camera constants, cache constants, `initMapCache()` |
| `src/features/location/coordinates.ts` (+ test) | `parseCoordinate`, `isValidLatLng`, `roundCoordinate`, `formatCoordinate`, `resolveInitialCamera` |
| `src/features/location/offlinePacks.ts` (+ test) | `boundsAround`, `cacheAreaAroundPin` |
| `src/features/location/hooks/useDeviceLocation.ts` (+ test) | Permission + GPS fix state machine |
| `src/features/location/components/OfflineTilesBanner.tsx` | Informational strip over the map |
| `src/features/location/components/LocationPickerModal.tsx` (+ test) | The picker |
| `src/features/location/components/CoordinateFields.tsx` (+ test) | Lat/Lng inputs + "Pin on map" button |
| `src/app/_layout.tsx` | Calls `initMapCache()` once |
| `src/features/inspections/components/NewEstablishmentModal.tsx` | Call site 1 (+ field reorder) |
| `src/features/establishments/components/EstablishmentInfoSections.tsx` (+ test) | Call site 2 (+ geoLat/geoLng join the draft, field reorder) |
| `src/features/inspections/components/GeneralInformationTab.tsx` | Call site 3 |
| `src/features/inspections/components/GeneralInformationView.tsx` | Call site 4 |

---

### Task 1: Dependency, config plugin, global Jest mocks, `mapConfig.ts`

**Files:**
- Modify: `package.json` (dependencies), `app.json` (`expo.plugins`)
- Modify: `jest.setup.js`
- Create: `src/features/location/mapConfig.ts`
- Test: `src/features/location/mapConfig.test.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `MAP_STYLE_URL: string`, `MIMAROPA_OVERVIEW: { center: LngLat; zoom: number }`, `PIN_ZOOM = 16`, `AMBIENT_CACHE_BYTES`, `PIN_PACK_HALF_SIZE_KM = 1`, `PIN_PACK_MIN_ZOOM = 12`, `PIN_PACK_MAX_ZOOM = 16`, `initMapCache(): Promise<void>`.
- Produces (Jest): mocked `Map`, `Camera` (ref exposes `flyTo`/`jumpTo` as the exported `__cameraFlyTo`/`__cameraJumpTo` spies), `UserLocation`, `OfflineManager` spies; mocked NetInfo; mocked `expo-location`.

- [ ] **Step 1: Install the dependency**

```bash
npm install @maplibre/maplibre-react-native@^11.3.10
```

Expected: `package.json` gains `"@maplibre/maplibre-react-native": "^11.3.10"` under `dependencies`; `package-lock.json` updates. No `android/` files change (`git status` shows only `package.json` and `package-lock.json`).

- [ ] **Step 2: Register the config plugin in `app.json`**

In `app.json`, add `"@maplibre/maplibre-react-native"` as the last entry of `expo.plugins` (after `"expo-asset"`):

```json
      "expo-sharing",
      "expo-asset",
      "@maplibre/maplibre-react-native"
    ],
```

- [ ] **Step 3: Add the global Jest mocks**

Append to `jest.setup.js`:

```js
// MapLibre's components are native views and its OfflineManager is a
// TurboModule — neither exists under Jest. The stubs render a plain View so
// tests can find them by type (`findByType(Map)`), and Camera's ref exposes
// the two methods LocationPickerModal calls as spies tests can assert on.
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const cameraFlyTo = jest.fn();
  const cameraJumpTo = jest.fn();
  const stub = name => {
    const C = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }, props.children));
    C.displayName = name;
    return C;
  };
  const Camera = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ flyTo: cameraFlyTo, jumpTo: cameraJumpTo }));
    return React.createElement(View, props, props.children);
  });
  Camera.displayName = 'Camera';
  return {
    Map: stub('Map'),
    Camera,
    UserLocation: stub('UserLocation'),
    OfflineManager: {
      setMaximumAmbientCacheSize: jest.fn().mockResolvedValue(undefined),
      getPacks: jest.fn().mockResolvedValue([]),
      deletePack: jest.fn().mockResolvedValue(undefined),
      createPack: jest.fn().mockResolvedValue({ id: 'pack-1' }),
    },
    __cameraFlyTo: cameraFlyTo,
    __cameraJumpTo: cameraJumpTo,
  };
});

// NetInfo ships its own Jest mock (fetch resolves online, addEventListener
// is a no-op returning an unsubscribe). Per-file mocks still win.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

// expo-location's native module is absent under Jest. Defaults are the
// "happy path" so a component that merely imports it renders; tests that
// exercise permission/fix outcomes override these per case.
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 11.144, longitude: 119.395 } }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
}));
```

- [ ] **Step 4: Write the failing test for `initMapCache`**

Create `src/features/location/mapConfig.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest src/features/location/mapConfig.test.ts`
Expected: FAIL — `Cannot find module './mapConfig'`.

- [ ] **Step 6: Create `mapConfig.ts`**

```ts
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest src/features/location/mapConfig.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Call `initMapCache` from the root layout**

In `src/app/_layout.tsx`, add the import after the `DatabaseProvider` import:

```ts
import { initMapCache } from '../features/location/mapConfig';
```

Then inside `RootLayout` (before its `return`), add a one-time effect. `useEffect` is already imported from React in this file:

```tsx
export default function RootLayout() {
  // Raises MapLibre's ambient tile cache once per app launch — see
  // features/location/mapConfig.ts. Fire-and-forget; nothing renders
  // differently while it runs.
  useEffect(() => {
    void initMapCache();
  }, []);

  return (
```

- [ ] **Step 9: Verify the whole suite, lint and types still pass**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. (`src/design/__tests__/routeDirectoryGuard.test.ts` and `driftGuard.test.ts` are unaffected — no test files under `src/app`, no hex or numeric tokens added.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json app.json jest.setup.js src/features/location/mapConfig.ts src/features/location/mapConfig.test.ts src/app/_layout.tsx
git commit -m "feat(establishments): add MapLibre with an OpenFreeMap basemap and raised tile cache

Registers @maplibre/maplibre-react-native and its config plugin (no props,
so android/ is untouched), stubs it plus NetInfo and expo-location under
Jest, and raises the ambient tile cache to 200 MB at app start.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Coordinate helpers

**Files:**
- Create: `src/features/location/coordinates.ts`
- Test: `src/features/location/coordinates.test.ts`

**Interfaces:**
- Produces:
  - `parseCoordinate(text: string): number | null` — trims, `Number()`, rejects `''`/NaN/Infinity.
  - `isValidLatLng(lat: number, lng: number): boolean`.
  - `parseLatLng(lat: string, lng: string): { lat: number; lng: number } | null` — both parse and are in range, else null.
  - `roundCoordinate(value: number): number` — 6 dp.
  - `formatCoordinate(value: number): string` — `toFixed(6)`.
  - `resolveInitialCamera(args: { lat: string; lng: string; lastFix: { lat: number; lng: number } | null }): { center: LngLat; zoom: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/location/coordinates.test.ts`:

```ts
import {
  formatCoordinate,
  isValidLatLng,
  parseCoordinate,
  parseLatLng,
  resolveInitialCamera,
  roundCoordinate,
} from './coordinates';
import { MIMAROPA_OVERVIEW, PIN_ZOOM } from './mapConfig';

describe('parseCoordinate', () => {
  it('parses a decimal string with surrounding whitespace', () => {
    expect(parseCoordinate(' 11.144 ')).toBe(11.144);
  });
  it('returns null for empty, non-numeric or non-finite input', () => {
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('   ')).toBeNull();
    expect(parseCoordinate('abc')).toBeNull();
    expect(parseCoordinate('Infinity')).toBeNull();
  });
});

describe('isValidLatLng', () => {
  it('accepts values inside the WGS84 ranges', () => {
    expect(isValidLatLng(11.144, 119.395)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });
  it('rejects values outside the ranges', () => {
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(-90.0001, 0)).toBe(false);
  });
});

describe('parseLatLng', () => {
  it('returns numbers when both strings parse and are in range', () => {
    expect(parseLatLng('11.144', ' 119.395')).toEqual({ lat: 11.144, lng: 119.395 });
  });
  it('returns null when either is empty, non-numeric or out of range', () => {
    expect(parseLatLng('', '119.395')).toBeNull();
    expect(parseLatLng('11.144', 'x')).toBeNull();
    expect(parseLatLng('999', '119.395')).toBeNull();
  });
});

describe('roundCoordinate / formatCoordinate', () => {
  it('rounds to 6 decimal places', () => {
    expect(roundCoordinate(11.1234567891)).toBe(11.123457);
    expect(roundCoordinate(119.4)).toBe(119.4);
  });
  it('formats with exactly 6 decimals', () => {
    expect(formatCoordinate(11.1)).toBe('11.100000');
    expect(formatCoordinate(-119.3951234)).toBe('-119.395123');
  });
});

describe('resolveInitialCamera', () => {
  it('uses the field values at pin zoom when both are valid', () => {
    expect(resolveInitialCamera({ lat: '11.144', lng: '119.395', lastFix: { lat: 1, lng: 1 } })).toEqual({
      center: [119.395, 11.144],
      zoom: PIN_ZOOM,
    });
  });
  it('falls back to the last GPS fix when the fields are empty or invalid', () => {
    expect(resolveInitialCamera({ lat: '', lng: '', lastFix: { lat: 12.5, lng: 121.1 } })).toEqual({
      center: [121.1, 12.5],
      zoom: PIN_ZOOM,
    });
    expect(resolveInitialCamera({ lat: '999', lng: '119.4', lastFix: { lat: 12.5, lng: 121.1 } })).toEqual({
      center: [121.1, 12.5],
      zoom: PIN_ZOOM,
    });
  });
  it('falls back to the MIMAROPA overview when nothing else is available', () => {
    expect(resolveInitialCamera({ lat: '', lng: '', lastFix: null })).toEqual(MIMAROPA_OVERVIEW);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/location/coordinates.test.ts`
Expected: FAIL — `Cannot find module './coordinates'`.

- [ ] **Step 3: Create `coordinates.ts`**

```ts
import type { LngLat } from '@maplibre/maplibre-react-native';
import { MIMAROPA_OVERVIEW, PIN_ZOOM } from './mapConfig';

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
  return MIMAROPA_OVERVIEW;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/location/coordinates.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/location/coordinates.ts src/features/location/coordinates.test.ts
git commit -m "feat(establishments): add coordinate parsing and initial-camera helpers for the map picker

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Offline pack helper

**Files:**
- Create: `src/features/location/offlinePacks.ts`
- Test: `src/features/location/offlinePacks.test.ts`

**Interfaces:**
- Consumes: `MAP_STYLE_URL`, `PIN_PACK_HALF_SIZE_KM`, `PIN_PACK_MIN_ZOOM`, `PIN_PACK_MAX_ZOOM` from `./mapConfig`; `OfflineManager` from MapLibre.
- Produces:
  - `boundsAround(lat: number, lng: number, halfSizeKm: number): LngLatBounds` — `[west, south, east, north]`.
  - `cacheAreaAroundPin(name: string, lat: number, lng: number): Promise<void>` — never rejects.

- [ ] **Step 1: Write the failing tests**

Create `src/features/location/offlinePacks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/location/offlinePacks.test.ts`
Expected: FAIL — `Cannot find module './offlinePacks'`.

- [ ] **Step 3: Create `offlinePacks.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/location/offlinePacks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/location/offlinePacks.ts src/features/location/offlinePacks.test.ts
git commit -m "feat(establishments): cache a small offline tile pack around every confirmed pin

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `useDeviceLocation` hook

**Files:**
- Create: `src/features/location/hooks/useDeviceLocation.ts`
- Test: `src/features/location/hooks/useDeviceLocation.test.tsx`

**Interfaces:**
- Consumes: `expo-location`, `withTimeout` from `src/utils/withTimeout`.
- Produces:
  ```ts
  export type DeviceLocationStatus = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'failed';
  export interface DeviceFix { lat: number; lng: number }
  export function useDeviceLocation(): {
    status: DeviceLocationStatus;
    fix: DeviceFix | null;
    message: string | null;        // the verbatim GPS notes from Global Constraints, or null
    permissionGranted: boolean;    // true once a foreground grant has been observed
    locate: () => Promise<DeviceFix | null>;
    getLastKnownFix: () => Promise<DeviceFix | null>;
  }
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/features/location/hooks/useDeviceLocation.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import * as Location from 'expo-location';
import { useDeviceLocation } from './useDeviceLocation';

const mockLocation = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
};

type Hook = ReturnType<typeof useDeviceLocation>;
let latest!: Hook;

const Probe: React.FC = () => {
  latest = useDeviceLocation();
  return <Text>{latest.status}</Text>;
};

const renderHook = () => {
  TestRenderer.act(() => {
    TestRenderer.create(<Probe />);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  mockLocation.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 11.144, longitude: 119.395 } });
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
});

describe('useDeviceLocation', () => {
  it('starts idle with no fix and no message', () => {
    renderHook();
    expect(latest.status).toBe('idle');
    expect(latest.fix).toBeNull();
    expect(latest.message).toBeNull();
    expect(latest.permissionGranted).toBe(false);
  });

  it('locate() requests permission, takes a High-accuracy fix and exposes it', async () => {
    renderHook();
    let result: Awaited<ReturnType<Hook['locate']>> = null;
    await TestRenderer.act(async () => {
      result = await latest.locate();
    });
    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High });
    expect(result).toEqual({ lat: 11.144, lng: 119.395 });
    expect(latest.status).toBe('located');
    expect(latest.fix).toEqual({ lat: 11.144, lng: 119.395 });
    expect(latest.permissionGranted).toBe(true);
    expect(latest.message).toBeNull();
  });

  it('reports a denied permission and takes no fix', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    renderHook();
    await TestRenderer.act(async () => {
      await latest.locate();
    });
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(latest.status).toBe('denied');
    expect(latest.message).toBe('Location permission was denied.');
    expect(latest.permissionGranted).toBe(false);
  });

  it('reports location services being off', async () => {
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(false);
    renderHook();
    await TestRenderer.act(async () => {
      await latest.locate();
    });
    expect(latest.status).toBe('unavailable');
    expect(latest.message).toBe('Location services are turned off.');
  });

  it('reports a failed fix (timeout or error) without throwing', async () => {
    mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('getCurrentPositionAsync timed out after 15000ms'));
    renderHook();
    let result: Awaited<ReturnType<Hook['locate']>> = { lat: 0, lng: 0 };
    await TestRenderer.act(async () => {
      result = await latest.locate();
    });
    expect(result).toBeNull();
    expect(latest.status).toBe('failed');
    expect(latest.message).toBe("Couldn't get a GPS fix. Try again outdoors.");
  });

  it('getLastKnownFix() returns the cached position only when permission is already granted', async () => {
    mockLocation.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 12.5, longitude: 121.1 } });
    renderHook();
    let fix: Awaited<ReturnType<Hook['getLastKnownFix']>> = null;
    await TestRenderer.act(async () => {
      fix = await latest.getLastKnownFix();
    });
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(fix).toEqual({ lat: 12.5, lng: 121.1 });

    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await TestRenderer.act(async () => {
      fix = await latest.getLastKnownFix();
    });
    expect(fix).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/location/hooks/useDeviceLocation.test.tsx`
Expected: FAIL — `Cannot find module './useDeviceLocation'`.

- [ ] **Step 3: Create `useDeviceLocation.ts`**

```ts
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { withTimeout } from '../../../utils/withTimeout';

export type DeviceLocationStatus = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'failed';

export interface DeviceFix {
  lat: number;
  lng: number;
}

// Same reasoning as useAttachments' geotag: High forces a real satellite
// fix, which works with no network at all.
const FIX_ACCURACY = Location.Accuracy.High;
const FIX_TIMEOUT_MS = 15000;

const MESSAGES: Record<Exclude<DeviceLocationStatus, 'idle' | 'locating' | 'located'>, string> = {
  denied: 'Location permission was denied.',
  unavailable: 'Location services are turned off.',
  failed: "Couldn't get a GPS fix. Try again outdoors.",
};

// Permission + fix state for the map picker's GPS button. `locate()` is the
// only thing that prompts for permission; `getLastKnownFix()` is a silent
// read used for the picker's opening camera and never asks.
export function useDeviceLocation() {
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const locate = useCallback(async (): Promise<DeviceFix | null> => {
    setStatus('locating');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setPermissionGranted(false);
        setStatus('denied');
        return null;
      }
      setPermissionGranted(true);

      if (!(await Location.hasServicesEnabledAsync())) {
        setStatus('unavailable');
        return null;
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: FIX_ACCURACY }),
        FIX_TIMEOUT_MS,
        'getCurrentPositionAsync',
      );
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setFix(next);
      setStatus('located');
      return next;
    } catch (err) {
      console.warn('[useDeviceLocation] fix failed', err);
      setStatus('failed');
      return null;
    }
  }, []);

  const getLastKnownFix = useCallback(async (): Promise<DeviceFix | null> => {
    try {
      const { status: permission } = await Location.getForegroundPermissionsAsync();
      if (permission !== 'granted') return null;
      setPermissionGranted(true);
      const position = await Location.getLastKnownPositionAsync();
      if (!position) return null;
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  const message = status === 'denied' || status === 'unavailable' || status === 'failed' ? MESSAGES[status] : null;

  return { status, fix, message, permissionGranted, locate, getLastKnownFix };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/location/hooks/useDeviceLocation.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/location/hooks/useDeviceLocation.ts src/features/location/hooks/useDeviceLocation.test.tsx
git commit -m "feat(establishments): add a device-location hook for the map picker's GPS button

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `OfflineTilesBanner` and `LocationPickerModal`

**Files:**
- Create: `src/features/location/components/OfflineTilesBanner.tsx`
- Create: `src/features/location/components/LocationPickerModal.tsx`
- Test: `src/features/location/components/LocationPickerModal.test.tsx`

**Interfaces:**
- Consumes: `resolveInitialCamera`, `roundCoordinate`, `formatCoordinate` (Task 2); `cacheAreaAroundPin` (Task 3); `useDeviceLocation` (Task 4); `MAP_STYLE_URL`, `PIN_ZOOM` (Task 1); `Map`, `Camera`, `UserLocation`, `CameraRef`, `ViewStateChangeEvent` from MapLibre; `NetInfo`; `Button` from `src/components/Button`.
- Produces:
  ```ts
  export interface PickedLocation { lat: number; lng: number }
  export interface LocationPickerModalProps {
    visible: boolean;
    title?: string;            // default 'Pin Location'
    initialLat: string;
    initialLng: string;
    packName: string;          // 'estab:<id>' | 'estab:pending'
    onCancel: () => void;
    onConfirm: (picked: PickedLocation) => void;
  }
  export const LocationPickerModal: React.FC<LocationPickerModalProps>;
  ```
  Test hooks (accessibilityLabels): GPS button `Use my GPS position`, confirm `Use this location`, cancel `Cancel`, close `Close`; readout `testID="coordinate-readout"`; banner `testID="offline-tiles-banner"`; GPS note `testID="gps-note"`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/location/components/LocationPickerModal.test.tsx`:

```tsx
import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { Camera, Map as MapLibreMap, UserLocation } from '@maplibre/maplibre-react-native';
import { LocationPickerModal } from './LocationPickerModal';
import { cacheAreaAroundPin } from '../offlinePacks';
import { MIMAROPA_OVERVIEW, PIN_ZOOM } from '../mapConfig';

jest.mock('../offlinePacks', () => ({ cacheAreaAroundPin: jest.fn().mockResolvedValue(undefined) }));

const { __cameraFlyTo: cameraFlyTo, __cameraJumpTo: cameraJumpTo } = jest.requireMock('@maplibre/maplibre-react-native');
const mockNetInfo = NetInfo as unknown as { addEventListener: jest.Mock; fetch: jest.Mock };
const mockLocation = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
};

type Renderer = TestRenderer.ReactTestRenderer;

const render = async (element: React.ReactElement) => {
  let r!: Renderer;
  await TestRenderer.act(async () => {
    r = TestRenderer.create(element);
  });
  return r;
};

const findButton = (r: Renderer, label: string) => {
  const matches = r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === label);
  if (matches.length !== 1) throw new Error(`Expected 1 "${label}" button, found ${matches.length}`);
  return matches[0];
};

const readout = (r: Renderer) =>
  r.root.findAll(n => n.type === Text && n.props.testID === 'coordinate-readout')[0].props.children;

const moveMap = async (r: Renderer, lng: number, lat: number) => {
  await TestRenderer.act(async () => {
    r.root.findByType(MapLibreMap).props.onRegionDidChange({ nativeEvent: { center: [lng, lat] } });
  });
};

let netListener: ((state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void) | null = null;

const baseProps = {
  visible: true,
  initialLat: '',
  initialLng: '',
  packName: 'estab:pending',
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  netListener = null;
  mockNetInfo.addEventListener.mockImplementation(listener => {
    netListener = listener;
    listener({ isConnected: true, isInternetReachable: true });
    return () => {};
  });
  mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 11.144, longitude: 119.395 } });
});

describe('LocationPickerModal — initial camera', () => {
  it('opens on the field values at pin zoom when they are valid', async () => {
    const r = await render(<LocationPickerModal {...baseProps} initialLat="11.144" initialLng="119.395" />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual({ center: [119.395, 11.144], zoom: PIN_ZOOM });
    expect(readout(r)).toBe('11.144000, 119.395000');
    expect(cameraJumpTo).not.toHaveBeenCalled();
  });

  it('opens on the overview, then jumps to the last known GPS fix when the fields are empty', async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLocation.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 12.5, longitude: 121.1 } });
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual(MIMAROPA_OVERVIEW);
    expect(cameraJumpTo).toHaveBeenCalledWith({ center: [121.1, 12.5], zoom: PIN_ZOOM });
  });

  it('stays on the overview when there is no last known fix', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual(MIMAROPA_OVERVIEW);
    expect(cameraJumpTo).not.toHaveBeenCalled();
  });

  it('never requests permission or a fresh fix just by opening', async () => {
    await render(<LocationPickerModal {...baseProps} />);
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});

describe('LocationPickerModal — GPS button', () => {
  it('flies the camera to the fix and shows the user-location dot once granted', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(r.root.findAllByType(UserLocation)).toHaveLength(0);
    await TestRenderer.act(async () => {
      findButton(r, 'Use my GPS position').props.onPress();
    });
    expect(cameraFlyTo).toHaveBeenCalledWith({ center: [119.395, 11.144], zoom: PIN_ZOOM, duration: 800 });
    expect(r.root.findAllByType(UserLocation)).toHaveLength(1);
    expect(r.root.findAll(n => n.type === Text && n.props.testID === 'gps-note')).toHaveLength(0);
  });

  it('shows the denial note and keeps the button enabled when permission is denied', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const r = await render(<LocationPickerModal {...baseProps} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Use my GPS position').props.onPress();
    });
    expect(cameraFlyTo).not.toHaveBeenCalled();
    const note = r.root.findAll(n => n.type === Text && n.props.testID === 'gps-note')[0];
    expect(note.props.children).toBe('Location permission was denied.');
    expect(findButton(r, 'Use my GPS position').props.disabled).toBeFalsy();
  });
});

describe('LocationPickerModal — confirm / cancel', () => {
  it('confirms the map centre rounded to 6 dp and caches the area while online', async () => {
    const onConfirm = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} packName="estab:abc" onConfirm={onConfirm} />);
    await moveMap(r, 119.39512345678, 11.14498765432);
    expect(readout(r)).toBe('11.144988, 119.395123');
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ lat: 11.144988, lng: 119.395123 });
    expect(cacheAreaAroundPin).toHaveBeenCalledWith('estab:abc', 11.144988, 119.395123);
  });

  it('does not try to cache tiles while offline', async () => {
    const r = await render(<LocationPickerModal {...baseProps} initialLat="11.144" initialLng="119.395" />);
    await TestRenderer.act(async () => {
      netListener?.({ isConnected: false, isInternetReachable: false });
    });
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(baseProps.onConfirm).toHaveBeenCalledWith({ lat: 11.144, lng: 119.395 });
    expect(cacheAreaAroundPin).not.toHaveBeenCalled();
  });

  it('cancel and the header close both call onCancel without confirming', async () => {
    const onCancel = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} onCancel={onCancel} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Cancel').props.onPress();
    });
    await TestRenderer.act(async () => {
      findButton(r, 'Close').props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
    // Android hardware back routes through Modal.onRequestClose.
    await TestRenderer.act(async () => {
      r.root.findByType(Modal).props.onRequestClose();
    });
    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});

describe('LocationPickerModal — offline banner', () => {
  const banner = (r: Renderer) => r.root.findAll(n => n.props?.testID === 'offline-tiles-banner');

  it('is hidden while online and shown when the connection drops', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(banner(r)).toHaveLength(0);
    await TestRenderer.act(async () => {
      netListener?.({ isConnected: false, isInternetReachable: false });
    });
    expect(banner(r).length).toBeGreaterThan(0);
  });

  it('is shown when the style fails to load even while online', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    await TestRenderer.act(async () => {
      r.root.findByType(MapLibreMap).props.onDidFailLoadingMap({ nativeEvent: null });
    });
    expect(banner(r).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/location/components/LocationPickerModal.test.tsx`
Expected: FAIL — `Cannot find module './LocationPickerModal'`.

- [ ] **Step 3: Create `OfflineTilesBanner.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';

// Informational only: it sits over the map and explains why the map may be
// blank. It never gates the pin, the readout, GPS or Confirm.
export const OfflineTilesBanner: React.FC = () => (
  <View style={styles.banner} testID="offline-tiles-banner" accessibilityRole="alert">
    <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning.text} />
    <Text style={styles.text}>No map tiles available offline — your pin and GPS position still work.</Text>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning.border,
    backgroundColor: Colors.warning.bg,
  },
  text: {
    flex: 1,
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    color: Colors.warning.text,
  },
});
```

- [ ] **Step 4: Create `LocationPickerModal.tsx`**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  Map as MapLibreMap,
  UserLocation,
  type CameraRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { Button } from '../../../components/Button';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { MAP_STYLE_URL, PIN_ZOOM } from '../mapConfig';
import { formatCoordinate, parseLatLng, resolveInitialCamera, roundCoordinate } from '../coordinates';
import { cacheAreaAroundPin } from '../offlinePacks';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { OfflineTilesBanner } from './OfflineTilesBanner';

export interface PickedLocation {
  lat: number;
  lng: number;
}

export interface LocationPickerModalProps {
  visible: boolean;
  title?: string;
  // The caller's current field values — strings, exactly as typed.
  initialLat: string;
  initialLng: string;
  // Names the offline pack cached around the confirmed pin — see
  // offlinePacks.ts. 'estab:<id>' for a known establishment, otherwise
  // 'estab:pending'.
  packName: string;
  onCancel: () => void;
  onConfirm: (picked: PickedLocation) => void;
}

const FLY_DURATION_MS = 800;

// A fixed crosshair over a map that moves under it. The pin's coordinates
// are simply the camera centre, read on every settled region change — no
// draggable marker, nothing to miss with a finger.
export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  title = 'Pin Location',
  initialLat,
  initialLng,
  packName,
  onCancel,
  onConfirm,
}) => {
  const cameraRef = useRef<CameraRef>(null);
  const gps = useDeviceLocation();

  // Resolved once per open from the caller's values; the last-known-fix
  // fallback is applied asynchronously below because reading it is async.
  const initialCamera = useMemo(
    () => resolveInitialCamera({ lat: initialLat, lng: initialLng, lastFix: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  );
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: initialCamera.center[1],
    lng: initialCamera.center[0],
  });
  const [online, setOnline] = useState(true);
  const [styleFailed, setStyleFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCenter({ lat: initialCamera.center[1], lng: initialCamera.center[0] });
    setStyleFailed(false);
  }, [visible, initialCamera]);

  // Only when the caller gave us nothing: a silent read of the phone's
  // last position (no prompt) to open somewhere near the inspector.
  useEffect(() => {
    if (!visible) return;
    if (parseLatLng(initialLat, initialLng)) return;
    let cancelled = false;
    void gps.getLastKnownFix().then(fix => {
      if (cancelled || !fix) return;
      const next = resolveInitialCamera({ lat: '', lng: '', lastFix: fix });
      setCenter({ lat: next.center[1], lng: next.center[0] });
      cameraRef.current?.jumpTo({ center: next.center, zoom: next.zoom });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    return NetInfo.addEventListener(state => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, [visible]);

  const handleRegionDidChange = useCallback((event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const [lng, lat] = event.nativeEvent.center;
    setCenter({ lat, lng });
  }, []);

  const handleLocate = useCallback(async () => {
    const fix = await gps.locate();
    if (!fix) return;
    setCenter(fix);
    cameraRef.current?.flyTo({ center: [fix.lng, fix.lat], zoom: PIN_ZOOM, duration: FLY_DURATION_MS });
  }, [gps]);

  const handleConfirm = useCallback(() => {
    const picked = { lat: roundCoordinate(center.lat), lng: roundCoordinate(center.lng) };
    if (online) void cacheAreaAroundPin(packName, picked.lat, picked.lng);
    onConfirm(picked);
  }, [center, online, packName, onConfirm]);

  const showBanner = !online || styleFailed;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="map-outline" size={16} color={Colors.textWhite} />
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Ionicons name="close" size={16} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          <MapLibreMap
            style={styles.map}
            mapStyle={MAP_STYLE_URL}
            touchRotate={false}
            touchPitch={false}
            compass={false}
            onRegionDidChange={handleRegionDidChange}
            onDidFailLoadingMap={() => setStyleFailed(true)}
            onDidFinishLoadingStyle={() => setStyleFailed(false)}>
            <Camera ref={cameraRef} initialViewState={initialCamera} />
            {gps.permissionGranted && <UserLocation />}
          </MapLibreMap>

          {/* The crosshair: centred, non-interactive, so touches fall
              through to the map. The pin tip is the map centre. */}
          <View pointerEvents="none" style={styles.crosshair}>
            <Ionicons name="location" size={36} color={Colors.conflict} style={styles.pin} />
          </View>

          {showBanner && <OfflineTilesBanner />}

          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={handleLocate}
            disabled={gps.status === 'locating'}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Use my GPS position">
            <Ionicons
              name={gps.status === 'locating' ? 'navigate-circle-outline' : 'locate'}
              size={22}
              color={Colors.navy}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.readoutWrap}>
          <Text style={styles.readoutLabel}>Pin coordinates</Text>
          <Text style={styles.readout} testID="coordinate-readout">
            {`${formatCoordinate(center.lat)}, ${formatCoordinate(center.lng)}`}
          </Text>
          {gps.message && (
            <Text style={styles.gpsNote} testID="gps-note">
              {gps.message}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Button label="Cancel" variant="subtle" onPress={onCancel} />
          <Button label="Use this location" variant="success" icon="checkmark" onPress={handleConfirm} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  // Same header treatment as SyncOptionsModal / NewEstablishmentModal.
  header: {
    backgroundColor: Colors.navy,
    borderBottomWidth: 3,
    borderBottomColor: Colors.green,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Type.subheading.fontSize,
    lineHeight: Type.subheading.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The glyph's tip sits at its bottom edge, so it's lifted by half its
  // height to put the tip — not the glyph's centre — on the map centre.
  pin: {
    marginBottom: 36,
  },
  gpsBtn: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readoutWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  readoutLabel: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.textLight,
  },
  readout: {
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xxs,
  },
  gpsNote: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.conflict,
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/features/location/components/LocationPickerModal.test.tsx`
Expected: PASS (11 tests). If the `Button` component's `TouchableOpacity` does not carry `accessibilityLabel` equal to its label, open `src/components/Button.tsx` and confirm — it sets `accessibilityLabel={label}`; if it doesn't, pass the labels through `findButton` by matching `n.props.accessibilityLabel ?? n.props.children` instead of changing `Button`.

- [ ] **Step 6: Run the design guard and lint**

Run: `npx jest src/design && npm run lint`
Expected: PASS — no hex literals, no numeric `fontSize`/`borderRadius` in the two new files; the two `eslint-disable-next-line react-hooks/exhaustive-deps` comments are the only suppressions.

- [ ] **Step 7: Commit**

```bash
git add src/features/location/components/OfflineTilesBanner.tsx src/features/location/components/LocationPickerModal.tsx src/features/location/components/LocationPickerModal.test.tsx
git commit -m "feat(establishments): add the map location picker modal with crosshair, GPS and offline banner

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `CoordinateFields`

**Files:**
- Create: `src/features/location/components/CoordinateFields.tsx`
- Test: `src/features/location/components/CoordinateFields.test.tsx`

**Interfaces:**
- Consumes: `LocationPickerModal`, `PickedLocation` (Task 5); `TextField`, `focusInput` from `src/components/form`.
- Produces:
  ```ts
  export interface CoordinateFieldsProps {
    lat: string;
    lng: string;
    onChange: (next: { lat: string; lng: string }) => void;
    readOnly?: boolean;
    packName: string;
    // Focus chain — the same refs/handlers callers already pass to TextField.
    latRef?: React.RefObject<TextInput | null>;
    lngRef?: React.RefObject<TextInput | null>;
    onLngSubmitEditing?: () => void;   // Latitude's "next" always focuses Longitude
    lngReturnKeyType?: 'next' | 'done';
    onLatFocus?: () => void;
    onLngFocus?: () => void;
    latChangeNote?: string;
    lngChangeNote?: string;
  }
  export const CoordinateFields: React.FC<CoordinateFieldsProps>;
  ```
  "Pin on map" button: `accessibilityLabel="Pin on map"`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/location/components/CoordinateFields.test.tsx`:

```tsx
import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { CoordinateFields } from './CoordinateFields';
import { LocationPickerModal } from './LocationPickerModal';

jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => {
    r = TestRenderer.create(element);
  });
  return r;
};

const pinButtons = (r: Renderer) =>
  r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map');

describe('CoordinateFields', () => {
  it('renders both values as numeric inputs and a Pin on map button', () => {
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={jest.fn()} packName="estab:pending" />);
    const inputs = r.root.findAllByType(TextInput);
    expect(inputs.map(i => i.props.value)).toEqual(['11.144', '119.395']);
    expect(inputs.every(i => i.props.keyboardType === 'numeric')).toBe(true);
    expect(pinButtons(r)).toHaveLength(1);
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('forwards typed edits one field at a time', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={onChange} packName="estab:pending" />);
    const [latInput, lngInput] = r.root.findAllByType(TextInput);
    TestRenderer.act(() => latInput.props.onChangeText('12'));
    expect(onChange).toHaveBeenLastCalledWith({ lat: '12', lng: '119.395' });
    TestRenderer.act(() => lngInput.props.onChangeText('121'));
    expect(onChange).toHaveBeenLastCalledWith({ lat: '11.144', lng: '121' });
  });

  it('opens the picker with the current values and writes the confirmed pin back as strings', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={onChange} packName="estab:abc" />);
    TestRenderer.act(() => pinButtons(r)[0].props.onPress());
    const picker = r.root.findByType(LocationPickerModal);
    expect(picker.props.visible).toBe(true);
    expect(picker.props.initialLat).toBe('11.144');
    expect(picker.props.initialLng).toBe('119.395');
    expect(picker.props.packName).toBe('estab:abc');
    TestRenderer.act(() => picker.props.onConfirm({ lat: 11.144988, lng: 119.395123 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: '11.144988', lng: '119.395123' });
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('closes the picker on cancel without changing anything', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="" lng="" onChange={onChange} packName="estab:pending" />);
    TestRenderer.act(() => pinButtons(r)[0].props.onPress());
    TestRenderer.act(() => r.root.findByType(LocationPickerModal).props.onCancel());
    expect(onChange).not.toHaveBeenCalled();
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('hides the button and renders display fields when read-only', () => {
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={jest.fn()} packName="estab:abc" readOnly />);
    expect(pinButtons(r)).toHaveLength(0);
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
    expect(r.root.findAllByType(LocationPickerModal)).toHaveLength(0);
  });

  it('shows an em dash for an empty read-only value', () => {
    const r = render(<CoordinateFields lat="" lng="" onChange={jest.fn()} packName="estab:abc" readOnly />);
    const dashes = r.root.findAll(n => typeof n.props.children === 'string' && n.props.children === '—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/location/components/CoordinateFields.test.tsx`
Expected: FAIL — `Cannot find module './CoordinateFields'`.

- [ ] **Step 3: Create `CoordinateFields.tsx`**

```tsx
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField, focusInput } from '../../../components/form';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal';

export interface CoordinateFieldsProps {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
  readOnly?: boolean;
  // See LocationPickerModal.packName.
  packName: string;
  // Focus chain — the same refs and handlers the surrounding forms already
  // pass to their TextFields. Latitude's "next" always goes to Longitude.
  latRef?: React.RefObject<TextInput | null>;
  lngRef?: React.RefObject<TextInput | null>;
  onLngSubmitEditing?: () => void;
  lngReturnKeyType?: 'next' | 'done';
  onLatFocus?: () => void;
  onLngFocus?: () => void;
  latChangeNote?: string;
  lngChangeNote?: string;
}

// The one Latitude/Longitude row every form uses, plus the button that
// opens the map picker. Values stay strings in the caller's state; the
// picker's numbers are stringified here so callers never see a number.
export const CoordinateFields: React.FC<CoordinateFieldsProps> = ({
  lat,
  lng,
  onChange,
  readOnly = false,
  packName,
  latRef,
  lngRef,
  onLngSubmitEditing,
  lngReturnKeyType = 'next',
  onLatFocus,
  onLngFocus,
  latChangeNote,
  lngChangeNote,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const localLngRef = React.useRef<TextInput>(null);
  const resolvedLngRef = lngRef ?? localLngRef;

  const handleConfirm = (picked: PickedLocation) => {
    setPickerOpen(false);
    onChange({ lat: String(picked.lat), lng: String(picked.lng) });
  };

  if (readOnly) {
    return (
      <View style={styles.row}>
        <TextField label="Latitude" value={lat || '—'} readOnly changeNote={latChangeNote} />
        <TextField label="Longitude" value={lng || '—'} readOnly changeNote={lngChangeNote} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TextField
        ref={latRef}
        label="Latitude"
        value={lat}
        onChangeText={next => onChange({ lat: next, lng })}
        keyboardType="numeric"
        placeholder="e.g. 11.144"
        textCase="none"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => focusInput(resolvedLngRef.current)}
        onFocus={onLatFocus}
        changeNote={latChangeNote}
      />
      <TextField
        ref={resolvedLngRef}
        label="Longitude"
        value={lng}
        onChangeText={next => onChange({ lat, lng: next })}
        keyboardType="numeric"
        placeholder="e.g. 119.395"
        textCase="none"
        returnKeyType={lngReturnKeyType}
        blurOnSubmit={lngReturnKeyType === 'done'}
        onSubmitEditing={onLngSubmitEditing}
        onFocus={onLngFocus}
        changeNote={lngChangeNote}
      />
      {/* Bottom-aligned with the inputs (not the labels), and carrying the
          same bottom margin TextField's wrapper does so the row's height
          doesn't change. */}
      <TouchableOpacity
        style={styles.pinBtn}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Pin on map">
        <Ionicons name="map-outline" size={18} color={Colors.navy} />
      </TouchableOpacity>

      <LocationPickerModal
        visible={pickerOpen}
        initialLat={lat}
        initialLng={lng}
        packName={packName}
        onCancel={() => setPickerOpen(false)}
        onConfirm={handleConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pinBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    width: 40,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/location/components/CoordinateFields.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the design guard and lint**

Run: `npx jest src/design && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/location/components/CoordinateFields.tsx src/features/location/components/CoordinateFields.test.tsx
git commit -m "feat(establishments): add the CoordinateFields row with a Pin on map button

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire `NewEstablishmentModal` (and move the row below Nature/PSIC)

**Files:**
- Modify: `src/features/inspections/components/NewEstablishmentModal.tsx`

**Interfaces:**
- Consumes: `CoordinateFields` (Task 6).

- [ ] **Step 1: Import `CoordinateFields`**

Add after the `TextField, SelectField, …` import line:

```ts
import { CoordinateFields } from '../../location/components/CoordinateFields';
```

- [ ] **Step 2: Re-point the Address field's "next"**

The Address Line field currently advances to `latRef`. Change its `onSubmitEditing`:

```tsx
                onSubmitEditing={() => focusInput(natureRef.current)}
```

- [ ] **Step 3: Replace the lat/lng row and reorder**

Delete the whole `<View style={styles.row}>` block containing the two `TextField`s labelled `Latitude` and `Longitude` (it sits right after the Barangay row). Then change the PSIC Code field's `onSubmitEditing` to advance to latitude:

```tsx
              onSubmitEditing={() => focusInput(latRef.current)}
```

and insert, immediately after the PSIC Code `TextField` and before the Inspection Date `DateField`:

```tsx
            <CoordinateFields
              lat={form.geoLat}
              lng={form.geoLng}
              onChange={({ lat, lng }) => setForm({ ...form, geoLat: lat, geoLng: lng })}
              packName="estab:pending"
              latRef={latRef}
              lngRef={lngRef}
              onLngSubmitEditing={() => focusInput(inspectionDateRef.current)}
              onLatFocus={() => scrollToInput(latRef)}
              onLngFocus={() => scrollToInput(lngRef)}
            />
```

The resulting order in the scroll body is: Name → Address → Province/City → Barangay → Nature of Business → PSIC Code → Latitude/Longitude → Inspection Date → Status of Operation → …

- [ ] **Step 4: Typecheck, lint, run the suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. (`latRef`/`lngRef` are `useRef<TextInput>(null)` — `RefObject<TextInput | null>` — which matches `CoordinateFieldsProps`.)

- [ ] **Step 5: Commit**

```bash
git add src/features/inspections/components/NewEstablishmentModal.tsx
git commit -m "feat(establishments): pin coordinates on a map from the new-establishment modal

Also moves Latitude/Longitude below Nature of Business / PSIC Code to
match the report-side General Information order.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the establishment Details section (lat/lng become editable)

**Files:**
- Modify: `src/features/establishments/components/EstablishmentInfoSections.tsx`
- Test: `src/features/establishments/components/EstablishmentInfoSections.test.tsx`

**Interfaces:**
- Consumes: `CoordinateFields` (Task 6); `patchEstablishmentRecord` (already mocked in the test file).
- Produces: `DetailsFields` gains `geoLat: string; geoLng: string`; `fromDetailsFields` emits `geoLat: number | null`, `geoLng: number | null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/establishments/components/EstablishmentInfoSections.test.tsx`, inside the existing `describe('EstablishmentInfoSections Establishment Details validation', …)` block (it already has `startEditingDetails`, `findSection`, `findButtonByLabelWithin`, `baseEstablishment` in scope — `baseEstablishment.geoLat` is `null`):

```tsx
  it('shows the coordinates read-only with no Pin on map button until editing starts', () => {
    const r = render(
      <EstablishmentInfoSections establishment={{ ...baseEstablishment, geoLat: 11.144, geoLng: 119.395 }} canEdit onSaved={jest.fn()} />,
    );
    const section = findSection(r, DETAILS_TITLE);
    const values = section.findAll((n) => n.type === Text).map((n) => n.props.children);
    expect(values).toEqual(expect.arrayContaining(['11.144', '119.395']));
    expect(section.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map')).toHaveLength(0);
  });

  it('patches edited coordinates as numbers, and empty ones as null', async () => {
    const onSaved = jest.fn();
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit onSaved={onSaved} />);
    let section = startEditingDetails(r);
    expect(section.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map')).toHaveLength(1);

    const latInput = section.findAll((n) => n.type === TextInput && n.props.placeholder === 'e.g. 11.144')[0];
    TestRenderer.act(() => {
      latInput.props.onChangeText('11.144988');
    });
    section = findSection(r, DETAILS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });

    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: expect.objectContaining({ geoLat: 11.144988, geoLng: null }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/establishments/components/EstablishmentInfoSections.test.tsx`
Expected: the two new tests FAIL (no `Pin on map` button; `geoLat` absent from the patch). Existing tests still pass.

- [ ] **Step 3: Add `geoLat`/`geoLng` to `DetailsFields` and its converters**

In `EstablishmentInfoSections.tsx`:

Add to `interface DetailsFields` after `province: string;`:

```ts
  geoLat: string;
  geoLng: string;
```

In `toDetailsFields`, after `province: e.province,`:

```ts
    geoLat: e.geoLat != null ? String(e.geoLat) : '',
    geoLng: e.geoLng != null ? String(e.geoLng) : '',
```

In `fromDetailsFields`, after `province: f.province,`:

```ts
    geoLat: f.geoLat.trim() ? Number(f.geoLat) : null,
    geoLng: f.geoLng.trim() ? Number(f.geoLng) : null,
```

- [ ] **Step 4: Replace the read-only lat/lng row with `CoordinateFields`, below Nature/PSIC**

Add the import after the `useEditableSection` import:

```ts
import { CoordinateFields } from '../../location/components/CoordinateFields';
```

Inside `DetailsSection`, add two refs after `psicRef`:

```ts
  const latRef = useRef<TextInput>(null);
  const lngRef = useRef<TextInput>(null);
```

Delete the `<View style={styles.row}>` block that holds the two read-only `Latitude`/`Longitude` `TextField`s **and its three-line comment** ("Latitude/Longitude are never part of this draft …"). Then change the PSIC Code field's `onSubmitEditing` from `productRef` to:

```tsx
onSubmitEditing={() => focusInput(latRef.current)}
```

and insert directly after the row containing Nature of Business / PSIC Code (before the Product / Year Established row):

```tsx
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng }))}
        readOnly={!details.editing}
        packName={`estab:${establishment.estabId}`}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(productRef.current)}
      />
```

- [ ] **Step 5: Update the stale comment in `establishmentPersistence.ts`**

In `src/features/inspections/establishmentPersistence.ts`, the comment above `patchEstablishmentRecord` says `geoLat/geoLng/denrPermits/isArchived/… are never among fields; no section currently edits them.` Change that sentence to:

```ts
// on another. denrPermits/isArchived/deviceId/inspectorUid/createdAt are
// never among `fields`; no section currently edits them. geoLat/geoLng
// arrive from the Details section as numbers (or null) — see
// EstablishmentInfoSections' fromDetailsFields.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/features/establishments/components/EstablishmentInfoSections.test.tsx`
Expected: PASS, including the two new tests.

- [ ] **Step 7: Typecheck, lint, run the suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/features/establishments/components/EstablishmentInfoSections.tsx src/features/establishments/components/EstablishmentInfoSections.test.tsx src/features/inspections/establishmentPersistence.ts
git commit -m "feat(establishments): edit and pin coordinates from the establishment Details section

geoLat/geoLng join the Details draft (they were read-only before) and the
row moves below Nature of Business / PSIC Code.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Wire the report-side General Information tab and view

**Files:**
- Modify: `src/features/inspections/components/GeneralInformationTab.tsx`
- Modify: `src/features/inspections/components/GeneralInformationView.tsx`

**Interfaces:**
- Consumes: `CoordinateFields` (Task 6).

- [ ] **Step 1: `GeneralInformationTab.tsx` — import**

Add after the form-components import:

```ts
import { CoordinateFields } from '../../location/components/CoordinateFields';
```

- [ ] **Step 2: `GeneralInformationTab.tsx` — replace the row**

Find the `<View style={styles.row}>` that contains the two `TextField`s with `label="Latitude"` and `label="Longitude"` (right after the Nature of Business / PSIC Code row) and replace the whole block with:

```tsx
        <CoordinateFields
          lat={value.geoLat}
          lng={value.geoLng}
          onChange={({ lat, lng }) => onChange({ ...value, geoLat: lat, geoLng: lng })}
          packName={estabId ? `estab:${estabId}` : 'estab:pending'}
          latRef={latRef}
          lngRef={lngRef}
          onLngSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)}
        />
```

`GeneralInformationTabProps` is currently `{ value; onChange }` and has no establishment id. Add a prop to the interface:

```ts
interface GeneralInformationTabProps {
  value: GeneralInfoFormState;
  onChange: (value: GeneralInfoFormState) => void;
  // Names the offline tile pack the map picker caches — the establishment
  // this report is for, or null while it's still being created.
  estabId: string | null;
}
```

destructure `estabId` alongside `value, onChange`, and in `src/features/inspections/water/WaterInspectionFormScreen.tsx` line ~215 change the one call site to:

```tsx
            <GeneralInformationTab value={generalInfo} onChange={setGeneralInfo} estabId={start.estabId} />
```

(`start.estabId` is already `string | null` on `ShellStart`.)

- [ ] **Step 3: `GeneralInformationView.tsx` — import and replace the row**

Add the same import:

```ts
import { CoordinateFields } from '../../location/components/CoordinateFields';
```

Replace the `<View style={styles.row}>` containing the `Latitude`/`Longitude` `TextField`s (the ones with `changeNote={liveDetails ? liveRecordNote(details.draft.geoLat, …)}`) with:

```tsx
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng }))}
        readOnly={!details.editing}
        packName={estabId ? `estab:${estabId}` : 'estab:pending'}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)}
        latChangeNote={liveDetails ? liveRecordNote(details.draft.geoLat, liveDetails.geoLat) : undefined}
        lngChangeNote={liveDetails ? liveRecordNote(details.draft.geoLng, liveDetails.geoLng) : undefined}
      />
```

`DetailsSection` (the `React.memo` sub-component at ~line 259) only receives `liveDetails`, not the establishment. Add a prop to `DetailsSectionProps`:

```ts
interface DetailsSectionProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  liveDetails: DetailsFields | null;
  // The live establishment's id, for naming the map picker's offline pack.
  // A primitive, so it doesn't disturb the memo.
  estabId: string | null;
  canEdit: boolean;
  onSaved: () => void;
}
```

destructure `estabId` in `DetailsSection`'s parameter list, and change the parent's render (~line 616) to:

```tsx
      <DetailsSection reportId={reportId} snapshot={snapshot} liveDetails={liveDetails} estabId={liveEstablishment?.estabId ?? null} canEdit={canEdit} onSaved={onSaved} />
```

(`liveEstablishment: EstablishmentDTO | null` is already a prop of `GeneralInformationView`.) Also change the PSIC Code field's `onSubmitEditing` in this section from `latRef` — it already targets `latRef`, so it stays as is.

- [ ] **Step 4: Remove now-unused pieces**

If `TextField` is no longer referenced in `GeneralInformationTab.tsx` after the edit, drop it from the import (lint fails on unused imports). Same check for `GeneralInformationView.tsx` — `TextField` is still used there for other fields, so it stays.

- [ ] **Step 5: Typecheck, lint, run the suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Water form tests under `src/features/inspections/water/*.test.tsx` render `GeneralInformationTab`; they pass because MapLibre, NetInfo and expo-location are globally mocked (Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/features/inspections/components/GeneralInformationTab.tsx src/features/inspections/components/GeneralInformationView.tsx src/features/inspections/water/WaterInspectionFormScreen.tsx
git commit -m "feat(reports): pin coordinates on a map from a report's General Information

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Spec status, docs, and the APK build note

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-map-location-picker-design.md` (status line)
- Modify: `docs/ci-cd.md` (one paragraph)

- [ ] **Step 1: Mark the spec implemented**

Change the spec's `**Status:**` line to:

```markdown
**Status:** Implemented — see docs/superpowers/plans/2026-09-17-map-location-picker.md
```

- [ ] **Step 2: Note the native dependency in `docs/ci-cd.md`**

Under `## EAS project`, add:

```markdown
- **Native dependencies.** `@maplibre/maplibre-react-native` (map picker,
  since 2026-09-17) is autolinked at build time — nothing under `android/`
  is hand-edited for it. Any branch that adds it needs a fresh APK before
  Metro can load the app: an older APK fails at import with a
  missing-native-module error.
```

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-17-map-location-picker-design.md docs/ci-cd.md
git commit -m "docs(repo): mark the map picker spec implemented and note the native dependency

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand-off**

Push the branch and open a PR to `develop`. The PR description must state: the map cannot be verified in Jest or the in-app browser; merging to `develop` triggers the EAS `preview` APK, and the on-device checklist is — (1) Pin on map opens on the current coordinates; (2) GPS button recentres and shows the blue dot; (3) confirm writes both fields; (4) turn on airplane mode, reopen the same establishment's picker: tiles around the pin still render, the offline banner shows; (5) a never-visited area shows the banner over a blank map and the pin still confirms.
