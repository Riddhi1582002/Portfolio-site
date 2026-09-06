"use client";

// Focus-pull narration.
//
// One line of narration snapping into focus as it is scrolled through,
// like a camera pulling focus or motion stopping mid-frame. This is THE
// narration treatment for the whole site — every narration line uses it,
// at the same size, face, weight and animation.
//
// Three stacked layers, all reading the same per-word progress:
//
//   blur    a duplicate underneath, directionally blurred and offset along
//           the reading direction, fading out as clarity comes up
//   glow    the same words, blurred isotropically, composited with screen,
//           so the sharp layer sits in a bloom rather than on flat black
//   clarity the sharp text, fading in and settling to its resting position
//
// The blur is a real DIRECTIONAL blur, not a symmetric one: an SVG
// feGaussianBlur with stdDeviation "<x> 0" smears along the x axis only,
// which is what makes it read as motion rather than as defocus. CSS
// filter: blur() cannot do that — it is isotropic — so the primitive's
// stdDeviation is written from JS as progress changes.
//
// No new dependencies: the words are split here rather than by SplitText,
// which also avoids a re-split every time the line re-renders.

import { useEffect, useId, useRef } from "react";

// How much of the line's progress one word's own transition occupies. The
// rest is the stagger budget, so earlier words finish while later ones are
// still arriving.
const WORD_SPAN = 0.55;
// Peak directional blur, in px, at progress 0.
const MAX_BLUR_PX = 18;
// How far off-axis a word starts, in em, along the reading direction.
const MAX_OFFSET_EM = 0.55;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export type NarrationLineProps = {
  /** 0 = fully blurred and displaced, 1 = sharp and settled. */
  progress: number;
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

/** Per-word progress: word i starts later than word i-1. */
function wordProgress(lineProgress: number, index: number, count: number) {
  if (count <= 1) return clamp01(lineProgress);
  const staggerBudget = 1 - WORD_SPAN;
  const start = (index / (count - 1)) * staggerBudget;
  return clamp01((lineProgress - start) / WORD_SPAN);
}

export default function NarrationLine({
  progress,
  text,
  className = "",
  style,
}: NarrationLineProps) {
  const uid = useId().replace(/:/g, "");
  const filterId = `narration-blur-${uid}`;
  const blurNodeRef = useRef<SVGFEGaussianBlurElement>(null);
  const words = text.split(" ");

  // The line's overall blur amount drives the shared filter primitive. Per
  // word we vary offset and opacity; a filter primitive per word would mean
  // one SVG filter per word, which is far more expensive than it is worth.
  const lead = clamp01(progress);
  const blurPx = (1 - easeOutCubic(lead)) * MAX_BLUR_PX;

  useEffect(() => {
    const node = blurNodeRef.current;
    if (!node) return;
    // Directional: x only. Written as an attribute because stdDeviation is
    // not a CSS property and cannot be driven by a custom property.
    node.setAttribute("stdDeviation", `${blurPx.toFixed(2)} 0`);
  }, [blurPx]);

  const renderWords = (variant: "blur" | "glow" | "clarity") =>
    words.map((word, i) => {
      const t = easeOutCubic(wordProgress(lead, i, words.length));
      const offset = (1 - t) * MAX_OFFSET_EM;
      const opacity =
        variant === "clarity" ? t : variant === "glow" ? t * 0.55 : 1 - t;
      return (
        <span
          key={`${variant}-${i}`}
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            transform: `translateX(${offset}em)`,
            opacity,
            willChange: lead > 0 && lead < 1 ? "transform, opacity" : "auto",
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      );
    });

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  };

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur ref={blurNodeRef} in="SourceGraphic" stdDeviation="0 0" />
        </filter>
      </svg>

      {/* The line in the normal flow, invisible, so it still sizes and wraps
          the container. Everything visible is layered on top of it. */}
      <div aria-hidden style={{ opacity: 0 }}>{text}</div>

      {/* blurred duplicate underneath */}
      <div aria-hidden style={{ ...layer, filter: `url(#${filterId})` }}>
        {renderWords("blur")}
      </div>

      {/* bloom */}
      <div
        aria-hidden
        style={{
          ...layer,
          filter: "blur(7px)",
          mixBlendMode: "screen",
        }}
      >
        {renderWords("glow")}
      </div>

      {/* the sharp line — the only layer a screen reader sees */}
      <div style={layer}>{renderWords("clarity")}</div>
    </div>
  );
}
