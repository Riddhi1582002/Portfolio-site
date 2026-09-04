"use client";

// Hero -> REELS entry, built as a portal mask.
//
// A REELS layer (the filmstrip) sits behind ART from the start, already
// full-size. Over it sits an opaque ART layer, and the "A"'s crossbar is
// cut out of that layer as a mask aperture — so at rest you are looking
// at ART on black with a thin crossbar-shaped slot showing the filmstrip
// through it. Scroll progress grows that aperture from its real crossbar
// geometry until it has eaten the whole ART layer, leaving the filmstrip
// filling the viewport. ART is never crossfaded; it is cut away.
//
// The aperture is a clip-path on the ART layer rather than an SVG <mask>
// so the wordmark can stay real HTML text and keep its exact glow stack
// (SVG has no text-shadow, and rebuilding the four layers as an SVG
// filter would not match). evenodd fill-rule: the outer stage rect paints
// the layer, the inner crossbar subpath punches the hole.
//
// Crossbar geometry is the real thing, not eyeballed: taken from the
// Dream Avenue Regular "A" glyph outline via fonttools (the crossbar
// contour's y/x band, converted through the font's hhea ascent/descent to
// a CSS line-box baseline position) at the hero's exact ART styling, and
// anchored to the deep stage, where the hero's own scroll track ends.

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import {
  ART_FONT,
  ART_SCALE_DEEP,
  ART_Y_DEEP,
  GLOW_STRENGTH,
  STAGE_H,
  STAGE_W,
  glowShadow,
} from "./HeroSection";

gsap.registerPlugin(ScrollTrigger);

const SCROLL_LENGTH_VH = 220;

// -- Crossbar geometry, derived from the "A" glyph outline (unitsPerEm
// 1000, hhea ascent 750 / descent -250) at the hero's ART styling
// (fontSize 462, lineHeight 0.86, letterSpacing 0.005em, textAlign
// center) with 3-letter "ART" advance widths (A 627, R 580, T 630):
//   baseline-from-line-box-top = 462 * ((0.86-1)/2 + 0.75) = 314.16px
//   crossbar y-band (font units 299-325 above baseline) -> 170.01px from
//   the div's top edge; x-band (units 174-361, glyph-local) with the "A"
//   pen starting at -(total advance)/2 -> -346.27..-259.88 from centre.
const CROSSBAR_OFFSET_X = -303.072;
const CROSSBAR_OFFSET_Y = -28.65;
const CROSSBAR_WIDTH_UNSCALED = 86.394;
const CROSSBAR_THICKNESS_UNSCALED = 12.01;

const ART_VERTICAL_CENTER = 540 + ART_Y_DEEP;
const CROSSBAR_CENTER_X = STAGE_W / 2 + CROSSBAR_OFFSET_X * ART_SCALE_DEEP;
const CROSSBAR_CENTER_Y = ART_VERTICAL_CENTER + CROSSBAR_OFFSET_Y * ART_SCALE_DEEP;
const CROSSBAR_WIDTH = CROSSBAR_WIDTH_UNSCALED * ART_SCALE_DEEP;
const CROSSBAR_THICKNESS = CROSSBAR_THICKNESS_UNSCALED * ART_SCALE_DEEP;

// Scale at which the aperture, growing about the crossbar's own fixed
// (off-centre) position, has covered the stage in both axes. The crossbar
// is wide and thin, so height is the binding constraint, not width:
//   half-height >= max(cy, STAGE_H - cy)  ->  s >= ~56
const APERTURE_FULL_SCALE =
  (2 * Math.max(CROSSBAR_CENTER_Y, STAGE_H - CROSSBAR_CENTER_Y)) / CROSSBAR_THICKNESS;

// The filmstrip behind ART, centred on the crossbar so the slot opens
// straight onto it.
const REEL_BAND_HEIGHT = 430;
const REEL_FRAME_W = 300;
const REEL_FRAME_GAP = 24;
const REEL_FRAME_COUNT = 9;

// Deep-stage glow (g = interpolate([0,1,2],[1.15,0.5,0.5])(2) * GLOW_STRENGTH,
// breath settled to 0) — matching where the hero's ART glow lands.
const ART_DEEP_G = 0.5 * GLOW_STRENGTH;

