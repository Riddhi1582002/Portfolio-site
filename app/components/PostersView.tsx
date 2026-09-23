"use client";

// THE POSTERS PROJECT PAGE.
//
// One collection, two ways of looking at it, and the same poster is the
// hinge between them.
//
// 01 — THE CAROUSEL. One poster at a time, the rest of the run receding
// behind it: the one being looked at is closest, largest and sharp, and
// every other poster is smaller, further back, dimmer and softer by
// exactly how far it is from the centre. Every one of those is a
// continuous function of distance — nothing switches between an "active"
// and an "inactive" style — and there is no rotation at all, which is
// what keeps this from being a coverflow: the posters face you like
// prints on a wall seen down its length, not cards being fanned.
//
// 02 — THE OVERVIEW. Every poster at once, as a composed wall rather than
// a grid: rows of three sizes, set to different lines within each row,
// each row its own height and its own indent, so the eye is led across
// the range of the work instead of scanning cells. It is laid out by
// rule, not by hand, so it keeps its composition at any width — six to a
// row on a desktop, four on a tablet, two on a phone.
//
// BETWEEN THEM, THE POSTER TRAVELS. Leaving the carousel, the poster at
// its centre flies to its own place on the wall while the rest of the
// wall arrives around it; picking a poster on the wall flies that exact
// poster to the centre of the carousel. A flying copy does the travelling
// from the measured rectangle of one to the measured rectangle of the
// other, and because every poster is 4:5 in both views, nothing is ever
// stretched on the way.
//
// Every image is a supplied poster, whole and uncropped. Nothing is
// captioned with its words: they are handwritten into the artwork.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import ProjectRail from "./ProjectRail";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import { POSTERS, POSTERS_CONTENT } from "./postersAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const N = POSTERS.length;

// ── THE CAROUSEL'S GEOMETRY ───────────────────────────────────────────
/** Size falls off smoothly with distance; the first neighbour reads as
 *  clearly behind, the fourth is still a poster rather than a speck. */
const SCALE_FALL = 0.24;
const DEPTH = 220;
const FADE = 0.2;
const BLUR = 1.8;
const MAX_BLUR = 8;
const DIM = 0.1;
/** Beyond this nothing is worth compositing — it has faded out already. */
const CULL = 4.8;
/**
 * WHERE A POSTER SITS, in poster widths from the centre. Not linear: the
 * first neighbour stands well clear of the centre so the active poster
 * is never crowded, and each one further out tucks in a little closer,
 * the way prints hung down a long wall appear to close up with distance.
 * Smooth all the way through, so nothing kinks as a poster passes a
 * whole-number position.
 */
const spread = (a: number) => 0.46 * a + 0.18 * (1 - Math.exp(-2.2 * a));

// ── THE MOTION ─────────────────────────────────────────────────────────
// The same model the reception carousel settled on, for the same reasons:
// every input moves only the AIM, the row chases it from wherever it is
// under an exact critically damped step, its approach speed is capped at
// the one value that can never carry it past its target, and a ceiling
// keeps a long move a glide.
const OMEGA = 10.5;
const MAX_SPEED = 7;
const WHEEL_PER_ITEM = 380;
const WHEEL_COMMIT = 0.15;
const clampI = (v: number) => Math.min(N - 1, Math.max(0, v));

// ── THE WALL ───────────────────────────────────────────────────────────
// Three sizes and where each poster sits within its row's height, as two
// fixed sequences the whole collection is dealt through in order. Fixed
// rather than random so the wall is the same composition on every visit.
const SIZES = [1, 0.74, 0.56, 1, 0.56, 0.74, 0.74, 1, 0.56, 0.74, 1, 0.56, 0.56, 0.74, 1, 0.56, 0.74, 1];
const ALIGN = [0, 0.25, 0.9, 0, 0.35, 1, 1, 0, 0.15, 0.6, 0, 0.95, 0.45, 1, 0, 0.9, 0.1, 0];
/** Each row's left and right indent, cycled, so the rows do not all start
 *  and stop on the same two lines. */
const INSETS: [number, number][] = [[0, 3], [4, 0], [1.5, 1.5], [0, 4], [3, 0], [2, 2]];

type Slot = { x: number; y: number; w: number; h: number };

