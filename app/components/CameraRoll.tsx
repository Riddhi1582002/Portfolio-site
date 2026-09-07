"use client";

// REELS -> LAYERS, as a camera move.
//
// The cards do not move. They sit at the world positions the strip left
// them in — same order, same widths, same gaps, same vertical placement —
// and nothing in the scene is touched for the whole beat. What animates is
// the eye.
//
// A CSS 3D scene has no camera object, so the camera is expressed the only
// way it can be: the world carries the INVERSE of the camera's transform,
//
//     translateZ(dolly) · rotateX(-pitch) · rotateY(-yaw) · translate(-eye)
//
// read left to right as bring the eye to the origin, undo its heading and
// tilt, then stand back. Change pitch, yaw or the eye's position and the
// camera moves; nothing in the scene does.
//
// TWO MOVEMENTS
//
//   1. The eye rises, turns a quarter turn onto the run, and tilts DOWN
//      onto it — a top view. The row recedes away up the frame, and each
//      card shows its TOP edge as a white line. This is the beat that
//      reads as "the strip now runs up and down".
//
//   2. The eye levels off and closes in. Now it is looking straight along
//      the run: each card presents its SIDE, the nearest occludes the
//      seven behind it, and the thickness resolves into one thin white
//      vertical line, full height, centred.
//
// WHY NOT A CAMERA ROLL. Rolling the eye a quarter turn does make the run
// stand vertically — and then makes the ending impossible. A card seen
// edge on is already a tall thin sliver, so the roll lays that sliver on
// its side and the beat ends on a horizontal bar. Worse, after a roll the
// camera's up axis IS the run's axis, so the turn onto the run is a gimbal
// lock. Rise-and-tilt gives the same reading and leaves the ending intact.
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

// Where each movement runs, as a share of this beat's progress.
const SWING = [0, 0.52] as const;
const SETTLE = [0.5, 0.94] as const;
// Short of edge on, so the run is still legible as a row of cards
// standing on end before it collapses to the line.
const SWING_DEG = 74;

// How far the eye turns onto the run, and how far it tilts down onto it.
// The eye's rise, in card heights.
const RISE_RATIO = 0.42;

const PERSPECTIVE = 1700;
// Card thickness in world px — the line's width when seen edge on.
const THICK = 7;
// How far past the last card's outer edge the eye backs off before it is
// looking down the run.
const BACKOFF_PX = 260;

const EDGE_BG =
  "linear-gradient(to bottom, rgba(255,255,255,0.82) 0%, #fff 14%, #fff 86%, rgba(255,255,255,0.82) 100%)";
const EDGE_BG_H =
  "linear-gradient(to right, rgba(255,255,255,0.82) 0%, #fff 14%, #fff 86%, rgba(255,255,255,0.82) 100%)";

/** The on-screen width of the edge-on line, so the cord can match it. */
export function lineWidthPx(vh: number) {
  const cardH = (CARD_H_VH / 100) * vh;
  return THICK * ((vh * 1.06) / cardH);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export default function CameraRoll({
  progress,
  vw,
  vh,
}: {
  progress: number;
  vw: number;
  vh: number;
}) {
  const p = clamp01(progress);

  const { widths, centres } = layout(REELS);
  const toPx = (v: number) => (v / 100) * vh;
  const cardH = toPx(CARD_H_VH);

  const riseT = easeInOutSine(span(p, SWING[0], SWING[1]));
  const levelT = easeInOutSine(span(p, SETTLE[0], SETTLE[1]));

  // One axis. Adding a downward tilt to get a literal "top view" put the
  // eye above and past the run and the frame went black — see the note at
  // the head of this file about why the two readings cannot both hold.
  const yaw = SWING_DEG * riseT + (90 - SWING_DEG) * levelT;
  const pitch = 0;

  // The eye stays with the last card and backs off past its outer edge, so
  // once it has turned it is looking straight down the run with that card
  // nearest and the seven behind it occluded.
  //
  // It must not pan to the middle of the run: the run is several times
  // longer than the perspective depth, so an eye standing in the middle of
  // it has cards on both sides at depths the projection cannot resolve.
  const last = centres.length - 1;
  const startX = toPx(centres[last]);
  const endX = toPx(centres[last] + widths[last] / 2) + BACKOFF_PX;
  // The back-off belongs to the RISE, not the level-off: during the top
  // view the eye has to be behind and above the run's end so the whole row
  // recedes away up the frame. Leaving it at the last card's centre put
  // the eye inside that card and the top view was one slab filling frame.
  const camX = startX + (endX - startX) * levelT;

  // Where the strip sits vertically, then the rise, then back to level.
  const camY0 = -((STRIP_CENTRE_VH - 50) / 100) * vh;
  const camY = (camY0 - cardH * RISE_RATIO * riseT) * (1 - levelT);

  // Pull the scene forward until the nearest card's side runs the full
  // height of the frame. At depth BACKOFF the card renders at
  // P / (P - (dolly - BACKOFF)), so solve that for the height we want.
  const targetScale = (vh * 1.06) / cardH;
  const dollyEnd = BACKOFF_PX + PERSPECTIVE * (1 - 1 / targetScale);
  const dolly = dollyEnd * levelT;

  // The edges only glow once the eye has actually turned. A box-shadow
  // paints even when its element projects to zero width, so an ungated one
  // bled a halo down every card while the camera was still square on.
  const turned = clamp01((Math.abs(yaw) + Math.abs(pitch) - 5) / 30);
  const edgeGlow =
    turned <= 0.001
      ? "none"
      : `0 0 ${(24 * turned).toFixed(1)}px rgba(255,255,255,${(0.32 * turned).toFixed(3)})`;

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
          transform: `translate3d(0px, 0px, ${dolly.toFixed(2)}px) rotateX(${(-pitch).toFixed(
            3
          )}deg) rotateY(${(-yaw).toFixed(3)}deg) translate3d(${(-camX).toFixed(
            2
          )}px, ${(-camY).toFixed(2)}px, 0px)`,
          willChange: "transform",
        }}
      >
        {REELS.map((reel, i) => {
          const w = toPx(widths[i]);
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
              {/* The face. Identical to the strip's own card, so there is
                  nothing to cross-fade when this beat takes over. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: CARD_RADIUS,
                  background: CARD_FACE_BG,
                  border: CARD_FACE_BORDER,
                  transform: `translateZ(${THICK / 2}px)`,
                  backfaceVisibility: "hidden",
                }}
              />
              {/* TOP edge — the one the first movement is about. Seen from
                  above, this is the white line along each card. */}
              <div
                style={edge(
                  {
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: THICK,
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
                    height: THICK,
                    transformOrigin: "center bottom",
                    transform: "rotateX(-90deg)",
                  },
                  true
                )}
              />
              {/* SIDE edges — the ones that stack into the final line. */}
              <div
                style={edge({
                  left: 0,
                  top: 0,
                  width: THICK,
                  height: "100%",
                  transformOrigin: "left center",
                  transform: "rotateY(-90deg)",
                })}
              />
              <div
                style={edge({
                  right: 0,
                  top: 0,
                  width: THICK,
                  height: "100%",
                  transformOrigin: "right center",
                  transform: "rotateY(90deg)",
                })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
