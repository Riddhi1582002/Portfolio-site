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

// The About header's face. Declared here so the hero can warm exactly this
// face before navigating: if the webfont is still loading when the header
// mounts, the landing geometry is measured against the fallback and then
// changes underneath the animation.
export const NAME_FLIP_FONT = "700 72px 'Neue Montreal'";

let pendingState: Flip.FlipState | null = null;

export function setPendingNameFlip(state: Flip.FlipState) {
  pendingState = state;
}

export function takePendingNameFlip(): Flip.FlipState | null {
  const state = pendingState;
  pendingState = null;
  return state;
}

/** Is a flip waiting to run? Peeks without consuming, unlike take(). */
export function hasPendingNameFlip(): boolean {
  return pendingState !== null;
}

/**
 * Ask for the header's face ahead of time. Called on the hero so that by
 * the time /about mounts, document.fonts.check() is already true and the
 * Flip can start in a layout effect — before the browser paints the new
 * route — instead of after a promise resolves a couple of frames later.
 */
export function warmNameFlipFont() {
  try {
    void document.fonts.load(NAME_FLIP_FONT, "Riddhi Thakkar");
  } catch {
    // Font Loading API unavailable — the About side falls back to waiting
    // on document.fonts.ready, which is the old behaviour.
  }
}
