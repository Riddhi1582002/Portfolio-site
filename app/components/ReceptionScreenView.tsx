"use client";

// THE RECEPTION SCREEN PROJECT PAGE.
//
// ONE BODY OF WORK. There are no categories here, no tabs and no
// subsections: the stills and the motion pieces run as a single sequence
// in the order the supplied filenames give, and a video sits wherever its
// own number puts it rather than being grouped with the other videos.
//
// EVERY PIECE IS 16:9 and is shown at 16:9. Each cell reserves that ratio
// before anything loads, so nothing is cropped, letterboxed or stretched
// to fit a tidier grid.
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
            // Refused despite being muted (rare). Nothing to recover: the
            // first frame stands in until the browser allows playback.
          });
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={piece.src}
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

export default function ReceptionScreenView() {
  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS, minHeight: "100dvh" }}>
      <div className="rtv-shell" style={{ display: "flex", minHeight: "100dvh" }}>
        <aside
          className="rtv-rail"
          style={{
            width: "clamp(280px, 28vw, 400px)",
            flex: "0 0 auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "clamp(22px, 3.6vh, 40px) clamp(20px, 2.4vw, 40px)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <CurtainLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </CurtainLink>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 2.7vw, 46px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.08,
            }}
          >
            Reception Screen
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.75,
              fontWeight: 300,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {DESCRIPTION}
          </p>
        </aside>

        <main
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            padding: "clamp(22px, 3.6vh, 40px) clamp(18px, 3vw, 48px) clamp(48px, 7vh, 88px)",
          }}
        >
          <div className="rtv-grid">
            {RECEPTION_PIECES.map((piece) => (
              <figure key={piece.src} className="rtv-cell">
                {piece.kind === "video" ? (
                  <ReceptionVideo piece={piece} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={piece.src}
                    alt=""
                    width={piece.w}
                    height={piece.h}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </figure>
            ))}
          </div>
        </main>
      </div>

      <style>{`
        .rtv-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(14px, 1.6vw, 26px);
        }
        .rtv-cell {
          margin: 0;
          /* Every supplied piece is 16:9; the cell holds that ratio before
             anything has loaded, so nothing ever reflows or crops. */
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.1);
          background: #0a0a0b;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
          transform: translateZ(0);
          transition: transform 420ms cubic-bezier(0.16,1,0.3,1),
                      box-shadow 420ms cubic-bezier(0.16,1,0.3,1);
        }
        .rtv-cell:hover {
          transform: translateY(-6px);
          box-shadow: 0 34px 80px rgba(0,0,0,0.72), 0 0 40px rgba(255,255,255,0.06);
        }
        @media (max-width: 1100px) { .rtv-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 900px) {
          .rtv-shell { flex-direction: column !important; }
          .rtv-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rtv-cell, .rtv-cell:hover { transition: none; transform: none; }
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
  color: "rgba(255,255,255,0.62)",
  textDecoration: "none",
};
