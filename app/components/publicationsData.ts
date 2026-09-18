// THE PUBLICATIONS' OWN DATA — plain, no "use client".
//
// Split out of PublicationsIndexDisplay.tsx (which re-exports these two
// names for every existing import site) because a SERVER function —
// app/publications/[slug]/page.tsx's own generateStaticParams — needs the
// real array. A plain data module crosses that boundary cleanly; a "use
// client" one does not: importing INDEX_PUBLICATIONS from inside a client
// component module handed it a client-reference stub instead of the array
// itself, and `.map` on that stub is where this file exists to stop the
// TypeError.

import type { SpatialIndexObject } from "./SpatialIndexEngine";

export type IndexPublication = SpatialIndexObject & {
  title: string;
  /** The one real, non-invented fact available about each file: what kind
   *  of document it is, taken from the asset's own filename. */
  medium: string;
};

const D = Math.PI / 180;

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
