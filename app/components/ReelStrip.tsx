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

import { useLayoutEffect, useRef, useState } from "react";
import HoverCard from "./HoverCard";
import { carry, easeInOutSine as baseEaseInOutSine } from "../lib/motion";
import "./reel-card.css";

// THE VIDEOS THEMSELVES ARE HOSTED ON CLOUDFLARE R2, not YouTube — see
// ReelVideoViewer, which plays these as plain HTML5 <video> sources. `r2`
// builds the object URL from the bucket's own object name (encoded, since
// several of them contain spaces) rather than every call site repeating
// the base URL.
const R2_BASE = "https://pub-0ddc522dfc834a90ab7c556775e1dd6f.r2.dev";
const r2 = (object: string) => `${R2_BASE}/${encodeURIComponent(object)}`;

// Source information needed to identify/load one video. Nothing beyond
// that — no per-video title/description; the reel's own title/meta cover it.
export type ReelVideo = {
  id: string;
  src: string;
  /** Optional: path to the supplied thumbnail image for this video. */
  thumbnail?: string;
};

export type Reel = {
  id: string;
  ratio: number;
  title: string;
  meta: string;
  /** Optional: project-level description, for the eventual project page. */
  description?: string;
  /** Optional: 0, 1, or many videos for this reel. Absent = no video yet. */
  videos?: ReelVideo[];
};

