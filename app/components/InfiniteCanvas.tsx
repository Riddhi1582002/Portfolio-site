"use client";

// THE GALLERY, and the way home.
//
// The model is three layers, and only one of them ever moves:
//
//   1. A FIXED rounded viewport. It is a window cut in the black, with
//      overflow hidden. It never pans, never scales, never rotates.
//   2. FIXED "ART", on that window's own layer, behind the work. It sits
//      at one screen position for the whole beat — the position the hero
//      wordmark occupies on page one — and stays there while the work
//      slides over it, covering and revealing it.
//   3. ONE MOVING COMPOSITION. Every image is a child of a single plane.
//      Dragging translates that plane and nothing else, so the images
//      keep their relative positions exactly and the window stays put.
//
// There is no camera pan, no scene move, no masonry, no grid, no carousel
// and no per-card dragging. The composition is authored by hand, in cell
// coordinates, with an intentional irregular arrangement and a deliberate
// clear space at its middle (see GAP) that the return transition flies
// through.
//
// "Infinite" is a real wrap, not a very large plane: the work lives in one
// CELL, and only as many copies of that cell as the window can actually
// see are drawn around wherever the pan currently is. The pan offset is
// taken modulo the cell before it is applied, so the plane can be dragged
// forever in any direction and the images are always there — no edges, no
// bounds, and a handful of cells' worth of DOM however far the reader
// travels.
//
// Clicking an image (a click, not a drag) expands it in place: the card
// grows from the exact box it occupied in the composition to a focused
// card at the middle of the window, with the rest of the gallery still
// visible behind it. A small arrow at its top-right turns it over on Y to
// its details, and closing sends it back to the box it came from.
//
// Scrolling DOWN out of the settled gallery — past the natural end of the
// page's own scroll track — does not do nothing and does not reverse the
// page. It runs a dedicated return transition: scrolling is locked, the
// gesture drives the camera forward through the gap between the images
// toward the ART that was always there, and only once that has visually
// arrived is the page's own scroll position reset to the top.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ART_FONT,
  ART_FONT_SIZE,
  ART_Y_REST,
  GLOW_STRENGTH,
  STAGE_H,
  STAGE_W,
  glowShadow,
} from "./HeroSection";
import { BULB_GLASS_RATIO, bulbSizePx } from "./CordSection";
import { carry } from "../lib/motion";
import HoverCard from "./HoverCard";

// One repeating cell of the composition, in canvas px.
//
// Six columns and three bands. The reference's arrangement is not a grid
// and not masonry: the columns are at fixed x, every image in a band
// shares a TOP, and the heights vary freely — so the black falls where
// the short images are, and the bands are pitched off the tallest image
// in each. One slot is deliberately left empty (band C, column 3); that
// void is the clear space the return transition flies through.
const CELL_W = 1620;
const CELL_H = 1083;

/**
 * One image in the composition.
 *
 * x, y, w and h are INDEPENDENT on purpose: no aspect ratio is imposed
 * anywhere in this file, so replacing a placeholder with real artwork is
 * a matter of editing four numbers and the content, and nothing else in
 * the layout moves. `tone` only varies the placeholder shading so the
 * arrangement reads as work rather than as eighteen identical rectangles.
 */
type Piece = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: number;
  title: string;
  meta: string;
};

// The composition, authored by hand. Column x/width and band tops are
// commented on each row so a piece can be moved or resized without having
// to re-derive the arrangement.
//
//   columns  x:   0 / 278 / 536 / 826 / 1076 / 1362
//            w: 236 / 210 / 250 / 200 /  246 /  218
//   bands    y:  40 (max h 315) / 401 (max h 330) / 777 (max h 300)
//   the next cell's band A sits at 1123 = CELL_H + 40, so the vertical
//   gutter across the wrap is the same 46 as everywhere else.
const PIECES: Piece[] = [
  // Band A
  { id: "a0", x: 0, y: 40, w: 236, h: 300, tone: 0, title: "First Light", meta: "Print / 2024" },
  { id: "a1", x: 278, y: 40, w: 210, h: 150, tone: 2, title: "Held Note", meta: "Editorial / 2024" },
  { id: "a2", x: 536, y: 40, w: 250, h: 315, tone: 1, title: "Long Exposure", meta: "Film / 2023" },
  { id: "a3", x: 826, y: 40, w: 200, h: 150, tone: 3, title: "Paper Cut", meta: "Poster / 2025" },
  { id: "a4", x: 1076, y: 40, w: 246, h: 260, tone: 2, title: "Slow Pan", meta: "Motion / 2024" },
  { id: "a5", x: 1362, y: 40, w: 218, h: 190, tone: 0, title: "Offcut", meta: "Sketch / 2023" },
  // Band B
  { id: "b0", x: 0, y: 401, w: 236, h: 150, tone: 3, title: "Half Frame", meta: "Photo / 2023" },
  { id: "b1", x: 278, y: 401, w: 210, h: 290, tone: 0, title: "Night Study", meta: "Identity / 2024" },
  { id: "b2", x: 536, y: 401, w: 250, h: 190, tone: 2, title: "Cross Fade", meta: "Film / 2025" },
  { id: "b3", x: 826, y: 401, w: 200, h: 330, tone: 1, title: "Standing Wave", meta: "Campaign / 2025" },
  { id: "b4", x: 1076, y: 401, w: 246, h: 150, tone: 3, title: "Margin", meta: "Book / 2024" },
  { id: "b5", x: 1362, y: 401, w: 218, h: 300, tone: 2, title: "Tonal Range", meta: "Type / 2024" },
  // Band C. Column 3 is empty on purpose — see GAP.
  { id: "c0", x: 0, y: 777, w: 236, h: 250, tone: 1, title: "Contact Sheet", meta: "Photo / 2024" },
  { id: "c1", x: 278, y: 777, w: 210, h: 170, tone: 3, title: "Endnote", meta: "Print / 2023" },
  // THE piece the iris sits on — see IRIS_PIECE_ID.
  { id: "c2", x: 536, y: 777, w: 250, h: 140, tone: 0, title: "Filament", meta: "Motion / 2025" },
  { id: "c4", x: 1076, y: 777, w: 246, h: 300, tone: 2, title: "Wide Cut", meta: "Broadcast / 2025" },
  { id: "c5", x: 1362, y: 777, w: 218, h: 160, tone: 1, title: "Colophon", meta: "Packaging / 2023" },
];

