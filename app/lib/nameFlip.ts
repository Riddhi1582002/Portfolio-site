import type { Flip } from "gsap/Flip";

// The name-click transition captures the hero name's Flip state just
// before navigating to /about, then the About header consumes it on
// mount. Next.js client-side navigation keeps the JS runtime alive
// across the route change, so a module-scope holder survives the trip
// (no sessionStorage needed — FlipState isn't trivially serializable).
// GSAP Flip pairs elements across two states by data-flip-id, auto-assigning
// one during getState() when absent. The hero's name link is destroyed by the
// route change, so the About header has to carry the *same explicit* id or
// Flip has nothing to match the captured state against and animates nothing.
export const NAME_FLIP_ID = "riddhi-name";

let pendingState: Flip.FlipState | null = null;

export function setPendingNameFlip(state: Flip.FlipState) {
  pendingState = state;
}

export function takePendingNameFlip(): Flip.FlipState | null {
  const state = pendingState;
  pendingState = null;
  return state;
}
