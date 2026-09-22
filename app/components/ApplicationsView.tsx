"use client";

// THE APPLICATIONS PROJECT PAGE.
//
// A case study, not a gallery. The page opens on ONE object — a single
// chemical drum, large enough to be the whole first screen — and only
// then admits that there are others. Each category after that is a
// composed field rather than a grid of equal tiles: pieces sit at four
// different widths and four different depths, so the eye is given an
// order to read them in instead of a wall to scan.
//
// NOTHING IS CROPPED OR STRETCHED. Every plate is an aspect-ratio box
// built from the piece's own native dimensions, so an A4 sheet, a 4:5
// product photograph and a 4:1 banner each occupy the shape their pixels
// ask for. The artwork is never drawn on, never tinted and never framed
// in a way that changes it — the shadow that grounds a piece falls
// OUTSIDE its edges.
//
// THE COMPOSITION IS EXPLICIT. Column, span and row are stated per piece
// per breakpoint in applicationsAssets.ts rather than left to grid
// auto-flow, because an auto-flowed field re-composes itself whenever a
// piece changes size and this one is supposed to be the same arrangement
// every time. Every stagger offset is positive for the same reason a
// negative one is a bug: it would be eating the row gap above it.
//
// CLICKING A PIECE ENLARGES THAT PIECE. Not a copy of it in a modal —
// the focused image starts at the exact rectangle the plate occupies and
// travels to the middle of the screen, and on close it travels back to
// wherever that plate is now. The source is re-measured at close time so
// the return lands correctly even if the page moved underneath.

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import TransitionLink from "./TransitionLink";
import {
  DESCRIPTION,
  OPENING,
  SECTIONS,
  SUBTITLE,
  type PlacedPiece,
} from "./applicationsAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

type Focus = {
  src: string;
  label: string;
  /** The rectangle the focused image starts from and returns to. */
  from: DOMRect;
  nw: number;
  nh: number;
};

/** The box a focused image is given: as large as the screen allows while
 *  keeping the image's own proportions completely intact. */
function focusBox(nw: number, nh: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = vw * (vw < 640 ? 0.96 : 0.9);
  const maxH = vh * (vw < 640 ? 0.82 : 0.88);
  const a = nw / nh;
  let w = maxW;
  let h = w / a;
  if (h > maxH) {
    h = maxH;
    w = h * a;
  }
  return { width: w, height: h, left: (vw - w) / 2, top: (vh - h) / 2 };
}

