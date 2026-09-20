"use client";

// A CARD FULL OF FLAT WORK, STAGED AS PHYSICAL OBJECTS.
//
// The publications card holds real books, so its objects are GLBs. The
// two cards that follow it hold work that is flat by nature — square
// social posts, 16:9 screen pieces — and the mistake would be to lay them
// out as a grid of pictures inside a 3D frame. They are staged instead:
// each piece is a thin printed panel with actual thickness, leaning and
// overlapping on the same lit surface, against the same dark stones the
// publications stand on.
//
// Everything below the composition — renderer, lights, floor, rocks,
// hover, parallax, the load-then-arrive sequence — is SpatialCardEngine,
// unchanged and shared with the publications card, so all three cards on
// the ring move and light the same way. Only the objects differ.

import { useEffect, useRef } from "react";
import type * as THREEModule from "three";
import { mountSpatialCard, type SpatialCardObject } from "./SpatialCardEngine";

export type StackPiece = SpatialCardObject & {
  /** The supplied artwork, used at its own aspect ratio and never cropped. */
  src: string;
  /** width / height of that artwork, so the panel is cut to fit it. */
  aspect: number;
  /** Panel height in scene units; width follows from `aspect`. */
  height: number;
  /**
   * A DISPLAY RATHER THAN A PRINT. Given a bezel width (scene units), the
   * artwork is inset into a dark surround with real depth instead of being
   * the face of a flat card — which is the difference between a poster of
   * a screen and a screen. The artwork itself is untouched: the bezel is
   * added AROUND it, never cropped into it.
   */
  bezel?: number;
  /**
   * How much the face lights itself, 0..1. A screen is a light source; a
   * print only ever reflects one, and lighting a print this way is what
   * makes flat work look like it is printed on a lightbox. Left off, the
   * panel behaves exactly as it did.
   */
  emissive?: number;
};

// Printed-panel depth. Enough to catch the key light on the edge and read
// as an object rather than a decal, not so much that a square post starts
// looking like a block.
const PANEL_DEPTH = 0.055;

let loaderPromise: Promise<{ THREE: typeof THREEModule }> | null = null;
function getThree() {
  loaderPromise ??= import("three").then((THREE) => ({ THREE }));
  return loaderPromise;
}

// One texture per file for the whole session: the same post can appear on
// a card and, later, in that project's own page without being decoded
// twice.
const textureCache = new Map<string, Promise<import("three").Texture>>();
function loadTexture(THREE: typeof THREEModule, src: string) {
  let cached = textureCache.get(src);
  if (cached) return cached;
  cached = new Promise<import("three").Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
  textureCache.set(src, cached);
  return cached;
}

async function buildPanel(
  THREE: typeof THREEModule,
  piece: StackPiece
): Promise<import("three").Object3D> {
  const tex = await loadTexture(THREE, piece.src);
  const h = piece.height;
  const w = h * piece.aspect;
  const group = new THREE.Group();

  // The stock/backing: a printed panel's cut edges and its back are the
  // same dark card, only the face carries the artwork. Face order on a
  // BoxGeometry is +X, -X, +Y, -Y, +Z, -Z, so index 4 is the front.
  const edge = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c,
    roughness: 0.82,
    metalness: 0.02,
  });
  const face = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: piece.bezel ? 0.28 : 0.58,
    metalness: 0,
    // A screen emits; a print does not. Driving the emissive from the same
    // map keeps the artwork's own colour — it lifts the picture out of the
    // scene's shadow without tinting or flattening it.
    ...(piece.emissive
      ? {
          emissive: new THREE.Color(0xffffff),
          emissiveMap: tex,
          emissiveIntensity: piece.emissive,
        }
      : null),
  });

  if (piece.bezel) {
    // A DISPLAY: a dark housing with the picture inset in it. Two boxes,
    // not a texture trick — the surround catches the key light on its own
    // outer edge and casts its own shadow, which is what reads as a
    // physical screen standing on the surface.
    const b = piece.bezel;
    const shellDepth = PANEL_DEPTH * 3.6;
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x111114,
      roughness: 0.46,
      metalness: 0.28,
    });
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(w + b * 2, h + b * 2, shellDepth),
      shellMat
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    // The picture sits just proud of the housing's front face, so the
    // bezel reads as a rim around it rather than a border drawn on it.
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
    screen.position.z = shellDepth / 2 + 0.002;
    group.add(screen);
    return group;
  }

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, PANEL_DEPTH),
    [edge, edge, edge, edge, face, edge]
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function preloadStack(pieces: StackPiece[]) {
  void getThree().then(({ THREE }) => {
    for (const p of pieces) void loadTexture(THREE, p.src);
  });
}

export default function ArtworkStackDisplay({
  pieces,
  luminance = 1,
  reduced = false,
  options,
  dataAttr,
}: {
  pieces: StackPiece[];
  luminance?: number;
  reduced?: boolean;
  options?: Parameters<typeof mountSpatialCard>[6];
  /** Marks the host element, the way `data-publications` marks that card. */
  dataAttr?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lumRef = useRef(luminance);
  useEffect(() => {
    lumRef.current = luminance;
  }, [luminance]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const { THREE } = await getThree();
      if (disposed) return;
      cleanup = mountSpatialCard(
        host,
        THREE,
        pieces,
        (piece) => buildPanel(THREE, piece),
        lumRef,
        reduced,
        { rocks: true, ...options }
      );
    })().catch((err) => {
      // Decoration on a scroll beat, but a silent failure reads on screen
      // as an empty black square — same contract as PublicationsDisplay.
      console.error("ArtworkStackDisplay:", err);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pieces, reduced, options]);

  return (
    <div
      ref={hostRef}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
