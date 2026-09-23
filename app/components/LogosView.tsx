"use client";

// THE LOGOS PROJECT PAGE.
//
// Left, the portfolio's own rail: back, number, title and the section's
// two paragraphs. Right, one large card per brand — each showing that
// brand's first supplied mockup board, whole, in the site's HoverCard —
// so the page is an overview of the six identities, not every variant of
// every one.
//
// A CARD OPENS THE BRAND FULLSCREEN. The supplied boards are already the
// editorial layout this view is built around (dark ground, thin rounded
// frame, rounded panels), so the board is the presentation: it expands out
// of its card and is shown whole on a ground matched to its own margin,
// under a restrained title. Two levels of navigation, kept apart:
//
//   - the small discs, upper right, are this brand's LOGO VARIANTS. Every
//     board for a brand is the same scene with a different logo applied,
//     so choosing a variant crossfades to its board and only the logo
//     changes — same mockups, composition, lighting and scale;
//   - the arrows at the sides move between BRANDS.
//
// Nothing here draws, crops or recolours a logo or a mockup: see
// logoBrandsAssets.ts for what each file is and how variants pair with
// boards.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import ProjectRail from "./ProjectRail";
import HoverCard from "./HoverCard";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import { LOGOS } from "./logosAssets";
import { LOGO_BRANDS, type LogoBrand } from "./logoBrandsAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const N = LOGO_BRANDS.length;
const pad = (n: number) => String(n).padStart(2, "0");

/** Every board is ~1.416:1; the stage keeps the first board's own ratio. */
const ratioOf = (b: LogoBrand) => b.variants[0].w / b.variants[0].h;

export default function LogosView() {
  const [open, setOpen] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Where the fullscreen view should fly back to when it closes: the card
  // of the brand showing at that moment.
  const cardRect = useCallback((i: number) => {
    const el = cardRefs.current[i]?.querySelector(".lb-shot") as HTMLElement | null;
    return el?.getBoundingClientRect() ?? null;
  }, []);

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="lb-shell">
        <ProjectRail
          number={GD_PROJECTS.logos.number}
          title={LOGOS.title}
          description={LOGOS.description}
          backHref={gdBackHref(GD_PROJECTS.logos)}
          gd={GD_PROJECTS.logos}
        >
          <div className="lb-rule" />
          <p className="lb-note">{LOGOS.note}</p>
          <div className="lb-count">{pad(N)} IDENTITIES</div>
        </ProjectRail>

        <main className="lb-main">
          <div className="lb-grid">
            {LOGO_BRANDS.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className="lb-card"
                data-logo-brand={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                onClick={() => setOpen(i)}
                aria-label={`${b.name} — open`}
              >
                <HoverCard aspect={ratioOf(b)} radius={18} className="lb-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.variants[0].card}
                    alt={`${b.name} mockups`}
                    draggable={false}
                    decoding="async"
                    loading={i < 2 ? "eager" : "lazy"}
                    className="lb-img"
                  />
                </HoverCard>
                <span className="lb-meta">
                  <span className="lb-name">{b.name}</span>
                  <span className="lb-desc">{b.descriptor}</span>
                </span>
              </button>
            ))}
          </div>
        </main>
      </div>

      {open != null && (
        <LogoShowcase
          start={open}
          fromRect={cardRect}
          onClosed={() => setOpen(null)}
        />
      )}

      <style>{`
        .lb-shell { display: flex; min-height: 100dvh; }
        .lb-note {
          margin: 0; font-size: 13.5px; line-height: 1.75; font-weight: 300;
          color: rgba(255,255,255,0.64);
        }
        .lb-rule { width: 46px; height: 1px; background: rgba(255,255,255,0.22); }
        .lb-count {
          margin-top: auto; font-size: 11px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.34);
        }
        .lb-main {
          flex: 1 1 auto; min-width: 0;
          padding: clamp(24px, 5vh, 64px) clamp(16px, 3.4vw, 56px) clamp(40px, 8vh, 96px);
        }
        .lb-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(28px, 4.4vh, 56px) clamp(18px, 2.4vw, 40px);
        }
        .lb-card {
          display: flex; flex-direction: column; gap: 14px;
          padding: 0; border: 0; background: none; color: inherit;
          text-align: left; cursor: zoom-in; font: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .lb-shot { width: 100%; }
        .lb-img {
          display: block; width: 100%; height: 100%; object-fit: cover;
          pointer-events: none; user-select: none;
        }
        .lb-meta { display: flex; flex-direction: column; gap: 5px; padding: 0 2px; }
        .lb-name { font-size: 14px; font-weight: 500; letter-spacing: 0.01em; color: rgba(255,255,255,0.92); }
        .lb-desc {
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.42);
        }
        .lb-card:focus-visible { outline: 1px solid rgba(255,255,255,0.6); outline-offset: 6px; border-radius: 18px; }
        @media (max-width: 1100px) {
          .lb-grid { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 900px) {
          .lb-shell { flex-direction: column; }
          .lb-count { margin-top: 8px; }
        }
      `}</style>
    </div>
  );
}

