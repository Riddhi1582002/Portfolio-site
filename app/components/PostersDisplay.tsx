"use client";

// THE POSTERS CARD — the sixth holder on the ring.
//
// Four of the prints propped together on the same lit floor the other
// holders use: one forward and larger, three standing behind it and
// turned a little towards it, so the group reads as printed posters set
// down in a room rather than a grid of thumbnails. Each is its supplied
// 4:5, whole and uncropped, and nothing is written over any of them.
//
// WHICH FOUR: the widest spread of the set's range in the fewest pieces —
// the blue dripping type of 01 carrying the front, with the black-and-
// white spiral of 13, the pink heart of 14 and the red-and-pink collage
// of 08 behind it. Four languages, one collection.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";
import { POSTER_ASPECT, POSTERS } from "./postersAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;
const at = (height: number, sink = 0) => FLOOR_Y + height / 2 - sink;
// Card-sized copies of the same posters (800x1000, resized, never
// cropped): the full files run to 3MB each, which is a lot of ring to
// wait for when the card shows them a few hundred pixels tall.
const src = (no: string) => {
  if (!POSTERS.some((p) => p.no === no)) throw new Error(`No poster ${no}`);
  return `/posters/card/${no}.jpg`;
};

export const POSTER_CARD_PIECES: StackPiece[] = [
  {
    // Back left, the deepest.
    id: "poster-13",
    src: src("13"),
    aspect: POSTER_ASPECT,
    height: 2.0,
    scale: 1,
    pos: [-1.22, at(2.0), -1.1],
    rot: [-2 * D, 16 * D, -2 * D],
    lift: [-0.05, 0.1, 0.06],
    turn: [0, 3 * D, 0],
    parallax: 0.45,
  },
  {
    // Back right, the tallest edge of the group.
    id: "poster-14",
    src: src("14"),
    aspect: POSTER_ASPECT,
    height: 2.1,
    scale: 1,
    pos: [1.24, at(2.1), -0.86],
    rot: [-2 * D, -17 * D, 2 * D],
    lift: [0.05, 0.11, 0.06],
    turn: [0, -3 * D, 0],
    parallax: 0.5,
  },
  {
    // Left, half in front of the back pair.
    id: "poster-08",
    src: src("08"),
    aspect: POSTER_ASPECT,
    height: 1.78,
    scale: 1,
    pos: [-1.02, at(1.78, 0.04), 0.22],
    rot: [-3 * D, 12 * D, 4 * D],
    lift: [-0.06, 0.13, 0.1],
    turn: [0, 2.5 * D, 0],
    parallax: 0.72,
  },
  {
    // THE ONE THE EYE LANDS ON: forward, a touch right of centre, largest.
    id: "poster-01",
    src: src("01"),
    aspect: POSTER_ASPECT,
    height: 2.36,
    scale: 1,
    pos: [0.34, at(2.36, 0.08), 1.0],
    rot: [-3 * D, -5 * D, -1.2 * D],
    lift: [0.02, 0.16, 0.16],
    turn: [0, -1.5 * D, 0],
    parallax: 1,
  },
];


export function preloadPosters() {
  preloadStack(POSTER_CARD_PIECES);
}

export default function PostersDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  const options = useMemo(
    () => ({ fov: 26, camZ: 10.8, camY: 0.22, contentScale: 0.8, floorY: FLOOR_Y }),
    []
  );
  return (
    <ArtworkStackDisplay
      pieces={POSTER_CARD_PIECES}
      luminance={luminance}
      reduced={reduced}
      options={options}
      dataAttr="data-posters"
    />
  );
}
