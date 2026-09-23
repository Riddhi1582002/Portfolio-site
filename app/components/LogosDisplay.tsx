"use client";

// THE LOGOS CARD — the third holder on the ring.
//
// The five supplied brand mockups, staged as printed panels the way the
// campaigns card stages its posts: the Fruit Rush bottle forward and
// largest, Clear Wave and Shaap Shaap either side of it, the Mercury
// letterhead and the Orient tote behind and above. Each is the
// supplied photograph whole, at its own proportion — card-sized copies
// (resized, never cropped or retouched), so nothing about a mark on
// screen is anything but the designer's own file.
//
// Everything else — the case, the lighting, the hover and the
// load-then-arrive sequence — is SpatialCardEngine, identical to the
// other cards: a different project, photographed in the same studio.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;

const src = (name: string) => `/logos/card/${name}.jpg`;

// A cascade rather than a row: the two flat pieces (letterhead, tote)
// hang behind and ABOVE the two bottles and the can, so every one of
// the five shows, and the group is about as tall as it is wide — which is
// what lets it fill a square card instead of a strip across it.
export const LOGOS_CARD_PIECES: StackPiece[] = [
  {
    // Back left, high: the deepest of the five.
    id: "mercury-letterhead",
    src: src("mercury-letterhead"),
    aspect: 1,
    height: 1.72,
    scale: 1,
    pos: [-0.95, 1.2, -1.3],
    rot: [-3 * D, 14 * D, -4 * D],
    lift: [-0.05, 0.1, 0.06],
    turn: [0, 3 * D, 0],
    parallax: 0.45,
  },
  {
    // Back right, a little lower than its partner.
    id: "orient-tote",
    src: src("orient-tote"),
    aspect: 1,
    height: 1.78,
    scale: 1,
    pos: [1.0, 1.0, -1.1],
    rot: [-2 * D, -15 * D, 3 * D],
    lift: [0.05, 0.11, 0.06],
    turn: [0, -3 * D, 0],
    parallax: 0.5,
  },
  {
    // Front left, beside the hero.
    id: "clear-wave-bottle",
    src: src("clear-wave-bottle"),
    aspect: 768 / 1024,
    height: 2.0,
    scale: 1,
    pos: [-1.35, -0.45, 0.25],
    rot: [-4 * D, 12 * D, 5 * D],
    lift: [-0.06, 0.13, 0.1],
    turn: [0, 2.5 * D, 0],
    parallax: 0.72,
  },
  {
    // Front right, the same step forward on the other side.
    id: "shaap-shaap-can",
    src: src("shaap-shaap-can"),
    aspect: 819 / 1024,
    height: 1.96,
    scale: 1,
    pos: [1.35, -0.5, 0.4],
    rot: [-3 * D, -12 * D, -4 * D],
    lift: [0.06, 0.13, 0.1],
    turn: [0, -2.5 * D, 0],
    parallax: 0.74,
  },
  {
    // THE ONE THE EYE LANDS ON: forward, centred, the largest.
    id: "fruit-rush-bottle",
    src: src("fruit-rush-bottle"),
    aspect: 819 / 1024,
    height: 2.34,
    scale: 1,
    pos: [0, -0.3, 1.05],
    rot: [-3 * D, -4 * D, -1.5 * D],
    lift: [0.02, 0.16, 0.16],
    turn: [0, -1.5 * D, 0],
    parallax: 1,
  },
];

export function preloadLogos() {
  preloadStack(LOGOS_CARD_PIECES);
}

export default function LogosDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  // Stable across renders: the engine remounts if this identity changes.
  const options = useMemo(
    () => ({ fov: 26, camZ: 10.6, camY: 0.2, contentScale: 0.7, floorY: FLOOR_Y }),
    []
  );
  return (
    <ArtworkStackDisplay
      pieces={LOGOS_CARD_PIECES}
      luminance={luminance}
      reduced={reduced}
      options={options}
      dataAttr="data-logos"
    />
  );
}
