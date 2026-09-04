"use client";

// Hero -> REELS entry: the crossbar of "ART" is a horizontal row of
// rounded-rect frame boxes (an SVG group) sitting exactly over the "A"'s
// real crossbar, authored in from the start at small scale/low opacity so
// it reads as part of the crossbar stroke, not a separate element. A
// single ScrollTrigger-scrubbed timeline then scales that group up
// (pivoting on its own fixed screen position) while the frozen ART
// snapshot crossfades out, so by 30% it has become a full-width filmstrip
// bar — ready for a horizontal scroll-scrub this component doesn't build.
//
// Crossbar geometry below (position, size) is exact, not eyeballed: it
// comes from the Dream Avenue Regular "A" glyph's real outline (via
// fonttools — ymin/ymax band of the crossbar contour, its x-extent, and
// the font's hhea ascent/descent for CSS line-box baseline placement),
// converted into this file's "stage" units the same way the rest of the
// hero's geometry is authored, anchored to ART's deep-stage position
// (ART_Y_DEEP/ART_SCALE_DEEP) since this section picks up where the hero
// leaves off.

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
// center) with 3-letter "ART" advance widths (A 627, R 580, T 630) --
// all in the div's own unscaled-by-artScale local space:
//   baseline-from-line-box-top = fontSize * ((lineHeight-1)/2 + ascentFrac)
//                               = 462 * (-0.07 + 0.75) = 314.16px
//   crossbar y-band (font units 299-325 from baseline) -> px: 138.14-150.15,
//   midpoint 144.15 above baseline -> 170.01px from the div's own top edge
//   crossbar x-band (font units 174-361, "A" glyph-local) -> px: 80.39-166.78;
//   "A" pen-start x = -(totalAdvance)/2 = -426.657 (totalAdvance includes
//   2 letter-spacing gaps between A/R/T) -> crossbar x: -346.27 to -259.88
// Offsets from the div's own center (both axes), still in unscaled units:
const CROSSBAR_OFFSET_X = -303.072; // horizontal, from div's horizontal center
const CROSSBAR_OFFSET_Y = -28.65; // vertical, from div's vertical center
const CROSSBAR_WIDTH_UNSCALED = 86.394;
const CROSSBAR_THICKNESS_UNSCALED = 12.01;

// Anchored to the deep stage (this section continues from where the
// hero's own scroll track ends), in stage-space (STAGE_W x STAGE_H)
// units — same convention as artY/artScale in HeroSection.tsx.
const ART_VERTICAL_CENTER = 540 + ART_Y_DEEP;
const CROSSBAR_CENTER_X = STAGE_W / 2 + CROSSBAR_OFFSET_X * ART_SCALE_DEEP;
const CROSSBAR_CENTER_Y = ART_VERTICAL_CENTER + CROSSBAR_OFFSET_Y * ART_SCALE_DEEP;
const CROSSBAR_WIDTH = CROSSBAR_WIDTH_UNSCALED * ART_SCALE_DEEP;
const CROSSBAR_THICKNESS = CROSSBAR_THICKNESS_UNSCALED * ART_SCALE_DEEP;

// Box-row's own scale=1 state is authored to exactly match the crossbar
// (see left/top/width/height below) — the "small scale, low opacity"
// look for beats 0-15% is a further shrink+dim applied on top of that
// via GSAP, not baked into the SVG's own geometry.
const REST_SCALE = 0.3;
const REST_OPACITY = 0.35;

// Scale needed for the box-row (pivoting on its own fixed, off-center
// crossbar position) to cover the viewport edge-to-edge horizontally.
// The pivot sits left of stage-center (crossbar is inside the "A", the
// first letter), so the binding constraint is reaching the RIGHT edge:
// width/2 >= STAGE_W - CROSSBAR_CENTER_X.
const FILMSTRIP_SCALE =
  (2 * (STAGE_W - CROSSBAR_CENTER_X)) / CROSSBAR_WIDTH;

const BOX_COUNT = 10;
const BOX_GAP = 4;

// Deep-stage glow (g = interpolate([0,1,2],[1.15,0.5,0.5])(2) * GLOW_STRENGTH,
// breath settled to 0) — the frozen ART snapshot's baseline look, matching
// exactly where the hero's own ART glow settles by the end of its scroll.
const ART_DEEP_G = 0.5 * GLOW_STRENGTH;

