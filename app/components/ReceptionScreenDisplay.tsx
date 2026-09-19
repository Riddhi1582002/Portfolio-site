"use client";

// THE RECEPTION SCREEN CARD — the third holder on the ring.
//
// Screen pieces, staged as screens: several actual 16:9 visuals standing
// as physical panels on the same lit surface, one a step forward and
// slightly larger, the others behind and to either side. Same dark stones
// at the base, same warm bulb behind the frame, same case as the two cards
// before it — what changes is only that these panels are 16:9 rather than
// square, and every one keeps that ratio exactly.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";
import { RECEPTION_CARD_PIECES } from "./receptionScreenAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;

/** The staging, front-most last. Each slot's `height` is the panel's own
 *  height in scene units; its width follows from the piece's 16:9 ratio,
 *  and `pos[1]` is the groundline plus half that height so the panel
 *  stands on the surface rather than floating over it. */
const SLOTS: Omit<StackPiece, "src" | "aspect">[] = [
  {
    id: "rtv-back-left",
    height: 1.16,
    scale: 1,
    pos: [-1.62, FLOOR_Y + 1.16 / 2, -1.0],
    rot: [-2 * D, 16 * D, -3 * D],
    lift: [-0.05, 0.1, 0.06],
    turn: [0, 3 * D, 0],
    parallax: 0.45,
  },
  {
    id: "rtv-back-right",
    height: 1.22,
    scale: 1,
    pos: [1.5, FLOOR_Y + 1.22 / 2 + 0.52, -0.82],
    rot: [-3 * D, -17 * D, 2.5 * D],
    lift: [0.05, 0.11, 0.06],
    turn: [0, -3 * D, 0],
    parallax: 0.52,
  },
  {
    id: "rtv-right-low",
    height: 1.04,
    scale: 1,
    pos: [1.74, FLOOR_Y + 1.04 / 2, 0.24],
    rot: [-3 * D, -13 * D, 4 * D],
    lift: [0.06, 0.12, 0.09],
    turn: [0, -2.5 * D, 0],
    parallax: 0.7,
  },
  {
    // THE DOMINANT ONE: forward, centred and the largest.
    id: "rtv-front",
    height: 1.5,
    scale: 1,
    pos: [-0.12, FLOOR_Y + 1.5 / 2, 1.0],
    rot: [-2.5 * D, -3 * D, -1 * D],
    lift: [0.02, 0.15, 0.16],
    turn: [0, -1.5 * D, 0],
    parallax: 1,
  },
];

export const RECEPTION_SCREEN_CARD_PIECES: StackPiece[] = RECEPTION_CARD_PIECES.map(
  (piece, i) => ({
    ...SLOTS[Math.min(i, SLOTS.length - 1)],
    id: `rtv-${piece.n}`,
    src: piece.src,
    aspect: piece.w / piece.h,
  })
);

export function preloadReceptionScreen() {
  preloadStack(RECEPTION_SCREEN_CARD_PIECES);
}

export default function ReceptionScreenDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  const options = useMemo(
    () => ({ fov: 26, camZ: 11.6, camY: 0.1, floorY: FLOOR_Y, rocks: true }),
    []
  );
  return (
    <ArtworkStackDisplay
      pieces={RECEPTION_SCREEN_CARD_PIECES}
      luminance={luminance}
      reduced={reduced}
      options={options}
      dataAttr="data-reception-screen"
    />
  );
}
