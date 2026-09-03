"use client";

// Riddhi Thakkar — dark cinematic portfolio hero, real-scroll-driven.
//
// Ported from a Claude Design prototype (`Riddhi Thakkar Hero.dc.html` +
// `hero-scene.jsx`) that faked scroll with a 12.4s looping timer, since the
// design tool has no real scroll. This version drives the same three frames
// (rest -> mid -> deep) off actual page scroll instead.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import "./hero-fonts.css";
import "./hero-hint.css";

gsap.registerPlugin(SplitText);

const SANS = "'Neue Montreal', system-ui, sans-serif";
const DIDONE = "'Juana', Georgia, serif";

// Fixed glow strength baked in from the prototype's tuned default
// (was a 0.3-1.8 dev slider in the Tweaks panel; 0.75 is where it landed).
const GLOW_STRENGTH = 0.75;

// Cursor-reactive glow on ART: ramps UP toward this fraction of extra
// intensity as the cursor approaches ART's center, at zero distance;
// never goes below the scroll-driven baseline (it's a multiplier > 1,
// applied on top of `g`, not a replacement for it). CURSOR_GLOW_RADIUS
// is the distance (px) beyond which the cursor stops affecting it.
const CURSOR_GLOW_BOOST = 0.6;
const CURSOR_GLOW_RADIUS = 500;

