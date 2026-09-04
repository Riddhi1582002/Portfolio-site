'use client';

import { useRef, useEffect } from "react";

// How long the center-out reveal takes once it starts. Change this if you
// want it to line up more precisely with when "is my peace..." appears —
// that text's own trigger isn't wired up yet (separate, unbuilt piece), so
// this just runs on its own timer starting from the same scroll trigger.
const FADE_DURATION_MS = 1600;
// Width of the soft edge, in px, between solid black and fully visible video.
const FEATHER_PX = 220;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

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
    <div ref={outerRef} style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", background: "#000" }}>
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />

      {/* Solid black, clipped to a circle that grows from the center out.
          Starts at radius 0 (invisible) and expands until it fully covers
          the frame, which is what makes the video "bleed away" from the
          middle outward instead of fading uniformly. */}
      <div
        ref={coverRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 32,
          left: 32,
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 14,
          letterSpacing: "0.02em",
          opacity: 0.85,
        }}
      >
        Riddhi Thakkar
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div
          style={{
            color: "#fff",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(80px, 14vw, 220px)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            textShadow: "0 0 10px rgba(255,255,255,0.85), 0 0 40px rgba(255,255,255,0.55), 0 0 90px rgba(255,255,255,0.3)",
          }}
        >
          ART
        </div>
      </div>
    </div>
  );
}
