"use client";

// THE APPLICATIONS PROJECT PAGE.
//
// The card has to lead somewhere, so this is the same still life at the
// page's own size with the portfolio's rail beside it — the shape every
// other project page on this ring already has. No copy has been supplied
// for this project beyond the four objects' own names, so none is
// invented here: the rail states the title and what is in the picture,
// and nothing else.

import ApplicationsDisplay from "./ApplicationsDisplay";
import TransitionLink from "./TransitionLink";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** What is in the composition, in the brief's own words. */
const OBJECTS = [
  "Chemsource jerrycan",
  "Excelsource letterhead",
  "Corporate mug",
  "Pat-on-the-back award",
];

export default function ApplicationsView() {
  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS }}>
      <div className="ap-shell">
        <aside className="ap-rail">
          <TransitionLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <div className="ap-num">06</div>
          <h1 className="ap-title">Applications</h1>
          <ul className="ap-list">
            {OBJECTS.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </aside>
        <main className="ap-main">
          <ApplicationsDisplay />
        </main>
      </div>

      <style>{`
        .ap-shell { display: flex; min-height: 100dvh; }
        .ap-rail {
          width: clamp(240px, 24vw, 360px); flex: 0 0 auto;
          border-right: 1px solid rgba(255,255,255,0.07);
          padding: clamp(22px, 4vh, 44px) clamp(20px, 2.4vw, 40px);
          display: flex; flex-direction: column; gap: 14px;
        }
        .ap-num {
          margin-top: 18px; font-size: 11px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.34);
        }
        .ap-title {
          margin: 0; font-size: clamp(30px, 3.2vw, 54px); font-weight: 500;
          letter-spacing: -0.015em; line-height: 1.04;
        }
        .ap-list {
          margin: 10px 0 0; padding: 0; list-style: none;
          display: flex; flex-direction: column; gap: 7px;
        }
        .ap-list li {
          font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(255,255,255,0.46);
        }
        .ap-main {
          flex: 1 1 auto; min-width: 0; min-height: clamp(320px, 62vh, 760px);
          position: relative; overflow: clip;
        }
        @media (max-width: 900px) {
          .ap-shell { flex-direction: column; }
          .ap-rail { width: 100%; border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.07); }
        }
      `}</style>
    </div>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  fontSize: 12, fontWeight: 500, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
};
