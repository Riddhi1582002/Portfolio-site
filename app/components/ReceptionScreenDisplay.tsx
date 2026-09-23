"use client";

// THE RECEPTION SCREEN CARD — the third holder on the ring.
//
// The work IS screen content, so the card stages actual displays: dark
// housings with the artwork inset and lit from within, standing on the
// same surface as the publications and the campaign posts. Not a grid of video thumbnails, and not flat prints of
// screen artwork either — the reception display is the object here, and
// what is on it is what the project is.
//
// THE FOUR ON SCREEN are the four supplied for this card, and only those:
// Wall of Calm, Ganesh Chaturthi, the Pat-on-the-Back award and the quote
// poster. Card-sized copies (1280x720, resized, never cropped) so the ring
// is not decoding a 5760px original for a screen a few hundred pixels
// wide.
//
// THE COMPOSITION: a pyramid of screens, one behind another. The hero is
// large, level and forward; two screens stand behind it to either side,
// turned a few degrees in towards it and raised so their upper halves
// show over its shoulders; the smallest sits highest and furthest back,
// centred. Every screen is a clear step deeper than the one in front of
// it, and none is turned far enough for its housing to reach into its
// neighbour's — the earlier wide turns had one screen passing through
// another.
//
// Everything below the composition — renderer, lights, floor,
// hover, parallax, the load-then-arrive sequence — is SpatialCardEngine,
// unchanged and shared with the other cards, so all of them move and
// light the same way.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";

const CARD_STILLS = [
  "/reception-screen/card/quote-poster-02.jpg",
  "/reception-screen/card/pat-on-the-back.jpg",
  "/reception-screen/card/003.jpg",
  "/reception-screen/card/01.jpg",
];

const D = Math.PI / 180;
const FLOOR_Y = -1.35;
/** Every piece here is 16:9, and is used at exactly that. */
const ASPECT = 16 / 9;
/** The housing rim, as a share of a screen's own height. */
const BEZEL = 0.052;

type Slot = Omit<StackPiece, "src" | "aspect">;

const SLOTS: Slot[] = [
  {
    // BACK, CENTRED, HIGHEST: the top of the pyramid.
    id: "rs-back-right",
    height: 0.92,
    scale: 1,
    pos: [0, 1.3, -1.2],
    rot: [-1 * D, 0 * D, 0],
    lift: [0, 0.05, 0.04],
    turn: [0, 0 * D, 0],
    parallax: 0.35,
    bezel: BEZEL * 0.92,
    emissive: 0.34,
  },
  {
    // LEFT, a step nearer, turned in towards the hero.
    id: "rs-back-left",
    height: 1.08,
    scale: 1,
    pos: [-1.28, 0.42, -0.6],
    rot: [-1 * D, 11 * D, 0],
    lift: [-0.05, 0.06, 0.05],
    turn: [0, 2.4 * D, 0],
    parallax: 0.55,
    bezel: BEZEL * 1.08,
    emissive: 0.36,
  },
  {
    // RIGHT, its mirror.
    id: "rs-front-right",
    height: 1.08,
    scale: 1,
    pos: [1.28, 0.36, -0.6],
    rot: [-1 * D, -11 * D, 0],
    lift: [0.05, 0.06, 0.05],
    turn: [0, -2.4 * D, 0],
    parallax: 0.55,
    bezel: BEZEL * 1.08,
    emissive: 0.38,
  },
  {
    // THE HERO: largest, level, forward and centred.
    id: "rs-hero",
    height: 1.5,
    scale: 1,
    pos: [0, -0.62, 0.5],
    rot: [-1 * D, 0 * D, 0],
    lift: [0, 0.1, 0.14],
    turn: [0, 0 * D, 0],
    parallax: 1,
    bezel: BEZEL * 1.5,
    emissive: 0.46,
  },
];

// Four slots, four stills, back to front. The LAST slot is the hero:
// Ganesh Chaturthi, the most colourful of the four, carries the frame.
export const RECEPTION_SCREEN_CARD_PIECES: StackPiece[] = SLOTS.map((slot, i) => ({
  ...slot,
  src: CARD_STILLS[i],
  aspect: ASPECT,
}));


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
    () => ({ fov: 26, camZ: 10.1, camY: 0.12, contentScale: 0.78, floorY: FLOOR_Y }),
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