/**
 * Lay the wall out in units where the wall is 100 wide. Each row is sized
 * so its posters and gaps exactly fill the row's own width after its
 * indents; a short final row is not allowed to grow past the rows above
 * it, and is centred instead of stretched.
 */
function buildWall(perRow: number, gap: number): { slots: Slot[]; height: number } {
  const slots: Slot[] = [];
  let top = 0;
  let maxH = Infinity;
  for (let start = 0, row = 0; start < N; start += perRow, row++) {
    const idx = Array.from({ length: Math.min(perRow, N - start) }, (_, k) => start + k);
    let [l, r] = INSETS[row % INSETS.length];
    const sumF = idx.reduce((s, i) => s + SIZES[i % SIZES.length], 0);
    let H = (100 - l - r - gap * (idx.length - 1)) / (0.8 * sumF);
    if (idx.length === perRow) maxH = Math.min(maxH, H * 1.08);
    if (H > maxH) {
      H = maxH;
      const used = 0.8 * H * sumF + gap * (idx.length - 1);
      l = r = (100 - used) / 2;
    }
    let x = l;
    for (const i of idx) {
      const h = H * SIZES[i % SIZES.length];
      const w = 0.8 * h;
      slots[i] = { x, y: top + ALIGN[i % ALIGN.length] * (H - h), w, h };
      x += w + gap;
    }
    top += H + gap * 1.3;
  }
  return { slots, height: top - gap * 1.3 };
}

type Mode = "carousel" | "overview";