// 16:9 and 9:16, in the order asked for.
export const REELS: Reel[] = [
  {
    id: "r1",
    ratio: 16 / 9,
    title: "Showreel",
    meta: "2025 · motion",
    description:
      "My video editing work of now, summarised in a single video. The 2024 version follows, you can judge the difference yourself.",
    videos: [
      { id: "r1v1", src: r2("showreel 2025.mp4"), thumbnail: "/reels/thumbnails/showreel-2025.jpeg" },
      { id: "r1v2", src: r2("Showreel 2024.mp4"), thumbnail: "/reels/thumbnails/showreel-2024.jpeg" },
    ],
  },
  {
    id: "r2",
    ratio: 16 / 9,
    title: "CREATE",
    meta: "EIPL",
    description:
      "Six values. One word. One moving piece. CREATE was my way of giving EIPL's values a visual form.",
    videos: [
      { id: "r2v1", src: r2("CREATE v.04 final.mp4"), thumbnail: "/reels/thumbnails/create.jpeg" },
    ],
  },
  {
    id: "r3",
    // Landscape: only Bhajan Clubbing's showcase card is portrait.
    ratio: 16 / 9,
    title: "Excelsource International Social Media",
    meta: "social media",
    description:
      "Over 18 months, I worked across Excelsource International's different departments, creating social media content around what each one actually needed to communicate. These are some of the video pieces from that work.",
    videos: [
      { id: "r3v1", src: r2("SHOWCASE.mp4"), thumbnail: "/reels/thumbnails/eipl-01.jpeg" },
      { id: "r3v2", src: r2("eipl 002.mp4"), thumbnail: "/reels/thumbnails/eipl-02.jpeg" },
      { id: "r3v3", src: r2("eipl 003.mp4"), thumbnail: "/reels/thumbnails/eipl-03.jpeg" },
      { id: "r3v4", src: r2("eipl 004.mp4"), thumbnail: "/reels/thumbnails/eipl-04.jpeg" },
      { id: "r3v5", src: r2("eipl 005.mp4"), thumbnail: "/reels/thumbnails/eipl-05.jpeg" },
      { id: "r3v6", src: r2("eipl 006.mp4"), thumbnail: "/reels/thumbnails/eipl-06.jpeg" },
      { id: "r3v7", src: r2("eipl 007.mp4"), thumbnail: "/reels/thumbnails/eipl-07.jpeg" },
      { id: "r3v8", src: r2("eipl 008.mp4"), thumbnail: "/reels/thumbnails/eipl-08.jpeg" },
      { id: "r3v9", src: r2("eipl 009.mp4"), thumbnail: "/reels/thumbnails/eipl-09.jpeg" },
      { id: "r3v10", src: r2("eipl 010.mp4"), thumbnail: "/reels/thumbnails/eipl-10.jpeg" },
      // eipl 012.mp4 — an 11th piece from this same body of work; no
      // supplied thumbnail exists for it (only 001–010 got one), so it
      // falls back to the viewer's own no-thumbnail handling rather than
      // borrowing another video's image.
      { id: "r3v11", src: r2("eipl 012.mp4") },
    ],
  },
  {
    id: "r4",
    // Portrait: the showcase reel (and the rest of this project) is
    // 1080x1920 footage, not the landscape default the other projects use.
    ratio: 9 / 16,
    title: "Bhajan Clubbing",
    meta: "Gujarati bhajans",
    description:
      "I didn't expect Gujarati bhajans to look like this. Neither did I expect to make five reels about it.",
    videos: [
      { id: "r4v1", src: r2("VTG 01.mp4"), thumbnail: "/reels/thumbnails/vtg-01.jpeg" },
      { id: "r4v2", src: r2("VTG 02.mp4"), thumbnail: "/reels/thumbnails/vtg-02.jpeg" },
      { id: "r4v3", src: r2("VTG 03.mp4"), thumbnail: "/reels/thumbnails/vtg-03.jpeg" },
      { id: "r4v4", src: r2("VTG 04.mp4"), thumbnail: "/reels/thumbnails/vtg-04.jpeg" },
      { id: "r4v5", src: r2("VTG 05.mp4"), thumbnail: "/reels/thumbnails/vtg-05.jpeg" },
    ],
  },
  {
    id: "r5",
    // Landscape: only Bhajan Clubbing's showcase card is portrait.
    ratio: 16 / 9,
    title: "Freelance / Commercial Work",
    meta: "freelance",
    description:
      "Different people. Different products. Different briefs. A lot of figuring it out as I went.",
    videos: [
      { id: "r5v1", src: r2("BMW.mp4"), thumbnail: "/reels/thumbnails/bmw.jpeg" },
      { id: "r5v2", src: r2("prewedding.mp4"), thumbnail: "/reels/thumbnails/prewedding.jpeg" },
      { id: "r5v3", src: r2("whirlwind copper towels.mp4"), thumbnail: "/reels/thumbnails/whirlwind-copper-towels.jpeg" },
      { id: "r5v4", src: r2("heart failure.mp4"), thumbnail: "/reels/thumbnails/heart-failure.jpeg" },
      { id: "r5v5", src: r2("rachaita.mp4"), thumbnail: "/reels/thumbnails/rachaita.jpeg" },
      { id: "r5v6", src: r2("aircert.mp4"), thumbnail: "/reels/thumbnails/aicerts.jpeg" },
      { id: "r5v7", src: r2("watch.mp4"), thumbnail: "/reels/thumbnails/watch.jpeg" },
      { id: "r5v8", src: r2("silver oak.mp4"), thumbnail: "/reels/thumbnails/silver-oak.jpeg" },
    ],
  },
  {
    id: "r6",
    // Landscape: only Bhajan Clubbing's showcase card is portrait.
    ratio: 16 / 9,
    title: "Personal Art Account",
    meta: "Instagram",
    description: "An Instagram account I started to have somewhere to put these things.",
    videos: [
      { id: "r6v1", src: r2("i want to live.mp4"), thumbnail: "/reels/thumbnails/i-want-to-live.jpeg" },
      { id: "r6v2", src: r2("shringar.mp4"), thumbnail: "/reels/thumbnails/shringar.jpg" },
      { id: "r6v3", src: r2("mediums.mp4"), thumbnail: "/reels/thumbnails/mediums.jpg" },
      { id: "r6v4", src: r2("superstar.mp4"), thumbnail: "/reels/thumbnails/superstar.jpeg" },
      { id: "r6v5", src: r2("bling bang bang.mp4"), thumbnail: "/reels/thumbnails/bling-bang-bang.jpeg" },
      { id: "r6v6", src: r2("reminder.mp4"), thumbnail: "/reels/thumbnails/reminder.jpg" },
      { id: "r6v7", src: r2("palpal.mp4"), thumbnail: "/reels/thumbnails/pal-pal.jpeg" },
    ],
  },
  {
    id: "r7",
    ratio: 16 / 9,
    title: "Movie Edit",
    meta: "Baby Driver edit",
    description: "I watched Baby Driver and immediately wanted to edit it.",
    videos: [
      { id: "r7v1", src: r2("BABY1.mp4"), thumbnail: "/reels/thumbnails/baby-driver.jpeg" },
    ],
  },
];

