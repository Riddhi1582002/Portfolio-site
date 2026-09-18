"use client";

// THE PUBLICATIONS CARD.
//
// The first piece on the arc of work is a small physical display: five real
// publications, standing together the way a set of them would on a shelf,
// lit by the card they sit in. The supplied GLBs are the work itself — each
// one is a textured solid carrying its own cover artwork — so nothing here
// draws, redraws or stands in for any of it. What this file owns is the
// arrangement, the light and the way the group answers a pointer.
//
// three.js only, and the same shape as BulbModel next door: created on
// mount, disposed on unmount, rendering only while on screen. No second 3D
// framework, no post-processing — five low-poly solids and a three-light rig
// do not need a composer, and the arc already shares the frame with the
// bulb's own WebGL context.
//
// THE POINTER IS NOT LISTENED FOR HERE. The card is wrapped in HoverCard,
// which already owns the site's tilt and publishes the pointer's normalised
// position as `--pointer-from-left` / `--pointer-from-top` on its wrapper;
// the arc publishes whether the card is hovered at all as `--pub-hover` on
// the card itself. The render loop below reads those two, so the
// publications answer the SAME gesture the card does, on the same frame,
// with no second listener and no second physics to fight the first.
//
// LOADING IS CACHED AT MODULE SCOPE, not tied to this component's mount.
// The five GLBs are parsed and their materials fixed up ONCE, the first time
// any of them is asked for — by whichever happens first: the arc's own early
// warm-up call (see `preloadPublications`, invoked as soon as ArcCarousel
// mounts, well before the reader scrolls anywhere near this beat) or this
// component's own mount. Every later mount — a scroll pass back over the
// card, the whole CordSection unmounting and remounting as the reader
// scrolls away and returns — reads the SAME cached, already-processed
// scene graph and just clones it into a fresh instance. Nothing is
// re-fetched, re-decoded or re-built.

import { useEffect, useRef } from "react";
import { mountSpatialCard } from "./SpatialCardEngine";

const BASE = "/model/publications";

/**
 * The composition, in the order the reader should read it.
 *
 * `scale` is the art direction — the hierarchy the card is meant to have —
 * and it is UNIFORM per object, never per axis: real geometry (not a
 * squashed placeholder) is what makes a publication read as a physical
 * object rather than a sticker.
 *
 * `pos` is in the same units as the models. `lift` is where the object goes
 * on hover, as a delta — so rest is the base and hover is a lerp away from
 * it, which is what makes the return exact rather than approximately exact.
 */
export type Publication = {
  id: string;
  file: string;
  scale: number;
  pos: [number, number, number];
  rot: [number, number, number];
  /** Hover delta: position. */
  lift: [number, number, number];
  /** Hover delta: rotation, radians. */
  turn: [number, number, number];
  /** How much of the pointer parallax this object takes, 0..1. */
  parallax: number;
};

const D = Math.PI / 180;

// ONE COMPACT STILL LIFE, IN THREE DEPTHS — the reference's own structure:
//
//   back    (z 0)      ExcelEDGE left, Employee Handbook right
//   middle  (z ~0.45)  Mining left, Policy right
//   front   (z ~0.85)  Sneh Sagar, centred
//
// so the group has a front and a back rather than five objects sharing a
// plane, and every cover keeps a readable strip of its own.
//
// SNEH SAGAR IS DOMINANT BY BEING FOREMOST AND CENTRED, not by being huge.
// Scaled to fill the card it measured 72% of the card's width and buried
// the other four — the reference gives its hero about 44%, barely a fifth
// wider than the newsletter behind it, and wins the hierarchy with depth
// and placement instead. The four supporting pieces are therefore close to
// one another in size, as they are in the reference.
//
// The back pair stand ABOVE the floor rather than on it: they are leaning
// into the group from behind, and both their bases are covered — ExcelEDGE
// by Sneh Sagar and Mining, the Handbook by Sneh Sagar and the back stone.
/**
 * Exported so the Publications index page can read the loading-relevant
 * identity of each file (`id`, `file`) without duplicating it — that page
 * has its own, much larger composition, but the five publications it loads
 * are these same five files, and matching `id`s is what makes them share
 * this card's already-warm cache.
 *
 * The four rebuilt publications (excel-edge, mining, handbook, policy)
 * share one construction: page block, bevelled front/back cover shells,
 * a textured front_cover_artwork, spine and layered page-edge strips.
 * Sneh Sagar's own construction is separate and was not rebuilt. Only
 * Sneh Sagar needs the V-flip correction in `processRoot` — see its
 * comment for why the other four must NOT get it despite shipping their
 * own UVs too.
 */
