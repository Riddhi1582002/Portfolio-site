"use client";

// REELS: the horizontal strip of work, scrubbed by scroll.
//
// Every card shares one HEIGHT and takes its own WIDTH from its native
// ratio, so a portrait piece sits at the same height as a landscape one
// without either being cropped or stretched. That is the whole layout
// rule; the mixed 16:9 / 9:16 order below is data, not structure.
//
// The strip sits low in the frame on purpose: the top third is left clear
// for the piece's title and details, and there is a margin under it.
//
// Scroll moves the strip, nothing moves on its own. One progress value
// picks which card is centred; the neighbours sit either side and the one
// entering at the right edge falls into a black gradient.

import { useEffect, useRef, useState } from "react";
import HoverCard from "./HoverCard";

export type Reel = { id: string; ratio: number; title: string; meta: string };

// 16:9 and 9:16, in the order asked for.
export const REELS: Reel[] = [
  { id: "r1", ratio: 16 / 9, title: "Showreel", meta: "2025 · motion" },
  { id: "r2", ratio: 16 / 9, title: "Second piece", meta: "client · promo" },
  { id: "r3", ratio: 9 / 16, title: "Third piece", meta: "social · vertical" },
  { id: "r4", ratio: 16 / 9, title: "Fourth piece", meta: "corporate" },
  { id: "r5", ratio: 9 / 16, title: "Fifth piece", meta: "social · vertical" },
  { id: "r6", ratio: 9 / 16, title: "Sixth piece", meta: "social · vertical" },
  { id: "r7", ratio: 16 / 9, title: "Seventh piece", meta: "event coverage" },
  { id: "r8", ratio: 16 / 9, title: "Eighth piece", meta: "digital comic" },
];

// One height for every card; widths follow from the ratios above.
const CARD_H_VH = 46;
// Centre of the strip, as a share of viewport height. Below the middle, so
// the top third stays clear for the details and there is room underneath.
const STRIP_CENTRE_VH = 63;
const GAP_VH = 3.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Card widths and their centre offsets along the strip, in vh units. */
function layout(reels: Reel[]) {
  const widths = reels.map((r) => CARD_H_VH * r.ratio);
  const centres: number[] = [];
  let x = 0;
  for (const w of widths) {
    centres.push(x + w / 2);
    x += w + GAP_VH;
  }
  return { widths, centres, total: x - GAP_VH };
}

export default function ReelStrip({ progress }: { progress: number }) {
  const p = clamp01(progress);
  const { widths, centres } = layout(REELS);
  const [vw, setVw] = useState(1440);
  const [vh, setVh] = useState(900);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Which card is centred. Eased so each card settles rather than sliding
  // past at constant speed.
  const focus = easeInOutSine(p) * (REELS.length - 1);
  const lo = Math.floor(focus);
  const hi = Math.min(REELS.length - 1, lo + 1);
  const frac = focus - lo;
  const centreVh = centres[lo] + (centres[hi] - centres[lo]) * frac;

  // vh -> px, then shift so the focused card's centre sits at the middle
  // of the viewport.
  const toPx = (v: number) => (v / 100) * vh;
  const offsetPx = vw / 2 - toPx(centreVh);

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Details for the card in focus. Sits in the clear top third. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${STRIP_CENTRE_VH - CARD_H_VH / 2 - 14}vh`,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontWeight: 500,
            fontSize: "clamp(18px, 1.6vw, 26px)",
            letterSpacing: "0.01em",
            color: "#fff",
            textShadow: "0 0 22px rgba(255,255,255,0.28)",
          }}
        >
          {REELS[Math.round(focus)].title}
        </div>
        <div
          style={{
            marginTop: 6,
            fontWeight: 300,
            fontSize: "clamp(12px, 0.95vw, 15px)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {REELS[Math.round(focus)].meta}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: `${STRIP_CENTRE_VH}vh`,
          left: 0,
          transform: `translate3d(${offsetPx.toFixed(1)}px, -50%, 0)`,
          display: "flex",
          alignItems: "center",
          gap: `${GAP_VH}vh`,
          willChange: "transform",
        }}
      >
        {REELS.map((reel, i) => {
          const distance = Math.abs(i - focus);
          // Neighbours stay visible but step back.
          const dim = Math.max(0.32, 1 - distance * 0.34);
          return (
            <div
              key={reel.id}
              style={{
                width: `${widths[i]}vh`,
                flex: "none",
                opacity: dim,
                // Background glow, brightest on the piece in focus. Static,
                // not cursor-driven: it belongs to the card, not to the
                // pointer. box-shadow rather than drop-shadow because the
                // card is an opaque rounded rectangle, so the rectangle IS
                // its silhouette and there is nothing to trace.
                boxShadow: `0 0 ${(46 - distance * 12).toFixed(0)}px rgba(255,255,255,${Math.max(
                  0.05,
                  0.2 - distance * 0.06
                ).toFixed(3)}), 0 24px 70px rgba(0,0,0,0.7)`,
                borderRadius: 14,
                transition: "opacity 240ms ease, box-shadow 240ms ease",
              }}
            >
              <HoverCard aspect={reel.ratio} radius={14}>
                {/* Neutral placeholder. Real work replaces the child. */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background:
                      "linear-gradient(150deg, #191a1e 0%, #111216 55%, #0a0b0d 100%)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                />
              </HoverCard>
            </div>
          );
        })}
      </div>

      {/* Black gradient at the right edge: the card entering falls into
          shadow rather than being cut off by the viewport. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to left, #000 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0) 22%)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to right, #000 0%, rgba(0,0,0,0.7) 4%, rgba(0,0,0,0) 16%)",
        }}
      />
    </div>
  );
}
