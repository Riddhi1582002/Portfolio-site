"use client";

// A CATEGORY, ON ITS OWN.
//
// VIDEO, GRAPHIC DESIGN and ART used to be three beats inside the
// homepage's one long scroll track, and "going to a category" meant
// jumping to that beat — which left the whole rest of the site sitting
// directly below it. Keep scrolling past the reels and the bulb arrived;
// keep scrolling past the bulb and the gallery did. A category was never
// its own place, and no amount of opacity or pointer-events could make it
// one, because the other sections were genuinely still in the scroll
// flow.
//
// Each category now has its own route, and this is what those routes are
// built on: one track, one pinned pane, one progress value, and nothing
// else in the tree. There is no next section to reach because there is no
// next section. Scrolling to the end simply ends, with the category's own
// Back still on screen.
//
// The plumbing is deliberately the homepage's own — track height in vh,
// ScrollTrigger pinning through usePinnedPane, progress read off the
// track's rect every frame — so a beat behaves here exactly as it did
// there, and the components inside are the unmodified originals.

import { useEffect, useRef, useState, type ReactNode } from "react";
import usePinnedPane from "./usePinnedPane";
import CurtainLink from "./CurtainLink";
import { HOME_FINAL_PARAM, HOME_FINAL_VALUE } from "./homeSections";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where every category's Back goes: the homepage's own final state, with
 *  the three category links on it. */
export const HOME_FINAL_HREF = `/?${HOME_FINAL_PARAM}=${HOME_FINAL_VALUE}`;

export default function CategoryStage({
  lengthVh,
  children,
  showBack = true,
}: {
  /** This category's scroll length, in viewport heights. */
  lengthVh: number;
  children: (progress: number) => ReactNode;
  /** False where the category draws its own way home (the gallery does). */
  showBack?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  usePinnedPane(trackRef, paneRef);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = trackRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        setProgress(total > 0 ? clamp01(-rect.top / total) : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={trackRef}
      data-track="category"
      style={{ height: `${lengthVh}vh`, position: "relative", zIndex: 1 }}
    >
      <div
        ref={paneRef}
        data-pane="category"
        style={{
          height: "100vh",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          background: "#000",
        }}
      >
        {children(progress)}

        {showBack && (
          // On screen for the whole category, the end of it included —
          // which is the one place the old model offered nothing but the
          // next section.
          // A plain anchor, deliberately, not next/link. A category route
          // is a WebGL context, a pinned ScrollTrigger and a per-frame
          // clock; so is the homepage. Handing between them as a client
          // transition leaves one page's pins and contexts alive under the
          // other's — measured as a 900vh track laying out at 800px after
          // the hand-off, and as navigations that intermittently never
          // completed at all. A document navigation tears the old page
          // down completely, which is what isolation means here.
          <CurtainLink href={HOME_FINAL_HREF} style={backStyle}>
            <span aria-hidden>←</span> Back
          </CurtainLink>
        )}
      </div>
    </div>
  );
}

export const backStyle: React.CSSProperties = {
  position: "absolute",
  top: "clamp(18px, 3.5vh, 34px)",
  left: "clamp(18px, 4vw, 48px)",
  zIndex: 40,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
  textDecoration: "none",
  textShadow: "0 1px 10px rgba(0,0,0,0.85)",
};
