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
