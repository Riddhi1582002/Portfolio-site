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
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
const ROLL_END = 0.2;
const LINE_1 = [0.22, 0.46] as const;
const LINE_2 = [0.5, 0.74] as const;
const BULB_IN = 0.72;

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
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // The roll. 0 -> face on, 1 -> edge on.
  const roll = easeInOutSine(span(p, 0, ROLL_END));
  // Travel down the cord once the roll has finished.
  const travel = easeInOutSine(span(p, ROLL_END, 1));

  // Narration beats fade in and out; the second replaces the first.
  const n1In = span(p, LINE_1[0], LINE_1[0] + 0.12);
  const n1Out = 1 - span(p, LINE_1[1] - 0.08, LINE_1[1]);
  const n2In = span(p, LINE_2[0], LINE_2[0] + 0.12);
  const n2Out = 1 - span(p, LINE_2[1] - 0.06, LINE_2[1]);

  const bulb = span(p, BULB_IN, 1);
  // The wash in the room lags the model slightly, so the bulb reads as
  // coming up rather than the whole frame brightening at once.
  const litGlow = easeInOutSine(span(p, BULB_IN + 0.06, 1));

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* The cord. Width collapses as the camera rolls: at roll 0 it is as
          wide as a card, at roll 1 it is a line. Its vertical position
          moves with the travel, so the camera appears to follow it down. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          // Ends where the bulb hangs, rather than running past it.
          height: "176vh",
          width: `${(1 - roll) * 44 + 0.22}vw`,
          transform: `translate(-50%, ${(-travel * 150).toFixed(2)}vh)`,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 6%, #fff 94%, rgba(255,255,255,0.85) 100%)",
          boxShadow: `0 0 ${(18 + roll * 26).toFixed(0)}px rgba(255,255,255,${(0.16 + roll * 0.3).toFixed(2)})`,
          borderRadius: 2,
          willChange: "transform, width",
        }}
      />

      {/* The bulb hangs on the cord's end. It only comes into shot as the
          camera reaches the bottom of the travel. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "172vh",
          width: "min(46vh, 42vw)",
          aspectRatio: "1",
          transform: `translate(-50%, ${(-travel * 150).toFixed(2)}vh)`,
          opacity: bulb,
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
        <BulbModel litness={bulb} reduced={reduced} />
      </div>

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
