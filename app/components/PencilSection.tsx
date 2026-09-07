"use client";

// The pencil beat, and the match cut out of it.
//
// Two beats on one progress value. First the narration lands. Then a
// single 16:9 placeholder comes up carrying a dark circle at its centre —
// the iris — and the circle grows until it is larger than the frame.
//
// The circle is NOT clipped by the card and there is no second "cut"
// element. It is one black disc on a black page: while it is small it
// reads as a shape sitting on the placeholder, and as it passes the
// placeholder's edges it simply eats the frame. That is the whole match
// cut — the thing you were looking at becomes the darkness you are now
// looking through, with no crossfade and nothing to line up.

import { useMemo } from "react";
import NarrationLine from "./NarrationLine";
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
const LINE = [0.04, 0.36] as const;
const CARD_IN = [0.34, 0.5] as const;
const IRIS = [0.52, 0.96] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeInCubic = (t: number) => t * t * t;
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export default function PencilSection({
  progress,
  sans,
  vw,
  vh,
}: {
  progress: number;
  sans: string;
  vw: number;
  vh: number;
}) {
  const p = clamp01(progress);

  const lineFocus = span(p, LINE[0], LINE[1] - 0.08);
  // Narration leaves the way the name does: a straight opacity fade, not
  // the focus pull in reverse.
  const lineOpacity = Math.min(
    span(p, LINE[0], LINE[0] + 0.09),
    1 - span(p, LINE[1] - 0.07, LINE[1])
  );

  const cardIn = easeInOutSine(span(p, CARD_IN[0], CARD_IN[1]));

  // The card is 16:9 and sized off the smaller constraint, so it never
  // runs out of the frame on a short viewport.
  const cardW = Math.min(vw * 0.62, vh * 0.62 * (16 / 9));
  const cardH = cardW * (9 / 16);

  // The iris starts a little smaller than the card's height and finishes
  // past the viewport's diagonal, so no corner is left uncovered.
  const irisT = span(p, IRIS[0], IRIS[1]);
  const irisFrom = cardH * 0.3;
  const irisTo = Math.hypot(vw, vh) * 1.08;
  // Accelerating: a linear grow reads as a wipe, an accelerating one
  // reads as a camera falling into the pupil.
  const iris = irisFrom + (irisTo - irisFrom) * easeInCubic(irisT);
  // The rim is what makes the disc read as an iris rather than a hole.
  // It is gone well before the disc reaches the frame's edges.
  const rim = (1 - span(p, IRIS[0], IRIS[0] + 0.16)) * cardIn;

  const cardStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: "50%",
      top: "50%",
      width: cardW,
      height: cardH,
      marginLeft: -cardW / 2,
      marginTop: -cardH / 2,
      borderRadius: 14,
      background: "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
      border: "1px solid rgba(255,255,255,0.13)",
      boxShadow: `0 0 ${(52 * cardIn).toFixed(0)}px rgba(255,255,255,${(0.2 * cardIn).toFixed(
        3
      )}), 0 24px 70px rgba(0,0,0,0.7)`,
      opacity: cardIn,
      transform: `scale(${(0.94 + 0.06 * cardIn).toFixed(3)})`,
    }),
    [cardW, cardH, cardIn]
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* The narration for this beat, in the site's one narration style. */}
      <div
        data-pencil="narration"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "42vh",
          textAlign: "center",
          paddingInline: "6vw",
          fontFamily: sans,
          fontWeight: NARRATION_WEIGHT,
          fontSize: "clamp(18px, 2vw, 40px)",
          lineHeight: 1.5,
          letterSpacing: NARRATION_TRACKING,
          color: NARRATION_COLOR,
          textShadow: NARRATION_GLOW,
          opacity: lineOpacity,
          pointerEvents: "none",
        }}
      >
        <NarrationLine progress={lineFocus} text="But this all started with a pencil." />
      </div>

      {/* Neutral placeholder. Real work replaces the background. */}
      <div aria-hidden data-pencil="card" style={cardStyle} />

      {/* The iris. One disc, above the card, never clipped. */}
      <div
        aria-hidden
        data-pencil="iris"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: iris,
          height: iris,
          marginLeft: -iris / 2,
          marginTop: -iris / 2,
          borderRadius: "50%",
          background: "#000",
          boxShadow: `0 0 0 ${(1.5 * rim).toFixed(2)}px rgba(255,255,255,${(0.5 * rim).toFixed(
            3
          )}), 0 0 ${(26 * rim).toFixed(0)}px rgba(255,255,255,${(0.22 * rim).toFixed(3)})`,
          opacity: cardIn,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
