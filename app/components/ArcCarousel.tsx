"use client";

// The arc of work around the bulb.
//
// Nine square pieces sit on a ring centred on the bulb. Scroll rotates the
// ring: each piece swings in from the right, comes to the front, and swings
// out to the left. Nothing moves on its own — the ring's angle IS the
// progress value, so a stopped scroll is a stopped carousel.
//
// The ring is an ARC, not a loop. Nine cards at ARC_STEP apart occupy less
// than a full turn, and the rotation range runs from "card 0 not yet on"
// to "card 8 already off". There is therefore always a gap behind the last
// card — scrolling past the end never brings the first one round again,
// which is what "no loop forming" asks for.
//
// EVERYTHING here is derived from one measured card edge in PIXELS. An
// earlier version set the card size in vh and the ring radius in vw, and
// on a tall narrow viewport (414x896, 834x1194) the card grew while the
// ring shrank until neighbours overlapped by 140px. Card, radius and
// spacing are now one chain from a single number, so the ring keeps its
// proportions at every aspect ratio.
//
// The bulb is the light in this room, so the cards arriving dim it and the
// last one leaving lets it come back up. That is one number, `presence`,
// reported back to the caller rather than owned here, so the model, the
// wash on the wall and the cards can never disagree about how lit the room
// is.

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import HoverCard from "./HoverCard";
import PublicationsDisplay, { preloadPublications } from "./PublicationsDisplay";

export const ARC_CARD_COUNT = 9;
/**
 * THE PUBLICATIONS CARD.
 *
 * The first piece on the arc is the publications work, and it is the only
 * one that carries a real 3D display rather than a placeholder: five books
 * and booklets standing inside the card (see PublicationsDisplay). Every
 * other slot on the ring is untouched and still shows the neutral plate.
 */
const PUBLICATIONS_INDEX = 0;
// Angle between neighbouring cards on the ring. 9 x 30 = 270 degrees
// occupied, so 90 degrees of the ring stays empty: the gap that stops it
// reading as a loop.
const ARC_STEP_DEG = 30;
// How far past the ends the rotation runs, in cards. At 2.6 the first and
// the last card are both beyond the angular cull at the ends of the beat,
// so the arc opens and closes on an empty frame.
const ARC_LEAD = 2.6;

// The one measurement everything else follows from.
const CARD_SHARE = 0.44; // of the viewport's shorter side
const CARD_MIN_PX = 110;
const CARD_MAX_PX = 430;
// Ring radius, in card edges. The chord between neighbours is
// 2 * R * sin(15deg) = 0.518 * R = 1.35 card edges, so two cards at the
// front of the ring clear each other by about a third of their width.
// The binding case is 740x360 landscape, where the card hits its pixel
// floor while the viewport is short: at 2.45 that pair projected to
// 14.6px apart, just under 1rem. This holds every viewport above it.
const RADIUS_IN_CARDS = 2.6;

// Angular fade: governs wide viewports, where a card leaves by turning
// away rather than by reaching the frame edge.
const FADE_START_DEG = 42;
const FADE_END_DEG = 74;
// Edge fade: governs narrow ones, where a card reaches the frame edge
// while still nearly face on. Measured against the viewport, so it cannot
// disagree with the actual width the way a fixed angle did.
const EDGE_FADE_START = 0.5; // of viewport width, from centre
const EDGE_FADE_END = 0.68;

// The ring sits slightly above the bulb's box centre, so the glass clips
// the bottom corner of the card in front rather than its middle.
const RING_LIFT_VH = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

/**
 * How much of the room the arc is taking up, 0..1. Rises as the first card
 * comes on, holds while the arc is running, falls as the last leaves.
 *
 * CordSection used to dim every lit thing in the beat by exactly this, and
 * that is what made the light switch off rather than hand over — this rise
 * is a tenth of the arc's window, under 300px of scrolling for the largest
 * change of light on the page. It now keeps its own, longer curve for that
 * (`lightYield` there) so the room darkens AROUND the arriving work rather
 * than ahead of it. This is still the honest description of the arc's own
 * occupancy, which is why it stays here.
 */
