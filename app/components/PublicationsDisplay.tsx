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

import { useEffect, useRef } from "react";

const BASE = "/model/publications";

/**
 * The composition, in the order the reader should read it.
 *
 * `scale` is the art direction — the hierarchy the card is meant to have —
 * and it is UNIFORM per object, never per axis: the supplied geometry
 * already carries each publication's real proportions (they share a height
 * of 2.842 units and differ in width and thickness, so Sneh Sagar is
 * genuinely the thickest and Policy genuinely the thinnest), and squashing
 * one to fit would throw that away.
 *
 * `pos` is in the same units as the models. `lift` is where the object goes
 * on hover, as a delta — so rest is the base and hover is a lerp away from
 * it, which is what makes the return exact rather than approximately exact.
 */
type Publication = {
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
   * bottom — Sneh Sagar is the only one the right way up.
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
const PUBLICATIONS: Publication[] = [
  {
    // 1. SNEH SAGAR — the hero, front row left. Largest, most forward,
    // closest to square on, so its cover reads first and reads whole.
    id: "sneh-sagar",
    file: "sneh-sagar-book.glb",
    scale: 1,
    pos: [-0.62, -0.3, 0.75],
    rot: [-3 * D, 13 * D, -2 * D],
    lift: [0.14, 0.14, 0.62],
    turn: [1.5 * D, -4 * D, 1 * D],
    parallax: 1,
  },
  {
    // 2. EXCELEDGE — the second voice, front row right, turned the other
    // way. The hero laps its left edge; the rest of its cover is clear.
    id: "excledge",
    upright: false,
    file: "excledge-newsletter.glb",
    scale: 0.84,
    pos: [0.78, -0.22, 0.28],
    rot: [-2 * D, -16 * D, 2.5 * D],
    lift: [0.34, 0.11, 0.4],
    turn: [1 * D, 4 * D, -1 * D],
    parallax: 0.78,
  },
  {
    // 3. MINING — back row left, standing higher than the front pair so its
    // top band clears the hero and its outer edge shows past it.
    id: "mining",
    upright: false,
    file: "mining-booklet.glb",
    scale: 0.7,
    pos: [-1.82, 0.42, -0.45],
    rot: [-4 * D, 20 * D, -5 * D],
    lift: [-0.22, 0.12, 0.22],
    turn: [0.5 * D, -3 * D, 2 * D],
    parallax: 0.6,
  },
  {
    // 4. EMPLOYEE HANDBOOK — back row right, and deliberately quieter than
    // ExcelEDGE: smaller, further back, and further off square.
    id: "handbook",
    upright: false,
    file: "employee-handbook.glb",
    scale: 0.62,
    pos: [1.6, 0.2, -0.75],
    rot: [-4 * D, -23 * D, 4 * D],
    lift: [0.2, 0.08, 0.16],
    turn: [0.5 * D, 3 * D, -1.5 * D],
    parallax: 0.48,
  },
  {
    // 5. POLICY — the smallest, tucked at the back between the two front
    // pieces with its upper third showing over their shoulders.
    id: "policy",
    upright: false,
    file: "policy-document.glb",
    scale: 0.52,
    pos: [0.5, 1.1, -1.05],
    rot: [-5 * D, 7 * D, -2.5 * D],
    lift: [0.08, 0.06, 0.1],
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
// object's own delta. Small on purpose — the brief is publications being
// picked up off a display, not thrown off it.
const GROUP_LIFT_Z = 0.5;
// The pointer's own contribution, in radians of group yaw/pitch. This rides
// the SAME pointer position HoverCard is already tilting the card with, so
// the two read as one gesture rather than two responses to one pointer.
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
// How long a publication takes to fade in once its GLB has finished loading.
const ARRIVE_MS = 420;

/**
 * Pull apart faces that were exported on top of one another.
 *
 * Sneh Sagar's file carries BOTH its front and its back cover on the same
 * physical face: four triangles at the same z, in two quads that share no
 * vertices, one mapped to the cover artwork and one to the back. Two
 * coincident surfaces at the same depth is the definition of z-fighting, and
 * it rendered as a stippled lattice crawling across the hero's cover — the
 * one publication in the composition that most has to be clean.
 *
 * The repair is geometric and tiny: within each coplanar group, the copy
 * whose texture coordinates lie inside the atlas (the front cover — the
 * other copy's run past 1 and wrap) stays where it is, and every other copy
 * is pushed a fraction of a millimetre behind it along the face normal. No
 * texel moves; the artwork is exactly the artwork. It simply stops being
 * drawn twice in the same place.
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
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
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
      // backs of the pieces are not black; and a low warm bounce standing in
      // for the card's own surface throwing light back up at the covers.
      const key = new THREE.DirectionalLight(0xfff4e2, 2.1);
      key.position.set(2.4, 4.6, 5.2);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 22;
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      // A publication is a few millimetres thick at this scale, so the depth
      // range between its own front and back faces is tiny and the default
      // biases put a cover inside its own shadow — every one came back
      // stippled with acne. The normal bias does the work (it pushes the
      // sample along the surface normal, which is exactly the direction the
      // error is in on a flat cover); the depth bias only cleans up the rest.
      key.shadow.bias = -0.0008;
      key.shadow.normalBias = 0.12;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xbdd2ff, 0.5);
      fill.position.set(-4.2, 1.4, 2.6);
      scene.add(fill);

      const bounce = new THREE.DirectionalLight(0xffd9a8, 0.28);
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

      type Loaded = {
        spec: Publication;
        node: import("three").Object3D;
        /** When it arrived, so it can be faded in rather than cut in. */
        since: number;
      };
      const loaded: Loaded[] = [];
      const textures: import("three").Texture[] = [];

      const loader = new GLTFLoader();
      const load = (spec: Publication) =>
        new Promise<void>((resolve) => {
          loader.load(
            `${BASE}/${spec.file}`,
            (gltf) => {
              if (disposed) return resolve();
              const root = gltf.scene;
              // Centre the model on its own box so `pos` positions the
              // publication, not whatever origin the exporter happened to
              // leave it on.
              const box = new THREE.Box3().setFromObject(root);
              const centre = box.getCenter(new THREE.Vector3());
              root.position.sub(centre);
              if (spec.upright === false) root.scale.y = -1;
              // THE COVER IS ON THE +Z FACE — decoded off the supplied files
              // rather than assumed: in all five, the only side carrying real
              // UV area is +Z (0.35 to 0.57 of the texture), and the other
              // five sides collapse to a single texel, which is what gives
              // the page edges their flat dark colour. The camera sits on +Z,
              // so the covers already face the reader and nothing here should
              // turn them.

              root.traverse((o) => {
                const mesh = o as import("three").Mesh;
                if (!mesh.isMesh) return;
                separateCoincidentFaces(THREE, mesh.geometry);
                mesh.castShadow = true;
                // They cast onto the surface they stand on, and nowhere
                // else. Letting them receive each other's shadows means each
                // cover is also inside its own shadow map: a publication is
                // a couple of millimetres thick at this scale, the depth
                // range across it is smaller than the map can resolve, and
                // every cover came back stippled with self-shadow acne. The
                // grounding shadow is what sells them as objects in a space;
                // shadows falling between five overlapping covers at this
                // size are worth nothing and cost that.
                mesh.receiveShadow = false;
                const mat = mesh.material as import("three").MeshStandardMaterial;
                if (!mat) return;
                // The exporter (trimesh) writes a baseColorFactor of 0.4 grey
                // and leaves metalness at the glTF default of 1. Rendered as
                // supplied, every cover comes out at two fifths of its own
                // value and shaded like dull metal. Paper is not metal and
                // the artwork is not grey: putting the factor back to white
                // and the metalness to zero is what shows the supplied
                // artwork AS supplied, rather than through the exporter's
                // defaults.
                mat.color = new THREE.Color(0xffffff);
                mat.metalness = 0;
                mat.roughness = 0.82;
                // AND RENDER BOTH SIDES. The files declare doubleSided:false,
                // but their cover faces are wound the other way round, so
                // with back-face culling on, the one face that carries the
                // artwork is the one that gets thrown away: each publication
                // rendered as a bare sliver of its own page edges, with a
                // full-width shadow underneath it giving the game away. These
                // are closed solids, so drawing both sides costs nothing that
                // can ever be seen — and it shows the supplied artwork
                // instead of culling it.
                mat.side = THREE.DoubleSide;
                // Shadows from the BACK faces only. Drawing both sides into
                // the shadow map means every lit cover is also shadow-casting
                // at its own surface, and the covers came back stippled with
                // self-shadow acne. Casting off the back faces puts the whole
                // depth of the object between a cover and its own shadow.
                mat.shadowSide = THREE.BackSide;
                if (mat.map) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  // The covers are the only detail in frame and they are seen
                  // at a glancing angle, which is exactly where bilinear
                  // filtering turns type into mush.
                  mat.map.anisotropy = Math.min(
                    8,
                    renderer.capabilities.getMaxAnisotropy()
                  );
                  mat.map.generateMipmaps = true;
                  mat.map.minFilter = THREE.LinearMipmapLinearFilter;
                  mat.map.needsUpdate = true;
                  textures.push(mat.map);
                }
                mat.needsUpdate = true;
              });

              const holder = new THREE.Group();
              holder.add(root);
              holder.scale.setScalar(spec.scale);
              holder.position.set(...spec.pos);
              holder.rotation.set(...spec.rot);
              group.add(holder);
              loaded.push({ spec, node: holder, since: performance.now() });
              resolve();
            },
            undefined,
            () => resolve()
          );
        });

      // Sequential rather than parallel: five cover textures decoding at once
      // on the frame the arc is also swinging in is a visible hitch, and this
      // order is the order the reader looks at them in anyway — so the hero
      // is the first one standing there and the smallest is the last.
      //
      // NOT awaited before the loop below starts. Eleven megabytes of cover
      // artwork takes real time to arrive, and a renderer that has not been
      // sized or started until the last of it lands leaves the card showing
      // an empty plate for the whole of it. Rendering from the first frame
      // instead, each publication simply appears as it arrives.
      void (async () => {
        for (const spec of PUBLICATIONS) {
          if (disposed) return;
          await load(spec);
        }
      })();

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

        for (const { spec, node, since } of loaded) {
          // Arrival: a short fade and a small settle down onto the mark, so a
          // publication that has just finished decoding joins the group
          // instead of appearing in it.
          const inT = Math.min(1, (now - since) / ARRIVE_MS);
          const arrive = inT * inT * (3 - 2 * inT);
          node.traverse((o) => {
            const mesh = o as import("three").Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as import("three").MeshStandardMaterial;
            if (!mat) return;
            if (arrive < 1) {
              mat.transparent = true;
              mat.opacity = arrive;
            } else if (mat.transparent) {
              mat.transparent = false;
              mat.opacity = 1;
            }
          });
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
