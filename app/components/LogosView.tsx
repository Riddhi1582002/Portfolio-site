"use client";

// THE LOGOS PROJECT PAGE.
//
// Left, the portfolio's own rail: back, number, title, and the project's
// two paragraphs. Right, the work — a large branding still life, and
// under it the four identities as a horizontal run you can drag through.
//
// THE STILL LIFE is the same objects as the card, staged larger and
// arranged per the brief: Fruit Rush at the left foreground, Clear Wave
// upper right, the MEL tanker behind them both, and the Orient Industries
// card low and forward. Everything stands on the groundline, so the
// triangle is a real arrangement of objects on a surface rather than a
// layout of pictures. The lightbox, the lighting, the stones and the
// hover response are the ring's own — this is the same studio the card
// was photographed in, one room along.
//
// THE RUN is four projects, one active. The active one shows its supplied
// lockup beside the object that carries it, so the identity and its
// application read together; its neighbours stay partly visible so the
// set reads as a set. Drag, arrows or a click move between them, and the
// still life's own focus follows — selecting a project brings that object
// forward rather than swapping the picture for another one.
//
// No category strip, no invented metadata, and no description beyond the
// two paragraphs the brief supplies.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import TransitionLink from "./TransitionLink";
import LogosStill from "./LogosStill";
import { LOGOS, LOGO_PROJECTS } from "./logosAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** How far apart the projects stand in the run, as a share of one card's
 *  width. Just under one, so a neighbour is always partly in frame. */
const STEP = 0.78;

