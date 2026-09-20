"use client";

// THE RECEPTION SCREEN PROJECT PAGE.
//
// ONE BODY OF WORK. There are no categories here, no tabs and no
// subsections: the stills and the motion pieces run as a single sequence
// in the order the supplied filenames give, and a video sits wherever its
// own number puts it rather than being grouped with the other videos.
//
// EDITORIAL, NOT A GRID. A grid says every piece matters the same amount,
// which is exactly what a body of work is not. The sequence runs down the
// page in a fixed rhythm of its own — an opening piece at full measure,
// then a pair of narrower ones inset from opposite margins, then a wide
// one again — so scale and indent carry the reading order. The rhythm is
// positional, not editorial: no piece is promoted or demoted by judgement,
// and nothing is captioned, titled or dated, because none of that was
// supplied.
//
// EVERY PIECE IS 16:9 and is shown at 16:9. Each cell reserves that ratio
// before anything loads, so nothing is cropped, letterboxed or stretched.
//
// THE VIDEOS PLAY THEMSELVES. They start as soon as they come into view,
// loop, stay silent, and keep running for as long as the reader is on the
// page — no click to start, no poster to dismiss, no transport controls.
// Once a piece has started it is never paused on its way past: stopping
// and restarting as cells scroll in and out is exactly the flicker this
// avoids.
//
// No navigation panel, no sidebar, no dashboard chrome — one Back link to
// the gallery this project belongs to, and the work.

import { useEffect, useRef } from "react";
import CurtainLink from "./CurtainLink";
import { RECEPTION_PIECES, type ReceptionPiece } from "./receptionScreenAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const DESCRIPTION =
  "A collection of visual content created for EIPL’s reception TV, including event announcements, company communications and motion pieces designed for display on screen.";

function ReceptionVideo({ piece }: { piece: ReceptionPiece }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Starts once, on first sight, and is not stopped again — see the file
    // banner. `muted` is set on the element itself as well as in markup
    // because a silent autoplay is the only kind browsers allow without a
    // gesture, and a stale `muted` attribute is the usual reason one is
    // refused.
    el.muted = true;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || started) continue;
          started = true;
          void el.play().catch(() => {
            // Refused (a data-saver mode, a policy): the poster stays, and
            // the piece is still there to look at.
          });
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={piece.src}
      poster={piece.poster}
      width={piece.w}
      height={piece.h}
      muted
      loop
      playsInline
      preload="metadata"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

// THE RHYTHM. A repeating measure of four, applied by position: full,
// inset-left, inset-right, full. `inset` is the share of the column the
// piece gives up; `from` is the margin it gives it up to. Nothing here
// looks at what a piece IS.
const MEASURE = [
  { inset: 0, from: "none" },
  { inset: 0.22, from: "left" },
  { inset: 0.22, from: "right" },
  { inset: 0.1, from: "none" },
] as const;

export default function ReceptionScreenView() {
  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="rs-shell">
        <header className="rs-head">
          <CurtainLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </CurtainLink>
          <h1 className="rs-title">Reception Screen</h1>
          <p className="rs-desc">{DESCRIPTION}</p>
        </header>

        <main className="rs-run">
          {RECEPTION_PIECES.map((piece, i) => {
            const m = MEASURE[i % MEASURE.length];
            return (
              <figure
                key={piece.id}
                className="rs-cell"
                style={{
                  width: `${(1 - m.inset) * 100}%`,
                  marginLeft: m.from === "right" ? "auto" : undefined,
                  marginRight: m.from === "left" ? "auto" : undefined,
                }}
              >
                <div className="rs-frame">
                  {piece.kind === "video" ? (
                    <ReceptionVideo piece={piece} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={piece.src}
                      alt=""
                      width={piece.w}
                      height={piece.h}
                      loading={i < 2 ? "eager" : "lazy"}
                      decoding="async"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                </div>
              </figure>
            );
          })}
        </main>
      </div>

      <style>{`
        .rs-shell {
          min-height: 100dvh;
          padding: clamp(22px, 4vh, 48px) clamp(18px, 6vw, 96px) clamp(64px, 12vh, 150px);
          max-width: 1500px;
          margin: 0 auto;
        }
        .rs-head {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 62ch;
          padding-bottom: clamp(30px, 6vh, 74px);
        }
        .rs-title {
          margin: 0;
          font-size: clamp(30px, 3.4vw, 58px);
          font-weight: 500;
          letter-spacing: -0.015em;
          line-height: 1.04;
        }
        .rs-desc {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.75;
          font-weight: 300;
          color: rgba(255,255,255,0.64);
        }
        .rs-run {
          display: flex;
          flex-direction: column;
          gap: clamp(30px, 7vh, 96px);
        }
        .rs-cell { margin: 0; }
        /* The 16:9 box is reserved before anything loads, so the page never
           reflows as the sequence fills in. */
        .rs-frame {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 3px;
          background: #0a0a0b;
          box-shadow: 0 30px 90px rgba(0,0,0,0.62);
          transform: translateZ(0);
          transition: transform 620ms cubic-bezier(0.22,1,0.36,1),
                      box-shadow 620ms cubic-bezier(0.22,1,0.36,1);
        }
        .rs-cell:hover .rs-frame {
          transform: translateY(-4px);
          box-shadow: 0 44px 120px rgba(0,0,0,0.72);
        }
        /* Below the fold of a phone the indents stop earning their keep —
           a 22% inset of a 320px column is a thumbnail. Full measure, and
           the rhythm is carried by the spacing alone. */
        @media (max-width: 760px) {
          .rs-cell { width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rs-frame, .rs-cell:hover .rs-frame { transition: none; transform: none; }
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
