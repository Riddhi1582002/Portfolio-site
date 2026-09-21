"use client";

// THE APPLICATIONS CARD — the sixth holder on the ring.
//
// A brand applied to the things a company actually hands people: a
// Chemsource jerrycan, a letterhead, a mug, and a pat-on-the-back award.
// Every object is a SUPPLIED GLB, used as delivered.
//
// THE ARTWORK THOSE OBJECTS CARRY DID NOT ARRIVE WITH THEM. These files
// are geometry with flat colour materials and no textures at all — no
// Chemsource label, no letterhead logo, no certificate, no mug print. So
// they are staged as what was supplied: a blue drum, white ceramic, paper
// stock, gold trim. Nothing is drawn onto them, because inventing the
// branding is the one thing this project must not do. When the label
// artwork is supplied it becomes a texture on these same meshes and the
// composition below does not change.
//
// COMPOSITION, per the brief: the jerrycan dominant in the left
// foreground, the letterhead behind and to the right, the mug and the
// award building the depth between them, the award propped low and
// forward. A triangle, with the supplied stone at the base — everything
// standing on the groundline the ring shares.
//
// The lightbox, the bulb, the lighting, the hover and the arrival are
// SpatialCardEngine's, identical to the other five cards.

import { useEffect, useMemo, useRef } from "react";
import type * as THREEModule from "three";
import { mountSpatialCard, type SpatialCardObject } from "./SpatialCardEngine";
import type { RockPlacement } from "./sceneRocks";

const D = Math.PI / 180;
const FLOOR_Y = -1.35;

type AppObject = SpatialCardObject & { glb: string };

const BASE = "/model/applications";

/** loadAppRoot bases each object at y = 0, so a placement is just the
 *  groundline — see the note there. */
const stand = () => FLOOR_Y;

export const APPLICATION_OBJECTS: AppObject[] = [
  {
    // BEHIND AND RIGHT: the letterhead, leaning back so it reads as a
    // sheet propped against something rather than lying flat.
    id: "letterhead",
    glb: `${BASE}/excelsource-letterhead.glb`,
    scale: 0.92,
    pos: [0.96, stand() + 0.02, -1.24],
    rot: [-76 * D, -0.14, 2 * D],
    lift: [0.02, 0.05, 0.04],
    turn: [0, -1.2 * D, 0],
    parallax: 0.44,
  },
  {
    // THE DOMINANT OBJECT: nearest, largest, left of centre.
    id: "jerrycan",
    glb: `${BASE}/chemsource-jerrycan.glb`,
    scale: 0.76,
    pos: [-1.18, stand(), 0.5],
    rot: [0, 16 * D, 0],
    lift: [-0.02, 0.09, 0.11],
    turn: [0, 1.5 * D, 0],
    parallax: 1,
  },
  {
    // MID-DEPTH RIGHT, in front of the letterhead and behind the award.
    id: "mug",
    glb: `${BASE}/corporate-mug.glb`,
    scale: 0.58,
    pos: [0.42, stand(), 0.5],
    rot: [0, -28 * D, 0],
    lift: [0.03, 0.07, 0.08],
    turn: [0, -2 * D, 0],
    parallax: 0.74,
  },
  {
    // THE BASE OF THE TRIANGLE: propped low and nearest on the right.
    id: "award",
    glb: `${BASE}/pat-on-back-award.glb`,
    scale: 0.74,
    pos: [1.36, stand(), 1.02],
    rot: [0, -14 * D, 0],
    lift: [0.03, 0.06, 0.09],
    turn: [0, -1.6 * D, 0],
    parallax: 0.9,
  },
];

// This card's own stones — a plinth under the group on the right, one
// forward and left where the jerrycan does not reach. Same supplied rock,
// an arrangement of its own.
const ROCKS: RockPlacement[] = [
  { file: "rock-02.glb", pos: [1.92, -1.16, -0.5], rot: [0.18, 2.1, 0.22], scale: 0.094 },
  { file: "rock-02.glb", pos: [-2.18, -1.12, 1.12], rot: [-0.22, 0.8, -0.3], scale: 0.076 },
];

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

export function loadAppRoot(glb: string): Promise<import("three").Object3D> {
  let cached = rootCache.get(glb);
  if (cached) return cached;
  cached = getLoader().then(
    ({ THREE, loader }) =>
      new Promise<import("three").Object3D>((resolve) => {
        loader.load(
          glb,
          (gltf) => {
            // THESE FILES ARE Z-UP. Every one of them measures taller in Z
            // than in Y — the jerrycan 2.03 against 0.75, the award 1.92
            // against 0.25 — which is a Blender export convention, not a
            // set of objects that happen to be lying down. Dropped into a
            // Y-up scene as delivered they do lie down: the can on its
            // side, the mug on its face, the award flat on the floor.
            // Turned a quarter about X first, everything below is measured
            // on the object as it will actually stand.
            const root = new THREE.Group();
            gltf.scene.rotation.x = -Math.PI / 2;
            root.add(gltf.scene);

            // Centred in X and Z, BASED in Y: these objects stand on
            // something, and an object centred on its own middle floats
            // half its height above the floor it was placed on.
            const box = new THREE.Box3().setFromObject(root);
            const c = box.getCenter(new THREE.Vector3());
            gltf.scene.position.x -= c.x;
            gltf.scene.position.z -= c.z;
            gltf.scene.position.y -= box.min.y;
            root.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            });
            resolve(root);
          },
          undefined,
          () => resolve(new THREE.Group())
        );
      })
  );
  rootCache.set(glb, cached);
  return cached;
}

export function preloadApplications() {
  for (const o of APPLICATION_OBJECTS) void loadAppRoot(o.glb);
}

export default function ApplicationsDisplay({
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
      camZ: 10.8,
      camY: 0.2,
      contentScale: 0.82,
      floorY: FLOOR_Y,
      rocks: ROCKS,
      // Moulded plastic, glazed ceramic and a gold trim all need something
      // to reflect to be those materials at all.
      environment: 0.42,
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
        APPLICATION_OBJECTS,
        (item) => loadAppRoot(item.glb),
        lumRef,
        reduced,
        options
      );
    })().catch((err) => console.error("ApplicationsDisplay:", err));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced, options]);

  return <div ref={hostRef} data-applications="" style={{ width: "100%", height: "100%" }} />;
}
