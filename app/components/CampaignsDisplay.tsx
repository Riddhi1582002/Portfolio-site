"use client";

// THE CAMPAIGNS / SOCIAL CARD — the second holder on the ring.
//
// Four actual posts, staged as a small physical stack on the same lit
// surface the publications stand on: one a step forward and slightly
// larger, the other three leaning behind and around it so the group reads
// as a handful of printed squares set down together rather than a feed.
// Every one is used at its delivered 1:1 proportion, whole and uncropped,
// and no caption is drawn over any of them.
//
// THE FOUR ARE SPECIFIED, not chosen here: Departments/Info posts 001,
// 002 and 003, and Employee & Company post 001 — see campaignsAssets for
// what those filenames resolve to.

import { useMemo } from "react";
import ArtworkStackDisplay, { preloadStack, type StackPiece } from "./ArtworkStackDisplay";
import { DEPT_POSTS, EMPLOYEE_POSTS } from "./campaignsAssets";

const D = Math.PI / 180;

const SRC = {
  dept1: DEPT_POSTS[0].src,
  dept2: DEPT_POSTS[1].src,
  dept3: DEPT_POSTS[2].src,
  employee1: EMPLOYEE_POSTS[0].src,
};

// Every `pos[1]` is the groundline (floorY, -1.35) plus that panel's own
// half-height, so each square sits ON the surface rather than floating
// above it — the same rule the publications' own placements follow.
const FLOOR_Y = -1.35;
const at = (height: number, sink = 0) => FLOOR_Y + height / 2 - sink;

export const CAMPAIGN_CARD_PIECES: StackPiece[] = [
  {
    // Back left, leaning in: the deepest of the four.
    id: "dept-002",
    src: SRC.dept2,
    aspect: 1,
    height: 1.74,
    scale: 1,
    pos: [-1.44, at(1.74), -1.05],
    rot: [-3 * D, 15 * D, -4 * D],
    lift: [-0.05, 0.1, 0.06],
    turn: [0, 3 * D, 0],
    parallax: 0.45,
  },
  {
    // Back right, the tallest edge of the group.
    id: "dept-003",
    src: SRC.dept3,
    aspect: 1,
    height: 1.82,
    scale: 1,
    pos: [1.42, at(1.82), -0.78],
    rot: [-2 * D, -16 * D, 3 * D],
    lift: [0.05, 0.11, 0.06],
    turn: [0, -3 * D, 0],
    parallax: 0.5,
  },
  {
    // Left, half in front of the back pair.
    id: "employee-001",
    src: SRC.employee1,
    aspect: 1,
    height: 1.54,
    scale: 1,
    pos: [-1.08, at(1.54, 0.06), 0.16],
    rot: [-4 * D, 11 * D, 5 * D],
    lift: [-0.06, 0.13, 0.1],
    turn: [0, 2.5 * D, 0],
    parallax: 0.72,
  },
  {
    // THE DOMINANT ONE: forward, centred, and the largest — the piece the
    // eye lands on before it reads the rest as a group behind it.
    id: "dept-001",
    src: SRC.dept1,
    aspect: 1,
    height: 2.08,
    scale: 1,
    pos: [0.2, at(2.08, 0.1), 1.02],
    rot: [-3 * D, -4 * D, -1.5 * D],
    lift: [0.02, 0.16, 0.16],
    turn: [0, -1.5 * D, 0],
    parallax: 1,
  },
];

export function preloadCampaigns() {
  preloadStack(CAMPAIGN_CARD_PIECES);
}

export default function CampaignsDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  // Stable across renders: the engine remounts if this identity changes.
  const options = useMemo(
    () => ({ fov: 26, camZ: 12.6, camY: 0.18, floorY: FLOOR_Y, rocks: true }),
    []
  );
  return (
    <ArtworkStackDisplay
      pieces={CAMPAIGN_CARD_PIECES}
      luminance={luminance}
      reduced={reduced}
      options={options}
      dataAttr="data-campaigns"
    />
  );
}