export function arcPresence(progress: number) {
  const p = clamp01(progress);
  return Math.min(easeInOutSine(span(p, 0, 0.1)), 1 - easeInOutSine(span(p, 0.88, 1)));
}

export default function ArcCarousel({
  progress,
  /** Vertical centre of the bulb, in vh. */
  centreVh,
  vw,
  vh,
}: {
  progress: number;
  centreVh: number;
  vw: number;
  vh: number;
}) {
  const p = clamp01(progress);

  // EARLY PRELOAD. Fires as soon as this component mounts — which, since
  // CordSection renders it unconditionally, is the same early moment
  // CordSection's own BulbModel starts warming its WebGL/GLTF — well before
  // the reader has scrolled anywhere near this beat's own visible window.
  // Idempotent (see the module cache in PublicationsDisplay), so this is
  // simply "as early as possible," not "the only place it's requested."
  useEffect(() => {
    preloadPublications();
  }, []);

  // THE PUBLICATIONS CARD'S HOVER AND CLICK, MEASURED IN PLAIN 2D — NOT
  // NATIVE HIT-TESTING THROUGH THE ELEMENT ITSELF.
  //
  // `data-arc-card` carries a real 3D transform (translate3d + rotateY) as
  // a direct child of the ring's own `preserve-3d` context, and HoverCard
  // nests a SECOND, independent `perspective` + `transform` immediately
  // inside it (`.hc-wrapper` in hover-card.css). That combination made the
  // element's own native pointer hit-testing unreliable — measured
  // directly (`document.elementFromPoint` across a grid), roughly the
  // right half of the card's own reported bounding box didn't hit-test as
  // part of the card at all, so `onPointerEnter`/`onPointerLeave` attached
  // to the card itself only fired reliably over a fraction of it. Rather
  // than chase the exact Chromium compositing quirk through two nested 3D
  // contexts, this sidesteps native hit-testing for the card entirely:
  // one `pointermove` listener on the window compares the cursor's plain
  // `clientX`/`clientY` against the card's own `getBoundingClientRect()`
  // (a reliable, ordinary 2D rectangle — confirmed directly) and writes
  // `--pub-hover` from that, and a `click` listener does the same for
  // navigation. Neither depends on which element the browser thinks is
  // "on top" at a given pixel.
  //
  // NAVIGATION is a plain `window.location.assign`, not `next/navigation`'s
  // `router.push`: `router.push` fired without throwing (confirmed via a
  // click that correctly resolved `inCard()` true) but never actually
  // changed the URL on this page — plausibly something in the scroll
  // machinery here (GSAP ScrollTrigger owns a lot of history/scroll state)
  // fights the App Router's client transition. A real navigation sidesteps
  // whatever that interaction is; the target is still an ordinary Next.js
  // route (`app/publications/page.tsx`), so this is still "the existing
  // routing system," just reached with a full navigation instead of a
  // client-side one.
  const pubCardRef = useRef<HTMLDivElement | null>(null);
  // The card's own INNER content wrapper (cover glow + HoverCard + the 3D
  // display), one level below the element the ring itself transforms every
  // scroll frame (`translate3d(...) rotateY(...)`, written fresh by React
  // on every render of `p`). GSAP animates THIS element instead of that
  // one: a CSS transform on a child composes with — rather than fights —
  // whatever the parent's own transform is doing, so the enlarge can run
  // without first silencing the scroll-driven ring underneath it.
  const pubInnerRef = useRef<HTMLDivElement | null>(null);
  // A whole-viewport cover the transition fades in behind the growing
  // card, so the cut to the freshly loaded /publications page (dark
  // itself) lands on a screen that is already most of the way there
  // rather than as a hard flash from the bright ring to black.
  const transitionOverlayRef = useRef<HTMLDivElement | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(false);
  const pubActiveRef = useRef(false);
  const pubActive = p > 0.02 && p < 0.98;
  useEffect(() => {
    pubActiveRef.current = pubActive;
  }, [pubActive]);

  useEffect(() => {
    const setHover = (on: boolean) => {
      pubCardRef.current?.style.setProperty("--pub-hover", on ? "1" : "0");
    };
    const inCard = (x: number, y: number) => {
      const el = pubCardRef.current;
      if (!el || !pubActiveRef.current) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setHover(inCard(e.clientX, e.clientY));
    };
    const onDocLeave = () => setHover(false);
    const onClick = (e: MouseEvent) => {
      // Guards against a second click starting a second timeline while the
      // first is still running — the visible symptom would be the card
      // snapping partway back before continuing, or two overlapping
      // navigations racing.
      if (transitioningRef.current) return;
      if (!inCard(e.clientX, e.clientY)) return;
      transitioningRef.current = true;
      setTransitioning(true);
      // GSAP's default lag smoothing hides a brief stall by freezing the
      // animation's own perceived clock, then resuming — meant to avoid a
      // jarring jump after a short tab-backgrounded pause. This page keeps
      // several WebGL canvases rendering (the bulb, the arc's own
      // publications display) that can legitimately hold the main thread
      // past the 500ms default threshold, and the freeze-then-jump that
      // was hiding is worse than the jump would have been: "nothing
      // happens for most of a second" reads as broken, not smooth.
      // Disabled so the timeline tracks real elapsed time throughout.
      gsap.ticker.lagSmoothing(0);
      const inner = pubInnerRef.current;
      const overlay = transitionOverlayRef.current;
      const tl = gsap.timeline({
        // The actual navigation. `router.push` fired without throwing from
        // this exact handler but never changed the URL — see the note
        // this replaced, still true, so this is still a real navigation to
        // the existing route rather than a client transition; it just now
        // fires once the enlarge has had its second, not the instant the
        // card is clicked.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        onComplete: () => window.location.assign("/publications"),
      });
      if (overlay) {
        tl.to(overlay, { opacity: 1, duration: 1, ease: "power2.inOut" }, 0);
      }
      if (inner) {
        tl.to(
          inner,
          {
            scale: 1.55,
            y: -18,
            duration: 1,
            ease: "power2.inOut",
            transformOrigin: "50% 50%",
          },
          0
        );
      }
      if (!overlay && !inner) tl.to({}, { duration: 1 });
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onDocLeave);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onDocLeave);
      window.removeEventListener("click", onClick);
    };
  }, []);

  const card = Math.min(
    CARD_MAX_PX,
    Math.max(CARD_MIN_PX, CARD_SHARE * Math.min(vw, vh))
  );
  const radius = card * RADIUS_IN_CARDS;
  const ringVh = centreVh - RING_LIFT_VH;

  // Which card index is at the front. Runs from before the first to past
  // the last, so both ends of the arc are empty frames.
  const rot = -ARC_LEAD + p * (ARC_CARD_COUNT - 1 + ARC_LEAD * 2);

  return (
    <div
      aria-hidden={p <= 0.01}
      style={{
        position: "absolute",
        inset: 0,
        // The ring is a real ring: the cards are placed in 3D and the
        // depth is the perspective's, not a hand-tuned scale ramp.
        perspective: `${(radius * 2).toFixed(0)}px`,
        perspectiveOrigin: `50% ${ringVh}vh`,
        // IN FRONT of the bulb. The pieces come forward and pass across
        // it; the bulb reads through the gaps between them and dims as
        // they arrive, which is what hands the light over.
        zIndex: 5,
        pointerEvents: p > 0.02 && p < 0.98 ? "auto" : "none",
        visibility: p <= 0.005 ? "hidden" : "visible",
        transformStyle: "preserve-3d",
      }}
    >
      {Array.from({ length: ARC_CARD_COUNT }, (_, i) => {
        const deg = (i - rot) * ARC_STEP_DEG;
        const absDeg = Math.abs(deg);
        if (absDeg >= FADE_END_DEG) return null;

        const rad = (deg * Math.PI) / 180;
        // On the ring, with the front of the ring pulled to z = 0 so the
        // card in focus sits in the picture plane and the rest fall back.
        const x = Math.sin(rad) * radius;
        const z = (Math.cos(rad) - 1) * radius;

        // A card leaves whichever way comes first: turning away, or
        // running out of frame.
        const outerEdge = Math.abs(x) + card / 2;
        const opacity = Math.min(
          1 - span(absDeg, FADE_START_DEG, FADE_END_DEG),
          1 - span(outerEdge, EDGE_FADE_START * vw, EDGE_FADE_END * vw)
        );
        if (opacity <= 0.001) return null;

        // A partial yaw: enough that the card reads as sitting on a ring,
        // not so much that the piece is seen edge-on and unreadable.
        const yaw = deg * 0.7;
        // Distance from the front, in cards — drives the glow.
        const dist = absDeg / ARC_STEP_DEG;

        const isPublications = i === PUBLICATIONS_INDEX;
        // The publications card's own light, before hover: it rides the same
        // `dist` the glow below already uses, so a piece turned away from the
        // reader is dimmer. The hover part is added inside the display, off
        // the same `--pub-hover` everything else here reads.
        const pubLuminance = Math.max(0.55, 1 - dist * 0.17);

        return (
          <div
            key={i}
            data-arc-card={i}
            // See MothLayer's own scan: the publications still life fills
            // this card to its edges, so the moth is not offered it as
            // somewhere to fly to or to settle on.
            data-moth={isPublications ? "ignore" : undefined}
            ref={isPublications ? pubCardRef : undefined}
            // HOVER IS A CUSTOM PROPERTY, NOT REACT STATE — same reasoning
            // as before (a re-render here would wipe HoverCard's own
            // imperative `active` class), but no longer written from this
            // element's own pointerenter/leave: see the geometry-based
            // window listener above, which sets `--pub-hover` on this ref
            // directly. Native hit-testing on THIS element, nested two
            // `perspective` contexts deep, was unreliable over roughly half
            // its own box.
            style={{
              position: "absolute",
              left: "50%",
              top: `${ringVh}vh`,
              width: card,
              height: card,
              marginLeft: -card / 2,
              marginTop: -card / 2,
              transform: `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${yaw.toFixed(2)}deg)`,
              opacity,
              // Above every other card while it grows, so it visibly
              // passes in front of its ring neighbours instead of the
              // stacking order it had mid-scroll fighting the enlarge.
              zIndex: isPublications && transitioning ? 1000 : 10 + Math.round(Math.cos(rad) * 100),
              willChange: "transform, opacity",
            }}
          >
            <div
              ref={isPublications ? pubInnerRef : undefined}
              style={{ position: "relative", borderRadius: 14 }}
            >
              {/* The same static, card-owned glow the strip uses:
                  brightest on the piece in focus, never cursor-driven.
                  Constant shadow on its own layer, faded rather than
                  re-blurred — nine 64px blurs recomputed per frame is
                  what the arc used to cost. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 14,
                  // The publications card is a lit display, so its own
                  // glow carries a little more spread and a trace of the
                  // warm the covers are lit with — the card looking like
                  // the source of the light falling on the objects inside
                  // it. Every other slot keeps the arc's neutral glow
                  // exactly as it was.
                  boxShadow: isPublications
                    ? "0 0 72px rgba(255,246,232,0.34), 0 0 26px rgba(255,238,214,0.16), 0 22px 60px rgba(0,0,0,0.72)"
                    : "0 0 64px rgba(255,255,255,0.3), 0 22px 60px rgba(0,0,0,0.72)",
                  opacity: isPublications
                    ? `calc(${Math.max(0.2, 1 - dist * 0.24).toFixed(3)} * (1 + 0.28 * var(--pub-hover, 0)))`
                    : Math.max(0.2, 1 - dist * 0.24),
                  willChange: "opacity",
                  pointerEvents: "none",
                  transition: isPublications
                    ? "opacity 420ms cubic-bezier(0.16,1,0.3,1)"
                    : undefined,
                }}
              />
              <HoverCard aspect={1} radius={14}>
                {isPublications ? (
                  /* THE PUBLICATIONS DISPLAY. The five real publications,
                     inside the card. It reads HoverCard's own pointer state
                     rather than installing a second one — see the note at
                     the top of PublicationsDisplay.
                     THE SURFACE ITSELF is deliberately NOT the arc's flat
                     "#16171c" plate every other slot uses: a solid near-
                     black panel behind lit 3D objects reads as a UI panel
                     with things placed on it, not as a lit display case
                     holding them. Two layers instead of one flat colour —
                     a translucent dark base (rgba, not opaque, so it never
                     reads as a hard slab) and a soft warm radial sitting
                     ABOVE it, brightest at the centre where the objects
                     stand and fading to the same dark toward the corners —
                     so the case looks lit from inside rather than merely
                     outlined by the glow around it. No blur, no
                     backdrop-filter: translucent is not the same thing as
                     frosted glass.
                     THE EDGE is a visibly traced line rather than a faint
                     hairline — an inset highlight on top of the border, so
                     the rounded rectangle itself reads as lit, matching a
                     display case's own edge lighting rather than a generic
                     card outline.
                     COLOUR SPLIT: this case-light stays close to neutral —
                     the WARM/yellow cast in this beat belongs to the bulb
                     glow behind the card (the boxShadow above, untouched),
                     not to the light falling on the publications
                     themselves; keeping the two separate is what lets the
                     bulb read as a dim warm pendant while the cover artwork
                     still reads in its own true colour. */
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                      background:
                        "linear-gradient(165deg, rgba(44,40,36,0.94) 0%, rgba(25,23,21,0.95) 55%, rgba(14,13,12,0.97) 100%)",
                      border: "1px solid rgba(255,250,240,0.22)",
                      boxShadow: "inset 0 0 0 1px rgba(255,250,240,0.07), inset 0 0 20px rgba(255,248,238,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    {/* The case's own inner light — brightest where the
                        publications stand, brightening a touch further on
                        hover, never bright enough to wash the artwork out.
                        Near-neutral (a hint of warmth, not the bulb's
                        yellow) so it lights the case without tinting the
                        covers. */}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(120% 95% at 50% 42%, rgba(250,248,244,0.14) 0%, rgba(244,240,234,0.06) 34%, rgba(240,236,228,0) 66%)",
                        opacity: "calc(0.7 + 0.3 * var(--pub-hover, 0))",
                        transition: "opacity 420ms cubic-bezier(0.16,1,0.3,1)",
                        pointerEvents: "none",
                      }}
                    />
                    <PublicationsDisplay luminance={pubLuminance} />
                  </div>
                ) : (
                  /* Neutral placeholder. Real work replaces the child. */
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
                      border: "1px solid rgba(255,255,255,0.13)",
                    }}
                  />
                )}
              </HoverCard>

              {isPublications && (
                /* THE LABEL. ReelStrip's own project-name block (see its
                   "THE HOVER INFO BLOCK" comment) is the source of truth
                   here, matched rather than approximated: identical
                   fontWeight, fontSize clamp, colour and textShadow;
                   identical position (bottom:100%, marginBottom 20),
                   identical 8px-rise-and-fade reveal, identical 240ms
                   easing on both opacity and transform. It reads as a
                   category tag rather than a title — PUBLICATIONS, not a
                   project name — so it keeps uppercase and a little
                   letter-spacing rather than copying the title's own
                   tight tracking verbatim; everything that actually sets
                   its PROMINENCE (size, weight, glow, timing, placement)
                   is the video cards' own numbers. Never in the layout,
                   so it cannot move the card. */
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "100%",
                    marginBottom: 20,
                    transform:
                      "translate(-50%, calc((1 - var(--pub-hover, 0)) * 8px))",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    pointerEvents: "none",
                    opacity: "var(--pub-hover, 0)",
                    transition: "opacity 240ms ease, transform 240ms ease",
                    zIndex: 3,
                    fontWeight: 600,
                    fontSize: "clamp(19px, 1.7vw, 28px)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#fff",
                    textShadow:
                      "0 0 1px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.24), 0 2px 22px rgba(0,0,0,0.55)",
                  }}
                >
                  Publications
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* THE TRANSITION COVER. Fixed rather than scoped to the ring, so it
          sits over the whole page (the bulb, the other cards, everything)
          while the clicked card grows in front of it — opacity 0 and
          non-interactive until a click starts the timeline above, which
          fades it in over the same second the card enlarges over. */}
      <div
        ref={transitionOverlayRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "#000",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
