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
import CameraRoll, { lineWidthPx } from "./CameraRoll";
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

// Geometry of the bulb, kept here because the arc has to be centred on it.
const BULB_TOP_VH = 172;
const TRAVEL_VH = 150;

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
  const roll = easeInOutSine(rollRaw);
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
  const bulbSizeVh = Math.min(46, (42 * viewport.vw) / Math.max(1, viewport.vh));
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
      <div style={{ opacity: 1 - handoff, position: "absolute", inset: 0 }}>
        <CameraRoll progress={rollRaw} vw={viewport.vw} vh={viewport.vh} />
      </div>

      {/* The cord, taking over from the line the camera arrived at. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          // Ends where the bulb hangs, rather than running past it.
          height: "176vh",
          // No longer collapsing from card width: the camera move already
          // did that with real geometry. This is the line it arrived at.
          width: lineWidthPx(viewport.vh),
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 6%, #fff 94%, rgba(255,255,255,0.85) 100%)",
          boxShadow: `0 0 ${(18 + roll * 26).toFixed(0)}px rgba(255,255,255,${(0.16 + roll * 0.3).toFixed(2)})`,
          // Fades up exactly as the camera's edge-on line fades out, and
          // dims later with the bulb as the arc arrives — the cord runs
          // down the centre of the frame, which is where the card in focus
          // sits, so it would otherwise cut the work in half.
          opacity: handoff * (1 - 0.78 * presence),
          borderRadius: 2,
          willChange: "transform, width",
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
          width: "min(46vh, 42vw)",
          aspectRatio: "1",
          transform: `translate(-50%, ${(-travel * TRAVEL_VH).toFixed(2)}vh)`,
          opacity: bulbIn,
          // Above the cord, so the cord reads as attaching behind the cap
          // rather than crossing the glass.
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
            top: "62%",
            width: "260%",
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,236,200,${(0.30 * litGlow).toFixed(
              3
            )}) 0%, rgba(255,226,170,${(0.12 * litGlow).toFixed(
              3
            )}) 26%, rgba(255,220,160,0) 62%)`,
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
          text: "Photoshop came into my life as another toy I played with when I was a kid.",
          focus: span(p, LINE_1[0], LINE_1[1] - 0.06),
          opacity: Math.min(n1In, n1Out),
        },
        {
          key: "n2",
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
            right: "56%",
            top: "44vh",
            width: "34vw",
            textAlign: "right",
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
