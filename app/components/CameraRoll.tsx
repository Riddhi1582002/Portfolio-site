"use client";

// REELS -> LAYERS, as a camera move.
//
// The cards do not move. They sit at the world positions the strip left
// them in — same order, same widths, same gaps, same vertical placement —
// and no card is translated, rotated or resized for the whole beat. What
// animates is the eye.
//
// THE MOVE, in two parts, exactly as specified:
//
//   MOVE 1 — ROLL. The camera spins about its own line of sight (its Z),
//   like tilting your head sideways. Its position and its facing do not
//   change; only its "up" rotates. The spin happens entirely in the image
//   plane, so the horizontal row becomes a vertical column. The cards
//   never move — the frame turns around them.
//
//   MOVE 2 — YAW. The camera swings sideways around the cards, rotating
//   about its own vertical axis, from facing them head on to looking along
//   their surface. A card is nearly flat, so once you are looking down its
//   plane instead of at its face only the thin edge is left: the column
//   collapses to a line.
//
// A CSS 3D scene has no camera object, so the eye is expressed the only
// way it can be: the world carries the INVERSE of the camera's transform.
// The camera rolls first and then yaws about the axis the roll left it
// with, i.e. C = T(eye) . Rz(roll) . Ry(yaw), so the world is drawn with
//
//     translateZ(dolly) . rotateY(-yaw) . rotateZ(-roll) . translate(-eye)
//
// read left to right as: bring the eye to the origin, undo the roll, undo
// the yaw, then stand off.
//
// WHY THE TWO MOVES DO NOT FIGHT. After the roll the row runs down the
// screen's Y. rotateY leaves screen Y alone, so the yaw cannot un-do the
// column; all it does is take the card's remaining on-screen width — which
// after the roll is the card's HEIGHT — and turn it into depth. What is
// left is the card's top edge: a band whose width is the card's thickness
// and whose length is the run. A vertical white line.
//
// The line is uniform because that top edge lies at a single depth: every
// point of it projects at the same scale, so there is no taper to hide.
//
// EVERY edge face carries backface culling. Without it the far side of the
// box renders straight through the card, so the moment the eye turned even
// slightly you saw a thick white bar down BOTH sides of every card — edges
// that should only ever be visible one at a time.

import {
  REELS,
  layout,
  CARD_H_VH,
  STRIP_CENTRE_VH,
  CARD_FACE_BG,
  CARD_FACE_BORDER,
  CARD_RADIUS,
} from "./ReelStrip";
import { carry, easeInOutSine as baseEaseInOutSine, easeOutCubic } from "../lib/motion";

// Where each move runs, as a share of this beat's progress. They meet with
// a small overlap so the yaw begins as the roll is settling, and the yaw
// is finished before the cord takes over at 0.94.
const ROLL_SPAN = [0, 0.5] as const;
const YAW_SPAN = [0.46, 0.94] as const;

// Roll about the line of sight, then yaw about the camera's own vertical.
// The roll's sign puts the later cards LOWER, so the column reads as
// continuing downward into the cord; the yaw's sign leaves the camera
// above the run, looking down on the cards' top edges.
const ROLL_DEG = -90;
const YAW_DEG = 90;

const PERSPECTIVE = 1700;

// How much bigger than life the top edge is once the camera is on it.
// It has to be over 1.104 or the longest card stops short of filling the
// frame and the gaps between pieces show up as breaks in the line.
const SCALE_END = 1.24;

// The finished line's width on screen, as a share of viewport height, and
// a floor so it never disappears on a short phone.
const LINE_W_VH = 0.72;
const LINE_W_MIN_PX = 3.2;

const EDGE_BG =
  "linear-gradient(to bottom, rgba(255,255,255,0.82) 0%, #fff 14%, #fff 86%, rgba(255,255,255,0.82) 100%)";
const EDGE_BG_H =
  "linear-gradient(to right, rgba(255,255,255,0.82) 0%, #fff 14%, #fff 86%, rgba(255,255,255,0.82) 100%)";

