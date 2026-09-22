import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { formatResolvedAddress, resolveAddress, type ResolvedAddress } from '../resolveAddress';
import { OfflineTilesBanner } from './OfflineTilesBanner';

export interface PickedLocation {
  lat: number;
  lng: number;
  // The barangay the pin sits in, or null outside every MIMAROPA polygon —
  // see resolveAddress.ts. Callers apply it to Province/City/Barangay.
  address: ResolvedAddress | null;
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
  // Destructured so effects/callbacks below can list exactly the function
  // they use as a plain dependency — each is a stable `useCallback`
  // reference from useDeviceLocation — instead of a `gps.foo` member
  // expression, which eslint's exhaustive-deps can't verify is independent
  // of the rest of `gps` and would otherwise want the whole object.
  const { reset, checkPermission, getLastKnownFix, locate } = gps;

  // Bumped every time `visible` turns true — one "generation" per open.
  // `handleLocate` captures the current generation before its GPS await and
  // checks it again after, so a fix that resolves after the picker was
  // closed and reopened (possibly on a different site) never lands on the
  // wrong open's pin.
  const openGenRef = useRef(0);
  // `visible` inside `handleLocate`'s closure is whatever it was when the
  // button was pressed; this ref is always current, including after the
  // async GPS call resolves.
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

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
    openGenRef.current += 1;
    setCenter({ lat: initialCamera.center[1], lng: initialCamera.center[0] });
    setStyleFailed(false);
    // Modals in this codebase stay mounted and only toggle `visible` (see
    // HomeHeader's SyncOptionsModal), so a denied/unavailable/failed note
    // from a previous open would otherwise still be showing on reopen.
    reset();
    // Silent check (no prompt): lights up the UserLocation dot right away
    // when permission was already granted in an earlier session, instead
    // of waiting for the inspector to press the GPS button.
    void checkPermission();
  }, [visible, initialCamera, reset, checkPermission]);

  // Only when the caller gave us nothing: a silent read of the phone's
  // last position (no prompt) to open somewhere near the inspector.
  useEffect(() => {
    if (!visible) return;
    if (parseLatLng(initialLat, initialLng)) return;
    let cancelled = false;
    void getLastKnownFix().then(fix => {
      if (cancelled || !fix) return;
      const next = resolveInitialCamera({ lat: '', lng: '', lastFix: fix });
      setCenter({ lat: next.center[1], lng: next.center[0] });
      cameraRef.current?.jumpTo({ center: next.center, zoom: next.zoom });
    });
    return () => {
      cancelled = true;
    };
  }, [visible, initialLat, initialLng, getLastKnownFix]);

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
    const openGen = openGenRef.current;
    const fix = await locate();
    if (!fix) return;
    // Drop a fix that resolves after Cancel was pressed (the GPS call can
    // take up to 15s), or after the picker was closed and reopened on a
    // different site in that window — otherwise a known site's pin gets
    // yanked to wherever the phone now is.
    if (!visibleRef.current || openGenRef.current !== openGen) return;
    setCenter(fix);
    cameraRef.current?.flyTo({ center: [fix.lng, fix.lat], zoom: PIN_ZOOM, duration: FLY_DURATION_MS });
  }, [locate]);

  const handleConfirm = useCallback(() => {
    const lat = roundCoordinate(center.lat);
    const lng = roundCoordinate(center.lng);
    // Resolved from the rounded pair so the payload can't disagree with
    // what the readout showed for these exact coordinates.
    const picked: PickedLocation = { lat, lng, address: resolveAddress(lat, lng) };
    if (online) void cacheAreaAroundPin(packName, lat, lng);
    onConfirm(picked);
  }, [center, online, packName, onConfirm]);

  const showBanner = !online || styleFailed;
  const liveAddress = useMemo(() => resolveAddress(center.lat, center.lng), [center]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
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
            // A SurfaceView (the Android default) doesn't follow its
            // parent's view animation, so inside this slide-animated Modal
            // the map could flash black or snap, and overlays could
            // intermittently drop behind it, during the open/close animation.
            androidView="texture"
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
          <Text
            style={liveAddress ? styles.addressReadout : styles.addressReadoutMuted}
            testID="address-readout"
            numberOfLines={2}>
            {formatResolvedAddress(liveAddress)}
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
      </SafeAreaView>
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
  addressReadout: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: Spacing.xxs,
  },
  addressReadoutMuted: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    color: Colors.textMuted,
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
