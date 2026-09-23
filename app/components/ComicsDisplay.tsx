"use client";

// THE COMICS CARD — the last holder on the ring.
//
// Four of the supplied strips, standing side by side on a diagonal and
// masked by the card itself, so the card reads as a window onto the
// project's own wall. On hover they slide against each other: the first
// and third rise, the second and fourth drop — a small, physical shuffle,
// like strips hung on a rail being brushed past.
//
// Plain DOM, not a WebGL case like the other cards: the work is flat by
// nature, and four images cost nothing to load next to a renderer, a
// context and a shader compile. The hover is `--pub-hover`, the one the
// ring already sets on the card, so this answers the same gesture as
// every other holder with no listener of its own.

import { COMICS } from "./aiComicsAssets";

/** The four on show, left to right, and where along each strip the card
 *  opens — as a share of the strip's own height — so each shows a
 *  different run of panels rather than four title panels. */
const SHOWN: { id: string; from: number }[] = [
  { id: "02-1", from: 0.02 },
  { id: "04", from: 0.1 },
  { id: "02-2", from: 0.06 },
  { id: "strip-1", from: 0.14 },
];

const STRIPS = SHOWN.map(({ id, from }) => ({
  id,
  from,
  src: COMICS.find((c) => c.id === id)!.wall,
}));

/** How far each strip travels on hover, as a share of the card's height. */
const SLIDE = 0.075;
/** The rack's size, and each strip's length within it, in card heights. */
const RACK = 1.5;
const STRIP_LEN = 1.18;
/** SLIDE as a translateY percentage — which is of the strip's own length. */
const SLIDE_PCT = (SLIDE / (RACK * STRIP_LEN)) * 100;

export function preloadComics() {
  if (typeof window === "undefined") return;
  for (const s of STRIPS) {
    const img = new Image();
    img.src = s.src;
  }
}

export default function ComicsDisplay({ luminance = 1 }: { luminance?: number }) {
  return (
    <div
      data-comics=""
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "linear-gradient(160deg, #1b1c21 0%, #101115 60%, #0a0b0d 100%)",
      }}
    >
      {/* The ring's dimming, as a dark layer's opacity rather than a CSS
          filter: a filter re-rasterises the whole card on every change,
          and this changes on every frame the ring turns. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "#000",
          opacity: Math.max(0, 1 - luminance).toFixed(3),
          pointerEvents: "none",
        }}
      />
      {/* The rack: turned onto the diagonal, and oversized so the turn
          never shows a corner of empty card. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${RACK * 100}%`,
          height: `${RACK * 100}%`,
          transform: "translate(-50%, -50%) rotate(-18deg)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "4.5%",
        }}
      >
        {STRIPS.map((s, i) => (
          <div
            key={s.id}
            style={{
              position: "relative",
              flex: "0 0 19%",
              height: `${STRIP_LEN * 100}%`,
              overflow: "hidden",
              borderRadius: 3,
              // Depth by shadow, the wall's own language: each strip
              // stands off the card behind it rather than printed on it.
              boxShadow: "0 18px 34px rgba(0,0,0,0.62), 0 3px 8px rgba(0,0,0,0.5)",
              // Alternate directions, and a slight stagger outward from
              // the centre so the four do not move as one block.
              transform: `translateY(calc(var(--pub-hover, 0) * ${
                (i % 2 === 0 ? -1 : 1) * SLIDE_PCT
              }%))`,
              transition: `transform ${620 + Math.abs(i - 1.5) * 60}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              willChange: "transform",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt=""
              draggable={false}
              decoding="async"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                transform: `translateY(${(-s.from * 100).toFixed(1)}%)`,
                height: "auto",
                display: "block",
                userSelect: "none",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
