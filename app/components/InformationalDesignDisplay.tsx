"use client";

// THE INFORMATIONAL DESIGN CARD — the fourth holder on the ring.
//
// The jacket, upright and dominant, with its leaflets stored in it. The
// leaflets are placed BEHIND the jacket panel and raised just enough that
// their top edges stand above its top edge — which is exactly what a
// stack of inserted leaflets looks like from the front, and the only part
// of them a closed jacket shows. They are not scattered around it, not
// fanned, and not floating: the jacket is what holds them up.
//
// HOVER teases the mechanism rather than performing it. Each leaflet's
// own `lift` raises it a few millimetres further out of the pocket while
// the jacket itself barely moves, so a little more of each one appears
// and then settles back. Nothing is ejected, and the card never becomes
// the project page's carousel.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";
import type { RockPlacement } from "./sceneRocks";
import { JACKET, LEAFLETS } from "./informationalDesignAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;

const JACKET_ASPECT = JACKET.panelW / JACKET.panelH;
const LEAFLET_ASPECT = LEAFLETS[0].w / LEAFLETS[0].h;

const JACKET_H = 3.18;
const LEAFLET_H = 2.76;

/** Three of the nine — enough to read as "several are in here", which is
 *  all the closed jacket can honestly show. */
const STORED = [LEAFLETS[0], LEAFLETS[1], LEAFLETS[2]];

// The jacket stands on the floor; each stored leaflet is set back behind
// it and raised so only its head shows over the jacket's top edge.
const JACKET_Y = FLOOR_Y + JACKET_H / 2;
const LEAFLET_Y = JACKET_Y + (JACKET_H - LEAFLET_H) / 2 + 0.2;

export const INFORMATIONAL_CARD_PIECES: StackPiece[] = [
  ...STORED.map((leaflet, i) => {
    // Fanned by a couple of degrees and a few centimetres each, the way a
    // hand-inserted stack sits — never a spread-out row.
    const shift = (i - 1) * 0.13;
    return {
      id: `leaflet-${leaflet.id}`,
      src: leaflet.pages[0],
      aspect: LEAFLET_ASPECT,
      height: LEAFLET_H,
      scale: 1,
      pos: [shift, LEAFLET_Y - i * 0.035, -0.16 - i * 0.045] as [number, number, number],
      rot: [-1.5 * D, (i - 1) * 2.4 * D, (1 - i) * 1.1 * D] as [number, number, number],
      // THE TEASE: a little further out of the pocket, and no more.
      lift: [0, 0.12 + i * 0.02, 0] as [number, number, number],
      turn: [0, 0, 0] as [number, number, number],
      parallax: 0.5,
    };
  }),
  {
    // THE JACKET, in front of everything it holds.
    id: "jacket",
    src: JACKET.frontCover,
    aspect: JACKET_ASPECT,
    height: JACKET_H,
    scale: 1,
    pos: [0, JACKET_Y, 0.2],
    rot: [-2 * D, -5 * D, -0.8 * D],
    // Barely moves: the jacket is the thing the leaflets move relative to.
    lift: [0, 0.015, 0.06],
    turn: [0, -1 * D, 0],
    parallax: 1,
  },
];

// THIS CARD'S OWN STONES — three, not two, and on the opposite side to
// the campaigns card's pair, so no two holders on the ring are staged the
// same way. Same supplied rock, same material.
const ROCKS: RockPlacement[] = [
  { file: "rock-02.glb", pos: [-2.04, -1.04, 0.55], rot: [0.2, 0.6, -0.35], scale: 0.128 },
  { file: "rock-02.glb", pos: [-1.3, -1.25, 1.12], rot: [-0.45, 2.9, 0.75], scale: 0.076 },
  { file: "rock-02.glb", pos: [1.96, -1.13, 0.34], rot: [0.5, 1.9, 0.2], scale: 0.094 },
];

export function preloadInformationalDesign() {
  preloadStack(INFORMATIONAL_CARD_PIECES);
}

export default function InformationalDesignDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  const options = useMemo(
    () => ({ fov: 26, camZ: 11.7, camY: 0.16, contentScale: 0.74, floorY: FLOOR_Y, rocks: ROCKS }),
    []
  );
  return (
    <ArtworkStackDisplay
      pieces={INFORMATIONAL_CARD_PIECES}
      luminance={luminance}
      reduced={reduced}
      options={options}
      dataAttr="data-informational-design"
    />
  );
}
