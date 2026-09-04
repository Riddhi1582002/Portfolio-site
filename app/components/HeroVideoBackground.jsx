'use client';

import { useRef, useEffect } from "react";

// How long the center-out reveal takes once it starts.
const FADE_DURATION_MS = 1600;
// Width of the soft edge, in px, between solid black and fully visible video.
const FEATHER_PX = 220;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Pure background layer: your video, untouched, plus the scroll-triggered
// transition. No text, no tint, no filters on the video itself —
// HeroSection.tsx owns the ART/name text and sits on top of this.
export default function HeroVideoBackground() {
  const videoRef = useRef(null);
  const outerRef = useRef(null);
  const coverRef = useRef(null);
  const fadedRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      if (fadedRef.current) return;
      if (window.scrollY > 24) {
        fadedRef.current = true;
        window.removeEventListener("scroll", onScroll);

        const rect = outerRef.current.getBoundingClientRect();
        const maxRadius = Math.hypot(rect.width, rect.height) / 2 + 20;
        const start = performance.now();

        const animate = (time) => {
          const elapsed = time - start;
          const p = Math.min(1, elapsed / FADE_DURATION_MS);
          // Goes past maxRadius so the feather band fully exits the visible
          // area by the end — no lingering soft ring, just solid black.
          const r = easeInOutCubic(p) * (maxRadius + FEATHER_PX);
          if (coverRef.current) {
            const inner = Math.max(0, r - FEATHER_PX);
            coverRef.current.style.background =
              `radial-gradient(circle at 50% 50%, #000 ${inner}px, transparent ${r}px)`;
          }
          if (p < 1) {
            rafRef.current = requestAnimationFrame(animate);
          } else {
            // Fully covered — no point decoding video frames behind the
            // rest of the page.
            videoRef.current?.pause();
          }
        };
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={outerRef} style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000", zIndex: 0 }}>
      <video
        ref={videoRef}
        src="/video/hero-bg.mp4"
        autoPlay
        muted
        playsInline
        // Plays once per the locked spec — not looped. Swap in `loop`
        // if you decide you'd rather it cycle instead of settling on
        // its last frame.
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Solid black via a radial-gradient that grows from the center out,
          with a soft feathered edge — not a hard clip-path circle. Starts
          fully transparent and expands until it fully covers the frame. */}
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