// One height for every card; widths follow from the ratios above.
const CARD_H_VH = 54;
// Centre of the strip, as a share of viewport height. Below the middle, so
// the top third stays clear for the details and there is room underneath.
const STRIP_CENTRE_VH = 61;
const GAP_VH = 3.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// THE ENTRY, CARRYING THE FAN'S MOMENTUM.
//
// The scrub was a plain easeInOutSine, which opens at zero speed — and
// the move that hands over to it, the fan spreading into this row, used
// to close at zero speed too. So the row assembled, came to a complete
// standstill, and then started travelling again from rest: two moves,
// visibly. The cards' own poses lined up to the pixel, which is exactly
// why it read as a glitch rather than as a cut — nothing changed except
// that everything stopped.
//
// Sliced off its own flat start, the curve is the same shape, still
// settles at the far end, and still puts card 0 dead centre at p = 0 (the
// slice is renormalised, so f(0) is exactly 0 and the handover frame is
// unchanged) — but the row is ALREADY GLIDING on its first frame, at
// about 60% of the scrub's average rate, which is the speed DepthCards'
// spread is still travelling at when it lets go.
const STRIP_ENTRY_CARRY = 0.14;
// And sliced a little off its flat END too, for the same reason at the
// other seam: the camera roll that takes over used to begin turning from
// a standstill, immediately after this row had come to one. The row now
// arrives on the last piece still drifting — about a sixth of the scrub's
// average rate, which reads as a settle in progress rather than a stop —
// and the roll picks that drift up as its opening speed. f(1) is still
// exactly 1, so the last piece is still exactly centred, which is the
// point the camera stands on.
const STRIP_EXIT_CARRY = 0.96;
const focusEase = carry(baseEaseInOutSine, STRIP_ENTRY_CARRY, STRIP_EXIT_CARRY);

/** The strip's own progress at which reel `k` is exactly centred — the
 *  inverse of `focusEase`, solved by bisection (the curve is monotonic).
 *  Used to give a touch scroll somewhere to come to rest. */