// "Scroll to continue" hint: two clicks on ART within this window, with
// no real scroll in between, trigger it.
const HINT_CLICK_WINDOW_MS = 4000;
const HINT_DISMISSED_KEY = "heroScrollHintDismissed";

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
  const artRef = useRef<HTMLDivElement>(null);
  const [scrollP, setScrollP] = useState(0); // 0..1 raw scroll fraction through the track
  const [t, setT] = useState(0); // seconds elapsed, for the idle breathing/drift motion

  // Narration text (name, tag1, tag2) reveals per-line via a SplitText
  // clip-mask, scrubbed by this component's own scroll-progress value —
  // not autoplay, not IntersectionObserver. *TextRef is the element
  // SplitText splits; *SplitRef holds the resulting SplitText instance
  // (its .lines) so the reveal-sync effects below can drive it.
  const nameTextRef = useRef<HTMLAnchorElement>(null);
  const tag1TextRef = useRef<HTMLDivElement>(null);
  const tag2TextRef = useRef<HTMLDivElement>(null);
  const nameSplitRef = useRef<SplitText | null>(null);
  const tag1SplitRef = useRef<SplitText | null>(null);
  const tag2SplitRef = useRef<SplitText | null>(null);

  // "Scroll to continue" hint state. clickStateRef tracks an in-progress
  // double-click window; lastScrollTimeRef timestamps the most recent
  // real scroll (window 'scroll' only fires on actual movement, so any
  // firing of it counts). hintDismissedRef, once true (this click or a
  // prior page load via sessionStorage), permanently suppresses the hint.
  const [hintVisible, setHintVisible] = useState(false);
  const [hintBobActive, setHintBobActive] = useState(false);
  const hintVisibleRef = useRef(false);
  const hintDismissedRef = useRef(false);
  const clickStateRef = useRef<{ count: number; firstClickTime: number }>({
    count: 0,
    firstClickTime: 0,
  });
  const lastScrollTimeRef = useRef(0);

  useEffect(() => {
    hintVisibleRef.current = hintVisible;
  }, [hintVisible]);

  useEffect(() => {
    try {
      hintDismissedRef.current =
        sessionStorage.getItem(HINT_DISMISSED_KEY) === "1";
    } catch {
      // sessionStorage unavailable (e.g. privacy mode) — hint just won't
      // persist its dismissal across reloads, which is an acceptable
      // degradation, not a crash.
    }
  }, []);

  // Scroll progress: how far we are through the tall scroll track, clamped
  // to [0,1]. rAF-throttled scroll handler avoids layout thrash. Also
  // where "a real scroll happened" is detected for the hint: any fire of
  // the native 'scroll' event is real movement, so it resets the
  // double-click window and, if the hint is currently showing, fades it
  // out and permanently dismisses it for this session.
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
      lastScrollTimeRef.current = performance.now();
      clickStateRef.current = { count: 0, firstClickTime: 0 };
      if (hintVisibleRef.current) {
        setHintVisible(false);
        hintDismissedRef.current = true;
        try {
          sessionStorage.setItem(HINT_DISMISSED_KEY, "1");
        } catch {
          // Nothing to do if storage is unavailable — see above.
        }
      }
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

  // Bob starts only once the fade-in transition has finished, not at the
  // moment opacity starts changing. hintBobActive resets in the cleanup
  // (runs when hintVisible flips back to false, or on unmount) rather
  // than synchronously in the effect body.
  useEffect(() => {
    if (!hintVisible) return;
    const timer = setTimeout(() => setHintBobActive(true), 650);
    return () => {
      clearTimeout(timer);
      setHintBobActive(false);
    };
  }, [hintVisible]);

  const handleArtClick = () => {
    if (hintDismissedRef.current) return;
    const now = performance.now();
    const cs = clickStateRef.current;
    if (cs.count === 0) {
      clickStateRef.current = { count: 1, firstClickTime: now };
      return;
    }
    const withinWindow = now - cs.firstClickTime <= HINT_CLICK_WINDOW_MS;
    const noScrollBetween = lastScrollTimeRef.current < cs.firstClickTime;
    if (withinWindow && noScrollBetween) {
      setHintVisible(true);
      clickStateRef.current = { count: 0, firstClickTime: 0 };
    } else {
      // Either the window lapsed or a scroll happened in between — this
      // click starts a fresh window rather than counting toward a stale one.
      clickStateRef.current = { count: 1, firstClickTime: now };
    }
  };

  // Cursor-reactive glow: distance from pointer to ART's current
  // on-screen center, rAF-throttled like the scroll handler above.
  const [cursorProximity, setCursorProximity] = useState(0);
  useEffect(() => {
    let raf: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const compute = () => {
      raf = null;
      const el = artRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(lastX - cx, lastY - cy);
      setCursorProximity(clamp01(1 - dist / CURSOR_GLOW_RADIUS));
    };
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf == null) raf = requestAnimationFrame(compute);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
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
  // Cursor proximity only ever multiplies g upward (1 + a non-negative
  // term) — it intensifies the glow, never dims or masks the glyph.
  const gWithCursor = g * (1 + cursorProximity * CURSOR_GLOW_BOOST);

  const nameY = interpolate([0, 1, 2], [320, 250, 200])(p) + drift * 0.35;
  const nameSize = interpolate([0, 1], [46, 60])(p);
  const nameOpacity = interpolate([0, 1, 1.32], [1, 1, 0])(p);

  const tag1Opacity = interpolate([0.42, 0.95, 1.28], [0, 1, 0])(p);
  const tag1Y = interpolate([0.42, 1], [320, 300])(p) + drift * 0.35;

  const tag2Opacity = interpolate([1.42, 1.95], [0, 1])(p);
  const tag2Y = interpolate([1.42, 2], [925, 859])(p) - drift * 0.3;

  const contactOpacity = interpolate([0, 0.5], [0.38, 0])(p);

  const haloSize = 1500 * artScale;

  // "Scroll to continue" hint sits just below ART's current bottom edge,
  // tracking ART's own scale/position rather than a fixed Y, since the
  // click-triggered hint can appear at whatever scroll position the user
  // is paused at (462 * 0.86 is ART's unscaled line-box height; halved
  // and scaled gives its current half-height at rest, translateY(-50%)
  // centered like ART itself).
  const artBottomY = 540 + artY + ((462 * 0.86) / 2) * artScale;
  const hintY = artBottomY + 40;

  // Split each narration line into a SplitText clip-mask once on mount.
  // Because the stage is a fixed 1920x1080 canvas that's scaled as a
  // whole (see stageScale below) rather than reflowed per viewport, line
  // wrapping is identical at every screen size — one split at mount is
  // enough, no resize re-split needed. Reverted on unmount.
  useEffect(() => {
    const splits: SplitText[] = [];
    if (nameTextRef.current) {
      const s = SplitText.create(nameTextRef.current, {
        type: "lines",
        mask: "lines",
      });
      gsap.set(s.lines, { yPercent: 100 });
      nameSplitRef.current = s;
      splits.push(s);
    }
    if (tag1TextRef.current) {
      const s = SplitText.create(tag1TextRef.current, {
        type: "lines",
        mask: "lines",
      });
      gsap.set(s.lines, { yPercent: 100 });
      tag1SplitRef.current = s;
      splits.push(s);
    }
    if (tag2TextRef.current) {
      const s = SplitText.create(tag2TextRef.current, {
        type: "lines",
        mask: "lines",
      });
      gsap.set(s.lines, { yPercent: 100 });
      tag2SplitRef.current = s;
      splits.push(s);
    }
    return () => {
      splits.forEach((s) => s.revert());
      nameSplitRef.current = null;
      tag1SplitRef.current = null;
      tag2SplitRef.current = null;
    };
  }, []);

  // Keep each split's line reveal in sync with the same scroll-driven
  // opacity values the rest of the component already uses — line-level
  // only (no word/char stagger), scrubbed by scroll, not autoplaying and
  // not IntersectionObserver-triggered. The opacity fade stays on the
  // wrapping divs too (see JSX below) as a FOUC guard for the instant
  // before this effect's first run, and to keep every scroll checkpoint
  // this page has already been verified against unchanged; the mask
  // reveal is layered motion on top of it, not a replacement.
  useEffect(() => {
    if (nameSplitRef.current) {
      gsap.set(nameSplitRef.current.lines, { yPercent: (1 - nameOpacity) * 100 });
    }
  }, [nameOpacity]);
  useEffect(() => {
    if (tag1SplitRef.current) {
      gsap.set(tag1SplitRef.current.lines, { yPercent: (1 - tag1Opacity) * 100 });
    }
  }, [tag1Opacity]);
  useEffect(() => {
    if (tag2SplitRef.current) {
      gsap.set(tag2SplitRef.current.lines, { yPercent: (1 - tag2Opacity) * 100 });
    }
  }, [tag2Opacity]);

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
            ref={artRef}
            onClick={handleArtClick}
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
              textShadow: glowShadow(gWithCursor),
              willChange: "transform",
              userSelect: "none",
              WebkitUserSelect: "none",
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
              opacity: nameOpacity,
              // Once faded out at the deep stage, don't leave an
              // invisible-but-clickable link sitting over ART.
              pointerEvents: nameOpacity < 0.05 ? "none" : "auto",
            }}
          >
            {/* Inline-block + relative so the before:* underline is
                scoped to the text's own width, not the full-width row
                above it — a swipe-in from the right on hover/focus,
                written directly in Tailwind (no external component). */}
            <Link
              ref={nameTextRef}
              href="/about"
              className="relative inline-block before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:origin-right before:scale-x-0 before:bg-white before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.4,0,0.2,1)] before:content-[''] hover:before:origin-left hover:before:scale-x-100 focus:before:origin-left focus:before:scale-x-100"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: nameSize,
                letterSpacing: "0.005em",
                color: "#fff",
                textDecoration: "none",
                textShadow: "0 0 26px rgba(255,255,255,0.35)",
              }}
            >
              Riddhi Thakkar
            </Link>
          </div>

          <div
            ref={tag1TextRef}
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
              pointerEvents: "none",
            }}
          >
            is just a name. What actually makes me is my
          </div>

          <div
            ref={tag2TextRef}
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
              pointerEvents: "none",
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
              pointerEvents: "none",
            }}
          >
            Contact info
          </div>

          {/* Easter-egg hint: two clicks on ART within 4s, no scroll in
              between. Text only, fades in, then bobs once fully visible. */}
          <div
            className={hintBobActive ? "hero-hint-bob" : undefined}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: hintY,
              textAlign: "center",
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 28,
              letterSpacing: "0.02em",
              color: "#fff",
              opacity: hintVisible ? 0.55 : 0,
              transition: "opacity 600ms ease",
              pointerEvents: "none",
            }}
          >
            Scroll to continue
          </div>
        </div>
      </div>
    </div>
  );
}
