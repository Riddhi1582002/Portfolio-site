"use client";

// THE LOGOS CARD — the first holder on the ring.
//
// A branding still life: two bottles carrying their identities, the tanker
// standing behind them, and a printed business card set down in front. The
// objects are the SUPPLIED GLBs and each one arrived with its identity
// already applied as a texture, so nothing here redraws, recolours or
// re-sets a mark — the branding on screen is the designer's own file.
//
// COMPOSITION, per the brief: Clear Wave and Fruit Rush are the foreground
// pair, MEL sits behind them, and the Orient Industries card is lower and
// in front. Read as a triangle — the two bottles carry the height, the
// tanker fills the space between and behind their shoulders, and the card
// closes the base. Everything stands ON the groundline the whole ring
// shares, so `pos[1]` is the floor plus that object's own half-height at
// its own scale rather than a number chosen by eye.
//
// Everything else — the lightbox, the bulb behind it, the stones, the
// lighting, the hover and the load-then-arrive sequence — is
// SpatialCardEngine, identical to the other four cards. That is the point:
// a different project, photographed in the same studio.

import { useEffect, useMemo, useRef } from "react";
import type * as THREEModule from "three";
import { mountSpatialCard, type SpatialCardObject } from "./SpatialCardEngine";
import type { RockPlacement } from "./sceneRocks";
import { LOGO_PROJECTS } from "./logosAssets";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;

type LogoObject = SpatialCardObject & { glb: string };

// The supplied GLBs' own heights, so a scale here means a real size on the
// floor rather than a guess. Measured off each file's bounding box.

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

export const LOGOS_CARD_OBJECTS: LogoObject[] = [
  {
    // BEHIND, and the widest thing in the frame: the tanker fills the gap
    // between the bottles' shoulders and gives the group its back wall.
    id: "mel",
    glb: glbOf("mel"),
    scale: 0.86,
    pos: [0.86, stand() - 0.02, -1.52],
    rot: [0, -13 * D, 0],
    lift: [0.02, 0.04, 0.04],
    turn: [0, -1.2 * D, 0],
    parallax: 0.42,
  },
  {
    // FOREGROUND LEFT. Slightly the taller of the pair.
    id: "clear-wave",
    glb: glbOf("clear-wave"),
    scale: 0.78,
    pos: [-0.92, stand(), 0.46],
    rot: [0, 11 * D, 0],
    lift: [-0.02, 0.09, 0.1],
    turn: [0, 1.6 * D, 0],
    parallax: 0.9,
  },
  {
    // FOREGROUND RIGHT, a step nearer the lens and overlapping the tanker.
    id: "fruit-rush",
    glb: glbOf("fruit-rush"),
    scale: 0.74,
    pos: [0.02, stand(), 0.9],
    rot: [0, -6 * D, 0],
    lift: [0.01, 0.1, 0.12],
    turn: [0, -1.4 * D, 0],
    parallax: 1,
  },
  {
    // THE BASE OF THE TRIANGLE: propped low and forward, right of centre,
    // where a card set down against the stones would be.
    id: "orient-industries",
    glb: glbOf("orient-industries"),
    scale: 0.82,
    pos: [1.22, FLOOR_Y + 0.3, 1.22],
    // FACE UP, NOT FACE DOWN. The card is modelled lying flat in XZ with
    // its printed side a paper's thickness above it on the +Y face
    // (orient_industries_logo at y = 0.021, over a slab that stops at
    // 0.0175). Rotating -72 degrees about X turns that face away from the
    // lens, so what the composition showed was the blank underside of a
    // business card — a cream rectangle with nothing on it, in a project
    // whose whole subject is the mark printed on it. Tipping it the other
    // way stands it up towards the reader with the artwork outwards.
    rot: [72 * D, -0.24, 5 * D],
    lift: [0.04, 0.06, 0.08],
    turn: [0, -2 * D, 0],
    parallax: 0.86,
  },
];

// This card's own stones: one at the near left where the bottles do not
// reach, one further back on the right under the tanker's shadow. Same
// supplied rock, a different arrangement from every other card's.
// THE STONES SIT INSIDE THE CASE.
//
// They did not. The lightbox panel is two units half-wide at z = -1.62,
// and every card had put its stones at |x| around two — but a stone is
// nearer the lens than the panel is, so it projects WIDER than the panel
// does and every one of them landed outside the frame, on the black.
// The limit is the panel's own edge carried forward to the stone's depth,
// |x| + r <= 2 * (camZ - z) / (camZ + 1.62), taken at about six sevenths
// so they are clearly within it rather than touching it.
const ROCKS: RockPlacement[] = [
  { file: "rock-02.glb", pos: [-1.0, -1.14, 0.94], rot: [0.3, 1.1, -0.2], scale: 0.088 },
  { file: "rock-02.glb", pos: [1.28, -1.12, -0.9], rot: [-0.25, 2.5, 0.4], scale: 0.072 },
];

