"use client";

// REELS -> LAYERS.
//
// The camera rolls 90 degrees so the strip is seen edge-on: the cards stop
// being panels and become a single continuous white line down the centre
// of the frame. The camera then travels down that line, picking up a
// narration beat, then a second, and arrives at the bulb hanging on its
// end.
//
// The line is not a drawing of the cards — it IS the strip, rotated. The
// same eight widths lay out along it, so the seams sit where the gaps
// between pieces are, and at 90 degrees they close into one line. That is
// why it reads as a continuation rather than a cut.

import { useEffect, useRef, useState } from "react";
import NarrationLine from "./NarrationLine";
import BulbModel from "./BulbModel";
import ArcCarousel, { arcPresence } from "./ArcCarousel";
import CameraRoll, { lineWidthPx, lineGlow } from "./CameraRoll";
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
const ROLL_END = 0.11;
const LINE_1 = [0.13, 0.29] as const;
const LINE_2 = [0.31, 0.46] as const;
const BULB_IN = 0.44;
// The camera stops travelling here: the bulb has arrived and holds still
// for the rest of the section, so the arc turns around a fixed centre.
const TRAVEL_END = 0.52;
// The arc of work, one scroll per card.
const ARC_START = 0.54;

// Geometry of the bulb, kept here because the arc has to be centred on it
// — and exported, because the beat that follows keeps descending past the
// same bulb and has to pick it up exactly where this one leaves it.
const BULB_TOP_VH = 172;
const TRAVEL_VH = 150;
/** Where the bulb's box sits once its travel is over, in vh. */
export const BULB_REST_TOP_VH = BULB_TOP_VH - TRAVEL_VH;
/** The bulb's box, in px, at a given viewport. */
export function bulbSizePx(vw: number, vh: number) {
  return Math.min((BULB_VH_MAX / 100) * vh, (BULB_VW_MAX / 100) * vw);
}
/**
 * The glass envelope's widest diameter as a share of that box — measured
 * off the render, not assumed. It is what the bulb's underside reads as
 * once the camera is beneath it, so it is the size of the white circle
 * the next beat hands over.
 */
