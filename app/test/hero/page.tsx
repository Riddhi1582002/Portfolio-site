"use client";

import { useEffect, useRef } from "react";
import { Playfair_Display } from "next/font/google";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Standalone test page — not linked from the site nav.
// Visit directly at /test/hero.

const artFont = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

// Not a Google Font — falls back to system sans until a real
// "Neue Montreal" font file is added to the project.
const nameFontFamily =
  '"Neue Montreal", ui-sans-serif, system-ui, -apple-system, sans-serif';

/* ============================================================
 * TUNABLES — everything below drives the scroll choreography.
 * Edit these values and reload; nothing below this block needs
 * to change. Timing values are expressed in "beats", where one
 * beat = SCROLL_VH_PER_BEAT of scroll (viewport-heights). Total
 * pinned scroll distance = SCROLL_VH_PER_BEAT * TOTAL_BEATS.
 * ============================================================ */

const YOUR_NAME = "Your Name";

const SCROLL_VH_PER_BEAT = 100;
const TOTAL_BEATS = 3;

// Seconds of lag gsap smooths the scrub over (0 = tracks scroll 1:1).
const SCRUB_SMOOTHING = 0.5;

// ART grows ART_SCALE_RATIO times faster than the name block, both
// starting at scale 1 and reaching their target by the end of the pin.
const NAME_SCALE_TO = 1.15;
const ART_SCALE_RATIO = 6;
const ART_SCALE_TO = 1 + (NAME_SCALE_TO - 1) * ART_SCALE_RATIO;

// Stacked drop-shadow glow behind "ART". Each layer's blur and the
// shared opacity interpolate down to 0 (flat white) over the beat
// window below.
const GLOW_LAYERS = [
  { blurFrom: 8, blurTo: 0 },
  { blurFrom: 24, blurTo: 0 },
  { blurFrom: 48, blurTo: 0 },
];
const GLOW_OPACITY_FROM = 0.85;
const GLOW_OPACITY_TO = 0;
const GLOW_FADE_START_BEAT = 0;
const GLOW_FADE_END_BEAT = TOTAL_BEATS;

// The sentence line fades in over this beat window (0 = pin start,
// TOTAL_BEATS = pin end). Defaults to appearing partway through.
const SENTENCE_FADE_START_BEAT = 1.1;
const SENTENCE_FADE_END_BEAT = 1.9;

/* ============================================================ */

export default function HeroTestPage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const art = artRef.current;
    const name = nameRef.current;
    const sentence = sentenceRef.current;
    if (!section || !art || !name || !sentence) return;

    const ctx = gsap.context(() => {
      const state = { p: 0 };

      const glowStart = GLOW_FADE_START_BEAT / TOTAL_BEATS;
      const glowEnd = GLOW_FADE_END_BEAT / TOTAL_BEATS;
      const sentenceStart = SENTENCE_FADE_START_BEAT / TOTAL_BEATS;
      const sentenceEnd = SENTENCE_FADE_END_BEAT / TOTAL_BEATS;

      gsap.to(state, {
        p: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () =>
            `+=${((SCROLL_VH_PER_BEAT * TOTAL_BEATS) / 100) * window.innerHeight}`,
          pin: true,
          scrub: SCRUB_SMOOTHING,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const p = state.p;

          // 1. Glow: stacked drop-shadow blur/opacity fades to flat white.
          const glowP = gsap.utils.clamp(
            0,
            1,
            gsap.utils.mapRange(glowStart, glowEnd, 0, 1, p)
          );
          art.style.filter = GLOW_LAYERS.map((layer) => {
            const blur = gsap.utils.interpolate(layer.blurFrom, layer.blurTo, glowP);
            const opacity = gsap.utils.interpolate(
              GLOW_OPACITY_FROM,
              GLOW_OPACITY_TO,
              glowP
            );
            return `drop-shadow(0 0 ${blur}px rgba(255,255,255,${opacity}))`;
          }).join(" ");

          // 2. Scale: ART scales up faster than the name block.
          const artScale = gsap.utils.interpolate(1, ART_SCALE_TO, p);
          const nameScale = gsap.utils.interpolate(1, NAME_SCALE_TO, p);
          art.style.transform = `scale(${artScale})`;
          name.style.transform = `scale(${nameScale})`;

          // 3. Sentence fades in partway through the pin.
          const sentenceP = gsap.utils.clamp(
            0,
            1,
            gsap.utils.mapRange(sentenceStart, sentenceEnd, 0, 1, p)
          );
          sentence.style.opacity = String(sentenceP);
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    // Plain block wrapper: keeps the pinned section from being a direct
    // flex-item child of the root layout's flex-column body, which
    // otherwise stops gsap from sizing the pin spacer correctly.
    <div>
      <div
        ref={sectionRef}
        className="relative h-screen w-full overflow-hidden bg-black"
      >
        <span
          ref={artRef}
          className={`${artFont.className} pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none text-white`}
          style={{ fontSize: "clamp(4rem, 16vw, 14rem)" }}
        >
          ART
        </span>

        <div
          className="absolute inset-x-0 z-10 flex flex-col items-center px-6 text-center"
          style={{ top: "40vh" }}
        >
          <div
            ref={nameRef}
            className="text-white/90"
            style={{
              fontFamily: nameFontFamily,
              fontSize: "0.8rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {YOUR_NAME}
          </div>

          <p
            ref={sentenceRef}
            className="mt-4 max-w-sm text-sm text-white/70"
            style={{ fontFamily: nameFontFamily, opacity: 0 }}
          >
            is just a name. What actually makes me is my—
          </p>
        </div>
      </div>
    </div>
  );
}
