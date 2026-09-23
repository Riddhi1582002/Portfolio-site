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
// THE COMPOSITION is a hero and its supporting frames, not a spread of
// equals, and it runs on a DIAGONAL: 16:9 screens set side by side make a
// group three times as wide as it is tall, which in a square card is a
// thin strip with the card empty above it. Stepped back and up instead —
// the hero large at the front, one screen behind it to the left and
// higher, one further back to the right and higher again, and a small
// detail at the near right — the group fills the card. They hang in the
// studio's air like everything else on the ring, each a screen with a
// real housing.
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
    // BACK RIGHT, highest and deepest: the top of the diagonal.
    id: "rs-back-right",
    height: 1.12,
    scale: 1,
    pos: [0.74, 1.28, -0.95],
    rot: [-1.5 * D, -20 * D, 1.2 * D],
    lift: [0.04, 0.05, 0.05],
    turn: [0, -2.2 * D, 0],
    parallax: 0.4,
    bezel: BEZEL * 1.12,
    emissive: 0.34,
  },
  {
    // MIDDLE LEFT, a step nearer.
    id: "rs-back-left",
    height: 1.14,
    scale: 1,
    pos: [-0.94, 0.4, -0.5],
    rot: [-2 * D, 18 * D, -1.4 * D],
    lift: [-0.04, 0.06, 0.05],
    turn: [0, 2.4 * D, 0],
    parallax: 0.5,
    bezel: BEZEL * 1.14,
    emissive: 0.36,
  },
  {
    // NEAR RIGHT, small: the detail, closest to the lens and the last
    // thing the eye reaches.
    id: "rs-front-right",
    height: 0.76,
    scale: 1,
    pos: [1.5, -0.98, 1.15],
    rot: [-2.4 * D, -26 * D, 2.6 * D],
    lift: [0.06, 0.08, 0.1],
    turn: [0, -3 * D, 0],
    parallax: 0.78,
    bezel: BEZEL * 0.76,
    emissive: 0.38,
  },
  {
    // THE HERO: largest and nearest, at the foot of the diagonal.
    id: "rs-hero",
    height: 1.48,
    scale: 1,
    pos: [0.26, -0.52, 0.75],
    rot: [-1.8 * D, -6 * D, -0.6 * D],
    lift: [0.01, 0.1, 0.14],
    turn: [0, -1.4 * D, 0],
    parallax: 1,
    bezel: BEZEL * 1.48,
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
