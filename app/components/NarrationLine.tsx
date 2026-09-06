"use client";

// Focus-pull narration.
//
// One line, resolving letter by letter as it is scrolled through: each
// character starts soft and dim and settles sharp and white, the ones at
// the end of the line still arriving while the earlier ones are already
// crisp.
//
// ONE layer. An earlier version stacked a blurred duplicate and a
// screen-blended bloom underneath the sharp text, which left a smeared
// white residue sitting in the line's space — the blurred copy never fully
// disappeared and the bloom lit the gap between words. There is now
// nothing behind the text: a character is either resolving or resolved,
// and when the line is at rest the markup is plain sharp type.
//
// The out transition is deliberately NOT this effect in reverse. Narration
// leaves the way the name does — a straight opacity fade — so the caller
// drives `progress` for the focus pull on the way in and fades the wrapper
// on the way out.

import type { CSSProperties } from "react";

// How much of the line's progress one character's own transition occupies.
// The remainder is the stagger budget.
const CHAR_SPAN = 0.5;
// Peak blur, in px, at progress 0.
const MAX_BLUR_PX = 7;
// How far a character starts along the reading direction, in em.
const MAX_OFFSET_EM = 0.18;
// Dimmest a character gets before it resolves.
const MIN_OPACITY = 0.15;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function NarrationLine({
  progress,
  text,
  className = "",
  style,
}: {
  /** 0 = soft and dim, 1 = sharp and settled. */
  progress: number;
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  const lead = clamp01(progress);
  const chars = Array.from(text);
  // Only the non-space characters carry the stagger, so a long gap between
  // words does not spend part of the budget on nothing.
  const inkCount = chars.filter((c) => c !== " ").length;
  const staggerBudget = 1 - CHAR_SPAN;

  let inkIndex = -1;

  return (
    <div
      className={className}
      // Words wrap; characters inside a word do not.
      style={{ ...style }}
    >
      {chars.map((ch, i) => {
        if (ch === " ") return <span key={i}> </span>;
        inkIndex += 1;
        const start =
          inkCount > 1 ? (inkIndex / (inkCount - 1)) * staggerBudget : 0;
        const t = easeOutCubic(clamp01((lead - start) / CHAR_SPAN));
        const settled = t >= 0.999;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              // A settled character carries no filter and no transform at
              // all — no sub-pixel softening, nothing left in the layer.
              ...(settled
                ? null
                : {
                    filter: `blur(${((1 - t) * MAX_BLUR_PX).toFixed(2)}px)`,
                    transform: `translateX(${((1 - t) * MAX_OFFSET_EM).toFixed(3)}em)`,
                    opacity: MIN_OPACITY + (1 - MIN_OPACITY) * t,
                  }),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
