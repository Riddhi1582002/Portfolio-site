"use client";

// THE GALLERY, and the way home.
//
// The model is three layers, and only one of them ever moves:
//
//   1. A FIXED rounded viewport. It is a window cut in the black, with
//      overflow hidden. It never pans, never scales, never rotates.
//   2. FIXED "ART", on that window's own layer, behind the work. It sits
//      at one screen position for the whole beat — the position the hero
//      wordmark occupies on page one — and stays there while the work
//      slides over it, covering and revealing it.
//   3. ONE MOVING COMPOSITION. Every image is a child of a single plane.
//      Dragging translates that plane and nothing else, so the images
//      keep their relative positions exactly and the window stays put.
//
// There is no camera pan, no scene move, no masonry, no grid, no carousel
// and no per-card dragging. The composition is authored by hand, in cell
// coordinates, with an intentional irregular arrangement and a deliberate
// clear space at its middle (see GAP) that the return transition flies
// through.
//
// "Infinite" is a real wrap, not a very large plane: the work lives in one
// CELL, and only as many copies of that cell as the window can actually
// see are drawn around wherever the pan currently is. The pan offset is
// taken modulo the cell before it is applied, so the plane can be dragged
// forever in any direction and the images are always there — no edges, no
// bounds, and a handful of cells' worth of DOM however far the reader
// travels.
//
// Clicking an image (a click, not a drag) expands it in place: the card
// grows from the exact box it occupied in the composition to a focused
// card at the middle of the window, with the rest of the gallery still
// visible behind it, its medium/details now always showing over the same
// bottom gradient the grid card reveals on hover — no flip, no back face,
// no separate panel. Closing sends it back to the box it came from.
//
// Scrolling DOWN out of the settled gallery — past the natural end of the
// page's own scroll track — does not do nothing and does not reverse the
// page. It runs a dedicated return transition: scrolling is locked, the
// gesture drives the camera forward through the gap between the images
// toward the ART that was always there, and only once that has visually
// arrived is the page's own scroll position reset to the top.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ART_FONT,
  ART_FONT_SIZE,
  ART_Y_REST,
  GLOW_STRENGTH,
  STAGE_H,
  STAGE_W,
  glowShadow,
} from "./HeroSection";
import { BULB_GLASS_RATIO, bulbSizePx } from "./CordSection";
import { carry } from "../lib/motion";
import { cutMothContinuity, setMothReturnDolly } from "./mothStage";
import HoverCard from "./HoverCard";

// One repeating cell of the composition, in canvas px.
//
// A genuine scatter, not a grid and not masonry: every piece is placed at a
// randomised (but fixed — generated once, not at runtime) position, sized
// from its OWN aspect ratio (see Piece), with mediums interleaved through
// the placement order and a spatial repulsion that keeps same-medium
// pieces from clustering — so the mix reads as random throughout rather
// than in bands. One deliberately empty rectangle is reserved up front
// (see GAP) — the clear space the return transition flies through — and
// no piece is placed inside it.
const CELL_W = 2360;
const CELL_H = 4880.14;

/**
 * One artwork in the composition.
 *
 * w and h come from the image's OWN aspect ratio — the LONGER edge is
 * given a substantial, comparable-across-pieces length and the shorter
 * edge simply follows the real ratio, so a wide landscape photo and a
 * tall portrait sketch both read as "substantial" and neither dimension
 * is ever a function of the source image's raw pixel resolution. `medium`
 * is the artwork's folder name from
 * the supplied archive (verbatim, except one explicit rename — see the
 * generator); `details`, when supplied, is the only other text a card
 * ever shows, and only in the hover/focused info gradient (see ArtCard).
 */
export type Piece = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  medium: string;
  src: string;
  details?: string;
};

