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

const FLOOR_Y = -1.35;

// A PYRAMID OF POSTS: the lead post large and forward; two behind it to
// either side, turned a few degrees in and raised so they show over its
// shoulders; the fourth highest and furthest back, centred. Each a clear
// step deeper than the one in front, so the stack reads in layers.
export const CAMPAIGN_CARD_PIECES: StackPiece[] = [
  {
    // Back, centred, highest.
    id: "dept-002",
    src: SRC.dept2,
    aspect: 1,
    height: 1.3,
    scale: 1,
    pos: [0, 1.26, -1.2],
    rot: [-1 * D, 0 * D, 0],
    lift: [0, 0.06, 0.04],
    turn: [0, 0 * D, 0],
    parallax: 0.35,
  },
  {
    // Left, a step nearer, turned in.
    id: "employee-001",
    src: SRC.employee1,
    aspect: 1,
    height: 1.5,
    scale: 1,
    pos: [-1.22, 0.32, -0.6],
    rot: [-1 * D, 10 * D, 0],
    lift: [-0.05, 0.1, 0.06],
    turn: [0, 2.5 * D, 0],
    parallax: 0.55,
  },
  {
    // Right, its mirror.
    id: "dept-003",
    src: SRC.dept3,
    aspect: 1,
    height: 1.5,
    scale: 1,
    pos: [1.22, 0.28, -0.6],
    rot: [-1 * D, -10 * D, 0],
    lift: [0.05, 0.1, 0.06],
    turn: [0, -2.5 * D, 0],
    parallax: 0.55,
  },
  {
    // THE LEAD POST: forward, centred, the largest.
    id: "dept-001",
    src: SRC.dept1,
    aspect: 1,
    height: 2.05,
    scale: 1,
    pos: [0, -0.55, 0.5],
    rot: [-1 * D, 0 * D, 0],
    lift: [0, 0.16, 0.16],
    turn: [0, 0 * D, 0],
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
  // THE SAME LENS AND THE SAME DISTANCE AS THE PUBLICATIONS CARD. At 12.6
  // this group sat small and adrift in the middle of its frame while the
  // card beside it filled its own — which is most of why this one read as
  // the weaker of the two. Nothing about the staging was wrong; the camera
  // was simply further away.
  const options = useMemo(
    () => ({ fov: 26, camZ: 10.6, camY: 0.2, contentScale: 0.7, floorY: FLOOR_Y }),
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
