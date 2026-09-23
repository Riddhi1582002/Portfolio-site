"use client";

// AI COMICS — project 08.
//
// THE LANDING IS ONE WALL. Every supplied piece — the nine long strips and
// the two pages — stands on a single curved wall that runs side to side
// and never ends: the set repeats, so the reader can travel either way for
// as long as they like. No sections, no categories, no grid. Each piece
// keeps its own proportion; a strip is a strip, a page is a page, and the
// difference in shape is the composition.
//
// THE WALL IS CONCAVE — the reader stands inside it, the way a screen in a
// cinema curves round the seats. A piece at the middle is square to the
// lens; towards either edge the wall comes a little closer and turns to
// face the centre. Subtle on purpose: depth, not a fish-eye.
//
// ONE MOTION. The wall's position is a single number, and every input
// moves it: a slow drift when left alone, a drag that holds it exactly
// under the finger and carries its speed on release, the wheel adding
// speed. Momentum decays; after a pause the drift eases back in. The
// items are placed by writing transforms straight to the DOM from GSAP's
// ticker, never through React state per frame.
//
// OPENING A PIECE. A page opens whole, at its own proportion, with the
// next step beside it: page one leads to page two ("NEXT PAGE"), page two
// on to the next piece on the wall ("NEXT COMIC ART"). A strip opens at
// its native width with its TOP at the top of the screen and is read by
// scrolling down it — it is never shrunk to fit. NEXT PROJECT is always
// there, and goes on to project 09 on the graphic-design ring.
//
// GSAP only.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import ProjectRail from "./ProjectRail";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import {
  AI_COMICS_CONTENT,
  COMICS,
  PAGE_ONE,
  PAGE_TWO,
} from "./aiComicsAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const N = COMICS.length;

// THE WALL'S COMPOSITION, as shares of the wall's own height, so it is
// the same picture at every size. Strips stand nearly the full height;
// pages are smaller, which is what lets a strip read as long.
// Strips are TALLER than the wall — the reference's scale — so each runs
// past the frame's top and bottom, at a different height from its
// neighbours; pages stand whole beside them. Nothing is cropped: the frame
// is a window onto the wall, and opening a strip shows all of it.
const STRIP_H = 2.2;
const PAGE_H = 0.82;
/** The gap between pieces, in gap units — the same between every pair,
 *  so the wall reads as one even run and only its depth varies. */
const GAP_UNITS = 1.4;
/** Each piece's vertical offset from centre, of the wall height. */
// Strips are shifted up or down so different stretches of each are in the
// frame, but never so far that one ends inside it: every strip runs through
// the whole frame, top to bottom, the way the reference wall does.
const OFFSETS = [0.14, -0.28, 0.24, -0.1, -0.04, 0.05, 0.28, -0.2, 0.08, -0.3, 0.18];
/** The wall's own tilt — a plane seen at an angle, not a flat row. */
const TILT = "rotateX(9deg) rotateZ(-5deg) scale(1.1)";
/** How far the wall falls AWAY from the reader towards its ends, 0 = flat.
 *  A convex arc: the centre is nearest and largest, and the pieces to
 *  either side recede into depth and turn away with the surface, so the
 *  whole wall reads as one plane going back towards a vanishing point. */
const RECEDE = 2.5;
/** How far forward the piece at the centre stands, px. */
const NEAR = 60;
/** How much of the surface's own turn each piece takes. All of it: each
 *  piece lies flat on the arc, so the gap between neighbours is the same
 *  all the way along — a piece turning less than the surface closed its
 *  gaps towards the ends and opened them in the middle. */
const TURN = 1;
/** The lens: short enough for the depth to read as perspective, never so
 *  short that the nearest piece distorts. */
const lens = (w: number) => Math.max(950, w * 0.82);
/** The drift when nothing is touching it, px/s. */
const DRIFT = 26;
/** How long after the last input the drift comes back, ms. */
const IDLE_MS = 1600;
const MAX_V = 3600;

const pad = (n: number) => String(n).padStart(2, "0");

/** A piece's two shade layers, looked up once and kept on the element. */
const shadeCache = new WeakMap<HTMLElement, [HTMLElement | null, HTMLElement | null]>();
function shadesOf(el: HTMLElement): [HTMLElement | null, HTMLElement | null] {
  let s = shadeCache.get(el);
  if (!s) {
    s = [el.querySelector<HTMLElement>(".ac-shade-l"), el.querySelector<HTMLElement>(".ac-shade-r")];
    shadeCache.set(el, s);
  }
  return s;
}