export const BULB_GLASS_RATIO = 0.54;
// The bulb's box. Much larger than before — it was reading as a lamp seen
// from across a room rather than the thing the whole beat arrives at.
const BULB_VH_MAX = 78;
const BULB_VW_MAX = 66;
// Where the model's TOP edge sits down its own square box. The bulb hangs
// upside down now, so that edge is the glass tip and it is what the line
// comes down to meet. The box is square and the model is framed to 2.4
// units inside a view that is 2*4.2*tan(17.5deg) = 2.65 units tall, so the
// model fills 90.6% of the box and the empty band above it is half of the
// remainder. Measured against the render, not assumed.
const CAP_RATIO = 0.052;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export default function CordSection({
  progress,
  sans,
}: {
  progress: number;
  sans: string;
}) {
  const p = clamp01(progress);
  const [reduced, setReduced] = useState(false);
  const [viewport, setViewport] = useState({ vw: 1440, vh: 900 });
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const read = () =>
      setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // The roll. 0 -> face on, 1 -> edge on. Driven by CameraRoll now: the
  // cards stay put and the eye moves, so this value only says how far
  // through that move we are.
  const rollRaw = span(p, 0, ROLL_END);
  // The cord takes over from the camera's line at the same width, in the
  // same place, in the last sliver of the move — so the swap is invisible.
  const handoff = clamp01((rollRaw - 0.94) / 0.06);
  // Travel down the cord once the roll has finished, and stop once the
  // bulb is in shot.
  const travel = easeInOutSine(span(p, ROLL_END, TRAVEL_END));

  // Narration beats fade in and out; the second replaces the first.
  const n1In = span(p, LINE_1[0], LINE_1[0] + 0.12);
  const n1Out = 1 - span(p, LINE_1[1] - 0.08, LINE_1[1]);
  const n2In = span(p, LINE_2[0], LINE_2[0] + 0.12);
  const n2Out = 1 - span(p, LINE_2[1] - 0.06, LINE_2[1]);

  const bulbIn = span(p, BULB_IN, TRAVEL_END + 0.03);

  // The arc of work. Its presence is what dims the bulb: the room cannot
  // be lit by the bulb and by nine glowing pieces at once, so the light
  // hands over as they arrive and comes back when the last one leaves.
  const arcP = span(p, ARC_START, 1);
  const presence = arcPresence(arcP);
  const lit = bulbIn * (1 - 0.86 * presence);

  // Bulb size follows `min(46vh, 42vw)`; the arc is centred on it, so the
  // same expression has to be evaluated here in vh.
  const bulbSizeVh = Math.min(
    BULB_VH_MAX,
    (BULB_VW_MAX * viewport.vw) / Math.max(1, viewport.vh)
  );
  const bulbCentreVh = BULB_TOP_VH - travel * TRAVEL_VH + bulbSizeVh / 2;

  // The wash in the room lags the model slightly, so the bulb reads as
  // coming up rather than the whole frame brightening at once.
  const litGlow = easeInOutSine(span(p, BULB_IN + 0.04, TRAVEL_END + 0.03)) * (1 - 0.86 * presence);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* The camera move that turns the strip into the line. The cards are
          the strip's own cards at the strip's own world positions; only
          the eye moves. It hands over to the cord below at the moment the
          two are the same width in the same place. */}
      {handoff < 1 && (
        <div style={{ opacity: 1 - handoff, position: "absolute", inset: 0 }}>
          <CameraRoll progress={rollRaw} vw={viewport.vw} vh={viewport.vh} />
        </div>
      )}

      {/* The cord, taking over from the line the camera arrived at. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          // Runs down to the CAP, not to some point above it. The bulb's
          // own wire used to show as a thin dark thread between where this
          // line stopped and where the bulb began; BulbModel now lifts
          // that wire out of frame and the line comes all the way down to
          // meet the cap.
          height: `${(BULB_TOP_VH + bulbSizeVh * CAP_RATIO).toFixed(2)}vh`,
          // No longer collapsing from card width: the camera move already
          // did that with real geometry. This is the line it arrived at.
          width: lineWidthPx(viewport.vh),
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          // A lit filament does not make a flat white stripe of the wire
          // it hangs on: the wire is brightest where the light reaches it
          // and cools off up into the dark. The gradient is the falloff;
          // the layered shadow below is the air around it.
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 5%, #fff 55%, rgb(255,250,240) 88%, rgb(255,242,220) 100%)",
          // NO box-shadow here. This element is transformed every frame,
          // and a four-layer glow on a 1500px-tall bar had to be
          // re-rasterised with it — on its own that took the whole cord
          // beat to about 1fps. The glow is the promoted sibling below,
          // whose shadow never changes and which only fades.
          // Fades up exactly as the camera's edge-on line fades out, and
          // dims later with the bulb as the arc arrives — the cord runs
          // down the centre of the frame, which is where the card in focus
          // sits, so it would otherwise cut the work in half.
          opacity: handoff * (1 - 0.78 * presence),
          borderRadius: 2,
          // ABOVE the bulb's canvas. The model's own wire is opaque
          // geometry, so with the bulb on top it painted over the last
          // stretch of this line and the line appeared to stop short,
          // leaving a thin gold thread down to the cap. The cord now
          // covers that thread and ends on the cap itself.
          zIndex: 3,
          willChange: "transform",
        }}
      />

      {/* The line's glow, as its own layer: one constant shadow that the
          compositor can keep, faded rather than re-blurred. */}
      <div
        aria-hidden
        data-cord-glow
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          height: `${(BULB_TOP_VH + bulbSizeVh * CAP_RATIO).toFixed(2)}vh`,
          width: lineWidthPx(viewport.vh),
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          boxShadow: lineGlow(0.92),
          borderRadius: 2,
          opacity: handoff * (1 - 0.78 * presence),
          zIndex: 3,
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      />

      {/* The last stretch of the line, where the bulb's own light reaches
          it. Separate element because a box-shadow is one colour for the
          whole edge — the warmth has to fall off ALONG the line, and only
          once the bulb is actually lit. */}
      <div
        aria-hidden
        data-cord-spill
        style={{
          position: "absolute",
          left: "50%",
          top: `${(BULB_TOP_VH + bulbSizeVh * CAP_RATIO - 46).toFixed(2)}vh`,
          height: "46vh",
          width: lineWidthPx(viewport.vh),
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          background:
            "linear-gradient(to bottom, rgba(255,214,150,0) 0%, rgba(255,214,150,0.45) 62%, rgba(255,200,130,0.9) 100%)",
          // Constant, so the blur is rasterised once; the beat fades the
          // layer instead of re-blurring it every frame. No blend mode
          // either — over black, screen and normal are the same picture,
          // and the blend forced its own compositing pass.
          boxShadow:
            "0 0 10px rgba(255,206,140,0.5), 0 0 34px rgba(255,190,110,0.28), 0 0 96px rgba(255,178,96,0.13)",
          opacity: handoff * litGlow * (1 - 0.78 * presence),
          borderRadius: 2,
          zIndex: 3,
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      />

      {/* The bulb hangs on the cord's end. It only comes into shot as the
          camera reaches the bottom of the travel. */}
      <div
        data-bulb-host
        style={{
          position: "absolute",
          left: "50%",
          top: `${BULB_TOP_VH}vh`,
          width: `min(${BULB_VH_MAX}vh, ${BULB_VW_MAX}vw)`,
          aspectRatio: "1",
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          opacity: bulbIn,
          // Above the cord so the line reads as attaching behind the cap,
          // but BELOW the arc: the pieces swing in front of the bulb, not
          // behind it.
          zIndex: 2,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      >
        {/* The light itself. The GLB carries an emissive material, but a
            mesh cannot throw light onto an empty scene — there is nothing
            for it to fall on. This radial wash is the glow in the room,
            and it dims and lifts on the same litness value the model does,
            so the two never disagree. */}
        <div
          aria-hidden
          data-bulb-wash
          style={{
            position: "absolute",
            left: "50%",
            // Centred on the FILAMENT, not on the model's box. Hung
            // upside down the cap is at the top and the glass below it,
            // so the hot spot sits a little past the middle.
            top: "52%",
            width: "300%",
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            // Three falloffs rather than one. A single gradient reads as a
            // painted disc; light in air has a small intense core, a
            // shoulder, and a long faint skirt, and the eye reads the
            // shoulder as distance.
            // The stops are CONSTANT and the layer is faded instead.
            // Re-generating three radial gradients across a 2000px box
            // every frame is a full repaint of the largest element in the
            // beat, and it does not look any different from fading one.
            background: [
              "radial-gradient(circle, rgba(255,244,222,0.5) 0%, rgba(255,238,208,0) 11%)",
              "radial-gradient(circle, rgba(255,226,178,0.26) 0%, rgba(255,220,166,0) 27%)",
              "radial-gradient(circle, rgba(255,206,140,0.11) 0%, rgba(255,196,124,0) 58%)",
            ].join(", "),
            opacity: litGlow,
            willChange: "opacity",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
        <BulbModel litness={lit} reduced={reduced} />
      </div>

      {/* The arc of work, turning around the bulb. */}
      <ArcCarousel
        progress={arcP}
        centreVh={bulbCentreVh}
        vw={viewport.vw}
        vh={viewport.vh}
      />

      {/* Narration, to the LEFT of the line as specified. */}
      {[
        {
          key: "n1",
          side: "left" as const,
          topVh: 44,
          text: "Photoshop came into my life as another toy I played with when I was a kid.",
          focus: span(p, LINE_1[0], LINE_1[1] - 0.06),
          opacity: Math.min(n1In, n1Out),
        },
        {
          key: "n2",
          side: "right" as const,
          topVh: 56,
          text: "Now, it's also my profession.",
          focus: span(p, LINE_2[0], LINE_2[1] - 0.04),
          opacity: Math.min(n2In, n2Out),
        },
      ].map((beat) => (
        <div
          key={beat.key}
          data-narration
          style={{
            position: "absolute",
            ...(beat.side === "left"
              ? { right: "56%", textAlign: "right" as const }
              : { left: "56%", textAlign: "left" as const }),
            top: `${beat.topVh}vh`,
            width: "34vw",
            fontFamily: sans,
            fontWeight: NARRATION_WEIGHT,
            fontSize: "clamp(18px, 2vw, 40px)",
            lineHeight: 1.5,
            letterSpacing: NARRATION_TRACKING,
            color: NARRATION_COLOR,
            textShadow: NARRATION_GLOW,
            opacity: beat.opacity,
            pointerEvents: "none",
          }}
        >
          <NarrationLine progress={beat.focus} text={beat.text} />
        </div>
      ))}
    </div>
  );
}
