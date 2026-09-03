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

// ART's resting (unscaled) size, in vh so it scales with the same
// vertical reference as the name/tagline block (top: 40vh) instead of
// vw. Mixing axes was the actual bug: a vw-based size made ART's rest
// size (and thus its clearance from the tagline) swing wildly with
// viewport aspect ratio — fine at 1280x800, but overlapping the
// tagline for its *entire* visible window at 375x812 and 1920x600
// (caught by sweeping multiple viewport shapes, not just one). vh
// keeps the clearance, as a fraction of scroll, viewport-shape-stable.
const ART_FONT_SIZE = "clamp(2rem, 4.5vh, 3rem)";

const SCROLL_VH_PER_BEAT = 100;
const TOTAL_BEATS = 3;

// Seconds of lag gsap smooths the scrub over (0 = tracks scroll 1:1).
const SCRUB_SMOOTHING = 0.5;

// ART's final scale is computed at runtime (see
// ART_FINAL_WIDTH_VS_VIEWPORT below), not a fixed multiplier — a fixed
// ART_SCALE_TO tuned to one viewport (1280x800) passed there but
// FAILED the "exceeds viewport width" requirement at 1920x1080
// (1539px final width < 1920px viewport). Computing the scale from a
// live measurement of ART's own rest width and the current
// window.innerWidth guarantees the requirement holds at any viewport
// size.
const NAME_SCALE_TO = 1.15;

// ART's final rendered width targets this fraction of the viewport
// width — comfortably past 1 so it visibly crops at both edges rather
// than just barely clearing it.
const ART_FINAL_WIDTH_VS_VIEWPORT = 1.15;

// ART's growth is eased (progress^ART_GROWTH_EASE_POWER) instead of
// linear, so it stays near scale 1 — clear of the tagline row — through
// the tagline's whole fade in/out, then grows sharply in the back half
// of the pin. Higher power = flatter start, steeper finish.
const ART_GROWTH_EASE_POWER = 5;

// Contact info shown in the corner. Fades to 0 opacity over the same
// scroll range as the name block's scale animation (the whole pin).
const CONTACT_INFO = "hello@yourdomain.com";
const CONTACT_OPACITY_FROM = 0.7;

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

// The sentence's fade in/out window is NOT a fixed beat range — fixed
// beats (tried first: 0.3-1.2) passed at normal aspect ratios but broke
// at extreme ones (375x812 portrait, 1920x600 short-and-wide), because
// how much scroll ART can safely take before its box reaches the
// tagline's row depends on the live geometry of both, not a constant.
// Instead the safe window is computed at runtime from actual measured
// positions (see SENTENCE_SAFETY_MARGIN below) and the in/out points
// below are fractions of that computed safe window, not of TOTAL_BEATS.
const SENTENCE_FADE_IN_START_FRAC = 0.2;
const SENTENCE_FADE_IN_END_FRAC = 0.55;
const SENTENCE_FADE_OUT_END_FRAC = 0.85;

// Extra shrink applied to the geometrically-safe scroll point before
// the tagline must have finished fading out — a margin of safety on
// top of "just barely doesn't overlap".
const SENTENCE_SAFETY_MARGIN = 0.85;

// Minimum pixel gap to keep between ART's box and the tagline's box.
const SAFETY_BUFFER_PX = 12;

/* ============================================================ */

