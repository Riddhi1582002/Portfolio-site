'use client';

import { useRef, useEffect } from "react";

// Scroll past this before the reveal starts at all.
const REVEAL_START_PX = 40;
// How much scrolling the reveal takes, as a fraction of viewport height.
// Longer than the old fixed 1600ms timer so the edge reads as a gradual
// wipe rather than a sweep that runs on its own clock.
const REVEAL_DISTANCE_FRAC = 1.1;
// Width of the soft edge between solid black and fully visible video.
const FEATHER_PX = 460;
// The source clip is dark, and there is no scrim or tint over it to
// reduce — so this lifts the video itself instead.
const VIDEO_FILTER = "brightness(1.45) contrast(1.04) saturate(1.05)";

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Pure background layer: the video plus its scroll-linked reveal. No text
// and no tint — HeroSection.tsx owns the ART/name text and sits on top.
//
// The reveal is driven directly from scroll position rather than fired
// once on a timer, which is what makes it reversible: scroll back to the
// top and the cover shrinks again and playback resumes, instead of the
// video staying permanently hidden and paused behind a black cover.
export default function HeroVideoBackground() {
  const videoRef = useRef(null);
  const outerRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    let raf = null;

    const apply = () => {
      raf = null;
      const outer = outerRef.current;
      const cover = coverRef.current;
      const video = videoRef.current;
      if (!outer || !cover) return;

      const distance = Math.max(1, window.innerHeight * REVEAL_DISTANCE_FRAC);
      const p = Math.min(1, Math.max(0, (window.scrollY - REVEAL_START_PX) / distance));

      const rect = outer.getBoundingClientRect();
      const maxRadius = Math.hypot(rect.width, rect.height) / 2 + 20;
      // Overshoot by the feather width so the soft band fully leaves the
      // frame by p=1 rather than parking a visible ring on screen.
      const r = easeInOutCubic(p) * (maxRadius + FEATHER_PX);
      const inner = Math.max(0, r - FEATHER_PX);
      cover.style.background =
        p <= 0
          ? "transparent"
          : `radial-gradient(circle at 50% 50%, #000 ${inner}px, transparent ${r}px)`;

      // Don't decode frames behind a fully-covering black layer, but do
      // pick playback back up the moment any of the video is visible again.
      if (video) {
        if (p >= 1) {
          if (!video.paused) video.pause();
        } else if (video.paused) {
          video.play().catch(() => {});
        }
      }
    };

    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000", zIndex: 0 }}
    >
      <video
        ref={videoRef}
        src="/video/hero-bg.mp4"
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: VIDEO_FILTER,
        }}
      />

      {/* Solid black via a radial-gradient that grows from the centre out
          with a soft feathered edge, its radius driven by scroll position
          in both directions. */}
      <div
        ref={coverRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
