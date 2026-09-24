import { popoverPosition, type AnchorRect } from './popoverPosition';

const SCREEN = { width: 400, height: 800 };
const MENU = { width: 180, height: 100 };
// A ⋯ button near the right edge, in the upper half of a phone screen.
const anchor: AnchorRect = { x: 350, y: 200, width: 30, height: 30 };

describe('popoverPosition', () => {
  it('drops the menu just below the button', () => {
    const { top } = popoverPosition({ anchor, menu: MENU, screen: SCREEN });
    expect(top).toBeGreaterThanOrEqual(anchor.y + anchor.height);
    expect(top).toBeLessThan(anchor.y + anchor.height + 16);
  });

  it("right-aligns the menu to the button's right edge", () => {
    const { left } = popoverPosition({ anchor, menu: MENU, screen: SCREEN });
    expect(left + MENU.width).toBe(anchor.x + anchor.width);
  });

  it('flips above the button when there is no room below', () => {
    const low: AnchorRect = { x: 350, y: 760, width: 30, height: 30 };
    const { top } = popoverPosition({ anchor: low, menu: MENU, screen: SCREEN });
    expect(top + MENU.height).toBeLessThanOrEqual(low.y);
  });

  it('never runs off the right edge', () => {
    const farRight: AnchorRect = { x: 396, y: 200, width: 30, height: 30 };
    const { left } = popoverPosition({ anchor: farRight, menu: MENU, screen: SCREEN });
    expect(left + MENU.width).toBeLessThanOrEqual(SCREEN.width - 8);
  });

  it('never runs off the left edge', () => {
    const farLeft: AnchorRect = { x: 0, y: 200, width: 30, height: 30 };
    const { left } = popoverPosition({ anchor: farLeft, menu: MENU, screen: SCREEN });
    expect(left).toBeGreaterThanOrEqual(8);
  });

  it('keeps a tall menu on screen even when it fits neither side cleanly', () => {
    const tall = { width: 180, height: 700 };
    const { top } = popoverPosition({ anchor, menu: tall, screen: SCREEN });
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + tall.height).toBeLessThanOrEqual(SCREEN.height - 8);
  });
});