export default function HeroTestPage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const art = artRef.current;
    const name = nameRef.current;
    const sentence = sentenceRef.current;
    const contact = contactRef.current;
    if (!section || !art || !name || !sentence || !contact) return;

    const ctx = gsap.context(() => {
      const state = { p: 0 };

      // Measured once, at rest (scale 1, before the tween has run):
      // ART's own width-to-font-size ratio. This is an intrinsic
      // property of the glyphs/font, stable across sizes, so it lets
      // us recompute ART's natural (unscaled) width at any viewport
      // size from a single live getComputedStyle read instead of a
      // hardcoded pixel value.
      const artRestFontSize = parseFloat(getComputedStyle(art).fontSize);
      const artWidthToFontSizeRatio =
        art.getBoundingClientRect().width / artRestFontSize;
      const artRestHalfHeight = artRestFontSize / 2; // lineHeight: 1
      const artRestWidth = artRestFontSize * artWidthToFontSizeRatio;
      const artScaleTarget =
        (ART_FINAL_WIDTH_VS_VIEWPORT * window.innerWidth) / artRestWidth;

      // Work out, from the ACTUAL measured geometry of this viewport,
      // the largest ART scale that still keeps a SAFETY_BUFFER_PX gap
      // above the tagline's box — then the largest tween progress p at
      // which the eased growth curve reaches that scale. The sentence's
      // whole fade in/out cycle has to finish before that point (with
      // SENTENCE_SAFETY_MARGIN of margin), whatever it turns out to be
      // for this viewport's shape, rather than a beat range tuned by
      // hand against one screen size.
      const artCenterY = window.innerHeight / 2;
      const sentenceRect = sentence.getBoundingClientRect();
      const maxSafeArtHalfHeight =
        artCenterY - sentenceRect.bottom - SAFETY_BUFFER_PX;
      const maxSafeScale = maxSafeArtHalfHeight / artRestHalfHeight;
      const pSafe =
        maxSafeScale > 1
          ? Math.min(
              1,
              Math.pow(
                (maxSafeScale - 1) / (artScaleTarget - 1),
                1 / ART_GROWTH_EASE_POWER
              )
            )
          : 0;
      const safeWindowEnd = Math.max(0, pSafe * SENTENCE_SAFETY_MARGIN);

      const glowStart = GLOW_FADE_START_BEAT / TOTAL_BEATS;
      const glowEnd = GLOW_FADE_END_BEAT / TOTAL_BEATS;
      const sentenceInStart = safeWindowEnd * SENTENCE_FADE_IN_START_FRAC;
      const sentenceInEnd = safeWindowEnd * SENTENCE_FADE_IN_END_FRAC;
      const sentenceOutEnd = safeWindowEnd * SENTENCE_FADE_OUT_END_FRAC;

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

          // 2. Scale: ART scales up faster than the name block, eased so
          // it stays clear of the tagline row early on (see
          // ART_GROWTH_EASE_POWER above). artScaleTarget was computed
          // once above from live geometry, so "exceeds the viewport"
          // holds at this viewport's actual size, not just the one it
          // was tuned against.
          const artScale = gsap.utils.interpolate(
            1,
            artScaleTarget,
            Math.pow(p, ART_GROWTH_EASE_POWER)
          );
          const nameScale = gsap.utils.interpolate(1, NAME_SCALE_TO, p);
          art.style.transform = `scale(${artScale})`;
          name.style.transform = `scale(${nameScale})`;
          contact.style.opacity = String(
            gsap.utils.interpolate(CONTACT_OPACITY_FROM, 0, p)
          );

          // 3. Sentence fades in partway through the pin, then back out
          // to 0 by the end as ART grows to fill the screen. Degenerate
          // case: safeWindowEnd computed as ~0 means this viewport's
          // geometry leaves no scroll room where ART is guaranteed clear
          // of the tagline row at all — the tagline just stays hidden
          // rather than risk it.
          const sentenceP =
            safeWindowEnd < 0.01
              ? 0
              : p <= sentenceInEnd
                ? gsap.utils.clamp(
                    0,
                    1,
                    gsap.utils.mapRange(sentenceInStart, sentenceInEnd, 0, 1, p)
                  )
                : gsap.utils.clamp(
                    0,
                    1,
                    gsap.utils.mapRange(sentenceInEnd, sentenceOutEnd, 1, 0, p)
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
          style={{ fontSize: ART_FONT_SIZE, lineHeight: 1 }}
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
            className="max-w-sm text-sm text-white/70"
            style={{ fontFamily: nameFontFamily, opacity: 0, marginTop: "0.5rem" }}
          >
            is just a name. What actually makes me is my—
          </p>
        </div>

        <div
          ref={contactRef}
          className="pointer-events-none absolute z-10 text-white"
          style={{
            bottom: "3rem",
            right: "3rem",
            fontSize: "0.875rem",
            opacity: CONTACT_OPACITY_FROM,
            fontFamily: nameFontFamily,
          }}
        >
          {CONTACT_INFO}
        </div>
      </div>
    </div>
  );
}
