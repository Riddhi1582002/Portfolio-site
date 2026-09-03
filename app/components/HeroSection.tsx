"use client";

// Riddhi Thakkar — dark cinematic portfolio hero, real-scroll-driven.
//
// Ported from a Claude Design prototype (`Riddhi Thakkar Hero.dc.html` +
// `hero-scene.jsx`) that faked scroll with a 12.4s looping timer, since the
// design tool has no real scroll. This version drives the same three frames
// (rest -> mid -> deep) off actual page scroll instead.

import { useEffect, useRef, useState } from "react";
import "./hero-fonts.css";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const DIDONE = "'Juana', Georgia, serif";

// Fixed glow strength baked in from the prototype's tuned default
// (was a 0.3-1.8 dev slider in the Tweaks panel; 0.75 is where it landed).
const GLOW_STRENGTH = 0.75;

// Design was authored on a 1920x1080 canvas; all coordinates below are in
// that space and get scaled to fit the viewport (see `stageScale` below) so
// proportions/positions stay pixel-perfect at any screen size.
const STAGE_W = 1920;
const STAGE_H = 1080;

// How many viewport-heights of scroll it takes to play rest -> mid -> deep.
// Raise this to slow the scroll-scrub down (more scrolling per frame of
// motion), lower it to speed it up.
const SCROLL_LENGTH_VH = 400;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

// Popmotion-style keyframe interpolation: maps t across `input` breakpoints
// into `output`, easing each segment. Holds the first/last output outside
// the input range.
function interpolate(
  input: number[],
  output: number[],
  ease: (t: number) => number = easeInOutSine
) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        return output[i] + (output[i + 1] - output[i]) * ease(local);
      }
    }
    return output[output.length - 1];
  };
}

// Scroll-fraction breakpoints where each frame's transition starts/ends.
// These are the original prototype's second-based cue points (0, 1.6, 5.6,
// 7.6, 11.4, 12.4s across a 12.4s timeline) renormalized to a 0-1 scroll
// fraction, so the pacing between frames matches the approved prototype.
const SCROLL_TO_P = interpolate(
  [0, 0.129, 0.4516, 0.6129, 0.9194, 1],
  [0, 0, 1, 1, 2, 2]
);

function glowShadow(g: number) {
  const a = (v: number) => Math.min(1, Math.max(0, v * g));
  return [
    `0 0 ${8 * g + 2}px rgba(255,255,255,${a(0.95)})`,
    `0 0 ${34 * g + 6}px rgba(240,246,255,${a(0.8)})`,
    `0 0 ${90 * g + 12}px rgba(220,232,255,${a(0.55)})`,
    `0 0 ${190 * g + 20}px rgba(200,220,255,${a(0.38)})`,
    `0 0 ${340 * g + 30}px rgba(180,205,255,${a(0.22)})`,
  ].join(", ");
}

export default function HeroSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollP, setScrollP] = useState(0); // 0..1 raw scroll fraction through the track
  const [t, setT] = useState(0); // seconds elapsed, for the idle breathing/drift motion

  // Scroll progress: how far we are through the tall scroll track, clamped
  // to [0,1]. rAF-throttled scroll handler avoids layout thrash.
  useEffect(() => {
    let raf: number | null = null;
    const measure = () => {
      raf = null;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      setScrollP(total > 0 ? clamp01(scrolled / total) : 0);
    };
    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  // Continuous clock purely for the subtle breathing/drift micro-motion —
  // independent of scroll, exactly like the prototype's idle sway.
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const p = SCROLL_TO_P(scrollP); // 0 = rest, 1 = mid-scroll, 2 = deep scroll

  const breath = Math.sin(t * 0.055 * Math.PI * 2) * 0.014;
  const drift = Math.sin(t * 0.04 * Math.PI * 2) * 10;

  const artScale = interpolate([0, 1, 2], [1, 1.36, 1.94])(p) * (1 + breath);
  const artY = interpolate([0, 1, 2], [66, 72, -60])(p) + drift * 0.6;
  const g =
    interpolate([0, 1, 2], [1.15, 0.5, 0.5])(p) *
    (1 + breath * 1.5) *
    GLOW_STRENGTH;

  const nameY = interpolate([0, 1, 2], [320, 250, 200])(p) + drift * 0.35;
  const nameSize = interpolate([0, 1], [46, 60])(p);
  const nameOpacity = interpolate([0, 1, 1.32], [1, 1, 0])(p);

  const tag1Opacity = interpolate([0.42, 0.95, 1.28], [0, 1, 0])(p);
  const tag1Y = interpolate([0.42, 1], [342, 322])(p) + drift * 0.35;

  const tag2Opacity = interpolate([1.42, 1.95], [0, 1])(p);
  const tag2Y = interpolate([1.42, 2], [968, 902])(p) - drift * 0.3;

  const contactOpacity = interpolate([0, 0.5], [0.38, 0])(p);

  const haloSize = 1500 * artScale;

  // Fit the 1920x1080 authored stage into the viewport like `object-fit:
  // contain` (matches how the prototype's CompositionStage scaled its SVG),
  // so every position/size above stays pixel-perfect at any screen size.
  const [stageScale, setStageScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      setStageScale(
        Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
      );
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div
      ref={trackRef}
      style={{ height: `${SCROLL_LENGTH_VH}vh`, position: "relative" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${stageScale})`,
            flexShrink: 0,
          }}
        >
          {/* soft halo bloom behind everything, sized to ART */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 540 + artY,
              width: haloSize,
              height: haloSize * 0.62,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(closest-side, rgba(214,228,255,${0.16 * g}) 0%, rgba(190,210,255,${0.07 * g}) 42%, rgba(0,0,0,0) 78%)`,
              filter: "blur(30px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 540 + artY,
              transform: `translateY(-50%) scale(${artScale})`,
              textAlign: "center",
              fontFamily: DIDONE,
              fontWeight: 400,
              fontSize: 462,
              lineHeight: 0.86,
              letterSpacing: "0.005em",
              color: "#fff",
              textShadow: glowShadow(g),
              willChange: "transform",
            }}
          >
            ART
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: nameY,
              textAlign: "center",
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: nameSize,
              letterSpacing: "0.005em",
              color: "#fff",
              opacity: nameOpacity,
              textShadow: "0 0 26px rgba(255,255,255,0.35)",
            }}
          >
            Riddhi Thakkar
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: tag1Y,
              textAlign: "center",
              fontFamily: SANS,
              fontWeight: 300,
              fontSize: 40,
              letterSpacing: "0.01em",
              color: "rgba(255,255,255,0.82)",
              opacity: tag1Opacity,
            }}
          >
            is just a name. What actually makes me is my
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: tag2Y,
              textAlign: "center",
              fontFamily: SANS,
              fontWeight: 300,
              fontSize: 38,
              lineHeight: 1.5,
              letterSpacing: "0.01em",
              color: "rgba(255,255,255,0.85)",
              opacity: tag2Opacity,
            }}
          >
            is my peace.
            <br />
            And if you are paying me for it, I&apos;ll make sure that piece
            becomes your peace.
          </div>

          <div
            style={{
              position: "absolute",
              right: 80,
              bottom: 56,
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 26,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              color: "#fff",
              opacity: contactOpacity,
            }}
          >
            Contact info
          </div>
        </div>
      </div>
    </div>
  );
}
