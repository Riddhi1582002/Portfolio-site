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
// where the throw was HEADING, and that is the piece it settles on.
//
// ONE AIM, ONE SPRING. Every input — a throw, an arrow, a wheel notch, a
// click on a card — only moves `aim`, the place the row is going. The
// row itself is never moved by an input; it chases the aim from wherever
// it actually is, carrying whatever speed it already has, so a second
// arrow press halfway through a move simply lengthens that move instead
// of restarting it, and nothing ever jumps. The chase is the EXACT
// solution of a critically damped spring, stepped in closed form so it
// is the same at 30fps as at 144, and its velocity towards the aim is
// capped at the one speed that can never carry it past — so the settle
// is guaranteed never to cross the card and ring back.

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

/** The spring's natural frequency. Critically damped at this, a one-card
 *  move reads as settled in about four tenths of a second. */
const OMEGA = 10.5;
/** A ceiling on how fast the row may travel, in cards per second. A
 *  spring's speed grows with the distance it is asked to cover, so four
 *  quick arrow presses had the row peaking near fifteen cards a second —
 *  a smear, not a move. Capped, a long move is a steady glide that the
 *  spring then settles; a short one never reaches the cap at all. */
const MAX_SPEED = 7;
/** Wheel travel per item, and how far past the aim a wheel gesture has
 *  to have pushed before letting go of it counts as a step. */
const WHEEL_PER_ITEM = 380;
const WHEEL_COMMIT = 0.15;

/**
 * Start a video silently. `muted` is set as a PROPERTY here on purpose:
 * React does not render the `muted` attribute into server HTML, so in this
 * static export the attribute is absent from the page as delivered, and
 * a browser only allows an unprompted play() on a video it can see is
 * muted.
 */
function playNow(v: HTMLVideoElement) {
  v.muted = true;
  v.defaultMuted = true;
  void v.play().catch(() => {
    // Refused (no source yet, a failed candidate being skipped, a data
    // saver): onCanPlay retries once there is something to play.
  });
}

type Slot = {
  el: HTMLDivElement;
  video: HTMLVideoElement | null;
  /** What we last asked of the video — kept apart from what it is DOING,
   *  since a play() can be refused or still be waiting on its source. */
  wantPlay: boolean;
};