export function reelRestProgress(k: number, count = REELS.length): number {
  const want = count > 1 ? k / (count - 1) : 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (focusEase(mid) < want) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export { CARD_H_VH, STRIP_CENTRE_VH, GAP_VH };

// THE card face, for every beat that draws these eight pieces: the strip,
// the camera roll and the fan. It lived in three places with three
// different gradients, which is why the strip visibly "became a different
// design" the moment the roll took over. One definition, no cross-fade.
export const CARD_FACE_BG =
  "linear-gradient(150deg, #191a1e 0%, #111216 55%, #0a0b0d 100%)";
export const CARD_FACE_BORDER = "1px solid rgba(255,255,255,0.09)";
export const CARD_RADIUS = 14;

// THE CARD'S GLOW, and the two gradients the frame falls away into. One
// definition, because the beats either side of this one have to be able to
// arrive at this frame and leave it: the fan assembles into it and the
// camera roll opens on it. They were only here, so a card had no glow
// until the instant REELS took the pane and then had one — the single
// largest thing that changed at that hand-over.
export const CARD_GLOW_SHADOW =
  "0 0 46px rgba(255,255,255,0.2), 0 24px 70px rgba(0,0,0,0.7)";
/** Glow strength for a card `distance` pieces away from the one in focus. */
export const cardGlow = (distance: number) =>
  Math.max(0.25, 1 - distance * 0.32);
/** Step-back opacity for a card `distance` pieces away from focus. */
export const cardDim = (distance: number) => Math.max(0.32, 1 - distance * 0.34);
export const EDGE_FADE_RIGHT =
  "linear-gradient(to left, #000 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0) 22%)";
export const EDGE_FADE_LEFT =
  "linear-gradient(to right, #000 0%, rgba(0,0,0,0.7) 4%, rgba(0,0,0,0) 16%)";
/** Where the piece's details sit, in vh — the clear band above the strip. */
export const DETAILS_TOP_VH = STRIP_CENTRE_VH - CARD_H_VH / 2 - 14;

// How much of the strip's scroll the entry occupies: the row arrives
// already assembled but pulled back, and pushes in to full size before
// the scrub starts.
export const STRIP_ENTRY = 0;

/**
 * How far left the row is nudged while it is still pulled back, so the
 * assembled run sits in the middle of the frame instead of hanging off
 * card 0 to the right. Eases to zero as the entry finishes, which is what
 * keeps the hand-off from the fan exact.
 */
export function stripEntryShift(vw: number, vh: number) {
  const { centres, total } = layout(REELS);
  // Centre the WHOLE assembled run, not just its first few pieces: at the
  // entry scale all eight are in frame, so anchoring on card 0 left the
  // row hanging off to the right.
  const runCentreVh = total / 2;
  return -(runCentreVh - centres[0]) * (vh / 100) * stripEntryScale(vw, vh);
}

/** Lift while the row is pulled back, so it sits centred rather than low. */
export function stripEntryLift(vh: number) {
  return -((STRIP_CENTRE_VH - 50) / 100) * vh;
}

/**
 * The scale the strip arrives at. Chosen so the first four pieces are all
 * in frame, because that is what makes the fan's arrival read as "these
 * became a row" rather than as one card filling the screen. The pivot is
 * card 0's centre, which is the point the strip holds fixed.
 */
export function stripEntryScale(vw: number, vh: number) {
  const { widths, centres } = layout(REELS);
  const toPx = (v: number) => (v / 100) * vh;
  const rightReach = toPx(centres[3] + widths[3] / 2 - centres[0]);
  const leftReach = toPx(widths[0] / 2);
  return Math.min(
    1,
    (vw * 0.47) / Math.max(1, rightReach),
    (vw * 0.47) / Math.max(1, leftReach)
  );
}

/** Card widths and their centre offsets along the strip, in vh units. */
export function layout(reels: Reel[]) {
  const widths = reels.map((r) => CARD_H_VH * r.ratio);
  const centres: number[] = [];
  let x = 0;
  for (const w of widths) {
    centres.push(x + w / 2);
    x += w + GAP_VH;
  }
  return { widths, centres, total: x - GAP_VH };
}

export default function ReelStrip({
  progress,
  onOpenReel,
}: {
  progress: number;
  /** Called with a reel's id when a card that has videos is clicked. */
  onOpenReel?: (id: string) => void;
}) {
  const p = clamp01(progress);
  const { widths, centres } = layout(REELS);
  const [vw, setVw] = useState(1440);
  const [vh, setVh] = useState(900);
  // Which card the pointer is actually over, for the hover reveal above
  // the strip below — separate from `focus`, which is scroll-driven.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect, not useEffect. This section MOUNTS MID-SCROLL, on the
  // exact frame the fan finishes assembling, and every distance in it is
  // in real viewport units off the state above. A deferred effect let the
  // 1440x900 placeholder reach the screen for one frame at that precise
  // seam — the whole row drawn at the wrong scale on the single frame the
  // handover happens, at every viewport that is not 1440x900. Reading it
  // before paint removes the one thing guaranteed to be visible.
  useLayoutEffect(() => {
    const read = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // The entry: the assembled row pushes in from the scale the fan handed
  // it over at. The scrub only starts once it has arrived, so the first
  // thing this section does is finish the previous section's sentence.
  // Always 1: the arrival is the previous section's job now.
  const entryT = 1;
  const scale = 1;

  // Which card is centred. Eased so the row settles at the far end rather
  // than sliding to a halt at constant speed — and entered with the
  // momentum the fan hands over (see focusEase).
  const focus = focusEase(p) * (REELS.length - 1);
  // No entrance of their own. DepthCards brings the details up as the fan
  // assembles (it reads DETAILS_TOP_VH and the piece's own title from
  // here), so by the frame this section takes the pane they are already
  // fully up — and a fade here would fade them a second time.
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
      <div
        style={{
          position: "absolute",
          top: `${STRIP_CENTRE_VH}vh`,
          left: 0,
          // Scaled about the focused card's own centre, which is the point
          // offsetPx has already parked at the middle of the frame — so the
          // entry pushes in without the row sliding sideways.
          transformOrigin: `${toPx(centreVh).toFixed(1)}px ${(toPx(CARD_H_VH) / 2).toFixed(1)}px`,
          transform: `translate3d(${(offsetPx + stripEntryShift(vw, vh) * (1 - entryT)).toFixed(
            1
          )}px, calc(-50% + ${(stripEntryLift(vh) * (1 - entryT)).toFixed(1)}px), 0) scale(${scale.toFixed(4)})`,
          display: "flex",
          alignItems: "center",
          gap: `${GAP_VH}vh`,
          willChange: "transform",
        }}
      >
        {REELS.map((reel, i) => {
          const distance = Math.abs(i - focus);
          // Only the pieces that can actually be in frame carry their
          // contents. The row is nearly six viewport-widths long, and a
          // card that is four screens away still costs its glow layer and
          // its hover shell every frame.
          const halfSpan = (vw / 2 + toPx(widths[i]) / 2) / Math.max(1, toPx(1));
          const near = Math.abs(centres[i] - centreVh) < halfSpan + 8;
          // Neighbours stay visible but step back.
          const dim = cardDim(distance);
          return (
            <div
              key={reel.id}
              data-strip-card={i}
              style={{
                width: `${widths[i]}vh`,
                flex: "none",
                opacity: dim,
                borderRadius: 14,
                position: "relative",
                // Promoted, because `dim` is scrubbed by scroll and so
                // changes every frame: on an unpromoted element that
                // repaints the whole card each time.
                willChange: "opacity",
              }}
            >
              {/* THE GLOW, as its own layer.
                  It used to be a box-shadow on the card whose radius and
                  alpha were both functions of the card's distance from
                  focus — so a 70px blur over an 864x486 card was
                  re-rasterised every frame, eight times over, and a
                  `transition` on it restarted every frame as well. That
                  one property took the whole strip beat to about 1fps.
                  The shadow is constant now and only the layer's opacity
                  moves, which the compositor does without repainting. */}
              {near && (
                <>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 14,
                      boxShadow: CARD_GLOW_SHADOW,
                      opacity: cardGlow(distance),
                      willChange: "opacity",
                      pointerEvents: "none",
                    }}
                  />
                  <HoverCard aspect={reel.ratio} radius={14}>
                    {/* The project's showcase (first) video's thumbnail as
                        the card's artwork, and only that — title/
                        description/video count show above the strip
                        instead (see the focused-details block above),
                        revealed on hover of this same card. */}
                    <div
                      className="reel-card-face"
                      data-cursor={reel.videos?.length ? "view" : undefined}
                      role={reel.videos?.length ? "button" : undefined}
                      tabIndex={reel.videos?.length ? 0 : undefined}
                      aria-label={reel.videos?.length ? `Open ${reel.title}` : undefined}
                      onClick={
                        reel.videos?.length ? () => onOpenReel?.(reel.id) : undefined
                      }
                      onKeyDown={
                        reel.videos?.length
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onOpenReel?.(reel.id);
                              }
                            }
                          : undefined
                      }
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() =>
                        setHoveredIndex((v) => (v === i ? null : v))
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                        background: CARD_FACE_BG,
                        border: CARD_FACE_BORDER,
                        cursor: reel.videos?.length ? "pointer" : undefined,
                        // .hc-content has pointer-events:none (an inherited
                        // property) so the hover tilt's own layers never
                        // steal a click meant for the card underneath —
                        // this re-enables it for the one card that has
                        // something to open.
                        pointerEvents: reel.videos?.length ? "auto" : undefined,
                      }}
                    >
                      {reel.videos?.[0]?.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={reel.videos[0].thumbnail}
                          alt=""
                          draggable={false}
                          decoding="async"
                          loading="lazy"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                    </div>
                  </HoverCard>

                  {/* THE PROJECT NUMBER. Stays put below the card whether
                      hovered or not — the one piece of text the card ever
                      carries by default. */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "100%",
                      marginTop: 10,
                      textAlign: "center",
                      pointerEvents: "none",
                      fontWeight: 500,
                      fontSize: "clamp(12px, 0.95vw, 15px)",
                      letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  {/* THE HOVER INFO BLOCK. Anchored to THIS card's own top
                      edge and growing upward into the clear space above —
                      never the card's own layout, so it can never push the
                      card down or spill below it. Name, description and
                      video count read as one group, not three separate
                      labels: the name is the only one with any glow (a
                      restrained one, not neon), the other two are plain
                      text set smaller than it. Hidden entirely until this
                      exact card is hovered — nothing here is ever shown
                      permanently. */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "100%",
                      marginBottom: 20,
                      transform: `translate(-50%, ${hoveredIndex === i ? "0px" : "8px"})`,
                      width: "max(140%, 260px)",
                      maxWidth: "min(56vw, 480px)",
                      textAlign: "center",
                      pointerEvents: "none",
                      opacity: hoveredIndex === i ? 1 : 0,
                      transition: "opacity 240ms ease, transform 240ms ease",
                      zIndex: hoveredIndex === i ? 3 : 1,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "clamp(19px, 1.7vw, 28px)",
                        letterSpacing: "0.01em",
                        color: "#fff",
                        textShadow:
                          "0 0 1px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.24), 0 2px 22px rgba(0,0,0,0.55)",
                      }}
                    >
                      {reel.title}
                    </div>
                    {reel.description && (
                      <div
                        style={{
                          marginTop: 10,
                          fontWeight: 300,
                          fontSize: "clamp(13px, 1vw, 16px)",
                          lineHeight: 1.5,
                          letterSpacing: "0.02em",
                          color: "rgba(255,255,255,0.72)",
                          maxWidth: "42ch",
                          marginLeft: "auto",
                          marginRight: "auto",
                        }}
                      >
                        {reel.description}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 8,
                        fontWeight: 500,
                        fontSize: 12,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {reel.videos?.length ?? 0} {(reel.videos?.length ?? 0) === 1 ? "video" : "videos"}
                    </div>
                  </div>
                </>
              )}
              {!near && (
                <div style={{ width: "100%", aspectRatio: String(reel.ratio) }} />
              )}
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
          background: EDGE_FADE_RIGHT,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: EDGE_FADE_LEFT,
        }}
      />
    </div>
  );
}
