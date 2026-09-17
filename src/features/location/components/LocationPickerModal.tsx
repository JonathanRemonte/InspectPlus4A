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
    // Modals in this codebase stay mounted and only toggle `visible` (see
    // HomeHeader's SyncOptionsModal), so a denied/unavailable/failed note
    // from a previous open would otherwise still be showing on reopen.
    // `gps.reset` is a stable `useCallback` reference; `gps` itself is a
    // fresh object every render, so depending on the whole object here
    // would re-run this effect (and clear the note) on every keystroke
    // elsewhere in the tree, not just when the modal opens.
    gps.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialCamera, gps.reset]);

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
    // `gps.locate` is a stable `useCallback` reference; `gps` itself is a
    // fresh object every render, so depending on it would rebuild this
    // callback (and any child re-render it triggers) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.locate]);

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