// The empty slot in band C, in cell coordinates. The nearest image edge is
// ~145 canvas px away in every direction (verified against PIECES), which
// is what makes the return transition a flight BETWEEN the images rather
// than through one of them.
const GAP = { x: 926, y: 955 };

// THE piece the iris sits on: the black disc the previous beat leaves the
// frame on is the pupil painted on this card, and the zoom out starts
// hard against it. PencilSection draws its last frame from the same
// numbers, so the swap between the two is geometry, not a cross-fade.
const IRIS_PIECE_ID = "c2";
/** The iris's diameter as a share of its card's height. */
const IRIS_RATIO = 0.78;
/** How much of the reveal the camera spends pulling back. */
const REVEAL_END = 0.5;

// ART's size in the settled gallery, as a share of the size page one
// gives it. The return transition multiplies it back out to exactly 1.
const ART_REST_RATIO = 0.28;
// Where the settled gallery starts listening for the return gesture, as a
// share of the section's progress. Well clear of the pull-back, so
// scrolling back up part-way through the reveal still simply reverses it.
const ARM_FROM = 0.8;
// How far the camera travels forward on the way home. Enough that the
// nearest image has passed the frame's corner at every viewport size the
// site is checked at — see the clearance table in the layout check: the
// worst case (2560x1440) needs 10.1x, and this leaves headroom.
const DOLLY_MAX = 18;
// Wheel pixels for the whole return. A trackpad flick is ~400-900px, so
// the move is one decisive gesture rather than a scrub — sized so a single
// firm flick (not a scrub) is enough to carry it, rather than needing two.
const RETURN_WHEEL_PX = 650;
const RETURN_TOUCH_PX = 370;
const RETURN_KEY_STEP = 0.22;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// THE PULL-BACK, and THE SETTLE THAT TAKES IT ON.
//
// The settle's own comment says the composition "keeps moving for a moment
// after the camera stops". It did not: easeOutCubic brought the pull-back
// to a dead halt, easeInOutCubic started the slide from another one, and
// between them the gallery was a still photograph. Two movements that were
// written to read as one, joined at zero.
//
// The pull-back now lands still drifting backwards, and the slide opens at
// the speed that drift is carrying, so the composition genuinely keeps
// going and only then comes to rest. Both still land on exactly 1 —
// revealScale reaches exactly 1 and the clear space still arrives exactly
// over ART.
const revealEase = carry(easeOutCubic, 0, 0.78);
const settleEase = carry(easeInOutCubic, 0.24, 1);

// THE FLIGHT HOME.
//
// `returnT` is already eased toward the gesture's target by the rAF loop
// below, which responds to a flick instantly. Running it through a plain
// easeInOutCubic threw that away: the composed curve leaves at zero speed,
// so the first part of every flick moved the camera by nothing at all and
// the gesture felt disconnected from the picture. Entered on the curve's
// shoulder instead, the camera is travelling on the frame the flick lands.
// It still arrives at exactly 1 — ART reaches exactly the hero's size and
// position there, which is what makes the handover to page one a no-op.
const camEase = carry(easeInOutCubic, 0.26, 0.9);
// A drag shorter than this is a click, not a pan.
const CLICK_SLOP_PX = 5;

// The composition is laid out in fixed canvas px, so without this a 420px
// piece sat on a 320px phone larger than the screen — one image visible
// and no sense of a composition at all. The whole plane is scaled to the
// viewport instead of reflowing it, so the arrangement is identical
// everywhere and only its size changes.
const FIT_REFERENCE_VW = 1440;
const FIT_MIN = 0.42;

/** The viewport fit the composition always carries. */
export function galleryFit(vw: number) {
  return Math.min(1, Math.max(FIT_MIN, vw / FIT_REFERENCE_VW));
}

/**
 * The frame the zoom out starts from, in screen px: the iris card scaled
 * until the iris painted on it is exactly the size the bulb's underside
 * was, with the iris centred in the viewport.
 *
 * PencilSection draws its final card from these same numbers, so the cut
 * between the two beats is geometry rather than a cross-fade.
 */
export function irisFrame(vw: number, vh: number) {
  const piece = PIECES.find((x) => x.id === IRIS_PIECE_ID)!;
  const fit = galleryFit(vw);
  const cardW = piece.w * fit;
  const cardH = piece.h * fit;
  // The circle is the BULB, at the size the bulb actually is on screen —
  // it is the same object, seen from underneath, so it cannot change size
  // as it darkens. The card follows from it at the ratio it already had,
  // and the camera's distance is whatever puts that card at that size.
  const iris = bulbSizePx(vw, vh) * BULB_GLASS_RATIO;
  const scale = iris / IRIS_RATIO / cardH;
  return {
    piece,
    fit,
    scale,
    /** Screen size of the card and of the iris at that scale. */
    cardW: cardW * scale,
    cardH: cardH * scale,
    iris,
    irisPlane: piece.h * IRIS_RATIO,
  };
}