export const PUBLICATIONS: Publication[] = [
  {
    // 1. SNEH SAGAR — the hero: front row, centred, standing on the floor.
    id: "sneh-sagar",
    file: "sneh-sagar-book-corrected.glb",
    scale: 0.95,
    pos: [0.13, -0.28, 0.85],
    rot: [-3 * D, 16 * D, -2 * D],
    lift: [0.16, 0.15, 0.35],
    turn: [1.5 * D, -4 * D, 1 * D],
    parallax: 1,
  },
  {
    // 2. EXCELEDGE — the second voice: BACK LEFT, leaning in over the
    // hero's left shoulder, its whole masthead clear of everything in
    // front of it.
    id: "excledge",
    file: "excel-edge-newsletter.glb",
    scale: 1.02,
    pos: [-0.59, 0.78, 0.0],
    rot: [-2 * D, -16 * D, 2.5 * D],
    lift: [0.36, 0.12, 0.22],
    turn: [1 * D, 4 * D, -1 * D],
    parallax: 0.78,
  },
  {
    // 3. MINING — MIDDLE ROW LEFT, forward of ExcelEDGE and overlapping
    // the hero's left edge. Pulled in off the card's own edge, where it
    // used to be clipped in half.
    id: "mining",
    file: "mining-brochure.glb",
    scale: 0.86,
    pos: [-1.28, -0.24, 0.45],
    rot: [-4 * D, 20 * D, -5 * D],
    lift: [-0.24, 0.13, 0.12],
    turn: [0.5 * D, -3 * D, 2 * D],
    parallax: 0.6,
  },
  {
    // 4. EMPLOYEE HANDBOOK — BACK RIGHT, the mirror of ExcelEDGE across the
    // hero and deliberately quieter than it: smaller and further off
    // square, but standing just as clear of the piece in front.
    id: "handbook",
    file: "employee-handbook.glb",
    scale: 0.61,
    pos: [1.02, 0.87, 0.0],
    rot: [-4 * D, -23 * D, 4 * D],
    lift: [0.22, 0.09, 0.09],
    turn: [0.5 * D, 3 * D, -1.5 * D],
    parallax: 0.48,
  },
  {
    // 5. POLICY — MIDDLE ROW RIGHT, the mirror of Mining: the smallest of
    // the five, standing forward of the Handbook and against the back
    // stone rather than stacked behind the taller four, where it used to
    // disappear entirely from this camera angle.
    id: "policy",
    file: "policy-document.glb",
    scale: 0.54,
    pos: [1.66, -0.55, 0.5],
    rot: [-5 * D, 7 * D, -2.5 * D],
    // Its hover barely moves OUTWARD. Policy is the piece nearest the
    // card's right edge, and lifting toward the reader already grows it;
    // the sideways push this used to carry (0.16, from when it was buried
    // behind the taller four and had to fight its way out) took its corner
    // a few pixels past the frame at every viewport measured.
    lift: [0.05, 0.12, 0.15],
    turn: [0.5 * D, -2 * D, 1 * D],
    parallax: 0.36,
  },
];

// The camera. Close enough that the group fills most of the card, the way
// a real still life photographed close-up would — the group's own overlap
// and depth carries the composition, not empty air around it.
const FOV = 26;
const CAM_Z = 10.4;
const CAM_Y = 0.22;

// How far the whole group lifts toward the reader on hover, on top of each
// object's own delta. Raised a little over the first pass — the brief this
// time is a Z move meaningful enough to actually perceive, not just a
// tilt — while staying well short of anything that reads as a fan-out: the
// picked-up-off-a-display feeling, not thrown off it.
const GROUP_LIFT_Z = 0.32;
// The pointer's own contribution, in radians of group yaw/pitch. This rides
// the SAME pointer position HoverCard is already tilting the card with, so
// the two read as one gesture rather than two responses to one pointer —
// and it is deliberately the SMALLER contributor: the physical lift above
// is the main event, this is only the finishing parallax on top of it.
const PARALLAX_YAW = 5 * D;
const PARALLAX_PITCH = 4.5 * D;

// Time constants for the hover ease, in ms. Coming forward is slower than
// going back, the same asymmetry the art cards' hover uses: arriving has
// weight, leaving is clean.
const HOVER_IN_TAU = 190;
const HOVER_OUT_TAU = 120;
// The pointer parallax follows on its own, slower constant so a fast flick
// of the cursor across the card does not snap the group about.
const POINTER_TAU = 260;
// How long the WHOLE composition takes to fade/settle in once every
// publication has finished loading — one shared clock, not five. See the
// module-scope cache below for why this only actually runs once per page
// visit in practice.
const COMPOSITION_ARRIVE_MS = 420;

