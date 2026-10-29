import {
  formatCoordinate,
  isValidLatLng,
  parseCoordinate,
  parseLatLng,
  resolveInitialCamera,
  roundCoordinate,
} from './coordinates';
import { REGION_OVERVIEW, PIN_ZOOM } from './mapConfig';

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
  it('falls back to the region overview when nothing else is available', () => {
    expect(resolveInitialCamera({ lat: '', lng: '', lastFix: null })).toEqual(REGION_OVERVIEW);
  });
});
