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
  /**
   * Whether this file's cover comes out the right way up, or needs standing
   * up. Measured, not guessed: rendered one at a time, square on and
   * unrotated, four of the five arrive with their covers flipped top to
   * bottom — Sneh Sagar's v1 was the only one the right way up, and the v2
   * replacement below is built correctly from the start (no flag needed).
   *
   * Corrected by mirroring the OBJECT in Y, not by touching the texture. A
   * flip of the texture coordinates would move which part of the atlas the
   * cover samples (the artwork sits in one half of each of these images and
   * the other half is black), so it would trade an upside-down cover for a
   * blank one. Mirroring the object leaves every texel exactly where it was
   * and simply stands the publication the right way up — which is what
   * placing five separately exported models in one composition means.
   */
  upright?: boolean;
  /**
   * False for the Sneh Sagar v2 rebuild, true (the default) for the other
   * four, which are still the original single-quad exports. A legacy export
   * is ONE mesh whose material carries a flattened 0.4 grey base colour and
   * the glTF-default metalness of 1 — rendered as supplied it reads as dull
   * grey metal, so those two values get put back to white/0 here. The v2
   * rebuild is a proper multi-part model (front cover, back cover, spine,
   * page block, cover edges) with its OWN correct, varied material values
   * already authored per part — the page block is a warm cream, the cover
   * edges a dark brown — and overwriting those to a flat white would erase
   * exactly the physical detail (page thickness, edge colour) this pass
   * exists to add.
   */
  legacyExport?: boolean;
};

const D = Math.PI / 180;

// Hierarchy, top to bottom: Sneh Sagar dominant and most forward; ExcelEDGE
// clearly the second voice; Mining supporting; the Handbook supporting and
// deliberately quieter than ExcelEDGE; Policy the smallest.
//
// They are arranged as a leaning group rather than a row: each one is turned
// a few degrees off square and set back a little further, so the group has a
// front and a back instead of five objects sharing a plane. The overlaps are
// chosen so every cover keeps a readable strip of its own — the further back
// a piece is, the more of its outer edge stays clear of the one in front.
/**
 * Exported so the Publications index page can read the loading-relevant
 * identity of each file (`id`, `file`, `legacyExport`, `upright`) without
 * duplicating it — that page has its own, much larger composition, but the
 * five publications it loads are these same five files, and matching `id`s
 * is what makes them share this card's already-warm cache.
 */
