"use client";

// REELS -> LAYERS, as a camera move.
//
// The cards do not move. They sit at the world positions the strip left
// them in — same order, same widths, same gaps — facing the camera, and
// every frame of this beat is the same eight boxes seen from somewhere
// else. What animates is the eye.
//
// A CSS 3D scene has no camera object, so the camera is expressed the only
// way it can be: the world carries the INVERSE of the camera's transform.
// A camera at position p with orientation R means the scene is drawn with
//
//     translateZ(dist) · Rz(-roll) · Ry(-orbit) · translate(-p)
//
// which is read left to right as: bring the camera to the origin, undo its
// orientation, then stand back. Change `roll`, `orbit` or `p` and the eye
// moves; nothing in the scene is touched.
//
// Two movements:
//
//   swing  — the eye rotates about the world's up axis, away from square
//            on. The run stops spanning the frame and compresses toward a
//            tall narrow band: the strip, read vertically. The eye rises
//            at the same time, because the last card has nothing past its
//            outer edge and the frame would otherwise open onto space.
//   settle — the eye finishes the quarter turn and closes in. Every card
//            now presents its side, they stack one behind another, and
//            their thickness resolves into a single thin line running the
//            full height of the frame.
//
// There is deliberately NO camera roll. An earlier version rolled the eye
// a quarter turn to make the run "look vertical", which worked — and then
// cancelled itself: a card seen edge on is already a tall thin sliver, so
// rolling the eye 90 degrees laid that sliver on its side and the beat
// ended on a horizontal bar. The swing alone gives both readings.
//
// The line's own geometry is never drawn: it IS the cards, seen edge on.

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
// How far round the first movement goes. Short of edge on, so the run is
// still legible as a row of cards standing on end.
const SWING_DEG = 74;

// The eye's rise during the roll, as a share of a card's height.
const RISE_RATIO = 0.42;
// Card thickness in world px — the line's width when seen edge on.
const THICK = 7;
// How far past the last card's outer edge the eye backs off before it is
// looking down the run.
const BACKOFF_PX = 260;
const SIDE_BG =
  "linear-gradient(to bottom, rgba(255,255,255,0.86) 0%, #fff 12%, #fff 88%, rgba(255,255,255,0.86) 100%)";

/** The on-screen width of the edge-on line, so the cord can match it. */
export function lineWidthPx(vh: number) {
  const cardH = (CARD_H_VH / 100) * vh;
  return THICK * ((vh * 1.02) / cardH);
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

  const { widths, centres, total } = layout(REELS);
  const toPx = (v: number) => (v / 100) * vh;
  const cardH = toPx(CARD_H_VH);

  // Perspective depth. Fixed, because it sets how strong the foreshortening
  // is, not where the eye is — the eye's distance is the dolly below.
  const PERSPECTIVE = 1700;

  const swingT = easeInOutSine(span(p, SWING[0], SWING[1]));
  const settleT = easeInOutSine(span(p, SETTLE[0], SETTLE[1]));

  const orbit = SWING_DEG * swingT + (90 - SWING_DEG) * settleT;
  // 0 while square on, 1 once the eye has turned far enough for the side
  // faces to have any width on screen at all.
  const turned = clamp01((orbit - 6) / 26);
  const edgeGlow =
    turned <= 0.001
      ? "none"
      : `0 0 ${(26 * turned).toFixed(1)}px rgba(255,255,255,${(0.35 * turned).toFixed(3)})`;
  // Pan: the eye is square on to card 0 where the strip left it, and
  // tracks along the run as it swings so it ends up level with the middle
  // of the row rather than off its end. It also rises during the roll,
  // because the last card has nothing past its outer edge.
  // The eye opens where REELS left it — square on to the LAST card, not
  // the first. That is also the card the brief is about: it has nothing
  // past its outer edge, which is why the eye rises during the roll.
  // The eye stays with the last card and then backs off PAST its outer
  // edge, so once it has turned it is looking straight down the run with
  // that card nearest. The seven behind it are occluded by it, which is
  // what makes the eight cards read as one line rather than eight.
  //
  // It must not pan to the middle of the run: the run is several times
  // longer than the perspective depth, so an eye standing in the middle of
  // it has cards on both sides at depths the projection cannot resolve.
  const last = centres.length - 1;
  const startX = toPx(centres[last]);
  // The eye ends aligned with the near SIDE face — the card's outer edge,
  // not its centre — because that face is the line. Aiming at the card's
  // centre left the finished line half a card's thickness off axis.
  const endX = toPx(centres[last] + widths[last] / 2) + BACKOFF_PX;
  const camX = startX + (endX - startX) * settleT;
  // Where the strip sits vertically. Without this the row would open at
  // the middle of the frame rather than where REELS left it.
  const camY0 = -((STRIP_CENTRE_VH - 50) / 100) * vh;
  // Rises through the swing, then comes back to level as the eye settles,
  // so the finished line is centred vertically rather than hanging low.
  const camY = (camY0 - cardH * RISE_RATIO * swingT) * (1 - settleT);
  // The dolly is how far the scene is pulled TOWARD the eye. Zero at the
  // start, so the cards open at exactly the size the strip handed over;
  // positive as the eye swings in, so the edge-on line runs the full
  // height of the frame instead of sitting as a short dash in the middle.
  // scale = P / (P - dolly), so this lands a little under 2x.
  // Pull the scene forward until the nearest card's side runs the full
  // height of the frame. At depth BACKOFF the card renders at
  // P / (P - (dolly - BACKOFF)), so solve that for the height we want.
  const targetScale = (vh * 1.06) / cardH;
  const dollyEnd = BACKOFF_PX + PERSPECTIVE * (1 - 1 / targetScale);
  const dolly = dollyEnd * settleT;

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
          // The camera's inverse. Read left to right: stand back, undo the
          // roll, undo the orbit, bring the eye to the origin.
          transform: `translate3d(0px, 0px, ${dolly.toFixed(2)}px) rotateY(${(-orbit).toFixed(
            3
          )}deg) translate3d(${(-camX).toFixed(2)}px, ${(-camY).toFixed(2)}px, 0px)`,
          willChange: "transform",
        }}
      >
        {REELS.map((reel, i) => {
          const w = toPx(widths[i]);
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
              {/* front face */}
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
              {/* the side the camera ends up looking at. White, because
                  edge on this is the line. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: THICK,
                  height: "100%",
                  transformOrigin: "left center",
                  transform: `rotateY(-90deg) translateZ(${THICK / 2}px)`,
                  background: SIDE_BG,
                  // Scaled by the turn. A box-shadow paints even when its
                  // element projects to zero width, so a fixed one bled a
                  // thick white halo down both sides of every card while
                  // the camera was still square on — edges that are meant
                  // to exist only from the side, visible head on.
                  boxShadow: edgeGlow,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: THICK,
                  height: "100%",
                  transformOrigin: "right center",
                  transform: `rotateY(90deg) translateZ(${THICK / 2}px)`,
                  background: SIDE_BG,
                  // Scaled by the turn. A box-shadow paints even when its
                  // element projects to zero width, so a fixed one bled a
                  // thick white halo down both sides of every card while
                  // the camera was still square on — edges that are meant
                  // to exist only from the side, visible head on.
                  boxShadow: edgeGlow,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
