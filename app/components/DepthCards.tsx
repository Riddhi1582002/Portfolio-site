"use client";

// The eight pieces: they come forward out of the depths behind the A,
// spread into a row, and that row pushes in to become the strip.
//
// ONE MOVE, NOT TWO.
//
// This used to hand REELS an assembled-but-pulled-back row and let REELS
// push it in, which meant you saw the strip form, then saw it form again.
// The whole move lives here now and REELS opens at rest:
//
//   arrive  — the cards travel forward on Z while the camera is still
//             inside the A. They are BEHIND the letter, so the wordmark
//             passes over them as it leaves.
//   spread  — the fan opens into the row, card by card.
//   push    — the row comes up to full size and lands exactly on
//             ReelStrip's steady frame.
//
// The strip pose is computed from ReelStrip's own layout function rather
// than copied, so the two cannot drift apart.

import { useEffect, useState, type CSSProperties } from "react";
import NarrationLine from "./NarrationLine";
import {
  REELS,
  layout,
  CARD_H_VH,
  STRIP_CENTRE_VH,
  CARD_FACE_BG,
  CARD_FACE_BORDER,
  CARD_RADIUS,
} from "./ReelStrip";
import {
  NARRATION_COLOR,
  NARRATION_FONT_SIZE,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

const CARD_COUNT = REELS.length;

// The fan, in px on a 1440-wide reference frame and scaled from there.
const REF_VW = 1440;
const FRONT_W = 505;
// Step back and to the left, per card. Tighter than a fanned deck: in the
// reference only a narrow sliver of each card behind shows.
const STEP_X = -74;
const STEP_Z = -128;
const STEP_Y = -5;
// Shared yaw. Positive brings each card's LEFT edge toward the camera,
// which is the face the light catches in the reference.
const YAW_DEG = 30;
// A touch of tilt, so the row is read from very slightly above rather
// than dead level — the receding bottom edges in the reference.
const PITCH_DEG = -3.5;
const THICK = 24;
const FAN_CX = 0.58;
const FAN_CY = 0.52;

// The arrival is staggered per card; so is the spread, which is what
// stops the fan snapping into a row in one block.
const ARRIVE_STAGGER = 0.055;
// Small on purpose. A wide stagger left one card still sweeping across
// its neighbour after that neighbour had settled, which is the crossing
// that read as a glitch mid-spread.
const SPREAD_STAGGER = 0.026;
// The spread is the whole of `arrange` now.
const SPREAD_END = 1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export default function DepthCards({
  progress,
  arrange = 0,
  sans,
}: {
  /** 0 = far back and unseen, 1 = fully arrived in the fan. */
  progress: number;
  /** 0 = the fan, 1 = ReelStrip's steady frame. */
  arrange?: number;
  sans: string;
}) {
  const lead = clamp01(progress);
  const arr = clamp01(arrange);
  const [vp, setVp] = useState({ vw: 1440, vh: 900 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const read = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const { vw, vh } = vp;
  const k = vw / REF_VW;

  // --- the strip pose, straight out of ReelStrip's own maths -------------
  const { widths, centres } = layout(REELS);
  const toPx = (v: number) => (v / 100) * vh;
  const stripOffset = vw / 2 - toPx(centres[0]);
  const stripTop = toPx(STRIP_CENTRE_VH);
  const stripH = toPx(CARD_H_VH);

  const hoverable = arr < 0.02 && lead > 0.85;

  return (
    <div
      aria-hidden={lead < 0.05}
      style={{
        position: "absolute",
        inset: 0,
        // BEHIND the wordmark. The cards are already travelling forward
        // while the camera is still inside the A, and the letter passes
        // over them on its way out of frame.
        zIndex: 0,
        pointerEvents: "none",
        // No visibility gate: each card's own opacity already reaches
        // exactly 0 at lead = 0 (easeOutCubic(0)), so there is nothing to
        // hide. The old `lead <= 0.01` cutoff flipped the whole stack
        // from unrendered straight to ~5% opacity in one frame — a real,
        // if small, pop right as the push begins.
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${1400 * k}px`,
          perspectiveOrigin: `${FAN_CX * 100}% ${FAN_CY * 100}%`,
          transformStyle: "preserve-3d",
        }}
      >
        {Array.from({ length: CARD_COUNT }, (_, i) => {
          const arrive = easeOutCubic(
            clamp01((lead - i * ARRIVE_STAGGER) / (1 - ARRIVE_STAGGER * (CARD_COUNT - 1)))
          );
          // The front card leads the spread and the back of the fan
          // follows, so the row assembles rather than snapping.
          const spread = easeInOutCubic(
            clamp01(
              (arr / SPREAD_END - i * SPREAD_STAGGER) /
                (1 - SPREAD_STAGGER * (CARD_COUNT - 1))
            )
          );

          // --- fan pose ---
          const fw = FRONT_W * k;
          const fh = fw * (9 / 16);
          const fx = FAN_CX * vw - fw / 2 + i * STEP_X * k;
          const fy = FAN_CY * vh - fh / 2 + i * STEP_Y * k;
          const fz = i * STEP_Z * k - 2600 * k * (1 - arrive);

          // --- strip pose ---
          // Portrait pieces do not squash: the card TURNS a quarter turn,
          // so its bounding box becomes the portrait box the strip wants.
          const portrait = REELS[i].ratio < 1;
          const pwBox = toPx(widths[i]);
          const rawX = stripOffset + toPx(centres[i]) - pwBox / 2;
          const rawY = stripTop - stripH / 2;
          // Straight to the strip's own frame: card 0 holds the size it
          // will keep, card 1's left edge shows at the right of the frame,
          // and the rest simply leave. There is no assembled-row stop on
          // the way — that stop WAS the second strip.
          const boxX = rawX;
          const boxY = rawY;
          const boxW = pwBox;
          const boxH = stripH;
          const elW = portrait ? stripH : pwBox;
          const elH = portrait ? pwBox : stripH;
          const px = boxX + boxW / 2 - elW / 2;
          const py = boxY + boxH / 2 - elH / 2;
          const stripDim = Math.max(0.32, 1 - i * 0.34);

          // --- blend ---
          const hovered = hover === i && hoverable;
          const w = mix(fw, elW, spread);
          const h = mix(fh, elH, spread);
          const x = mix(fx, px, spread);
          const y = mix(fy, py, spread);
          const z = mix(fz, 0, spread) + (hovered ? 80 * k : 0);
          const yaw = mix(YAW_DEG, 0, spread);
          const pitch = mix(PITCH_DEG, 0, spread);
          const roll = mix(0, portrait ? 90 : 0, spread);
          const thick = Math.max(0.01, mix(THICK * k, 0, spread));
          const opacity = mix(arrive, stripDim, spread);
          // The front of the fan is lit; the ones behind fall away. That
          // contrast is most of what makes the reference read as depth.
          const litFan = 1 - Math.min(0.62, i * 0.11);
          const lit = mix(litFan, 1, spread) * (hovered ? 1.45 : 1);

          const wrap: CSSProperties = {
            position: "absolute",
            left: 0,
            top: 0,
            width: w,
            height: h,
            transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(
              2
            )}px) rotateY(${yaw.toFixed(2)}deg) rotateX(${pitch.toFixed(
              2
            )}deg) rotateZ(${roll.toFixed(2)}deg)`,
            transformStyle: "preserve-3d",
            opacity,
            filter: `brightness(${lit.toFixed(3)})`,
            willChange: "transform, opacity",
            pointerEvents: hoverable ? "auto" : "none",
            // Short, so the lift answers the pointer rather than trailing
            // it. Only the hover properties transition; the scroll-driven
            // transform is written every frame and must not be eased twice.
            transition: "filter 120ms linear",
          };

          return (
            <div
              key={REELS[i].id}
              data-depth-card={i}
              style={wrap}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((v) => (v === i ? null : v))}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: mix(7, CARD_RADIUS, spread),
                  overflow: "hidden",
                  backfaceVisibility: "hidden",
                }}
              >
                {/* The fan's own chrome: a metallic face and an inset
                    bezel panel. It reads as a solid object catching light
                    while the cards are still tumbling into place — but it
                    is not what the strip beyond this one actually draws,
                    and holding it all the way to spread=1 is what used to
                    make the hand-off a visible pop the instant ReelStrip
                    took over (a bezelled slab swapping for a flat placeholder,
                    metal for none, one frame apart). Fades out as the fan
                    becomes the row. */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 1 - spread,
                    background: `linear-gradient(104deg,
                      rgba(16,17,21,1) 0%,
                      rgba(28,30,36,1) 38%,
                      rgba(52,56,66,1) 70%,
                      rgba(96,102,117,1) 92%,
                      rgba(132,139,157,1) 100%)`,
                    border: "1px solid rgba(255,255,255,0.17)",
                    boxShadow: `0 ${28 * k}px ${62 * k}px rgba(0,0,0,0.82),
                      inset 0 1px 0 rgba(255,255,255,0.42),
                      inset 0 -1px 0 rgba(0,0,0,0.55)`,
                  }}
                >
                  {/* An inset panel, so the slab reads as a screen with a
                      bezel rather than a solid tile. */}
                  <div
                    style={{
                      position: "absolute",
                      inset: `${Math.max(2, 7 * k)}px`,
                      borderRadius: mix(4, 9, spread),
                      background: `linear-gradient(112deg,
                        rgba(10,11,14,1) 0%,
                        rgba(18,20,25,1) 55%,
                        rgba(34,37,45,1) 100%)`,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  />
                </div>

                {/* The strip's own face — exactly what ReelStrip draws for
                    this same card, so at spread=1 the two are pixel
                    identical and there is nothing left to pop when
                    ReelStrip takes over. */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: spread,
                    background: CARD_FACE_BG,
                    border: CARD_FACE_BORDER,
                  }}
                />
              </div>

              {/* The card's real thickness, turned a quarter turn out of
                  the face's plane so it shares the cards' 3D space. This
                  is the bright sliver running down the left of every card
                  in the reference. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: thick,
                  height: "100%",
                  transformOrigin: "left center",
                  transform: "rotateY(-90deg)",
                  background: `linear-gradient(to left,
                    rgba(244,247,255,1) 0%,
                    rgba(186,192,206,1) 30%,
                    rgba(98,104,116,1) 68%,
                    rgba(46,49,57,1) 100%)`,
                  opacity: spread > 0.985 ? 0 : 1,
                  backfaceVisibility: "hidden",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* The narration, in FRONT of the fan. A later sibling of the
          perspective container, so it is not in the cards' 3D space. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "36%",
          textAlign: "center",
          paddingInline: "6vw",
          fontFamily: sans,
          fontWeight: NARRATION_WEIGHT,
          fontSize: `clamp(18px, ${(NARRATION_FONT_SIZE / REF_VW) * 100}vw, ${NARRATION_FONT_SIZE}px)`,
          letterSpacing: NARRATION_TRACKING,
          color: NARRATION_COLOR,
          textShadow: NARRATION_GLOW,
          opacity:
            easeOutCubic(clamp01((lead - 0.34) / 0.4)) * (1 - clamp01(arr / 0.3)),
        }}
      >
        <NarrationLine
          progress={clamp01((lead - 0.34) / 0.45)}
          text="I work with various mediums, here's motion."
        />
      </div>
    </div>
  );
}
