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

// A WIDE EDITORIAL PRODUCT DISPLAY, not a stacked still life: five
// publications standing across a horizontal floor, left to right Policy,
// Employee Handbook, Sneh Sagar, ExcelEDGE, Mining — Sneh Sagar centred, a
// step forward and clearly the hero, the other four close to one another in
// scale and spaced far enough apart to each be read on its own.
//
// EVERY `pos[1]` IS DERIVED, NOT CHOSEN: it is the groundline
// (SpatialIndexOptions.floorY) plus that object's own half-height at its
// own scale, so each piece's base sits exactly ON the floor. Authored by
// eye instead, all five floated — between a third and a full unit clear of
// the plane they were supposed to be standing on — which is precisely what
// makes an arrangement read as a floating gallery rather than a staged one.
// Changing a `scale` here therefore means recomputing its `pos[1]`.
//
// DEPTH CARRIES THE STAGGER. The bases share one groundline, so a piece
// set further back sits HIGHER on screen; that, not five different heights,
// is where the reference's stepped look comes from. Back to front: Policy,
// the Handbook, ExcelEDGE, Mining, Sneh Sagar.
//
// `narrow` is a genuinely different, more vertically stacked arrangement
// for portrait screens rather than a scaled-down copy of `wide` — see the
// file banner on why that matters.
export const INDEX_PUBLICATIONS: IndexPublication[] = [
  {
    id: "sneh-sagar",
    title: "Sneh Sagar",
    medium: "Book",
    emphasis: 1,
    wide: { scale: 1.1, pos: [-0.08, 0.23, 0.5], rot: [-3 * D, 6 * D, -2 * D] },
    narrow: { scale: 0.72, pos: [0.0, -0.17, 0.8], rot: [-3 * D, 5 * D, -2 * D] },
  },
  {
    id: "excledge",
    title: "Excel Edge - Company Newsletter",
    medium: "Newsletter",
    emphasis: 0.75,
    wide: { scale: 0.613, pos: [2.2, -0.336, -0.35], rot: [-2 * D, -14 * D, 2.5 * D] },
    narrow: { scale: 0.63, pos: [0.74, -0.3185, -2.0], rot: [-2 * D, -9 * D, 2.5 * D] },
  },
  {
    id: "mining",
    title: "Company brochures",
    medium: "Booklet",
    emphasis: 0.5,
    wide: { scale: 0.754, pos: [3.36, -0.226, -0.18], rot: [-4 * D, -18 * D, -5 * D] },
    narrow: { scale: 0.62, pos: [0.62, -0.36, -3.6], rot: [-4 * D, -13 * D, -5 * D] },
  },
  {
    id: "handbook",
    title: "Employee Handbook",
    medium: "Handbook",
    emphasis: 0.4,
    wide: { scale: 0.669, pos: [-2.12, -0.244, -0.7], rot: [-4 * D, 15 * D, 4 * D] },
    narrow: { scale: 0.66, pos: [-0.72, -0.254, -2.0], rot: [-4 * D, 13 * D, 4 * D] },
  },
  {
    id: "policy",
    title: "Policy documents",
    medium: "Policy Document",
    emphasis: 0.3,
    // Far left of the display and the furthest back of the five, so its
    // base sits highest on screen — see the file banner on depth.
    wide: { scale: 0.706, pos: [-3.42, -0.309, -1.2], rot: [-5 * D, 20 * D, -2.5 * D] },
    narrow: { scale: 0.66, pos: [-0.6, -0.353, -3.6], rot: [-5 * D, 10 * D, -2.5 * D] },
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
