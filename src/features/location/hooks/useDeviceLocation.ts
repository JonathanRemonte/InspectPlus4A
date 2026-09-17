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
