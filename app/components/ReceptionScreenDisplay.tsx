"use client";

// THE RECEPTION SCREEN CARD — the third holder on the ring.
//
// The work IS screen content, so the card stages actual displays: dark
// housings with the artwork inset and lit from within, standing on the
// same surface and against the same stones as the publications and the
// campaign posts. Not a grid of video thumbnails, and not flat prints of
// screen artwork either — the reception display is the object here, and
// what is on it is what the project is.
//
// THE COMPOSITION is a hero and its supporting frames, not a spread of
// equals: one large screen just left of centre carrying the frame, two
// smaller ones set back and to the right at different depths, and one
// small detail at the near right that the eye lands on last. Every one
// STANDS on the groundline — its y is the floor plus half its own height
// — because a screen resting on a surface is what this is about and a
// floating one is a screensaver. The group is tight and sits low in the
// frame, with the space above it left empty.
//
// Everything below the composition — renderer, lights, floor, rocks,
// hover, parallax, the load-then-arrive sequence — is SpatialCardEngine,
// unchanged and shared with the other cards, so all of them move and
// light the same way.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";
import type { RockPlacement } from "./sceneRocks";
import { RECEPTION_CARD_PIECES } from "./receptionScreenAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;
/** Every piece here is 16:9, and is used at exactly that. */
const ASPECT = 16 / 9;
/** The housing rim, as a share of a screen's own height. */
const BEZEL = 0.052;

/** Standing on the groundline, never above it. */
const stand = (h: number) => FLOOR_Y + h / 2 + BEZEL * h;

type Slot = Omit<StackPiece, "src" | "aspect">;

const SLOTS: Slot[] = [
  {
    // FAR LEFT, deepest and smallest: the edge of the group, mostly there
    // to give the hero something to stand in front of.
    id: "rs-back-left",
    height: 0.92,
    scale: 1,
    pos: [-2.02, stand(0.92), -1.5],
    rot: [-1.5 * D, 26 * D, -1.2 * D],
    lift: [-0.04, 0.05, 0.05],
    turn: [0, 2.2 * D, 0],
    parallax: 0.4,
    bezel: BEZEL * 0.92,
    emissive: 0.34,
  },
  {
    // BEHIND AND RIGHT: taller than the far left, still set back.
    id: "rs-back-right",
    height: 1.0,
    scale: 1,
    pos: [1.44, stand(1.0), -1.25],
    rot: [-2 * D, -23 * D, 1.4 * D],
    lift: [0.04, 0.06, 0.05],
    turn: [0, -2.4 * D, 0],
    parallax: 0.5,
    bezel: BEZEL * 1.0,
    emissive: 0.36,
  },
  {
    // NEAR RIGHT, small: the detail, closest to the lens and the last
    // thing the eye reaches.
    id: "rs-front-right",
    height: 0.78,
    scale: 1,
    pos: [1.72, stand(0.78), 0.5],
    rot: [-2.4 * D, -28 * D, 2.6 * D],
    lift: [0.06, 0.08, 0.1],
    turn: [0, -3 * D, 0],
    parallax: 0.78,
    bezel: BEZEL * 0.78,
    emissive: 0.38,
  },
  {
    // THE HERO: largest, nearest, just left of centre so the group reads
    // as a composition rather than a row.
    id: "rs-hero",
    height: 1.3,
    scale: 1,
    pos: [-0.62, stand(1.3), 0.95],
    rot: [-1.8 * D, -6 * D, -0.6 * D],
    lift: [0.01, 0.1, 0.14],
    turn: [0, -1.4 * D, 0],
    parallax: 1,
    bezel: BEZEL * 1.3,
    emissive: 0.46,
  },
];

// Four slots, and as many supplied stills as there are. The LAST slot is
// the hero, so the pieces fill from the back forward and whatever is most
// recent ends up carrying the frame.
export const RECEPTION_SCREEN_CARD_PIECES: StackPiece[] = SLOTS.map((slot, i) => ({
  ...slot,
  src: RECEPTION_CARD_PIECES[i % Math.max(1, RECEPTION_CARD_PIECES.length)],
  aspect: ASPECT,
})).filter((p) => Boolean(p.src));

// THIS CARD'S OWN STONES. The shared default puts one forward and LEFT,
// which on the other cards sits in open floor — here it landed across the
// hero screen's lower corner and cut the picture in half. Same supplied
// rock.glb, same role (weight at the base, something for the group to
// stand against), moved out to the margins this composition actually
// leaves empty.
const ROCKS: RockPlacement[] = [
  { file: "rock.glb", pos: [2.28, -1.1, 0.9], rot: [-0.3, 1.4, 0.5], scale: 0.08 },
  { file: "rock.glb", pos: [-1.96, -1.16, 1.02], rot: [0.4, 2.3, 0.2], scale: 0.092 },
];

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
    () => ({ fov: 26, camZ: 10.1, camY: 0.12, floorY: FLOOR_Y, rocks: ROCKS }),
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
