"use client";

// THE MINERAL PROPS.
//
// Both Publications scenes — the card's compact still life and the index
// page's wide floor display — stage the publications against dark, natural
// stones, the way the references do: something with real weight in the
// foreground for the printed pieces to read against. They are environmental
// props, never focal points.
//
// ONE SUPPLIED GLB, not a procedural shape and not several different rock
// files. An earlier pass generated stones as a jittered icosahedron —
// deterministic and cheap, but it reads as exactly what it is: a low-poly
// ball with noise on it, not an eroded natural form (uneven planes,
// asymmetric silhouette, no two faces the same size). A later pass used two
// different sculpted GLBs for the two placements; the brief now calls for a
// single supplied rock (converted from the delivered rock.usd) reused at
// different scale/rotation/position instead — real weight and correct
// geometry without introducing a second asset. Loaded and cached the same
// way the publications themselves are — see PublicationsDisplay's own
// module-scope cache for the pattern this mirrors.

import type * as THREEModule from "three";

const ROCK_BASE = "/model/publications";

export type RockFile = "rock.glb";

export type RockPlacement = {
  file: RockFile;
  pos: [number, number, number];
  rot: [number, number, number];
  scale: number;
};

let rockLoaderPromise: Promise<
  InstanceType<typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader>
> | null = null;
function getRockLoader() {
  rockLoaderPromise ??= import("three/examples/jsm/loaders/GLTFLoader.js").then(
    ({ GLTFLoader }) => new GLTFLoader()
  );
  return rockLoaderPromise;
}

// One cache entry per FILE, not per placement — the same two stones are
// used, at different positions and scales, by both the card and the index
// page, and (within the index page) more than once each along the floor.
const rockRootCache = new Map<string, Promise<import("three").Object3D>>();
function loadRockRoot(
  THREE: typeof THREEModule,
  file: RockFile
): Promise<import("three").Object3D> {
  let cached = rockRootCache.get(file);
  if (cached) return cached;
  cached = getRockLoader().then(
    (loader) =>
      new Promise<import("three").Object3D>((resolve) => {
        loader.load(
          `${ROCK_BASE}/${file}`,
          (gltf) => {
            const root = gltf.scene;
            // Centred on its own bounding box, same as a publication's own
            // root (see processRoot in PublicationsDisplay) — without
            // this, `pos` in a placement refers to wherever the file's own
            // pivot happens to sit, not to the stone's actual centre, and
            // every placement has to be discovered by trial rather than
            // reasoned about.
            const box = new THREE.Box3().setFromObject(root);
            const centre = box.getCenter(new THREE.Vector3());
            root.position.sub(centre);
            root.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (!mesh.geometry.getAttribute("normal")) mesh.geometry.computeVertexNormals();
              const mat = mesh.material as import("three").MeshStandardMaterial;
              // The supplied material reads as a flat mid grey (~0.59) —
              // true to the sculpt, but well short of the dark charcoal
              // stone the reference calls for, and under this scene's warm
              // bulb + cool hemisphere fill a plain multiply still read as
              // a pale blue-grey pebble rather than stone. Darkened here
              // rather than re-exported, to a fixed dark charcoal value
              // rather than a multiply of the bake: this rock's own colour
              // is a flat constant with no per-face variation to preserve,
              // so a multiply and a fixed target land in the same place.
              // Not pushed all the way to near-black — bare charcoal with
              // no light response at all is what read as a hole cut in the
              // floor during this scene's own earlier (procedural) pass;
              // the PBR roughness/metalness on the material still carries
              // the surface's lit detail at this value.
              if (mat?.color) mat.color.setRGB(0.09, 0.085, 0.08);
            });
            resolve(root);
          },
          undefined,
          // A stone that fails to load simply is not there — the floor
          // still reads correctly without it, so this resolves to an
          // empty group rather than breaking the composition around it.
          () => resolve(new THREE.Group())
        );
      })
  );
  rockRootCache.set(file, cached);
  return cached;
}

/**
 * Loads (from cache, after the first call anywhere) and adds one clone per
 * placement to `parent`. Asynchronous — unlike the old procedural
 * generator — so callers add it to their own loading sequence rather than
 * expecting stones to be in the scene on the same frame the engine mounts.
 */
export async function addRocks(
  THREE: typeof THREEModule,
  parent: import("three").Object3D,
  placements: RockPlacement[]
): Promise<void> {
  const resolved = await Promise.all(
    placements.map(async (p) => ({ p, root: await loadRockRoot(THREE, p.file) }))
  );
  for (const { p, root } of resolved) {
    const instance = root.clone(true);
    instance.scale.setScalar(p.scale);
    instance.position.set(...p.pos);
    instance.rotation.set(...p.rot);
    parent.add(instance);
  }
}

/**
 * A dark, faintly glossy ground plane whose own alpha falls off radially.
 *
 * A plain opaque plane is only usable where the camera looks far enough
 * DOWN that the plane's far edge leaves the frame. Both of these scenes sit
 * close to level with the group, so an opaque plane draws its far edge as a
 * hard horizon straight across the composition. Fading the plane's alpha
 * out around the group instead gives the contact and the sheen of a real
 * surface with no edge to see — the surface simply stops being lit, the way
 * a table in a dark room does.
 */
export function makeFadedFloor(
  THREE: typeof THREEModule,
  {
    size,
    y,
    color,
    /** Fraction of the plane's radius that stays fully opaque before the
     *  falloff starts — i.e. how much floor the composition gets to stand
     *  on. The fade has to begin outside the group, or the ground drops
     *  away under the pieces at the ends of it. */
    core,
    roughness,
    metalness,
  }: {
    size: number;
    y: number;
    color: number;
    core: number;
    roughness: number;
    metalness: number;
  }
): import("three").Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Weighted hard toward the centre: perspective crushes the far half of
  // the plane into a thin band near the horizon, so a linear falloff in
  // plane-space still reads as an edge on screen.
  const at = (t: number) => core + (1 - core) * t;
  g.addColorStop(0, "#ffffff");
  g.addColorStop(core, "#ffffff");
  g.addColorStop(at(0.35), "#7a7a7a");
  g.addColorStop(at(0.7), "#101010");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const alphaMap = new THREE.CanvasTexture(canvas);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      alphaMap,
      transparent: true,
      // Left out of the depth buffer so the stones and the publications
      // standing ON it are never sorted behind their own ground.
      depthWrite: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.receiveShadow = true;
  return floor;
}
