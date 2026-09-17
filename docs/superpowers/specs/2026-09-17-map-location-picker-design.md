# Map Location Picker — Design

**Date:** 2026-09-17
**Status:** Approved, awaiting implementation plan

## Goal

Let an inspector pin an establishment's coordinates on a map instead of
typing them: a "Pin on map" control beside every Latitude/Longitude pair
opens a full-screen map with a centre crosshair and a GPS button, and
confirming writes the pin's coordinates back into the two fields. The map
must remain useful in the field with no internet and with nothing for the
inspector to set up beforehand.

## Decisions taken during brainstorming

| Question | Decision |
|---|---|
| Source of coordinates | Device GPS plus manual pinning on a map. Address-based lookup (barangay centroids, online geocoding) was rejected — the bundled PSGC dataset carries no coordinates, and a centroid is not the site |
| Map library | `@maplibre/maplibre-react-native` (open source, no API key, Expo config plugin, ambient tile cache + explicit offline packs). `react-native-maps` needs a Google key and has no controllable offline story; `expo-maps` has none at all |
| Basemap | OpenFreeMap **Liberty** style — free, keyless, vector tiles. One constant holds the style URL so it can be swapped |
| Where it appears | Every place lat/lng is entered: `NewEstablishmentModal`, the establishment detail Details section (edit mode), `GeneralInformationTab` (new-report flow) and `GeneralInformationView` (report detail edit) |
| Offline tiles | Zero-setup and automatic: the ambient cache (raised to ~200 MB) plus a silent offline pack around every confirmed pin. No region-wide download and no download button |
| Sequencing | Own branch (`feat/map-location-picker`) and APK before the remaining polish items, since this is the only one that needs a native rebuild |
| Field order | While the lat/lng rows are being touched, Nature of Business / PSIC Code move **above** Latitude / Longitude on the two establishment forms, matching the report-side General Information order |

## Native footprint

- New dependency `@maplibre/maplibre-react-native@^11.3` (peer-compatible
  with Expo 55 / RN 0.83 / new architecture). Its config plugin is added to
  `app.json` `plugins`; on Android the library autolinks, so nothing under
  the committed `android/` folder is edited by hand.
- The APK must be rebuilt (the existing `develop` → EAS `preview` path).
  Metro against an older APK fails at import time with a missing-native-
  module error until then — the PR calls this out.
- No new permissions: `ACCESS_FINE_LOCATION` is already declared for photo
  geotagging.

## Architecture

New feature module:

```
src/features/location/
  mapConfig.ts                 style URL, MIMAROPA overview camera, cache/pack constants
  components/
    CoordinateFields.tsx       Latitude + Longitude TextFields + "Pin on map" button
    LocationPickerModal.tsx    full-screen picker: MapView, crosshair, GPS button, readout, footer
    OfflineTilesBanner.tsx     "No map tiles available offline…" strip
  hooks/
    useDeviceLocation.ts       permission + getCurrentPositionAsync, exposes fix/status
  offlinePacks.ts              cacheAreaAroundPin(name, lat, lng) — fire-and-forget pack creation
  coordinates.ts               parseCoordinate / roundCoordinate / isValidLatLng helpers
```

### `CoordinateFields`

Props: `lat: string`, `lng: string`, `onChange({ lat, lng })`,
`readOnly?`, `pickerTitle?`, `packName?` (used to name the offline pack —
the establishment id where one exists, otherwise `pending`), plus the
focus-chain props the surrounding forms already pass to `TextField`
(`returnKeyType`, `onSubmitEditing`, `onFocus` per field via refs).

Renders the two `TextField`s in a row exactly as the four call sites do
today, and — unless `readOnly` — a compact icon button (`map-outline`)
after the Longitude field that opens `LocationPickerModal`. Confirming the
picker calls `onChange` once with both values as strings. The component
owns only the modal's open/closed state; values live with the caller.

### `LocationPickerModal`

Full-screen `Modal` with the app's dialog chrome (navy header, green rule,
close button; footer with **Cancel** and **Use this location**).

- **Crosshair.** A fixed pin graphic centred over the `MapView`; the map
  moves under it. `onRegionDidChange` reads the camera centre into local
  state, which drives the readout (`11.144000, 119.395000`) under the map.
- **Initial camera.** In order: the caller's current values when both
  parse to a valid lat/lng (zoom 16) → the last GPS fix held by
  `useDeviceLocation` (zoom 16) → the MIMAROPA overview (centre 12.0,
  120.5, zoom 7).
- **GPS button.** Floating `locate` icon over the map's bottom-right. On
  press: request foreground permission if not granted → `High` accuracy
  fix with a 15 s timeout → animate the camera to it. The `UserLocation`
  layer shows the blue dot once permission exists. Denied / timed out /
  services off → a one-line inline note under the readout; the map stays
  usable. Never auto-fires on open — an inspector editing a known site must
  not have the pin yanked to wherever they are standing.
