"use client";

// THE RECEPTION SCREEN PROJECT PAGE.
//
// ONE BODY OF WORK. There are no categories here, no tabs and no
// subsections: the stills and the motion pieces run as a single sequence
// in the order the supplied filenames give, and a video sits wherever its
// own number puts it rather than being grouped with the other videos.
//
// ONE PIECE AT A TIME, IN DEPTH. This work was made for a screen in a
// reception — one thing showing, the rest of the day's run waiting behind
// it — and a column of cells scrolling past says the opposite. The pieces
// now stand in a row receding into the dark: the one being looked at is
// closest and sharp, its neighbours fall back, shrink, turn slightly and
// blur, and a drag or a wheel moves the row. See ReceptionDepthCarousel.
//
// The SEQUENCE is untouched — the supplied order is still the order, a
// video still sits wherever its own number puts it, and nothing is
// captioned, titled or dated, because none of that was supplied.
//
// EVERY PIECE IS 16:9 and is shown at 16:9. Each cell reserves that ratio
// before anything loads, so nothing is cropped, letterboxed or stretched.
//
// THE VIDEOS PLAY THEMSELVES, but only the one being looked at: eight
// simultaneous decodes to show one piece is how a carousel starts
// dropping frames. A piece starts silently as it reaches the centre and
// stops once it has left.
//
// No navigation panel, no sidebar, no dashboard chrome — one Back link to
// the gallery this project belongs to, and the work.

import TransitionLink from "./TransitionLink";
import ReceptionDepthCarousel from "./ReceptionDepthCarousel";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const DESCRIPTION =
  "A collection of visual content created for EIPL’s reception TV, including event announcements, company communications and motion pieces designed for display on screen.";

export default function ReceptionScreenView() {
  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="rs-shell">
        <header className="rs-head">
          <TransitionLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <h1 className="rs-title">Reception Screen</h1>
          <p className="rs-desc">{DESCRIPTION}</p>
        </header>

        <main className="rs-run">
          <ReceptionDepthCarousel />
          <p className="rs-hint">Drag, scroll or use the arrow keys</p>
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
          gap: clamp(16px, 2.4vh, 26px);
        }
        .rs-hint {
          margin: 0;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
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
