"use client";

// THE RECEPTION SCREEN, READ ONE PIECE AT A TIME, IN DEPTH.
//
// The interaction is adapted from Framer's Depth Carousel: the piece you
// are looking at sits closest, sharp and square-on, and its neighbours
// fall away INTO the screen — further back, smaller, turned slightly
// towards you and progressively out of focus. Every one of those is a
// continuous function of how far a piece is from the centre, not a state
// a piece is in, which is the whole difference between this and a
// coverflow: nothing snaps between "active" and "inactive" styling, and
// a piece halfway through a drag is halfway through all of it.
//
// RESTRAINT IS THE POINT. A coverflow turns its neighbours forty-five or
// sixty degrees and fans them like a card trick. These turn seventeen
// degrees per step and lose a fifth of their size, so the row reads as
// screens standing in a dark room at different distances rather than as
// an effect being performed. The depth does the work; the rotation only
// tells you which way the row runs.
//
// ONE POSITION DRIVES EVERYTHING. `pos` is a continuous coordinate in
// item space — 2.5 means exactly between the third and fourth piece — and
// the drag, the wheel and the keys all do nothing but move it. Layout is
// written straight to the DOM from a GSAP ticker rather than through
// React state, because this changes every frame while a hand is on it and
// re-rendering eight pieces per frame to move them is how a carousel
// starts dropping frames.
//
// A THROW IS AIMED, NOT TRUNCATED. Letting go does not snap to whatever
// is nearest right now: the release velocity is projected forward to see
// where the throw was HEADING, and that is the piece it settles on, under
// a damped spring. Flicking hard moves you further than nudging, which is
// what the hand expects and what makes the row feel weighted.

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { RECEPTION_PIECES, type ReceptionPiece } from "./receptionScreenAssets";

/** How far apart the pieces sit, as a share of one piece's width. Under 1,
 *  so the neighbours overlap the active one and the row reads as a stack
 *  in depth rather than a filmstrip. */
const STEP = 0.66;
/** Per step of distance, into the screen. */
const DEPTH = 300;
/** Per step of distance, in degrees. Deliberately small — see above. */
const ROT = 17;
const MAX_ROT = 36;
/** Per step: size falls off smoothly rather than linearly, so the first
 *  neighbour reads as clearly further away without the fourth vanishing. */
const SCALE_FALL = 0.2;
const FADE = 0.3;
const BLUR = 2.2;
const MAX_BLUR = 9;
/** Beyond this the piece is not worth compositing. */
const CULL = 4.2;

const clampTo = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));

type Slot = {
  el: HTMLDivElement;
  video: HTMLVideoElement | null;
  playing: boolean;
};

