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

import HoverCard from "./HoverCard";
import PublicationsDisplay from "./PublicationsDisplay";

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
            // HOVER IS A CUSTOM PROPERTY, NOT REACT STATE.
            //
            // Keeping it in state re-rendered this component on every enter
            // and leave, and a re-render rewrites `className` on the card
            // below — which silently wiped the `active` class HoverCard adds
            // imperatively, so the site's own pointer tilt stopped working on
            // this one card the moment a pointer touched it. Written straight
            // onto the element instead, exactly the way HoverCard writes its
            // own `--pointer-from-*`, nothing re-renders and nothing is
            // clobbered: the label and the glow below read it through
            // `var()`, and the 3D display reads it in its render loop.
            {...(isPublications
              ? {
                  onPointerEnter: (e: React.PointerEvent<HTMLDivElement>) => {
                    if (e.pointerType !== "mouse") return;
                    e.currentTarget.style.setProperty("--pub-hover", "1");
                  },
                  onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => {
                    e.currentTarget.style.setProperty("--pub-hover", "0");
                  },
                }
              : null)}
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
              zIndex: 10 + Math.round(Math.cos(rad) * 100),
              willChange: "transform, opacity",
            }}
          >
            <div style={{ position: "relative", borderRadius: 14 }}>
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
                     the top of PublicationsDisplay. The plate behind it is
                     the same one every other slot shows, so the objects
                     stand against the arc's own surface rather than a
                     hole. */
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                      background:
                        "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
                      border: "1px solid rgba(255,255,255,0.13)",
                    }}
                  >
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
                /* THE LABEL. Above the card, in the same reveal language the
                   video cards use for their project names — anchored to this
                   card's own top edge, growing upward into clear space, an
                   8px rise and a 240ms fade, hidden entirely until hovered.
                   Set as a category rather than a title, so it is smaller
                   than a project name and tracked out; nothing else is said.
                   Never in the layout, so it cannot move the card. */
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "100%",
                    marginBottom: 18,
                    transform:
                      "translate(-50%, calc((1 - var(--pub-hover, 0)) * 8px))",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    pointerEvents: "none",
                    opacity: "var(--pub-hover, 0)",
                    transition: "opacity 240ms ease, transform 240ms ease",
                    zIndex: 3,
                    fontWeight: 600,
                    fontSize: "clamp(11px, 0.85vw, 14px)",
                    letterSpacing: "0.22em",
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
    </div>
  );
}
