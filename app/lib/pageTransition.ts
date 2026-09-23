// THE TRANSITION BETWEEN PAGES: AN APERTURE, NOT A PANEL.
//
// What this replaces moved a black rectangle across the screen. Every
// version of that — a curtain rising, a page sliding down, a wipe — has
// the same tell: something travels ACROSS the work, and for as long as it
// does, the thing you came to look at is being covered by a shape. It
// reads as a slide deck.
//
// This covers nothing. The page itself is the clipped element: it is
// revealed by an aperture opening from the centre line, and it leaves by
// the same aperture closing, so the destination is genuinely underneath
// and is uncovered rather than dealt on top. Nothing crosses the frame.
//
// Two things move together, and only two:
//
//   THE APERTURE — a clip-path inset closing to, and opening from, the
//   horizontal centre line. Symmetric, so there is no direction of travel
//   and nothing reads as a shove.
//
//   THE RECESSION — the outgoing page settles back a little as it closes
//   (scale 1 -> 0.965) and the incoming one settles forward onto its
//   place (1.035 -> 1). Small on purpose. It is what makes the two halves
//   read as one camera move rather than two separate animations.
//
// The transform origin is pinned to the VIEWPORT's centre in document
// coordinates, not the wrapper's own centre. The wrapper is the whole
// document and can be many screens tall; scaling about its middle would
// sweep the page across the viewport, which is the exact motion this is
// here to avoid.
//
// Joined across a real navigation: the intent is a timestamped
// sessionStorage flag, and the destination is already closed when it
// paints (see the inline script in app/layout.tsx, and the rule in
// globals.css that it switches on).

import gsap from "gsap";

const KEY = "pageReveal";
/** Beyond this, a stored intent is stale: the reader went elsewhere. */
const MAX_AGE_MS = 8000;

/** The element the aperture is applied to. */
export const FRAME_ID = "page-frame";
/** The attribute the pre-paint script sets on <html>. */
export const REVEAL_ATTR = "data-reveal";

export const OUT_S = 0.62;
export const IN_S = 0.78;

const CLOSED = "inset(50% 0% 50% 0%)";
const OPEN = "inset(0% 0% 0% 0%)";

function frame(): HTMLElement | null {
  return document.getElementById(FRAME_ID);
}

/** Keeps the viewport's centre still while the wrapper scales. */
function pinOrigin(el: HTMLElement) {
  const top = el.getBoundingClientRect().top;
  gsap.set(el, { transformOrigin: `50% ${-top + window.innerHeight / 2}px` });
}

/** Back to a plain element: no clip, no transform, no containing block. */
function release(el: HTMLElement) {
  gsap.set(el, { clearProps: "clipPath,transform,transformOrigin,willChange" });
}

/**
 * The page closes, and `then` runs once it has. Returns the timeline so a
 * caller can hang its own tweens (a card still enlarging) at position 0.
 */
export function pageOut(then: () => void): gsap.core.Timeline {
  const el = frame();
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Blocked storage: the destination simply opens without the second
    // half rather than not arriving at all.
  }
  const tl = gsap.timeline({ onComplete: then });
  if (!el) return tl.to({}, { duration: OUT_S });
  pinOrigin(el);
  gsap.set(el, { clipPath: OPEN, willChange: "clip-path, transform" });
  return tl.to(
    el,
    {
      clipPath: CLOSED,
      scale: 0.965,
      duration: OUT_S,
      ease: "power3.inOut",
    },
    0
  );
}

/** Whether this page was arrived at through a transition, consuming the flag. */
export function takeRevealIntent(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    sessionStorage.removeItem(KEY);
    return Date.now() - Number(raw) < MAX_AGE_MS;
  } catch {
    return false;
  }
}

// ── HOLDING THE REVEAL ──────────────────────────────────────────────────
// A page that arrives closed but must rebuild what it is returning to
// (the homepage, back to a card on the ring) can keep the aperture shut
// until that scene has actually drawn, so the reader never watches it
// being put together. It takes a hold in its own mount effect — which runs
// before PageReveal's, the reveal being rendered after the page — and
// releases it when ready. Always time-capped by the caller.
let holds = 0;
let waiting: (() => void) | null = null;
export function holdReveal(): () => void {
  holds += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    holds -= 1;
    if (holds === 0 && waiting) {
      const go = waiting;
      waiting = null;
      go();
    }
  };
}
/** Runs `then` at once, or as soon as every hold has been released. */
export function whenRevealFree(then: () => void): void {
  if (holds === 0) then();
  else waiting = then;
}

/**
 * The second half: the page is already closed when it paints, and the
 * aperture opens it. Same centre line, opposite direction, so the move
 * continues rather than starting again.
 */
export function pageIn(): void {
  const el = frame();
  if (!el) {
    document.documentElement.removeAttribute(REVEAL_ATTR);
    return;
  }
  pinOrigin(el);
  gsap.set(el, { clipPath: CLOSED, scale: 1.035, willChange: "clip-path, transform" });
  // The inline script's CSS cover comes off only once GSAP holds the same
  // closed aperture, so there is never a frame with neither.
  document.documentElement.removeAttribute(REVEAL_ATTR);
  // fromTo, not to: a plain `to` reads its start back from the element,
  // where the browser has shortened CLOSED to `inset(50% 0%)` — two
  // numbers against OPEN's four, so GSAP animated only the top edge and
  // dropped the bottom one to 0 on the first frame. The page appeared
  // from the bottom up under a black band across the top, and on a heavy
  // scene (the ring, the bulb) that band lingered for seconds. Given the
  // same four-number shape at both ends, both edges open from the centre.
  gsap.fromTo(
    el,
    { clipPath: CLOSED },
    {
      clipPath: OPEN,
      scale: 1,
      duration: IN_S,
      ease: "power3.out",
      onComplete: () => release(el),
    }
  );
}

/**
 * The page shuts at once, with no aperture — for when something already
 * covers the whole frame (the moth's fly-across) and the cut happens
 * behind it. The destination still opens with the usual aperture.
 */
export function pageCutOut(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // As in pageOut.
  }
  const el = frame();
  if (el) gsap.set(el, { clipPath: CLOSED });
}