export default function ApplicationsView() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  /** The plate's own <img>, hidden while its focused twin is out. */
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const layerRef = useRef<HTMLImageElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);

  const open = useCallback((e: React.MouseEvent<HTMLButtonElement>, label: string) => {
    if (busy.current) return;
    const img = e.currentTarget.querySelector("img");
    if (!(img instanceof HTMLImageElement) || !img.naturalWidth) return;
    sourceRef.current = img;
    setFocus({
      src: img.currentSrc || img.src,
      label,
      from: img.getBoundingClientRect(),
      nw: img.naturalWidth,
      nh: img.naturalHeight,
    });
  }, []);

  const close = useCallback(() => {
    const layer = layerRef.current;
    const src = sourceRef.current;
    if (!layer || !src || busy.current) return;
    busy.current = true;
    // RE-MEASURED, not remembered: the plate may have moved since it was
    // opened, and returning to a stale rectangle is how this kind of
    // transition ends up landing in the wrong place.
    const r = src.getBoundingClientRect();
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.45, ease: "power2.out" });
    gsap.to(layer, {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      duration: 0.56,
      ease: "power3.inOut",
      onComplete: () => {
        src.style.visibility = "";
        sourceRef.current = null;
        busy.current = false;
        setFocus(null);
      },
    });
  }, []);

  // ── THE FOCUS FLIGHT ────────────────────────────────────────────────
  useEffect(() => {
    if (!focus) return;
    const layer = layerRef.current;
    const src = sourceRef.current;
    if (!layer || !src) return;

    const to = focusBox(focus.nw, focus.nh);
    gsap.set(layer, {
      left: focus.from.left,
      top: focus.from.top,
      width: focus.from.width,
      height: focus.from.height,
    });
    src.style.visibility = "hidden";
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.42, ease: "power2.out" });
    gsap.to(layer, { ...to, duration: 0.62, ease: "power3.inOut" });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Non-passive, because the point is to stop the page moving under the
    // focused piece — a passive listener cannot.
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    const back = backdropRef.current;
    back?.addEventListener("wheel", block, { passive: false });
    back?.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.removeEventListener("wheel", block);
      back?.removeEventListener("touchmove", block);
    };
  }, [focus, close]);

  // ── SCROLL-DRIVEN SEQUENCING ────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from("[data-open-line]", {
        opacity: 0, y: 26, duration: 0.9, stagger: 0.09, ease: "power3.out", delay: 0.12,
      });
      gsap.from("[data-open-plate]", {
        opacity: 0, y: 44, scale: 0.965, duration: 1.15, ease: "power3.out", delay: 0.22,
      });

      root.querySelectorAll<HTMLElement>("[data-section]").forEach((sec) => {
        gsap.from(sec.querySelectorAll("[data-head]"), {
          opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: "power3.out",
          scrollTrigger: { trigger: sec, start: "top 80%" },
        });
        gsap.from(sec.querySelectorAll("[data-plate]"), {
          opacity: 0, y: 48, scale: 0.975, duration: 0.95, stagger: 0.09, ease: "power3.out",
          scrollTrigger: { trigger: sec, start: "top 72%" },
        });
      });

      // PARALLAX lives on its own element. The reveal above already owns
      // `y` on the figure, and two tweens on one transform is one of them
      // silently winning. Kept to +/-18px so that even when two adjacent
      // rows drift apart they cannot close the 72px row gap between them.
      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((p, i) => {
        gsap.to(p, {
          y: i % 2 === 0 ? -18 : 10,
          ease: "none",
          scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: 0.6 },
        });
      });
    }, root);

    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === "complete") refresh();
    else window.addEventListener("load", refresh);
    // The webfont is the one thing here that can still change a heading's
    // height after first paint, and every trigger below it moves with it.
    document.fonts?.ready.then(refresh).catch(() => {});
    return () => {
      window.removeEventListener("load", refresh);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="ap-root"
      style={{ fontFamily: SANS }}
    >
      {/* ── THE OPENING ─────────────────────────────────────────────── */}
      <header className="ap-open">
        <div className="ap-open-text">
          <TransitionLink href="/work/graphic-design" className="ap-back">
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <div className="ap-num" data-open-line>07</div>
          <h1 className="ap-title" data-open-line>Applications</h1>
          <p className="ap-sub" data-open-line>{SUBTITLE}</p>
          <p className="ap-desc" data-open-line>{DESCRIPTION}</p>
        </div>

        <div className="ap-open-plate" data-open-plate>
          <div className="ap-ground" aria-hidden />
          <button
            type="button"
            className="ap-plate ap-plate-hero"
            style={{ aspectRatio: String(OPENING.aspect) }}
            onClick={(e) => open(e, OPENING.label)}
            aria-label={`Enlarge ${OPENING.label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={OPENING.src} alt={OPENING.label} draggable={false} />
          </button>
          <figcaption className="ap-cap ap-cap-hero">{OPENING.label}</figcaption>
        </div>
      </header>

      {/* ── THE FOUR CATEGORIES ─────────────────────────────────────── */}
      {SECTIONS.map((sec, si) => (
        <section className="ap-sec" data-section key={sec.index}>
          <div className="ap-head">
            <span className="ap-head-idx" data-head>{sec.index}</span>
            <h2 className="ap-head-title" data-head>{sec.title}</h2>
          </div>
          <div className="ap-field">
            {sec.pieces.map((p, i) => (
              <figure className={`ap-cell ap-${si}-${i}`} data-plate key={p.id}>
                <div data-parallax>
                  <button
                    type="button"
                    className="ap-plate"
                    style={{ aspectRatio: String(p.aspect) }}
                    onClick={(e) => open(e, p.label)}
                    aria-label={`Enlarge ${p.label}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.label} loading="lazy" draggable={false} />
                  </button>
                  <figcaption className="ap-cap">{p.label}</figcaption>
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <footer className="ap-foot">
        <TransitionLink href="/work/graphic-design" className="ap-back">
          <span aria-hidden>←</span> Back to Graphic Design
        </TransitionLink>
      </footer>

      {/* ── THE FOCUSED PIECE ───────────────────────────────────────── */}
      {focus && (
        <div className="ap-focus" role="dialog" aria-modal="true" aria-label={focus.label}>
          <div ref={backdropRef} className="ap-backdrop" onClick={close} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={layerRef}
            className="ap-layer"
            src={focus.src}
            alt={focus.label}
            draggable={false}
            onClick={close}
          />
        </div>
      )}

      <style>{`
        .ap-root {
          position: relative; width: 100%; background: #000; color: #fff;
          overflow-x: clip;
        }
        .ap-back {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.58);
          text-decoration: none; transition: color .3s ease;
        }
        .ap-back:hover { color: rgba(255,255,255,0.95); }

        /* ── OPENING ───────────────────────────────────────────────── */
        .ap-open {
          display: grid; grid-template-columns: 1fr;
          gap: clamp(40px, 6vh, 76px);
          padding: clamp(24px, 4vh, 56px) var(--ap-gutter) clamp(56px, 9vh, 128px);
          align-items: center; min-height: 100svh;
        }
        .ap-open-text { display: flex; flex-direction: column; }
        .ap-num {
          margin-top: clamp(28px, 6vh, 64px); font-size: 11px;
          letter-spacing: 0.22em; color: rgba(255,255,255,0.34);
        }
        .ap-title {
          margin: 10px 0 0; font-weight: 500; line-height: 1;
          letter-spacing: -0.025em; text-transform: uppercase;
          font-size: clamp(38px, 8.4vw, 104px);
        }
        .ap-sub {
          margin: 14px 0 0; font-size: clamp(12px, 1.15vw, 15px);
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.5);
        }
        .ap-desc {
          margin: clamp(22px, 3.2vh, 38px) 0 0; max-width: 54ch;
          font-size: clamp(14px, 1.15vw, 16.5px); line-height: 1.68;
          color: rgba(255,255,255,0.68);
        }
        .ap-open-plate { position: relative; justify-self: center; width: 100%; }
        .ap-plate-hero {
          width: 100%;
          max-width: min(84vw, calc(68svh * ${OPENING.aspect}));
          margin: 0 auto;
        }
        /* A pool of light the object stands in. Sits BEHIND the artwork
           and never over it. */
        .ap-ground {
          position: absolute; left: 50%; bottom: -6%; translate: -50% 0;
          width: 120%; height: 46%; pointer-events: none; z-index: 0;
          background: radial-gradient(closest-side,
            rgba(255,238,214,0.10), rgba(255,238,214,0.03) 58%, transparent 100%);
          filter: blur(14px);
        }

        /* ── SECTIONS ──────────────────────────────────────────────── */
        .ap-sec { padding: clamp(56px, 11vh, 150px) var(--ap-gutter) 0; }
        .ap-head {
          display: flex; align-items: baseline; gap: clamp(16px, 2vw, 30px);
          padding-bottom: clamp(46px, 5vh, 62px);
          border-top: 1px solid rgba(255,255,255,0.10);
          padding-top: clamp(20px, 3vh, 34px);
        }
        .ap-head-idx {
          font-size: 11px; letter-spacing: 0.22em;
          color: rgba(255,255,255,0.32); flex: 0 0 auto;
        }
        .ap-head-title {
          margin: 0; font-weight: 500; letter-spacing: -0.012em;
          font-size: clamp(22px, 3.4vw, 44px); line-height: 1.08;
        }
        .ap-field {
          display: grid; grid-template-columns: 1fr;
          column-gap: clamp(18px, 2.6vw, 44px); row-gap: 72px;
          align-items: start;
        }
        .ap-cell { margin: 0; min-width: 0; }

        /* ── A PIECE ───────────────────────────────────────────────── */
        .ap-plate {
          display: block; position: relative; z-index: 1;
          width: 100%; padding: 0; border: 0; background: none;
          cursor: zoom-in; border-radius: 3px; overflow: hidden;
          box-shadow: 0 24px 48px -28px rgba(0,0,0,0.95);
          transition: transform .55s cubic-bezier(.22,.61,.36,1),
                      box-shadow .55s cubic-bezier(.22,.61,.36,1),
                      filter .55s ease;
        }
        .ap-plate img {
          display: block; width: 100%; height: 100%;
          object-fit: contain; max-width: none;
        }
        @media (hover: hover) {
          .ap-plate:hover {
            transform: translateY(-10px) scale(1.012);
            box-shadow: 0 44px 78px -30px rgba(0,0,0,0.98);
            filter: brightness(1.05);
          }
        }
        .ap-plate:focus-visible {
          outline: 1px solid rgba(255,255,255,0.55); outline-offset: 6px;
        }
        .ap-cap {
          margin-top: 20px; font-size: 11px; letter-spacing: 0.15em;
          text-transform: uppercase; color: rgba(255,255,255,0.42);
        }
        .ap-cap-hero { text-align: center; }

        .ap-foot {
          padding: clamp(64px, 12vh, 150px) var(--ap-gutter) clamp(48px, 8vh, 96px);
        }

        /* ── FOCUS ─────────────────────────────────────────────────── */
        .ap-focus { position: fixed; inset: 0; z-index: 90; }
        .ap-backdrop {
          position: absolute; inset: 0; background: rgba(0,0,0,0.93);
          backdrop-filter: blur(6px); opacity: 0; cursor: zoom-out;
          overscroll-behavior: contain; touch-action: none;
        }
        .ap-layer {
          position: fixed; margin: 0; max-width: none; object-fit: contain;
          cursor: zoom-out; border-radius: 3px;
          box-shadow: 0 60px 120px -40px rgba(0,0,0,1);
        }

        /* ── THE FIELD, PER BREAKPOINT ─────────────────────────────── */
        .ap-root { --ap-gutter: 20px; }
        @media (min-width: 640px) {
          .ap-root { --ap-gutter: clamp(28px, 4.6vw, 96px); }
          .ap-field { grid-template-columns: repeat(6, 1fr); }
        }
        @media (min-width: 1100px) {
          .ap-open {
            grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
            gap: clamp(40px, 5vw, 96px);
          }
          .ap-field { grid-template-columns: repeat(12, 1fr); }
          .ap-cap-hero { text-align: left; }
        }
        ${SECTIONS.map((sec, si) =>
          sec.pieces
            .map((p: PlacedPiece, i: number) => {
              const c = `.ap-${si}-${i}`;
              const push = p.smAlign === "end" ? "margin-left:auto" : "margin-right:auto";
              // Never the whole column: see the hero cap above.
              const smW = Math.min(p.smWidth, 0.92);
              return (
                `${c}{width:${(smW * 100).toFixed(2)}%;${push};}` +
                `@media(min-width:640px){${c}{` +
                `grid-column:${p.md[0]}/span ${p.md[1]};grid-row:${p.md[2]};` +
                `width:100%;margin-left:0;margin-right:0;margin-top:${p.offMd}px;}}` +
                `@media(min-width:1100px){${c}{` +
                `grid-column:${p.lg[0]}/span ${p.lg[1]};grid-row:${p.lg[2]};` +
                `margin-top:${p.offLg}px;}}`
              );
            })
            .join("")
        ).join("")}

        @media (prefers-reduced-motion: reduce) {
          .ap-plate { transition: none; }
          @media (hover: hover) { .ap-plate:hover { transform: none; } }
        }
      `}</style>
    </div>
  );
}