export default function ReceptionDepthCarousel() {
  const pieces = RECEPTION_PIECES;
  const n = pieces.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<(Slot | null)[]>([]);
  /** The continuous position, and its velocity in items per second. */
  const posRef = useRef(0);
  const velRef = useRef(0);
  /** Where a released throw is settling. Null while a hand is on it. */
  const snapRef = useRef<number | null>(0);
  const dragRef = useRef<{ x: number; pos0: number; last: number; t: number } | null>(null);
  const wheelIdle = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);


  // ── LAYOUT: one function of distance, applied to every piece ─────────
  const layout = useCallback(() => {
    const pos = posRef.current;
    const stage = stageRef.current;
    if (!stage) return;
    const w = stage.clientWidth;
    const itemW = stage.firstElementChild
      ? (stage.firstElementChild as HTMLElement).clientWidth
      : w;
    for (let i = 0; i < n; i++) {
      const slot = slotsRef.current[i];
      if (!slot) continue;
      const d = i - pos;
      const a = Math.abs(d);
      if (a > CULL) {
        if (slot.el.style.visibility !== "hidden") slot.el.style.visibility = "hidden";
        if (slot.playing && slot.video) {
          slot.video.pause();
          slot.playing = false;
        }
        continue;
      }
      if (slot.el.style.visibility) slot.el.style.visibility = "";
      const scale = 1 / (1 + SCALE_FALL * a);
      const rot = Math.max(-MAX_ROT, Math.min(MAX_ROT, -d * ROT));
      slot.el.style.transform =
        `translate3d(${(d * itemW * STEP).toFixed(2)}px, 0, ${(-a * DEPTH).toFixed(2)}px)` +
        ` rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      slot.el.style.opacity = Math.max(0, 1 - FADE * a).toFixed(3);
      slot.el.style.filter = a < 0.06 ? "none" : `blur(${Math.min(MAX_BLUR, BLUR * a).toFixed(2)}px)`;
      slot.el.style.zIndex = String(1000 - Math.round(a * 100));
      // ONLY WHAT IS BEING LOOKED AT RUNS. Eight simultaneous decodes to
      // show one piece is a way to make a carousel stutter on a laptop.
      if (slot.video) {
        const want = a < 0.75;
        if (want && !slot.playing) {
          slot.playing = true;
          slot.video.muted = true;
          void slot.video.play().catch(() => {});
        } else if (!want && slot.playing) {
          slot.playing = false;
          slot.video.pause();
        }
      }
    }
    const nearest = clampTo(Math.round(pos), n);
    if (nearest !== indexRef.current) {
      indexRef.current = nearest;
      setIndex(nearest);
    }
  }, [n]);

  // ── THE CLOCK ────────────────────────────────────────────────────────
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const dt = Math.min(0.032, gsap.ticker.deltaRatio() / 60);
      if (!dragRef.current) {
        const snap = snapRef.current;
        if (snap !== null) {
          const d = snap - posRef.current;
          if (reduced) {
            posRef.current = snap;
            velRef.current = 0;
          } else {
            // A damped spring, not an easing: it inherits the throw's own
            // speed instead of starting again from nothing.
            //
            // CRITICALLY DAMPED, deliberately. At the damping this started
            // with the row was well underdamped: it overshot its piece and
            // rang back through it, and a throw across several pieces took
            // roughly two seconds to stop moving. Matching the damping to
            // the stiffness (c = 2*sqrt(k)) means it arrives straight,
            // never crosses the piece it is landing on, and settles in
            // well under a second however far it was thrown.
            velRef.current += d * 130 * dt;
            velRef.current *= Math.exp(-23 * dt);
            posRef.current += velRef.current * dt;
            if (Math.abs(d) < 0.002 && Math.abs(velRef.current) < 0.03) {
              posRef.current = snap;
              velRef.current = 0;
            }
          }
        }
      }
      layout();
    };
    gsap.ticker.add(tick);
    layout();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
    };
  }, [layout]);

  // ── THE HAND ─────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // A native image drag cancels the pointer mid-gesture and takes the
    // carousel with it.
    e.preventDefault();
    snapRef.current = null;
    velRef.current = 0;
    dragRef.current = {
      x: e.clientX,
      pos0: posRef.current,
      last: posRef.current,
      t: performance.now(),
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const stage = stageRef.current;
    const itemW = stage?.firstElementChild
      ? (stage.firstElementChild as HTMLElement).clientWidth
      : 600;
    let next = d.pos0 - (e.clientX - d.x) / (itemW * STEP);
    // Rubber band at the ends: it gives, but it gives less the further
    // you pull, so the row always tells you it has run out.
    if (next < 0) next = next * 0.32;
    else if (next > n - 1) next = n - 1 + (next - (n - 1)) * 0.32;
    const now = performance.now();
    const dtms = Math.max(1, now - d.t);
    velRef.current = ((next - d.last) / dtms) * 1000;
    d.last = next;
    d.t = now;
    posRef.current = next;
  };

  const release = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // WHERE THE THROW WAS HEADING, not where it happens to be. Projecting
    // the release velocity forward is what lets a hard flick cross more
    // than one piece while a nudge settles back.
    const projected = posRef.current + velRef.current * 0.2;
    snapRef.current = clampTo(Math.round(projected), n);
  }, [n]);

  // ── THE WHEEL ────────────────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      // A trackpad's horizontal swipe and a mouse's vertical wheel are the
      // same intent here; whichever axis is being pushed harder wins.
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!raw) return;
      e.preventDefault();
      snapRef.current = null;
      velRef.current = 0;
      posRef.current = Math.min(n - 1, Math.max(0, posRef.current + raw / 420));
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
      // The wheel has no "let go", so the settle is on it going quiet.
      wheelIdle.current = window.setTimeout(() => {
        snapRef.current = clampTo(Math.round(posRef.current), n);
      }, 110);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
    };
  }, [n]);

  const go = useCallback((to: number) => {
    snapRef.current = clampTo(to, n);
  }, [n]);

  useEffect(() => {
    // A STEP COUNTS FROM WHERE THE ROW IS GOING, not from where it is.
    // Reading the live position means a second press during the spring
    // re-aims from a piece the row has already half left, so holding the
    // key down moved one or two places and then stopped making progress.
    const from = () => snapRef.current ?? Math.round(posRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(from() - 1);
      else if (e.key === "ArrowRight") go(from() + 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(n - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, n]);

  return (
    <div className="dc-root">
      <div
        ref={stageRef}
        className="dc-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onDragStart={(e) => e.preventDefault()}
      >
        {pieces.map((piece, i) => (
          <div
            key={piece.id}
            className="dc-item"
            ref={(el) => {
              slotsRef.current[i] = el
                ? { el, video: el.querySelector("video"), playing: false }
                : null;
            }}
          >
            <div className="dc-frame">
              {piece.kind === "video" ? (
                <video
                  src={piece.src}
                  poster={piece.poster}
                  width={piece.w}
                  height={piece.h}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  draggable={false}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={piece.src}
                  alt=""
                  width={piece.w}
                  height={piece.h}
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="dc-meter" aria-live="polite">
        <span className="dc-now">{String(index + 1).padStart(2, "0")}</span>
        <span className="dc-rule" aria-hidden />
        <span className="dc-all">{String(n).padStart(2, "0")}</span>
      </div>

      <style>{`
        /* ONE MEASURE DRIVES THE WHOLE STAGE. The piece's width is set
           first, from whichever of the viewport's two axes runs out
           first, and the stage's height is then derived from it at 16:9.
           Sizing the two independently is how the active piece ended up
           taller than the box holding it and got its head and feet
           clipped off. */
        .dc-root {
          display: flex; flex-direction: column;
          gap: clamp(18px, 3vh, 34px);
          --dc-w: min(62vw, 54vh * 16 / 9, 820px);
          /* The row runs out past the page's gutter, so the pieces behind
             carry on to the edges of the screen instead of stopping at a
             margin. Exactly the shell's own padding, so it reaches the
             shell's border box and no further — nothing overflows. */
          margin-inline: calc(-1 * clamp(18px, 6vw, 96px));
        }
        .dc-stage {
          position: relative;
          width: 100%;
          height: calc(var(--dc-w) * 9 / 16);
          perspective: 1700px;
          perspective-origin: 50% 50%;
          transform-style: preserve-3d;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          cursor: grab;
          overflow: hidden;
        }
        .dc-stage:active { cursor: grabbing; }
        /* Centred by the box model, not by a negative margin. The margin
           this replaces was min() over three negative lengths, which picks
           the MOST negative rather than half the width, so the row sat off
           to one side at every size but one. */
        .dc-item {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          margin-inline: auto;
          width: var(--dc-w);
          height: 100%;
          transform-style: preserve-3d;
          will-change: transform, opacity, filter;
        }
        .dc-frame {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 4px;
          background: #0a0a0b;
          box-shadow: 0 40px 110px rgba(0,0,0,0.74);
        }
        .dc-frame img, .dc-frame video {
          width: 100%; height: 100%; object-fit: cover; display: block;
          pointer-events: none;
        }
        .dc-meter {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          font-size: 11px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.4);
        }
        .dc-now { color: rgba(255,255,255,0.9); }
        .dc-rule { width: 28px; height: 1px; background: rgba(255,255,255,0.22); }
        @media (max-width: 760px) {
          /* A phone has no room to show neighbours either side, so the
             piece takes the width instead and the depth carries alone. */
          .dc-root { --dc-w: min(86vw, 46vh * 16 / 9); }
        }
      `}</style>
    </div>
  );
}

export type { ReceptionPiece };
