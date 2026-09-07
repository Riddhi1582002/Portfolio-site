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
  stripEntryScale,
  stripEntryShift,
  stripEntryLift,
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
// Card thickness, in px at the reference width. Thick enough that the lit
// side is a face you read rather than a hairline.
const THICK = 22;
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
  // ReelStrip at progress 0 centres card 0.
  const stripOffset = vw / 2 - toPx(centres[0]);
  const stripTop = toPx(STRIP_CENTRE_VH);
  const stripH = toPx(CARD_H_VH);
  // The strip is handed over at the same reduced scale ReelStrip enters
  // at, so the fan resolves into a ROW you can see rather than into one
  // card filling the frame. Everything scales about card 0's centre,
  // which is the point both sections park at the middle of the screen.
  const entryS = stripEntryScale(vw, vh);
  const entryShift = stripEntryShift(vw, vh);
  const entryLift = stripEntryLift(vh);
  const pivotX = vw / 2;
  const pivotY = stripTop;

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
          // Portrait pieces do not squash into portrait: the card TURNS.
          // The element stays a landscape slab and rotates a quarter turn,
          // so its bounding box becomes the portrait box the strip wants
          // and the piece reads as having been rotated into place.
          const portrait = REELS[i].ratio < 1;
          const pwBox = toPx(widths[i]);
          const phBox = stripH;
          // element size before the quarter turn
          const pw = portrait ? phBox : pwBox;
          const ph = portrait ? pwBox : phBox;
          const spin = portrait ? 90 : 0;

          const rawX = stripOffset + toPx(centres[i]) - pwBox / 2;
          const rawY = stripTop - phBox / 2;
          // scaled about card 0's centre, exactly as ReelStrip does it
          const boxX = pivotX + (rawX - pivotX) * entryS + entryShift;
          const boxY = pivotY + (rawY - pivotY) * entryS + entryLift;
          const boxW = pwBox * entryS;
          const boxH = phBox * entryS;
          // the element's own size is the box, un-turned
          const elW = (portrait ? phBox : pwBox) * entryS;
          const elH = (portrait ? pwBox : phBox) * entryS;
          // a turned element is centred on the same box centre
          const px = boxX + boxW / 2 - elW / 2;
          const py = boxY + boxH / 2 - elH / 2;
          const distance = i; // ReelStrip's focus is card 0 on its first frame
          const stripDim = Math.max(0.32, 1 - distance * 0.34);

          // --- blend ---
          const hovered = hover === i && arr < 0.02 && t > 0.85;
          const w = mix(sw, elW, arr);
          const h = mix(sh, elH, arr);
          const x = mix(sx, px, arr);
          const y = mix(sy, py, arr);
          const z = mix(sz + entryZ, 0, arr) + (hovered ? 70 * k : 0);
          const yaw = mix(YAW_DEG, 0, arr);
          const roll = mix(0, spin, arr);
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
            )}px) rotateY(${yaw.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg)`,
            transformStyle: "preserve-3d",
            opacity,
            willChange: "transform, opacity",
            pointerEvents: arr < 0.02 && t > 0.85 ? "auto" : "none",
            transition: "filter 260ms ease",
            filter: hovered
              ? `brightness(1.5) drop-shadow(0 0 ${34 * k}px rgba(255,255,255,0.3))`
              : "none",
          };

          return (
            <div
              key={REELS[i].id}
              data-depth-card={i}
              style={wrap}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((v) => (v === i ? null : v))}
            >
              {/* The face. Lit from the right, so the fan has a direction
                  to it and the cards behind fall away into the dark. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: mix(6, 14, arr),
                  background: `linear-gradient(102deg,
                    rgba(13,14,17,1) 0%,
                    rgba(24,26,31,1) 40%,
                    rgba(44,47,55,1) 74%,
                    rgba(78,83,95,1) 94%,
                    rgba(103,109,124,1) 100%)`,
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: `0 ${26 * k}px ${58 * k}px rgba(0,0,0,0.8),
                    inset 0 1px 0 rgba(255,255,255,0.34),
                    inset 0 -1px 0 rgba(0,0,0,0.5)`,
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
                      rgba(232,236,246,1) 0%,
                      rgba(168,174,188,1) 34%,
                      rgba(86,91,102,1) 72%,
                      rgba(44,47,54,1) 100%)`,
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
