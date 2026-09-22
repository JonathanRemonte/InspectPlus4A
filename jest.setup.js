// Mock AsyncStorage globally so any suite that transitively renders a report card
// (which imports urgencyConfig.ts, which imports AsyncStorage) doesn't fail at import time.
// Per-file mocks elsewhere in the repo still take precedence and work unchanged.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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
