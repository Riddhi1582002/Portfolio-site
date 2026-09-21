"use client";

// THE REUSABLE CARD ENGINE.
//
// Extracted from what was originally Publications-only code in
// PublicationsDisplay.tsx: the lit-display-case renderer that stands a
// small group of real 3D objects inside an arc card, answers the card's own
// hover as one group (lift, parallax, brighten), and fades the whole
// composition in together once every object has loaded. Publications is the
// first category to use it, but nothing below refers to a book, a
// publication, or five of anything — a future Graphic Design category
// (Campaigns, Branding, ...) supplies its own `items` and `loadRoot` and
// gets the same case, the same hover language, and the same arrival
// behaviour for free.
//
// What stays OUT of this file, deliberately: fetching/decoding/caching
// (GLTFLoader, module-scope caches) and any per-asset material fixups —
// those depend on what the objects actually are and how they were
// exported, which is exactly the part a new category cannot share. This
// file only ever receives already-loadable `Object3D` roots.

import type * as THREEModule from "three";
import { addRocks, makeFadedFloor, type RockPlacement } from "./sceneRocks";

/** The publications card's own pair, and the fallback for `rocks: true`. */
const DEFAULT_ROCKS: RockPlacement[] = [
  { file: "rock-02.glb", pos: [2.05, -1.09, 0.15], rot: [-0.3, 1.4, 0.5], scale: 0.088 },
  { file: "rock-02.glb", pos: [-1.1, -1.17, 0.95], rot: [0.4, 2.3, 0.2], scale: 0.1 },
];

/** The shape any spatial-card item must supply — the composition/hierarchy
 *  data, not the asset itself. `id` only needs to be unique within one
 *  card; nothing here reads it. */
export type SpatialCardObject = {
  id: string;
  /** Uniform scale — real geometry, not a squashed placeholder. */
  scale: number;
  pos: [number, number, number];
  rot: [number, number, number];
  /** Hover delta: position, added to `pos` by the hover amount. */
  lift: [number, number, number];
  /** Hover delta: rotation, radians, added to `rot` by the hover amount. */
  turn: [number, number, number];
  /** How much of the group's own pointer parallax this object takes, 0..1. */
  parallax: number;
};

export type SpatialCardOptions = {
  fov: number;
  camZ: number;
  camY: number;
  /** How far the whole group lifts toward the reader on hover, on top of
   *  each object's own `lift`. */
  groupLiftZ: number;
  /** The pointer's own contribution, in radians of group yaw/pitch. */
  parallaxYaw: number;
  parallaxPitch: number;
  hoverInTau: number;
  hoverOutTau: number;
  pointerTau: number;
  /** How long the whole composition takes to fade/settle in once every
   *  object has finished loading — one shared clock, not one per object. */
  compositionArriveMs: number;
  /** Where the ground plane sits. Objects are composed against this, so it
   *  is the one number that decides whether the group reads as standing on
   *  something or hanging in front of it. */
  floorY: number;
  /** Dark irregular stones at the base, echoing a physical still-life.
   *  `true` uses this engine's default pair; an array places them
   *  explicitly, which is how each card on the ring gets stones of its
   *  own rather than the same two in the same two spots every time. */
  rocks: boolean | RockPlacement[];
  /**
   * THE LIGHTBOX — the display case every card on this ring is staged
   * inside. Half-width of its inner opening in scene units; the panel,
   * the rim and the corner radius all follow from it, so one number moves
   * the whole case and every card keeps the same one. Null leaves the card
   * without a case, which is what the index page's wide floor display
   * wants.
   */
  lightbox: number | null;
  /**
   * HOW MUCH OF THE CASE THE WORK TAKES UP.
   *
   * A uniform scale on the whole object group, applied about the case's
   * own centre. The compositions were authored before there was a case to
   * put them in, so they are sized to the card rather than to the opening
   * — and the case has to read on all four sides, which it cannot if the
   * work grows out of it. This fits a card's existing arrangement into the
   * frame without re-authoring a single placement.
   */
  contentScale: number;
};