/**
 * Asset pack v2's meshes carry POSITION only — no UV, no NORMAL. The
 * textures (a real cover image per book) ARE embedded in the files; there
 * is simply nothing to map them onto, so a mesh with a texture renders as
 * a flat, textureless colour without this. Each of the four parts (pages,
 * front, back, spine) is a thin box, so a planar projection along its own
 * thinnest axis — the two long axes normalised 0..1, the thin one ignored
 * — is exactly the "wrap a flat image onto a flat cover" mapping a real
 * bindery would use, with no distortion on the faces that matter (front
 * and back) and only the thin, unmapped edge faces stretched, which is
 * imperceptible at this scale. Skipped entirely if a mesh already has UVs
 * (defensive — this pack never does — rather than assuming it forever).
 */
function addPlanarUV(THREE: typeof import("three"), geometry: import("three").BufferGeometry) {
  if (geometry.getAttribute("uv")) return;
  const pos = geometry.getAttribute("position");
  if (!pos) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const axes = ["x", "y", "z"] as const;
  const thin = axes.reduce((a, b) => (size[b] < size[a] ? b : a));
  const [uAxis, vAxis] = axes.filter((a) => a !== thin);
  const uMin = box.min[uAxis], uSpan = box.max[uAxis] - uMin || 1;
  const vMin = box.min[vAxis], vSpan = box.max[vAxis] - vMin || 1;
  const getters = {
    x: (i: number) => pos.getX(i),
    y: (i: number) => pos.getY(i),
    z: (i: number) => pos.getZ(i),
  } as const;
  const getU = getters[uAxis];
  const getV = getters[vAxis];
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (getU(i) - uMin) / uSpan;
    // Flipped so the image's own top edge lands at the mesh's +v (up),
    // matching how the source cover jpgs are oriented.
    uv[i * 2 + 1] = 1 - (getV(i) - vMin) / vSpan;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Sneh Sagar's own three textured parts (front/back cover, spine) ship
 * with their OWN UVs, authored against a bottom-left texture origin (a
 * vertex at the bottom of the quad reads UV v=0). glTF's own convention,
 * which is what GLTFLoader configures every texture for (`flipY = false`,
 * top-left origin), reads that same v=0 as the TOP of the image, so as
 * supplied each cover rendered upside down. Flipping V corrects the
 * mismatch without touching a single texel of the artwork or the geometry
 * this file supplies.
 *
 * Only ever called for that one file — see `needsVFlip` in `loadRoot`.
 * The four rebuilt publications (excel-edge, mining, handbook, policy)
 * ship authored UVs too, on every mesh including their bevelled edges and
 * page block, but in the CORRECT top-left convention already: applying
 * this same flip to them was the actual bug the first version of this
 * function had — "has its own UV" is not the same fact as "was authored
 * bottom-left", and conflating the two is what put ExcelEDGE's masthead
 * and Mining's cover on screen mirrored/upside-down the first time these
 * four were swapped in.
 *
 * `seen` de-duplicates by the ACTUAL attribute object, not by mesh: this
 * exporter (trimesh) reuses one glTF accessor — one underlying typed array
 * — for every mesh whose UVs are byte-identical, and front_cover_artwork
 * and spine are both plain full-bleed quads that share exactly that
 * accessor. Flipping "per mesh visited" flipped their one shared array
 * twice — back to its original, unflipped state — which is what silently
 * undid this fix the first time it was written. Flipping per unique
 * attribute, once, is what actually keeps the correction.
 */
function flipV(
  geometry: import("three").BufferGeometry,
  seen: Set<import("three").BufferAttribute | import("three").InterleavedBufferAttribute>
) {
  const uv = geometry.getAttribute("uv");
  if (seen.has(uv)) return;
  seen.add(uv);
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;
}

/**
 * Turn a freshly loaded gltf.scene into the shared, cache-ready form:
 * centred on its own box, with UVs supplied where the file has none, and
 * every texture's colour space/filtering set — ONCE. Everything after this
 * is a clone.
 *
 * `needsVFlip` is per-FILE, not inferred from "does this mesh already have
 * a UV attribute" — every mesh in every one of these five files now ships
 * authored UVs, but only Sneh Sagar's were authored bottom-left. See
 * `flipV`'s own comment for the bug that conflating the two caused.
 */
function processRoot(
  THREE: typeof import("three"),
  root: import("three").Object3D,
  needsVFlip: boolean
): import("three").Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);

  const flippedUVs = new Set<import("three").BufferAttribute | import("three").InterleavedBufferAttribute>();
  root.traverse((o) => {
    const mesh = o as import("three").Mesh;
    if (!mesh.isMesh) return;
    const hadOwnUV = !!mesh.geometry.getAttribute("uv");
    addPlanarUV(THREE, mesh.geometry);
    if (hadOwnUV && needsVFlip) flipV(mesh.geometry, flippedUVs);
    if (!mesh.geometry.getAttribute("normal")) mesh.geometry.computeVertexNormals();
    mesh.castShadow = true;
    // Every part sits at a genuinely different depth once scaled (cover,
    // spine and page block are millimetres apart, not coincident), so
    // letting them receive each other's shadows is what makes the page
    // block visibly recede behind the front cover as the two lift apart on
    // hover — real contact shadows, not the acne a paper-thin coincident
    // surface would produce.
    mesh.receiveShadow = true;
    const mat = mesh.material as import("three").MeshStandardMaterial;
    if (!mat) return;
    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
      // The covers are the only detail in frame and they are seen at a
      // glancing angle, which is exactly where bilinear filtering turns
      // type into mush. Fixed rather than queried off a renderer — this
      // runs once, at cache-build time, before any renderer necessarily
      // exists yet, and 8x is supported by effectively every GPU this
      // would ever run on.
      mat.map.anisotropy = 8;
      mat.map.generateMipmaps = true;
      mat.map.minFilter = THREE.LinearMipmapLinearFilter;
      mat.map.needsUpdate = true;
    }
    mat.needsUpdate = true;
  });
  return root;
}