type Placed = { i: number; key: string; base: number; w: number; h: number; y: number };

export default function AiComicsView() {
  const [open, setOpen] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const wallRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // One number is the wall's position (the world x at the screen's
  // centre); one is its speed.
  const motion = useRef({
    s: 0,
    v: DRIFT,
    drag: false,
    lastInput: -1e9,
    suppressClick: false,
  });
  const down = useRef<{
    x: number;
    s0: number;
    lastX: number;
    lastT: number;
    vel: number;
    moved: boolean;
    id: number;
  } | null>(null);

  useEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── LAYOUT: one set, repeated until the loop can never show its seam.
  const layout = useMemo(() => {
    const H = box.h;
    if (!H || !box.w) return null;
    const gap = Math.max(18, H * 0.028);
    const one: Omit<Placed, "key">[] = [];
    let x = 0;
    COMICS.forEach((c, i) => {
      const h = (c.strip ? STRIP_H : PAGE_H) * H;
      const w = (h * c.w) / c.h;
      one.push({ i, base: x + w / 2, w, h, y: (H - h) / 2 + OFFSETS[i] * H });
      x += w + gap * GAP_UNITS;
    });
    const L1 = x;
    const copies = Math.max(2, Math.ceil((box.w * 2) / L1) + 1);
    const items: Placed[] = [];
    for (let c = 0; c < copies; c++) {
      for (const o of one) items.push({ ...o, key: `${c}-${o.i}`, base: o.base + c * L1 });
    }
    return { items, L: L1 * copies, L1 };
  }, [box.w, box.h]);

  // ── THE TICKER: integrate, then place.
  useEffect(() => {
    if (!layout) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = box.w;
    // A wide arc, so no piece turns further than about thirty degrees
    // before it has left the frame, and neighbours never slide over each
    // other as the surface turns faster than they do.
    const R = Math.max(W * 1.4, 900);
    const { items, L } = layout;
    const place = () => {
      const m = motion.current;
      for (let k = 0; k < items.length; k++) {
        const el = itemRefs.current[k];
        if (!el) continue;
        const it = items[k];
        let x = (((it.base - m.s) % L) + L) % L;
        if (x > L / 2) x -= L;
        // The ends recede and shrink, so more of the wall fits the frame
        // than its flat width: culled with room to spare.
        if (Math.abs(x) > W * 0.85 + it.w / 2 + 80) {
          if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
          continue;
        }
        if (el.style.visibility !== "visible") el.style.visibility = "visible";
        const th = x / R;
        const X = R * Math.sin(th);
        const Z = NEAR - R * (1 - Math.cos(th)) * RECEDE;
        const n = Math.min(1, Math.abs(x) / (W / 2));
        el.style.transform = `translate3d(${(X - it.w / 2).toFixed(2)}px, ${it.y.toFixed(2)}px, ${Z.toFixed(2)}px) rotateY(${((th * 180) / Math.PI) * TURN}deg)`;
        // DEPTH BY SHADOW, NOT BY FADING. Every piece is at full strength;
        // a receding piece is instead shaded along the edge that sits
        // behind its nearer neighbour (the side facing the centre), more
        // the further back it lies. Opacity of a fixed gradient layer, so
        // the drift repaints nothing.
        const shade = (0.12 + 0.5 * n).toFixed(3);
        const [shL, shR] = shadesOf(el);
        if (shL && shR) {
          shL.style.opacity = x > 0 ? shade : "0";
          shR.style.opacity = x < 0 ? shade : "0";
        }
      }
    };
    const tick = () => {
      const m = motion.current;
      const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60);
      if (!m.drag) {
        const idle = performance.now() - m.lastInput > IDLE_MS;
        const target = idle && !reduce ? DRIFT : 0;
        // Momentum decays quickly; the drift returns slowly, so a fling
        // lands and settles before the wall starts moving on its own.
        m.v += (target - m.v) * (1 - Math.exp(-dt * (idle ? 0.8 : 2.4)));
        m.s += m.v * dt;
      }
      place();
    };
    place();
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [layout, box.w]);

  // ── INPUT ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      const m = motion.current;
      m.v = Math.max(-MAX_V, Math.min(MAX_V, m.v + d * 8));
      m.lastInput = performance.now();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const m = motion.current;
    m.v = 0;
    m.lastInput = performance.now();
    // A drag's own click lands on the wall (which holds the capture), not
    // on a piece, so the flag can outlive it; a new press starts clean.
    m.suppressClick = false;
    down.current = {
      x: e.clientX,
      s0: m.s,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
      moved: false,
      id: e.pointerId,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d) return;
    const m = motion.current;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      m.drag = true;
      // Captured only once it IS a drag: capture on press retargets the
      // click that follows a tap, and a piece could never be opened.
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the drag ends at the wall's edge.
      }
    }
    if (!d.moved) return;
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const inst = ((e.clientX - d.lastX) / dt) * 1000;
      d.vel = d.vel * 0.6 + inst * 0.4;
      d.lastX = e.clientX;
      d.lastT = now;
    }
    m.s = d.s0 - dx;
    m.lastInput = now;
  };
  const release = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const m = motion.current;
    m.lastInput = performance.now();
    if (!d.moved) return;
    m.drag = false;
    m.suppressClick = true;
    // A stale sample (the finger stopped before lifting) carries nothing.
    const fresh = performance.now() - d.lastT < 80;
    m.v = fresh ? Math.max(-MAX_V, Math.min(MAX_V, -d.vel)) : 0;
    try {
      (e.currentTarget as Element).releasePointerCapture(d.id);
    } catch {
      // Released with the pointer itself.
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openRef.current != null) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const m = motion.current;
      m.v = Math.max(-MAX_V, Math.min(MAX_V, m.v + (e.key === "ArrowRight" ? 700 : -700)));
      m.lastInput = performance.now();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── THE VIEWER ──────────────────────────────────────────────────────
  const fromRect = useRef<DOMRect | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const m = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const openAt = (i: number, el: Element | null) => {
    if (openRef.current != null) return;
    fromRect.current = el ? el.getBoundingClientRect() : null;
    setOpen(i);
  };

  // Nothing behind the viewer scrolls while it is up.
  useEffect(() => {
    if (open == null) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  // Arrival: from the piece on the wall, or — moving between pieces —
  // a short cross-fade.
  useLayoutEffect(() => {
    if (open == null) return;
    const view = viewRef.current;
    const img = imgRef.current;
    const content = contentRef.current;
    if (!view || !img || !content) return;
    const from = fromRect.current;
    fromRect.current = null;
    if (from) {
      const to = img.getBoundingClientRect();
      gsap.set(view, { opacity: 1 });
      gsap.fromTo(
        view,
        { backgroundColor: "rgba(0,0,0,0)" },
        { backgroundColor: "rgba(0,0,0,1)", duration: 0.5, ease: "power2.out" }
      );
      gsap.fromTo(
        img,
        {
          x: from.left - to.left,
          y: from.top - to.top,
          scaleX: from.width / to.width,
          scaleY: from.height / to.height,
          transformOrigin: "0 0",
        },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: "power3.inOut" }
      );
      gsap.fromTo(
        view.querySelectorAll(".ac-fade"),
        { opacity: 0 },
        { opacity: 1, duration: 0.4, delay: 0.5, ease: "power1.out" }
      );
    } else {
      gsap.fromTo(content, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
    }
  }, [open]);

  const close = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      setOpen(null);
      return;
    }
    motion.current.lastInput = performance.now();
    gsap.to(view, {
      opacity: 0,
      duration: 0.36,
      ease: "power2.in",
      onComplete: () => setOpen(null),
    });
  }, []);

  const goTo = useCallback((j: number) => {
    const content = contentRef.current;
    if (!content) {
      setOpen(j);
      return;
    }
    gsap.to(content, {
      opacity: 0,
      y: -10,
      duration: 0.24,
      ease: "power1.in",
      onComplete: () => setOpen(j),
    });
  }, []);

  const current = open != null ? COMICS[open] : null;
  const nextStep = useMemo(
    () =>
      open == null
        ? null
        : COMICS[open].id === PAGE_ONE
          ? { label: "Next page", to: COMICS.findIndex((c) => c.id === PAGE_TWO) }
          : // Every other piece — page two and every strip — goes on to the
            // next comic in this project, round to the first after the
            // last. The viewer never leaves the project.
            { label: "Next comic", to: (open + 1) % N },
    [open]
  );

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && nextStep) goTo(nextStep.to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, nextStep, close, goTo]);

  // Sizes. A strip: its native width, or the screen's if that is less —
  // never shrunk to fit its height. A page: whole, as large as the screen
  // allows under the bar and above its one action.
  const BAR = 56;
  const stripW = Math.min(800, vp.w || 800);
  const pageAvailH = Math.max(160, vp.h - BAR - 96);
  const pageW = current && !current.strip
    ? Math.min(
        vp.w - 32,
        (pageAvailH * current.w) / current.h,
        current.w
      )
    : 0;
  const pageH = current && !current.strip ? (pageW * current.h) / current.w : 0;

  return (
    <div className="ac-outer" style={{ fontFamily: SANS }}>
      {/* The header sits at the same top-left place as every project's,
          over the wall rather than beside it: the wall is the page. */}
      <ProjectRail
        variant="overlay"
        number={GD_PROJECTS.comics.number}
        title={AI_COMICS_CONTENT.title}
        description={AI_COMICS_CONTENT.description}
        backHref={gdBackHref(GD_PROJECTS.comics)}
        gd={GD_PROJECTS.comics}
      >
        <div className="ac-hint">Drag or scroll the wall · click a piece to open it</div>
      </ProjectRail>

      <div className="ac-main">

      <div
        ref={wallRef}
        className="ac-wall"
        data-ac-wall
        data-cursor="drag"
        style={{ perspective: `${lens(box.w)}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="ac-plane" style={{ transform: TILT }}>
        {layout?.items.map((it, k) => {
          const c = COMICS[it.i];
          return (
            <button
              key={it.key}
              type="button"
              className="ac-item"
              data-cursor="view"
              data-ac-i={it.i}
              data-ac-copy={it.key}
              tabIndex={it.key.startsWith("0-") ? 0 : -1}
              aria-label={c.strip ? `Comic strip ${it.i + 1} of ${N}` : `Comic page ${it.i + 1} of ${N}`}
              ref={(el) => {
                itemRefs.current[k] = el;
              }}
              style={{ width: it.w, height: it.h, visibility: "hidden" }}
              onClick={(e) => {
                const m = motion.current;
                if (m.suppressClick) {
                  m.suppressClick = false;
                  return;
                }
                openAt(it.i, e.currentTarget);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.wall} alt="" draggable={false} decoding="async" />
              <span className="ac-shade ac-shade-l" aria-hidden />
              <span className="ac-shade ac-shade-r" aria-hidden />
            </button>
          );
        })}
        </div>
      </div>
      </div>

      {current && open != null && (
        <div
          ref={viewRef}
          className="ac-view"
          role="dialog"
          aria-modal="true"
          aria-label={`${AI_COMICS_CONTENT.title} ${open + 1} of ${N}`}
          data-ac-view={current.strip ? "strip" : "page"}
          data-ac-open={current.id}
        >
          <div className="ac-bar ac-fade" style={{ height: BAR }}>
            <button type="button" className="ac-ctl" onClick={close}>
              <span aria-hidden>←</span>
              <span>
                Back<span className="ac-long"> to the wall</span>
              </span>
            </button>
            <span className="ac-count">
              {pad(open + 1)} / {pad(N)}
            </span>
            {nextStep && (
              <button
                type="button"
                className="ac-ctl ac-next-project"
                data-ac-bar-next=""
                onClick={() => goTo(nextStep.to)}
              >
                {nextStep.label} <span aria-hidden>→</span>
              </button>
            )}
          </div>

          <div ref={contentRef} key={current.id} className="ac-content">
            {current.strip ? (
              <div className="ac-scroll" data-ac-scroll style={{ paddingTop: BAR + 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={current.full}
                  alt={`Comic strip ${open + 1} of ${N}`}
                  width={current.w}
                  height={current.h}
                  className="ac-strip"
                  style={{
                    width: stripW,
                    height: (stripW * current.h) / current.w,
                    backgroundImage: `url("${current.wall}")`,
                  }}
                />
                {nextStep && (
                  <div className="ac-end ac-fade">
                    <button
                      type="button"
                      className="ac-ctl ac-pill"
                      data-ac-next=""
                      onClick={() => goTo(nextStep.to)}
                    >
                      {nextStep.label} <span aria-hidden>→</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="ac-pagewrap" style={{ paddingTop: BAR }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={current.full}
                  alt={`Comic page ${open + 1} of ${N}`}
                  width={current.w}
                  height={current.h}
                  className="ac-page"
                  style={{ width: pageW, height: pageH, backgroundImage: `url("${current.wall}")` }}
                />
                {nextStep && (
                  <button
                    type="button"
                    className="ac-ctl ac-pill ac-fade"
                    data-ac-next
                    onClick={() => goTo(nextStep.to)}
                  >
                    {nextStep.label} <span aria-hidden>→</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .ac-outer {
          position: relative; width: 100%; height: 100svh; min-height: 360px;
          background: #000; color: #fff; overflow: hidden;
        }
        /* THE WALL IS THE PAGE: edge to edge, top to bottom, with the
           project header laid over its top-left corner. */
        .ac-main { position: absolute; inset: 0; display: flex; flex-direction: column; }
        /* The header reads against the dark that the wall's own edges fall
           into, not against a panel. */
        .ac-outer .pr-overlay {
          background: linear-gradient(to right, rgba(0,0,0,0.88), rgba(0,0,0,0.55) 70%, rgba(0,0,0,0));
          padding-right: clamp(40px, 6vw, 90px);
          height: auto;
        }
        .ac-hint {
          font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.4); line-height: 1.6;
        }
        .ac-plane {
          position: absolute; inset: 0; transform-style: preserve-3d;
          transform-origin: 50% 50%;
        }
        @media (max-width: 900px) {
          .ac-outer .pr-overlay { right: 0; padding-right: clamp(20px, 2.2vw, 36px); }
        }
        .ac-wall {
          position: relative; flex: 1 1 auto; min-height: 200px;
          perspective-origin: 50% 50%;
          overflow: hidden; touch-action: pan-y; cursor: grab;
          user-select: none; -webkit-user-select: none;
        }
        .ac-wall:active { cursor: grabbing; }
        /* The tall strips run past the frame's top and bottom; they go into
           the dark there rather than being cut by the frame. The sides are
           NOT faded: the pieces at the ends are shaded by depth instead. */
        .ac-wall::after {
          content: ""; position: absolute; inset: 0;
          z-index: 2; pointer-events: none;
          background: linear-gradient(to bottom, #000, rgba(0,0,0,0) 9%, rgba(0,0,0,0) 91%, #000);
        }
        .ac-item {
          position: absolute; left: 50%; top: 0; padding: 0; border: 0;
          background: #0b0b0c; border-radius: 10px; overflow: hidden; cursor: zoom-in;
          will-change: transform; backface-visibility: hidden;
          /* A soft shadow thrown to both sides: on the arc every piece
             stands in front of its outer neighbour, so it falls across
             the piece behind it. */
          box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 30px 70px -30px rgba(0,0,0,0.95),
                      0 0 46px 6px rgba(0,0,0,0.55);
        }
        .ac-shade {
          position: absolute; top: 0; bottom: 0; width: 55%; pointer-events: none;
          opacity: 0; will-change: opacity;
        }
        .ac-shade-l { left: 0; background: linear-gradient(to right, rgba(0,0,0,0.92), rgba(0,0,0,0.35) 45%, rgba(0,0,0,0)); }
        .ac-shade-r { right: 0; background: linear-gradient(to left, rgba(0,0,0,0.92), rgba(0,0,0,0.35) 45%, rgba(0,0,0,0)); }
        .ac-item img {
          display: block; width: 100%; height: 100%; max-width: none;
          pointer-events: none; transition: filter .4s ease;
        }
        @media (hover: hover) { .ac-item:hover img { filter: brightness(1.12); } }
        .ac-item:focus-visible { outline: 1px solid rgba(255,255,255,0.7); outline-offset: 3px; }

        .ac-view {
          position: fixed; inset: 0; z-index: 200; background: #000;
        }
        .ac-bar {
          position: absolute; left: 0; right: 0; top: 0; z-index: 3;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 0 clamp(16px, 4vw, 56px);
          background: linear-gradient(to bottom, rgba(0,0,0,0.92), rgba(0,0,0,0.78));
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ac-ctl {
          display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
          background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit;
          font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.8); text-decoration: none;
        }
        .ac-ctl:hover { color: #fff; }
        .ac-count { font-size: 11px; letter-spacing: 0.18em; color: rgba(255,255,255,0.4); }
        .ac-content { position: absolute; inset: 0; }
        .ac-scroll {
          position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden;
          overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; align-items: center;
        }
        .ac-strip, .ac-page {
          display: block; max-width: none; flex: 0 0 auto;
          background-size: 100% 100%; background-repeat: no-repeat;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
        }
        .ac-end { padding: 40px 16px 64px; }
        .ac-pill {
          border: 1px solid rgba(255,255,255,0.3); padding: 12px 18px; border-radius: 2px;
        }
        .ac-pill:hover { border-color: rgba(255,255,255,0.7); }
        .ac-pagewrap {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 24px; padding-bottom: 16px;
        }
        @media (max-width: 520px) {
          .ac-long { display: none; }
          .ac-count { display: none; }
        }
      `}</style>
    </div>
  );
}
