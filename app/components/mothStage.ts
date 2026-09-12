"use client";

// WHERE THE CAMERA IS, for the moth.
//
// The site's cinematography is DOM: the hero scales its composition about
// a point inside the A, and the gallery scales its plane about the window's
// centre on the way home. Both are real camera moves expressed as a
// transform, and both are authoritative — nothing here changes them.
//
// This is the one-way channel the moth reads them through. The sections
// PUBLISH what their camera is doing (a screen-space scale of the content
// plane, and where the camera has moved to laterally); MothLayer converts
// that into the camera's own translation through space and carries the moth
// along with it, so the creature sits in the same world the camera is
// travelling through rather than on a layer pasted over it.
//
// A plain mutable singleton on purpose: it is written and read once per
// animation frame by code that is already running at frame rate, and
// routing that through React state would re-render two large trees sixty
// times a second to move one insect.

export type MothPhase = "hero" | "reels" | "cord" | "pencil" | "gallery";

export type MothStage = {
  /** Which beat owns the frame. A change is a CUT, not a camera move. */
  phase: MothPhase;
  /**
   * Bumped by whoever knows a discontinuity is coming that `phase` alone
   * cannot describe — the return transition's dolly snapping back to 1 at
   * the end of the flight home. Continuity is keyed on phase AND epoch, so
   * a bump means "the camera did not travel here, the shot changed".
   */
  epoch: number;
  /**
   * The screen-space scale the camera's dolly currently applies to the
   * content plane: 1 at rest, `zoom` during the A push, `dolly` during the
   * gallery's flight home. The moth layer reads the camera's DISTANCE to
   * that plane out of it — D0 / scale — and the change in that distance
   * between frames is how far the camera physically travelled.
   */
  cameraScale: number;
  /** The camera's lateral position, in viewport px from the frame's centre. */
  cameraX: number;
  cameraY: number;
  /**
   * The A's counter — its triangular negative space — in viewport px, with
   * the radius of the space inside it. Null until the wordmark has been
   * measured. `aStaging` is how much this is the thing to be around: it
   * rises before the push so the moth is ALREADY there when the camera
   * arrives, rather than being sent for.
   */
  aCounterX: number;
  aCounterY: number;
  aCounterR: number;
  aStaging: number;
};

export const mothStage: MothStage = {
  phase: "hero",
  epoch: 0,
  cameraScale: 1,
  cameraX: 0,
  cameraY: 0,
  aCounterX: 0,
  aCounterY: 0,
  aCounterR: 0,
  aStaging: 0,
};

/** Published by the beat that owns the pane. `scale` omitted = leave it. */
export function setMothCamera(next: {
  phase: MothPhase;
  cameraScale?: number;
  cameraX?: number;
  cameraY?: number;
  aCounterX?: number;
  aCounterY?: number;
  aCounterR?: number;
  aStaging?: number;
}) {
  mothStage.phase = next.phase;
  if (next.cameraScale != null) mothStage.cameraScale = next.cameraScale;
  if (next.cameraX != null) mothStage.cameraX = next.cameraX;
  if (next.cameraY != null) mothStage.cameraY = next.cameraY;
  if (next.aCounterX != null) mothStage.aCounterX = next.aCounterX;
  if (next.aCounterY != null) mothStage.aCounterY = next.aCounterY;
  if (next.aCounterR != null) mothStage.aCounterR = next.aCounterR;
  if (next.aStaging != null) mothStage.aStaging = next.aStaging;
}

/** The gallery's return transition, which owns the dolly while it runs. */
export function setMothReturnDolly(scale: number) {
  mothStage.cameraScale = scale;
}

/** "What follows is a different shot" — see `epoch`. */
export function cutMothContinuity() {
  mothStage.epoch += 1;
}

/**
 * A read-only window onto the creature, for measuring it.
 *
 * The spec for this moth is written in sizes, positions and continuity —
 * "wingspan 40-80px", "already around the crossbar before the camera
 * arrives", "never resets" — and none of that can be checked from a
 * screenshot of a 50px insect. The loop writes its own numbers here once
 * a frame (assignments onto an object that already exists, no allocation),
 * and outside production the object is hung on `window.__moth` so a
 * browser test can read them. Nothing in the moth's behaviour reads it.
 */
export const mothDebug = {
  /** Frames since the layer mounted. */
  frame: 0,
  x: 0,
  y: 0,
  z: 0,
  /** Distance from the lens, px. Negative once the camera has passed it. */
  depth: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  speed: 0,
  /** Where it is on screen, px, and how wide its wings look there. */
  screenX: 0,
  screenY: 0,
  wingspanPx: 0,
  state: 0,
  /** The creature's own forward axis, in camera space. */
  fwdX: 0,
  fwdY: 0,
  fwdZ: 0,
  wingPhase: 0,
  bank: 0,
  /** Irradiance the rig is putting on it, per source kind. */
  lightBulb: 0,
  lightArt: 0,
  lightCard: 0,
  lightNarr: 0,
  /** Strongest pull this frame, and which kind it came from. */
  pull: 0,
  pullKind: -1,
  sources: 0,
  bumps: 0,
  bulbHits: 0,
  perches: 0,
  narrationPerches: 0,
  /** The composition's own movement, px/sec, and how long it has held still. */
  motion: 0,
  stillT: 0,
  /** Bumped whenever the layer would have had to restart the creature. */
  resets: 0,
  loaded: false,
  /** Whether the creature is in front of the lens and being drawn. */
  drawn: false,
  /** The shot the beats are publishing, echoed for the same measuring. */
  phase: "",
  camScale: 1,
  camX: 0,
  camY: 0,
  aStaging: 0,
};