export default function PostersView() {
  const [mode, setMode] = useState<Mode>("carousel");
  const modeRef = useRef<Mode>("carousel");
  const [index, setIndex] = useState(0);
  const [perRow, setPerRow] = useState(6);
  /** The poster opened large, if any. */
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const enlargedRef = useRef<number | null>(null);
  useEffect(() => {
    enlargedRef.current = enlarged;
  }, [enlarged]);
  const bigRef = useRef<HTMLDivElement>(null);
  const bigImgRef = useRef<HTMLImageElement>(null);

  const carRef = useRef<HTMLDivElement>(null);
  const ovRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const busy = useRef(false);

  const posRef = useRef(0);
  const velRef = useRef(0);
  const aimRef = useRef<number | null>(0);
  const indexRef = useRef(0);
  const dragRef = useRef<{
    x: number; pos0: number; last: number; t: number; moved: number; card: number | null;
  } | null>(null);
  const wheelIdle = useRef<number | null>(null);
  const wheelBase = useRef<number | null>(null);

  // ── THE WALL FOR THIS WIDTH ──────────────────────────────────────────
  useEffect(() => {
    const read = () => {
      const w = window.innerWidth;
      setPerRow(w >= 1100 ? 6 : w >= 700 ? 4 : 2);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  // The gap is a share of the wall's width, so it is set per layout to
  // stay above sixteen pixels at the narrowest width that layout serves.
  const gap = perRow === 6 ? 2 : perRow === 4 ? 3 : 6.5;
  const wall = buildWall(perRow, gap);

  // ── CAROUSEL LAYOUT: one function of distance, applied to every poster
  const layout = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const first = itemRefs.current[0];
    const pw = first ? first.clientWidth : 300;
    const pos = posRef.current;
    for (let i = 0; i < N; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const d = i - pos;
      const a = Math.abs(d);
      if (a > CULL) {
        if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
        continue;
      }
      if (el.style.visibility === "hidden") el.style.visibility = "";
      const scale = 1 / (1 + SCALE_FALL * a);
      el.style.transform =
        `translate3d(${(Math.sign(d) * spread(a) * pw).toFixed(2)}px, 0, ${(-a * DEPTH).toFixed(2)}px)` +
        ` scale(${scale.toFixed(4)})`;
      el.style.opacity = Math.max(0, 1 - FADE * a).toFixed(3);
      el.style.filter =
        a < 0.001
          ? "none"
          : `blur(${Math.min(MAX_BLUR, BLUR * a).toFixed(3)}px) brightness(${Math.max(0.55, 1 - DIM * a).toFixed(3)})`;
      el.style.zIndex = String(1000 - Math.round(a * 100));
    }
    const nearest = clampI(Math.round(pos));
    if (nearest !== indexRef.current) {
      indexRef.current = nearest;
      setIndex(nearest);
    }
  }, []);

  // ── THE CLOCK ────────────────────────────────────────────────────────
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      if (modeRef.current !== "carousel" && !busy.current) return;
      const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
      const aim = aimRef.current;
      if (!dragRef.current && aim !== null) {
        if (reduced) {
          posRef.current = aim;
          velRef.current = 0;
        } else {
          const x = posRef.current - aim;
          let v = velRef.current;
          if (v * x < 0 && Math.abs(v) > OMEGA * Math.abs(x)) v = -Math.sign(x) * OMEGA * Math.abs(x);
          if (Math.abs(v) > MAX_SPEED) v = Math.sign(v) * MAX_SPEED;
          const e = Math.exp(-OMEGA * dt);
          const c = v + OMEGA * x;
          const nx = (x + c * dt) * e;
          const nv = (v - OMEGA * c * dt) * e;
          if (Math.abs(nx) < 0.0006 && Math.abs(nv) < 0.01) {
            posRef.current = aim;
            velRef.current = 0;
          } else {
            const lim = MAX_SPEED * dt;
            posRef.current = aim + x + Math.max(-lim, Math.min(lim, nx - x));
            velRef.current = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, nv));
          }
        }
      }
      layout();
    };
    gsap.ticker.add(tick);
    layout();
    window.addEventListener("resize", layout);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", layout);
    };
  }, [layout]);

  // ── THE HAND ─────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || busy.current) return;
    e.preventDefault();
    const card = (e.target as Element).closest("[data-pc-i]");
    dragRef.current = {
      x: e.clientX,
      pos0: posRef.current,
      last: posRef.current,
      t: performance.now(),
      moved: 0,
      card: card ? Number(card.getAttribute("data-pc-i")) : null,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x));
    if (d.moved < 5) return;
    aimRef.current = null;
    const pw = itemRefs.current[0]?.clientWidth ?? 300;
    // Dragged at the pace of the first step out, so a poster follows the
    // finger across roughly its own width.
    let next = d.pos0 - (e.clientX - d.x) / (pw * spread(1));
    if (next < 0) next *= 0.32;
    else if (next > N - 1) next = N - 1 + (next - (N - 1)) * 0.32;
    const now = performance.now();
    velRef.current = ((next - d.last) / Math.max(1, now - d.t)) * 1000;
    d.last = next;
    d.t = now;
    posRef.current = next;
  };
  const release = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.moved < 5) {
      // A tap brings that exact poster to the front, from wherever the row
      // is, and opens it large.
      if (d.card !== null) {
        aimRef.current = clampI(d.card);
        setEnlarged(clampI(d.card));
      } else if (aimRef.current === null) aimRef.current = clampI(Math.round(posRef.current));
      return;
    }
    aimRef.current = clampI(Math.round(posRef.current + velRef.current * 0.2));
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (modeRef.current !== "carousel") return;
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!raw) return;
      e.preventDefault();
      const start = aimRef.current ?? posRef.current;
      if (wheelBase.current === null) wheelBase.current = Math.round(start);
      aimRef.current = Math.min(N - 1, Math.max(0, start + raw / WHEEL_PER_ITEM));
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
      wheelIdle.current = window.setTimeout(() => {
        const aim = aimRef.current ?? posRef.current;
        const base = wheelBase.current ?? Math.round(aim);
        wheelBase.current = null;
        aimRef.current = clampI(
          aim > base ? Math.ceil(aim - WHEEL_COMMIT) : Math.floor(aim + WHEEL_COMMIT)
        );
      }, 110);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      if (wheelIdle.current) window.clearTimeout(wheelIdle.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modeRef.current !== "carousel" || busy.current || enlargedRef.current !== null) return;
      const from = Math.round(aimRef.current ?? posRef.current);
      if (e.key === "ArrowLeft") aimRef.current = clampI(from - 1);
      else if (e.key === "ArrowRight") aimRef.current = clampI(from + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── ONE POSTER, LARGE ────────────────────────────────────────────────
  // Arrows either side step through the collection; the carousel behind
  // follows, so closing lands on the poster last looked at.
  const stepBig = useCallback((dir: 1 | -1) => {
    const cur = enlargedRef.current;
    if (cur === null) return;
    const next = (cur + dir + N) % N;
    const img = bigImgRef.current;
    const swap = () => {
      setEnlarged(next);
      aimRef.current = next;
    };
    if (!img) return swap();
    gsap.to(img, {
      x: -dir * 36,
      opacity: 0,
      duration: 0.18,
      ease: "power1.in",
      onComplete: () => {
        swap();
        gsap.fromTo(img, { x: dir * 36, opacity: 0 }, { x: 0, opacity: 1, duration: 0.36, ease: "power2.out" });
      },
    });
  }, []);
  const closeBig = useCallback(() => {
    const el = bigRef.current;
    if (!el) return setEnlarged(null);
    gsap.to(el, { opacity: 0, duration: 0.26, ease: "power1.in", onComplete: () => setEnlarged(null) });
  }, []);
  const bigOpen = enlarged !== null;
  useLayoutEffect(() => {
    if (!bigOpen) return;
    const el = bigRef.current;
    const img = bigImgRef.current;
    if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
    if (img) gsap.fromTo(img, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepBig(1);
      else if (e.key === "ArrowLeft") stepBig(-1);
      else if (e.key === "Escape") closeBig();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bigOpen, stepBig, closeBig]);

  // ── THE TWO VIEWS, AND THE POSTER THAT TRAVELS BETWEEN THEM ──────────
  // The view not being looked at is laid out but lifted out of the flow
  // and hidden, so it never adds height to the page yet can always be
  // measured — which is what a flight between the two needs.
  const place = (el: HTMLElement | null, state: "flow" | "overlay" | "hidden") => {
    if (!el) return;
    el.style.position = state === "flow" ? "relative" : "absolute";
    el.style.top = state === "flow" ? "" : "0";
    el.style.left = state === "flow" ? "" : "0";
    el.style.right = state === "flow" ? "" : "0";
    el.style.visibility = state === "hidden" ? "hidden" : "";
    el.style.pointerEvents = state === "flow" ? "" : "none";
    el.style.zIndex = state === "overlay" ? "2" : "";
  };
  useLayoutEffect(() => {
    place(carRef.current, "flow");
    place(ovRef.current, "hidden");
  }, []);

  const imgOfItem = (i: number) => itemRefs.current[i]?.querySelector("img") ?? null;
  const imgOfCell = (i: number) => cellRefs.current[i]?.querySelector("img") ?? null;

  const flight = (src: string, from: DOMRect) => {
    const c = document.createElement("img");
    c.src = src;
    c.alt = "";
    Object.assign(c.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: "80",
      objectFit: "cover",
      borderRadius: "3px",
      boxShadow: "0 40px 90px -30px rgba(0,0,0,0.95)",
      pointerEvents: "none",
      margin: "0",
      maxWidth: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(c);
    return c;
  };

  /** Scroll the window, instantly, so a rectangle about to be flown to is
   *  on screen — measured again afterwards by the caller. */
  const bringIntoView = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight - 20) {
      window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: "instant" as ScrollBehavior });
    }
  };

  const toOverview = useCallback(() => {
    if (busy.current || modeRef.current === "overview") return;
    busy.current = true;
    const i = clampI(Math.round(aimRef.current ?? posRef.current));
    // Land the row exactly on the poster being carried, so what leaves is
    // precisely what arrives.
    aimRef.current = i;
    posRef.current = i;
    velRef.current = 0;
    layout();
    const fromImg = imgOfItem(i);
    const toImg = imgOfCell(i);
    const car = carRef.current;
    const ov = ovRef.current;
    if (!fromImg || !toImg || !car || !ov) {
      busy.current = false;
      return;
    }
    const A = fromImg.getBoundingClientRect();
    modeRef.current = "overview";
    setMode("overview");
    place(ov, "flow");
    place(car, "overlay");
    bringIntoView(toImg);
    const B = toImg.getBoundingClientRect();
    const clone = flight(POSTERS[i].src, A);
    fromImg.style.visibility = "hidden";
    toImg.style.visibility = "hidden";
    const others = cellRefs.current.filter((c, k) => c && k !== i);
    const tl = gsap.timeline({
      onComplete: () => {
        toImg.style.visibility = "";
        fromImg.style.visibility = "";
        clone.remove();
        place(car, "hidden");
        gsap.set(car, { clearProps: "opacity" });
        gsap.set(others, { clearProps: "opacity,transform" });
        busy.current = false;
      },
    });
    tl.to(car, { opacity: 0, duration: 0.4, ease: "power2.out" }, 0);
    tl.fromTo(
      others,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.62, stagger: 0.022, ease: "power3.out" },
      0.16
    );
    tl.to(
      clone,
      { left: B.left, top: B.top, width: B.width, height: B.height, duration: 0.82, ease: "power3.inOut" },
      0
    );
  }, [layout]);

  const toCarousel = useCallback(
    (focus?: number) => {
      if (busy.current) return;
      if (modeRef.current === "carousel") {
        if (focus !== undefined) aimRef.current = clampI(focus);
        return;
      }
      busy.current = true;
      const i = clampI(focus ?? Math.round(aimRef.current ?? posRef.current));
      const fromImg = imgOfCell(i);
      const car = carRef.current;
      const ov = ovRef.current;
      if (!fromImg || !car || !ov) {
        busy.current = false;
        return;
      }
      const A = fromImg.getBoundingClientRect();
      aimRef.current = i;
      posRef.current = i;
      velRef.current = 0;
      modeRef.current = "carousel";
      setMode("carousel");
      place(car, "flow");
      place(ov, "overlay");
      layout();
      const stage = stageRef.current;
      if (stage) bringIntoView(stage);
      const toImg = imgOfItem(i);
      if (!toImg) {
        busy.current = false;
        return;
      }
      const B = toImg.getBoundingClientRect();
      const clone = flight(POSTERS[i].src, A);
      fromImg.style.visibility = "hidden";
      toImg.style.visibility = "hidden";
      const others = itemRefs.current.filter((it, k) => it && k !== i);
      const tl = gsap.timeline({
        onComplete: () => {
          toImg.style.visibility = "";
          fromImg.style.visibility = "";
          clone.remove();
          place(ov, "hidden");
          gsap.set(ov, { clearProps: "opacity" });
          gsap.set(others.map((o) => o!.firstElementChild), { clearProps: "opacity" });
          busy.current = false;
        },
      });
      tl.to(ov, { opacity: 0, duration: 0.4, ease: "power2.out" }, 0);
      // The receding posters come up out of the dark around the one that
      // is travelling; their own depth styling is untouched, so this fades
      // their CONTENTS rather than fighting the layout for opacity.
      tl.fromTo(
        others.map((o) => o!.firstElementChild),
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: "power2.out" },
        0.3
      );
      tl.to(
        clone,
        { left: B.left, top: B.top, width: B.width, height: B.height, duration: 0.82, ease: "power3.inOut" },
        0
      );
    },
    [layout]
  );

  return (
    // Full-width black outer, measured shell inside — the same shape every
    // other project page has. A single element with max-width and auto
    // margins shrinks to its content inside the site's flex body, which is
    // what left this page an 800px column on a grey ground.
    <div className="pv-outer" style={{ fontFamily: SANS }}>
      <ProjectRail
        number={GD_PROJECTS.posters.number}
        title={POSTERS_CONTENT.title}
        description={POSTERS_CONTENT.description}
        backHref={gdBackHref(GD_PROJECTS.posters)}
          gd={GD_PROJECTS.posters}
      >
        <nav className="pv-modes" aria-label="View">
          <button
            type="button"
            className={`pv-mode${mode === "carousel" ? " on" : ""}`}
            onClick={() => toCarousel()}
            aria-pressed={mode === "carousel"}
          >
            <span className="pv-mode-n">01</span> Carousel
          </button>
          <button
            type="button"
            className={`pv-mode${mode === "overview" ? " on" : ""}`}
            onClick={toOverview}
            aria-pressed={mode === "overview"}
          >
            <span className="pv-mode-n">02</span> Overview
          </button>
        </nav>
      </ProjectRail>
    <div className="pv-root">
      <div className="pv-views">
        {/* ── 01 — THE CAROUSEL ─────────────────────────────────────── */}
        <section ref={carRef} className="pv-car" aria-hidden={mode !== "carousel"}>
          <div
            ref={stageRef}
            className="pv-stage"
            data-cursor="drag"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            onDragStart={(e) => e.preventDefault()}
          >
            {POSTERS.map((p, i) => (
              <div
                key={p.id}
                className="pv-item"
                data-pc-i={i}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
              >
                <div className="pv-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt={`Poster ${p.no}`}
                    width={p.w}
                    height={p.h}
                    loading={i < 5 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pv-meter" aria-live="polite">
            <span className="pv-now">{POSTERS[index].no}</span>
            <span className="pv-rule" aria-hidden />
            <span>
              {String(index + 1).padStart(2, "0")} of {String(N).padStart(2, "0")}
            </span>
          </div>
        </section>

        {/* ── 02 — THE OVERVIEW ─────────────────────────────────────── */}
        <section ref={ovRef} className="pv-ov" aria-hidden={mode !== "overview"}>
          <div className="pv-wall" style={{ aspectRatio: `100 / ${wall.height.toFixed(3)}` }}>
            {POSTERS.map((p, i) => {
              const s = wall.slots[i];
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pv-cell"
                  data-cursor="view"
                  ref={(el) => {
                    cellRefs.current[i] = el;
                  }}
                  onClick={() => toCarousel(i)}
                  aria-label={`Open poster ${p.no}`}
                  style={{
                    left: `${s.x}%`,
                    top: `${(s.y / wall.height) * 100}%`,
                    width: `${s.w}%`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={`Poster ${p.no}`} loading="lazy" decoding="async" draggable={false} />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {enlarged !== null && (
        <div
          ref={bigRef}
          className="pv-big"
          role="dialog"
          aria-modal="true"
          aria-label={`Poster ${POSTERS[enlarged].no}`}
          data-pv-big={enlarged}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBig();
          }}
        >
          <button type="button" className="pv-big-close" onClick={closeBig}>
            Close <span aria-hidden>×</span>
          </button>
          <button type="button" className="pv-big-arrow" aria-label="Previous poster" onClick={() => stepBig(-1)}>
            ‹
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bigImgRef}
            className="pv-big-img"
            src={POSTERS[enlarged].src}
            alt={`Poster ${POSTERS[enlarged].no}`}
            width={POSTERS[enlarged].w}
            height={POSTERS[enlarged].h}
          />
          <button type="button" className="pv-big-arrow" aria-label="Next poster" onClick={() => stepBig(1)}>
            ›
          </button>
          <div className="pv-big-count">
            {String(enlarged + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
          </div>
        </div>
      )}

      <style>{`
        .pv-outer {
          width: 100%; min-height: 100dvh; background: #000; color: #fff;
          overflow-x: clip; display: flex;
        }
        /* The work takes everything right of the header column; its width
           is a container, so the carousel sizes from the room it actually
           has rather than from the whole window. */
        .pv-root {
          flex: 1 1 auto; min-width: 0; container-type: inline-size;
          padding: clamp(20px, 3.4vh, 38px) clamp(18px, 3vw, 48px) clamp(40px, 8vh, 110px);
          overflow-x: clip;
        }
        .pv-big {
          position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,0.94);
          display: flex; align-items: center; justify-content: center;
          gap: clamp(16px, 3vw, 48px); padding: 56px 16px 48px;
        }
        /* The poster at its own 4:5, as large as the screen allows beside
           its two arrows. */
        .pv-big-img {
          display: block; max-width: none; flex: 0 0 auto;
          height: min(calc(100svh - 120px), (100vw - 2 * (44px + clamp(16px, 3vw, 48px)) - 32px) * 1.25);
          width: auto; aspect-ratio: 4 / 5; border-radius: 3px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 50px 120px -30px rgba(0,0,0,1);
        }
        .pv-big-arrow {
          flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.24);
          color: #fff; font-size: 21px; line-height: 1; display: grid; place-items: center;
        }
        .pv-big-arrow:hover { background: rgba(255,255,255,0.12); }
        @media (max-width: 600px) {
          .pv-big-img { height: min(calc(100svh - 120px), (100vw - 32px) * 1.25); }
          .pv-big-arrow {
            position: absolute; top: 50%; transform: translateY(-50%);
            background: rgba(0,0,0,0.55); z-index: 1;
          }
          .pv-big-arrow[aria-label="Previous poster"] { left: 8px; }
          .pv-big-arrow[aria-label="Next poster"] { right: 8px; }
        }
        .pv-big-close {
          position: absolute; top: 16px; right: clamp(16px, 3vw, 40px);
          background: none; border: 0; cursor: pointer; font: inherit; color: rgba(255,255,255,0.8);
          font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
        }
        .pv-big-count {
          position: absolute; bottom: 16px; left: 0; right: 0; text-align: center;
          font-size: 11px; letter-spacing: 0.18em; color: rgba(255,255,255,0.45);
        }
        .pv-modes { display: flex; gap: clamp(18px, 2.4vw, 32px); margin-top: 4px; }
        .pv-mode {
          border: 0; background: none; padding: 4px 0; cursor: pointer; font: inherit;
          font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.42); transition: color .3s ease;
          border-bottom: 1px solid transparent;
        }
        .pv-mode:hover { color: rgba(255,255,255,0.8); }
        .pv-mode.on { color: #fff; border-bottom-color: rgba(255,255,255,0.5); }
        .pv-mode-n { color: rgba(255,255,255,0.34); margin-right: 6px; }

        .pv-views { position: relative; }

        /* ONE MEASURE DRIVES THE STAGE: the poster's height is set from
           whichever axis runs out first, and the stage is derived from it,
           so the centre poster is never taller than the box holding it. */
        /* As tall as the page allows, and never so wide that the posters
           either side stop showing: the centre poster is at most a little
           over two fifths of the room beside the header column. */
        .pv-car { --pv-h: min(78svh, 64cqw, 1000px); }
        @media (min-width: 901px) {
          /* The carousel sits in the middle of the page's height, not at
             its top with an empty band beneath it. */
          .pv-car {
            min-height: calc(100dvh - clamp(20px, 3.4vh, 38px) - clamp(40px, 8vh, 110px));
            display: flex; flex-direction: column; justify-content: center;
          }
        }
        @media (max-width: 900px) {
          .pv-outer { flex-direction: column; }
          .pv-car { --pv-h: min(60svh, 92cqw); }
        }
        .pv-stage {
          position: relative; height: calc(var(--pv-h) + 24px);
          perspective: 1600px; perspective-origin: 50% 50%;
          transform-style: preserve-3d; touch-action: pan-y;
          user-select: none; -webkit-user-select: none; cursor: grab; overflow: hidden;
          margin-inline: calc(-1 * clamp(18px, 3vw, 48px));
        }
        .pv-stage:active { cursor: grabbing; }
        .pv-item {
          position: absolute; top: 12px; left: 0; right: 0; margin-inline: auto;
          height: var(--pv-h); width: calc(var(--pv-h) * 0.8);
          transform-style: preserve-3d; will-change: transform, opacity, filter;
        }
        .pv-frame {
          position: absolute; inset: 0; border-radius: 3px; overflow: hidden;
          background: #0b0b0c;
          /* A hairline OUTSIDE the edge, so a poster with a black ground (13)
             still reads as a print on the dark rather than a hole in it. */
          box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px -30px rgba(0,0,0,0.95);
        }
        .pv-frame img, .pv-cell img {
          display: block; width: 100%; height: 100%; object-fit: cover;
          max-width: none; pointer-events: none;
        }
        .pv-meter {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          margin-top: clamp(18px, 3vh, 30px);
          font-size: 11px; letter-spacing: 0.18em; color: rgba(255,255,255,0.4);
        }
        .pv-now { color: rgba(255,255,255,0.9); }
        .pv-rule { width: 28px; height: 1px; background: rgba(255,255,255,0.22); }

        .pv-wall { position: relative; width: 100%; }
        .pv-cell {
          position: absolute; aspect-ratio: 4 / 5; padding: 0; border: 0;
          background: #0b0b0c; border-radius: 3px; overflow: hidden; cursor: zoom-in;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 26px 60px -30px rgba(0,0,0,0.95);
          transition: transform .5s cubic-bezier(.22,.61,.36,1), box-shadow .5s cubic-bezier(.22,.61,.36,1), filter .5s ease;
        }
        @media (hover: hover) {
          .pv-cell:hover { transform: translateY(-6px); box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 40px 80px -30px rgba(0,0,0,1); filter: brightness(1.06); }
        }
        .pv-cell:focus-visible { outline: 1px solid rgba(255,255,255,0.6); outline-offset: 4px; }
        @media (prefers-reduced-motion: reduce) {
          .pv-cell { transition: none; }
          @media (hover: hover) { .pv-cell:hover { transform: none; } }
        }
      `}</style>
    </div>
    </div>
  );
}
