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

import ProjectRail from "./ProjectRail";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import ReceptionDepthCarousel from "./ReceptionDepthCarousel";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const DESCRIPTION =
  "A collection of visual content created for EIPL’s reception TV, including event announcements, company communications and motion pieces designed for display on screen.";

export default function ReceptionScreenView() {
  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="rs-shell">
        <ProjectRail
          variant="block"
          number={GD_PROJECTS.receptionScreen.number}
          title="Reception Screen"
          description={DESCRIPTION}
          backHref={gdBackHref(GD_PROJECTS.receptionScreen)}
          gd={GD_PROJECTS.receptionScreen}
        />

        <main className="rs-run">
          <ReceptionDepthCarousel />
          <p className="rs-hint">Drag, scroll or use the arrow keys</p>
        </main>
      </div>

      <style>{`
        .rs-shell { min-height: 100dvh; }
        /* The work runs the full width under the header; its padding is
           the gutter the depth carousel's own row reaches back out past. */
        .rs-run {
          padding: 0 clamp(18px, 6vw, 96px) clamp(40px, 8vh, 110px);
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

