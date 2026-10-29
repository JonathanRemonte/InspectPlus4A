import { pointInPolygon, pointInRing } from './pointInPolygon';

// Flat [lng, lat, …] rings, closing vertex omitted.
const square = [0, 0, 10, 0, 10, 10, 0, 10];
const hole = [4, 4, 6, 4, 6, 6, 4, 6];
// Concave "C": a square with a notch cut from the right side.
const cShape = [0, 0, 10, 0, 10, 3, 4, 3, 4, 7, 10, 7, 10, 10, 0, 10];

describe('pointInRing', () => {
  it('is true inside and false outside a square', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(11, 5, square)).toBe(false);
    expect(pointInRing(5, -1, square)).toBe(false);
  });
  it('handles a concave ring', () => {
    expect(pointInRing(2, 5, cShape)).toBe(true);
    expect(pointInRing(7, 5, cShape)).toBe(false); // inside the notch
    expect(pointInRing(7, 1, cShape)).toBe(true);
  });
  it('treats a point on a vertex or edge consistently (no exception, boolean result)', () => {
    expect(typeof pointInRing(0, 0, square)).toBe('boolean');
    expect(typeof pointInRing(5, 0, square)).toBe('boolean');
  });
});

describe('pointInPolygon', () => {
  it('excludes holes', () => {
    expect(pointInPolygon(5, 5, [square, hole])).toBe(false);
    expect(pointInPolygon(2, 2, [square, hole])).toBe(true);
  });
  it('is false outside the outer ring even with holes present', () => {
    expect(pointInPolygon(20, 20, [square, hole])).toBe(false);
  });
});
