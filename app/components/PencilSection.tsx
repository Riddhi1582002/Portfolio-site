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
import {
  BULB_REST_TOP_VH,
  bulbSizePx,
  CAP_RATIO,
  BULB_GLASS_RATIO,
  BULB_WASH_GRADIENT,
  BULB_WASH_SPREAD,
  BULB_WASH_CENTRE,
  CORD_SPILL_VH,
  CORD_SPILL_BG,
  CORD_SPILL_GLOW,
} from "./CordSection";
import { lineWidthPx, lineGlow } from "./CameraRoll";
import { carry, easeInOutSine as baseEaseInOutSine } from "../lib/motion";
import {
  NARRATION_COLOR,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

// Beats, as shares of the section's progress.
//
// FALL used to open at 0.02 — 8vh of scrolling, at the exact seam, with
// the frame held completely still before the camera would consent to
// move. The descent starts on the frame this beat becomes visible now.
const FALL = [0, 0.6] as const;
// The white circle takes over from the model as the camera arrives under it.
const BLOOM = [0.4, 0.6] as const;
// The narration belongs to the white-circle scene: it comes up under the
// circle once the descent has landed, and leaves as the circle darkens.
const LINE = [0.46, 0.72] as const;
// THE CUT, re-timed at both ends — not re-choreographed. The order it
// reads in is untouched (the light goes out, THEN the card comes up under
// it, at the same 0.12 offset and the same relative pacing).
//
// It began at 0.64 while the descent landed at 0.60, so the frame simply
// stopped for 17vh between arriving under the bulb and the light starting
// to die. It began going out at 0.60 instead: the camera settles INTO the
// light failing rather than settling, waiting, and then the light failing.
//
// And it ended at 0.90, which left the last 42vh of this beat — a tenth
// of a 420vh section — on a completely static frame before the gallery's
// pull-back picked it up. The card's arrival now lands exactly on the
// frame the pull-back starts, so the camera leaves through the iris on
// the beat the card finishes coming up behind it rather than a sixth of
// a section later.
const SWAP = [0.6, 1] as const;

// Where the circle settles: a little above the middle, with room under it
// for the narration.
const CIRCLE_Y = 0.43;

// Every round layer in this beat is this box, scaled.
const BASE = 512;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

// "Eased both ends: the camera is already moving when this beat starts"
// is what the descent below has always claimed. easeInOutSine does not do
// that — it starts at a dead stop — so the claim was only ever an
// intention. This is the curve that actually keeps it: entered with speed,
// and still settling to rest under the bulb exactly as before.
const fallEase = carry(baseEaseInOutSine, 0.18, 1);
// The light starts going out while the camera is still settling, so the
// two overlap instead of queueing. Lands on exactly 1, so the iris is
// exactly as black as it was.
const darkEase = carry(baseEaseInOutSine, 0.16, 1);
// The card behind the iris is still coming up on the frame the gallery's
// pull-back takes over. easeInOutSine brakes to nothing, so the last of
// this beat was a held frame again even after SWAP was extended to 1 —
// the arrival LANDED on the seam but arrived at it stopped. Lands on
// exactly 1, so the card is exactly as present as it was.
const cardEase = carry(baseEaseInOutSine, 0, 0.94);

export default function PencilSection({
  progress,
  sans,
  vw,
  vh,
  showBackdrop = true,
}: {
  progress: number;
  sans: string;
  vw: number;
  vh: number;
  /**
   * False for the lead-in stretch where this section is mounted early
   * (for the WebGL/GLTF warm-up) but its own progress hasn't actually
   * started yet. CordSection is still mounted underneath at that point,
   * still visibly finishing its own beat — an opaque backdrop here would
   * cover it outright, which is what used to make the cord vanish and the
   * bulb blink the instant this section mounted. See HeroSection.
   */
  showBackdrop?: boolean;
}) {
  const p = clamp01(progress);
  const frame = irisFrame(vw, vh);

  // THE DESCENT. Eased both ends: the camera is already moving when this
  // beat starts and comes to rest under the bulb.
  const fallT = fallEase(span(p, FALL[0], FALL[1]));

  // The bulb's box travels up the frame because the eye is going down.
  // It starts exactly where the cord beat parked it.
  const bulbPx = bulbSizePx(vw, vh);
  const restTop = (BULB_REST_TOP_VH / 100) * vh;
  const endTop = CIRCLE_Y * vh - bulbPx / 2;
  const bulbTop = restTop + (endTop - restTop) * fallT;
  const circleY = bulbTop + bulbPx / 2;

  // The white circle takes over from the model as the underside blows out.
  const bloom = easeInOutSine(span(p, BLOOM[0], BLOOM[1]));

  // THE CIRCLE'S OWN SIZE, while it is still crossfading with the model.
  //
  // frame.iris (used once the descent has landed) is calibrated for the
  // bulb seen from directly beneath — a foreshortened ~54% of its box.
  // BLOOM and FALL end at the same point (p 0.6), so for the whole
  // crossfade the camera is STILL pitching down and the model is still
  // showing something closer to its frontal silhouette, which fills far
  // more of the box. Fading the flat circle in at its final, foreshortened
  // size while the outgoing 3D bulb was still visibly larger read as two
  // objects of two different sizes swapping rather than one settling into
  // the other. This eases the circle's own diameter down from a near-full
  // start to frame.iris exactly as fallT reaches 1 — the same moment the
  // descent itself completes — so the two stay the same size, and the
  // same position, for as long as they overlap.
  // Full box width to start (a frontal bulb all but fills its own
  // bounding box), and eased with fallT^1.7 rather than fallT itself: the
  // foreshortening that shrinks the glass toward BULB_GLASS_RATIO is
  // itself back-loaded into the last part of the pitch, not linear in it,
  // so matching fallT one-for-one still left the circle visibly smaller
  // than the bulb through the middle of the crossfade.
  const CIRCLE_START_RATIO = 1;
  const circleShrinkT = Math.pow(fallT, 1.7);
  const circleDia =
    bulbPx * (CIRCLE_START_RATIO + (BULB_GLASS_RATIO - CIRCLE_START_RATIO) * circleShrinkT);

  // The cut. The card comes up first, then the circle darkens — so the
  // order the eye reads is "there is something behind this light", then
  // "the light was a hole".
  // The circle goes black FIRST and the card comes up under it after.
  // Overlapping them showed a lit white circle sitting on a card with the
  // narration still over it — three states of the beat at once.
  const dark = darkEase(span(p, SWAP[0], SWAP[0] + 0.16));
  const cardIn = cardEase(span(p, SWAP[0] + 0.12, SWAP[1]));
  const rim = dark;

  // Once the circle is black it is the gallery's iris, so it takes the
  // gallery's position: the card's centre, which is the frame's centre.
  const discCentreY = circleY + (vh / 2 - circleY) * dark;

  const lineFocus = span(p, LINE[0], LINE[1] - 0.1);
  const lineOpacity = Math.min(
    span(p, LINE[0], LINE[0] + 0.07),
    1 - span(p, LINE[1] - 0.07, LINE[1])
  );

  // THE CORD, still hanging above the bulb — CordSection's own line,
  // continued. Without this the wire simply stopped existing the instant
  // this section took over, which is exactly the "disappears" bug: the
  // bulb is meant to still be hanging from something. It runs from the
  // top of the frame down to the cap, exactly where CordSection's own
  // line ends, and fades with the model itself (`1 - bloom`) rather than
  // in a single frame, so it leaves only once the camera has genuinely
  // passed beneath the bulb and looking back up at a wire would no longer
  // make sense.
  const cordOpacity = 1 - bloom;
  const cordBottom = bulbTop + bulbPx * CAP_RATIO;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: showBackdrop ? "#000" : "transparent",
        // Before real progress starts this section is mounted only to keep
        // its WebGL context and GLTF warm (see showBackdrop's own comment).
        // The background being transparent was not enough on its own: the
        // bulb model below is rendered unconditionally at litness=1 the
        // instant this section mounts, which is BEFORE CordSection's own
        // bulb has actually finished brightening (the carousel can still be
        // mid-exit at that point) — so a second, already-fully-lit bulb
        // popped in on top of the real, still-dimming one. Hiding the whole
        // section until showBackdrop flips true removes that premature
        // duplicate; at the exact frame it flips, CordSection's own bulb
        // has already reached litness 1 (they share the same boundary), so
        // nothing visibly changes when this section takes over.
        opacity: showBackdrop ? 1 : 0,
      }}
    >
      {cordOpacity > 0.001 && (
        <>
          <div
            aria-hidden
            data-pencil="cord"
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              height: Math.max(0, cordBottom),
              width: lineWidthPx(vh),
              transform: "translateX(-50%)",
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 5%, #fff 55%, rgb(255,250,240) 88%, rgb(255,242,220) 100%)",
              opacity: cordOpacity,
              borderRadius: 2,
              zIndex: 1,
              pointerEvents: "none",
              willChange: "opacity",
            }}
          />
          {/* The warm spill on the line's last stretch — CordSection's
              own, continued. Without it the bottom of the wire went from
              lit to plain white on the frame the beats changed hands,
              while the bulb it is lit BY is still hanging right there. */}
          <div
            aria-hidden
            data-pencil="cord-spill"
            style={{
              position: "absolute",
              left: "50%",
              top: Math.max(0, cordBottom - (CORD_SPILL_VH / 100) * vh),
              height: `${CORD_SPILL_VH}vh`,
              width: lineWidthPx(vh),
              transform: "translateX(-50%)",
              background: CORD_SPILL_BG,
              boxShadow: CORD_SPILL_GLOW,
              opacity: cordOpacity,
              borderRadius: 2,
              zIndex: 1,
              pointerEvents: "none",
              willChange: "opacity",
            }}
          />
          <div
            aria-hidden
            data-pencil="cord-glow"
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              height: Math.max(0, cordBottom),
              width: lineWidthPx(vh),
              transform: "translateX(-50%)",
              boxShadow: lineGlow(0.92),
              borderRadius: 2,
              opacity: cordOpacity,
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        </>
      )}

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

      {/* THE LIGHT IN THE ROOM, ARRIVING ALREADY LIT.
          The bulb has been burning for a whole section; the eye moving
          under it does not switch it on. This layer IS the cord beat's
          wash — same three falloffs, same spread, same hot spot on the
          filament — held at full on the frame this beat takes over and
          cross-dissolved into the wash below as the camera comes beneath
          the glass and the light stops reading as a lamp in a room and
          starts reading as a disc. The two opacities sum to (1 - dark)
          throughout, so the room never dims for the swap; it only changes
          what shape the light is. */}
      {fallT < 0.999 && (
        <div
          aria-hidden
          data-pencil="wash-carried"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: bulbPx * BULB_WASH_SPREAD,
            height: bulbPx * BULB_WASH_SPREAD,
            marginLeft: (-bulbPx * BULB_WASH_SPREAD) / 2,
            marginTop: (-bulbPx * BULB_WASH_SPREAD) / 2,
            borderRadius: "50%",
            background: BULB_WASH_GRADIENT,
            transform: `translateY(${(bulbTop + bulbPx * BULB_WASH_CENTRE).toFixed(1)}px)`,
            opacity: (1 - fallT) * (1 - dark),
            willChange: "transform, opacity",
            pointerEvents: "none",
          }}
        />
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
            (circleDia * 3.6) /
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
            (circleDia * 1.7) /
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
            circleDia / BASE
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
            circleDia / BASE
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