- **Offline.** When `NetInfo` reports no connection, `OfflineTilesBanner`
  sits over the top of the map: "No map tiles available offline — your pin
  and GPS position still work." Tiles already in the ambient cache or an
  offline pack render normally underneath; the banner is informational, not
  a gate. Pin, readout, GPS and Confirm never depend on tiles.
- **Confirm.** Returns `{ lat, lng }` rounded to 6 dp and, when online,
  kicks off `cacheAreaAroundPin` without awaiting it. The picker holds no
  persistence of its own.

### Offline tiles

- **Ambient cache.** `setMaximumAmbientCacheSize(200 MB)` once at app
  start (`DatabaseProvider` or a small `initMapCache()` next to the style
  constant). Every tile viewed online stays available offline until
  evicted.
- **Pack per confirmed pin.** `cacheAreaAroundPin(name, lat, lng)` creates
  (or, if a pack of that name already exists, deletes and recreates) an
  offline pack for a ~2 km square around the pin at zoom 12–16 — a few
  hundred vector tiles, a few MB. Errors are logged and swallowed; it is
  never awaited by UI. Pack names: `estab:<estabId>` when the caller knows
  the establishment, otherwise `estab:pending`, so the new-establishment
  modal never accumulates orphan packs — the next pending pin replaces the
  last.

### Integration

1. **`NewEstablishmentModal`** — the lat/lng row becomes
   `CoordinateFields` and moves below Nature of Business / PSIC Code.
   `packName` is `pending`. Focus chain: PSIC → Latitude → Longitude →
   Inspection Date.
2. **`EstablishmentInfoSections` Details section** — `geoLat` / `geoLng`
   join `DetailsFields` as strings (`''` when null), `toDetailsFields` /
   `fromDetailsFields` convert to and from the numeric record fields, and
   the read-only note about them is removed. `CoordinateFields` renders
   `readOnly={!details.editing}`; `packName` is the establishment id. The
   row moves below Nature of Business / PSIC Code. `geoLat`/`geoLng` are
   already in `ESTABLISHMENT_CONTENT_FIELDS`, so `patchEstablishmentRecord`
   and the sync snapshot need no change.
3. **`GeneralInformationTab`** — its existing lat/lng row becomes
   `CoordinateFields` (order already Nature/PSIC then Lat/Lng). `packName`
   is the establishment id when the report is for an existing one.
4. **`GeneralInformationView`** — same, with `readOnly={!details.editing}`
   and the existing `changeNote` props forwarded per field.

`GeneralInfoFormState.geoLat/geoLng` stay strings; nothing in persistence
or sync changes.

## Error handling

| Situation | Behaviour |
|---|---|
| Location permission denied | Inline note under readout; GPS button stays enabled so the inspector can retry after changing settings |
| GPS fix times out / services off | Same inline note with the specific reason; no camera move |
| Offline with no cached tiles | Banner over the map; interaction and Confirm unaffected |
| Style URL unreachable while online | MapLibre renders a blank map; treated like offline (banner keyed on tile-load failure as well as NetInfo) |
| Offline pack creation fails | `console.warn`, nothing surfaced — the pin is already saved in the form |
| Caller's field values are unparsable | Ignored for the initial camera (falls through to GPS / overview); the fields themselves are untouched until Confirm |

## Testing

- **Unit (Jest).** A `@maplibre/maplibre-react-native` mock in
  `jest.setup.js` exposing `MapView`, `Camera`, `UserLocation`,
  `offlineManager` and `setMaximumAmbientCacheSize` as spies.
  - `coordinates.ts` — parsing, rounding, validity bounds.
  - `CoordinateFields` — renders both values; button hidden when
    `readOnly`; opening the picker and confirming calls `onChange` once
    with both strings.
  - `LocationPickerModal` — initial-camera resolution order; GPS flow for
    granted / denied / timeout; Confirm payload rounding; offline banner
    toggled by mocked NetInfo; `cacheAreaAroundPin` called only when
    online.
  - `offlinePacks.ts` — replaces an existing pack of the same name;
    swallows errors.
  - Establishment Details section — `geoLat`/`geoLng` round-trip through
    `toDetailsFields` / `fromDetailsFields` and are patched on save.
- **Device.** The map cannot render in Jest or the in-app browser. A
  preview APK from the existing CI path is the verification step; the
  checklist (pin, GPS, offline banner, tiles visible after going offline)
  is the reviewer's.

## Out of scope

- Address-based coordinate lookup of any kind.
- A region-wide "download MIMAROPA" pack or a manual download button —
  additive follow-ups if the automatic caching proves insufficient.
- Reverse-geocoding the pin to a place name.
- Showing other establishments on the map.
