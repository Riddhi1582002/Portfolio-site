import type { Flip } from "gsap/Flip";

// The name-click transition captures the hero name's Flip state just
// before navigating to /about, then the About header consumes it on
// mount. Next.js client-side navigation keeps the JS runtime alive
// across the route change, so a module-scope holder survives the trip
// (no sessionStorage needed — FlipState isn't trivially serializable).
let pendingState: Flip.FlipState | null = null;

export function setPendingNameFlip(state: Flip.FlipState) {
  pendingState = state;
}

export function takePendingNameFlip(): Flip.FlipState | null {
  const state = pendingState;
  pendingState = null;
  return state;
}
