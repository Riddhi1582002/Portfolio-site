"use client";

// ART, on its own route.
//
// The gallery is the unmodified InfiniteCanvas, rendered SETTLED rather
// than scrubbed: on the homepage its progress ran the pull-back out of
// the iris, which is a hand-off from the beat before it and has no
// meaning here. Held at 1 it opens exactly where the homepage's own ART
// link used to land — fully pulled back, armed, and drag-driven, which is
// how the gallery works from then on anyway. That also means this route
// has no scroll track at all: one viewport, and nothing underneath.
//
// The return gesture (a scroll up out of the field) still plays its full
// camera move; at the end of it, instead of resetting the page's scroll
// to the hero above, it navigates home — see onReturnHome.
//
// TWO WAYS IN, and the bar at the top is the switch between them. The
// field is where the work is BROWSED — scattered, mediums interleaved,
// nothing grouped, found by wandering. Picking a medium is the other
// question entirely ("show me the charcoal"), and a scatter answers that
// badly, so it is answered with a plain grid of just that medium. The
// field is never filtered in place: it would leave holes where the other
// mediums were, and the scatter's whole composition is the interleaving.
//
// THE FIELD IS NOT UNMOUNTED while a medium is showing. It owns a plane
// of fifty-six positioned cells and a drag loop, and rebuilding that to
// come back from a grid would cost more than leaving it standing. It is
// hidden instead, which also takes its pointer events with it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import InfiniteCanvas, { PIECES, type Piece } from "./InfiniteCanvas";
import TransitionLink from "./TransitionLink";
import ArtMediumBar, { isArtMedium } from "./ArtMediumBar";
import { HOME_FINAL_HREF, backStyle } from "./CategoryStage";

const SANS = "'Neue Montreal', system-ui, sans-serif";

