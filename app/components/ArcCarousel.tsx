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

export const ARC_CARD_COUNT = 9;
// Angle between neighbouring cards on the ring. 9 x 30 = 270 degrees
// occupied, so 90 degrees of the ring stays empty: the gap that stops it
// reading as a loop.
const ARC_STEP_DEG = 30;
// How far past the ends the rotation runs, in cards. At 2.6 the first and
// the last card are both beyond the angular cull at the ends of the beat,
// so the arc opens and closes on an empty frame.
const ARC_LEAD = 2.6;

// The one measurement everything else follows from.
const CARD_SHARE = 0.3; // of the viewport's shorter side
const CARD_MIN_PX = 110;
const CARD_MAX_PX = 300;
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
 * comes on, holds while the arc is running, falls as the last leaves. The
 * caller dims the bulb by this.
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
        // Behind the bulb. The ring turns around it, and CSS cannot
        // interleave a sibling element into a 3D stacking context, so the
        // bulb stays the nearest object and the arc reads as swinging
        // past behind it — which is also what keeps the dimming visible.
        zIndex: 1,
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

        return (
          <div
            key={i}
            data-arc-card={i}
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
            <div
              style={{
                // The same static, card-owned glow the strip uses:
                // brightest on the piece in focus, never cursor-driven.
                boxShadow: `0 0 ${(64 - dist * 14).toFixed(0)}px rgba(255,255,255,${Math.max(
                  0.06,
                  0.3 - dist * 0.07
                ).toFixed(3)}), 0 22px 60px rgba(0,0,0,0.72)`,
                borderRadius: 14,
              }}
            >
              <HoverCard aspect={1} radius={14}>
                {/* Neutral placeholder. Real work replaces the child. */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background:
                      "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
                    border: "1px solid rgba(255,255,255,0.13)",
                  }}
                />
              </HoverCard>
            </div>
          </div>
        );
      })}
    </div>
  );
}
