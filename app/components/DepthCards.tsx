"use client";

// The card stack arriving out of the depths, overlapping the tail of the
// A push.
//
// Rebuilt from the supplied FeyCards component rather than dropped in. The
// original is built on motion/react (framer-motion) and pulls its imagery
// from assets.aceternity.com; this project is GSAP-only by standing
// instruction, and third-party image hosts were already ruled out for the
// link preview. What is kept is the behaviour: a fanned stack, a per-card
// entrance stagger, neighbours shifting aside on hover, and the headline
// crossfading between two treatments.
//
// The entrance is along z: the stack starts far back and small, and comes
// forward as scroll advances. It is driven by the same single hero
// progress everything else in this transition reads, so it can overlap the
// camera push instead of waiting for it.

import { useState, type CSSProperties } from "react";
import HoverCard from "./HoverCard";
import NarrationLine from "./NarrationLine";
import {
  NARRATION_COLOR,
  NARRATION_FONT_SIZE,
  NARRATION_GLOW,
  NARRATION_TRACKING,
  NARRATION_WEIGHT,
} from "./HeroSection";

const CARD_COUNT = 5;
// How far apart the fanned cards sit, as a share of viewport width.
const CARD_SPACING_VW = 2.6;
const CARD_WIDTH_VW = 13;
// How far a neighbour slides when the card before it is hovered.
const SHIFT_VW = 4;
// Depth the stack starts at. Negative z reads as "behind the screen".
const START_Z = -2600;
// Per-card entrance offset, as a share of the entrance window.
const STAGGER = 0.09;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function DepthCards({
  progress,
  sans,
}: {
  /** 0 = far back and unseen, 1 = fully arrived. */
  progress: number;
  sans: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lead = clamp01(progress);

  return (
    <div
      aria-hidden={lead < 0.05}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        display: "grid",
        placeItems: "center",
        // 3D depth needs a perspective on the ancestor; without it a
        // translateZ does nothing visible.
        perspective: "1400px",
        perspectiveOrigin: "50% 50%",
        pointerEvents: lead > 0.9 ? "auto" : "none",
        visibility: lead <= 0.02 ? "hidden" : "visible",
      }}
    >
      <div style={{ position: "relative", transformStyle: "preserve-3d" }}>
        {/* The narration for this beat, in the site's one narration style. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 6vh)",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontFamily: sans,
            fontWeight: NARRATION_WEIGHT,
            fontSize: NARRATION_FONT_SIZE,
            letterSpacing: NARRATION_TRACKING,
            color: NARRATION_COLOR,
            textShadow: NARRATION_GLOW,
            opacity: easeOutCubic(clamp01((lead - 0.35) / 0.4)),
            pointerEvents: "none",
          }}
        >
          <NarrationLine
            progress={clamp01((lead - 0.35) / 0.45)}
            text="I work with various mediums, here's motion."
          />
        </div>

        <div style={{ position: "relative", width: `${CARD_WIDTH_VW * 2.4}vw`, height: "56vh" }}>
          {Array.from({ length: CARD_COUNT }, (_, i) => {
            // Later cards start further back and arrive later.
            const t = easeOutCubic(clamp01((lead - i * STAGGER) / (1 - STAGGER * (CARD_COUNT - 1))));
            const z = START_Z * (1 - t);
            const shifted = activeIndex !== null && i > activeIndex;
            const style: CSSProperties = {
              position: "absolute",
              bottom: 0,
              left: `${i * CARD_SPACING_VW}vw`,
              width: `${CARD_WIDTH_VW}vw`,
              transform: `translateZ(${z.toFixed(1)}px) translateX(${shifted ? SHIFT_VW : 0}vw)`,
              opacity: t,
              transition: "transform 520ms cubic-bezier(0.2,0.8,0.3,1)",
              cursor: lead > 0.9 ? "pointer" : "default",
            };
            return (
              <div
                key={i}
                style={style}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {/* Placeholder media: neutral dark panels, never coloured
                    test blocks. Real work replaces the child. */}
                <HoverCard aspect={9 / 16} radius={10}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(160deg, #17181b 0%, #101114 55%, #0b0c0e 100%)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  />
                </HoverCard>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
