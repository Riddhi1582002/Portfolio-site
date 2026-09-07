"use client";

// Pin a 100vh pane for the length of its track, using ScrollTrigger rather
// than `position: sticky`.
//
// Sticky is the obvious way to do this and it worked — until ScrollSmoother
// went in. ScrollSmoother translates #smooth-content, and a sticky element
// does not survive inside a transformed container: measured at scrollY 4000
// the hero's pane sat at top:-4000 instead of 0, i.e. every pinned beat
// simply scrolled away. ScrollTrigger's own pinning is transform-based and
// composes with it, so the mechanism changes and nothing else does.
//
// pinSpacing is FALSE on purpose. The track already carries the full scroll
// length; letting ScrollTrigger add its own spacer on top would lengthen
// every section by a viewport and move every beat. With it off, the
// document's height and each beat's scroll position are exactly what they
// were with sticky.

import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function usePinnedPane(
  trackRef: RefObject<HTMLDivElement | null>,
  paneRef: RefObject<HTMLDivElement | null>
) {
  useLayoutEffect(() => {
    const track = trackRef.current;
    const pane = paneRef.current;
    if (!track || !pane) return;

    gsap.registerPlugin(ScrollTrigger);

    const st = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      pin: pane,
      pinSpacing: false,
      // The beats read their own progress off the track's rect, exactly as
      // they did under sticky; this trigger only holds the pane.
      //
      // NO anticipatePin: it engages the pin a fraction early to hide the
      // flash on fast scrolls, and that fraction is a real offset in every
      // beat's progress — it showed up as the strip sitting a couple of
      // hundred pixels off where sticky had put it at the same scrollY.
      invalidateOnRefresh: true,
    });

    return () => st.kill();
  }, [trackRef, paneRef]);
}