export const DEFAULT_SPATIAL_CARD_OPTIONS: SpatialCardOptions = {
  fov: 26,
  camZ: 12.6,
  camY: 0.22,
  groupLiftZ: 0.62,
  parallaxYaw: 5 * (Math.PI / 180),
  parallaxPitch: 4.5 * (Math.PI / 180),
  hoverInTau: 190,
  hoverOutTau: 120,
  pointerTau: 260,
  compositionArriveMs: 420,
  floorY: -1.35,
  rocks: true,
  // Sized against what the card actually shows. At fov 26 and camZ 10.4
  // the card's face is about 4.8 units across; the case sits back at
  // z = -1.62, where the same angle covers about 5.55 — so a half-width of
  // 2.0 puts the case at roughly seven tenths of the card, which is the
  // reference's proportion and leaves the dark border the composition
  // needs on all four sides.
  lightbox: 2.0,
  contentScale: 1,
};


// ── THE LIGHTBOX ────────────────────────────────────────────────────────
//
// Every graphic-design card is one project photographed in the same
// studio, and this is the studio: a thin, dark, softly-cornered display
// case with a warm-white illuminated rim, standing behind and around
// whatever that project is. It is built HERE, once, from one half-width —
// so a card cannot have its own frame size, its own radius or its own rim
// colour, and the family holds by construction rather than by everyone
// remembering the same numbers.
//
// It is also the DOMINANT element, which is a compositional rule and not a
// decorative one: the case is the largest single shape in the frame, it
// reads on all four sides, and the work is staged INSIDE it. Anything that
// covers a side of the case is composed wrong.
//
// Three parts, all real geometry:
//
//   THE PANEL   a dark smoked-acrylic sheet, set back behind the work, so
//               the case has a face to be a case of rather than being an
//               outline floating in the dark.
//   THE RIM     a rounded-square tube swept along the panel's own profile.
//               Emissive warm white, so it is a light in the scene and not
//               a stroke drawn on it.
//   THE SPILL   the rim's own light landing on the panel: a soft radial
//               falloff, additive, just inside the opening.
//
// Nothing here casts a shadow — a case lit along its edge does not throw
// one — and nothing here receives the key. Both would flatten it.

function roundedSquare(THREE: typeof THREEModule, half: number, radius: number) {
  const s = new THREE.Shape();
  const r = Math.min(radius, half);
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  return s;
}

function buildLightbox(
  THREE: typeof THREEModule,
  scene: import("three").Scene,
  opt: SpatialCardOptions
) {
  const half = opt.lightbox as number;
  // Proportions taken off the reference: a generous corner, a rim thin
  // enough to read as a light rather than a border, and the panel set well
  // back so the work stands clear of it.
  const radius = half * 0.19;
  const rimR = half * 0.012;
  const panelZ = -1.62;

  const box = new THREE.Group();
  box.position.z = panelZ;

  // THE PANEL. Barely lighter than the background and quite glossy, so it
  // holds the rim's reflection along its inner edge the way smoked acrylic
  // does, and stays nearly black everywhere else.
  const panel = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedSquare(THREE, half, radius), 16),
    new THREE.MeshStandardMaterial({
      color: 0x0b0a0a,
      roughness: 0.34,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
  );
  box.add(panel);

  // THE RIM. A tube swept along the same rounded square, standing a little
  // proud of the panel. Emissive rather than lit: it is the source.
  const path = new THREE.CurvePath<import("three").Vector3>();
  const pts = roundedSquare(THREE, half, radius).getPoints(96);
  for (let i = 0; i < pts.length - 1; i++) {
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(pts[i].x, pts[i].y, 0),
        new THREE.Vector3(pts[i + 1].x, pts[i + 1].y, 0)
      )
    );
  }
  const rim = new THREE.Mesh(
    new THREE.TubeGeometry(path, 320, rimR, 10, true),
    new THREE.MeshStandardMaterial({
      color: 0xfff0d8,
      emissive: new THREE.Color(0xffe9c9),
      emissiveIntensity: 2.4,
      roughness: 0.4,
      metalness: 0,
    })
  );
  rim.position.z = 0.035;
  box.add(rim);

  // THE SPILL. What the rim throws onto the panel it is mounted on —
  // brightest at the edge, gone by a third of the way in. A canvas
  // gradient rather than a light, because a real light here would also
  // strike the work standing in front of the panel, and the work is lit by
  // the key from above.
  const N = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(N / 2, N / 2, N * 0.2, N / 2, N / 2, N * 0.72);
    // Tight to the edge and gone well before the middle: this is the rim's
    // light landing on the panel it is mounted on, not a glow filling the
    // case. Anything wider washes the dark the composition is built on.
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.58, "rgba(0,0,0,0)");
    g.addColorStop(0.86, "rgba(96,68,38,0.22)");
    g.addColorStop(1, "rgba(214,176,124,0.52)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(canvas);
    const spill = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedSquare(THREE, half * 0.995, radius), 16),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    // ShapeGeometry has no UVs that match its own bounds, so the gradient
    // is mapped onto the panel's box rather than onto each triangle.
    const pos = spill.geometry.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) / (half * 2)) + 0.5;
      uv[i * 2 + 1] = (pos.getY(i) / (half * 2)) + 0.5;
    }
    spill.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    spill.position.z = 0.02;
    box.add(spill);
  }

  scene.add(box);
}

