"use client";

// ART, on its own route.
//
// The gallery is the unmodified InfiniteCanvas, rendered SETTLED rather
// than scrubbed: on the homepage its progress ran the pull-back out of
// the iris, which is a hand-off from the beat before it and has no
// meaning here. Held at 1 it opens exactly where the homepage's own ART
// link used to land — fully pulled back, armed, and drag-driven, which is
// how the gallery works from then on anyway. That also means this route
// has no scroll track at all: one viewport, and nothing underneath.
//
// The return gesture (a scroll up out of the field) still plays its full
// camera move; at the end of it, instead of resetting the page's scroll
// to the hero above, it navigates home — see onReturnHome.

import { useCallback, useEffect, useState } from "react";
import InfiniteCanvas from "./InfiniteCanvas";
import { HOME_FINAL_HREF, backStyle } from "./CategoryStage";

const SANS = "'Neue Montreal', system-ui, sans-serif";

export default function ArtCategoryView() {
  const [viewport, setViewport] = useState({ vw: 1440, vh: 900 });

  useEffect(() => {
    const read = () =>
      setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // A document navigation, for the reason CategoryStage's own Back gives.
  const goHome = useCallback(() => {
    window.location.assign(HOME_FINAL_HREF);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <InfiniteCanvas
        progress={1}
        sans={SANS}
        vw={viewport.vw}
        vh={viewport.vh}
        visible
        onReturnHome={goHome}
      />
      <a href={HOME_FINAL_HREF} style={backStyle}>
        <span aria-hidden>←</span> Back
      </a>
    </div>
  );
}