// ── THE CACHE ────────────────────────────────────────────────────────────
//
// Module scope, not component state: it has to outlive any one mount of
// PublicationsDisplay, because CordSection — and this card with it —
// unmounts and remounts as the reader scrolls away from this beat and back,
// the same as every other section on the page. Without this, "scroll past
// and come back" would refetch and re-decode all five GLBs every time.
//
// Two layers. `loaderPromise` is the shared THREE + GLTFLoader instance
// (dynamic-imported once). `rootCache` is one entry per publication id,
// each holding the fully processed — centred, uprighted, material-fixed —
// root Object3D, keyed so a second request for the same id returns the
// SAME in-flight or resolved promise rather than starting a second load.
let loaderPromise: Promise<{
  THREE: typeof import("three");
  loader: InstanceType<
    typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader
  >;
}> | null = null;

export function getLoader() {
  loaderPromise ??= (async () => {
    const THREE = await import("three");
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    return { THREE, loader: new GLTFLoader() };
  })();
  return loaderPromise;
}

const rootCache = new Map<string, Promise<import("three").Object3D>>();

/**
 * Exported so other views of the same five publications (the Publications
 * index page, currently) can load and cache from the SAME map by using the
 * SAME `id`s — a second visit through a different composition still hits
 * this cache instead of re-fetching/re-decoding the GLBs.
 */
export function loadRoot(spec: Publication): Promise<import("three").Object3D> {
  let cached = rootCache.get(spec.id);
  if (cached) return cached;
  cached = getLoader().then(
    ({ THREE, loader }) =>
      new Promise<import("three").Object3D>((resolve) => {
        loader.load(
          `${BASE}/${spec.file}`,
          (gltf) => resolve(processRoot(THREE, gltf.scene, spec.id === "sneh-sagar")),
          undefined,
          // A publication that fails to load resolves to an empty group
          // rather than rejecting, so Promise.all below still settles and
          // the other four still appear — one missing GLB should not blank
          // the whole display.
          () => resolve(new THREE.Group())
        );
      })
  );
  rootCache.set(spec.id, cached);
  return cached;
}

/**
 * Start loading every publication now. Safe to call more than once — the
 * cache above means only the first call anywhere in the app actually does
 * anything — and safe to call long before anything is mounted to look at
 * the result: ArcCarousel calls this from its own mount effect, which fires
 * as soon as CordSection mounts (the same early-warm-up moment its own
 * BulbModel/GLTF gets), well before the reader has scrolled anywhere near
 * this card's own visible beat.
 */
export function preloadPublications() {
  for (const spec of PUBLICATIONS) void loadRoot(spec);
}

export default function PublicationsDisplay({
  /**
   * Scales the in-scene key light. The card owns how lit its own display
   * is — see ArcCarousel — so that the glow on the card and the light on
   * the publications inside it are one number and can never disagree.
   */
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { THREE } = await getLoader();
      if (disposed) return;
      cleanup = mountSpatialCard(host, THREE, PUBLICATIONS, loadRoot, lumRef, reduced, {
        fov: FOV,
        camZ: CAM_Z,
        camY: CAM_Y,
        groupLiftZ: GROUP_LIFT_Z,
        parallaxYaw: PARALLAX_YAW,
        parallaxPitch: PARALLAX_PITCH,
        hoverInTau: HOVER_IN_TAU,
        hoverOutTau: HOVER_OUT_TAU,
        pointerTau: POINTER_TAU,
        compositionArriveMs: COMPOSITION_ARRIVE_MS,
        rocks: true,
      });
    })().catch((err) => {
      // The card is decoration on a scroll beat, not content — but a silent
      // failure reads on screen as an empty black square, so it is reported.
      console.error("PublicationsDisplay:", err);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced]);

  return (
    <div
      ref={hostRef}
      data-publications
      style={{ width: "100%", height: "100%" }}
    />
  );
}