// ── THE FULLSCREEN PRESENTATION ─────────────────────────────────────────

function LogoShowcase({
  start,
  fromRect,
  onClosed,
}: {
  start: number;
  fromRect: (i: number) => DOMRect | null;
  onClosed: () => void;
}) {
  const [brandIdx, setBrandIdx] = useState(start);
  const [variant, setVariant] = useState(0);
  const brand = LOGO_BRANDS[brandIdx];
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  // The variant discs sit beside the board in the layout but fade with
  // the rest of the chrome.
  const discsRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const state = useRef({ brandIdx, variant });
  useEffect(() => {
    state.current = { brandIdx, variant };
  }, [brandIdx, variant]);

  // Every board of the brand on screen is fetched as soon as it opens, so
  // choosing a variant never waits on the network mid-crossfade.
  useEffect(() => {
    for (const v of brand.variants) {
      const im = new Image();
      im.src = v.board;
    }
  }, [brand]);

  // The page behind stays where it was: no scrolling under the view.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // ── OPEN: the board grows out of its card ────────────────────────────
  const flyFrom = useCallback(
    (r: DOMRect | null) => {
      const stage = stageRef.current;
      if (!stage || !r) return null;
      const s = stage.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, scale: r.width / s.width };
    },
    []
  );
  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const chrome = chromeRef.current;
    if (!root || !stage || !chrome) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const f = flyFrom(fromRect(start));
    busy.current = true;
    const tl = gsap.timeline({ onComplete: () => void (busy.current = false) });
    tl.fromTo(root, { backgroundColor: "rgba(10,10,10,0)" }, { backgroundColor: "rgba(10,10,10,1)", duration: reduce ? 0.01 : 0.55, ease: "power2.out" }, 0);
    if (f && !reduce) {
      tl.fromTo(
        stage,
        { x: f.x, y: f.y, scale: f.scale, transformOrigin: "0 0" },
        { x: 0, y: 0, scale: 1, duration: 0.8, ease: "power3.inOut" },
        0
      );
    }
    tl.fromTo([chrome, discsRef.current], { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, reduce ? 0 : 0.5);
    return () => {
      tl.kill();
    };
    // Once, on mount: later brand changes are their own transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CLOSE: back into the card of the brand now showing ───────────────
  const close = useCallback(() => {
    if (busy.current) return;
    const root = rootRef.current;
    const stage = stageRef.current;
    const chrome = chromeRef.current;
    if (!root || !stage || !chrome) return onClosed();
    busy.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = fromRect(state.current.brandIdx);
    // Only fly home to a card that is actually on screen; otherwise the
    // view simply falls away where it is.
    const visible = r && r.bottom > 0 && r.top < window.innerHeight;
    const f = visible ? flyFrom(r) : null;
    const tl = gsap.timeline({ onComplete: onClosed });
    tl.to([chrome, discsRef.current], { opacity: 0, duration: 0.25, ease: "power2.in" }, 0);
    if (f && !reduce) {
      tl.to(stage, { x: f.x, y: f.y, scale: f.scale, transformOrigin: "0 0", duration: 0.7, ease: "power3.inOut" }, 0.1);
    } else {
      tl.to(stage, { opacity: 0, scale: 0.97, duration: 0.4, ease: "power2.in" }, 0.05);
    }
    tl.to(root, { backgroundColor: "rgba(10,10,10,0)", duration: 0.5, ease: "power2.inOut" }, reduce ? 0 : 0.3);
  }, [flyFrom, fromRect, onClosed]);

  // ── BRANDS: the arrows ───────────────────────────────────────────────
  const goBrand = useCallback((dir: 1 | -1) => {
    if (busy.current) return;
    const stage = stageRef.current;
    const next = (state.current.brandIdx + dir + N) % N;
    if (!stage) {
      setBrandIdx(next);
      setVariant(0);
      return;
    }
    busy.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = reduce ? 0 : 36 * dir;
    gsap.to(stage, {
      opacity: 0,
      x: -d,
      duration: reduce ? 0.12 : 0.32,
      ease: "power2.in",
      onComplete: () => {
        setBrandIdx(next);
        setVariant(0);
        requestAnimationFrame(() => {
          gsap.fromTo(
            stage,
            { opacity: 0, x: d },
            {
              opacity: 1,
              x: 0,
              duration: reduce ? 0.12 : 0.5,
              ease: "power3.out",
              onComplete: () => void (busy.current = false),
            }
          );
        });
      },
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") goBrand(1);
      else if (e.key === "ArrowLeft") goBrand(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, goBrand]);

  const ratio = ratioOf(brand);

  return (
    <div
      ref={rootRef}
      className="ls-root"
      role="dialog"
      aria-modal="true"
      aria-label={`${brand.name} — logo variants and mockups`}
      data-logo-showcase={brand.id}
      style={{ ["--r" as string]: ratio }}
    >
      <div ref={chromeRef} className="ls-chrome">
        <button type="button" className="ls-close" onClick={close}>
          <span aria-hidden>←</span> Logos
        </button>
        <div className="ls-head">
          <div className="ls-title">{brand.name}</div>
          <div className="ls-desc">{brand.descriptor}</div>
        </div>
        <div className="ls-count">
          {pad(brandIdx + 1)} / {pad(N)}
        </div>
        <button type="button" className="ls-arrow ls-prev" onClick={() => goBrand(-1)} aria-label="Previous brand">
          <span aria-hidden>‹</span>
        </button>
        <button type="button" className="ls-arrow ls-next" onClick={() => goBrand(1)} aria-label="Next brand">
          <span aria-hidden>›</span>
        </button>
      </div>

      <div className="ls-body">
        <div className="ls-frame">
          <div ref={discsRef} className="ls-discs" role="group" aria-label={`${brand.name} logo variants`}>
            {brand.variants.map((v, i) => (
              <button
                key={v.logo}
                type="button"
                className={`ls-disc${i === variant ? " on" : ""}`}
                style={{ background: v.disc }}
                onClick={() => setVariant(i)}
                aria-pressed={i === variant}
                aria-label={`Logo variant ${i + 1} of ${brand.variants.length}`}
                data-logo-variant={i}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.logo} alt="" draggable={false} />
              </button>
            ))}
          </div>
          <div ref={stageRef} className="ls-stage">
            {brand.variants.map((v, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={v.board}
                src={v.board}
                alt={i === variant ? `${brand.name} — mockups, logo variant ${i + 1}` : ""}
                aria-hidden={i !== variant}
                draggable={false}
                className="ls-board"
                data-board={i}
                style={{ opacity: i === variant ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .ls-root {
          --disc: clamp(46px, 4vw, 64px);
          position: fixed; inset: 0; z-index: 300;
          background: rgba(10,10,10,0); color: #fff; font-family: ${SANS};
          overflow: hidden;
        }
        .ls-chrome { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
        .ls-chrome > * { pointer-events: auto; }
        .ls-close {
          position: absolute; top: clamp(16px, 3vh, 30px); left: clamp(16px, 2.4vw, 36px);
          display: inline-flex; gap: 8px; align-items: center;
          background: none; border: 0; padding: 6px 0; cursor: pointer;
          font: inherit; font-size: 11.5px; font-weight: 500; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.72);
        }
        .ls-close:hover { color: #fff; }
        .ls-head {
          position: absolute; top: clamp(18px, 3.4vh, 34px); left: 50%;
          transform: translateX(-50%); text-align: center; pointer-events: none;
          width: min(60vw, 560px);
        }
        .ls-title {
          font-size: clamp(13px, 1.05vw, 16px); font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.94);
        }
        .ls-desc {
          margin-top: 6px; font-size: 9.5px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.4);
        }
        .ls-count {
          position: absolute; top: clamp(20px, 3.4vh, 34px); right: clamp(16px, 2.4vw, 36px);
          font-size: 10.5px; letter-spacing: 0.2em; color: rgba(255,255,255,0.38);
        }
        .ls-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.7); font-size: 20px; line-height: 1; padding-bottom: 2px;
          transition: background .3s ease, color .3s ease, border-color .3s ease;
        }
        .ls-arrow:hover { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.28); }
        .ls-prev { left: clamp(10px, 1.8vw, 30px); }
        .ls-next { right: clamp(10px, 1.8vw, 30px); }

        /* The board is sized to the room it has: the header above, the
           discs over its right corner, and the arrows beside it. */
        .ls-body {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          padding: calc(clamp(18px, 3.4vh, 34px) + 58px) calc(clamp(10px, 1.8vw, 30px) + 56px) clamp(20px, 4vh, 44px);
        }
        .ls-frame {
          display: flex; flex-direction: column; gap: clamp(12px, 1.8vh, 20px);
          width: min(100%, calc((100dvh - (clamp(18px, 3.4vh, 34px) + 58px) - clamp(20px, 4vh, 44px) - var(--disc) - clamp(12px, 1.8vh, 20px)) * var(--r)));
        }
        .ls-discs { display: flex; justify-content: flex-end; gap: clamp(8px, 0.8vw, 12px); flex-wrap: wrap; }
        .ls-disc {
          position: relative; width: var(--disc); height: var(--disc); border-radius: 50%;
          border: 0; padding: 0; cursor: pointer; overflow: hidden; flex: 0 0 auto;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.28), 0 8px 18px -8px rgba(0,0,0,0.9);
          opacity: 0.62; transform: scale(0.92);
          transition: opacity .35s ease, transform .35s cubic-bezier(0.22,1,0.36,1), box-shadow .35s ease;
        }
        /* The disc's own sheen, as a physical badge — over the artwork,
           never tinting it beyond a highlight. */
        .ls-disc::after {
          content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
          background: radial-gradient(120% 90% at 30% 18%, rgba(255,255,255,0.22), rgba(255,255,255,0) 46%);
        }
        .ls-disc img {
          display: block; width: 84%; height: 84%; object-fit: contain; pointer-events: none;
        }
        .ls-disc:hover { opacity: 0.9; transform: scale(0.97); }
        .ls-disc.on {
          opacity: 1; transform: scale(1);
          box-shadow: 0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 4px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.28), 0 10px 22px -8px rgba(0,0,0,0.9);
        }
        .ls-stage {
          position: relative; width: 100%; aspect-ratio: var(--r);
          will-change: transform;
          /* The board's own empty margin is feathered into the ground, so
             no rectangle edge shows around its frame. Nothing inside the
             frame is touched. */
          -webkit-mask-image: linear-gradient(to right, transparent, #000 1.2%, #000 98.8%, transparent), linear-gradient(to bottom, transparent, #000 1.6%, #000 98.4%, transparent);
          -webkit-mask-composite: source-in; mask-composite: intersect;
        }
        .ls-board {
          position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
          transition: opacity .5s ease; user-select: none;
        }
        @media (max-width: 700px) {
          /* On a phone the board is short and centred; the title sits just
             above its discs rather than stranded at the top of the screen. */
          .ls-head {
            top: max(calc(clamp(16px, 3vh, 30px) + 36px),
                     calc(50% - (100vw - 32px) / var(--r) / 2 - var(--disc) - 96px));
            width: calc(100vw - 32px);
          }
          .ls-body { padding: calc(clamp(16px, 3vh, 30px) + 96px) 16px 76px; }
          .ls-arrow { top: auto; bottom: 18px; transform: none; width: 40px; height: 40px; }
          .ls-prev { left: calc(50% - 52px); }
          .ls-next { right: calc(50% - 52px); }
          .ls-frame { width: 100%; }
        }
        @media (max-height: 480px) and (orientation: landscape) {
          .ls-head { top: 12px; }
          .ls-desc { display: none; }
          .ls-body { padding: 44px 64px 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ls-board, .ls-disc { transition: none; }
        }
      `}</style>
    </div>
  );
}
