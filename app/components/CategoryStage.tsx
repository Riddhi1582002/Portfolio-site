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
import TransitionLink from "./TransitionLink";
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
  startProgress = 0,
}: {
  /** This category's scroll length, in viewport heights. */
  lengthVh: number;
  children: (progress: number) => ReactNode;
  /** False where the category draws its own way home (the gallery does). */
  showBack?: boolean;
  /**
   * WHERE THE CATEGORY OPENS, as a share of its own track.
   *
   * Not every beat begins at its own progress 0. Graphic Design's track
   * starts with the cord descending and the bulb arriving, which is a
   * hand-off from the beat that used to precede it on the homepage — as a
   * destination in its own right, it should open ON the carousel of cards
   * around the bulb, which is what the link is for. The whole track is
   * still there to scroll back through; this only decides where the
   * reader is put down.
   */
  startProgress?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  usePinnedPane(trackRef, paneRef);

  // OPENING POSITION. After layout, and after ScrollTrigger has measured
  // the pin, so the track's full height exists before a share of it means
  // anything. Instant, never eased: easing here would scrub the whole
  // lead-in on the way past, which is the replay this is avoiding.
  useEffect(() => {
    if (startProgress <= 0) return;
    let raf = 0;
    const place = () => {
      const el = trackRef.current;
      if (!el) return;
      const total = el.scrollHeight - window.innerHeight;
      if (total <= 0) {
        raf = requestAnimationFrame(place);
        return;
      }
      window.scrollTo(0, Math.round(total * startProgress));
    };
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(place);
    });
    return () => cancelAnimationFrame(raf);
  }, [startProgress]);

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
          <TransitionLink href={HOME_FINAL_HREF} style={backStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
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