/**
 * Where page one's wordmark actually is, in screen px.
 *
 * The hero composes on a 1920x1080 stage fitted like `object-fit: contain`
 * and centred in the pane, with ART's line box centred at stage y
 * 540 + ART_Y_REST. Deriving the gallery's ART from the same numbers is
 * what lets the return transition ARRIVE on the hero rather than dissolve
 * into it: at the end of the move this element is the same face, the same
 * size, in the same place, so resetting the page underneath it changes
 * nothing on screen.
 */
function heroArt(vw: number, vh: number) {
  const stage = Math.min(vw / STAGE_W, vh / STAGE_H);
  return {
    stage,
    fontPx: ART_FONT_SIZE * stage,
    centerY: vh / 2 + ART_Y_REST * stage,
  };
}

const mod = (v: number, m: number) => ((v % m) + m) % m;
/** Signed distance from a to b on a ring of size m, taking the short way. */
const ringDelta = (a: number, b: number, m: number) => {
  let d = (b - a) % m;
  if (d > m / 2) d -= m;
  if (d < -m / 2) d += m;
  return d;
};

const TONES = [
  "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
  "linear-gradient(120deg, #1d2027 0%, #14161b 60%, #0b0c0f 100%)",
  "linear-gradient(200deg, #24262b 0%, #181a1f 50%, #0e0f13 100%)",
  "linear-gradient(165deg, #1a1c22 0%, #121318 58%, #090a0d 100%)",
];