export const PUBLICATIONS: Publication[] = [
  {
    // 1. SNEH SAGAR — the hero. The v2 rebuild is a real multi-part book
    // (front cover, spine, back cover, page block, cover edges) rather than
    // a flat plane, so — unlike the other four — rotating it actually
    // reveals genuine thickness: the page block's edge and a sliver of the
    // spine both come into view at this yaw, catching the key light the
    // way a real book's fore-edge does.
    id: "sneh-sagar",
    file: "sneh-sagar-book-v2.glb",
    legacyExport: false,
    // The rebuild's own units are far smaller than the old flat export's
    // (a book roughly 1 x 1.22 x 0.12, against the old ~2.4 x 2.8 x 0.3) —
    // this scale is what makes it fill the same role as hero again: at 2.7
    // its world size (2.7 x 3.29 x 0.31) lands almost exactly on the old
    // model's footprint, thickness included, while still being read off
    // the NEW geometry rather than forcing a squashed axis.
    scale: 2.7,
    pos: [-0.6, -0.22, 0.8],
    rot: [-3 * D, 16 * D, -2 * D],
    lift: [0.16, 0.15, 0.7],
    turn: [1.5 * D, -4 * D, 1 * D],
    parallax: 1,
  },
  {
    // 2. EXCELEDGE — the second voice, front row right, turned the other
    // way. The hero laps its left edge; the rest of its cover is clear.
    // Raised and enlarged a little from the first pass — at the old
    // position it read as mostly hidden behind the hero rather than as a
    // standing second voice next to it, the "cramped central pile" a
    // reference-image review flagged.
    id: "excledge",
    upright: false,
    file: "excledge-newsletter.glb",
    scale: 0.98,
    pos: [0.95, 0.02, 0.35],
    rot: [-2 * D, -16 * D, 2.5 * D],
    lift: [0.36, 0.12, 0.44],
    turn: [1 * D, 4 * D, -1 * D],
    parallax: 0.78,
  },
  {
    // 3. MINING — back row left, standing higher than the front pair so its
    // top band clears the hero and its outer edge shows past it. Enlarged
    // and pulled a little forward for the same reason as ExcelEDGE above.
    id: "mining",
    upright: false,
    file: "mining-booklet.glb",
    scale: 0.85,
    pos: [-1.85, 0.55, -0.3],
    rot: [-4 * D, 20 * D, -5 * D],
    lift: [-0.24, 0.13, 0.24],
    turn: [0.5 * D, -3 * D, 2 * D],
    parallax: 0.6,
  },
  {
    // 4. EMPLOYEE HANDBOOK — back row right, and deliberately quieter than
    // ExcelEDGE: smaller, further back, and further off square. Enlarged
    // and raised in step with the other supporting pieces, keeping the
    // same ~0.78x ratio to ExcelEDGE's scale the hierarchy check verifies.
    id: "handbook",
    upright: false,
    file: "employee-handbook.glb",
    scale: 0.76,
    pos: [1.75, 0.42, -0.6],
    rot: [-4 * D, -23 * D, 4 * D],
    lift: [0.22, 0.09, 0.18],
    turn: [0.5 * D, 3 * D, -1.5 * D],
    parallax: 0.48,
  },
  {
    // 5. POLICY — the smallest, tucked at the back between the two front
    // pieces with its upper third showing over their shoulders.
    id: "policy",
    upright: false,
    file: "policy-document.glb",
    scale: 0.6,
    pos: [0.42, 1.16, -1.05],
    rot: [-5 * D, 7 * D, -2.5 * D],
    // Pulled harder toward the reader on hover than its rest position alone
    // would suggest — the front pair (Sneh Sagar, ExcelEDGE) also grow as
    // they lift, and without a stronger push of its own Policy was ending
    // up MORE hidden mid-hover than it is at rest, not less.
    lift: [0.16, 0.12, 0.3],
    turn: [0.5 * D, -2 * D, 1 * D],
    parallax: 0.36,
  },
];

// The camera. A long-ish lens at a distance: the group has to read as
// physical, and a wide angle this close would splay the outer pieces and
// make the hero's cover keystone.
const FOV = 26;
const CAM_Z = 12.6;
const CAM_Y = 0.22;

// How far the whole group lifts toward the reader on hover, on top of each
// object's own delta. Raised a little over the first pass — the brief this
// time is a Z move meaningful enough to actually perceive, not just a
// tilt — while staying well short of anything that reads as a fan-out: the
// picked-up-off-a-display feeling, not thrown off it.
const GROUP_LIFT_Z = 0.62;
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
 * Pull apart faces that were exported on top of one another.
 *
 * The old (legacy) single-quad exports carry BOTH a cover and its opposite
 * face on the same physical plane: two quads sharing no vertices, one
 * mapped to the cover artwork and one to a black texel. Two coincident
 * surfaces at the same depth is the definition of z-fighting, and it
 * rendered as a stippled lattice crawling across the cover.
 *
 * The repair is geometric and tiny: within each coplanar group, the copy
 * whose texture coordinates lie inside the atlas stays where it is, and
 * every other copy is pushed a fraction of a millimetre behind it along the
 * face normal. No texel moves. Harmless — a no-op — on the v2 rebuild,
 * whose six parts are genuinely separate meshes with no duplicated planes,
 * so it stays a single shared code path rather than a legacy-only branch.
 */
