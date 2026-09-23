"use client";

// THE LOGOS CARD — the third holder on the ring.
//
// The five supplied brand mockups, staged as printed panels the way the
// campaigns card stages its posts: the Fruit Rush bottle forward and
// largest, Clear Wave and Shaap Shaap either side of it, the Mercury
// letterhead and the Orient tote hung level behind. Each is the
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

// TWO ROWS, as a board of work is hung: the two flat pieces (letterhead,
// tote) side by side at the back, level and high, and the three
// packaging shots in front of them — the bottles either side, turned a
// few degrees in, and the Fruit Rush bottle forward and largest in the
// middle. Symmetric on purpose: this is a brand showcase, and a set of
// marks reads as considered when it is lined up, not scattered.
export const LOGOS_CARD_PIECES: StackPiece[] = [
  {
    // Back row, left.
    id: "mercury-letterhead",
    src: src("mercury-letterhead"),
    aspect: 1,
    height: 1.6,
    scale: 1,
    pos: [-0.88, 1.05, -1.15],
    rot: [-1 * D, 3 * D, 0],
    lift: [-0.04, 0.08, 0.05],
    turn: [0, 2 * D, 0],
    parallax: 0.4,
  },
  {
    // Back row, right.
    id: "orient-tote",
    src: src("orient-tote"),
    aspect: 1,
    height: 1.6,
    scale: 1,
    pos: [0.88, 1.05, -1.15],
    rot: [-1 * D, -3 * D, 0],
    lift: [0.04, 0.08, 0.05],
    turn: [0, -2 * D, 0],
    parallax: 0.4,
  },
  {
    // Front row, left, turned in.
    id: "clear-wave-bottle",
    src: src("clear-wave-bottle"),
    aspect: 768 / 1024,
    height: 1.95,
    scale: 1,
    pos: [-1.32, -0.45, -0.35],
    rot: [-1 * D, 9 * D, 0],
    lift: [-0.05, 0.12, 0.1],
    turn: [0, 2.5 * D, 0],
    parallax: 0.72,
  },
  {
    // Front row, right, its mirror.
    id: "shaap-shaap-can",
    src: src("shaap-shaap-can"),
    aspect: 819 / 1024,
    height: 1.95,
    scale: 1,
    pos: [1.32, -0.45, -0.35],
    rot: [-1 * D, -9 * D, 0],
    lift: [0.05, 0.12, 0.1],
    turn: [0, -2.5 * D, 0],
    parallax: 0.72,
  },
  {
    // THE ONE THE EYE LANDS ON: forward, centred, the largest.
    id: "fruit-rush-bottle",
    src: src("fruit-rush-bottle"),
    aspect: 819 / 1024,
    height: 2.3,
    scale: 1,
    pos: [0, -0.36, 0.55],
    rot: [-1 * D, 0 * D, 0],
    lift: [0, 0.16, 0.16],
    turn: [0, 0 * D, 0],
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