export default function LogosView() {
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(320);
  const activeRef = useRef(0);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // The run is measured, not assumed: one card is a share of the strip, so
  // the same code gives a phone a readable card and a desktop a wide one.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setCardW(Math.max(180, Math.min(360, w * (w < 700 ? 0.62 : 0.3))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = cardW * STEP;
  const railX = useCallback((i: number) => -i * step, [step]);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.min(LOGO_PROJECTS.length - 1, Math.max(0, i));
      setActive(clamped);
      if (railRef.current) {
        gsap.to(railRef.current, {
          x: railX(clamped),
          duration: 0.62,
          ease: "power3.out",
        });
      }
    },
    [railX]
  );

  // Re-park on resize so a rotation cannot strand the run between two
  // projects.
  useLayoutEffect(() => {
    if (railRef.current) gsap.set(railRef.current, { x: railX(activeRef.current) });
  }, [railX, cardW]);

  // DRAG. Capture is taken only once a drag has actually started, never on
  // pointer-down: a captured pointer retargets the click that follows it,
  // and that is how a run like this ends up impossible to click.
  const drag = useRef<{ x: number; railX: number; moved: boolean } | null>(null);
  const captured = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!railRef.current) return;
    gsap.killTweensOf(railRef.current);
    drag.current = {
      x: e.clientX,
      railX: (gsap.getProperty(railRef.current, "x") as number) || 0,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !railRef.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3 && !d.moved) {
      d.moved = true;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        captured.current = e.pointerId;
      } catch {
        // Refused: the drag simply ends at the strip's edge.
      }
    }
    if (d.moved) gsap.set(railRef.current, { x: d.railX + dx });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (captured.current != null) {
      try {
        (e.currentTarget as Element).releasePointerCapture(captured.current);
      } catch {
        // Already gone with the pointer.
      }
      captured.current = null;
    }
    if (!d?.moved || !railRef.current) return;
    const x = (gsap.getProperty(railRef.current, "x") as number) || 0;
    goTo(Math.round(-x / step));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(activeRef.current - 1);
      else if (e.key === "ArrowRight") goTo(activeRef.current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  const current = LOGO_PROJECTS[active];

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="lg-shell">
        {/* ── LEFT: the rail ──────────────────────────────────────── */}
        <aside className="lg-rail">
          <TransitionLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <div className="lg-num">05</div>
          <h1 className="lg-title">{LOGOS.title}</h1>
          <p className="lg-desc">{LOGOS.description}</p>
          <div className="lg-rule" />
          <p className="lg-note">{LOGOS.note}</p>
          <div className="lg-count">
            {String(active + 1).padStart(2, "0")} / {String(LOGO_PROJECTS.length).padStart(2, "0")}
          </div>
        </aside>

        {/* ── RIGHT: the work ─────────────────────────────────────── */}
        <main className="lg-main">
          <div className="lg-still">
            <LogosStill focusId={current.id} />
          </div>

          <div
            ref={stripRef}
            className="lg-strip"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <div ref={railRef} className="lg-run">
              {LOGO_PROJECTS.map((p, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-logo-card={i}
                    onClick={() => {
                      if (drag.current?.moved) return;
                      goTo(i);
                    }}
                    className="lg-card"
                    style={{
                      width: cardW,
                      left: i * step,
                      opacity: isActive ? 1 : 0.46,
                      transform: `scale(${isActive ? 1 : 0.92})`,
                    }}
                  >
                    {/* The supplied lockup, whole and uncropped, on the
                        stock the identity would be printed on. */}
                    <span className="lg-mark">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.logo} alt={p.title} draggable={false} />
                    </span>
                    <span className="lg-meta">
                      <span className="lg-name">{p.title}</span>
                      <span className="lg-cat">{p.category}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg-controls">
            <span className="lg-applied">{current.mockup}</span>
            <span className="lg-arrows">
              <button
                type="button"
                onClick={() => goTo(active - 1)}
                disabled={active === 0}
                aria-label="Previous identity"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => goTo(active + 1)}
                disabled={active === LOGO_PROJECTS.length - 1}
                aria-label="Next identity"
              >
                ›
              </button>
            </span>
          </div>
        </main>
      </div>

      <style>{`
        .lg-shell { display: flex; min-height: 100dvh; }
        .lg-rail {
          width: clamp(240px, 24vw, 360px);
          flex: 0 0 auto;
          border-right: 1px solid rgba(255,255,255,0.07);
          padding: clamp(22px, 4vh, 44px) clamp(20px, 2.4vw, 40px);
          display: flex; flex-direction: column; gap: 14px;
        }
        .lg-num {
          margin-top: 18px; font-size: 11px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.34);
        }
        .lg-title {
          margin: 0; font-size: clamp(30px, 3.2vw, 54px); font-weight: 500;
          letter-spacing: -0.015em; line-height: 1.04;
        }
        .lg-desc, .lg-note {
          margin: 0; font-size: 13.5px; line-height: 1.75; font-weight: 300;
          color: rgba(255,255,255,0.64);
        }
        .lg-rule { width: 46px; height: 1px; background: rgba(255,255,255,0.22); margin: 6px 0; }
        .lg-count {
          margin-top: auto; font-size: 11px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.34);
        }
        .lg-main {
          flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;
          padding: clamp(18px, 3vh, 34px) clamp(16px, 3vw, 46px) clamp(26px, 4vh, 48px);
          gap: clamp(14px, 2.4vh, 28px);
        }
        .lg-still {
          flex: 1 1 auto; min-height: clamp(280px, 52vh, 620px);
          position: relative; overflow: clip;
        }
        /* The run is clipped here so it can never widen the document. */
        .lg-strip {
          position: relative; height: clamp(120px, 17vh, 190px);
          overflow: clip; touch-action: pan-y; cursor: grab;
        }
        .lg-strip:active { cursor: grabbing; }
        .lg-run { position: absolute; inset: 0; will-change: transform; }
        .lg-card {
          position: absolute; top: 0; height: 100%;
          display: flex; flex-direction: column; gap: 10px;
          padding: 0; border: none; background: none; cursor: pointer;
          text-align: left; transform-origin: 0 50%;
          transition: opacity 420ms cubic-bezier(0.22,1,0.36,1),
                      transform 420ms cubic-bezier(0.22,1,0.36,1);
          -webkit-tap-highlight-color: transparent;
        }
        .lg-mark {
          flex: 1 1 auto; min-height: 0; display: flex;
          align-items: center; justify-content: center;
          background: #0c0c0d; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 3px; overflow: hidden;
        }
        .lg-mark img {
          max-width: 82%; max-height: 74%; width: auto; height: auto;
          object-fit: contain; display: block;
        }
        .lg-meta { display: flex; flex-direction: column; gap: 2px; }
        .lg-name { font-size: 13px; color: rgba(255,255,255,0.9); }
        .lg-cat {
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }
        .lg-controls {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .lg-applied {
          font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }
        .lg-arrows { display: flex; gap: 8px; }
        .lg-arrows button {
          width: 34px; height: 34px; border-radius: 999px; cursor: pointer;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.8); font-size: 15px; line-height: 1;
        }
        .lg-arrows button:disabled { opacity: 0.3; cursor: default; }
        @media (max-width: 900px) {
          .lg-shell { flex-direction: column; }
          .lg-rail { width: 100%; border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.07); }
          .lg-count { margin-top: 8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-card { transition: none; }
        }
      `}</style>
    </div>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
};
