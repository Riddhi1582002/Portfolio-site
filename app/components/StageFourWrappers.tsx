"use client";

// Client wrappers for the closing two sections. Same reason as the other
// wrappers on this page: PinnedSection takes a render prop, and a function
// cannot cross the server/client boundary from page.tsx.

import { useEffect, useState } from "react";
import PinnedSection from "./PinnedSection";
import PencilSection from "./PencilSection";
import InfiniteCanvas from "./InfiniteCanvas";

const SANS = "'Neue Montreal', system-ui, sans-serif";
// The narration beat, then the iris.
const PENCIL_VH = 420;
// A long stretch at rest for the reader to drag around in, then the
// flight home.
const CANVAS_VH = 500;

function useViewport() {
  const [v, setV] = useState({ vw: 1440, vh: 900 });
  useEffect(() => {
    const read = () => setV({ vw: window.innerWidth, vh: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return v;
}

export function PencilSectionWrapper() {
  const { vw, vh } = useViewport();
  return (
    <PinnedSection lengthVh={PENCIL_VH} name="pencil">
      {(p) => <PencilSection progress={p} sans={SANS} vw={vw} vh={vh} />}
    </PinnedSection>
  );
}

export function CanvasSectionWrapper() {
  const { vw, vh } = useViewport();
  return (
    <PinnedSection lengthVh={CANVAS_VH} name="canvas">
      {(p) => <InfiniteCanvas progress={p} sans={SANS} vw={vw} vh={vh} />}
    </PinnedSection>
  );
}