function Placeholder({
  tone = 0,
  radius = 10,
  hovered = false,
  label,
  labelSize = 15,
  labelOpacity = 1,
}: {
  tone?: number;
  radius?: number;
  hovered?: boolean;
  label?: string;
  labelSize?: number;
  labelOpacity?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: radius,
        overflow: "hidden",
        background: TONES[tone % TONES.length],
        border: `1px solid rgba(255,255,255,${hovered ? 0.22 : 0.1})`,
        // Flat, like the reference. The composition is dense — 38 to 50
        // canvas px between images — and the old 34px white bloom filled
        // every one of those gutters with haze. A whisper of lift on
        // hover instead of the pointer tilt the other sections use: a
        // tilt tracking the pointer would fight the pan happening under
        // the same gesture.
        boxShadow: hovered
          ? "0 0 22px rgba(255,255,255,0.11), 0 12px 34px rgba(0,0,0,0.7)"
          : "0 0 18px rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.6)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition:
          "transform 300ms cubic-bezier(0.22,0.7,0.24,1), box-shadow 300ms ease, border-color 300ms ease",
      }}
    >
      {label && (
        <>
          {/* A short scrim under the caption, not over the whole image:
              the caption has to stay legible on artwork of any value once
              the placeholders are replaced. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: labelSize * 4.2,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0) 100%)",
              opacity: labelOpacity,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: labelSize * 0.95,
              right: labelSize * 0.7,
              bottom: labelSize * 0.8,
              fontWeight: 600,
              fontSize: labelSize,
              lineHeight: 1.2,
              letterSpacing: "0.005em",
              color: "rgba(255,255,255,0.94)",
              opacity: labelOpacity,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </>
      )}
    </div>
  );
}

/** An expanded piece, plus the exact screen box it grew out of. */
type Opened = { piece: Piece; key: string; from: DOMRect };

export default function InfiniteCanvas({
  progress,
  sans,
  vw,
  vh,
  visible = true,
}: {
  progress: number;
  sans: string;
  vw: number;
  vh: number;
  /**
   * False for the lead-in stretch where this section is mounted early —
   * fourteen pieces per cell plus the plane's first layout is not work to
   * do on the frame the pull-back starts — but its own progress has not
   * begun. This backdrop is opaque, so while it was unconditionally
   * visible it covered PencilSection with a picture that could not move,
   * because `progress` is clamped at 0 throughout that stretch. Same
   * guard CordSection and PencilSection already use.
   */
  visible?: boolean;
}) {
  const p = clamp01(progress);
  const planeRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  // 0 = still in the composition, 1 = fully expanded. Driven by a CSS
  // transition rather than a rAF loop: the card is one element and the
  // browser can run the whole grow on the compositor.
  const [openT, setOpenT] = useState(0);
  // Keyed by cell AND piece: the same piece is drawn several times, so
  // keying on its id alone lit every copy at once.
  const [hovered, setHovered] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const fit = galleryFit(vw);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // THE ZOOM OUT (unchanged in kind: this is the existing entry transition).
  //
  // The previous beat hands over a frame that is one thing: the iris,
  // hard against the lens, on the card it is painted on. Nothing in the
  // gallery moves for this — the camera pulls back, so the whole
  // composition scales down about the frame's centre and the rest of the
  // work arrives from outside the frame because it was always there.
  const frame = useMemo(() => irisFrame(vw, vh), [vw, vh]);
  const revealT = revealEase(span(p, 0, REVEAL_END));
  // Geometric, not linear: a linear pull-back from 5x reads as the images
  // rushing away and then crawling. Interpolating the LOG of the scale
  // makes each moment of the move cover the same proportion of distance,
  // which is what a real dolly looks like.
  const revealScale = Math.exp(Math.log(frame.scale) * (1 - revealT));
  const revealing = revealT < 0.999;
  // The iris fades out as the camera gets back: once its card is one of
  // several on screen it should read as a piece of work, not as the
  // thing we came through.
  const irisFade = span(revealScale, 1.0, 1.85);

  // ── THE RETURN TRANSITION ───────────────────────────────────────────
  // A dedicated state, not reverse scrolling. `returnTargetRef` is what
  // the gesture has asked for; `returnT` is what is rendered, easing
  // toward it so a chunky wheel notch is a glide. See the handlers below.
  const [returning, setReturning] = useState(false);
  const [returnT, setReturnT] = useState(0);
  const returningRef = useRef(false);
  const returnTargetRef = useRef(0);
  const returnTRef = useRef(0);

  const camT = camEase(returnT);
  // A real dolly: the composition is near the lens and rushes past it,
  // ART is far behind and swells slowly. Same camera, two depths, which
  // is what makes the move read as travelling THROUGH the gap rather
  // than as the plane merely growing.
  const dolly = returning ? Math.exp(Math.log(DOLLY_MAX) * camT) : 1;

  const hero = useMemo(() => heroArt(vw, vh), [vw, vh]);
  // ART's size on the way home is solved, not tweened to a guess: at
  // camT = 1 it is EXACTLY the hero's, so the page-one reset underneath
  // it is invisible.
  const artK = Math.exp(Math.log(1 / ART_REST_RATIO) * camT);
  const artFontPx = hero.fontPx * ART_REST_RATIO * artK;
  // In the gallery it sits at the WINDOW's centre — the composition is
  // scaled about that point, so the camera travels straight down the axis
  // the clear space is on. It is fixed there for the whole beat; the only
  // thing that ever moves it is the arrival, which carries it the last few
  // dozen pixels onto page one's own position. That drift is part of the
  // camera move, not a separate animation: at camT = 1 it is exact.
  const artCentreY = vh / 2 + (hero.centerY - vh / 2) * camT;
  const artIn = span(revealT, 0.5, 1);
  // Bright enough to read as the wordmark it is — the reference's word is
  // solid white behind the work, not a watermark — but still clearly
  // BEHIND the images. It reaches full strength exactly as the camera
  // arrives, which is what makes the handover to page one a no-op.
  const artOpacity = (0.36 + 0.64 * easeOutCubic(camT)) * artIn;

  // The rounded window itself. It opens out of the previous beat's
  // full-bleed black as the pull-back lands, and opens back OUT to full
  // bleed as the camera leaves through it on the way home.
  const frameMax = useMemo(() => {
    const m = Math.min(vw, vh);
    return {
      inset: Math.round(Math.min(30, Math.max(8, m * 0.028))),
      radius: Math.round(Math.min(34, Math.max(14, m * 0.036))),
    };
  }, [vw, vh]);
  const frameT = span(revealT, 0.55, 1) * (1 - easeOutCubic(span(returnT, 0, 0.4)));
  const frameInset = frameMax.inset * frameT;
  const frameRadius = frameMax.radius * frameT;

  // HOW MANY CELLS TO DRAW.
  //
  // A fixed 3x3 block was nine copies of everything at every moment of
  // the beat, including the flight home where the plane is scaled many
  // times over and one cell covers the frame several times. The visible
  // slice of the plane is vw/eff by vh/eff, and the wrapped offset is
  // somewhere inside one cell, so the block only ever has to span that
  // slice plus the cell it starts in.
  const eff = dolly * revealScale * fit;
  const cellRange = (extent: number, cell: number) => {
    const half = extent / (2 * eff);
    const lo = Math.floor((extent / 2 - half) / cell);
    const hi = Math.floor((cell + extent / 2 + half) / cell);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  };
  const cols = revealScale > 2 ? [0] : cellRange(vw, CELL_W);
  const rows = revealScale > 2 ? [0] : cellRange(vh, CELL_H);

  // The pan settles onto the GAP fast, in the first third of the return,
  // while the dolly is still shallow — so the move reads as the camera
  // lining up on the clear space and then travelling through it.
  const panHomeT = easeOutCubic(span(returnT, 0, 0.32));
  const homeRef = useRef(panHomeT);
  homeRef.current = panHomeT;

  // The plane offset the pull-back is centred on: the iris card's middle
  // at the middle of the frame.
  //
  // NOT wrapped to the cell. The pull-back draws the centre cell only, so
  // the offset has to be the one that puts THAT copy of the card under the
  // lens; taking it modulo the cell can name the copy one cell over, which
  // is off screen. Wrapping resumes when the reveal ends and the full
  // block is drawn again, and the two offsets are the same position by then.
  const irisX = frame.piece.x + frame.piece.w / 2 - vw / 2;
  const irisY = frame.piece.y + frame.piece.h / 2 - vh / 2;

  // Writing the transform from a ref keeps a drag off React's render path;
  // at fourteen pieces per cell a state update per pointermove is visible.
  const write = useCallback(() => {
    const plane = planeRef.current;
    if (!plane) return;
    if (revealing) {
      // Locked to the iris while the camera pulls back — the reader has
      // no say over the framing until the gallery has arrived.
      plane.style.transform = `translate3d(${(-irisX).toFixed(2)}px, ${(-irisY).toFixed(
        2
      )}px, 0)`;
      return;
    }
    const h = homeRef.current;
    const wx = mod(panRef.current.x, CELL_W);
    const wy = mod(panRef.current.y, CELL_H);
    // Where the plane has to sit for the GAP to be dead centre. Taken the
    // short way round the wrap so the approach never unwinds a whole cell.
    const tx = mod(GAP.x - vw / 2, CELL_W);
    const ty = mod(GAP.y - vh / 2, CELL_H);
    const ox = wx + ringDelta(wx, tx, CELL_W) * h;
    const oy = wy + ringDelta(wy, ty, CELL_H) * h;
    plane.style.transform = `translate3d(${(-ox).toFixed(2)}px, ${(-oy).toFixed(2)}px, 0)`;
  }, [vw, vh, revealing, irisX, irisY]);

  // Re-write the plane whenever the return advances or the frame resizes,
  // not only when the pointer moves it.
  useEffect(() => {
    write();
  }, [write, panHomeT, revealScale]);

  // THE SETTLE.
  //
  // The pull-back has to end on the iris card, dead centre — that is the
  // match cut. But the iris card is then parked exactly over ART, so the
  // frame the reader is handed has the wordmark hidden behind a
  // placeholder. So the composition keeps moving for a moment after the
  // camera stops: it slides the ~280px that puts its clear space over
  // ART, and the gallery comes to rest on a frame that reads.
  //
  // Only until the reader takes hold of it. One drag and this stops
  // writing the pan for good — nothing should move the composition out
  // from under a hand that is on it.
  const untouchedRef = useRef(true);
  const settleT = settleEase(span(p, REVEAL_END, REVEAL_END + 0.22));
  useEffect(() => {
    if (revealing) {
      // Hand the pan over at the value the reveal left it on, so the
      // first drag after the gallery arrives does not snap it to 0,0.
      panRef.current = { x: irisX, y: irisY };
      untouchedRef.current = true;
      return;
    }
    if (!untouchedRef.current) return;
    panRef.current = {
      x: irisX + (GAP.x - vw / 2 - irisX) * settleT,
      y: irisY + (GAP.y - vh / 2 - irisY) * settleT,
    };
    write();
  }, [revealing, irisX, irisY, settleT, vw, vh, write]);

  // ── DRAGGING THE COMPOSITION ────────────────────────────────────────
  //
  // Pointer capture is taken only once the gesture is actually a drag.
  //
  // Capturing on pointerdown looks harmless but silently breaks opening a
  // card: while a pointer is captured the browser retargets the resulting
  // `click` to the capturing element, so the click landed on the pan
  // surface and never reached the piece under the finger. Deferring the
  // capture past the slop means a tap is an ordinary click on the image,
  // and a drag still captures the moment it becomes one — which is what
  // keeps the pan alive when the pointer leaves the surface mid-throw.
  const capturedRef = useRef(false);

  const interactive = !revealing && !returning && !opened;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!interactive) return;
    draggingRef.current = true;
    capturedRef.current = false;
    movedRef.current = 0;
    lastRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current += Math.hypot(dx, dy);
    if (movedRef.current > CLICK_SLOP_PX) untouchedRef.current = false;
    if (!capturedRef.current && movedRef.current > CLICK_SLOP_PX) {
      capturedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Divided by the fit so the composition tracks the finger 1:1 on
    // screen: at 0.42 a screen pixel is 2.4 canvas px, and without this
    // the plane would crawl behind the pointer on a phone.
    panRef.current.x -= dx / fitRef.current;
    panRef.current.y -= dy / fitRef.current;
    write();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (capturedRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    capturedRef.current = false;
  };

  // ── EXPANDING A PIECE ───────────────────────────────────────────────
  //
  // The expanded card is laid out at its FINAL box and transformed back
  // onto the box the image occupied in the composition, then released to
  // identity — so the grow and the close are one transform transition on
  // one element and the card lands exactly on the image it came from,
  // whatever the pan and the fit happen to be.
  const openTarget = useMemo(() => {
    if (!opened) return null;
    const { piece } = opened;
    const s = Math.min((vw * 0.66) / piece.w, (vh * 0.7) / piece.h, 3.2);
    const w = piece.w * s;
    const h = piece.h * s;
    return { w, h, left: (vw - w) / 2, top: (vh - h) / 2 };
  }, [opened, vw, vh]);

  const openFrom = useMemo(() => {
    if (!opened || !openTarget) return null;
    const { from } = opened;
    return {
      dx: from.left + from.width / 2 - (openTarget.left + openTarget.w / 2),
      dy: from.top + from.height / 2 - (openTarget.top + openTarget.h / 2),
      s: openTarget.w > 0 ? from.width / openTarget.w : 1,
    };
  }, [opened, openTarget]);

  // Release the transform on the frame AFTER the one that mounted the card
  // at its origin box, so the browser has an old value to transition from.
  useEffect(() => {
    if (!opened) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpenT(1));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [opened]);

  const closeOpened = useCallback(() => {
    setFlipped(false);
    setOpenT(0);
  }, [setFlipped, setOpenT]);

  // Unmount only once the card has finished travelling back.
  const onCardTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName === "transform" && openT === 0) setOpened(null);
  };

  // Close on Escape, like any other overlay.
  useEffect(() => {
    if (!opened) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeOpened();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, closeOpened]);

  // The captured origin box is in screen coordinates, so a resize would
  // send the card back to a box that no longer exists.
  useEffect(() => {
    if (!opened) return;
    const onResize = () => closeOpened();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [opened, closeOpened]);

  // ── THE RETURN GESTURE ──────────────────────────────────────────────
  //
  // Armed only once the gallery has fully settled, and only while nothing
  // is expanded. Everything below intercepts the gesture BEFORE the page
  // can act on it, so the scroll container never tries to navigate or
  // reset on its own — there is nothing past the end of this track for it
  // to do anyway, but a trackpad/touch bounce or a browser "pull" gesture
  // at the scroll boundary is exactly what this pre-empts.
  const armed = p >= ARM_FROM && !opened;
  const armedRef = useRef(armed);
  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  const beginReturn = useCallback((amount: number) => {
    returningRef.current = true;
    returnTargetRef.current = clamp01(amount);
    setReturning(true);
  }, []);

  const cancelReturn = useCallback(() => {
    returningRef.current = false;
    returnTargetRef.current = 0;
    setReturning(false);
    setReturnT(0);
  }, []);

  const advance = useCallback(
    (delta: number) => {
      const next = clamp01(returnTargetRef.current + delta);
      returnTargetRef.current = next;
      if (next <= 0 && returnTRef.current <= 0.002) cancelReturn();
    },
    [cancelReturn]
  );

  useEffect(() => {
    // Non-passive and in the capture phase: preventDefault has to run
    // before the document scrolls, and before ScrollSmoother sees it.
    const opts: AddEventListenerOptions = { passive: false, capture: true };

    const wheelPx = (e: WheelEvent) =>
      e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;

    const onWheel = (e: WheelEvent) => {
      if (returningRef.current) {
        e.preventDefault();
        advance(wheelPx(e) / RETURN_WHEEL_PX);
        return;
      }
      if (!armedRef.current) return;
      const dy = wheelPx(e);
      if (dy <= 0) return; // upward scrolling is left alone
      e.preventDefault();
      beginReturn(dy / RETURN_WHEEL_PX);
    };

    // Touch: the composition owns one-finger gestures (that is the drag),
    // so the return is a two-finger vertical swipe — the same fingers a
    // trackpad scroll uses. Once the transition is running every touch is
    // swallowed, which is the lock.
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY =
        returningRef.current || (armedRef.current && e.touches.length >= 2)
          ? e.touches[0].clientY
          : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (returningRef.current) {
        e.preventDefault();
        if (touchY == null) touchY = e.touches[0].clientY;
        const dy = e.touches[0].clientY - touchY;
        touchY = e.touches[0].clientY;
        advance(-dy / RETURN_TOUCH_PX);
        return;
      }
      if (!armedRef.current || e.touches.length < 2 || touchY == null) return;
      const dy = e.touches[0].clientY - touchY;
      touchY = e.touches[0].clientY;
      if (dy >= 0) return; // fingers moving up = scrolling down
      e.preventDefault();
      beginReturn(-dy / RETURN_TOUCH_PX);
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    const DOWN = ["ArrowDown", "PageDown", "End", " ", "Spacebar"];
    const UP = ["ArrowUp", "PageUp", "Home"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (returningRef.current) {
        if (DOWN.includes(e.key)) {
          e.preventDefault();
          advance(RETURN_KEY_STEP);
        } else if (UP.includes(e.key)) {
          e.preventDefault();
          advance(-RETURN_KEY_STEP);
        }
        return;
      }
      if (!armedRef.current || !DOWN.includes(e.key)) return;
      e.preventDefault();
      beginReturn(RETURN_KEY_STEP);
    };

    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onTouchEnd, opts);
    window.addEventListener("keydown", onKeyDown, opts);
    return () => {
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("touchcancel", onTouchEnd, opts);
      window.removeEventListener("keydown", onKeyDown, opts);
    };
  }, [advance, beginReturn, vh]);

  // The rendered value eases toward what the gesture asked for. Without
  // this the camera advances in wheel-notch steps, which is exactly the
  // stepped feel the rest of the sequence goes to some trouble to avoid.
  useEffect(() => {
    if (!returning) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt / 0.075);
      setReturnT((prev) => {
        const target = returnTargetRef.current;
        const next = prev + (target - prev) * k;
        const settled = Math.abs(target - next) < 0.0008 ? target : next;
        returnTRef.current = settled;
        return settled;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [returning]);

  // While the transition runs the page must not move under it. The
  // handlers above already swallow every scroll gesture; pausing the
  // smoother as well means anything that gets past them (a scrollbar
  // drag, a programmatic scroll) cannot advance the sequence either.
  useEffect(() => {
    if (!returning) return;
    let smoother: { paused: (v?: boolean) => unknown } | null = null;
    let cancelled = false;
    import("gsap/ScrollSmoother")
      .then((m) => {
        if (cancelled) return;
        smoother = m.ScrollSmoother.get() ?? null;
        smoother?.paused(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      smoother?.paused(false);
    };
  }, [returning]);

  // ARRIVAL. The move has visually completed — ART is the hero's ART, at
  // the hero's size, in the hero's place — so the page's own scroll
  // position can now be reset underneath it without anything changing on
  // screen. Nothing is faded and nothing is duplicated: the same element
  // simply stops being this section's and starts being page one's.
  useEffect(() => {
    if (!returning || returnT < 0.999) return;
    let cancelled = false;
    import("gsap/ScrollSmoother")
      .then((m) => {
        if (cancelled) return;
        const s = m.ScrollSmoother.get();
        if (s) {
          s.paused(false);
          // scrollTop() jumps. scrollTo(0, true) would play the whole
          // sequence backwards over the smoother's 0.72s.
          s.scrollTop(0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        window.scrollTo(0, 0);
        // The state reset below is deferred one frame on purpose. The
        // page's own scroll-position tracking is also rAF-driven and reads
        // window.scrollY on this same frame, which drops this section's
        // progress below the threshold that mounts it at all — so by the
        // time the reset below would actually change what's on screen,
        // this component has already unmounted. Resetting immediately
        // instead raced that unmount: on the frame it lost, returnT
        // snapped to 0 (ART back to its small, un-dollied gallery size)
        // for one visible frame before the unmount caught up — the "minor
        // overlap" this avoids. Nothing about the camera move itself
        // changes; this only reorders when the already-arrived state gets
        // cleared relative to the unmount.
        requestAnimationFrame(() => {
          if (cancelled) return;
          returningRef.current = false;
          returnTargetRef.current = 0;
          setReturning(false);
          setReturnT(0);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [returning, returnT]);

  const hintOpacity =
    opened || returning ? 0 : span(revealT, 0.92, 1);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: visible ? "#000" : "transparent",
        opacity: visible ? 1 : 0,
        // Nothing here may take a pointer while the beat underneath it
        // still owns the frame.
        pointerEvents: visible ? undefined : "none",
      }}
    >
      {/* THE FIXED ROUNDED VIEWPORT. It clips, and that is all it does —
          it is never transformed, so the window is genuinely fixed and
          the composition genuinely moves inside it. */}
      <div
        data-canvas="viewport"
        style={{
          position: "absolute",
          inset: frameInset,
          borderRadius: frameRadius,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Everything inside is laid out in VIEWPORT coordinates, not in
            the window's, by pulling the inset back out. The rounded frame
            can then open and close without moving a single pixel of the
            composition or of ART. */}
        <div
          style={{
            position: "absolute",
            left: -frameInset,
            top: -frameInset,
            width: vw,
            height: vh,
          }}
        >
          {/* ART. On the WINDOW's layer, behind the work, at one screen
              position for the whole beat — the position page one's
              wordmark occupies. The images slide over it; it never moves
              with them. Not drawn while the camera is still hard in on
              the iris, where the card covers it completely. */}
          {revealScale < 2.6 && (
            <div
              aria-hidden
              data-canvas="art"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: artCentreY,
                transform: "translateY(-50%)",
                textAlign: "center",
                fontFamily: ART_FONT,
                fontWeight: 400,
                fontSize: artFontPx,
                lineHeight: 0.86,
                letterSpacing: "0.005em",
                color: "#fff",
                opacity: artOpacity * clamp01((2.6 - revealScale) / 0.9),
                // CONSTANT, and at the hero's own strength. Regenerating a
                // four-layer glow every frame on type this size is the
                // most expensive thing that could happen during the move,
                // and matching page one exactly is what lets the handover
                // at the end be a no-op rather than a cross-fade.
                textShadow: glowShadow(1.15 * GLOW_STRENGTH),
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              ART
            </div>
          )}

          {/* THE MOVING COMPOSITION. One plane; the drag translates it and
              nothing else. The scale is the viewport fit, the pull-back,
              and the return's dolly — all about the window's centre. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDragStart={(e) => e.preventDefault()}
            style={{
              position: "absolute",
              inset: 0,
              cursor: !interactive ? "default" : dragging ? "grabbing" : "grab",
              touchAction: "none",
              transform: `scale(${eff.toFixed(4)})`,
              transformOrigin: "50% 50%",
              willChange: "transform",
              pointerEvents: opened ? "none" : "auto",
            }}
          >
            <div
              ref={planeRef}
              data-canvas="plane"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                fontFamily: sans,
                willChange: "transform",
              }}
            >
              {rows.map((row) =>
                cols.map((col) => (
                  <div
                    key={`${row}:${col}`}
                    data-canvas="cell"
                    style={{
                      position: "absolute",
                      left: col * CELL_W,
                      top: row * CELL_H,
                      width: CELL_W,
                      height: CELL_H,
                    }}
                  >
                    {PIECES.map((piece) => {
                      const key = `${row}:${col}:${piece.id}`;
                      return (
                        <div
                          key={piece.id}
                          data-canvas="piece"
                          data-piece={piece.id}
                          onClick={(e) => {
                            // A drag, not a click.
                            if (movedRef.current > CLICK_SLOP_PX) return;
                            setOpened({
                              piece,
                              key,
                              from: e.currentTarget.getBoundingClientRect(),
                            });
                            setFlipped(false);
                            setOpenT(0);
                          }}
                          onMouseEnter={() => setHovered(key)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            position: "absolute",
                            left: piece.x,
                            top: piece.y,
                            width: piece.w,
                            height: piece.h,
                            cursor: "pointer",
                            // The expanded card IS this image, so the copy
                            // it grew out of must not sit under it.
                            visibility: opened?.key === key ? "hidden" : "visible",
                            // The beat before this one hands over a frame
                            // with ONE card on black. The pull-back starts
                            // close but not that close, so without this the
                            // neighbours are already in shot at the cut and
                            // pop in. They arrive with the move instead.
                            opacity:
                              piece.id === IRIS_PIECE_ID
                                ? 1
                                : span(revealT, 0.04, 0.42),
                          }}
                        >
                          {/* The same pointer-tilt-and-glare treatment
                              every other card on the site gets (see the
                              About Me photo card) — layered ON TOP of the
                              gallery's own lift-and-shadow hover, not in
                              place of it. Sized to fill the piece's own
                              box exactly: independent x/y/w/h per piece
                              means the aspect ratio has to be passed in
                              rather than assumed. */}
                          <HoverCard
                            style={{ width: "100%", height: "100%" }}
                            aspect={piece.w / piece.h}
                            radius={10}
                          >
                            <Placeholder
                              tone={piece.tone}
                              hovered={hovered === key}
                              label={piece.title}
                              labelOpacity={
                                piece.id === IRIS_PIECE_ID
                                  ? span(revealT, 0.35, 0.7)
                                  : 1
                              }
                            />
                          </HoverCard>
                          {piece.id === IRIS_PIECE_ID && irisFade > 0.001 && (
                            // The pupil the camera came out through. It is
                            // a disc ON the card, at the card's own centre,
                            // so pulling back shrinks it exactly as it
                            // shrinks everything else — the match cut holds
                            // because nothing about it is animated
                            // separately.
                            <div
                              aria-hidden
                              data-canvas="iris"
                              style={{
                                position: "absolute",
                                left: "50%",
                                top: "50%",
                                width: frame.irisPlane,
                                height: frame.irisPlane,
                                marginLeft: -frame.irisPlane / 2,
                                marginTop: -frame.irisPlane / 2,
                                borderRadius: "50%",
                                background: "#000",
                                boxShadow: `0 0 0 ${(1.2 / revealScale).toFixed(
                                  3
                                )}px rgba(255,255,255,${(0.42 * irisFade).toFixed(
                                  3
                                )}), 0 0 ${(18 / revealScale).toFixed(
                                  2
                                )}px rgba(255,255,255,${(0.2 * irisFade).toFixed(3)})`,
                                opacity: irisFade,
                                pointerEvents: "none",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hint, only while the composition is the thing to use. */}
      <div
        data-canvas="hint"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `calc(3vh + ${frameInset}px)`,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 300,
          fontSize: 13,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.46)",
          // The composition is dense enough that this lands on a card as
          // often as on black.
          textShadow: "0 1px 10px rgba(0,0,0,0.9)",
          opacity: hintOpacity,
          transition: "opacity 240ms ease",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        {armed ? "Drag to explore · Scroll down to return" : "Drag to explore"}
      </div>

      {/* AN EXPANDED PIECE.
          The gallery stays visible behind it — a light scrim, no blur —
          because the card is meant to read as one image lifted out of the
          composition rather than as a modal over a hidden page. */}
      {opened && openTarget && openFrom && (
        <>
          <div
            data-canvas="scrim"
            onClick={closeOpened}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 6,
              background: "rgba(0,0,0,0.42)",
              opacity: openT,
              transition: "opacity 520ms cubic-bezier(0.22,0.7,0.24,1)",
            }}
          />
          <div
            data-canvas="opened"
            onTransitionEnd={onCardTransitionEnd}
            style={{
              position: "absolute",
              left: openTarget.left,
              top: openTarget.top,
              width: openTarget.w,
              height: openTarget.h,
              zIndex: 7,
              perspective: "1600px",
              transformOrigin: "50% 50%",
              transform:
                openT === 1
                  ? "translate3d(0px, 0px, 0) scale(1)"
                  : `translate3d(${openFrom.dx.toFixed(2)}px, ${openFrom.dy.toFixed(
                      2
                    )}px, 0) scale(${openFrom.s.toFixed(4)})`,
              transition: "transform 560ms cubic-bezier(0.22,0.7,0.24,1)",
              willChange: "transform",
            }}
          >
            <div
              data-canvas="flipper"
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                transform: `rotateY(${flipped ? 180 : 0}deg)`,
                transition: "transform 700ms cubic-bezier(0.22,0.7,0.24,1)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                <Placeholder
                  tone={opened.piece.tone}
                  radius={16}
                  label={opened.piece.title}
                  labelSize={Math.round(
                    Math.max(14, Math.min(22, openTarget.w * 0.028))
                  )}
                />
              </div>
              <div
                data-canvas="back"
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: 16,
                  padding: "clamp(18px, 3vw, 42px)",
                  background:
                    "linear-gradient(150deg, #191a1e 0%, #111216 55%, #0a0b0d 100%)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontFamily: sans,
                  color: "rgba(255,255,255,0.72)",
                  fontWeight: 300,
                  fontSize: "clamp(12px, 1vw, 16px)",
                  lineHeight: 1.7,
                  letterSpacing: "0.04em",
                  overflow: "hidden",
                  // Bottom-anchored, so the title lands where the front's
                  // caption was and the turn reads as the same card rather
                  // than a different panel.
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                <p
                  style={{
                    color: "#fff",
                    fontWeight: 500,
                    fontSize: "clamp(16px, 1.6vw, 26px)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {opened.piece.title}
                </p>
                <p
                  style={{
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    fontSize: "clamp(10px, 0.8vw, 12px)",
                    color: "rgba(255,255,255,0.42)",
                  }}
                >
                  {opened.piece.meta}
                </p>
                <p style={{ marginTop: 14 }}>
                  Placeholder for the notes on this piece — brief, role, tools, year.
                </p>
              </div>
            </div>

            {/* The arrow, small and at the card's own top-right. Outside
                the flipper, so it stays put while the card turns over. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFlipped((v) => !v);
              }}
              aria-label={flipped ? "Show the piece" : "Show the details"}
              data-canvas="flip-arrow"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(12,13,16,0.55)",
                border: "1px solid rgba(255,255,255,0.24)",
                color: "#fff",
                cursor: "pointer",
                padding: 0,
                opacity: openT,
                transition: "opacity 320ms ease 180ms, background 200ms ease",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d={flipped ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
