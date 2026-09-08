"use client";

// The infinite canvas, and the way home.
//
// A plane you drag. ART sits on that plane behind the work, so panning
// moves the wordmark too and the canvas reads as one surface rather than
// cards floating over a fixed backdrop.
//
// "Infinite" is a real wrap, not a very large plane: the cards live in one
// CELL, and a 3x3 block of that cell is drawn around wherever the pan
// currently is. The pan offset is taken modulo the cell before it is
// applied, so the plane can be dragged forever in any direction and the
// content is always there — no edges, no bounds, and only nine cells'
// worth of DOM however far the reader travels.
//
// Clicking a card opens it. The opened card has a back: the arrow flips it
// 180 degrees on Y, which is why the two faces are separate elements in a
// preserve-3d parent rather than one element whose contents get swapped.
//
// The last stretch of the section's scroll flies into the ART on the
// plane, and at the top of that move the page returns to the hero — the
// loop the sequence closes on.

import { useCallback, useEffect, useRef, useState } from "react";
import { ART_FONT, glowShadow } from "./HeroSection";
import { BULB_GLASS_RATIO, bulbSizePx } from "./CordSection";

// One repeating cell of the plane, in canvas px.
const CELL_W = 1720;
const CELL_H = 1180;

// The work on the plane, positioned within one cell. Mixed ratios, the
// same neutral placeholder language as every other section.
type Piece = { id: string; x: number; y: number; w: number; ratio: number };
const PIECES: Piece[] = [
  { id: "c1", x: 90, y: 90, w: 380, ratio: 16 / 9 },
  { id: "c2", x: 560, y: 60, w: 250, ratio: 9 / 16 },
  { id: "c3", x: 900, y: 150, w: 330, ratio: 1 },
  { id: "c4", x: 1320, y: 80, w: 300, ratio: 4 / 5 },
  { id: "c5", x: 150, y: 620, w: 300, ratio: 1 },
  { id: "c6", x: 540, y: 700, w: 380, ratio: 16 / 9 },
  { id: "c7", x: 1010, y: 640, w: 250, ratio: 9 / 16 },
  { id: "c8", x: 1350, y: 760, w: 320, ratio: 3 / 2 },
];

// THE piece the iris sits on: the black disc the previous beat leaves the
// frame on is the pupil painted on this card, and the zoom out starts
// hard against it. PencilSection draws its last frame from the same
// numbers, so the swap between the two is geometry, not a cross-fade.
const IRIS_PIECE_ID = "c6";
/** The iris's diameter as a share of its card's height. */
const IRIS_RATIO = 0.78;
/** How much of the reveal the camera spends pulling back. */
const REVEAL_END = 0.2;

// Where the flight home begins, as a share of the section's progress.
const HOME_FROM = 0.72;
// The plane is at rest until then, so the reader has the whole first
// stretch to drag around in.
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
// A drag shorter than this is a click, not a pan.
const CLICK_SLOP_PX = 5;

// The plane is laid out in fixed canvas px, so without this a 380px piece
// and a 400px ART sat on a 320px phone larger than the screen — one card
// visible and no sense of a canvas at all. The whole plane is scaled to
// the viewport instead of reflowing it, so the composition of the cell is
// identical everywhere and only its size changes.
const FIT_REFERENCE_VW = 1440;
const FIT_MIN = 0.42;

/** The viewport fit the plane always carries. */
export function galleryFit(vw: number) {
  return Math.min(1, Math.max(FIT_MIN, vw / FIT_REFERENCE_VW));
}

/**
 * The frame the zoom out starts from, in screen px: the iris card scaled
 * until it overfills the viewport, with the iris centred in it.
 *
 * The scale is solved rather than picked so that at the start of the move
 * the card covers the frame on BOTH axes — otherwise the pull-back opens
 * on the card's edge and the cut from the previous beat is visible.
 */