// ── LOADING ─────────────────────────────────────────────────────────────
// The same two-layer pattern the publications card uses: one shared THREE +
// GLTFLoader, and one cached root per file so a second view of the same
// object (the project page) re-uses the decode instead of repeating it.
let loaderPromise: Promise<{
  THREE: typeof THREEModule;
  loader: InstanceType<typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader>;
}> | null = null;
function getLoader() {
  loaderPromise ??= (async () => {
    const THREE = await import("three");
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    return { THREE, loader: new GLTFLoader() };
  })();
  return loaderPromise;
}

const rootCache = new Map<string, Promise<import("three").Object3D>>();

export function loadLogoRoot(glb: string): Promise<import("three").Object3D> {
  let cached = rootCache.get(glb);
  if (cached) return cached;
  cached = getLoader().then(
    ({ THREE, loader }) =>
      new Promise<import("three").Object3D>((resolve) => {
        loader.load(
          glb,
          (gltf) => {
            const root = gltf.scene;
            // Centred on its own bounding box in X and Z only: Y is left
            // alone because these objects STAND on something, and a bottle
            // centred on its own middle floats half its height off the
            // floor the composition put it on.
            const box = new THREE.Box3().setFromObject(root);
            const c = box.getCenter(new THREE.Vector3());
            root.position.x -= c.x;
            root.position.z -= c.z;
            root.position.y -= box.min.y;
            root.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const m of mats) {
                const mat = m as import("three").MeshStandardMaterial;
                // The supplied materials multiply their own artwork down to
                // 40% — right for the renderer they were authored in, far
                // too dark under this card's low-key key light, where the
                // label is the whole point. Lifted to full so the supplied
                // texture reads as itself; the texture is untouched.
                if (mat?.map && mat.color) mat.color.setRGB(1, 1, 1);
                // AND THE ARTWORK HAS TO FACE WHICHEVER WAY WE LOOK AT IT.
                //
                // Every mark in these files is its own paper-thin mesh laid
                // on the object — orient_industries_logo sitting on
                // orient_industries_card, geometry_3 on the tanker's flank —
                // and all of them arrived single-sided. A single-sided plane
                // seen from behind draws nothing, which is why the business
                // card rendered as a blank cream rectangle at the angle the
                // composition props it at, and why the tanker's mark never
                // appeared at all. A decal with no thickness has no back for
                // double-siding to contradict.
                if (mat?.map) {
                  mat.side = THREE.DoubleSide;
                  // THE CARD'S MARK IS AUTHORED UPSIDE DOWN.
                  //
                  // orient_industries_logo is a plane a paper's thickness
                  // above the card's slab, on its +Y face — so the card has
                  // to be tipped +72 degrees, not -72, or the opaque slab
                  // is in front of its own artwork and the card renders as
                  // a blank cream rectangle. Turned that way up, the mark
                  // comes out inverted: the plane's V axis runs opposite to
                  // the image's. Flipping the SAMPLING in V puts it back.
                  // Measured, not assumed — a horizontal flip and a 180
                  // degree turn were both tried against a zoom of the card
                  // and both still read backwards. The image is untouched.
                  if (glb.endsWith("orient-card.glb")) {
                    mat.map.wrapS = THREE.RepeatWrapping;
                    mat.map.wrapT = THREE.RepeatWrapping;
                    mat.map.repeat.set(1, -1);
                    mat.map.offset.set(0, 1);
                    mat.map.needsUpdate = true;
                  }
                }
              }
            });
            resolve(root);
          },
          undefined,
          // One object that fails to load leaves the rest of the still life
          // standing rather than blanking the card.
          () => resolve(new THREE.Group())
        );
      })
  );
  rootCache.set(glb, cached);
  return cached;
}

export function preloadLogos() {
  for (const p of LOGO_PROJECTS) void loadLogoRoot(p.glb);
}

export default function LogosDisplay({
  luminance = 1,
  reduced = false,
}: {
  luminance?: number;
  reduced?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lumRef = useRef(luminance);
  useEffect(() => {
    lumRef.current = luminance;
  }, [luminance]);

  const options = useMemo(
    () => ({
      fov: 26,
      camZ: 10.9,
      camY: 0.2,
      contentScale: 0.9,
      floorY: FLOOR_Y,
      rocks: ROCKS,
      // Glass and brushed metal, not printed paper: without something to
      // reflect, a clear bottle renders as flat white. See
      // SpatialCardOptions.environment.
      environment: 0.5,
    }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const { THREE } = await getLoader();
      if (disposed) return;
      cleanup = mountSpatialCard(
        host,
        THREE,
        LOGOS_CARD_OBJECTS,
        (item) => loadLogoRoot(item.glb),
        lumRef,
        reduced,
        options
      );
    })().catch((err) => {
      console.error("LogosDisplay:", err);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced, options]);

  return <div ref={hostRef} data-logos="" style={{ width: "100%", height: "100%" }} />;
}
