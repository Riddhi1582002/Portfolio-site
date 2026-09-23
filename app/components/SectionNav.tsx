"use client";

// THE THREE SECTIONS — VIDEO, GRAPHIC DESIGN, ART — three short lines of
// small caps, set right in the top-right corner.
//
// WHY THERE. Every other corner and edge of this site is already spoken
// for: the wordmark and the work own the centre, BACK owns the top-left of
// every category and project page, the contact block the bottom-right, the
// gallery's hint the bottom-centre and its medium bar the top-centre. The
// top-right is empty in every scene, so the navigation sits there, set in
// the same small caps as BACK and at the same height, and reads as part of
// that system rather than as a bar laid over it. Stacked, not in a row: on
// the gallery a row ran on from the medium bar at the same height and read
// as its last three tabs. The gallery is full bleed, so the corner carries
// a faint shade and the letters a soft shadow — legible over a pale
// drawing without a box around them.
//
// On the homepage it follows the journey: the section the reader is in is
// the bright one, so the line doubles as a sense of where they are. It
// steps back while the A transition plays and while the resting page shows
// its own row under ART, and is gone under an open reel.
//
// NARROW SCREENS get one word, MENU, that opens the three as a short
// right-aligned list with full-size touch targets — not the desktop row
// squeezed into a phone.

import { useEffect, useState, useSyncExternalStore } from "react";
import TransitionLink from "./TransitionLink";
import { HOME_SECTION_HREF, type HomeSectionKey } from "./homeSections";
import { markGdDirect } from "./graphicDesignProjects";
import {
  getSectionNavOverlay,
  getSectionNavState,
  subscribeSectionNav,
  type SectionNavState,
} from "./sectionNavStore";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const LINKS: { key: HomeSectionKey; label: string }[] = [
  { key: "video", label: "Video" },
  { key: "graphic-design", label: "Graphic Design" },
  { key: "art", label: "Art" },
];
const SERVER_STATE: SectionNavState = { section: null, show: true };

export default function SectionNav({
  current,
  follow = false,
}: {
  /** The section this page is (a category route). */
  current?: HomeSectionKey | null;
  /** On the homepage: follow the journey instead (see sectionNavStore). */
  follow?: boolean;
}) {
  const live = useSyncExternalStore(subscribeSectionNav, getSectionNavState, () => SERVER_STATE);
  const section = follow ? live.section : current ?? null;
  const overlay = useSyncExternalStore(subscribeSectionNav, getSectionNavOverlay, () => false);
  const show = (follow ? live.show : true) && !overlay;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // An open list stays up until it is closed, even if the scene behind it
  // would otherwise hide the navigation.
  const visible = show || open;

  const links = (compact: boolean) =>
    LINKS.map((l) => (
      <TransitionLink
        key={l.key}
        href={HOME_SECTION_HREF[l.key]}
        onNavigate={() => {
          setOpen(false);
          if (l.key === "graphic-design") markGdDirect();
        }}
        className={`sn-link${section === l.key ? " on" : ""}${compact ? " sn-item" : ""}`}
        ariaCurrent={section === l.key ? "page" : undefined}
      >
        {l.label}
      </TransitionLink>
    ));

  return (
    <div
      className="sn-root"
      data-section-nav={section ?? ""}
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <nav className="sn-row" aria-label="Sections">
        {links(false)}
      </nav>

      <div className="sn-compact">
        <button
          type="button"
          className="sn-toggle"
          aria-expanded={open}
          aria-controls="sn-list"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>
        {open && (
          <>
            <button type="button" className="sn-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
            <nav id="sn-list" className="sn-list" aria-label="Sections">
              {links(true)}
            </nav>
          </>
        )}
      </div>

      <style>{`
        .sn-root {
          position: fixed; z-index: 60;
          top: clamp(18px, 3.5vh, 34px); right: clamp(18px, 4vw, 48px);
          font-family: ${SANS};
          transition: opacity 520ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sn-row { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; }
        .sn-root::before {
          content: ""; position: absolute; z-index: -1; pointer-events: none;
          top: calc(-1 * clamp(18px, 3.5vh, 34px)); right: calc(-1 * clamp(18px, 4vw, 48px));
          width: 340px; height: 190px;
          background: radial-gradient(100% 100% at 100% 0%, rgba(0,0,0,0.5), rgba(0,0,0,0.22) 45%, rgba(0,0,0,0) 72%);
        }
        .sn-link {
          position: relative; display: inline-block; text-decoration: none;
          font-size: 11.5px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.55); white-space: nowrap;
          text-shadow: 0 0 10px rgba(0,0,0,0.75), 0 1px 2px rgba(0,0,0,0.6);
          transition: color 260ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        /* The name's own underline: a hairline that swipes in from the
           right on hover, and stays drawn under the section you are in. */
        .sn-link::before {
          content: ""; position: absolute; left: 0; bottom: -3px; height: 1px; width: 100%;
          background: currentColor; transform: scaleX(0); transform-origin: right;
          transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sn-link:hover, .sn-link:focus-visible, .sn-link.on { color: #fff; }
        .sn-link:hover::before, .sn-link:focus-visible::before, .sn-link.on::before {
          transform: scaleX(1); transform-origin: left;
        }
        .sn-link:focus-visible { outline: none; }

        .sn-compact { display: none; }
        .sn-toggle {
          position: relative; z-index: 2;
          background: none; border: 0; padding: 10px 0 10px 16px; margin: -10px 0;
          font: inherit; font-size: 12px; font-weight: 500; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.78); cursor: pointer;
          text-shadow: 0 0 10px rgba(0,0,0,0.75), 0 1px 2px rgba(0,0,0,0.6);
          -webkit-tap-highlight-color: transparent;
        }
        .sn-scrim {
          position: fixed; inset: 0; z-index: 1; border: 0; padding: 0; cursor: default;
          background: radial-gradient(130% 80% at 100% 0%, rgba(0,0,0,0.94), rgba(0,0,0,0.72) 50%, rgba(0,0,0,0.38));
          animation: sn-fade 300ms ease both;
        }
        .sn-list {
          position: absolute; z-index: 2; top: calc(100% + 18px); right: 0;
          display: flex; flex-direction: column; align-items: flex-end;
        }
        .sn-item {
          font-size: 15px; letter-spacing: 0.14em; color: rgba(255,255,255,0.72);
          line-height: 44px; min-height: 44px;
          animation: sn-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sn-item::before { bottom: 10px; }
        .sn-item:nth-child(2) { animation-delay: 45ms; }
        .sn-item:nth-child(3) { animation-delay: 90ms; }
        @keyframes sn-fade { from { opacity: 0; } }
        @keyframes sn-rise { from { opacity: 0; transform: translateY(-6px); } }

        /* Below this the stack would reach the gallery's centred medium
           bar, and on a phone it would be three words crammed in a corner. */
        @media (max-width: 1180px) {
          .sn-row { display: none; }
          .sn-compact { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sn-root, .sn-link, .sn-link::before { transition: none; }
          .sn-scrim, .sn-item { animation: none; }
        }
      `}</style>
    </div>
  );
}
