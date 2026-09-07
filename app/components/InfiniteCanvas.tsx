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

  const fit = Math.min(1, Math.max(FIT_MIN, vw / FIT_REFERENCE_VW));
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // The flight home. Scroll drives it; the plane is untouched before it.
  const homeT = easeInCubic(span(p, HOME_FROM, 1));
  // ART is on the plane, so it flies with it — but faster, so the move
  // reads as going INTO the wordmark rather than the plane merely growing.
  const planeScale = 1 + homeT * 5;
  const artScale = 1 + homeT * 16;
  const veil = span(p, HOME_FROM + 0.16, 0.97);
  // The pan settles onto the ART FAST, in the first sixth of the flight,
  // while the zoom is still shallow — so the move reads as the camera
  // finding the wordmark and then diving into it. Tying the pan to the
  // zoom's own easing instead meant it was only ~70% of the way onto
  // target by the time the veil closed, and the dive landed on whatever
  // the reader had dragged to.
  const panHomeT = easeOutCubic(span(p, HOME_FROM, HOME_FROM + 0.05));
  const homeRef = useRef(panHomeT);
  homeRef.current = panHomeT;

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
    const h = homeRef.current;
    const wx = mod(panRef.current.x, CELL_W);
    const wy = mod(panRef.current.y, CELL_H);
    const tx = mod(CELL_W / 2 - vw / 2, CELL_W);
    const ty = mod(CELL_H / 2 - vh / 2, CELL_H);
    const ox = wx + ringDelta(wx, tx, CELL_W) * h;
    const oy = wy + ringDelta(wy, ty, CELL_H) * h;
    plane.style.transform = `translate3d(${(-ox).toFixed(2)}px, ${(-oy).toFixed(2)}px, 0)`;
  }, [vw, vh]);

  // Re-render the plane whenever the flight advances or the frame resizes,
  // not only when the pointer moves it.
  useEffect(() => {
    write();
  }, [write, panHomeT]);

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
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
          // The whole plane grows on the flight home, on top of the
          // viewport fit it always carries.
          transform: `scale(${(planeScale * fit).toFixed(4)})`,
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
          {[-1, 0, 1].map((row) =>
            [-1, 0, 1].map((col) => (
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
                {/* ART, on the plane and behind the work. */}
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
                    opacity: 0.13 + homeT * 0.8,
                    textShadow: glowShadow(0.45 + homeT * 0.55),
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  ART
                </div>

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
                    }}
                  >
                    <Placeholder hovered={hovered === `${row}:${col}:${piece.id}`} />
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
          opacity: (1 - span(p, HOME_FROM - 0.12, HOME_FROM)) * (opened ? 0 : 1),
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
