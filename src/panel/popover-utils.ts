// src/panel/popover-utils.ts
// Positions a panel popover so it never exceeds the viewport.
// The popover sits inside a position:fixed overlay that covers the full
// viewport (top:0,left:0,right:0,bottom:0), so top/left values are
// equivalent to viewport coordinates.

const GAP = 6;   // px gap between anchor and popover edge
const EDGE = 8;  // minimum distance from viewport edges

/**
 * Positions `popover` relative to `anchor` so it stays inside the viewport.
 *
 * Prefers opening below the anchor. Flips to above when the space below is
 * insufficient and above has more room. Clamps horizontally to the right edge.
 *
 * Call AFTER appending the popover to the DOM so the browser has dimensions.
 * If the popover hasn't rendered yet, pass `preferredWidth` explicitly.
 */
export function positionPopover(
  popover: HTMLElement,
  anchor: HTMLElement,
  preferredWidth?: number,
): void {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - rect.bottom - GAP - EDGE;
  const spaceAbove = rect.top - GAP - EDGE;

  // Flip to above only when below is tight AND above actually has more room
  const goAbove = spaceBelow < 160 && spaceAbove > spaceBelow;

  if (goAbove) {
    popover.style.top = 'auto';
    popover.style.bottom = `${vh - rect.top + GAP}px`;
    popover.style.maxHeight = `${Math.max(80, spaceAbove)}px`;
  } else {
    popover.style.bottom = 'auto';
    popover.style.top = `${rect.bottom + GAP}px`;
    popover.style.maxHeight = `${Math.max(80, spaceBelow)}px`;
  }

  // Horizontal: align to anchor left, clamp so right edge stays in viewport
  const width = preferredWidth ?? popover.offsetWidth ?? 200;
  const left = Math.max(EDGE, Math.min(rect.left, vw - width - EDGE));
  popover.style.left = `${left}px`;
  popover.style.right = 'auto';
}
