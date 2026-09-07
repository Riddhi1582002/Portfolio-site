"use client";

// The eight pieces, arriving out of the depths and then arranging
// themselves into the strip.
//
// TWO POSES, ONE SET OF ELEMENTS.
//
//   stack  — the fanned row from the reference: the pieces recede back and
//            to the left on a shared yaw, so what you see is the front
//            card's face and the lit left edges of the seven behind it.
//   strip  — exactly where ReelStrip puts the same eight cards on its
//            first frame.
//
// `arrange` interpolates between them, so the hand-off into REELS is not a
// cut: the last frame the hero draws and the first frame the strip draws
// are the same picture. The strip pose is computed from ReelStrip's own
// layout function rather than copied, so the two cannot drift apart.
//
// The cards are real boxes, not planes. Each one carries a face and a
// left-hand edge in a preserve-3d wrapper, so the thickness is geometry
// that catches the key light — which is what makes the fan read as a row
// of objects rather than a stack of decals.

import { useEffect, useState, type CSSProperties } from "react";
import NarrationLine from "./NarrationLine";
import {
  REELS,
  layout,
  CARD_H_VH,
  STRIP_CENTRE_VH,
} from "./ReelStrip";
import {
  NARRATION_COLOR,
  NARRATION_FONT_SIZE,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Eight, to match the strip they become. All 16:9 in this scene — the
// portrait pieces take their real ratio only once they are in the strip,
// by which point they are off to the side.
const CARD_COUNT = REELS.length;

// The fan, in px on a 1440-wide reference frame and scaled from there.
const REF_VW = 1440;
// Front card's width.
const FRONT_W = 470;
// Step back and to the left, per card.
const STEP_X = -86;
const STEP_Z = -116;
const STEP_Y = -7;
// Shared yaw. Positive brings each card's LEFT edge toward the camera,
// which is the face we see the light catch in the reference.
const YAW_DEG = 24;
// Card thickness, in px at the reference width.
const THICK = 16;
// Where the fan sits in the frame: right of centre and a little low, so
// the narration has the upper middle to itself.
const FAN_CX = 0.6;
const FAN_CY = 0.53;

const STAGGER = 0.055;

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
  /** 0 = the fan, 1 = ReelStrip's first frame. */
  arrange?: number;
  sans: string;
}) {
  const lead = clamp01(progress);
  const arr = easeInOutCubic(clamp01(arrange));
  const [vp, setVp] = useState({ vw: 1440, vh: 900 });

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
  // ReelStrip at progress 0 centres card 0.
  const stripOffset = vw / 2 - toPx(centres[0]);
  const stripTop = toPx(STRIP_CENTRE_VH);
  const stripH = toPx(CARD_H_VH);

  return (
    <div
      aria-hidden={lead < 0.05}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        pointerEvents: "none",
        visibility: lead <= 0.02 ? "hidden" : "visible",
      }}
    >
      {/* The fan. Its own perspective, so the depth is the camera's and
          not a hand-tuned scale ramp. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${1500 * k}px`,
          perspectiveOrigin: `${FAN_CX * 100}% ${FAN_CY * 100}%`,
          transformStyle: "preserve-3d",
        }}
      >
        {Array.from({ length: CARD_COUNT }, (_, i) => {
          // Later cards start further back and arrive later.
          const t = easeOutCubic(
            clamp01((lead - i * STAGGER) / (1 - STAGGER * (CARD_COUNT - 1)))
          );

          // --- stack pose ---
          const sw = FRONT_W * k;
          const sh = sw * (9 / 16);
          const sx = FAN_CX * vw - sw / 2 + i * STEP_X * k;
          const sy = FAN_CY * vh - sh / 2 + i * STEP_Y * k;
          const sz = i * STEP_Z * k;
          // The entrance: the card comes forward from far behind.
          const entryZ = -2400 * k * (1 - t);

          // --- strip pose ---
          const pw = toPx(widths[i]);
          const px = stripOffset + toPx(centres[i]) - pw / 2;
          const py = stripTop - stripH / 2;
          const distance = i; // ReelStrip's focus is card 0 on its first frame
          const stripDim = Math.max(0.32, 1 - distance * 0.34);

          // --- blend ---
          const w = mix(sw, pw, arr);
          const h = mix(sh, stripH, arr);
          const x = mix(sx, px, arr);
          const y = mix(sy, py, arr);
          const z = mix(sz + entryZ, 0, arr);
          const yaw = mix(YAW_DEG, 0, arr);
          const thick = mix(THICK * k, 0, arr);
          const opacity = mix(t, stripDim, arr);

          const wrap: CSSProperties = {
            position: "absolute",
            left: 0,
            top: 0,
            width: w,
            height: h,
            transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(
              2
            )}px) rotateY(${yaw.toFixed(2)}deg)`,
            transformStyle: "preserve-3d",
            opacity,
            willChange: "transform, opacity",
          };

          return (
            <div key={REELS[i].id} data-depth-card={i} style={wrap}>
              {/* The face. Lit from the right, so the fan has a direction
                  to it and the cards behind fall away into the dark. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: mix(6, 14, arr),
                  background: `linear-gradient(100deg,
                    rgba(6,6,8,1) 0%,
                    rgba(11,12,14,1) 52%,
                    rgba(19,20,24,1) 86%,
                    rgba(31,33,39,1) 100%)`,
                  border: "1px solid rgba(255,255,255,0.055)",
                  boxShadow: `0 ${26 * k}px ${58 * k}px rgba(0,0,0,0.8)`,
                  backfaceVisibility: "hidden",
                }}
              />
              {/* The left-hand edge: the card's real thickness, turned 90
                  degrees so it faces the key. This is the bright sliver
                  that runs down the left of every card in the reference. */}
              {thick > 0.4 && (
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
                      rgba(196,201,214,0.98) 0%,
                      rgba(120,125,137,0.95) 40%,
                      rgba(52,55,63,0.95) 100%)`,
                    backfaceVisibility: "hidden",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* The narration, in FRONT of the fan. It is a later sibling of the
          perspective container rather than a child of it, so it is not in
          the cards' 3D space and cannot be intersected by them. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "38%",
          textAlign: "center",
          paddingInline: "6vw",
          fontFamily: sans,
          fontWeight: NARRATION_WEIGHT,
          fontSize: `clamp(18px, ${(NARRATION_FONT_SIZE / REF_VW) * 100}vw, ${NARRATION_FONT_SIZE}px)`,
          letterSpacing: NARRATION_TRACKING,
          color: NARRATION_COLOR,
          textShadow: NARRATION_GLOW,
          // Gone by the time the cards start arranging themselves.
          opacity:
            easeOutCubic(clamp01((lead - 0.3) / 0.4)) * (1 - clamp01(arrange / 0.35)),
        }}
      >
        <NarrationLine
          progress={clamp01((lead - 0.3) / 0.45)}
          text="I work with various mediums, here's motion."
        />
      </div>
    </div>
  );
}
