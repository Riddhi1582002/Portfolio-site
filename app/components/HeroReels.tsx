"use client";

// REELS media entering the hero stage.
//
// This is a slide-in, nothing more: the media starts off-screen right and
// travels to its resting composition while fading up. There is no portal,
// no aperture, no clip-path and no SVG geometry anywhere in this file —
// only transform and opacity, both driven by the single hero scroll
// progress passed in as a prop.
//
// It sits OUTSIDE the hero's camera transform, in plain viewport units, so
// the camera pushing into the A does not drag the media around with it.
// That separation is what lets the two motions overlap and read as a match
// cut rather than as one object turning into another.

import { useEffect, useRef, useState } from "react";

// Resting composition. Width is a share of the VIEWPORT WIDTH, not of the
// stage, so the media is never scaled to fit a 1920x1080 authored canvas.
const REEL_WIDTH_VW = 45;
// Below vertical centre on purpose: the space above is where hover text
// and reel information land later.
const REEL_CENTRE_Y_VH = 58;
// Where it starts, as a share of viewport width past the right edge.
const REEL_START_X_VW = 78;

// The media only starts arriving once the camera move is under way, so the
// first thing read is the push into the letter, not a panel appearing.
const SLIDE_START = 0.18;
const SLIDE_END = 0.92;
const FADE_START = 0.2;
const FADE_END = 0.62;
// It arrives fractionally small and settles — an entrance, not a zoom. The
// media's own aspect ratio is untouched by this; both axes scale together.
const ENTRANCE_SCALE = 0.86;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export default function HeroReels({ progress }: { progress: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Read off the media rather than assumed, so a reel with a different
  // native ratio composes correctly without touching this file.
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (progress > 0.02 && v.paused) v.play().catch(() => {});
    if (progress <= 0.02 && !v.paused) v.pause();
  }, [progress]);

  const slide = easeOutCubic(span(progress, SLIDE_START, SLIDE_END));
  const opacity = easeOutQuad(span(progress, FADE_START, FADE_END));
  const scale = ENTRANCE_SCALE + (1 - ENTRANCE_SCALE) * slide;
  // Travels from off-screen right to its resting x. Both are viewport
  // widths, so the distance is proportional at every screen size.
  const x = REEL_START_X_VW * (1 - slide);

  return (
    <div
      aria-hidden={progress < 0.05}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        pointerEvents: "none",
        // Nothing to see until the camera move has begun.
        visibility: progress <= 0.02 ? "hidden" : "visible",
      }}
    >
      <div
        id="reel-frame"
        style={{
          position: "absolute",
          left: "50%",
          top: `${REEL_CENTRE_Y_VH}vh`,
          width: `${REEL_WIDTH_VW}vw`,
          // Native ratio, held by construction: the height is derived from
          // the loaded media's own dimensions and never set independently.
          aspectRatio: String(aspect),
          transform: `translate(-50%, -50%) translateX(${x}vw) scale(${scale})`,
          opacity,
          willChange: "transform, opacity",
          overflow: "hidden",
          borderRadius: 6,
          background: "#000",
        }}
      >
        <video
          ref={videoRef}
          id="reel-video"
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v?.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
          }}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            // `contain`, not `cover`: cover would crop the reel to fit the
            // box. The box is already the media's own ratio, so this is a
            // belt-and-braces guarantee that nothing is ever cropped or
            // stretched.
            objectFit: "contain",
          }}
        >
          {/* PLACEHOLDER REEL — 1920x1080, not final content. VP9 first:
              H.264 is not decodable in every browser used to verify this.
              Replace both files with the real showreel; nothing here
              hardcodes its size. */}
          <source src="/video/reel-1.webm" type="video/webm" />
          <source src="/video/reel-1.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