export default function ReceptionDepthCarousel() {
  const pieces = RECEPTION_PIECES;
  const n = pieces.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<(Slot | null)[]>([]);
  /** The continuous position, and its velocity in items per second. */
  const posRef = useRef(0);
  const velRef = useRef(0);
  /** Where the row is going. Null only while a hand is holding it. */
  const aimRef = useRef<number | null>(0);
  const dragRef = useRef<{
    x: number;
    pos0: number;
    last: number;
    t: number;
    moved: number;
    card: number | null;
  } | null>(null);
  const wheelIdle = useRef<number | null>(null);
  /** Where the current wheel gesture began, so letting go of it can round
   *  in the direction it was pushed rather than to the nearest card. */
  const wheelBase = useRef<number | null>(null);
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
        if (slot.wantPlay && slot.video) {
          slot.video.pause();
          slot.wantPlay = false;
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
      // Continuous all the way to the centre. Switching from a small blur
      // to none at a threshold was a visible click as a card arrived.
      slot.el.style.filter =
        a < 0.001 ? "none" : `blur(${Math.min(MAX_BLUR, BLUR * a).toFixed(3)}px)`;
      slot.el.style.zIndex = String(1000 - Math.round(a * 100));
      // ONLY WHAT IS BEING LOOKED AT RUNS. Eight simultaneous decodes to
      // show one piece is a way to make a carousel stutter on a laptop.
      if (slot.video) {
        const want = a < 0.75;
        if (want && !slot.wantPlay) {
          slot.wantPlay = true;
          playNow(slot.video);
        } else if (!want && slot.wantPlay) {
          slot.wantPlay = false;
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
      const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
      const aim = aimRef.current;
      if (!dragRef.current && aim !== null) {
        if (reduced) {
          posRef.current = aim;
          velRef.current = 0;
        } else {
          const x = posRef.current - aim;
          let v = velRef.current;
          // NEVER FAST ENOUGH TO CROSS. A critically damped spring only
          // passes its target if it is already moving towards it faster
          // than OMEGA times the distance left; capping the approach speed
          // there is what makes "no visible oscillation" a property of the
          // maths rather than of the tuning.
          if (v * x < 0 && Math.abs(v) > OMEGA * Math.abs(x)) {
            v = -Math.sign(x) * OMEGA * Math.abs(x);
          }
          if (Math.abs(v) > MAX_SPEED) v = Math.sign(v) * MAX_SPEED;
          const e = Math.exp(-OMEGA * dt);
          const c = v + OMEGA * x;
          const nx = (x + c * dt) * e;
          const nv = (v - OMEGA * c * dt) * e;
          if (Math.abs(nx) < 0.0006 && Math.abs(nv) < 0.01) {
            posRef.current = aim;
            velRef.current = 0;
          } else {
            // The closed-form step can still ask for more than the ceiling
            // over a long frame; hold the travel to it, and let the spring
            // take over again once it is inside its own speed.
            const maxStepLen = MAX_SPEED * dt;
            const step = Math.max(-maxStepLen, Math.min(maxStepLen, nx - x));
            posRef.current = aim + x + step;
            velRef.current = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, nv));
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
    const cardEl = (e.target as Element).closest("[data-dc-i]");
    // Taking hold of the row keeps its speed until the hand actually moves
    // it: a tap on a card mid-flight should not first slam the row to a
    // stop and then start it again.
    dragRef.current = {
      x: e.clientX,
      pos0: posRef.current,
      last: posRef.current,
      t: performance.now(),
      moved: 0,
      card: cardEl ? Number(cardEl.getAttribute("data-dc-i")) : null,
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
    d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x));
    // Below a few pixels this is still a tap, and the row stays under the
    // spring rather than under the hand.
    if (d.moved < 5) return;
    aimRef.current = null;
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
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.moved < 5) {
      // A TAP CHOOSES THAT CARD — the exact one under the finger — and
      // the row travels to it from wherever it is.
      if (d.card !== null) aimRef.current = clampTo(d.card, n);
      else if (aimRef.current === null) aimRef.current = clampTo(Math.round(posRef.current), n);
      return;
    }
    // WHERE THE THROW WAS HEADING, not where it happens to be. Projecting
    // the release velocity forward is what lets a hard flick cross more
    // than one piece while a nudge settles back.
    const projected = posRef.current + velRef.current * 0.2;
    aimRef.current = clampTo(Math.round(projected), n);
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
      // THE WHEEL MOVES THE AIM, NOT THE ROW. Writing the position
      // directly made every notch of a mouse wheel a visible jump of a
      // quarter card; moving the aim instead lets the spring carry the row
      // there, so a wheel reads as continuous as a drag.
      const start = aimRef.current ?? posRef.current;
      if (wheelBase.current === null) wheelBase.current = Math.round(start);
      aimRef.current = Math.min(n - 1, Math.max(0, start + raw / WHEEL_PER_ITEM));
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
      // The wheel has no "let go", so the settle is on it going quiet —
      // and it rounds the way it was pushed, so a single notch is a step
      // rather than a nudge that falls back to where it began.
      wheelIdle.current = window.setTimeout(() => {
        const aim = aimRef.current ?? posRef.current;
        const base = wheelBase.current ?? Math.round(aim);
        wheelBase.current = null;
        const to =
          aim > base ? Math.ceil(aim - WHEEL_COMMIT) : Math.floor(aim + WHEEL_COMMIT);
        aimRef.current = clampTo(to, n);
      }, 110);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
    };
  }, [n]);

  const go = useCallback((to: number) => {
    aimRef.current = clampTo(to, n);
  }, [n]);

  useEffect(() => {
    // A STEP COUNTS FROM WHERE THE ROW IS GOING, not from where it is.
    // Reading the live position means a second press during the spring
    // re-aims from a piece the row has already half left, so holding the
    // key down moved one or two places and then stopped making progress.
    const from = () => Math.round(aimRef.current ?? posRef.current);
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
            data-dc-i={i}
            ref={(el) => {
              // Re-run on every render. It used to rebuild the slot each
              // time, which reset what had been asked of the video — so a
              // card that left the centre after the meter re-rendered was
              // never paused. The same element keeps the same slot.
              const prev = slotsRef.current[i];
              if (!el) {
                slotsRef.current[i] = null;
              } else if (!prev || prev.el !== el) {
                slotsRef.current[i] = { el, video: el.querySelector("video"), wantPlay: false };
              }
            }}
          >
            <div className="dc-frame">
              {piece.kind === "video" ? (
                <video
                  // One URL for a local file; for an R2 piece, every key it
                  // may be stored under — see r2Candidates. The browser
                  // tries each <source> in order and moves past one that
                  // fails, which is native resource selection, not a
                  // second video system.
                  src={piece.sources ? undefined : piece.src}
                  poster={piece.poster}
                  width={piece.w}
                  height={piece.h}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  draggable={false}
                  onCanPlay={(e) => {
                    // A play() asked for before the source had arrived —
                    // or refused while a failed <source> was being passed
                    // over — is not retried by the browser. It is here,
                    // the moment there is something to play, if the card
                    // is still the one being looked at.
                    const slot = slotsRef.current[i];
                    if (slot?.wantPlay && e.currentTarget.paused) playNow(e.currentTarget);
                  }}
                >
                  {piece.sources?.map((src) => (
                    <source key={src} src={src} type="video/mp4" />
                  ))}
                </video>
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
          --dc-w: min(67vw, 59vh * 16 / 9, 900px);
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
          .dc-root { --dc-w: min(90vw, 50vh * 16 / 9); }
        }
      `}</style>
    </div>
  );
}

export type { ReceptionPiece };