/** The on-screen width of the edge-on line, so the cord can match it. */
export function lineWidthPx(vh: number) {
  return Math.max(LINE_W_MIN_PX, (LINE_W_VH / 100) * vh);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

// THE TWO MOVES, EASED SO THEY DO NOT STOP BETWEEN THEMSELVES.
//
// Both were plain easeInOutSine, which begins and ends at zero speed. The
// roll therefore braked to a standstill, the yaw started again from one,
// and the yaw in turn braked to a standstill before the cord took over —
// three separate turns of the head rather than one continuous move,
// despite the spans already overlapping. Sliced off their own flat ends
// the two overlap in SPEED as well as in time: the roll is still turning
// at about half its average rate when the yaw is already turning at about
// half of its, and the yaw is still turning when the line hands over to
// the cord and the descent (already under way) takes the momentum on.
//
// Both still land on exactly 1, so the roll is exactly -90 degrees and the
// yaw exactly 90: the geometry the line depends on is untouched.
const rollEase = carry(baseEaseInOutSine, 0.12, 0.86);
const yawEase = carry(baseEaseInOutSine, 0.14, 0.9);

// HOW MUCH OF THE STRIP'S OWN FRAME THIS BEAT STILL CARRIES.
//
// The cards' world positions already matched the strip's exactly — but
// their PRESENTATION did not, and the eye reads presentation. The strip
// steps its neighbours back to 32% opacity, prints the piece's title and
// meta in the clear top third, glows each card, and lets the frame fall
// into black at both edges. None of that existed here, so on the single
// frame this beat took over, six cards jumped to full brightness, the
// title vanished and both edges of the frame opened up — a hard cut
// dressed as a continuation.
//
// So the beat OPENS on the strip's frame, exactly, and lets that
// presentation dissolve as the eye turns: seen edge-on there is no near
// card, no far card and no frame edge to fall away into, so it has to go —
// but it goes as part of the camera move rather than instead of it. Gone
// well before the yaw starts collapsing the column into a line.
const CHROME_END = 0.42;

/**
 * A soft, layered halo: a tight core, a near falloff and a wide, cool
 * outer wash. One big blur reads as a smudge; stacking them reads as
 * light. `t` fades the whole thing in.
 */
export function lineGlow(t: number, spread = 1) {
  if (t <= 0.001) return "none";
  const a = (v: number) => (v * t).toFixed(3);
  const r = (v: number) => (v * spread).toFixed(1);
  return [
    `0 0 ${r(2)}px rgba(255,255,255,${a(0.9)})`,
    `0 0 ${r(9)}px rgba(255,255,255,${a(0.42)})`,
    `0 0 ${r(26)}px rgba(226,238,255,${a(0.2)})`,
    `0 0 ${r(72)}px rgba(190,214,255,${a(0.1)})`,
  ].join(", ");
}

export default function CameraRoll({
  progress,
  vh,
}: {
  progress: number;
  // Accepted so the caller can pass its measured viewport in one shape;
  // every distance in this beat is in vh, so the width is not used.
  vw?: number;
  vh: number;
}) {
  const p = clamp01(progress);

  const { widths, centres } = layout(REELS);
  const toPx = (v: number) => (v / 100) * vh;
  const cardH = toPx(CARD_H_VH);

  const rollT = rollEase(span(p, ROLL_SPAN[0], ROLL_SPAN[1]));
  const yawT = yawEase(span(p, YAW_SPAN[0], YAW_SPAN[1]));
  const chrome = 1 - easeOutCubic(span(p, 0, CHROME_END));

  const roll = ROLL_DEG * rollT;
  const yaw = YAW_DEG * yawT;

  // The card's thickness in world px. Solved backwards from the width the
  // line is supposed to end up at, so the cord's width and the camera's
  // are the same number by construction rather than by tuning.
  const thick = lineWidthPx(vh) / SCALE_END;

  // Where the eye stands.
  //
  // It does NOT pan along the run: the camera holds the piece the strip
  // left in focus, and after the roll that piece's top edge is what fills
  // the frame — which is why no gap between pieces is ever in shot.
  const last = centres.length - 1;
  const camX = toPx(centres[last]);
  const focused = REELS[last];
  // The strip sits low in the frame; the eye is above centre by exactly
  // that much and comes back to level through the yaw, so the finished
  // line runs down the middle.
  const camY0 = -((STRIP_CENTRE_VH - 50) / 100) * vh;
  const camY = camY0 * (1 - yawT);
  // Once the camera is on the edge, the card's thickness is what spans the
  // screen horizontally; offsetting the eye by half of it centres the
  // band instead of hanging it off one side.
  const camZ = (thick / 2) * yawT;

  // Stand off far enough that the top edge projects at SCALE_END. After
  // the yaw that edge sits at depth (cardH / 2 + dolly), so solve for it.
  const dollyEnd = PERSPECTIVE * (1 - 1 / SCALE_END) - cardH / 2;
  const dolly = dollyEnd * yawT;

  // The edges only glow once the eye has actually turned. A box-shadow
  // paints even when its element projects to zero width, so an ungated one
  // bled a halo down every card while the camera was still square on.
  const turned = clamp01((Math.abs(roll) + Math.abs(yaw) - 5) / 30);
  const edgeGlow = lineGlow(0.55 * turned);

  // The face is a plane, so at the end of the yaw it is exactly edge on:
  // zero area, except for the sliver perspective gives it, which paints a
  // dark hairline up the middle of the white band. It is invisible well
  // before then, so it is faded out over the last few degrees.
  const faceOpacity = 1 - clamp01((Math.abs(yaw) - 76) / 14);

  return (
    <div
      data-camera-roll
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        perspective: `${PERSPECTIVE}px`,
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        data-camera-world
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          // C-inverse: undo the roll, then the yaw, then stand off.
          transform: `translate3d(0px, 0px, ${dolly.toFixed(2)}px) rotateY(${(-yaw).toFixed(
            3
          )}deg) rotateZ(${(-roll).toFixed(3)}deg) translate3d(${(-camX).toFixed(
            2
          )}px, ${(-camY).toFixed(2)}px, ${(-camZ).toFixed(2)}px)`,
          willChange: "transform",
        }}
      >
        {REELS.map((reel, i) => {
          const w = toPx(widths[i]);
          // ReelStrip's own two expressions, at the focus it handed over
          // (the last piece), released to 1 as `chrome` falls away.
          const distance = last - i;
          const dim = Math.max(0.32, 1 - distance * 0.34);
          const glow = Math.max(0.25, 1 - distance * 0.32);
          // Every edge is the same slab of white; which one you see is
          // decided by backface culling and by where the eye is, not by
          // anything animating.
          const edge = (
            extra: React.CSSProperties,
            horizontal = false
          ): React.CSSProperties => ({
            position: "absolute",
            background: horizontal ? EDGE_BG_H : EDGE_BG,
            boxShadow: edgeGlow,
            backfaceVisibility: "hidden",
            ...extra,
          });

          return (
            <div
              key={reel.id}
              data-roll-card={i}
              style={{
                position: "absolute",
                left: toPx(centres[i]) - w / 2,
                top: -cardH / 2,
                width: w,
                height: cardH,
                transformStyle: "preserve-3d",
              }}
            >
              {/* The strip's own glow layer, on the face's plane. Constant
                  shadow, faded — never re-blurred. */}
              {chrome > 0.001 && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: CARD_RADIUS,
                    boxShadow:
                      "0 0 46px rgba(255,255,255,0.2), 0 24px 70px rgba(0,0,0,0.7)",
                    transform: `translateZ(${(thick / 2).toFixed(2)}px)`,
                    opacity: glow * chrome,
                    backfaceVisibility: "hidden",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* The face. Identical to the strip's own card, so there is
                  nothing to cross-fade when this beat takes over. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: CARD_RADIUS,
                  background: CARD_FACE_BG,
                  border: CARD_FACE_BORDER,
                  transform: `translateZ(${(thick / 2).toFixed(2)}px)`,
                  backfaceVisibility: "hidden",
                  // The strip's step-back, released by the roll. It is on
                  // the FACE and not on the card wrapper on purpose: an
                  // opacity below 1 forces `transform-style: flat` on the
                  // element it is set on, and the wrapper is the
                  // preserve-3d container holding the four edge planes —
                  // dimming it there would collapse the card's own 3D box
                  // into its face. The face and the glow are coplanar, so
                  // they can carry it; the edges are invisible for the
                  // whole stretch `chrome` is non-zero anyway, since the
                  // yaw that reveals them does not start until 0.46.
                  opacity: faceOpacity * (1 - (1 - dim) * chrome),
                  willChange: chrome > 0.001 ? "opacity" : "auto",
                }}
              />
              {/* TOP edge — the one the yaw arrives at. Looking down the
                  card's plane, this band IS the line. */}
              <div
                style={edge(
                  {
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: thick,
                    transformOrigin: "center top",
                    transform: "rotateX(90deg)",
                  },
                  true
                )}
              />
              {/* Bottom edge, for completeness when the eye is below. */}
              <div
                style={edge(
                  {
                    left: 0,
                    bottom: 0,
                    width: "100%",
                    height: thick,
                    transformOrigin: "center bottom",
                    transform: "rotateX(-90deg)",
                  },
                  true
                )}
              />
              {/* Side edges — the card's short ends. */}
              <div
                style={edge({
                  left: 0,
                  top: 0,
                  width: thick,
                  height: "100%",
                  transformOrigin: "left center",
                  transform: "rotateY(-90deg)",
                })}
              />
              <div
                style={edge({
                  right: 0,
                  top: 0,
                  width: thick,
                  height: "100%",
                  transformOrigin: "right center",
                  transform: "rotateY(90deg)",
                })}
              />
            </div>
          );
        })}
      </div>

      {/* THE STRIP'S OWN FRAME FURNITURE, continued into this beat and
          released by the same `chrome`. These are the strip's exact values
          — its details block sits at STRIP_CENTRE_VH - CARD_H_VH/2 - 14,
          its edges carry these two gradients — so the frame this beat
          opens on is the frame the previous one ended on, down to the
          black falling away at the sides. */}
      {chrome > 0.001 && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${STRIP_CENTRE_VH - CARD_H_VH / 2 - 14}vh`,
              textAlign: "center",
              pointerEvents: "none",
              opacity: chrome,
              willChange: "opacity",
            }}
          >
            <div
              style={{
                fontWeight: 500,
                fontSize: "clamp(18px, 1.6vw, 26px)",
                letterSpacing: "0.01em",
                color: "#fff",
                textShadow: "0 0 22px rgba(255,255,255,0.28)",
              }}
            >
              {focused.title}
            </div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 300,
                fontSize: "clamp(12px, 0.95vw, 15px)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {focused.meta}
            </div>
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: chrome,
              willChange: "opacity",
              background:
                "linear-gradient(to left, #000 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0) 22%)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: chrome,
              willChange: "opacity",
              background:
                "linear-gradient(to right, #000 0%, rgba(0,0,0,0.7) 4%, rgba(0,0,0,0) 16%)",
            }}
          />
        </>
      )}
    </div>
  );
}
