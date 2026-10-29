import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { Camera, Map as MapLibreMap, UserLocation } from '@maplibre/maplibre-react-native';
import { LocationPickerModal } from './LocationPickerModal';
import { cacheAreaAroundPin } from '../offlinePacks';
import { resolveAddress } from '../resolveAddress';
import { REGION_OVERVIEW, PIN_ZOOM } from '../mapConfig';
import { region } from '../../../region';

jest.mock('../offlinePacks', () => ({ cacheAreaAroundPin: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../resolveAddress', () => {
  const actual = jest.requireActual('../resolveAddress');
  return { ...actual, resolveAddress: jest.fn() };
});

const { __cameraFlyTo: cameraFlyTo, __cameraJumpTo: cameraJumpTo } = jest.requireMock('@maplibre/maplibre-react-native');
const mockNetInfo = NetInfo as unknown as { addEventListener: jest.Mock; fetch: jest.Mock };
const mockLocation = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
};
const mockResolveAddress = resolveAddress as jest.Mock;
const CABIGAAN = { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' };

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

const addressReadout = (r: Renderer) =>
  r.root.findAll(n => n.type === Text && n.props.testID === 'address-readout')[0].props.children;

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
  mockResolveAddress.mockReturnValue(null);
});

describe('LocationPickerModal — initial camera', () => {
  // Longer timeout: as the first test in this file it also pays for the
  // one-time module init of maplibre/safe-area-context mocks, which under a
  // full-suite parallel run can occasionally push past Jest's 5s default.
  it(
    'opens on the field values at pin zoom when they are valid',
    async () => {
      const r = await render(<LocationPickerModal {...baseProps} initialLat="11.144" initialLng="119.395" />);
      expect(r.root.findByType(Camera).props.initialViewState).toEqual({ center: [119.395, 11.144], zoom: PIN_ZOOM });
      expect(readout(r)).toBe('11.144000, 119.395000');
      expect(cameraJumpTo).not.toHaveBeenCalled();
    },
    15000,
  );

  it('opens on the overview, then jumps to the last known GPS fix when the fields are empty', async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLocation.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 12.5, longitude: 121.1 } });
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual(REGION_OVERVIEW);
    expect(cameraJumpTo).toHaveBeenCalledWith({ center: [121.1, 12.5], zoom: PIN_ZOOM });
  });

  it('stays on the overview when there is no last known fix', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual(REGION_OVERVIEW);
    expect(cameraJumpTo).not.toHaveBeenCalled();
  });

  it('never requests permission or a fresh fix just by opening', async () => {
    await render(<LocationPickerModal {...baseProps} />);
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('re-seeds the camera when the same instance reopens with different initial coordinates', async () => {
    const r = await render(<LocationPickerModal {...baseProps} initialLat="11.144" initialLng="119.395" />);
    expect(r.root.findByType(Camera).props.initialViewState).toEqual({ center: [119.395, 11.144], zoom: PIN_ZOOM });
    expect(readout(r)).toBe('11.144000, 119.395000');

    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible={false} initialLat="11.144" initialLng="119.395" />);
    });
    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible initialLat="12.5" initialLng="121.1" />);
    });

    expect(r.root.findByType(Camera).props.initialViewState).toEqual({ center: [121.1, 12.5], zoom: PIN_ZOOM });
    expect(readout(r)).toBe('12.500000, 121.100000');
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

  it('clears a stale GPS note when the modal closes and reopens', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const r = await render(<LocationPickerModal {...baseProps} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Use my GPS position').props.onPress();
    });
    expect(r.root.findAll(n => n.type === Text && n.props.testID === 'gps-note')).toHaveLength(1);

    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible={false} />);
    });
    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible />);
    });

    expect(r.root.findAll(n => n.type === Text && n.props.testID === 'gps-note')).toHaveLength(0);
  });

  it('drops a GPS fix that resolves after the picker is closed and reopened on a different site', async () => {
    let resolveFix!: (value: { coords: { latitude: number; longitude: number } }) => void;
    mockLocation.getCurrentPositionAsync.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFix = resolve;
        }),
    );

    const r = await render(<LocationPickerModal {...baseProps} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Use my GPS position').props.onPress();
    });

    // Closed (as if Cancel/back were pressed) then reopened on a known site
    // while the 15s GPS fix is still in flight.
    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible={false} />);
    });
    await TestRenderer.act(async () => {
      r.update(<LocationPickerModal {...baseProps} visible initialLat="11.144" initialLng="119.395" />);
    });

    // The stale fix now resolves — it must not touch the reopened pin.
    await TestRenderer.act(async () => {
      resolveFix({ coords: { latitude: 8.0, longitude: 125.0 } });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cameraFlyTo).not.toHaveBeenCalled();
    expect(readout(r)).toBe('11.144000, 119.395000');
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
    expect(onConfirm).toHaveBeenCalledWith({ lat: 11.144988, lng: 119.395123, address: null });
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
    expect(baseProps.onConfirm).toHaveBeenCalledWith({ lat: 11.144, lng: 119.395, address: null });
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

describe('LocationPickerModal — resolved address', () => {
  it('shows the outside note when the pin resolves to nothing', async () => {
    const r = await render(<LocationPickerModal {...baseProps} initialLat="12.0" initialLng="120.5" />);
    expect(addressReadout(r)).toBe(region.locations.outsideBoundariesLabel);
  });

  it('resolves live as the map settles', async () => {
    const r = await render(<LocationPickerModal {...baseProps} />);
    mockResolveAddress.mockReturnValue(CABIGAAN);
    await moveMap(r, 118.47504, 9.45777);
    expect(mockResolveAddress).toHaveBeenLastCalledWith(9.45777, 118.47504);
    expect(addressReadout(r)).toBe('Brgy. Cabigaan, Aborlan, Palawan');
  });

  it('confirms with the address resolved from the rounded coordinates', async () => {
    const onConfirm = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} onConfirm={onConfirm} />);
    mockResolveAddress.mockReturnValue(CABIGAAN);
    await moveMap(r, 118.4750412345, 9.4577712345);
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(mockResolveAddress).toHaveBeenLastCalledWith(9.457771, 118.475041);
    expect(onConfirm).toHaveBeenCalledWith({ lat: 9.457771, lng: 118.475041, address: CABIGAAN });
  });

  it('confirms with address null when the pin is outside every barangay', async () => {
    const onConfirm = jest.fn();
    const r = await render(<LocationPickerModal {...baseProps} initialLat="12.0" initialLng="120.5" onConfirm={onConfirm} />);
    await TestRenderer.act(async () => {
      findButton(r, 'Use this location').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ lat: 12, lng: 120.5, address: null });
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