export default function ArtCategoryView() {
  const [viewport, setViewport] = useState({ vw: 1440, vh: 900 });
  const [medium, setMedium] = useState<string | null>(null);
  // ?medium=… opens straight on that medium's collection — how the bar on
  // the homepage's own gallery hands over to this page.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("medium");
    if (m && isArtMedium(m)) {
      const id = requestAnimationFrame(() => setMedium(m));
      return () => cancelAnimationFrame(id);
    }
  }, []);
  const [focus, setFocus] = useState<Piece | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () =>
      setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const shown = useMemo(
    () => (medium ? PIECES.filter((p) => p.medium === medium) : []),
    [medium]
  );

  // The grid arrives rather than appearing: the same restrained rise the
  // rest of the site uses, staggered so the eye is given an order.
  useEffect(() => {
    if (!medium) return;
    const root = gridRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-art-cell]", {
        opacity: 0,
        y: 26,
        duration: 0.62,
        stagger: 0.035,
        ease: "power3.out",
      });
    }, root);
    return () => ctx.revert();
  }, [medium]);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  // ── THE GRID SCROLLS UNDER THE HAND ──────────────────────────────────
  // Wheel, a click-and-drag and touch all move the one sheet, with no
  // scrollbar to reach for. The wheel is eased toward where it is heading
  // rather than stepping; a drag follows the pointer and carries its speed
  // on release. Touch is the browser's own native scroll.
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTarget = useRef(0);
  const sheetDrag = useRef<{
    active: boolean;
    y: number;
    top: number;
    vel: number;
    lastY: number;
    lastT: number;
    moved: number;
    suppress: boolean;
  }>({ active: false, y: 0, top: 0, vel: 0, lastY: 0, lastT: 0, moved: 0, suppress: false });
  useEffect(() => {
    const el = sheetRef.current;
    if (!medium || !el) return;
    sheetTarget.current = el.scrollTop;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const max = el.scrollHeight - el.clientHeight;
      const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      sheetTarget.current = Math.max(0, Math.min(max, sheetTarget.current + d));
      gsap.to(el, { scrollTop: sheetTarget.current, duration: 0.55, ease: "power3.out", overwrite: true });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [medium]);
  const onSheetDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = sheetRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    const d = sheetDrag.current;
    d.active = true;
    d.y = e.clientY;
    d.top = el.scrollTop;
    d.vel = 0;
    d.lastY = e.clientY;
    d.lastT = performance.now();
    d.moved = 0;
  };
  const onSheetMove = (e: React.PointerEvent) => {
    const d = sheetDrag.current;
    const el = sheetRef.current;
    if (!d.active || !el) return;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dy));
    if (d.moved < 4) return;
    e.preventDefault();
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vel = d.vel * 0.6 + (((e.clientY - d.lastY) / dt) * 1000) * 0.4;
    d.lastY = e.clientY;
    d.lastT = now;
    el.scrollTop = d.top - dy;
    sheetTarget.current = el.scrollTop;
  };
  const onSheetUp = () => {
    const d = sheetDrag.current;
    const el = sheetRef.current;
    if (!d.active || !el) return;
    d.active = false;
    if (d.moved < 4) return;
    d.suppress = true;
    const fresh = performance.now() - d.lastT < 90;
    const max = el.scrollHeight - el.clientHeight;
    sheetTarget.current = Math.max(0, Math.min(max, el.scrollTop - (fresh ? d.vel * 0.35 : 0)));
    gsap.to(el, { scrollTop: sheetTarget.current, duration: 0.9, ease: "power3.out", overwrite: true });
  };

  // A document navigation, for the reason CategoryStage's own Back gives.
  const goHome = useCallback(() => {
    // The return gesture has already played its own full camera move, so
    // it hands over directly rather than running a second aperture over it.
    window.location.assign(HOME_FINAL_HREF);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#000",
        fontFamily: SANS,
      }}
    >
      <InfiniteCanvas
        progress={1}
        sans={SANS}
        vw={viewport.vw}
        vh={viewport.vh}
        visible={!medium}
        onReturnHome={goHome}
      />

      {medium && (
        <div
          ref={sheetRef}
          className="ag-sheet"
          onPointerDown={onSheetDown}
          onPointerMove={onSheetMove}
          onPointerUp={onSheetUp}
          onPointerCancel={onSheetUp}
          onClickCapture={(e) => {
            // The click that ends a drag is not a choice of artwork.
            if (sheetDrag.current.suppress) {
              sheetDrag.current.suppress = false;
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          <div ref={gridRef} className="ag-grid">
            {shown.map((p) => (
              <figure
                key={p.id}
                className="ag-cell"
                data-art-cell
                onClick={() => setFocus(p)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.details ? `${p.medium} — ${p.details}` : p.medium}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{ aspectRatio: `${p.w} / ${p.h}` }}
                />
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* ── THE BAR. Above both, because it is what switches them. ──── */}
      <ArtMediumBar
        active={medium}
        onSelect={(m) => {
          setMedium(m);
          setFocus(null);
        }}
      />

      <TransitionLink href={HOME_FINAL_HREF} style={backStyle}>
        <span aria-hidden>←</span> Back
      </TransitionLink>

      {focus && (
        <div
          className="ag-focus"
          role="dialog"
          aria-modal="true"
          onClick={() => setFocus(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={focus.src} alt={focus.details ?? focus.medium} draggable={false} />
          <figcaption className="ag-cap">
            <span className="ag-cap-medium">{focus.medium}</span>
            {focus.details && <span className="ag-cap-detail">{focus.details}</span>}
          </figcaption>
        </div>
      )}

      <style>{`
        /* A SHEET OVER THE FIELD, opaque, so the grid is read against the
           same black and nothing of the scatter shows through it. */
        .ag-sheet {
          position: absolute; inset: 0; z-index: 30;
          background: #000; overflow-y: auto; overscroll-behavior: contain;
          scrollbar-width: none; cursor: grab; user-select: none;
          padding: calc(clamp(16px, 2.4vh, 30px) + 58px) clamp(16px, 4vw, 64px)
                   clamp(48px, 9vh, 110px);
        }
        .ag-sheet::-webkit-scrollbar { display: none; }
        .ag-sheet:active { cursor: grabbing; }
        /* COLUMNS, NOT A ROW GRID: every artwork keeps its own proportions,
           so equal-height rows would mean cropping something. */
        .ag-grid {
          column-count: 4; column-gap: clamp(14px, 1.6vw, 26px);
          max-width: 1420px; margin: 0 auto;
        }
        .ag-cell {
          break-inside: avoid; margin: 0 0 clamp(14px, 1.6vw, 26px);
          cursor: zoom-in; border-radius: 3px; overflow: hidden;
          box-shadow: 0 18px 40px -24px rgba(0,0,0,0.9);
          transition: transform .5s cubic-bezier(.22,.61,.36,1),
                      box-shadow .5s cubic-bezier(.22,.61,.36,1);
        }
        .ag-cell img { display: block; width: 100%; height: auto; }
        @media (hover: hover) {
          .ag-cell:hover { transform: translateY(-6px); box-shadow: 0 34px 62px -26px rgba(0,0,0,0.95); }
        }
        /* Clears the bar on its own line — see the 860px rule above. */
        @media (max-width: 860px) {
          .ag-sheet { padding-top: calc(clamp(18px, 3.5vh, 34px) + 96px); }
        }
        @media (max-width: 1180px) { .ag-grid { column-count: 3; } }
        @media (max-width: 800px)  { .ag-grid { column-count: 2; } }
        @media (max-width: 460px)  { .ag-grid { column-count: 1; } }

        .ag-focus {
          position: fixed; inset: 0; z-index: 60;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 18px;
          padding: clamp(20px, 5vh, 64px);
          background: rgba(0,0,0,0.94); backdrop-filter: blur(8px);
          cursor: zoom-out;
        }
        .ag-focus img {
          max-width: 100%; max-height: 78vh; width: auto; height: auto;
          object-fit: contain; display: block; border-radius: 3px;
          box-shadow: 0 50px 110px -40px rgba(0,0,0,1);
        }
        .ag-cap {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          text-align: center;
        }
        .ag-cap-medium {
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.86);
        }
        .ag-cap-detail {
          font-size: 12.5px; line-height: 1.6; max-width: 54ch;
          color: rgba(255,255,255,0.52);
        }
        @media (prefers-reduced-motion: reduce) {
          .ag-cell { transition: none; }
          @media (hover: hover) { .ag-cell:hover { transform: none; } }
        }
      `}</style>
    </div>
  );
}
