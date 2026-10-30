import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act } from 'react-test-renderer';
import { checkForUpdate } from './checkForUpdate';
import { UPDATE_CHECK_INTERVAL_MS, UPDATE_CHECK_STORAGE_KEY, useUpdateCheck } from './useUpdateCheck';

jest.mock('./checkForUpdate', () => ({
  checkForUpdate: jest.fn(),
  // jest.mock factories are hoisted above imports, so read the region via requireActual here.
  LATEST_APK_URL: `https://github.com/${(jest.requireActual('../../region') as typeof import('../../region')).region.identity.releaseRepo}/releases/latest/download/inspectplus.apk`,
}));

const mockCheck = checkForUpdate as jest.Mock;
const update = { version: '1.1.0', url: 'https://example.test/inspectplus.apk' };

type Result = ReturnType<typeof useUpdateCheck>;

// Mounts the hook in a throwaway component and hands back a getter for
// its latest result, so tests read state after awaiting the effects.
const mount = () => {
  let latest!: Result;
  const Probe = () => { latest = useUpdateCheck(); return null; };
  act(() => { TestRenderer.create(<Probe />); });
  return () => latest;
};

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCheck.mockReset();
  jest.useFakeTimers({ now: new Date('2026-09-17T08:00:00Z') });
});

afterEach(() => { jest.useRealTimers(); });

describe('useUpdateCheck', () => {
  it('checks on mount when nothing is cached, exposes the update, and caches the result', async () => {
    mockCheck.mockResolvedValue(update);
    const get = mount();
    await flush();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(get().update).toEqual(update);
    expect(JSON.parse((await AsyncStorage.getItem(UPDATE_CHECK_STORAGE_KEY))!)).toEqual({ checkedAt: Date.now(), update });
  });

  it('shows nothing when there is no newer release', async () => {
    mockCheck.mockResolvedValue(null);
    const get = mount();
    await flush();
    expect(get().update).toBeNull();
  });

  // Once per launch would hit GitHub every time an inspector reopens the app
  // in the field; the cache keeps it to a handful of requests a day while
  // still showing the banner on every launch once one is known.
  it('reuses a cached result inside the check interval without calling GitHub', async () => {
    await AsyncStorage.setItem(UPDATE_CHECK_STORAGE_KEY, JSON.stringify({ checkedAt: Date.now() - UPDATE_CHECK_INTERVAL_MS + 60_000, update }));
    const get = mount();
    await flush();
    expect(mockCheck).not.toHaveBeenCalled();
    expect(get().update).toEqual(update);
  });

  it('checks again once the cached result is older than the interval', async () => {
    await AsyncStorage.setItem(UPDATE_CHECK_STORAGE_KEY, JSON.stringify({ checkedAt: Date.now() - UPDATE_CHECK_INTERVAL_MS - 1, update: null }));
    mockCheck.mockResolvedValue(update);
    const get = mount();
    await flush();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(get().update).toEqual(update);
  });

  it('hides a dismissed version, remembers that across mounts, and still surfaces a later one', async () => {
    mockCheck.mockResolvedValue(update);
    const get = mount();
    await flush();
    await act(async () => { await get().dismiss(); });
    expect(get().update).toBeNull();

    const again = mount();
    await flush();
    expect(again().update).toBeNull();

    await AsyncStorage.removeItem(UPDATE_CHECK_STORAGE_KEY);
    mockCheck.mockResolvedValue({ version: '1.2.0', url: 'u' });
    const later = mount();
    await flush();
    expect(later().update).toEqual({ version: '1.2.0', url: 'u' });
  });
});
