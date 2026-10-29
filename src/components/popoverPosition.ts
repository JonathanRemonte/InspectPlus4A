// Where an anchored popover sits relative to the control that opened it.
// Pure arithmetic, kept out of the component so the edge cases - a row at
// the very bottom of a list, a control hard against a screen edge - are
// testable without rendering anything.

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

interface PopoverPositionArgs {
  anchor: AnchorRect;
  menu: Size;
  screen: Size;
}

// Breathing room from the screen edges, and between the menu and its anchor.
const EDGE_MARGIN = 8;
const ANCHOR_GAP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function popoverPosition({ anchor, menu, screen }: PopoverPositionArgs): { top: number; left: number } {
  // Right-aligned to the anchor: these buttons sit at a row's right edge, so
  // the menu opens inward rather than off the side.
  const preferredLeft = anchor.x + anchor.width - menu.width;
  const left = clamp(preferredLeft, EDGE_MARGIN, Math.max(EDGE_MARGIN, screen.width - menu.width - EDGE_MARGIN));

  const below = anchor.y + anchor.height + ANCHOR_GAP;
  const above = anchor.y - menu.height - ANCHOR_GAP;
  // Below unless that would push it off the bottom and there is room above;
  // the clamp then keeps a menu too tall for either side fully on screen.
  const preferredTop = below + menu.height <= screen.height - EDGE_MARGIN || above < EDGE_MARGIN ? below : above;
  const top = clamp(preferredTop, EDGE_MARGIN, Math.max(EDGE_MARGIN, screen.height - menu.height - EDGE_MARGIN));

  return { top, left };
}