// The composition. Generated once (a fixed random seed, so the mix is
// stable across builds rather than reshuffling) from every artwork in the
// supplied archive: a genuine scatter, not rows or columns — varied x/y,
// varied spacing, mixed orientations and aspect ratios, with mediums
// interleaved throughout (never grouped) via a placement order that
// alternates mediums plus a spatial check that prefers the candidate spot
// farthest from the nearest same-medium piece. One rectangle is left
// reserved and empty (see GAP), the clear space the return transition
// flies through.
export const PIECES: Piece[] = [
  { id: "graphite-or-charcoal-polish-20250804-080226299", x: 566.05, y: 4336.9, w: 286.84, h: 411.94, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20250804-080226299.jpg" },
  { id: "acrylics-polish-20231227-171248659", x: 355.35, y: 2174.36, w: 257.46, h: 386.8, medium: "Acrylics", src: "/art/acrylics/polish-20231227-171248659.jpg" },
  { id: "graphite-or-charcoal-img-20260913-222910", x: 1913.19, y: 62.05, w: 310.89, h: 255.51, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/img-20260913-222910.jpg" },
  { id: "pen-art-img-20260913-223239", x: 1997.02, y: 4246.21, w: 236.64, h: 420.69, medium: "Pen art", src: "/art/pen-art/img-20260913-223239.jpg" },
  { id: "graphite-or-charcoal-white-charcoal-on-black-paper-01", x: 41.86, y: 1751.31, w: 230.7, h: 348.41, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/white-charcoal-on-black-paper-01.jpg" },
  { id: "acrylics-img-20260913-222957", x: 1563.1, y: 4469.8, w: 353.6, h: 353.6, medium: "Acrylics", src: "/art/acrylics/img-20260913-222957.jpg" },
  { id: "graphite-or-charcoal-polish-20230319-190520609", x: 2066.22, y: 2668.8, w: 212.64, h: 306.44, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20230319-190520609.jpg" },
  { id: "pen-art-img20251002222430", x: 64.63, y: 46.87, w: 165.6, h: 294.4, medium: "Pen art", src: "/art/pen-art/img20251002222430.jpg" },
  { id: "graphite-or-charcoal-polish-20221223-133936965", x: 311.18, y: 75.38, w: 201.3, h: 262.1, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20221223-133936965.png" },
  { id: "acrylics-img-20230722-wa0022", x: 1908.87, y: 388.19, w: 323.23, h: 242.42, medium: "Acrylics", src: "/art/acrylics/img-20230722-wa0022.jpg" },
  { id: "graphite-or-charcoal-polish-20210628-221612042", x: 1351.95, y: 1320.6, w: 394.02, h: 404.9, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20210628-221612042.jpg" },
  { id: "pen-art-img-20260515-080123", x: 2096.36, y: 1575.95, w: 178.82, h: 317.9, medium: "Pen art", src: "/art/pen-art/img-20260515-080123.jpg" },
  { id: "graphite-or-charcoal-a-study-of-eyes-03", x: 723.76, y: 3053.49, w: 287.96, h: 287.96, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/a-study-of-eyes-03.jpg" },
  { id: "acrylics-img-20260913-222931", x: 202.47, y: 396.8, w: 363.15, h: 371.74, medium: "Acrylics", src: "/art/acrylics/img-20260913-222931.jpg" },
  { id: "graphite-or-charcoal-polish-20220306-185610949", x: 1910.75, y: 3872.17, w: 257.4, h: 334.76, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20220306-185610949.jpg" },
  { id: "pen-art-img20260521224939", x: 40.97, y: 2963.33, w: 141.2, h: 251.01, medium: "Pen art", src: "/art/pen-art/img20260521224939.jpg" },
  { id: "graphite-or-charcoal-polish-20240229-171648866", x: 1058.39, y: 434.07, w: 411.05, h: 410.5, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20240229-171648866.jpg" },
  { id: "acrylics-polish-20240223-203111938", x: 2091.9, y: 2167.31, w: 225.53, h: 364.99, medium: "Acrylics", src: "/art/acrylics/polish-20240223-203111938.jpg" },
  { id: "graphite-or-charcoal-polish-20220930-104029798", x: 403.3, y: 925.51, w: 225.8, h: 333.05, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20220930-104029798.jpg" },
  { id: "pen-art-img20260426194737", x: 152.42, y: 4471.96, w: 194.41, h: 345.61, medium: "Pen art", src: "/art/pen-art/img20260426194737.jpg" },
  { id: "graphite-or-charcoal-img-20200423-wa0029", x: 1038.27, y: 3754.69, w: 390.88, h: 394.38, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/img-20200423-wa0029.jpg" },
  { id: "acrylics-img-20230930-175316648", x: 39.23, y: 3843.59, w: 272.35, h: 363.13, medium: "Acrylics", src: "/art/acrylics/img-20230930-175316648.jpg" },
  { id: "graphite-or-charcoal-polish-20230525-170545329", x: 1873.84, y: 812.05, w: 348.62, h: 273.63, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20230525-170545329.jpg" },
  { id: "digital-art-img-20241201-wa0012", x: 1213.26, y: 54.73, w: 281.3, h: 281.3, medium: "Digital art", src: "/art/digital-art/img-20241201-wa0012.jpg" },
  { id: "graphite-or-charcoal-img-20260531-221408", x: 834.45, y: 1833.23, w: 242.04, h: 263.12, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/img-20260531-221408.jpg" },
  { id: "oils-polish-20210710-135759049", x: 625.85, y: 1408.48, w: 227.05, h: 330.88, medium: "Oils", src: "/art/oils/polish-20210710-135759049.jpg" },
  { id: "graphite-or-charcoal-polish-20220910-185630205", x: 108.8, y: 3445.97, w: 247.06, h: 329.52, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20220910-185630205.jpg" },
  { id: "pen-art-img-20260509-212939", x: 1663.35, y: 92.2, w: 139.03, h: 247.16, medium: "Pen art", src: "/art/pen-art/img-20260509-212939.jpg" },
  { id: "graphite-or-charcoal-polish-20240630-193813326", x: 1454.05, y: 2184.82, w: 299.9, h: 285.85, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20240630-193813326.jpg" },
  { id: "acrylics-img-20260913-223908", x: 1161.61, y: 3180.31, w: 386.01, h: 386.01, medium: "Acrylics", src: "/art/acrylics/img-20260913-223908.jpg" },
  { id: "graphite-or-charcoal-polish-20221218-221302894", x: 1607.46, y: 3219.13, w: 334.62, h: 393.93, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20221218-221302894.png" },
  { id: "digital-art-polish-20250917-004912519", x: 1123.35, y: 4570.65, w: 206.98, h: 275.97, medium: "Digital art", src: "/art/digital-art/polish-20250917-004912519.jpg" },
  { id: "graphite-or-charcoal-polish-20250208-133015864", x: 219.02, y: 2637.68, w: 237.81, h: 316.97, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20250208-133015864.jpg" },
  { id: "oils-taylor-swift", x: 1528.06, y: 4077.97, w: 263.64, h: 311.48, medium: "Oils", src: "/art/oils/taylor-swift.jpg" },
  { id: "graphite-or-charcoal-polish-20240405-150241593", x: 1248.24, y: 2726.16, w: 240.42, h: 361.08, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20240405-150241593.jpg" },
  { id: "pen-art-img-20260913-223103", x: 315.68, y: 1552.83, w: 239.1, h: 373.86, medium: "Pen art", src: "/art/pen-art/img-20260913-223103.jpg" },
  { id: "graphite-or-charcoal-polish-20260626-171824274", x: 553.83, y: 3869.93, w: 215.16, h: 268.95, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20260626-171824274.jpg" },
  { id: "acrylics-img-20260913-223809", x: 966.01, y: 1126.29, w: 402.93, h: 152.89, medium: "Acrylics", src: "/art/acrylics/img-20260913-223809.jpg" },
  { id: "graphite-or-charcoal-polish-20230129-170653977", x: 639.87, y: 383.97, w: 256.01, h: 341.35, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20230129-170653977.jpg" },
  { id: "digital-art-ice-heart", x: 519.77, y: 2608.94, w: 305.75, h: 382.19, medium: "Digital art", src: "/art/digital-art/ice-heart.jpg" },
  { id: "graphite-or-charcoal-trs-9968", x: 894.97, y: 1329.1, w: 293.97, h: 410.12, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/trs-9968.jpg" },
  { id: "oils-polish-20210626-213830980", x: 248.02, y: 3052.09, w: 218.85, h: 309.24, medium: "Oils", src: "/art/oils/polish-20210626-213830980.jpg" },
  { id: "pen-art-img20260512233009", x: 1542.98, y: 2872.13, w: 151.15, h: 268.71, medium: "Pen art", src: "/art/pen-art/img20260512233009.jpg" },
  { id: "soft-pastels-polish-20210327-172832632", x: 668.9, y: 784.8, w: 233.46, h: 334.62, medium: "Soft pastels", src: "/art/soft-pastels/polish-20210327-172832632.jpg" },
  { id: "acrylics-triplets", x: 1220.18, y: 1891.02, w: 400.48, h: 225.27, medium: "Acrylics", src: "/art/acrylics/triplets.jpg" },
  { id: "digital-art-img-20241207-wa0078", x: 1956.81, y: 1142.9, w: 368.85, h: 368.85, medium: "Digital art", src: "/art/digital-art/img-20241207-wa0078.jpg" },
  { id: "graphite-or-charcoal-trs-8286", x: 1098.27, y: 4255.24, w: 383.84, h: 255.39, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/trs-8286.jpg" },
  { id: "oils-polish-20240709-124250793", x: 1745.25, y: 2767.44, w: 285.43, h: 408.12, medium: "Oils", src: "/art/oils/polish-20240709-124250793.jpg" },
  { id: "pen-art-img-20260913-223141", x: 1527.03, y: 833.33, w: 221.33, h: 393.43, medium: "Pen art", src: "/art/pen-art/img-20260913-223141.jpg" },
  { id: "soft-pastels-polish-20210216-004049971", x: 2045.86, y: 3371.48, w: 243.98, h: 394.69, medium: "Soft pastels", src: "/art/soft-pastels/polish-20210216-004049971.jpg" },
  { id: "acrylics-tulips", x: 58.48, y: 1237.39, w: 194.49, h: 345.77, medium: "Acrylics", src: "/art/acrylics/tulips.jpg" },
  { id: "digital-art-img-20241220-wa0016", x: 2079.48, y: 3075.04, w: 128.34, h: 256.68, medium: "Digital art", src: "/art/digital-art/img-20241220-wa0016.jpg" },
  { id: "graphite-or-charcoal-polish-20230917-202038401-1", x: 465.43, y: 3400.81, w: 405.96, h: 417.05, medium: "Graphite/Charcoal", src: "/art/graphite-or-charcoal/polish-20230917-202038401-1.jpg" },
  { id: "oils-img-20260913-223823", x: 623.95, y: 31.24, w: 263.7, h: 107.28, medium: "Oils", src: "/art/oils/img-20260913-223823.jpg" },
  { id: "pen-art-img-20260913-223204", x: 1464.85, y: 3787.47, w: 139.27, h: 247.5, medium: "Pen art", src: "/art/pen-art/img-20260913-223204.jpg" },
  { id: "soft-pastels-polish-20210409-110947181", x: 75.23, y: 2283.04, w: 228.89, h: 314.37, medium: "Soft pastels", src: "/art/soft-pastels/polish-20210409-110947181.jpg" },
];

// The centre of the reserved rectangle no piece was placed inside — the
// space the return transition flies through.
const GAP = { x: 1180.0, y: 2440.07 };


// THE piece the iris sits on: the white circle the previous beat leaves the
// frame on is the pupil painted on this card, and the zoom out starts
// hard against it. PencilSection draws its last frame from the same
// numbers, so the swap between the two is geometry, not a cross-fade.
// TRS_8286 (an eye study) is the supplied artwork for this role.
const IRIS_PIECE_ID = "graphite-or-charcoal-trs-8286";
// THE IRIS'S ACTUAL GEOMETRY, measured directly off trs-8286.jpg (1800x1198):
// the drawn iris (the textured coloured disc around the pupil, limbus to
// limbus) sits at pixel centre (882, 605) with radius 158 — a circle
// visually fit against the source file, not assumed. This used to be
// IRIS_RATIO = 0.78, a guess close to three times too large, which is
// exactly why the hand-off circle read as "random" rather than seamless:
// the ring drawn at that size enclosed the whole eye (lashes and all)
// instead of tracing the iris itself, and the card was under-zoomed to
// match, so the SIZE was wrong even though the ring happened to sit near
// the card's centre.
/** The iris's diameter as a share of its card's height (316 / 1198). */
const IRIS_RATIO = 316 / 1198;
/** The iris's centre as a fraction of the card's own width/height — very
 *  close to (0.5, 0.5) but not exact, so kept explicit rather than assumed. */
const IRIS_CENTER_X_FRAC = 882 / 1800;
const IRIS_CENTER_Y_FRAC = 605 / 1198;
/** How much of the reveal the camera spends pulling back. */
const REVEAL_END = 0.5;

// ART's size in the settled gallery, as a share of the size page one
// gives it. The return transition multiplies it back out to exactly 1.
const ART_REST_RATIO = 0.28;
// Where the settled gallery starts listening for the return gesture, as a
// share of the section's progress. Well clear of the pull-back, so
// scrolling back up part-way through the reveal still simply reverses it.
const ARM_FROM = 0.8;
// How far the camera travels forward on the way home. Enough that the
// nearest image has passed the frame's corner at every viewport size the
// site is checked at — see the clearance table in the layout check: the
// worst case (2560x1440) needs 10.1x, and this leaves headroom.
const DOLLY_MAX = 18;
// Wheel pixels for the whole return. A trackpad flick is ~400-900px, so
// the move is one decisive gesture rather than a scrub — sized so a single
// firm flick (not a scrub) is enough to carry it, rather than needing two.
const RETURN_WHEEL_PX = 650;
const RETURN_TOUCH_PX = 370;
const RETURN_KEY_STEP = 0.22;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// THE PULL-BACK, and THE SETTLE THAT TAKES IT ON.
//
// The settle's own comment says the composition "keeps moving for a moment
// after the camera stops". It did not: easeOutCubic brought the pull-back
// to a dead halt, easeInOutCubic started the slide from another one, and
// between them the gallery was a still photograph. Two movements that were
// written to read as one, joined at zero.
//
// The pull-back now lands still drifting backwards, and the slide opens at
// the speed that drift is carrying, so the composition genuinely keeps
// going and only then comes to rest. Both still land on exactly 1 —
// revealScale reaches exactly 1 and the clear space still arrives exactly
// over ART.
const revealEase = carry(easeOutCubic, 0, 0.78);
const settleEase = carry(easeInOutCubic, 0.24, 1);

// THE FLIGHT HOME.
//
// `returnT` is already eased toward the gesture's target by the rAF loop
// below, which responds to a flick instantly. Running it through a plain
// easeInOutCubic threw that away: the composed curve leaves at zero speed,
// so the first part of every flick moved the camera by nothing at all and
// the gesture felt disconnected from the picture. Entered on the curve's
// shoulder instead, the camera is travelling on the frame the flick lands.
// It still arrives at exactly 1 — ART reaches exactly the hero's size and
// position there, which is what makes the handover to page one a no-op.
const camEase = carry(easeInOutCubic, 0.26, 0.9);
// A drag shorter than this is a click, not a pan.
const CLICK_SLOP_PX = 5;

// ── THE FIELD'S PHYSICS ────────────────────────────────────────────────
//
// One motion system, not two. The pan used to be written straight from the
// pointer during a drag and then handed to a separate friction loop on
// release, so the gesture had two regimes with a seam between them: rigid
// while the hand was down, coasting after. Both the Liquid Glass Carousel
// and the Codrops infinite slider are built the other way round — input
// moves a TARGET, and what is actually rendered is a follower easing
// toward it every frame. Everything then shares one curve: a drag has
// weight because the field trails the hand slightly, a release is the same
// motion continuing rather than a new animation starting, and the stop is
// the follower catching up rather than a timer expiring.
//
// Time constants, not per-frame factors: a `* 0.09` lerp is a different
// speed on a 60Hz and a 120Hz display. These are converted per frame with
// `1 - exp(-dt / TAU)`, which is frame-rate independent.
//
// A mouse gets weight; a finger does not. On a touch screen the content is
// under the finger, and any lag at all reads as the picture sticking to
// the glass rather than to the hand.
const FOLLOW_TAU_MOUSE = 95; // ms — the field's inertia behind a mouse drag
const FOLLOW_TAU_TOUCH = 38; // ms — a finger holds the picture almost 1:1
const FOLLOW_TAU_COAST = 120; // ms — heavier once the hand is off it
// Flick decay. Longer than the old 220ms half-life: the follower adds its
// own tail on top of this one, and the two together are what make a throw
// travel and then ease to nothing instead of stopping.
const FLICK_HALF_LIFE_MS = 340;
const FLICK_MIN_SPEED = 0.02; // canvas px/ms — below this there is no throw
const FLICK_MAX_SPEED = 3.2; // clamps an unrealistically fast flick

// ── DEPTH ─────────────────────────────────────────────────────────────
//
// Three bands, assigned by how large a piece is drawn: a bigger picture
// reads as nearer, so this is the distribution the composition already
// implies rather than a random one laid over it.
//
// What they do is LAG. Each band follows the pan on its own time constant,
// and what is rendered is the difference — so the far band trails while
// the field is moving and every band is at exactly zero offset once it
// settles. That matters twice over: the resting composition is the tuned
// one, pixel for pixel, and the offset is identical in every tiled copy of
// a cell, so the infinite wrap stays seamless. Parallax as a consequence
// of movement, the way it is when you actually move past things, not a
// static 3D scene.
const DEPTH_BANDS = 3;
// How far behind the field each band sits, expressed as the time it is
// behind: a band trailing by `tau` ms sits `v * tau` canvas px back while
// the field travels at `v`. At a brisk 1.4 canvas px/ms that is 17px for
// the mid band and 34px for the far one — depth you read, not a layer
// coming unstuck.
//
// Derived from the field's VELOCITY rather than run as a second follower
// per band. A follower's lag collapses when frames get long (the drive
// loop clamps dt so a stalled tab cannot teleport the field, and that
// clamp costs the follower most of its lag), which would quietly delete
// the parallax on exactly the low-end device where the rest of the motion
// is already suffering. Off velocity it is the same displacement at any
// frame rate, and it still settles to nothing because the velocity does.
const DEPTH_LAG_TAU = [0, 12, 24] as const;
// How quickly the parallax answers a change of speed. Not instant: this is
// what gives the bands their trailing, settling character instead of
// snapping to a new offset the moment the hand changes direction.
const DEPTH_VEL_TAU = 90; // ms
// And a ceiling, because v is not bounded by taste: a hard throw would put
// the far band sixty pixels off its neighbours and the composition would
// visibly shear. Applied as tanh rather than a clamp so it is linear where
// it matters and simply stops growing where it does not — no kink at the
// limit, which a hard clamp would show as the parallax hitting a wall.
const DEPTH_MAX_OFFSET = 26; // canvas px
// How much of that lag is spent, 0..1. Full parallax on a desktop-sized
// frame; a phone shows a third of the pieces at half the scale, and the
// same displacement there reads as the composition coming apart.
const DEPTH_GAIN_WIDE = 1;
const DEPTH_GAIN_NARROW = 0.45;

/** Which depth band a piece belongs to — largest third nearest. */
function depthBandFor(piece: Piece, sorted: number[]): number {
  const major = Math.max(piece.w, piece.h);
  const i = sorted.findIndex((m) => m <= major);
  const rank = i < 0 ? sorted.length - 1 : i;
  return Math.min(DEPTH_BANDS - 1, Math.floor((rank / sorted.length) * DEPTH_BANDS));
}

// How far the field spreads away from a piece that has been focused. The
// plane scales about the focused piece itself, so that piece does not move
// at all and everything else opens outward from it — the card is pulled
// forward OUT of the composition rather than just growing on top of it.
const FOCUS_DOLLY = 0.055;
const FOCUS_DOLLY_TAU = 150; // ms

// The field speed, in canvas px/ms, at which the HUD over the composition
// has receded as far as it goes. A deliberate pan sits well above this; a
// nudge does not move it much at all.
const FIELD_CALM_SPEED = 0.55;

// Every piece's major edge, largest first — the ranking `depthBandFor`
// reads to decide how near a piece sits. Computed once, off the same
// literal the layout is baked into, so the bands are stable across
// renders and identical in every tiled copy of the cell.
const MAJOR_EDGES_DESC = PIECES.map((p) => Math.max(p.w, p.h)).sort((a, b) => b - a);
/** The pieces of each depth band, near (0) to far (DEPTH_BANDS - 1). */
const DEPTH_GROUPS: Piece[][] = Array.from({ length: DEPTH_BANDS }, () => []);
for (const piece of PIECES) DEPTH_GROUPS[depthBandFor(piece, MAJOR_EDGES_DESC)].push(piece);
// Painted far band first, so when two pieces do pass close during a
// parallax slide the nearer one is the one in front — the DOM order is
// the only depth sorting a 2D composition has.
const DEPTH_RENDER_ORDER = Array.from({ length: DEPTH_BANDS }, (_, i) => DEPTH_BANDS - 1 - i);

// The composition is laid out in fixed canvas px, so without this a 420px
// piece sat on a 320px phone larger than the screen — one image visible
// and no sense of a composition at all. The whole plane is scaled to the
// viewport instead of reflowing it, so the arrangement is identical
// everywhere and only its size changes.
const FIT_REFERENCE_VW = 1440;
// The floor is a MOBILE composition decision, not just a safety rail. A
// phone is not a small desktop: scaled strictly by width, a 340px piece
// lands at about a third of a 390px screen and the composition reads as a
// lot of small stamps, which is the "microscopic" version of this beat
// rather than a recomposed one. Held at half size instead, a phone shows
// fewer pieces and each of them is actually a picture — the same
// arrangement, framed closer in.
const FIT_MIN = 0.5;

/** The viewport fit the composition always carries. */
export function galleryFit(vw: number) {
  return Math.min(1, Math.max(FIT_MIN, vw / FIT_REFERENCE_VW));
}

/**
 * The frame the zoom out starts from, in screen px: the iris card scaled
 * until the iris painted on it is exactly the size the bulb's underside
 * was, with the iris centred in the viewport.
 *
 * PencilSection draws its final card from these same numbers, so the cut
 * between the two beats is geometry rather than a cross-fade.
 */
export function irisFrame(vw: number, vh: number) {
  const piece = PIECES.find((x) => x.id === IRIS_PIECE_ID)!;
  const fit = galleryFit(vw);
  const cardW = piece.w * fit;
  const cardH = piece.h * fit;
  // The circle is the BULB, at the size the bulb actually is on screen —
  // it is the same object, seen from underneath, so it cannot change size
  // as it darkens. The card follows from it at the ratio it already had,
  // and the camera's distance is whatever puts that card at that size.
  const iris = bulbSizePx(vw, vh) * BULB_GLASS_RATIO;
  const scale = iris / IRIS_RATIO / cardH;
  // The drawn iris's own centre, offset from the card's geometric centre —
  // in CARD-LOCAL canvas px, before `scale`/`fit` are applied, so callers
  // can add it straight onto whatever coordinate space they're already in.
  const irisOffsetX = (IRIS_CENTER_X_FRAC - 0.5) * piece.w;
  const irisOffsetY = (IRIS_CENTER_Y_FRAC - 0.5) * piece.h;
  return {
    piece,
    fit,
    scale,
    /** Screen size of the card and of the iris at that scale. */
    cardW: cardW * scale,
    cardH: cardH * scale,
    iris,
    irisOffsetX,
    irisOffsetY,
    /**
     * The same offset in SCREEN px at this frame's scale — what
     * PencilSection needs to put the drawn iris (not the card's middle)
     * exactly under the bulb's own circle while it transforms into it.
     */
    irisOffsetScreenX: irisOffsetX * fit * scale,
    irisOffsetScreenY: irisOffsetY * fit * scale,
  };
}

/**
 * Where page one's wordmark actually is, in screen px.
 *
 * The hero composes on a 1920x1080 stage fitted like `object-fit: contain`
 * and centred in the pane, with ART's line box centred at stage y
 * 540 + ART_Y_REST. Deriving the gallery's ART from the same numbers is
 * what lets the return transition ARRIVE on the hero rather than dissolve
 * into it: at the end of the move this element is the same face, the same
 * size, in the same place, so resetting the page underneath it changes
 * nothing on screen.
 */
function heroArt(vw: number, vh: number) {
  const stage = Math.min(vw / STAGE_W, vh / STAGE_H);
  return {
    stage,
    fontPx: ART_FONT_SIZE * stage,
    centerY: vh / 2 + ART_Y_REST * stage,
  };
}

const mod = (v: number, m: number) => ((v % m) + m) % m;
/** Signed distance from a to b on a ring of size m, taking the short way. */
const ringDelta = (a: number, b: number, m: number) => {
  let d = (b - a) % m;
  if (d > m / 2) d -= m;
  if (d < -m / 2) d += m;
  return d;
};

// A flat fallback fill, shown only for the instant before an image has
// actually painted (or if one fails to load) — never a substitute for
// content, unlike the placeholder gradients this replaced.
const FALLBACK_BG = "linear-gradient(150deg, #1a1c22 0%, #121318 58%, #090a0d 100%)";

/**
 * The artwork card: the image, and nothing else until the reader asks for
 * more. IDLE is only ever the picture, at its own exact aspect ratio (the
 * box this sits in is already sized from the source image's ratio, so
 * `object-fit: cover` here never actually crops anything). `infoVisible`
 * (hover, on the small gallery cards; always-on once a card is focused —
 * see the "opened" render below) fades in a bottom gradient carrying the
 * medium and, if supplied, its details. There is no flip and no back
 * face any more: the information lives ON the artwork, not behind it.
 */
function ArtCard({
  src,
  medium,
  details,
  radius = 10,
  hovered = false,
  infoVisible = false,
  infoScale = 1,
}: {
  src: string;
  medium?: string;
  details?: string;
  radius?: number;
  hovered?: boolean;
  /** Show the medium/details gradient — hover on a grid card, always true once focused. */
  infoVisible?: boolean;
  /** Scales the info type up for the large focused card vs. the small grid one. */
  infoScale?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: radius,
        overflow: "hidden",
        background: FALLBACK_BG,
        border: `1px solid rgba(255,255,255,${hovered ? 0.22 : 0.1})`,
        // Flat, like the reference. The composition is dense — 38 to 50
        // canvas px between images — and the old 34px white bloom filled
        // every one of those gutters with haze. A whisper of lift on
        // hover instead of the pointer tilt the other sections use: a
        // tilt tracking the pointer would fight the pan happening under
        // the same gesture.
        boxShadow: hovered
          ? "0 0 26px rgba(255,255,255,0.12), 0 18px 44px rgba(0,0,0,0.72)"
          : "0 0 18px rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.6)",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        // ASYMMETRIC. Coming under attention is slower and softer than
        // leaving it: the picture rises into the pointer over most of half
        // a second, and drops back in under a third of one. Matched
        // timings read as a switch being thrown; this reads as weight —
        // something taking a moment to answer and then letting go cleanly.
        transition: hovered
          ? "transform 480ms cubic-bezier(0.16,1,0.3,1), box-shadow 480ms cubic-bezier(0.16,1,0.3,1), border-color 480ms ease"
          : "transform 260ms cubic-bezier(0.4,0,0.6,1), box-shadow 260ms ease, border-color 260ms ease",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {/* THE INFORMATION. A gradient rising from the bottom edge, carrying
          the medium (and, if supplied, its details) — not a solid panel:
          it has to dissolve into the picture rather than read as a bar
          laid over it, so it is three stops fading to fully transparent
          well short of the card's own middle, and the type sits inside
          the densest part of it. Rendered here, inside the same rounded/
          clipped box the image is in, so both the small grid card's hover
          and the focused card's always-on info (see the "opened" render
          below, which reuses this same component) share one treatment —
          there is no separate back face or information panel any more. */}
      {medium != null && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "58%",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.52) 30%, rgba(0,0,0,0.2) 58%, rgba(0,0,0,0) 100%)",
              opacity: infoVisible ? 1 : 0,
              // The shade RISES out of the bottom edge rather than simply
              // appearing at full height: anchored at the bottom and grown
              // from four fifths, it reads as something welling up through
              // the picture instead of a panel being switched on over it.
              transformOrigin: "50% 100%",
              transform: infoVisible ? "scaleY(1)" : "scaleY(0.8)",
              transition: infoVisible
                ? "opacity 460ms cubic-bezier(0.16,1,0.3,1), transform 560ms cubic-bezier(0.16,1,0.3,1)"
                : "opacity 220ms cubic-bezier(0.4,0,0.6,1), transform 260ms cubic-bezier(0.4,0,0.6,1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: `${(10 * infoScale).toFixed(1)}px ${(12 * infoScale).toFixed(1)}px`,
              opacity: infoVisible ? 1 : 0,
              transform: infoVisible ? "translateY(0)" : "translateY(9px)",
              // The type follows the shade rather than arriving with it —
              // 70ms behind on the way in, and gone first on the way out.
              // One coordinated reveal with an order to it, not two
              // elements cross-fading on the same timer.
              transition: infoVisible
                ? "opacity 420ms cubic-bezier(0.16,1,0.3,1) 70ms, transform 540ms cubic-bezier(0.16,1,0.3,1) 70ms"
                : "opacity 180ms cubic-bezier(0.4,0,0.6,1), transform 240ms cubic-bezier(0.4,0,0.6,1)",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontWeight: 600,
                fontSize: 12 * infoScale,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                textShadow: "0 1px 10px rgba(0,0,0,0.5)",
              }}
            >
              {medium}
            </div>
            {details && (
              <div
                style={{
                  marginTop: 3 * infoScale,
                  color: "rgba(255,255,255,0.72)",
                  fontWeight: 300,
                  fontSize: 10.5 * infoScale,
                  lineHeight: 1.4,
                  maxWidth: `${34 * infoScale}ch`,
                }}
              >
                {details}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** An expanded piece, plus the exact screen box it grew out of. */
type Opened = { piece: Piece; key: string; from: DOMRect };

export default function InfiniteCanvas({
  progress,
  sans,
  vw,
  vh,
  visible = true,
  onReturnHome,
}: {
  progress: number;
  sans: string;
  vw: number;
  vh: number;
  /**
   * Where the return gesture goes when this gallery is NOT the last beat
   * of the homepage's scroll track. On the homepage the move arrives at
   * the hero's own ART and the page's scroll position is simply reset
   * underneath it (see the arrival effect below); on /art there is no
   * hero above to arrive at, so the route hands this in and the same
   * completed move navigates home instead.
   */
  onReturnHome?: () => void;
  /**
   * False for the lead-in stretch where this section is mounted early —
   * fourteen pieces per cell plus the plane's first layout is not work to
   * do on the frame the pull-back starts — but its own progress has not
   * begun. This backdrop is opaque, so while it was unconditionally
   * visible it covered PencilSection with a picture that could not move,
   * because `progress` is clamped at 0 throughout that stretch. Same
   * guard CordSection and PencilSection already use.
   */
  visible?: boolean;
}) {
  const p = clamp01(progress);
  // The surface's own root, so the drive loop can publish the field's
  // state to the HUD drawn over it without a render per frame.
  const rootRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  // What is RENDERED. Always a follower easing toward panTargetRef — see
  // the drive loop below and the FOLLOW_TAU constants above.
  const panRef = useRef({ x: 0, y: 0 });
  // What the pointer (and any leftover flick) is asking for.
  const panTargetRef = useRef({ x: 0, y: 0 });
  // The field's own smoothed velocity, in canvas px/ms. Every depth band's
  // offset is this times that band's trailing time, so the parallax is
  // zero whenever the field is still — by construction, not by convergence.
  const fieldVelRef = useRef({ x: 0, y: 0 });
  const prevPanRef = useRef({ x: 0, y: 0 });
  const depthGainRef = useRef(DEPTH_GAIN_WIDE);
  // 0 = the field is at rest, 1 = fully opened away from a focused piece.
  const dollyRef = useRef(0);
  const dollyTargetRef = useRef(0);
  // The drive loop, reachable from effects declared above it. Wiring it
  // through a ref rather than naming `drive` directly is what lets those
  // effects hand off to it without a temporal-dead-zone reference in a
  // dependency array evaluated during render.
  const driveFnRef = useRef<() => void>(() => {});
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  // 0 = still in the composition, 1 = fully expanded. Driven by a CSS
  // transition rather than a rAF loop: the card is one element and the
  // browser can run the whole grow on the compositor.
  const [openT, setOpenT] = useState(0);
  // Keyed by cell AND piece: the same piece is drawn several times, so
  // keying on its id alone lit every copy at once.
  const [hovered, setHovered] = useState<string | null>(null);
  // A touch device has no real hover: it fires a synthetic mouseenter on
  // first tap in some browsers, which would otherwise pop the info
  // gradient on immediately alongside — or in place of — the tap opening
  // the card. Gating grid-card info on a genuine `hover` media feature
  // keeps the small cards clean on touch, as specified; the focused card's
  // own info is unaffected (`infoVisible` there is unconditional).
  const [canHover, setCanHover] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fit = galleryFit(vw);

  // THE ZOOM OUT (unchanged in kind: this is the existing entry transition).
  //
  // The previous beat hands over a frame that is one thing: the iris,
  // hard against the lens, on the card it is painted on. Nothing in the
  // gallery moves for this — the camera pulls back, so the whole
  // composition scales down about the frame's centre and the rest of the
  // work arrives from outside the frame because it was always there.
  const frame = useMemo(() => irisFrame(vw, vh), [vw, vh]);
  const revealT = revealEase(span(p, 0, REVEAL_END));
  // Geometric, not linear: a linear pull-back from 5x reads as the images
  // rushing away and then crawling. Interpolating the LOG of the scale
  // makes each moment of the move cover the same proportion of distance,
  // which is what a real dolly looks like.
  const revealScale = Math.exp(Math.log(frame.scale) * (1 - revealT));
  const revealing = revealT < 0.999;

  // ── THE RETURN TRANSITION ───────────────────────────────────────────
  // A dedicated state, not reverse scrolling. `returnTargetRef` is what
  // the gesture has asked for; `returnT` is what is rendered, easing
  // toward it so a chunky wheel notch is a glide. See the handlers below.
  const [returning, setReturning] = useState(false);
  const [returnT, setReturnT] = useState(0);
  const returningRef = useRef(false);
  const returnTargetRef = useRef(0);
  const returnTRef = useRef(0);

  const camT = camEase(returnT);
  // A real dolly: the composition is near the lens and rushes past it,
  // ART is far behind and swells slowly. Same camera, two depths, which
  // is what makes the move read as travelling THROUGH the gap rather
  // than as the plane merely growing.
  const dolly = returning ? Math.exp(Math.log(DOLLY_MAX) * camT) : 1;

  // THE FLIGHT HOME, for the moth. `dolly` IS the camera's forward travel
  // through the gap — it is the only thing on this beat that moves the
  // camera — so publishing it is enough for the moth to be overtaken and
  // passed by the same move that carries the reader to ART. Nothing about
  // the transition itself changes, and the moth has no say in it.
  useEffect(() => {
    setMothReturnDolly(dolly);
  }, [dolly]);
  // The arrival snaps the dolly back to 1 while the gallery is still the
  // phase on screen. That is a cut, not a camera flying a thousand pixels
  // backwards, so the moth is told to carry its state across it rather
  // than be dragged by it.
  useEffect(() => {
    if (!returning) return;
    return () => {
      cutMothContinuity();
    };
  }, [returning]);

  const hero = useMemo(() => heroArt(vw, vh), [vw, vh]);
  // ART's size on the way home is solved, not tweened to a guess: at
  // camT = 1 it is EXACTLY the hero's, so the page-one reset underneath
  // it is invisible.
  const artK = Math.exp(Math.log(1 / ART_REST_RATIO) * camT);
  const artFontPx = hero.fontPx * ART_REST_RATIO * artK;
  // In the gallery it sits at the WINDOW's centre — the composition is
  // scaled about that point, so the camera travels straight down the axis
  // the clear space is on. It is fixed there for the whole beat; the only
  // thing that ever moves it is the arrival, which carries it the last few
  // dozen pixels onto page one's own position. That drift is part of the
  // camera move, not a separate animation: at camT = 1 it is exact.
  const artCentreY = vh / 2 + (hero.centerY - vh / 2) * camT;
  const artIn = span(revealT, 0.5, 1);
  // Bright enough to read as the wordmark it is — the reference's word is
  // solid white behind the work, not a watermark — but still clearly
  // BEHIND the images. It reaches full strength exactly as the camera
  // arrives, which is what makes the handover to page one a no-op.
  const artOpacity = (0.36 + 0.64 * easeOutCubic(camT)) * artIn;

  // The rounded window itself. It opens out of the previous beat's
  // full-bleed black as the pull-back lands, and opens back OUT to full
  // bleed as the camera leaves through it on the way home.
  const frameMax = useMemo(() => {
    const m = Math.min(vw, vh);
    return {
      inset: Math.round(Math.min(30, Math.max(8, m * 0.028))),
      radius: Math.round(Math.min(34, Math.max(14, m * 0.036))),
    };
  }, [vw, vh]);
  const frameT = span(revealT, 0.55, 1) * (1 - easeOutCubic(span(returnT, 0, 0.4)));
  const frameInset = frameMax.inset * frameT;
  const frameRadius = frameMax.radius * frameT;

  // HOW MANY CELLS TO DRAW.
  //
  // A fixed 3x3 block was nine copies of everything at every moment of
  // the beat, including the flight home where the plane is scaled many
  // times over and one cell covers the frame several times. The visible
  // slice of the plane is vw/eff by vh/eff, and the wrapped offset is
  // somewhere inside one cell, so the block only ever has to span that
  // slice plus the cell it starts in.
  const eff = dolly * revealScale * fit;
  const cellRange = (extent: number, cell: number) => {
    const half = extent / (2 * eff);
    const lo = Math.floor((extent / 2 - half) / cell);
    const hi = Math.floor((cell + extent / 2 + half) / cell);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  };
  const cols = revealScale > 2 ? [0] : cellRange(vw, CELL_W);
  const rows = revealScale > 2 ? [0] : cellRange(vh, CELL_H);

  // The pan settles onto the GAP fast, in the first third of the return,
  // while the dolly is still shallow — so the move reads as the camera
  // lining up on the clear space and then travelling through it.
  const panHomeT = easeOutCubic(span(returnT, 0, 0.32));
  // Held in a ref, and written from an effect rather than during render.
  // `write` below reads it instead of taking it as a dependency, because
  // `write` is also called from rAF loops (the settle, the momentum coast)
  // that must not be torn down and rebuilt on every frame of the return.
  // The effect is declared HERE, above the effect that calls `write()`, so
  // the ordering React guarantees between them is the one this needs: the
  // value lands before anything reads it.
  const homeRef = useRef(panHomeT);
  useEffect(() => {
    homeRef.current = panHomeT;
  }, [panHomeT]);

  // The plane offset the pull-back is centred on: the iris card's middle
  // at the middle of the frame.
  //
  // NOT wrapped to the cell. The pull-back draws the centre cell only, so
  // the offset has to be the one that puts THAT copy of the card under the
  // lens; taking it modulo the cell can name the copy one cell over, which
  // is off screen. Wrapping resumes when the reveal ends and the full
  // block is drawn again, and the two offsets are the same position by then.
  const irisX = frame.piece.x + frame.piece.w / 2 + frame.irisOffsetX - vw / 2;
  const irisY = frame.piece.y + frame.piece.h / 2 + frame.irisOffsetY - vh / 2;

  // Writing the transform from a ref keeps a drag off React's render path;
  // at fourteen pieces per cell a state update per pointermove is visible.
  const write = useCallback(() => {
    const plane = planeRef.current;
    if (!plane) return;
    if (revealing) {
      // Locked to the iris while the camera pulls back — the reader has
      // no say over the framing until the gallery has arrived.
      //
      // The depth bands are flattened for the duration. The hand-off from
      // the previous beat is geometry: PencilSection's last frame and this
      // one are computed from the same numbers, and a band holding even a
      // pixel of lag would put the iris card somewhere those numbers do
      // not describe. Depth is something the field gains once it is the
      // reader's to move.
      plane.style.transform = `translate3d(${(-irisX).toFixed(2)}px, ${(-irisY).toFixed(
        2
      )}px, 0)`;
      for (let b = 1; b < DEPTH_BANDS; b++) {
        plane.style.setProperty(`--depth-${b}-x`, "0px");
        plane.style.setProperty(`--depth-${b}-y`, "0px");
      }
      return;
    }
    const h = homeRef.current;
    const wx = mod(panRef.current.x, CELL_W);
    const wy = mod(panRef.current.y, CELL_H);
    // Where the plane has to sit for the GAP to be dead centre. Taken the
    // short way round the wrap so the approach never unwinds a whole cell.
    const tx = mod(GAP.x - vw / 2, CELL_W);
    const ty = mod(GAP.y - vh / 2, CELL_H);
    const ox = wx + ringDelta(wx, tx, CELL_W) * h;
    const oy = wy + ringDelta(wy, ty, CELL_H) * h;
    // The focus dolly. The plane's transform-origin is parked on the
    // focused piece (see openDollyOrigin), so this scale opens the field
    // AWAY from that piece without moving the piece itself — which is
    // what makes the expanding card read as being drawn forward out of
    // the composition rather than growing on top of a still picture.
    const dolly = 1 + FOCUS_DOLLY * dollyRef.current;
    plane.style.transform =
      `translate3d(${(-ox).toFixed(2)}px, ${(-oy).toFixed(2)}px, 0)` +
      (dollyRef.current > 0.0005 ? ` scale(${dolly.toFixed(5)})` : "");

    // The depth bands' lag, published as custom properties on the plane so
    // one write reaches every tiled copy of every band instead of walking
    // rows x cols x bands elements each frame.
    const gain = depthGainRef.current;
    const ceiling = DEPTH_MAX_OFFSET * gain;
    for (let b = 1; b < DEPTH_BANDS; b++) {
      const ox2 = -fieldVelRef.current.x * DEPTH_LAG_TAU[b] * gain;
      const oy2 = -fieldVelRef.current.y * DEPTH_LAG_TAU[b] * gain;
      // Softened as a VECTOR, not per axis: capping x and y separately
      // lets a diagonal throw reach sqrt(2) times the ceiling, which is
      // the one direction the field would visibly come apart in.
      const mag = Math.hypot(ox2, oy2);
      const k = mag > 0.001 ? (ceiling * Math.tanh(mag / ceiling)) / mag : 0;
      plane.style.setProperty(`--depth-${b}-x`, `${(ox2 * k).toFixed(2)}px`);
      plane.style.setProperty(`--depth-${b}-y`, `${(oy2 * k).toFixed(2)}px`);
    }

    // How still the field is, 1 to 0. Published on the surface's own root
    // so the HUD over it (the hint) can answer to the composition's
    // movement without a React render per frame. FIELD_CALM_SPEED is the
    // speed at which it has receded as far as it goes.
    const root = rootRef.current;
    if (root) {
      const speed = Math.hypot(fieldVelRef.current.x, fieldVelRef.current.y);
      const calm = 1 - 0.78 * Math.min(1, speed / FIELD_CALM_SPEED);
      root.style.setProperty("--field-calm", calm.toFixed(3));
    }
  }, [vw, vh, revealing, irisX, irisY]);

  // Re-write the plane whenever the return advances or the frame resizes,
  // not only when the pointer moves it.
  useEffect(() => {
    write();
  }, [write, panHomeT, revealScale]);

  // THE SETTLE.
  //
  // The pull-back has to end on the iris card, dead centre — that is the
  // match cut. But the iris card is then parked exactly over ART, so the
  // frame the reader is handed has the wordmark hidden behind a
  // placeholder. So the composition keeps moving for a moment after the
  // camera stops: it slides the ~280px that puts its clear space over
  // ART, and the gallery comes to rest on a frame that reads.
  //
  // Only until the reader takes hold of it. One drag and this stops
  // writing the pan for good — nothing should move the composition out
  // from under a hand that is on it.
  //
  // Timed, not scroll-coupled. This used to be scrubbed straight off `p`
  // (span(p, REVEAL_END, REVEAL_END + 0.22)) — a fixed SHARE of the
  // section's scroll, which meant however fast the reader kept scrolling
  // right past the reveal's end, the slide covered that same 0.22 in
  // however few or many pixels that scrolling happened to supply. A
  // continued flick carried straight through it in almost no distance at
  // all, which read as the gallery flinging itself sideways before a hand
  // ever touched it. A fixed WALL-CLOCK animation always takes the same
  // ~0.65s regardless of what scrolling does next, so the reader always
  // sees the same brief, calm slide before the composition is simply
  // sitting there, ready to drag.
  const untouchedRef = useRef(true);
  const settleStartRef = useRef<number | null>(null);
  const settleVelClockRef = useRef<number | null>(null);
  useEffect(() => {
    if (revealing) {
      // Hand the pan over at the value the reveal left it on, so the
      // first drag after the gallery arrives does not snap it to 0,0.
      // Everything is parked on the same value — a stale velocity here
      // would put the bands off their marks on the frame the hand-off
      // happens, and that frame is a match cut.
      panRef.current = { x: irisX, y: irisY };
      panTargetRef.current = { x: irisX, y: irisY };
      prevPanRef.current = { x: irisX, y: irisY };
      fieldVelRef.current = { x: 0, y: 0 };
      untouchedRef.current = true;
      settleStartRef.current = null;
      return;
    }
    if (!untouchedRef.current) return;
    const SETTLE_MS = 650;
    if (settleStartRef.current == null) settleStartRef.current = performance.now();
    const start = settleStartRef.current;
    let raf = 0;
    const tick = (now: number) => {
      if (!untouchedRef.current) return; // a drag started; leave the pan where it is
      const t = settleEase(clamp01((now - start) / SETTLE_MS));
      panRef.current = {
        x: irisX + (GAP.x - vw / 2 - irisX) * t,
        y: irisY + (GAP.y - vh / 2 - irisY) * t,
      };
      // The settle drives the rendered pan directly, so the target has to
      // come with it — otherwise the first frame the drive loop wakes it
      // would pull the composition straight back to where the settle
      // started. The bands are left to trail it: the settle is the
      // gallery's first movement, and them lagging through it is the first
      // thing that says this is a field with depth rather than a flat
      // sheet.
      panTargetRef.current = { ...panRef.current };
      const vdt = Math.max(1, now - (settleVelClockRef.current || now));
      settleVelClockRef.current = now;
      const kv = 1 - Math.exp(-vdt / DEPTH_VEL_TAU);
      fieldVelRef.current.x +=
        ((panRef.current.x - prevPanRef.current.x) / vdt - fieldVelRef.current.x) * kv;
      fieldVelRef.current.y +=
        ((panRef.current.y - prevPanRef.current.y) / vdt - fieldVelRef.current.y) * kv;
      prevPanRef.current = { ...panRef.current };
      write();
      if (t < 1) raf = requestAnimationFrame(tick);
      // The slide is over, but the bands are still displaced by the speed
      // it ended on. Hand them to the drive loop so that speed decays on
      // the same curve every other settle on this surface uses, instead of
      // the parallax simply freezing where the slide dropped it.
      else driveFnRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealing, irisX, irisY, vw, vh, write]);

  // ── DRAGGING THE COMPOSITION ────────────────────────────────────────
  //
  // Pointer capture is taken only once the gesture is actually a drag.
  //
  // Capturing on pointerdown looks harmless but silently breaks opening a
  // card: while a pointer is captured the browser retargets the resulting
  // `click` to the capturing element, so the click landed on the pan
  // surface and never reached the piece under the finger. Deferring the
  // capture past the slop means a tap is an ordinary click on the image,
  // and a drag still captures the moment it becomes one — which is what
  // keeps the pan alive when the pointer leaves the surface mid-throw.
  const capturedRef = useRef(false);

  // ── THE DRIVE LOOP ───────────────────────────────────────────────────
  //
  // ONE loop owns every continuous motion this surface has: the field
  // following the pointer, the flick that outlives the hand, each depth
  // band's lag behind the field, and the dolly that opens the composition
  // around a focused piece. They share a clock and a single `write()`, so
  // they cannot drift out of step with one another the way separate
  // animations do — which is the whole point of doing it this way rather
  // than starting a fresh rAF per effect.
  //
  // It runs only while there is something to integrate and parks itself
  // the frame everything has settled, so an idle gallery costs nothing.
  const velRef = useRef({ x: 0, y: 0 });
  const lastMoveTimeRef = useRef(0);
  const lastMoveEventTsRef = useRef(0);
  const driveRafRef = useRef<number | null>(null);
  const driveLastRef = useRef(0);
  const pointerTypeRef = useRef<"mouse" | "touch">("mouse");

  const stopDrive = useCallback(() => {
    if (driveRafRef.current != null) {
      cancelAnimationFrame(driveRafRef.current);
      driveRafRef.current = null;
    }
  }, []);

  /** Kill any residual motion and park every follower where it is. */
  const stopMomentum = useCallback(() => {
    stopDrive();
    velRef.current = { x: 0, y: 0 };
    panTargetRef.current = { ...panRef.current };
    fieldVelRef.current = { x: 0, y: 0 };
    prevPanRef.current = { ...panRef.current };
  }, [stopDrive]);

  const drive = useCallback(() => {
    if (driveRafRef.current != null) return;
    driveLastRef.current = performance.now();
    const flickDecayPerMs = Math.pow(0.5, 1 / FLICK_HALF_LIFE_MS);
    const tick = (now: number) => {
      // Two clocks on purpose. `dt` is clamped, because it drives
      // INTEGRATION and a tab that stalls for a second must not teleport
      // the field a second's worth of travel. `trueDt` is not, because it
      // is only ever used to MEASURE how fast the field is actually
      // moving on screen — and clamping that would report a speed the
      // reader never saw.
      const trueDt = Math.max(1, now - driveLastRef.current);
      const dt = Math.min(48, trueDt);
      driveLastRef.current = now;
      const dragging = draggingRef.current;

      // 1. The flick keeps pushing the TARGET after the hand is off it, so
      //    a throw is the same gesture continuing rather than a separate
      //    animation taking over at the release.
      if (!dragging) {
        const decay = Math.pow(flickDecayPerMs, dt);
        panTargetRef.current.x += velRef.current.x * dt;
        panTargetRef.current.y += velRef.current.y * dt;
        velRef.current.x *= decay;
        velRef.current.y *= decay;
        if (Math.hypot(velRef.current.x, velRef.current.y) < FLICK_MIN_SPEED * 0.35) {
          velRef.current.x = 0;
          velRef.current.y = 0;
        }
      }

      // 2. The field eases toward it. A finger gets an almost rigid
      //    follow; a mouse gets weight; once the hand is off, heavier
      //    still, which is what turns the end of a throw into a glide.
      const tau = dragging
        ? pointerTypeRef.current === "touch"
          ? FOLLOW_TAU_TOUCH
          : FOLLOW_TAU_MOUSE
        : FOLLOW_TAU_COAST;
      const k = 1 - Math.exp(-dt / tau);
      panRef.current.x += (panTargetRef.current.x - panRef.current.x) * k;
      panRef.current.y += (panTargetRef.current.y - panRef.current.y) * k;

      // 3. How fast the field is travelling, smoothed. `write()` turns
      //    this into each band's offset (velocity x that band's trailing
      //    time), so the near band is the field exactly, and the gap
      //    between the bands IS the parallax.
      const instVx = (panRef.current.x - prevPanRef.current.x) / trueDt;
      const instVy = (panRef.current.y - prevPanRef.current.y) / trueDt;
      prevPanRef.current = { ...panRef.current };
      const kv = 1 - Math.exp(-trueDt / DEPTH_VEL_TAU);
      fieldVelRef.current.x += (instVx - fieldVelRef.current.x) * kv;
      fieldVelRef.current.y += (instVy - fieldVelRef.current.y) * kv;

      // 4. The focus dolly, on the same clock as everything else.
      dollyRef.current +=
        (dollyTargetRef.current - dollyRef.current) * (1 - Math.exp(-dt / FOCUS_DOLLY_TAU));
      if (Math.abs(dollyTargetRef.current - dollyRef.current) < 0.0008) {
        dollyRef.current = dollyTargetRef.current;
      }

      write();

      // Park once nothing is left to integrate. 0.06 canvas px is well
      // under a rendered pixel at every fit, so stopping here is invisible.
      const restX = Math.abs(panTargetRef.current.x - panRef.current.x);
      const restY = Math.abs(panTargetRef.current.y - panRef.current.y);
      // The parallax has to have decayed too, or the loop would park with
      // the bands still displaced and freeze the composition mid-shear.
      const parallaxLeft =
        Math.hypot(fieldVelRef.current.x, fieldVelRef.current.y) *
          DEPTH_LAG_TAU[DEPTH_BANDS - 1] >
        0.06;
      const moving =
        dragging ||
        restX > 0.06 ||
        restY > 0.06 ||
        parallaxLeft ||
        velRef.current.x !== 0 ||
        velRef.current.y !== 0 ||
        dollyRef.current !== dollyTargetRef.current;
      if (!moving) {
        // Park cleanly: zero the velocity so the last frame written is the
        // composition at rest, not the composition a hair short of it.
        fieldVelRef.current = { x: 0, y: 0 };
        write();
        driveRafRef.current = null;
        return;
      }
      driveRafRef.current = requestAnimationFrame(tick);
    };
    driveRafRef.current = requestAnimationFrame(tick);
  }, [write]);

  useEffect(() => {
    driveFnRef.current = drive;
  }, [drive]);

  // Motion amplitude is a responsive decision, not a leftover of the
  // desktop one scaled down. A phone shows a third of the pieces at half
  // the size, so the same parallax displacement there reads as the
  // composition shearing rather than as depth.
  useEffect(() => {
    depthGainRef.current = vw >= 900 ? DEPTH_GAIN_WIDE : DEPTH_GAIN_NARROW;
  }, [vw]);

  const startMomentum = useCallback(() => {
    const speed = Math.hypot(velRef.current.x, velRef.current.y);
    if (speed < FLICK_MIN_SPEED) {
      velRef.current = { x: 0, y: 0 };
    } else if (speed > FLICK_MAX_SPEED) {
      const clampScale = FLICK_MAX_SPEED / speed;
      velRef.current.x *= clampScale;
      velRef.current.y *= clampScale;
    }
    drive();
  }, [drive]);

  // A drag started elsewhere (revealing/returning/an opened card) never
  // reaches onPointerDown, but a coast in progress should still yield the
  // instant either of those genuinely takes over — a return gesture or an
  // opened card fighting a still-drifting gallery underneath it would read
  // as two animations at once.
  const interactive = !revealing && !returning && !opened;
  useEffect(() => {
    if (!interactive) stopMomentum();
  }, [interactive, stopMomentum]);
  useEffect(() => stopMomentum, [stopMomentum]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!interactive) return;
    // Taking hold kills the throw but NOT the followers: the target is
    // reset to where the field actually is, so the hand picks the picture
    // up from where it looks, with no jump.
    velRef.current = { x: 0, y: 0 };
    panTargetRef.current = { ...panRef.current };
    pointerTypeRef.current = e.pointerType === "mouse" ? "mouse" : "touch";
    lastMoveTimeRef.current = performance.now();
    lastMoveEventTsRef.current = e.timeStamp;
    draggingRef.current = true;
    drive();
    capturedRef.current = false;
    movedRef.current = 0;
    lastRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current += Math.hypot(dx, dy);
    if (movedRef.current > CLICK_SLOP_PX) untouchedRef.current = false;
    if (!capturedRef.current && movedRef.current > CLICK_SLOP_PX) {
      capturedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Divided by the fit so the composition tracks the finger 1:1 on
    // screen: at 0.42 a screen pixel is 2.4 canvas px, and without this
    // the plane would crawl behind the pointer on a phone.
    //
    // The pointer moves the TARGET, never the rendered pan. What the
    // reader sees is the follower in the drive loop closing on it — which
    // is where the field's weight comes from, and why letting go is the
    // same motion continuing rather than one animation handing over to
    // another.
    panTargetRef.current.x -= dx / fit;
    panTargetRef.current.y -= dy / fit;

    // Smoothed (not instantaneous) velocity of the PAN itself, in the
    // same canvas px/ms the drive loop above consumes directly — an
    // exponential moving average so the one jittery final pointermove
    // before release can't fling the coast off in a direction the drag
    // wasn't actually travelling.
    //
    // The EVENT's own timestamp, not the clock at the moment React gets
    // round to the handler: those differ by however long the main thread
    // was busy, and a frame of Three.js work landing between the last move
    // and the release would otherwise look like a hand that had stopped.
    lastMoveEventTsRef.current = e.timeStamp;
    const now = performance.now();
    const dt = Math.max(1, now - lastMoveTimeRef.current);
    lastMoveTimeRef.current = now;
    const instVx = -(dx / fit) / dt;
    const instVy = -(dy / fit) / dt;
    velRef.current = {
      x: velRef.current.x * 0.72 + instVx * 0.28,
      y: velRef.current.y * 0.72 + instVy * 0.28,
    };
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (capturedRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    capturedRef.current = false;
    // Letting go after holding still should stop, not launch: a flick is
    // only a flick if the pointer was actually travelling at the release.
    // Measured between the two EVENTS' timestamps — see onPointerMove.
    if (e.timeStamp - lastMoveEventTsRef.current > 110) {
      velRef.current = { x: 0, y: 0 };
    }
    if (movedRef.current > CLICK_SLOP_PX) startMomentum();
    else drive();
  };

  // ── EXPANDING A PIECE ───────────────────────────────────────────────
  //
  // The expanded card is laid out at its FINAL box and transformed back
  // onto the box the image occupied in the composition, then released to
  // identity — so the grow and the close are one transform transition on
  // one element and the card lands exactly on the image it came from,
  // whatever the pan and the fit happen to be.
  const openTarget = useMemo(() => {
    if (!opened) return null;
    const { piece } = opened;
    const s = Math.min((vw * 0.66) / piece.w, (vh * 0.7) / piece.h, 3.2);
    const w = piece.w * s;
    const h = piece.h * s;
    return { w, h, left: (vw - w) / 2, top: (vh - h) / 2 };
  }, [opened, vw, vh]);

  const openFrom = useMemo(() => {
    if (!opened || !openTarget) return null;
    const { from } = opened;
    return {
      dx: from.left + from.width / 2 - (openTarget.left + openTarget.w / 2),
      dy: from.top + from.height / 2 - (openTarget.top + openTarget.h / 2),
      s: openTarget.w > 0 ? from.width / openTarget.w : 1,
    };
  }, [opened, openTarget]);

  // Release the transform on the frame AFTER the one that mounted the card
  // at its origin box, so the browser has an old value to transition from.
  useEffect(() => {
    if (!opened) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpenT(1));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [opened]);

  // THE FIELD YIELDING.
  //
  // The card growing used to be the only thing that happened: the
  // composition behind it just blurred and dimmed in place, so the card
  // read as an overlay that had appeared on top of a still picture rather
  // than as one of those pictures being drawn out of it.
  //
  // Now the plane's transform-origin is parked on the chosen piece and the
  // drive loop eases a small scale in around it. Because the origin IS
  // that piece, the piece itself does not move — every other piece opens
  // outward from it, the space around it widens, and the card travelling
  // forward is travelling out of a gap the field has made for it. The two
  // are on the same clock, so they read as one event.
  //
  // Driven from the drive loop rather than a CSS transition because the
  // plane's transform is written by `write()` every frame; a transition on
  // the same property would fight it exactly the way two scroll smoothers
  // fight each other.
  useEffect(() => {
    const plane = planeRef.current;
    if (opened && plane) {
      // The SAME COPY that was clicked, not the piece's position inside a
      // cell: the plane holds a block of tiled cells and the origin has to
      // land on the one under the reader's pointer, or the field would
      // open around a duplicate somewhere off screen.
      const [row, col] = opened.key.split(":");
      const ox = Number(col) * CELL_W + opened.piece.x + opened.piece.w / 2;
      const oy = Number(row) * CELL_H + opened.piece.y + opened.piece.h / 2;
      plane.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
    }
    dollyTargetRef.current = opened ? 1 : 0;
    driveFnRef.current();
  }, [opened]);

  const closeOpened = useCallback(() => {
    setOpenT(0);
  }, [setOpenT]);

  // Unmount only once the card has finished travelling back.
  const onCardTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName === "transform" && openT === 0) setOpened(null);
  };

  // Close on Escape, like any other overlay.
  useEffect(() => {
    if (!opened) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeOpened();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, closeOpened]);

  // The captured origin box is in screen coordinates, so a resize would
  // send the card back to a box that no longer exists.
  useEffect(() => {
    if (!opened) return;
    const onResize = () => closeOpened();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [opened, closeOpened]);

  // ── THE RETURN GESTURE ──────────────────────────────────────────────
  //
  // Armed only once the gallery has fully settled, and only while nothing
  // is expanded. Everything below intercepts the gesture BEFORE the page
  // can act on it, so the scroll container never tries to navigate or
  // reset on its own — there is nothing past the end of this track for it
  // to do anyway, but a trackpad/touch bounce or a browser "pull" gesture
  // at the scroll boundary is exactly what this pre-empts.
  const armed = p >= ARM_FROM && !opened;
  const armedRef = useRef(armed);
  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  const beginReturn = useCallback((amount: number) => {
    returningRef.current = true;
    returnTargetRef.current = clamp01(amount);
    setReturning(true);
  }, []);

  const cancelReturn = useCallback(() => {
    returningRef.current = false;
    returnTargetRef.current = 0;
    setReturning(false);
    setReturnT(0);
  }, []);

  const advance = useCallback(
    (delta: number) => {
      const next = clamp01(returnTargetRef.current + delta);
      returnTargetRef.current = next;
      if (next <= 0 && returnTRef.current <= 0.002) cancelReturn();
    },
    [cancelReturn]
  );

  useEffect(() => {
    // Non-passive and in the capture phase: preventDefault has to run
    // before the document scrolls, and before ScrollSmoother sees it.
    const opts: AddEventListenerOptions = { passive: false, capture: true };

    const wheelPx = (e: WheelEvent) =>
      e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;

    const onWheel = (e: WheelEvent) => {
      if (returningRef.current) {
        e.preventDefault();
        advance(wheelPx(e) / RETURN_WHEEL_PX);
        return;
      }
      if (!armedRef.current) return;
      const dy = wheelPx(e);
      if (dy <= 0) return; // upward scrolling is left alone
      e.preventDefault();
      beginReturn(dy / RETURN_WHEEL_PX);
    };

    // Touch: the composition owns one-finger gestures (that is the drag),
    // so the return is a two-finger vertical swipe — the same fingers a
    // trackpad scroll uses. Once the transition is running every touch is
    // swallowed, which is the lock.
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY =
        returningRef.current || (armedRef.current && e.touches.length >= 2)
          ? e.touches[0].clientY
          : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (returningRef.current) {
        e.preventDefault();
        if (touchY == null) touchY = e.touches[0].clientY;
        const dy = e.touches[0].clientY - touchY;
        touchY = e.touches[0].clientY;
        advance(-dy / RETURN_TOUCH_PX);
        return;
      }
      if (!armedRef.current || e.touches.length < 2 || touchY == null) return;
      const dy = e.touches[0].clientY - touchY;
      touchY = e.touches[0].clientY;
      if (dy >= 0) return; // fingers moving up = scrolling down
      e.preventDefault();
      beginReturn(-dy / RETURN_TOUCH_PX);
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    const DOWN = ["ArrowDown", "PageDown", "End", " ", "Spacebar"];
    const UP = ["ArrowUp", "PageUp", "Home"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (returningRef.current) {
        if (DOWN.includes(e.key)) {
          e.preventDefault();
          advance(RETURN_KEY_STEP);
        } else if (UP.includes(e.key)) {
          e.preventDefault();
          advance(-RETURN_KEY_STEP);
        }
        return;
      }
      if (!armedRef.current || !DOWN.includes(e.key)) return;
      e.preventDefault();
      beginReturn(RETURN_KEY_STEP);
    };

    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onTouchEnd, opts);
    window.addEventListener("keydown", onKeyDown, opts);
    return () => {
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("touchcancel", onTouchEnd, opts);
      window.removeEventListener("keydown", onKeyDown, opts);
    };
  }, [advance, beginReturn, vh]);

  // The rendered value eases toward what the gesture asked for. Without
  // this the camera advances in wheel-notch steps, which is exactly the
  // stepped feel the rest of the sequence goes to some trouble to avoid.
  useEffect(() => {
    if (!returning) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt / 0.075);
      setReturnT((prev) => {
        const target = returnTargetRef.current;
        const next = prev + (target - prev) * k;
        const settled = Math.abs(target - next) < 0.0008 ? target : next;
        returnTRef.current = settled;
        return settled;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [returning]);

  // While the transition runs the page must not move under it. The
  // handlers above already swallow every scroll gesture; pausing the
  // smoother as well means anything that gets past them (a scrollbar
  // drag, a programmatic scroll) cannot advance the sequence either.
  useEffect(() => {
    if (!returning) return;
    let smoother: { paused: (v?: boolean) => unknown } | null = null;
    let cancelled = false;
    import("gsap/ScrollSmoother")
      .then((m) => {
        if (cancelled) return;
        smoother = m.ScrollSmoother.get() ?? null;
        smoother?.paused(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      smoother?.paused(false);
    };
  }, [returning]);

  // ARRIVAL. The move has visually completed — ART is the hero's ART, at
  // the hero's size, in the hero's place — so the page's own scroll
  // position can now be reset underneath it without anything changing on
  // screen. Nothing is faded and nothing is duplicated: the same element
  // simply stops being this section's and starts being page one's.
  useEffect(() => {
    if (!returning || returnT < 0.999) return;
    if (onReturnHome) {
      // Standalone route: the camera has completed its travel through the
      // gap, so this is the frame to leave on. No scroll reset — there is
      // nothing above this gallery on its own route to reset to.
      onReturnHome();
      return;
    }
    let cancelled = false;
    import("gsap/ScrollSmoother")
      .then((m) => {
        if (cancelled) return;
        const s = m.ScrollSmoother.get();
        if (s) {
          s.paused(false);
          // scrollTop() jumps. scrollTo(0, true) would play the whole
          // sequence backwards over the smoother's 0.72s.
          s.scrollTop(0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        window.scrollTo(0, 0);
        // The state reset below is deferred one frame on purpose. The
        // page's own scroll-position tracking is also rAF-driven and reads
        // window.scrollY on this same frame, which drops this section's
        // progress below the threshold that mounts it at all — so by the
        // time the reset below would actually change what's on screen,
        // this component has already unmounted. Resetting immediately
        // instead raced that unmount: on the frame it lost, returnT
        // snapped to 0 (ART back to its small, un-dollied gallery size)
        // for one visible frame before the unmount caught up — the "minor
        // overlap" this avoids. Nothing about the camera move itself
        // changes; this only reorders when the already-arrived state gets
        // cleared relative to the unmount.
        requestAnimationFrame(() => {
          if (cancelled) return;
          returningRef.current = false;
          returnTargetRef.current = 0;
          setReturning(false);
          setReturnT(0);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [returning, returnT, onReturnHome]);

  const hintOpacity =
    opened || returning ? 0 : span(revealT, 0.92, 1);

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: visible ? "#000" : "transparent",
        opacity: visible ? 1 : 0,
        // Nothing here may take a pointer while the beat underneath it
        // still owns the frame.
        pointerEvents: visible ? undefined : "none",
      }}
    >
      {/* THE FIXED ROUNDED VIEWPORT. It clips, and that is all it does —
          it is never transformed, so the window is genuinely fixed and
          the composition genuinely moves inside it. */}
      <div
        data-canvas="viewport"
        style={{
          position: "absolute",
          inset: frameInset,
          borderRadius: frameRadius,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Everything inside is laid out in VIEWPORT coordinates, not in
            the window's, by pulling the inset back out. The rounded frame
            can then open and close without moving a single pixel of the
            composition or of ART. */}
        <div
          style={{
            position: "absolute",
            left: -frameInset,
            top: -frameInset,
            width: vw,
            height: vh,
          }}
        >
          {/* ART. On the WINDOW's layer, behind the work, at one screen
              position for the whole beat — the position page one's
              wordmark occupies. The images slide over it; it never moves
              with them. Not drawn while the camera is still hard in on
              the iris, where the card covers it completely. */}
          {revealScale < 2.6 && (
            <div
              aria-hidden
              data-canvas="art"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: artCentreY,
                transform: "translateY(-50%)",
                textAlign: "center",
                fontFamily: ART_FONT,
                fontWeight: 400,
                fontSize: artFontPx,
                lineHeight: 0.86,
                letterSpacing: "0.005em",
                color: "#fff",
                opacity: artOpacity * clamp01((2.6 - revealScale) / 0.9),
                // CONSTANT, and at the hero's own strength. Regenerating a
                // four-layer glow every frame on type this size is the
                // most expensive thing that could happen during the move,
                // and matching page one exactly is what lets the handover
                // at the end be a no-op rather than a cross-fade.
                textShadow: glowShadow(1.15 * GLOW_STRENGTH),
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              ART
            </div>
          )}

          {/* THE MOVING COMPOSITION. One plane; the drag translates it and
              nothing else. The scale is the viewport fit, the pull-back,
              and the return's dolly — all about the window's centre. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDragStart={(e) => e.preventDefault()}
            style={{
              position: "absolute",
              inset: 0,
              cursor: !interactive ? "default" : dragging ? "grabbing" : "grab",
              touchAction: "none",
              transform: `scale(${eff.toFixed(4)})`,
              transformOrigin: "50% 50%",
              willChange: "transform",
              pointerEvents: opened ? "none" : "auto",
              // THE REST OF THE GALLERY RECEDING behind a focused card — a
              // soft depth-of-field cue (the scrim below already dims it
              // flat; this is what makes it read as pushed back in SPACE
              // rather than just darker) layered on `filter` only, never
              // `transform`: `transform` here is the reveal/return beats'
              // own continuously JS-eased scale, and a CSS transition on
              // it would fight that easing the same way a second scroll
              // smoother fights the first. `filter` carries no such
              // conflict, so it is the one property that can animate on
              // its own timing without disturbing anything else.
              filter: opened ? "blur(4px) saturate(0.86) brightness(0.78)" : "none",
              // Quicker than the card's own travel, and quicker than it
              // used to be: the field has to have receded BEFORE the
              // picture arrives, or the two read as two things happening
              // rather than one making room for the other.
              transition: opened
                ? "filter 300ms cubic-bezier(0.16,1,0.3,1)"
                : "filter 460ms cubic-bezier(0.16,1,0.3,1) 120ms",
              // A drag gesture is a mousedown-then-move over image/text
              // content, which the browser reads as a selection drag
              // unless told otherwise — the images and captions here would
              // otherwise get the native blue selection highlight instead
              // of panning. onDragStart already stops the HTML5 image-drag
              // ghost below; this stops the separate text/element selection.
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            <div
              ref={planeRef}
              data-canvas="plane"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                fontFamily: sans,
                willChange: "transform",
              }}
            >
              {rows.map((row) =>
                cols.map((col) => (
                  <div
                    key={`${row}:${col}`}
                    data-canvas="cell"
                    style={{
                      position: "absolute",
                      left: col * CELL_W,
                      top: row * CELL_H,
                      width: CELL_W,
                      height: CELL_H,
                    }}
                  >
                    {DEPTH_RENDER_ORDER.map((band) => (
                      // ONE element per depth band per cell, carrying that
                      // band's lag behind the field. The offset comes in
                      // through a custom property the drive loop writes on
                      // the plane, so a frame of parallax costs two
                      // property writes in total rather than one style
                      // write per band per cell — and every copy of a band
                      // moves by exactly the same amount, which is what
                      // keeps the infinite tiling seamless.
                      <div
                        key={band}
                        data-canvas="depth"
                        data-depth={band}
                        style={{
                          position: "absolute",
                          inset: 0,
                          transform:
                            band === 0
                              ? undefined
                              : `translate3d(var(--depth-${band}-x, 0px), var(--depth-${band}-y, 0px), 0)`,
                          willChange: band === 0 ? undefined : "transform",
                          // The bands are stacked full-cell boxes, so the
                          // nearest one would otherwise sit over the other
                          // two and swallow every click meant for a piece
                          // behind it. The boxes are pure geometry; only
                          // the pieces inside them are targets.
                          pointerEvents: "none",
                        }}
                      >
                    {DEPTH_GROUPS[band].map((piece) => {
                      const key = `${row}:${col}:${piece.id}`;
                      return (
                        <div
                          key={piece.id}
                          data-canvas="piece"
                          data-piece={piece.id}
                          onClick={(e) => {
                            // A drag, not a click.
                            if (movedRef.current > CLICK_SLOP_PX) return;
                            setOpened({
                              piece,
                              key,
                              from: e.currentTarget.getBoundingClientRect(),
                            });
                            setOpenT(0);
                          }}
                          onMouseEnter={() => setHovered(key)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            position: "absolute",
                            left: piece.x,
                            top: piece.y,
                            width: piece.w,
                            height: piece.h,
                            cursor: "pointer",
                            // Restored here: the depth band around this
                            // piece is inert so that it cannot cover the
                            // bands behind it (see its comment above).
                            pointerEvents: "auto",
                            // The expanded card IS this image, so the copy
                            // it grew out of must not sit under it.
                            visibility: opened?.key === key ? "hidden" : "visible",
                            // The beat before this one hands over a frame
                            // with ONE card on black. The pull-back starts
                            // close but not that close, so without this the
                            // neighbours are already in shot at the cut and
                            // pop in. They arrive with the move instead.
                            opacity:
                              piece.id === IRIS_PIECE_ID
                                ? 1
                                : span(revealT, 0.04, 0.42),
                          }}
                        >
                          {/* The same pointer-tilt-and-glare treatment
                              every other card on the site gets (see the
                              About Me photo card) — layered ON TOP of the
                              gallery's own lift-and-shadow hover, not in
                              place of it. Sized to fill the piece's own
                              box exactly: independent x/y/w/h per piece
                              means the aspect ratio has to be passed in
                              rather than assumed. */}
                          <HoverCard
                            style={{ width: "100%", height: "100%" }}
                            aspect={piece.w / piece.h}
                            radius={10}
                          >
                            <ArtCard
                              src={piece.src}
                              medium={piece.medium}
                              details={piece.details}
                              hovered={hovered === key}
                              infoVisible={hovered === key && canHover}
                            />
                          </HoverCard>
                          {/* No ring on the iris card. There used to be a
                              hairline circle traced around the drawn iris
                              here, to give the hand-off from the previous
                              beat "a frame to land in". The previous beat
                              now arrives as one continuously transforming
                              surface — the bulb's glass burning off the
                              artwork and its circular crop dilating open
                              (see PencilSection) — and lands on the plain
                              picture. A rim drawn on top of that would be
                              exactly the white outlined circle the beat is
                              built to never show. */}
                        </div>
                      );
                    })}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hint, only while the composition is the thing to use. */}
      <div
        data-canvas="hint"
        style={{
          position: "absolute",
          left: "50%",
          bottom: `calc(3vh + ${frameInset}px)`,
          transform: "translateX(-50%)",
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 500,
          fontSize: "clamp(11px, 3vw, 13px)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.92)",
          maxWidth: "92vw",
          // A pill, not a caption in open air: the composition is dense
          // enough that plain text landed on a light card as often as on
          // black, and a caption is invisible on its own background. A
          // small scrim behind it reads consistently either way without
          // turning into a banner.
          padding: "9px 18px",
          borderRadius: 999,
          background: "rgba(10,10,12,0.5)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          // THE HINT GETS OUT OF THE WAY WHILE THE FIELD IS MOVING.
          //
          // It says "drag to explore". Somebody who is dragging does not
          // need telling, and a caption holding full strength over a
          // composition in motion is the one element on screen insisting
          // it is not part of the space. `--field-calm` is written by the
          // drive loop from the field's own speed — 1 at rest, down to
          // about a quarter at a brisk pan — so the instruction recedes as
          // it is being followed and comes back when the reader stops.
          // One value, driven by the same clock as everything else, and no
          // extra animation: it IS the pan, read differently.
          opacity: `calc(${hintOpacity} * var(--field-calm, 1))`,
          transition: "opacity 240ms ease",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        {armed ? "Drag to explore · Scroll down to return" : "Drag to explore"}
      </div>

      {/* AN EXPANDED PIECE.
          The gallery stays visible behind it — a light scrim, no blur —
          because the card is meant to read as one image lifted out of the
          composition rather than as a modal over a hidden page. */}
      {opened && openTarget && openFrom && (
        <>
          <div
            data-canvas="scrim"
            onClick={closeOpened}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 6,
              background: "rgba(0,0,0,0.42)",
              opacity: openT,
              transition: "opacity 520ms cubic-bezier(0.22,0.7,0.24,1)",
            }}
          />
          <div
            data-canvas="opened"
            onTransitionEnd={onCardTransitionEnd}
            style={{
              position: "absolute",
              left: openTarget.left,
              top: openTarget.top,
              width: openTarget.w,
              height: openTarget.h,
              zIndex: 7,
              perspective: "1600px",
              transformOrigin: "50% 50%",
              transform:
                openT === 1
                  ? "translate3d(0px, 0px, 0) scale(1)"
                  : `translate3d(${openFrom.dx.toFixed(2)}px, ${openFrom.dy.toFixed(
                      2
                    )}px, 0) scale(${openFrom.s.toFixed(4)})`,
              // Longer and later than it was, and on a curve with almost
              // all of its travel at the front. The field is already
              // opening around this piece by the time the card leaves the
              // composition (see the dolly effect above, on a 150ms time
              // constant against this 720ms), so the order the eye reads
              // is: the space makes room, then the picture comes forward
              // into it. Departing 70ms behind the field is what puts that
              // order there instead of both simply starting at once.
              transition:
                openT === 1
                  ? "transform 720ms cubic-bezier(0.16,1,0.3,1) 70ms"
                  : "transform 520ms cubic-bezier(0.36,0,0.66,1)",
              willChange: "transform",
            }}
          >
            {/* No flip, no back face, no information panel — and no
                medium/details either. A focused piece is the picture and
                nothing else: the gradient and its caption belong to the
                grid card's hover, where they answer "what am I looking
                at?" while the reader is scanning. Once they have chosen
                this one and it is filling the frame, anything printed over
                it is just something between them and the work. */}
            <ArtCard src={opened.piece.src} radius={16} />
          </div>
        </>
      )}
    </div>
  );
}