/**
 * Mounts the whole card — renderer, lights, group, floor, optional rocks,
 * the load-then-arrive sequence, and the per-frame hover/parallax tick — into
 * `host`, and returns a cleanup function. Synchronous (the caller has
 * already awaited whatever async work getting `THREE` itself needed), so
 * the returned cleanup is available the instant this returns, the same
 * contract a plain effect body has.
 */
export function mountSpatialCard<T extends SpatialCardObject>(
  host: HTMLDivElement,
  THREE: typeof THREEModule,
  items: T[],
  loadRoot: (item: T) => Promise<import("three").Object3D>,
  lumRef: { current: number },
  reduced: boolean,
  options: Partial<SpatialCardOptions> = {}
): () => void {
  const opt = { ...DEFAULT_SPATIAL_CARD_OPTIONS, ...options };
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opt.fov, 1, 0.1, 60);
  camera.position.set(0, opt.camY, opt.camZ);
  camera.lookAt(0, 0, 0);

  // THE LIGHT IN THE CASE. Three sources: a key from above/front (where a
  // lit display's own light would come from), a cool fill opposite so backs
  // are not black, and a low warm bounce standing in for the case's own
  // surface throwing light back up. Kept close to neutral/white — any warm
  // cast in the surrounding beat belongs to whatever lights the card from
  // outside, not to this rig, so an object's own colour reads true.
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


  const group = new THREE.Group();
  scene.add(group);

  // A real surface, not a bare shadow catcher: with the group this close to
  // filling the card, objects standing over an invisible plane read as
  // floating in the case rather than set down in it. See makeFadedFloor for
  // why it fades rather than ending at a horizon.
  group.add(
    makeFadedFloor(THREE, {
      size: 7,
      y: opt.floorY,
      color: 0x100e0c,
      core: 0.18,
      roughness: 0.5,
      metalness: 0.18,
    })
  );

  if (opt.rocks) {
    const placements: RockPlacement[] = Array.isArray(opt.rocks)
      ? opt.rocks
      : DEFAULT_ROCKS;
    // Staged as the reference does: one rock at the back right for the
    // smallest piece to stand against and to close the gap beneath it, one
    // forward and left, on the surface in front of the group — the SAME
    // supplied rock both times, just a different scale/rotation/
    // position, per the brief's "use the same supplied GLB at different
    // scale/rotation/position rather than different rock files." Async —
    // see addRocks — so this fires and forgets rather than blocking the
    // rest of the synchronous setup.
    // The renderer goes in so the stones get an environment to reflect —
    // scoped to them alone, so nothing else in this case changes. See
    // addRocks and getStoneEnvironment.
    void addRocks(THREE, group, placements, renderer);
  }

  if (opt.lightbox) buildLightbox(THREE, scene, opt);
  // Applied to the group itself rather than to each object, so hover,
  // parallax and every authored position keep their relationship exactly.
  if (opt.contentScale !== 1) group.scale.setScalar(opt.contentScale);

  type Loaded = { item: T; node: import("three").Object3D };
  const loaded: Loaded[] = [];
  const textures: import("three").Texture[] = [];
  let compositionReadyAt: number | null = null;

  // ALL ITEMS REQUESTED IN PARALLEL, and nothing is added to `group` until
  // every one of them has resolved — a reader watching the card only ever
  // sees "nothing yet" or "all of them together," never a one-at-a-time
  // pop-in.
  Promise.all(items.map((item) => loadRoot(item).then((root) => ({ item, root })))).then(
    (results) => {
      if (disposed) return;
      for (const { item, root } of results) {
        const instance = root.clone(true);
        instance.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          // A mesh can carry ONE material or an array of them (a panel
          // whose face is artwork and whose edges are plain stock). The
          // array case has to be unpacked rather than read as a material:
          // `someArray.map` is Array.prototype.map, a function, and
          // pushing that here is what later threw "t.dispose is not a
          // function" when this ran its own cleanup.
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const map = (m as import("three").MeshStandardMaterial)?.map;
            if (map) textures.push(map);
          }
        });
        const holder = new THREE.Group();
        holder.add(instance);
        holder.scale.setScalar(item.scale);
        holder.position.set(...item.pos);
        holder.rotation.set(...item.rot);
        group.add(holder);
        loaded.push({ item, node: holder });
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

  // THE POINTER, READ NOT LISTENED FOR — see PublicationsDisplay's own
  // (Publications-specific) note on why: `--pub-hover` and the pointer
  // custom properties are written by the arc card / HoverCard this engine
  // is mounted inside, and reading them here means the card answers the
  // same gesture its own tilt does, with no second listener.
  const arcCard = host.closest("[data-arc-card]") as HTMLElement | null;
  const wrapper = host.closest(".hc-wrapper") as HTMLElement | null;
  const coarse = window.matchMedia("(hover: none)").matches;

  let hover = 0;
  let px = 0.5;
  let py = 0.5;
  let last = performance.now();
  let raf = 0;

  // A read-only handle for verification harnesses.
  (host as HTMLElement & { __spatialCard?: unknown }).__spatialCard = {
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
    const dt = Math.min(250, Math.max(1, now - last));
    last = now;

    const wanted =
      !coarse && arcCard
        ? parseFloat(getComputedStyle(arcCard).getPropertyValue("--pub-hover")) || 0
        : 0;
    const tau = wanted > hover ? opt.hoverInTau : opt.hoverOutTau;
    hover += (wanted - hover) * (1 - Math.exp(-dt / tau));
    if (Math.abs(wanted - hover) < 0.004) hover = wanted;

    if (wrapper) {
      const cs = getComputedStyle(wrapper);
      const tx = parseFloat(cs.getPropertyValue("--pointer-from-left")) || 0.5;
      const ty = parseFloat(cs.getPropertyValue("--pointer-from-top")) || 0.5;
      const kp = 1 - Math.exp(-dt / opt.pointerTau);
      px += (tx - px) * kp;
      py += (ty - py) * kp;
    }

    const h = reduced ? 0 : hover * hover * (3 - 2 * hover);

    const arriveT =
      compositionReadyAt == null
        ? 0
        : Math.min(1, (now - compositionReadyAt) / opt.compositionArriveMs);
    const arrive = arriveT * arriveT * (3 - 2 * arriveT);

    for (const { item, node } of loaded) {
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
        item.pos[0] + item.lift[0] * h,
        item.pos[1] + item.lift[1] * h + (1 - arrive) * 0.22,
        item.pos[2] + (item.lift[2] + opt.groupLiftZ * item.parallax) * h
      );
      node.rotation.set(
        item.rot[0] + item.turn[0] * h,
        item.rot[1] + item.turn[1] * h,
        item.rot[2] + item.turn[2] * h
      );
    }

    group.rotation.y = (px - 0.5) * 2 * opt.parallaxYaw * h;
    group.rotation.x = -(py - 0.5) * 2 * opt.parallaxPitch * h;

    const lum = lumRef.current * (1 + 0.14 * h);
    key.intensity = (2.1 + 0.55 * h) * lum;
    fill.intensity = (0.5 + 0.1 * h) * lum;
    bounce.intensity = (0.28 + 0.14 * h) * lum;
    ambient.intensity = (0.42 + 0.08 * h) * lum;
    renderer.toneMappingExposure = 1.16 + 0.07 * h;

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("resize", resize);
    for (const t of textures) t.dispose();
    scene.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        // The floor's fade is a canvas texture this engine made itself, so
        // unlike the publications' own maps (owned by the shared cache) it
        // has to go with the material carrying it.
        (m as import("three").MeshStandardMaterial)?.alphaMap?.dispose();
        m?.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
