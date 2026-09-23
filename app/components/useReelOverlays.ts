"use client";

// THE REELS OVERLAYS, IN ONE PLACE.
//
// A reel card opens a project index, and a project index opens the
// immersive viewer — a small state machine plus one scroll-freeze, which
// used to live inside HeroSection because the strip only ever existed
// there. VIDEO now also has a route of its own, and the two have to behave
// identically: the same single-video shortcut, the same prev/next
// bookkeeping, the same rule about which wheel events the page is allowed
// to see. Two copies of that would have drifted, so there is one.

import { useCallback, useEffect, useState } from "react";
import { REELS } from "./ReelStrip";

export default function useReelOverlays() {
  // Which REELS project is open in the full-screen project index, if any —
  // an index into REELS, not a copy of the reel itself, so prev/next just
  // moves this number. `selectedVideo` is lifted up here (rather than
  // living inside ReelProjectView) so the project index and the immersive
  // viewer always agree on which video is current, in both directions:
  // WATCH hands the viewer whatever was selected, and Prev/Next Video
  // inside the viewer is reflected back the moment BACK returns.
  const [reelOpenIndex, setReelOpenIndex] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState(0);
  // Which reel the immersive viewer is showing, if any. Independent of
  // `reelOpenIndex`: a single-video project jumps straight here without
  // the project index ever opening.
  const [viewerReelIndex, setViewerReelIndex] = useState<number | null>(null);

  const closeReel = useCallback(() => setReelOpenIndex(null), []);
  const openReel = useCallback((id: string) => {
    const idx = REELS.findIndex((r) => r.id === id);
    if (idx === -1) return;
    setSelectedVideo(0);
    const reel = REELS[idx];
    if (reel.videos && reel.videos.length === 1) {
      // Single-video project: the project index would have nothing to add
      // over the card itself, so skip straight to the viewer.
      setViewerReelIndex(idx);
    } else {
      setReelOpenIndex(idx);
    }
  }, []);
  const navigateReel = useCallback((idx: number) => {
    setSelectedVideo(0);
    setReelOpenIndex(idx);
  }, []);
  const watchVideo = useCallback(() => {
    setViewerReelIndex(reelOpenIndex);
  }, [reelOpenIndex]);
  const closeViewer = useCallback(() => setViewerReelIndex(null), []);

  // Freeze the underlying scroll-driven pane while the project view or the
  // immersive viewer is open: the strip lives on a continuous
  // ScrollSmoother-driven pane, so an un-intercepted wheel/touch would keep
  // advancing its progress behind the overlay and land somewhere else in
  // the strip on close.
  useEffect(() => {
    if (reelOpenIndex == null && viewerReelIndex == null) return;
    // The project index itself is allowed to scroll — a long description
    // paired with a full thumbnail index can genuinely be taller than one
    // screen, and this same effect otherwise swallows every wheel/touch
    // event on the page, the panel's own included, which would make that
    // overflow unreachable rather than merely offscreen. Only events
    // outside it need blocking, to keep the pane underneath from advancing.
    //
    // Stepping aside for the panel has to be conditional on the panel
    // actually having somewhere to go, not merely on the event landing
    // inside it. `overscroll-behavior: contain` is the usual guard against
    // the leftover scroll chaining out to the page, but it only applies to
    // elements that ARE scroll containers: with DETAILS closed the panel is
    // exactly one viewport tall, scrollHeight === clientHeight, so it is
    // not a scroll container at all and the browser hands the event
    // straight to the page — which here is the whole sequence's playhead.
    // So the check is "can this panel consume this scroll, in this
    // direction, right now": if it can, it keeps the event; if it can't,
    // the event is blocked here rather than chaining.
    const roomFor = (panel: Element, deltaY: number) => {
      const scrollable = panel.scrollHeight - panel.clientHeight;
      if (scrollable <= 1) return false;
      // No delta to read (touchmove): the panel having any scroll of its
      // own is enough — overscroll-behavior handles the boundary once it
      // genuinely is a scroll container.
      if (deltaY === 0) return true;
      return deltaY > 0
        ? panel.scrollTop < scrollable - 1
        : panel.scrollTop > 1;
    };
    const block = (e: Event) => {
      const panel =
        e.target instanceof Element
          ? e.target.closest("[data-reel-modal-scroll]")
          : null;
      if (panel && roomFor(panel, e instanceof WheelEvent ? e.deltaY : 0)) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
    };
  }, [reelOpenIndex, viewerReelIndex]);

  return {
    reelOpenIndex,
    viewerReelIndex,
    selectedVideo,
    setSelectedVideo,
    openReel,
    closeReel,
    navigateReel,
    watchVideo,
    closeViewer,
  };
}