function separateCoincidentFaces(
  THREE: typeof import("three"),
  geometry: import("three").BufferGeometry
) {
  const index = geometry.getIndex();
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  if (!index || !pos || !uv) return;

  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const nudge = Math.max(size.x, size.y, size.z) * 0.002;

  // Group triangles by the plane they lie in.
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const planes = new Map<string, { n: [number, number, number]; tris: number[][] }>();
  for (let t = 0; t < index.count; t += 3) {
    const vs = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    a.fromBufferAttribute(pos, vs[0]);
    b.fromBufferAttribute(pos, vs[1]);
    c.fromBufferAttribute(pos, vs[2]);
    ab.subVectors(b, a); ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    // Canonical sign, so the two copies of a face land in the SAME group even
    // when one of them is wound the other way round — which is exactly how
    // this duplicate is stored, and why keying on the raw normal missed it.
    const sign =
      Math.abs(n.x) > 1e-6 ? Math.sign(n.x)
        : Math.abs(n.y) > 1e-6 ? Math.sign(n.y)
          : Math.sign(n.z) || 1;
    n.multiplyScalar(sign);
    const d = n.dot(a);
    const key = `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}|${d.toFixed(3)}`;
    const g = planes.get(key) ?? { n: [n.x, n.y, n.z] as [number, number, number], tris: [] };
    g.tris.push(vs);
    planes.set(key, g);
  }

  for (const group of planes.values()) {
    // Connected components by shared vertex — one component per real face.
    const comps: { tris: number[][]; verts: Set<number> }[] = [];
    for (const tri of group.tris) {
      const hit = comps.filter((k) => tri.some((v) => k.verts.has(v)));
      if (!hit.length) {
        comps.push({ tris: [tri], verts: new Set(tri) });
      } else {
        const first = hit[0];
        first.tris.push(tri);
        tri.forEach((v) => first.verts.add(v));
        for (const other of hit.slice(1)) {
          other.tris.forEach((x) => first.tris.push(x));
          other.verts.forEach((v) => first.verts.add(v));
          comps.splice(comps.indexOf(other), 1);
        }
      }
    }
    if (comps.length < 2) continue;

    // The copy whose UVs sit inside the atlas is the one to keep in place.
    const inAtlas = (k: { verts: Set<number> }) => {
      let ok = true;
      k.verts.forEach((v) => {
        const u = uv.getX(v), w = uv.getY(v);
        if (u < -0.001 || u > 1.001 || w < -0.001 || w > 1.001) ok = false;
      });
      return ok;
    };
    const keep = comps.find(inAtlas) ?? comps[0];
    let back = 1;
    for (const comp of comps) {
      if (comp === keep) continue;
      const [nx, ny, nz] = group.n;
      comp.verts.forEach((v) => {
        pos.setXYZ(
          v,
          pos.getX(v) - nx * nudge * back,
          pos.getY(v) - ny * nudge * back,
          pos.getZ(v) - nz * nudge * back
        );
      });
      back++;
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Turn a freshly loaded gltf.scene into the shared, cache-ready form: centred
 * on its own box, stood upright if its file needs it, and with every
 * material put right — ONCE. Everything after this is a clone.
 */
function processRoot(
  THREE: typeof import("three"),
  root: import("three").Object3D,
  spec: Publication
): import("three").Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);
  if (spec.upright === false) root.scale.y = -1;

  const legacy = spec.legacyExport !== false;

  root.traverse((o) => {
    const mesh = o as import("three").Mesh;
    if (!mesh.isMesh) return;
    separateCoincidentFaces(THREE, mesh.geometry);
    // Sneh Sagar v2's Front_Cover_Edge / Back_Cover_Edge parts (the thin
    // dark-brown board-edge trim) are exported reaching exactly as far in Z
    // as the cover plate they sit against — an EXACT depth tie, not merely
    // a close one, so which of the two surfaces wins is purely draw-order
    // luck rather than anything camera or precision related. Caught by
    // rendering the same book much larger on the Publications index page:
    // there the edge consistently drew after (so won over) the front
    // cover, blanking the illustrated artwork out behind a flat trim
    // colour. Nudging the edge mesh a fraction further from its cover
    // — the same "push the duplicate back along its own normal" fix
    // `separateCoincidentFaces` already does within a single mesh, just
    // reaching across two separate meshes here — breaks the tie once,
    // permanently, in the cached geometry, before either view ever
    // renders it.
    if (mesh.name === "Front_Cover_Edge" || mesh.name === "Back_Cover_Edge") {
      const geo = mesh.geometry;
      geo.computeBoundingBox();
      const size = geo.boundingBox!.getSize(new THREE.Vector3());
      const nudge = Math.max(size.x, size.y, size.z) * 0.01;
      const dir = mesh.name === "Front_Cover_Edge" ? -1 : 1;
      const posAttr = geo.getAttribute("position");
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setZ(i, posAttr.getZ(i) + dir * nudge);
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
    }
    mesh.castShadow = true;
    // Legacy exports receive nothing — see the big comment on
    // `mesh.receiveShadow` below the loop that used to live here: a legacy
    // publication is a couple of millimetres thick at this scale, thin
    // enough that receiving its OWN cast shadow reads as stippled acne
    // rather than a real contact shadow. The v2 rebuild's parts are
    // genuinely separated in depth (cover, page block and opposite cover
    // sit tens of millimetres apart once scaled), so letting them receive
    // each other's shadows is what makes the page block visibly recede
    // behind the front cover as the two lift apart on hover — the "contact
    // shadows change as the objects lift" the brief asks for.
    mesh.receiveShadow = !legacy;
    const mat = mesh.material as import("three").MeshStandardMaterial;
    if (!mat) return;
    if (legacy) {
      // The exporter (trimesh) writes a baseColorFactor of 0.4 grey and
      // leaves metalness at the glTF default of 1. Rendered as supplied,
      // every cover comes out at two fifths of its own value and shaded
      // like dull metal. Paper is not metal and the artwork is not grey:
      // putting the factor back to white and the metalness to zero is what
      // shows the supplied artwork AS supplied, rather than through the
      // exporter's defaults. (The v2 rebuild needs none of this — its
      // materials already carry the correct, VARIED values per part: a
      // warm cream page block, a dark brown edge, white cover plates —
      // overwriting them here would erase exactly that variation.)
      mat.color = new THREE.Color(0xffffff);
      mat.metalness = 0;
      mat.roughness = 0.82;
      // Shadows from the BACK faces only, for the reason above: a legacy
      // publication cast-shadowing from its own front face onto its own
      // back face (the only two surfaces it has) is what produced the
      // acne in the first place.
      mat.shadowSide = THREE.BackSide;
    }
    // RENDER BOTH SIDES, always. The legacy files declare doubleSided:false
    // but their cover faces are wound the other way round, so with
    // back-face culling on on, the one face carrying the artwork is the one
    // that gets thrown away. The v2 rebuild already declares doubleSided
    // itself; setting it again here is a harmless no-op for it and the one
    // fix that matters for the other four.
    mat.side = THREE.DoubleSide;
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
          (gltf) => resolve(processRoot(THREE, gltf.scene, spec)),
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
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { THREE } = await getLoader();
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      // Filmic, like the bulb next door, so a lit paper edge rolls off
      // instead of clipping — and so the two WebGL surfaces on this beat
      // agree about what "bright" looks like.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
      camera.position.set(0, CAM_Y, CAM_Z);
      camera.lookAt(0, 0, 0);

      // THE LIGHT IN THE CASE. Three sources, and the card is the brightest
      // of them: a key from above and slightly in front, which is where the
      // light would come from in a lit display; a cool fill opposite so the
      // backs of the pieces are not black; and a low bounce standing in for
      // the card's own surface throwing light back up at the covers. Kept
      // deliberately close to neutral/white throughout — the bulb behind the
      // card is what carries the warm/yellow cast in this beat, and if the
      // publications themselves picked up the same warmth their own cover
      // artwork would read off-colour.
      const key = new THREE.DirectionalLight(0xfaf8f5, 2.1);
      key.position.set(2.4, 4.6, 5.2);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 22;
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      // A legacy publication is a couple of millimetres thick at this
      // scale, so the depth range between its own front and back faces is
      // tiny and the default biases put a cover inside its own shadow —
      // every one came back stippled with acne. The normal bias does the
      // work (it pushes the sample along the surface normal, which is
      // exactly the direction the error is in on a flat cover); the depth
      // bias only cleans up the rest. Reused for the v2 rebuild too since
      // it costs nothing extra and holds up fine on real depth.
      key.shadow.bias = -0.0008;
      key.shadow.normalBias = 0.12;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xbdd2ff, 0.5);
      fill.position.set(-4.2, 1.4, 2.6);
      scene.add(fill);

      const bounce = new THREE.DirectionalLight(0xf3e8d8, 0.2);
      bounce.position.set(-0.6, -3.4, 2.2);
      scene.add(bounce);

      const ambient = new THREE.AmbientLight(0x9fb0cc, 0.42);
      scene.add(ambient);

      // The group the whole composition hangs off, so the hover lift and the
      // pointer parallax are ONE transform on ONE object rather than five
      // objects each doing their own version of the same move.
      const group = new THREE.Group();
      scene.add(group);

      // The surface the publications stand on. Invisible, but it takes their
      // shadows — which is most of what makes them read as objects sitting
      // somewhere rather than as pictures floating in a box.
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 14),
        new THREE.ShadowMaterial({ opacity: 0.42 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.72;
      floor.receiveShadow = true;
      group.add(floor);

      type Loaded = { spec: Publication; node: import("three").Object3D };
      const loaded: Loaded[] = [];
      const textures: import("three").Texture[] = [];
      // Set once, the instant every publication has been cloned into the
      // scene together — never per-object, which is what used to let the
      // reader see them pop in one at a time. Everything below this timer
      // reads it as ONE shared clock for the whole group's fade/settle.
      let compositionReadyAt: number | null = null;

      // THE LOAD. All five requested in parallel (Promise.all, not a
      // sequential await chain), and — critically — nothing is added to
      // `group` until every one of them has resolved. A reader watching
      // this card therefore only ever sees two states: nothing yet (the
      // card's own lit surface, no spinner), or all five together, arriving
      // as one composition on the same shared timer below. In the ordinary
      // case (ArcCarousel's early preload already had seconds of lead time
      // before this card scrolled into view) that "nothing yet" state is
      // never actually seen at all — the cache is already warm.
      Promise.all(PUBLICATIONS.map((spec) => loadRoot(spec).then((root) => ({ spec, root })))).then(
        (results) => {
          if (disposed) return;
          for (const { spec, root } of results) {
            const instance = root.clone(true);
            instance.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              const mat = mesh.material as import("three").MeshStandardMaterial;
              if (mat?.map) textures.push(mat.map);
            });
            const holder = new THREE.Group();
            holder.add(instance);
            holder.scale.setScalar(spec.scale);
            holder.position.set(...spec.pos);
            holder.rotation.set(...spec.rot);
            group.add(holder);
            loaded.push({ spec, node: holder });
          }
          compositionReadyAt = performance.now();
        }
      );

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { rootMargin: "20%" }
      );
      io.observe(host);

      // THE POINTER, READ NOT LISTENED FOR.
      //
      // `--pub-hover` is written on the arc card by the carousel's own
      // enter/leave (0 or 1), and `--pointer-from-left` / `--pointer-from-top`
      // are the normalised pointer position HoverCard is ALREADY tilting this
      // card with. Reading both here means the publications answer the same
      // gesture the card does, on the same frame, with no second listener,
      // no second physics, and nothing for a React render to clobber.
      const arcCard = host.closest("[data-arc-card]") as HTMLElement | null;
      const wrapper = host.closest(".hc-wrapper") as HTMLElement | null;
      const coarse = window.matchMedia("(hover: none)").matches;

      let hover = 0; // eased 0..1
      let px = 0.5; // eased pointer, 0..1
      let py = 0.5;
      let last = performance.now();

      // A read-only handle for the verification harness: the composition has
      // to be measurable (sizes, overlap, containment) rather than merely
      // looked at. Nothing in the component reads it.
      (host as HTMLElement & { __pub?: unknown }).__pub = {
        camera,
        scene,
        group,
        loaded,
        three: THREE,
        renderer,
      };

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const now = performance.now();
        // Clamped generously rather than tightly. Nothing here INTEGRATES —
        // the hover and the pointer are both followers easing toward a
        // target — so a long frame should simply get further along the ease,
        // not be held back. Clamped to a frame's worth the way an integrator
        // would be, a display on a machine dropping frames never quite
        // reaches its resting transform after the pointer leaves.
        const dt = Math.min(250, Math.max(1, now - last));
        last = now;

        const wanted =
          !coarse && arcCard
            ? parseFloat(getComputedStyle(arcCard).getPropertyValue("--pub-hover")) || 0
            : 0;
        const tau = wanted > hover ? HOVER_IN_TAU : HOVER_OUT_TAU;
        hover += (wanted - hover) * (1 - Math.exp(-dt / tau));
        // Snapped once it is closer than a rendered pixel's worth of the
        // largest lift, so "returned to rest" is exact rather than asymptotic.
        if (Math.abs(wanted - hover) < 0.004) hover = wanted;

        if (wrapper) {
          const cs = getComputedStyle(wrapper);
          const tx = parseFloat(cs.getPropertyValue("--pointer-from-left")) || 0.5;
          const ty = parseFloat(cs.getPropertyValue("--pointer-from-top")) || 0.5;
          const kp = 1 - Math.exp(-dt / POINTER_TAU);
          px += (tx - px) * kp;
          py += (ty - py) * kp;
        }

        // Ease the hover with a curve rather than using the raw follower:
        // the follower gives the motion its weight, this gives it its shape.
        const h = reduced ? 0 : hover * hover * (3 - 2 * hover);

        // ONE shared arrival value for the whole composition — see
        // `compositionReadyAt` above. Every publication fades/settles on
        // this same clock, together, instead of each running its own timer
        // from whenever IT personally finished decoding.
        const arriveT =
          compositionReadyAt == null
            ? 0
            : Math.min(1, (now - compositionReadyAt) / COMPOSITION_ARRIVE_MS);
        const arrive = arriveT * arriveT * (3 - 2 * arriveT);

        for (const { spec, node } of loaded) {
          if (arrive < 1) {
            node.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              const mat = mesh.material as import("three").MeshStandardMaterial;
              if (!mat) return;
              mat.transparent = true;
              mat.opacity = arrive;
            });
          } else {
            node.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              const mat = mesh.material as import("three").MeshStandardMaterial;
              if (mat?.transparent) {
                mat.transparent = false;
                mat.opacity = 1;
              }
            });
          }
          node.position.set(
            spec.pos[0] + spec.lift[0] * h,
            spec.pos[1] + spec.lift[1] * h + (1 - arrive) * 0.22,
            spec.pos[2] + (spec.lift[2] + GROUP_LIFT_Z * spec.parallax) * h
          );
          node.rotation.set(
            spec.rot[0] + spec.turn[0] * h,
            spec.rot[1] + spec.turn[1] * h,
            spec.rot[2] + spec.turn[2] * h
          );
        }

        // The group answers the pointer only while it is being hovered, and
        // only as much as `h` allows — so at rest the composition is exactly
        // the resting one, whatever the pointer last did.
        group.rotation.y = (px - 0.5) * 2 * PARALLAX_YAW * h;
        group.rotation.x = -(py - 0.5) * 2 * PARALLAX_PITCH * h;

        // The display brightens a little as the publications come forward —
        // the card lighting what it is holding up, not a bloom.
        const lum = lumRef.current * (1 + 0.14 * h);
        key.intensity = (2.1 + 0.55 * h) * lum;
        fill.intensity = (0.5 + 0.1 * h) * lum;
        bounce.intensity = (0.28 + 0.14 * h) * lum;
        ambient.intensity = (0.42 + 0.08 * h) * lum;
        renderer.toneMappingExposure = 1.16 + 0.07 * h;

        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
        // Disposing here frees THIS renderer's GPU-side copies only — the
        // cached geometries/materials/textures in rootCache are JS objects
        // that survive (their decoded pixel data is untouched by dispose());
        // a future mount clones them again and just re-uploads, which is
        // fast, with no re-fetch and no re-decode.
        for (const t of textures) t.dispose();
        scene.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
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
