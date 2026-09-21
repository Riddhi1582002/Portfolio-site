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
// files. The file is rock-02.glb, converted from the supplied rock.obj and
// normalised to the exact bounding box of the rock it replaces — so every
// placement and scale already authored in the scenes keeps working, and
// the swap changes the silhouette and nothing else. An earlier pass generated stones as a jittered icosahedron —
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

export type RockFile = "rock-02.glb";

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
              // Darker than the value this replaced (0.09): that was set
              // against a scene with no environment and no surface maps,
              // where anything lower went featureless. With both of those
              // in place the form is carried by the light response rather
              // than by the albedo, so the stone can finally BE dark —
              // under this rig's 2.1-intensity key and ACES tone mapping,
              // 0.09 was landing as a mid grey pebble.
              if (mat?.color) mat.color.setRGB(0.052, 0.049, 0.046);
              // THE SURFACE, which the file does not carry. See
              // makeStoneNoise: one tiling noise doing two jobs, so the
              // stone's light response varies across it the way a real
              // one's does instead of being a single constant over the
              // whole body.
              if (mat) {
                const noise = makeStoneNoise(THREE);
                mat.roughnessMap = noise;
                mat.bumpMap = noise;
                // Shallow on purpose: enough for the grain to catch a
                // grazing key light, not enough to fight the sculpt's own
                // eroded planes, which are the real silhouette.
                mat.bumpScale = 0.085;
                // The map MULTIPLIES these, so the base has to be the
                // ceiling rather than the file's 0.85 — otherwise the
                // brightest patches are still duller than bare stone.
                mat.roughness = 1;
                // Stone is a dielectric. The file's 0.05 was close enough
                // to matter only once there is an environment to reflect,
                // and then it reads as a faint metallic sheen.
                mat.metalness = 0;
                mat.needsUpdate = true;
              }
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


// ── THE STONE'S SURFACE ──────────────────────────────────────────────
//
// The supplied rock carries no maps at all: one flat base colour, one
// roughness number, one metalness number for the whole body. That is
// faithful to the sculpt and it is also why it read as a lump of grey
// putty — a real stone's light response varies across every face, and a
// single constant cannot vary. The geometry is not the problem and is not
// touched; what was missing is surface, and surface is rendering.
//
// So it is generated here, the same way makeFadedFloor already generates
// its own falloff: a tiling fractal-noise canvas, used as BOTH the
// roughness map (patches that catch the light and patches that swallow it)
// and the bump map (the pitting and grain that a silhouette this size
// cannot carry by itself). The mesh's own TEXCOORD_0 is what it lands on.
//
// Value noise summed over octaves, seeded and wrapped so the tile is
// seamless — nothing random per load, so two stones from the same file
// still look like two stones from the same file.

let stoneNoise: import("three").CanvasTexture | null = null;

function makeStoneNoise(THREE: typeof THREEModule): import("three").CanvasTexture {
  if (stoneNoise) return stoneNoise;
  const N = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(N, N);

  // Deterministic hash -> [0,1), wrapped on the lattice so every octave
  // tiles and the seam is invisible however the UVs repeat.
  const hash = (x: number, y: number, period: number) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    const h = Math.sin(xi * 127.1 + yi * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const lattice = (u: number, v: number, period: number) => {
    const x = u * period;
    const y = v * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = hash(x0, y0, period);
    const b = hash(x0 + 1, y0, period);
    const c = hash(x0, y0 + 1, period);
    const d = hash(x0 + 1, y0 + 1, period);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      // Five octaves: the first two are the broad unevenness of the body,
      // the last three the grain that only shows at grazing angles.
      let n = 0;
      let amp = 0.5;
      let period = 4;
      for (let o = 0; o < 5; o++) {
        n += lattice(u, v, period) * amp;
        amp *= 0.5;
        period *= 2;
      }
      const c = Math.round(Math.min(1, Math.max(0, n)) * 255);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tiled tight: the rock's own UVs cover the whole body in one shell, so
  // at 1:1 a 256px noise is stretched into soft blotches the size of the
  // stone. Eight repeats puts the grain at roughly the scale a thumb-sized
  // patch of rock has.
  tex.repeat.set(8, 8);
  stoneNoise = tex;
  return tex;
}

/**
 * AN ENVIRONMENT, FOR THE STONES ONLY.
 *
 * The stones' whole problem was that a MeshStandardMaterial with nothing
 * to reflect barely uses its roughness or metalness: the lamps in these
 * scenes give shape, but shape without specular reads as matte plastic,
 * which is what a dark rock lit only by lamps had become. three's own
 * RoomEnvironment through a PMREM generator supplies the missing half
 * with no new asset.
 *
 * Assigned to the rock material directly rather than to `scene.environment`,
 * and that distinction is the point. A scene-wide environment also lights
 * everything else in these compositions: measured, it took the index
 * page's floor from luminance 24 to 42 and lifted the supplied cover
 * artwork by about a tenth. Both of those are already composed and are
 * not what needs fixing, and supplied artwork in particular has to render
 * exactly as delivered. Scoped here, nothing outside the stones changes
 * at all.
 *
 * Per renderer, because a PMREM target belongs to the GL context that
 * made it — the two engines can be on screen at once.
 */
const envByRenderer = new WeakMap<
  import("three").WebGLRenderer,
  Promise<import("three").Texture | null>
>();

function getStoneEnvironment(
  THREE: typeof THREEModule,
  renderer: import("three").WebGLRenderer
): Promise<import("three").Texture | null> {
  let cached = envByRenderer.get(renderer);
  if (cached) return cached;
  cached = import("three/examples/jsm/environments/RoomEnvironment.js")
    .then(({ RoomEnvironment }) => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
      pmrem.dispose();
      return target.texture;
    })
    // No environment is the old look, not a broken one.
    .catch(() => null);
  envByRenderer.set(renderer, cached);
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
  placements: RockPlacement[],
  /** The engine's renderer, so the stones can be given an environment to
   *  reflect. Omitted, they render exactly as they did before. */
  renderer?: import("three").WebGLRenderer
): Promise<void> {
  const [resolved, env] = await Promise.all([
    Promise.all(
      placements.map(async (p) => ({ p, root: await loadRockRoot(THREE, p.file) }))
    ),
    renderer ? getStoneEnvironment(THREE, renderer) : Promise.resolve(null),
  ]);
  for (const { p, root } of resolved) {
    const instance = root.clone(true);
    if (env) {
      // Object3D.clone shares materials with the original, and the
      // original is the shared module cache both engines read — so the
      // material carrying one renderer's environment has to be this
      // instance's own, not everybody's.
      instance.traverse((o) => {
        const mesh = o as import("three").Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as import("three").MeshStandardMaterial).clone();
        mat.envMap = env;
        // Low: the room's own bright walls are a stand-in for bounced
        // light, not a light source of their own, and the lamps still do
        // all the shaping.
        mat.envMapIntensity = 0.14;
        mat.needsUpdate = true;
        mesh.material = mat;
      });
    }
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