export function irisFrame(vw: number, vh: number) {
  const piece = PIECES.find((x) => x.id === IRIS_PIECE_ID)!;
  const fit = galleryFit(vw);
  const cardW = piece.w * fit;
  const cardH = (piece.w / piece.ratio) * fit;
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
    irisPlane: (piece.w / piece.ratio) * IRIS_RATIO,
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

function Placeholder({
  radius = 12,
  hovered = false,
}: {
  radius?: number;
  hovered?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: radius,
        background: "linear-gradient(150deg, #212328 0%, #16171c 55%, #0d0e11 100%)",
        border: `1px solid rgba(255,255,255,${hovered ? 0.24 : 0.12})`,
        // A lift and a brighter glow, not the pointer tilt the other cards
        // get: a tilt tracking the pointer would fight the pan happening
        // under the same gesture.
        boxShadow: hovered
          ? "0 0 46px rgba(255,255,255,0.2), 0 22px 60px rgba(0,0,0,0.75)"
          : "0 0 34px rgba(255,255,255,0.09), 0 18px 50px rgba(0,0,0,0.7)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition:
          "transform 300ms cubic-bezier(0.22,0.7,0.24,1), box-shadow 300ms ease, border-color 300ms ease",
      }}
    />
  );
}

export default function InfiniteCanvas({
  progress,
  sans,
  vw,
  vh,
}: {
  progress: number;
  sans: string;
  vw: number;
  vh: number;
}) {
  const p = clamp01(progress);
  const planeRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [opened, setOpened] = useState<Piece | null>(null);
  // Keyed by cell AND piece: the same piece is drawn nine times, so keying
  // on its id alone lit every copy at once.
  const [hovered, setHovered] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const fit = galleryFit(vw);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // THE ZOOM OUT.
  //
  // The previous beat hands over a frame that is one thing: the iris,
  // hard against the lens, on the card it is painted on. Nothing in the
  // gallery moves for this — the camera pulls back, so the whole plane
  // (cards, ART and all) scales down together about the frame's centre
  // and the rest of the work arrives from outside the frame because it
  // was always there.
  const frame = irisFrame(vw, vh);
  const revealT = easeOutCubic(span(p, 0, REVEAL_END));
  // Geometric, not linear: a linear pull-back from 5x reads as the cards
  // rushing away and then crawling. Interpolating the LOG of the scale
  // makes each moment of the move cover the same proportion of distance,
  // which is what a real dolly looks like.
  const revealScale = Math.exp(Math.log(frame.scale) * (1 - revealT));
  const revealing = revealT < 0.999;
  // The iris fades out as the camera gets back: once its card is one of
  // several on screen it should read as a piece of work, not as the
  // thing we came through. Full while we are still inside it, gone by
  // the time the gallery is at rest.
  const irisFade = span(revealScale, 1.0, 1.85);

  // The flight home. Scroll drives it; the plane is untouched before it.
  const homeT = easeInCubic(span(p, HOME_FROM, 1));
  // ART is on the plane, so it flies with it — but faster, so the move
  // reads as going INTO the wordmark rather than the plane merely growing.
  const planeScale = 1 + homeT * 5;
  const artScale = 1 + homeT * 16;
  const veil = span(p, HOME_FROM + 0.16, 0.97);

  // HOW MANY CELLS TO DRAW.
  //
  // A fixed 3x3 block was nine copies of everything at every moment of
  // the beat, including the flight home where the plane is scaled six
  // times and one cell covers the frame several times over. The visible
  // slice of the plane is vw/eff by vh/eff, and the wrapped offset is
  // somewhere inside one cell, so the block only ever has to span that
  // slice plus the cell it starts in.
  const eff = planeScale * revealScale * fit;
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

  // The pan settles onto the ART FAST, in the first sixth of the flight,
  // while the zoom is still shallow — so the move reads as the camera
  // finding the wordmark and then diving into it. Tying the pan to the
  // zoom's own easing instead meant it was only ~70% of the way onto
  // target by the time the veil closed, and the dive landed on whatever
  // the reader had dragged to.
  const panHomeT = easeOutCubic(span(p, HOME_FROM, HOME_FROM + 0.05));
  const homeRef = useRef(panHomeT);
  homeRef.current = panHomeT;
  // The plane offset the pull-back is centred on: the iris card's middle
  // at the middle of the frame.
  //
  // NOT wrapped to the cell. The pull-back draws the centre cell only, so
  // the offset has to be the one that puts THAT copy of the card under the
  // lens; taking it modulo the cell can name the copy one cell over, which
  // is off screen — on a 1920 frame it put the iris 9,700px to the left.
  // Wrapping resumes when the reveal ends and the full block is drawn
  // again, and the two offsets are the same position by then.
  const irisX = frame.piece.x + frame.piece.w / 2 - vw / 2;
  const irisY = frame.piece.y + frame.piece.w / frame.piece.ratio / 2 - vh / 2;

  // Writing the transform from a ref keeps a drag off React's render path;
  // at 8 cells of content a state update per pointermove is visible.
  // The flight has to land on the ART, not on whatever the reader happened
  // to drag to. The wrapper scales about the viewport centre, so a plane
  // point P sits at the centre exactly when the plane's translate is
  // (C - P); with the ART at the middle of its cell that gives one target
  // offset, and the rendered offset eases onto it as the flight runs —
  // taking the short way round the wrap so it never unwinds a whole cell.
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
    const tx = mod(CELL_W / 2 - vw / 2, CELL_W);
    const ty = mod(CELL_H / 2 - vh / 2, CELL_H);
    const ox = wx + ringDelta(wx, tx, CELL_W) * h;
    const oy = wy + ringDelta(wy, ty, CELL_H) * h;
    plane.style.transform = `translate3d(${(-ox).toFixed(2)}px, ${(-oy).toFixed(2)}px, 0)`;
  }, [vw, vh, revealing, irisX, irisY]);

  // Re-render the plane whenever the flight advances or the frame resizes,
  // not only when the pointer moves it.
  useEffect(() => {
    write();
  }, [write, panHomeT, revealScale]);

  // Hand the pan over at the value the reveal left it on, so the first
  // drag after the gallery arrives does not snap the plane back to 0,0.
  useEffect(() => {
    if (!revealing) return;
    panRef.current = { x: irisX, y: irisY };
  }, [revealing, irisX, irisY]);

  // Pointer capture is taken only once the gesture is actually a drag.
  //
  // Capturing on pointerdown looks harmless but silently breaks opening a
  // card: while a pointer is captured the browser retargets the resulting
  // `click` to the capturing element, so the click landed on the pan
  // surface and never reached the piece under the finger. Deferring the
  // capture past the slop means a tap is an ordinary click on the card,
  // and a drag still captures the moment it becomes one — which is what
  // keeps the pan alive when the pointer leaves the surface mid-throw.
  const capturedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Nothing is draggable while the camera is still pulling back.
    if (revealing) return;
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
    if (!capturedRef.current && movedRef.current > CLICK_SLOP_PX) {
      capturedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Divided by the fit so the plane tracks the finger 1:1 on screen:
    // at 0.42 a screen pixel is 2.4 canvas px, and without this the plane
    // would crawl behind the pointer on a phone.
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

  // Close on Escape, like any other overlay.
  useEffect(() => {
    if (!opened) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpened(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened]);

  // Reset the flip whenever a different piece is opened, so a card never
  // opens already showing its back.
  useEffect(() => {
    setFlipped(false);
  }, [opened]);

  // The loop. Once the flight has arrived, the page goes back to the hero.
  // Armed only on the way DOWN and re-armed only after leaving the end, so
  // scrolling back up out of the canvas does not trigger it.
  const armedRef = useRef(true);
  useEffect(() => {
    if (p < 0.9) {
      armedRef.current = true;
      return;
    }
    if (p >= 0.995 && armedRef.current) {
      armedRef.current = false;
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [p]);

  const openW = Math.min(vw * 0.72, vh * 0.72 * (16 / 9));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}
        style={{
          position: "absolute",
          inset: 0,
          cursor: revealing ? "default" : dragging ? "grabbing" : "grab",
          touchAction: "none",
          // The whole plane grows on the flight home, on top of the
          // viewport fit it always carries.
          transform: `scale(${(planeScale * revealScale * fit).toFixed(4)})`,
          transformOrigin: "50% 50%",
          willChange: "transform",
        }}
      >
        {/* The plane. Offset by the pan, wrapped to one cell. */}
        <div
          ref={planeRef}
          data-canvas="plane"
          style={{ position: "absolute", left: 0, top: 0, willChange: "transform" }}
        >
          {/* Nine cells, so whatever the wrapped offset is the viewport is
              covered on every side. */}
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
                {/* ART, on the plane and behind the work. Not drawn at
                    all while the camera is hard in on the iris: the card
                    covers it, and a 400px face scaled five times is a
                    large raster for something nobody can see. */}
                {revealScale < 2.6 && (
                <div
                  aria-hidden
                  data-canvas="art"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    textAlign: "center",
                    transform: `translateY(-50%) scale(${(artScale / planeScale).toFixed(3)})`,
                    fontFamily: ART_FONT,
                    fontWeight: 400,
                    fontSize: 400,
                    lineHeight: 0.86,
                    letterSpacing: "0.005em",
                    color: "#fff",
                    opacity:
                      (0.13 + homeT * 0.8) * clamp01((2.6 - revealScale) / 0.9),
                    // CONSTANT. The flight home scales this face to
                    // several thousand pixels, and a four-layer glow that
                    // changes every frame means re-rendering type that
                    // size with four blurs, once per cell, per frame.
                    textShadow: glowShadow(1),
                    willChange: "opacity, transform",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  ART
                </div>
                )}

                {PIECES.map((piece) => (
                  <div
                    key={piece.id}
                    data-canvas="piece"
                    onClick={() => {
                      if (movedRef.current <= CLICK_SLOP_PX) setOpened(piece);
                    }}
                    onMouseEnter={() => setHovered(`${row}:${col}:${piece.id}`)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      position: "absolute",
                      left: piece.x,
                      top: piece.y,
                      width: piece.w,
                      height: piece.w / piece.ratio,
                      cursor: "pointer",
                      // The beat before this one hands over a frame with
                      // ONE card on black. The pull-back starts close but
                      // not that close, so without this the neighbours
                      // are already in shot at the cut and pop in. They
                      // arrive with the move instead.
                      opacity:
                        piece.id === IRIS_PIECE_ID ? 1 : span(revealT, 0.04, 0.42),
                    }}
                  >
                    <Placeholder hovered={hovered === `${row}:${col}:${piece.id}`} />
                    {piece.id === IRIS_PIECE_ID && irisFade > 0.001 && (
                      // The pupil the camera came out through. It is a
                      // disc ON the card, at the card's own centre, so
                      // pulling back shrinks it exactly as it shrinks
                      // everything else — the match cut holds because
                      // nothing about it is animated separately.
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
                          boxShadow: `0 0 0 ${(1.2 / revealScale).toFixed(3)}px rgba(255,255,255,${(
                            0.42 * irisFade
                          ).toFixed(3)}), 0 0 ${(18 / revealScale).toFixed(
                            2
                          )}px rgba(255,255,255,${(0.2 * irisFade).toFixed(3)})`,
                          opacity: irisFade,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Hint, only while the plane is the thing to use. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "5vh",
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 300,
          fontSize: 13,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          opacity:
            (1 - span(p, HOME_FROM - 0.12, HOME_FROM)) *
            (opened ? 0 : 1) *
            span(revealT, 0.9, 1),
          transition: "opacity 240ms ease",
          pointerEvents: "none",
        }}
      >
        Drag to explore
      </div>

      {/* The flight's veil: the frame goes to black at the top of the move
          so the return to the hero is a cut, not a jump. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: veil,
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* An opened piece. Two faces in a preserve-3d parent, so the arrow
          turns the card over rather than swapping its contents. */}
      {opened && (
        <div
          onClick={() => setOpened(null)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: openW,
              aspectRatio: String(opened.ratio),
              maxHeight: "76vh",
              perspective: "1600px",
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
                transition: "transform 640ms cubic-bezier(0.22,0.7,0.24,1)",
              }}
            >
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
                <Placeholder radius={16} />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: 16,
                  padding: "clamp(20px, 3vw, 42px)",
                  background:
                    "linear-gradient(150deg, #191a1e 0%, #111216 55%, #0a0b0d 100%)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: sans,
                  color: "rgba(255,255,255,0.62)",
                  fontWeight: 300,
                  fontSize: "clamp(13px, 1vw, 16px)",
                  lineHeight: 1.7,
                  letterSpacing: "0.04em",
                }}
              >
                <p style={{ color: "#fff", fontWeight: 500, letterSpacing: "0.02em" }}>
                  Piece details
                </p>
                <p style={{ marginTop: 12 }}>
                  Placeholder for the notes on this piece — brief, role, tools, year.
                </p>
              </div>
            </div>
          </div>

          {/* The arrow. Turns the card over. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped((v) => !v);
            }}
            aria-label={flipped ? "Show the front" : "Show the back"}
            style={{
              position: "absolute",
              right: "6vw",
              top: "50%",
              transform: "translateY(-50%)",
              width: 52,
              height: 52,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d={flipped ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
