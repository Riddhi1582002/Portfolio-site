"use client";

// The descent past the bulb, and the match cut out of it.
//
// THE MOVE. The camera keeps going down along Y and pitches up on X. The
// BULB does not move — it is the same bulb, hanging where the cord beat
// left it — so it rises through the frame and turns from a frontal view
// to its underside as the eye passes beneath it. Seen from under, with
// the filament driven up, the envelope stops reading as an object and
// becomes a bright white circle. That circle stays exactly what it is —
// lit, white, unchanging — and glides to the gallery's own centred
// position; the cut to the gallery's real artwork (InfiniteCanvas,
// already sitting behind this section at the identical size and
// position — see IRIS_HANDOFF_AT and HeroSection's own use of it) happens
// only once it has arrived there and settled. There used to be a second
// stage in between — the circle itself darkening to a flat black disc,
// with a white rim drawn on it to read as a hole rather than a gap, and a
// placeholder card fading in behind that black disc before the real
// artwork ever appeared — which is exactly the intermediate state the
// spec rules out: no black circle, no white outline on an empty circle,
// ever visible on screen. WHITE CIRCLE -> IRIS ARTWORK, nothing between.
//
// The circle NEVER changes size. It is the bulb's own glass, so it is
// whatever the bulb is on screen, and InfiniteCanvas's own card behind it
// takes the size that keeps the card-to-circle ratio the gallery's own
// card has. Both numbers come from InfiniteCanvas's `irisFrame`, so the
// frame this beat ends on and the frame the pull-back opens on are the
// same pixels — which is what makes the hard cut between the two
// components land seamlessly instead of as a jump.
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
// Driven off `fallT` below rather than off `p` directly — see its use — so
// the crossfade cannot start until the descent has actually nearly landed.
// The narration belongs to the white-circle scene: it comes up under the
// circle once the descent has landed, and leaves as the circle darkens.
const LINE = [0.46, 0.72] as const;
// THE SETTLE: once the narration has had its say, the (still white, still
// lit) circle glides from its own resting position — a little above
// centre, with room for that narration under it — to the gallery's own
// centred position, arriving exactly as InfiniteCanvas's real artwork
// takes over. Starts a beat after LINE's own fade-out finishes (0.72) so
// the two moves never overlap, and finishes at IRIS_HANDOFF_AT, which
// HeroSection uses verbatim as the exact scroll position it hands the
// beat to InfiniteCanvas — so the circle is already sitting still, at the
// gallery's own size and position, for a moment before the cut, not
// caught mid-glide by it.
const SETTLE = [0.74, 0.92] as const;
/**
 * Where this section hands off to InfiniteCanvas (as a share of THIS
 * section's own progress) — exported so HeroSection can make InfiniteCanvas
 * visible at exactly this point rather than only at progress 1. A hard cut,
 * not a cross-fade: the two are drawn from the same `irisFrame` geometry
 * (see the file-level comment), so at this exact frame they are pixel
 * identical and swapping which one is on screen changes nothing visible.
 */
export const IRIS_HANDOFF_AT = 0.94;

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
  //
  // Driven off `fallT` (how far the descent has actually landed), not off
  // `p` directly. It used to be span(p, 0.4, 0.6) — a fixed window of
  // scroll that started well before the camera had actually arrived under
  // the bulb, so the model-to-circle crossfade was visibly under way while
  // the descent was still only two-thirds landed. Gated on fallT instead,
  // it cannot begin until the camera is nearly all the way there, and it
  // still finishes on exactly the same frame as before (fallT reaches 1
  // exactly when FALL's own p-window ends).
  const bloom = easeInOutSine(span(fallT, 0.82, 1));

  // THE CIRCLE'S OWN SIZE, while it is still crossfading with the model.
  //
  // frame.iris (used once the descent has landed) is calibrated for the
  // bulb seen from directly beneath — a foreshortened ~54% of its box.
  // `bloom`'s own window and FALL end at the same point, so for the whole
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

  // THE GLIDE to the gallery's own centred position — see SETTLE's own
  // comment. The circle's colour and size are untouched by this; only
  // where it sits moves, so that by IRIS_HANDOFF_AT it is dead centre,
  // exactly where InfiniteCanvas's own reveal is centred too.
  const settle = easeInOutSine(span(p, SETTLE[0], SETTLE[1]));
  const discCentreY = circleY + (vh / 2 - circleY) * settle;

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
          starts reading as a disc. The two opacities always sum to 1,
          so the room never dims for the swap; it only changes what shape
          the light is. */}
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
            opacity: 1 - fallT,
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
          opacity: fallT,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

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
          opacity: bloom,
          zIndex: 2,
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      />

      {/* THE CIRCLE. The bulb's own glass, at the bulb's own size, for the
          rest of the beat — lit white throughout. Its size never changes,
          and neither does its colour: it hands off to InfiniteCanvas's
          real artwork (IRIS_HANDOFF_AT, see HeroSection) while still this
          same white, rather than darkening into a placeholder first. */}
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
          background: "rgb(255, 250, 240)",
          transform: `translateY(${discCentreY.toFixed(1)}px) scale(${(
            circleDia / BASE
          ).toFixed(4)})`,
          opacity: bloom,
          zIndex: 3,
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
