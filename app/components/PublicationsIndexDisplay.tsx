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
import { mountSpatialIndex, type SpatialIndexObject } from "./SpatialIndexEngine";

const D = Math.PI / 180;

export type IndexPublication = SpatialIndexObject & {
  title: string;
  /** The one real, non-invented fact available about each file: what kind
   *  of document it is, taken from the asset's own filename. */
  medium: string;
};

// Asymmetric, compact, with real overlap — not a grid. The group sits right
// of centre on a wide frame (the title and index text occupy the left third
// of the page, see PublicationsIndexView), with Sneh Sagar dominant and
// forward, ExcelEDGE clearly second, and Mining/Handbook/Policy receding in
// both scale and depth behind them. `narrow` is a genuinely different,
// more vertically stacked arrangement for portrait screens rather than a
// scaled-down copy of `wide` — see the file banner on why that matters.
export const INDEX_PUBLICATIONS: IndexPublication[] = [
  {
    id: "sneh-sagar",
    title: "Sneh Sagar",
    medium: "Book",
    emphasis: 1,
    wide: { scale: 1.55, pos: [0.5, -0.05, 0.55], rot: [-3 * D, 6 * D, -2 * D] },
    narrow: { scale: 1.1, pos: [-0.05, -0.6, 0.55], rot: [-3 * D, 5 * D, -2 * D] },
  },
  {
    id: "excledge",
    title: "Excel Edge - Company Newsletter",
    medium: "Newsletter",
    emphasis: 0.75,
    wide: { scale: 1.05, pos: [2.05, -0.15, 0.5], rot: [-2 * D, -11 * D, 2.5 * D] },
    narrow: { scale: 0.85, pos: [1.15, -1.0, 0.0], rot: [-2 * D, -9 * D, 2.5 * D] },
  },
  {
    id: "mining",
    title: "Company brochures",
    medium: "Booklet",
    emphasis: 0.5,
    wide: { scale: 0.95, pos: [-1.9, 0.7, -0.75], rot: [-4 * D, 16 * D, -5 * D] },
    narrow: { scale: 0.85, pos: [-1.5, 0.5, -0.35], rot: [-4 * D, 13 * D, -5 * D] },
  },
  {
    id: "handbook",
    title: "Employee Handbook",
    medium: "Handbook",
    emphasis: 0.4,
    wide: { scale: 0.7, pos: [3.3, 0.55, -1.0], rot: [-4 * D, -16 * D, 4 * D] },
    narrow: { scale: 0.6, pos: [1.5, 1.0, -0.6], rot: [-4 * D, -13 * D, 4 * D] },
  },
  {
    id: "policy",
    title: "Policy documents",
    medium: "Policy Document",
    emphasis: 0.3,
    // Lower-left and forward, not stacked behind the hero: buried
    // upper-back (its original placement) put it entirely behind Sneh
    // Sagar from this camera angle, so it never actually read as a fifth
    // object — smallest still, but visible, is the point.
    wide: { scale: 0.65, pos: [-1.15, -1.3, 0.9], rot: [-5 * D, 12 * D, -2.5 * D] },
    narrow: { scale: 0.5, pos: [-1.15, -1.55, 0.7], rot: [-5 * D, 10 * D, -2.5 * D] },
  },
];

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
        { onHoverObject, onSelectObject, onFocusComplete, onActiveScreenPos },
        { hoveredIdRef, selectedIdRef, narrowRef },
        { focusMs: FOCUS_MS }
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
