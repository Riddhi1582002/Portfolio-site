"use client";

// The pencil beat, and the match cut out of it.
//
// Three beats on one progress value.
//
//   1. The narration lands.
//
//   2. THE DESCENT. The camera keeps going down, facing up, and the bulb
//      stays exactly where it was hanging — so it passes overhead. Coming
//      up under a lit filament it blooms, and by the time we are level
//      with it there is nothing in frame but a glowing white circle.
//
//   3. THE MATCH CUT. That circle darkens to a black iris, and the card
//      it is painted on fades up behind it. Nothing grows and nothing is
//      clipped: the disc is one shape that changes colour, which is why
//      there is no wipe and nothing to line up.
//
// The frame this beat ENDS on is not invented here — it is read from
// InfiniteCanvas's own geometry (`irisFrame`), which is the iris card of
// the gallery, scaled until it overfills the viewport. The gallery's
// first frame is the same numbers, so the hand-off from this beat to the
// pull-back is a continuation of one camera move rather than a cut.

import NarrationLine from "./NarrationLine";
import { irisFrame } from "./InfiniteCanvas";
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
const LINE = [0.02, 0.30] as const;
const FALL = [0.24, 0.62] as const;
const SWAP = [0.58, 0.84] as const;

// Every round layer in this beat is this box, scaled. See the note at the
// wash below for why nothing here is sized by changing its width.
const BASE = 512;

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
  const frame = irisFrame(vw, vh);

  const lineFocus = span(p, LINE[0], LINE[1] - 0.08);
  // Narration leaves the way the name does: a straight opacity fade, not
  // the focus pull in reverse.
  const lineOpacity = Math.min(
    span(p, LINE[0], LINE[0] + 0.09),
    1 - span(p, LINE[1] - 0.07, LINE[1])
  );

  // The descent. The bulb does not move; we do — so it grows in frame the
  // way anything does as you come up under it, accelerating because the
  // last stretch of the approach covers the most angle.
  const fallT = easeInCubic(span(p, FALL[0], FALL[1]));
  const discFrom = Math.min(vw, vh) * 0.1;
  const disc = discFrom + (frame.iris - discFrom) * fallT;
  // It also settles from above the middle to the middle, because we are
  // looking up at it until we are level with it.
  const discY = vh * (0.36 + 0.14 * easeInOutSine(fallT));

  // The room the bulb is lighting, such as it is: a wide warm wash that
  // comes up with the bloom and goes out with it.
  const wash = fallT * (1 - span(p, SWAP[0], SWAP[1] - 0.06));

  // The cut. The card comes up first, then the disc darkens — so the
  // order the eye reads is "there is something behind this light", then
  // "the light was a hole".
  const cardIn = easeInOutSine(span(p, SWAP[0], SWAP[0] + 0.14));
  const dark = easeInOutSine(span(p, SWAP[0] + 0.08, SWAP[1]));
  // A rim is what makes a black disc read as an iris rather than as a
  // gap in the page. It arrives with the darkness and stays.
  const rim = dark;

  // Once the disc is black it is the gallery's iris, so it takes the
  // gallery's position: the card's centre, which is the frame's centre.
  const discCentreY = discY + (vh / 2 - discY) * dark;

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

      {/* The wash the bulb throws as we come up under it.

          Everything from here down is sized with a TRANSFORM on a fixed
          base box, and every blur and gradient below is constant. A disc
          that grows by changing its width, carrying a 390px shadow that
          grows with it, is a full re-blur of the largest thing on screen
          on every frame — which on its own took this beat to about 1fps.
          Scaling a layer that was rasterised once costs nothing. */}
      {fallT > 0.0005 && (<>
      <div
        aria-hidden
        data-pencil="wash"
        style={{
          position: "absolute",
          left: "50%",
          // Positioned by TRANSFORM, not by `top`: the descent moves this
          // every frame, and `top` is a layout property — moving four
          // promoted layers that way re-lays-out and re-rasterises them
          // on every frame of the beat.
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,244,224,0.3) 0%, rgba(255,228,186,0.12) 26%, rgba(255,214,150,0) 60%)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${((disc * 3.4) / BASE).toFixed(4)})`,
          opacity: wash,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* THE CARD. It overfills the frame at this range, so what it does
          on screen is take the background from black to the card's own
          near-black — which is all the cut needs it to do. */}
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
          borderRadius: 12 * frame.scale,
          background: "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
          border: `${Math.max(1, frame.scale)}px solid rgba(255,255,255,0.12)`,
          // The gallery's own card carries this; matching it means the
          // hand-off is the same pixels and not a cross-fade.
          boxShadow: `0 0 ${(34 * frame.scale).toFixed(0)}px rgba(255,255,255,0.09), 0 ${(
            18 * frame.scale
          ).toFixed(0)}px ${(50 * frame.scale).toFixed(0)}px rgba(0,0,0,0.7)`,
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
          // Positioned by TRANSFORM, not by `top`: the descent moves this
          // every frame, and `top` is a layout property — moving four
          // promoted layers that way re-lays-out and re-rasterises them
          // on every frame of the beat.
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,247,232,0.95) 0%, rgba(255,240,210,0.75) 32%, rgba(255,225,180,0.34) 46%, rgba(255,215,160,0) 62%)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${((disc * 1.62) / BASE).toFixed(4)})`,
          opacity: (1 - dark) * (fallT > 0 ? 1 : 0),
          zIndex: 2,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* THE DISC. One shape for the whole beat: the bulb's bloom, then
          the iris. It is never clipped and never replaced — only its
          colour changes, which is a fill and not a blur. */}
      <div
        aria-hidden
        data-pencil="iris"
        style={{
          position: "absolute",
          left: "50%",
          // Positioned by TRANSFORM, not by `top`: the descent moves this
          // every frame, and `top` is a layout property — moving four
          // promoted layers that way re-lays-out and re-rasterises them
          // on every frame of the beat.
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          background: `rgb(${(255 * (1 - dark)).toFixed(0)}, ${(250 * (1 - dark)).toFixed(
            0
          )}, ${(236 * (1 - dark)).toFixed(0)})`,
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(disc / BASE).toFixed(4)})`,
          opacity: fallT > 0 ? 1 : 0,
          zIndex: 3,
          willChange: "transform",
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
          // Positioned by TRANSFORM, not by `top`: the descent moves this
          // every frame, and `top` is a layout property — moving four
          // promoted layers that way re-lays-out and re-rasterises them
          // on every frame of the beat.
          top: 0,
          width: BASE,
          height: BASE,
          marginLeft: -BASE / 2,
          marginTop: -BASE / 2,
          borderRadius: "50%",
          boxShadow:
            "0 0 0 1.4px rgba(255,255,255,0.42), 0 0 20px rgba(255,255,255,0.2)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(disc / BASE).toFixed(4)})`,
          opacity: rim,
          zIndex: 4,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />
      </>)}
    </div>
  );
}
