// ONE WIPE, IN TWO HALVES.
//
// Leaving a card for its page used to be a black rectangle fading in over
// the enlarging card. A fade has no direction: it dims the page you are on
// and then the next one is simply there, which is why the two sides never
// read as one move. A curtain does have a direction, and both pages can
// share it — the panel travels UP across the viewport to cover the card,
// the navigation happens behind it, and on the far side the same panel
// keeps travelling up and off, revealing the new page from the bottom. One
// continuous sweep, interrupted only by the page load it is there to hide.
//
// Transform-based throughout (scaleY about a fixed edge, which the
// compositor can run on its own), never opacity: the leading edge is the
// whole point.
//
// The two halves are joined across a real navigation, so the intent has to
// survive one. sessionStorage is the right lifetime — this visit, this tab
// — and a timestamp guards against a stale flag replaying a wipe on a page
// opened much later from history.

import gsap from "gsap";

const KEY = "curtainIn";
/** Beyond this, a stored intent is stale: the reader went elsewhere. */
const MAX_AGE_MS = 8000;

export const CURTAIN_OUT_S = 0.62;
export const CURTAIN_IN_S = 0.68;
const EASE_OUT = "power3.in";
const EASE_IN = "power3.out";

function panel(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.curtain = "";
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    background: "#000",
    pointerEvents: "none",
    willChange: "transform",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

/**
 * The first half: the curtain rises over whatever is on screen, and `then`
 * runs once it has covered it. Returns the timeline so a caller can hang
 * its own tweens (a card still enlarging underneath) at position 0.
 */
export function curtainOut(then: () => void): gsap.core.Timeline {
  const el = panel();
  // Flat against the BOTTOM edge, then grown upward to full height: the
  // panel's top edge is the leading edge, sweeping up across the page.
  gsap.set(el, { scaleY: 0, transformOrigin: "50% 100%" });
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Blocked storage: the second half simply does not play, and the new
    // page arrives without a reveal rather than not arriving at all.
  }
  return gsap.timeline({ onComplete: then }).to(
    el,
    { scaleY: 1, duration: CURTAIN_OUT_S, ease: EASE_OUT },
    0
  );
}

/** Whether this page was arrived at through a curtain, consuming the flag. */
export function takeCurtainIntent(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    sessionStorage.removeItem(KEY);
    return Date.now() - Number(raw) < MAX_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * The second half: the curtain is already covering this page when it
 * paints, and keeps travelling up and off it. Same edge, same direction —
 * the panel now shrinks toward its TOP, so its BOTTOM edge sweeps upward
 * and the page is revealed from the bottom, exactly where the first half
 * left off.
 */
export function curtainIn(): void {
  const el = panel();
  gsap.set(el, { scaleY: 1, transformOrigin: "50% 0%" });
  gsap.to(el, {
    scaleY: 0,
    duration: CURTAIN_IN_S,
    ease: EASE_IN,
    onComplete: () => el.remove(),
  });
}
