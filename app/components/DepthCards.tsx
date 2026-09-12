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

import { useLayoutEffect, useState, type CSSProperties } from "react";
import NarrationLine from "./NarrationLine";
import {
  REELS,
  layout,
  CARD_H_VH,
  STRIP_CENTRE_VH,
  CARD_FACE_BG,
  CARD_FACE_BORDER,
  CARD_RADIUS,
  CARD_GLOW_SHADOW,
  cardGlow,
  EDGE_FADE_LEFT,
  EDGE_FADE_RIGHT,
  DETAILS_TOP_VH,
} from "./ReelStrip";
import { carry, easeInOutCubic } from "../lib/motion";
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
// EVERY CARD RUNS TO THE END OF THE SPREAD, not to its own staggered copy
// of a fixed-length window.
//
// With equal-length windows the front card, which leads, also FINISHED
// first — at arr 0.818 — and then sat perfectly still for the remaining
// 19vh of scrolling while the cards behind it, all off frame by then,
// finished up. So the two pieces actually in shot were parked for the
// stretch immediately before REELS took the pane, which is the worst
// possible place for the row to stop: the strip's scrub then had nothing
// to inherit. Staggering only the START keeps the cascade that makes the
// row assemble rather than snap — the front card still leads — while
// every card is still travelling on the frame the strip picks it up.
const SPREAD_LANDS_TOGETHER = true;
// The spread is the whole of `arrange` now.
const SPREAD_END = 1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// THE SPREAD'S OWN SHAPE — entered moving, left moving.
//
// It was a plain easeInOutCubic, which starts at zero speed and ends at
// zero speed, and it sat between two other movements that also end and
// start at zero: the cards' arrival brakes into it, and the strip's own
// scrub opens out of it. Three movements, two full stops, and that is
// what made the fan and the strip read as separate animations that happen
// to line up rather than as one continuous assembly.
//
// Sliced out of the middle of the same curve, the shape is unchanged and
// the landing pose is identical to the pixel (carry() renormalises, so
// spread(1) is still exactly 1 and still exactly ReelStrip's steady
// frame) — but the card is ALREADY MOVING on its first frame, continuing
// the arrival that is still finishing behind it, and is STILL MOVING on
// its last, which is the speed ReelStrip picks up and carries on with.
const SPREAD_CARRY_IN = 0.26;
const SPREAD_CARRY_OUT = 0.74;
const spreadEase = carry(easeInOutCubic, SPREAD_CARRY_IN, SPREAD_CARRY_OUT);

/** Card `i`'s own progress through the spread: staggered start, shared end. */
function cardSpread(arr: number, i: number): number {
  const from = i * SPREAD_STAGGER;
  const to = SPREAD_LANDS_TOGETHER
    ? SPREAD_END
    : from + SPREAD_END - SPREAD_STAGGER * (CARD_COUNT - 1);
  return clamp01((arr - from) / Math.max(1e-6, to - from));
}

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

  // useLayoutEffect, not useEffect. This stack is laid out in real
  // viewport px and the state above starts on a 1440x900 guess so the
  // first render matches the server's. A deferred effect lets that guess
  // reach the screen for one frame — a whole card stack drawn at the
  // wrong size on the frame it appears. Reading it before paint keeps
  // SSR agreeing and the guess invisible.
  useLayoutEffect(() => {
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
  // Which cards can actually be in frame once this is the strip — ReelStrip's
  // own `near` test, at the focus it opens on (card 0). Only those get the
  // glow below, for both of ReelStrip's reasons: it is where ReelStrip puts
  // one, so the frames match; and a 46px blur on a card several screens off
  // to the right is a shadow rasterised for nothing.
  const nearAtStrip = (i: number) => {
    const halfSpan = (vw / 2 + toPx(widths[i]) / 2) / Math.max(1, toPx(1));
    return Math.abs(centres[i] - centres[0]) < halfSpan + 8;
  };

  // The arrival and the spread overlap now (see HeroSection's ARRIVE_END
  // and ARRANGE_START), so the old gate — the front card fully arrived AND
  // the spread not yet begun — describes a window that no longer exists.
  // Keyed instead to "the front of the fan has landed and has not
  // meaningfully left it yet": spreadEase(0.05) is under 3% of the way to
  // the strip, i.e. still the fan pose, and the window this opens is
  // slightly wider in scroll than the one it replaces.
  const hoverable = arr < 0.05 && lead > 0.6;

  // Card 0's spread, computed the same way the loop below does it. The
  // strip's frame furniture arrives on this rather than on `arr`, so it is
  // locked to the piece it describes coming to rest.
  const frontSpread = spreadEase(cardSpread(arr, 0));

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
          const spread = spreadEase(cardSpread(arr, i));

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

              {/* AND THE STRIP'S OWN GLOW, arriving with it.
                  The face matched to the pixel and the glow did not exist
                  here at all, so a card sat in the row unlit and then, on
                  the one frame REELS took the pane, was surrounded by a
                  46px halo and a drop shadow. It was the largest single
                  thing that changed at that hand-over — bigger than the
                  cards, which did not move. Constant shadow, faded, the
                  same way ReelStrip draws it. */}
              {spread > 0.001 && nearAtStrip(i) && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: CARD_RADIUS,
                    boxShadow: CARD_GLOW_SHADOW,
                    opacity: cardGlow(i) * spread,
                    willChange: "opacity",
                    pointerEvents: "none",
                  }}
                />
              )}

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

      {/* THE REST OF THE STRIP'S FRAME, arriving on the same value.
          The row the fan assembles into is not just eight cards: it is
          those cards with the piece's details in the clear band above them
          and the frame falling into black at both edges. All of it was
          missing here and all of it appeared at once when REELS took over.
          Keyed to the FRONT card's spread — card 0 is the piece the strip
          opens in focus, so its arrival is what the details describe. */}
      {frontSpread > 0.001 && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${DETAILS_TOP_VH}vh`,
              textAlign: "center",
              pointerEvents: "none",
              opacity: arr,
              fontFamily: sans,
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
              {REELS[0].title}
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
              {REELS[0].meta}
            </div>
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: frontSpread,
              willChange: "opacity",
              background: EDGE_FADE_RIGHT,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: frontSpread,
              willChange: "opacity",
              background: EDGE_FADE_LEFT,
            }}
          />
        </>
      )}

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
          // Both ends re-keyed, not re-timed: the spread now begins
          // 0.09 of the tail earlier, so an exit keyed to `arr > 0` would
          // have started fading this line out while it was still fading
          // in. The window it is actually legible for is the same length
          // it always was (~0.10 of the tail); it just no longer coincides
          // with the moment the fan starts moving.
          opacity:
            easeOutCubic(clamp01((lead - 0.28) / 0.34)) *
            (1 - clamp01((arr - 0.16) / 0.26)),
        }}
      >
        <NarrationLine
          progress={clamp01((lead - 0.28) / 0.42)}
          text="I work with various mediums, here's motion."
        />
      </div>
    </div>
  );
}