export default function FilmstripEntry() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const boxRowRef = useRef<SVGSVGElement>(null);

  // The crossbar box-row's position/size is computed from Dream Avenue
  // Regular's real glyph metrics — it only lines up with "ART" once that
  // (next/font/local, display:'swap') webfont has actually swapped in.
  // Before that, the browser paints ART in its fallback (Juana/Georgia),
  // whose "A" has entirely different proportions, so the box-row would
  // sit wherever Dream Avenue's crossbar is while the visible glyph is a
  // different shape underneath it — exactly "off-position, overlapping
  // the letterforms incorrectly". Hold the whole scene at rest, box-row
  // hidden, until fonts.ready confirms the swap happened.
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
    if (!fontsReady || !wrapperRef.current || !artRef.current || !boxRowRef.current) return;

    // gsap.context() (GreenSock's documented React integration pattern)
    // instead of a bare timeline + manual kill(): under React StrictMode
    // (on by default in `next dev`, off in a production build), effects
    // mount -> cleanup -> mount once on initial render. ScrollTrigger's
    // pin mutates the DOM (position:fixed, an inserted pin-spacer sized
    // from geometry measured at creation time); a bare `.kill()` doesn't
    // reliably revert that synchronously before the second mount measures
    // geometry again, so the *second* (real) instance can end up pinning
    // against an already-perturbed layout — which reads exactly like "the
    // box-row is off-position/wrong-scale/overlapping the letterforms",
    // despite the anchor math itself (transform-origin locked to the
    // crossbar's own screen rect, see the <svg>'s left/top/width/height
    // below) being unchanged. ctx.revert() fully undoes pinning and every
    // gsap.set()/tween's inline styles before the real mount runs.
    const ctx = gsap.context(() => {
      gsap.set(boxRowRef.current, {
        scale: REST_SCALE,
        opacity: REST_OPACITY,
        transformOrigin: "50% 50%",
      });
      gsap.set(artRef.current, { opacity: 1 });

      // trigger = the tall (SCROLL_LENGTH_VH-vh) wrapper, whose own height
      // is the scroll distance ('bottom bottom' = one-to-one, no extra
      // multiplication); pin targets only the 100vh inner viewport, not
      // the tall wrapper itself.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: pinRef.current,
        },
      });

      // 0-15%: held at rest (small scale, low opacity, "ART" fully visible).
      tl.to(boxRowRef.current, { scale: REST_SCALE, opacity: REST_OPACITY, duration: 0.15 }, 0);
      // 15-30%: box-row scales up from its own fixed center (crossbar's
      // screen position, set via transform-origin above) while ART's
      // strokes crossfade out.
      tl.to(
        boxRowRef.current,
        { scale: FILMSTRIP_SCALE, opacity: 1, duration: 0.15, ease: "power2.inOut" },
        0.15
      );
      tl.to(artRef.current, { opacity: 0, duration: 0.15, ease: "power2.inOut" }, 0.15);
      // 30%+: holds filled — reserved for the (not yet built) horizontal
      // filmstrip scroll-scrub. Also extends the timeline's own total
      // duration to exactly 1 (0.15 + 0.15 + 0.70), which is what makes
      // the scrub's 0-1 scroll progress line up with the 0/0.15/0.30
      // positions above as fractions rather than raw timeline-seconds —
      // without this hold the timeline's natural duration is only 0.30,
      // silently compressing every beat above into the first 30% of scroll.
      tl.to(boxRowRef.current, { scale: FILMSTRIP_SCALE, opacity: 1, duration: 0.7 }, 0.3);
    });

    return () => ctx.revert();
  }, [fontsReady]);

  const boxWidth = (CROSSBAR_WIDTH - (BOX_COUNT - 1) * BOX_GAP) / BOX_COUNT;
  const rx = CROSSBAR_THICKNESS * 0.28;

  return (
    <div ref={wrapperRef} style={{ position: "relative", height: `${SCROLL_LENGTH_VH}vh`, zIndex: 1 }}>
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
          <div
            ref={artRef}
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

          <svg
            ref={boxRowRef}
            style={{
              position: "absolute",
              left: CROSSBAR_CENTER_X - CROSSBAR_WIDTH / 2,
              top: CROSSBAR_CENTER_Y - CROSSBAR_THICKNESS / 2,
              width: CROSSBAR_WIDTH,
              height: CROSSBAR_THICKNESS,
              // Matches REST_SCALE/REST_OPACITY once gsap.set() takes
              // over post-fonts-ready; opacity 0 (not those values) for
              // the wait itself so a fallback-font-shaped "A" is never
              // visible with the crossbar row sitting on top of it.
              opacity: fontsReady ? undefined : 0,
            }}
            viewBox={`0 0 ${CROSSBAR_WIDTH} ${CROSSBAR_THICKNESS}`}
          >
            {Array.from({ length: BOX_COUNT }, (_, i) => (
              <rect
                key={i}
                x={i * (boxWidth + BOX_GAP)}
                y={0}
                width={boxWidth}
                height={CROSSBAR_THICKNESS}
                rx={rx}
                fill="rgba(255,255,255,0.12)"
                stroke="#fff"
                strokeWidth={CROSSBAR_THICKNESS * 0.06}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
