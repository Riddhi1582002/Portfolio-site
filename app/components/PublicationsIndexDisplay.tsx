"use client";

// THE PUBLICATIONS INDEX — the five publications as one large, spatial
// arrangement that IS the navigation. No UI cards: the physical objects
// themselves are what a reader points at and clicks.
//
// Loading, materials and the lighting philosophy are reused wholesale from
// the Publications card (see PublicationsDisplay.tsx) — same module-scope
// GLTFLoader/cache (so a reader who has already seen the card pays nothing
// to load this page, and one who lands here first warms the card for free),
// same three-light "lit display case" rig, same ACES tone mapping.
//
// The arrangement/hover/recede/focus ENGINE itself is not Publications'
// own — see SpatialIndexEngine, which owns raycasting, the composition
// arrival, the recede-while-something-else-is-active response and the
// click focus transition, generically. This file supplies only the data a
// future category would also supply: which five objects, where they sit
// (wide and narrow), how strongly each answers hover, and — Publications-
// specific — a title/medium pair for the plain-text index beside it.
//
// Each publication's own material is CLONED before it enters this page's
// scene — done inside the engine, since dimming a non-active object by
// mutating `material.opacity` would otherwise bleed into the cached root
// the card's own instances clone from.

import { useEffect, useRef } from "react";
import { PUBLICATIONS as CARD_PUBLICATIONS, loadRoot, getLoader } from "./PublicationsDisplay";
import { mountSpatialIndex } from "./SpatialIndexEngine";
// The DATA — which five objects, where they sit, title/medium — lives in a
// plain (non "use client") module so a server function (see
// app/publications/[slug]/page.tsx's generateStaticParams) can import the
// real array rather than a client-component stub. Re-exported here so
// every existing import site (PublicationsIndexView chief among them)
// keeps working unchanged.
import { INDEX_PUBLICATIONS, type IndexPublication } from "./publicationsData";

export { INDEX_PUBLICATIONS, type IndexPublication };

export const FOCUS_MS = 520;

export default function PublicationsIndexDisplay({
  hoveredId,
  onHoverObject,
  selectedId,
  onSelectObject,
  onFocusComplete,
  onActiveScreenPos,
  narrow,
}: {
  /** Externally hovered id (e.g. from the text index), or null. Read every
   *  frame via a ref so this component never re-renders on hover changes. */
  hoveredId: string | null;
  /** Reported up when the raycaster itself finds (or loses) a hovered
   *  object, so the text index can highlight in return. */
  onHoverObject: (id: string | null) => void;
  selectedId: string | null;
  onSelectObject: (id: string) => void;
  /** Fired once, when the click-focus transition for `selectedId` finishes
   *  easing in — the navigation/transition hook this pass builds, ready to
   *  be wired to a real destination once each publication has one. */
  onFocusComplete: (id: string) => void;
  /** Screen-space position of the currently active (hovered ?? selected)
   *  object's anchor point, for the metadata label — null when nothing is
   *  active. Only called when the position actually moves or the id
   *  changes, never every frame. */
  onActiveScreenPos: (pos: { x: number; y: number } | null) => void;
  narrow: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hoveredIdRef = useRef(hoveredId);
  const selectedIdRef = useRef(selectedId);
  const narrowRef = useRef(narrow);
  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    narrowRef.current = narrow;
  }, [narrow]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    const cardSpecById = new Map(CARD_PUBLICATIONS.map((p) => [p.id, p]));

    (async () => {
      const { THREE } = await getLoader();
      if (disposed) return;
      cleanup = mountSpatialIndex(
        host,
        THREE,
        INDEX_PUBLICATIONS,
        (pub) => {
          const cardSpec = cardSpecById.get(pub.id);
          if (!cardSpec) return Promise.resolve(new THREE.Group());
          return loadRoot(cardSpec);
        },
        {
          onHoverObject,
          onSelectObject,
          onFocusComplete,
          onActiveScreenPos,
          // The page's own text index is fixed to the bottom-left of the
          // viewport, so on short or narrow screens the composition would
          // otherwise grow straight through it. Read live rather than
          // captured: the list reflows with the viewport.
          getAvoidRect: () => {
            const nav = document.querySelector('nav[aria-label="Publications"]');
            if (!nav) return null;
            const r = nav.getBoundingClientRect();
            return { top: r.top, left: r.left, right: r.right };
          },
        },
        { hoveredIdRef, selectedIdRef, narrowRef },
        // Closer than the engine's own default: at that distance the group
        // read as a small cluster adrift in a mostly-empty viewport. This is
        // the same "camera does the work, not per-object scale" adjustment
        // as the card's own — see PublicationsDisplay's CAM_Z.
        { focusMs: FOCUS_MS, camZ: 9.4, camY: 2.1, camNear: 5, camFar: 18 }
      );
    })().catch((err) => {
      console.error("PublicationsIndexDisplay:", err);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [onHoverObject, onSelectObject, onFocusComplete, onActiveScreenPos]);

  return <div ref={hostRef} data-publications-index style={{ width: "100%", height: "100%" }} />;
}
