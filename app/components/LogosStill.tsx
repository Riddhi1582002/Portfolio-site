"use client";

// THE PROJECT PAGE'S STILL LIFE.
//
// The same four supplied objects as the card, staged larger and to the
// brief's own arrangement: Fruit Rush at the LEFT foreground, Clear Wave
// upper right, the MEL tanker behind them both, and the Orient Industries
// card low and forward — a triangle with real depth rather than a row.
//
// It is the SAME engine, the same lightbox, the same stones and the same
// lighting as every card on the ring, so this reads as one room along from
// the studio the card was photographed in rather than as a separate
// gallery. What differs is the framing (wider, because there is more room
// here) and the focus below.
//
// FOCUS. Selecting a project in the run does not swap the picture: it
// brings that object's own holder a little forward and lifts it, and lets
// the other three settle back. One tween per object, on the group the
// engine already built, so nothing about the composition is rebuilt and
// the arrangement the reader was looking at is still the one in front of
// them.

import { useEffect, useMemo, useRef } from "react";
import type * as THREEModule from "three";
import { mountSpatialCard, type SpatialCardObject } from "./SpatialCardEngine";
import type { RockPlacement } from "./sceneRocks";
import { loadLogoRoot } from "./LogosDisplay";
import { LOGO_PROJECTS } from "./logosAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.5;

type LogoObject = SpatialCardObject & { glb: string };

/**
 * STANDING ON THE GROUNDLINE.
 *
 * Just the floor — loadLogoRoot has already moved each object so its own
 * base sits at y = 0, so adding half its height here would raise it by
 * that much again. It did: every bottle stood half its own height in the
 * air and ran out of the top of the frame.
 */
const stand = () => FLOOR_Y;
const glbOf = (id: string) => LOGO_PROJECTS.find((p) => p.id === id)!.glb;

const OBJECTS: LogoObject[] = [
  {
    id: "mel",
    glb: glbOf("mel"),
    scale: 0.98,
    pos: [1.02, stand() - 0.02, -1.74],
    rot: [0, -15 * D, 0],
    lift: [0.02, 0.04, 0.04],
    turn: [0, -1 * D, 0],
    parallax: 0.4,
  },
  {
    // LEFT FOREGROUND, per the brief.
    id: "fruit-rush",
    glb: glbOf("fruit-rush"),
    scale: 0.86,
    pos: [-1.24, stand(), 0.94],
    rot: [0, 9 * D, 0],
    lift: [-0.02, 0.09, 0.11],
    turn: [0, 1.4 * D, 0],
    parallax: 1,
  },
  {
    // UPPER RIGHT of the pair, a step behind Fruit Rush.
    id: "clear-wave",
    glb: glbOf("clear-wave"),
    scale: 0.82,
    pos: [-0.12, stand(), 0.3],
    rot: [0, -7 * D, 0],
    lift: [0.01, 0.09, 0.1],
    turn: [0, -1.4 * D, 0],
    parallax: 0.86,
  },
  {
    id: "orient-industries",
    glb: glbOf("orient-industries"),
    scale: 0.96,
    pos: [1.36, FLOOR_Y + 0.32, 1.42],
    // FACE UP, NOT FACE DOWN. The card is modelled lying flat in XZ with
    // its printed side a paper's thickness above it on the +Y face
    // (orient_industries_logo at y = 0.021, over a slab that stops at
    // 0.0175). Rotating -72 degrees about X turns that face away from the
    // lens, so what the composition showed was the blank underside of a
    // business card — a cream rectangle with nothing on it, in a project
    // whose whole subject is the mark printed on it. Tipping it the other
    // way stands it up towards the reader with the artwork outwards.
    rot: [72 * D, -0.22, 4 * D],
    lift: [0.04, 0.06, 0.08],
    turn: [0, -1.8 * D, 0],
    parallax: 0.9,
  },
];

// A third stone here, and all three placed differently from the card's
// two: same supplied rock, a composition of its own.
// THE STONES SIT INSIDE THE CASE — same correction as the cards.
//
// A stone is nearer the lens than the panel behind it, so it projects
// wider than the panel does: at |x| around two and a half these were all
// outside the frame, on the black. The limit is the panel's own edge
// carried forward to the stone's depth, |x| + r <= half * (camZ - z) /
// (camZ + 1.62), taken at about six sevenths of it. The third stone was
// also BEHIND the panel, where an opaque sheet hid it completely.
const ROCKS: RockPlacement[] = [
  { file: "rock-02.glb", pos: [-1.19, -1.28, 1.06], rot: [0.26, 0.9, -0.24], scale: 0.104 },
  { file: "rock-02.glb", pos: [1.42, -1.26, 0.18], rot: [-0.3, 2.3, 0.36], scale: 0.082 },
  { file: "rock-02.glb", pos: [0.32, -1.32, -1.3], rot: [0.12, 1.7, -0.1], scale: 0.062 },
];

export default function LogosStill({ focusId }: { focusId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lumRef = useRef(1);
  // Read by the engine every frame; see SpatialCardOptions.focusRef for
  // why this is a ref rather than a tween from out here.
  const focusRef = useRef<string | null>(focusId);

  const options = useMemo(
    () => ({
      fov: 28,
      camZ: 11.4,
      camY: 0.26,
      contentScale: 0.96,
      floorY: FLOOR_Y,
      rocks: ROCKS,
      // Glass and brushed metal, not printed paper: without something to
      // reflect, a clear bottle renders as flat white. See
      // SpatialCardOptions.environment.
      environment: 0.55,
      focusRef,
      // Wider than the cards': this frame has more room, and the case
      // still has to read on all four sides of it.
      lightbox: 2.38,
    }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const THREE = (await import("three")) as unknown as typeof THREEModule;
      if (disposed) return;
      cleanup = mountSpatialCard(
        host,
        THREE,
        OBJECTS,
        (item) => loadLogoRoot(item.glb),
        lumRef,
        false,
        options
      );
    })().catch((err) => console.error("LogosStill:", err));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [options]);

  // THE FOCUS. One value, handed to the engine, which eases it on the same
  // clock as hover and arrival — so the three cannot fight over the same
  // holder, which is exactly what happens when this is tweened from here.
  useEffect(() => {
    focusRef.current = focusId;
  }, [focusId]);

  return <div ref={hostRef} data-logos-still="" style={{ width: "100%", height: "100%" }} />;
}
