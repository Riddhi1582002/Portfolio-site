"use client";

// The descent past the bulb, and the match cut out of it.
//
// THE MOVE. The camera keeps going down along Y and pitches up on X. The
// BULB does not move — it is the same bulb, hanging where the cord beat
// left it — so it rises through the frame and turns from a frontal view
// to its underside as the eye passes beneath it. Seen from under, with
// the filament driven up, the envelope stops reading as an object and
// becomes a bright white circle. That circle then darkens into a black
// iris, and the card it is painted on comes up behind it.
//
// The circle NEVER changes size. It is the bulb's own glass, so it is
// whatever the bulb is on screen, and the card behind it takes the size
// that keeps the card-to-circle ratio the gallery's own card has. Both
// numbers come from InfiniteCanvas's `irisFrame`, so the frame this beat
// ends on and the frame the pull-back opens on are the same pixels.
//
// Everything round here is sized with a TRANSFORM on a fixed base box and
// every blur is constant: a disc that grows by changing its width, with a
// shadow that grows with it, is a full re-blur of the largest thing on
// screen on every frame.

import BulbModel from "./BulbModel";
import NarrationLine from "./NarrationLine";
import { irisFrame } from "./InfiniteCanvas";
import { BULB_REST_TOP_VH, bulbSizePx } from "./CordSection";
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
const FALL = [0.02, 0.6] as const;
// The white circle takes over from the model as the camera arrives under it.
const BLOOM = [0.4, 0.6] as const;
// The narration belongs to the white-circle scene: it comes up under the
// circle once the descent has landed, and leaves as the circle darkens.
const LINE = [0.46, 0.72] as const;
const SWAP = [0.64, 0.9] as const;

// Where the circle settles: a little above the middle, with room under it
// for the narration.
const CIRCLE_Y = 0.43;

// Every round layer in this beat is this box, scaled.
const BASE = 512;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
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
  const frame = irisFrame(vw, vh);

  // THE DESCENT. Eased both ends: the camera is already moving when this
  // beat starts and comes to rest under the bulb.
  const fallT = easeInOutSine(span(p, FALL[0], FALL[1]));

  // The bulb's box travels up the frame because the eye is going down.
  // It starts exactly where the cord beat parked it.
  const bulbPx = bulbSizePx(vw, vh);
  const restTop = (BULB_REST_TOP_VH / 100) * vh;
  const endTop = CIRCLE_Y * vh - bulbPx / 2;
  const bulbTop = restTop + (endTop - restTop) * fallT;
  const circleY = bulbTop + bulbPx / 2;

  // The white circle takes over from the model as the underside blows out.
  const bloom = easeInOutSine(span(p, BLOOM[0], BLOOM[1]));

  // The cut. The card comes up first, then the circle darkens — so the
  // order the eye reads is "there is something behind this light", then
  // "the light was a hole".
  // The circle goes black FIRST and the card comes up under it after.
  // Overlapping them showed a lit white circle sitting on a card with the
  // narration still over it — three states of the beat at once.
  const dark = easeInOutSine(span(p, SWAP[0], SWAP[0] + 0.16));
  const cardIn = easeInOutSine(span(p, SWAP[0] + 0.12, SWAP[1]));
  const rim = dark;

  // Once the circle is black it is the gallery's iris, so it takes the
  // gallery's position: the card's centre, which is the frame's centre.
  const discCentreY = circleY + (vh / 2 - circleY) * dark;

  const lineFocus = span(p, LINE[0], LINE[1] - 0.1);
  const lineOpacity = Math.min(
    span(p, LINE[0], LINE[0] + 0.07),
    1 - span(p, LINE[1] - 0.07, LINE[1])
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* THE BULB, still hanging where it was. Only the eye moves. */}
      {bloom < 0.999 && (
        <div
          data-pencil="bulb"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: bulbPx,
            height: bulbPx,
            marginLeft: -bulbPx / 2,
            transform: `translateY(${bulbTop.toFixed(1)}px)`,
            opacity: 1 - bloom,
            willChange: "transform, opacity",
            pointerEvents: "none",
          }}
        >
          <BulbModel litness={1} pitch={fallT} />
        </div>
      )}

      {/* The light in the room, rising as the eye comes under the bulb. */}
      <div
        aria-hidden
        data-pencil="wash"
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,244,224,0.34) 0%, rgba(255,232,196,0.14) 26%, rgba(255,218,160,0) 60%)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(
            (frame.iris * 3.6) /
            BASE
          ).toFixed(4)})`,
          opacity: fallT * (1 - dark),
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* THE CARD, at the size that keeps the gallery's card-to-circle
          ratio. It is the gallery's own card, one camera move away. */}
      {cardIn > 0.001 && (
        <div
          aria-hidden
          data-pencil="card"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: frame.cardW,
            height: frame.cardH,
            marginLeft: -frame.cardW / 2,
            marginTop: -frame.cardH / 2,
            // These four are the gallery's own card, at this beat's scale —
            // the cut between the beats is geometry, so they have to stay
            // in step with InfiniteCanvas's Placeholder.
            borderRadius: 10 * frame.scale,
            background: "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
            border: `${Math.max(1, frame.scale)}px solid rgba(255,255,255,0.1)`,
            boxShadow: `0 0 ${(18 * frame.scale).toFixed(0)}px rgba(255,255,255,0.05), 0 ${(
              10 * frame.scale
            ).toFixed(0)}px ${(30 * frame.scale).toFixed(0)}px rgba(0,0,0,0.6)`,
            opacity: cardIn,
            willChange: "opacity",
            pointerEvents: "none",
          }}
        />
      )}

      {/* The bloom around the light, while it is still a light. */}
      <div
        aria-hidden
        data-pencil="bloom"
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,250,240,0.98) 0%, rgba(255,244,220,0.8) 30%, rgba(255,230,190,0.3) 44%, rgba(255,220,170,0) 60%)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(
            (frame.iris * 1.7) /
            BASE
          ).toFixed(4)})`,
          opacity: bloom * (1 - dark),
          zIndex: 2,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* THE CIRCLE. The bulb's own glass, at the bulb's own size, for the
          rest of the beat: white while it is a light, black once it is an
          iris. Its size never changes — only its colour. */}
      <div
        aria-hidden
        data-pencil="iris"
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background: `rgb(${(255 * (1 - dark)).toFixed(0)}, ${(250 * (1 - dark)).toFixed(
            0
          )}, ${(240 * (1 - dark)).toFixed(0)})`,
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(
            frame.iris / BASE
          ).toFixed(4)})`,
          opacity: Math.max(bloom, dark),
          zIndex: 3,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* The iris's rim. A black disc alone is a gap in the page; the rim
          is what makes it read as something you are looking through. */}
      <div
        aria-hidden
        data-pencil="rim"
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          boxShadow:
            "0 0 0 1.4px rgba(255,255,255,0.42), 0 0 20px rgba(255,255,255,0.2)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(
            frame.iris / BASE
          ).toFixed(4)})`,
          opacity: rim,
          zIndex: 4,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* The narration, under the circle. */}
      <div
        data-pencil="narration"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: circleY + frame.iris / 2 + vh * 0.07,
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
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <NarrationLine progress={lineFocus} text="But this all started with a pencil." />
      </div>
    </div>
  );
}