function aperturePath(scale: number): string {
  const hw = (CROSSBAR_WIDTH * scale) / 2;
  const hh = (CROSSBAR_THICKNESS * scale) / 2;
  const x0 = CROSSBAR_CENTER_X - hw;
  const x1 = CROSSBAR_CENTER_X + hw;
  const y0 = CROSSBAR_CENTER_Y - hh;
  const y1 = CROSSBAR_CENTER_Y + hh;
  const r = Math.min(hw, hh) * 0.5;
  const hole =
    `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} ` +
    `V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} ` +
    `A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
  return `path(evenodd, "M0 0 H${STAGE_W} V${STAGE_H} H0 Z ${hole}")`;
}

export default function FilmstripEntry() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artLayerRef = useRef<HTMLDivElement>(null);

  // The aperture is positioned from Dream Avenue's real glyph metrics, so
  // it only lines up with "ART" once that webfont has actually swapped in
  // (next/font/local, display:'swap'). Until then the browser paints the
  // fallback, whose "A" has different proportions, and the slot would sit
  // somewhere that isn't the crossbar.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      if (stageRef.current) stageRef.current.style.transform = `scale(${scale})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (!fontsReady || !wrapperRef.current || !artLayerRef.current) return;

    // gsap.context()/ctx.revert() is GreenSock's documented React pattern:
    // StrictMode (on in `next dev`) mounts effects twice, and ScrollTrigger's
    // pin mutates the DOM, which a bare kill() does not reliably revert
    // before the second mount re-measures.
    const ctx = gsap.context(() => {
      const aperture = { scale: 1 };
      const draw = () => {
        if (artLayerRef.current) {
          artLayerRef.current.style.clipPath = aperturePath(aperture.scale);
        }
      };
      draw();

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: pinRef.current,
        },
      });

      // 0-15%: held. The aperture is exactly the crossbar — a thin slot in
      // the "A" showing the filmstrip already sitting behind it.
      tl.to(aperture, { scale: 1, duration: 0.15, onUpdate: draw }, 0);
      // 15-30%: the aperture grows from the crossbar's own fixed position,
      // cutting the ART layer away and opening onto the filmstrip.
      tl.to(
        aperture,
        { scale: APERTURE_FULL_SCALE, duration: 0.15, ease: "power2.inOut", onUpdate: draw },
        0.15
      );
      // 30%+: holds open. Also extends the timeline's own duration to 1 so
      // the scrub maps 0-1 of scroll onto these positions as fractions —
      // without it the timeline is only 0.30 long and every beat above
      // gets compressed into the first 30% of the scroll range.
      tl.to(aperture, { scale: APERTURE_FULL_SCALE, duration: 0.7, onUpdate: draw }, 0.3);
    });

    return () => ctx.revert();
  }, [fontsReady]);

  const reelTotalW = REEL_FRAME_COUNT * (REEL_FRAME_W + REEL_FRAME_GAP) - REEL_FRAME_GAP;

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", height: `${SCROLL_LENGTH_VH}vh`, zIndex: 1 }}
    >
      <div
        ref={pinRef}
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={stageRef}
          style={{ position: "relative", width: STAGE_W, height: STAGE_H, flexShrink: 0 }}
        >
          {/* REELS layer — behind ART from the start, already full size. */}
          <div
            style={{
              position: "absolute",
              left: (STAGE_W - reelTotalW) / 2,
              top: CROSSBAR_CENTER_Y - REEL_BAND_HEIGHT / 2,
              width: reelTotalW,
              height: REEL_BAND_HEIGHT,
              display: "flex",
              gap: REEL_FRAME_GAP,
            }}
          >
            {Array.from({ length: REEL_FRAME_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  width: REEL_FRAME_W,
                  height: REEL_BAND_HEIGHT,
                  flexShrink: 0,
                  borderRadius: 18,
                  border: "2px solid rgba(255,255,255,0.55)",
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            ))}
          </div>

          {/* ART layer — opaque, over the filmstrip, cut away by the
              growing crossbar aperture (clipPath, set in the effect). */}
          <div
            ref={artLayerRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              // Pre-effect state: hole closed, so the filmstrip is never
              // briefly visible through a slot in the wrong place.
              clipPath: `path(evenodd, "M0 0 H${STAGE_W} V${STAGE_H} H0 Z")`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: ART_VERTICAL_CENTER,
                transform: `translateY(-50%) scale(${ART_SCALE_DEEP})`,
                textAlign: "center",
                fontFamily: ART_FONT,
                fontWeight: 400,
                fontSize: 462,
                lineHeight: 0.86,
                letterSpacing: "0.005em",
                color: "#fff",
                textShadow: glowShadow(ART_DEEP_G),
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              ART
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
