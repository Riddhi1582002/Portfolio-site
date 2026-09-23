"use client";

// THE REUSABLE CARD ENGINE.
//
// Extracted from what was originally Publications-only code in
// PublicationsDisplay.tsx: the lit-display-case renderer that stands a
// small group of real 3D objects inside an arc card, answers the card's own
// hover as one group (depth, lift, parallax), and fades the whole
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
   *  explicitly. Ignored in the studio, whose cards carry none. */
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
  /**
   * WHICH OBJECT IS BEING LOOKED AT, if any — the id of one item, or null.
   *
   * Read every frame rather than watched, and eased on this engine's own
   * clock alongside hover and arrival, because those three all move the
   * same holder and the last one to write a frame would otherwise win. A
   * caller tweening `node.position` from outside loses that race on the
   * very next tick; a ref here cannot.
   */
  focusRef?: { current: string | null };
  /**
   * AN ENVIRONMENT FOR THE WHOLE SCENE, at this intensity, or absent for
   * none.
   *
   * Off by default, and deliberately: the cards that stage printed work
   * must render the supplied artwork exactly as delivered, and a
   * scene-wide environment lifts it — which is why the stones get theirs
   * scoped to their own material instead.
   *
   * A card staging GLASS AND METAL is the opposite case. Transparent glass
   * with nothing to reflect does not read as glass at all; it comes out
   * flat white, which is exactly what a clear bottle looked like here
   * before this existed. There the environment is not a lift, it is the
   * material.
   */
  environment?: number;
  /**
   * THE STUDIO — the ring's still-life look, taken from the reference the
   * cards are matched to: the pieces float at varied tilts and fill the
   * case; a warm spot from overhead and a gold rim from behind light them;
   * the floor is glossy and dark with a warm pool under the group. Only
   * with a lightbox, and only where a card asks for it.
   *
   * The lightbox itself, and every hover movement, are unchanged by it.
   */
  studio?: boolean;
};

export const DEFAULT_SPATIAL_CARD_OPTIONS: SpatialCardOptions = {
  fov: 26,
  camZ: 12.6,
  camY: 0.22,
  groupLiftZ: 0.62,
  parallaxYaw: 5 * (Math.PI / 180),
  parallaxPitch: 4.5 * (Math.PI / 180),
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


// ── THE STUDIO ──────────────────────────────────────────────────────────
//
// PLACEMENT. Each card's own composition is kept — its order, overlaps and
// depths — and then lifted off the floor and tilted, piece by piece, from
// these fixed sequences, so the group reads as floating rather than
// standing; then the whole group is fitted to the case's opening, so every
// card fills its frame the same amount whatever size its pieces were
// authored at. Deterministic: the same card always lands the same way.
const STUDIO_TILT_Z = [-6, 5, -3.5, 7, -5, 4, -7, 3].map((d) => (d * Math.PI) / 180);
const STUDIO_TILT_X = [3, -2.5, 4, -2, 2.5, -3, 2, -1.5].map((d) => (d * Math.PI) / 180);
const STUDIO_FLOAT_Y = [0.14, -0.06, 0.2, 0.02, 0.1, -0.1, 0.16, -0.02];
/** Where the fitted group sits in the opening, as shares of it. The work
 *  is the point of the card, so it takes nearly all of it: a sliver at the
 *  sides and top, and a little more at the bottom for the glossy floor and
 *  its pool of light — the air under the group is what makes it float.
 *  (There were stones down there too; the studio no longer has them.) */
const STUDIO_FIT = { side: 0.035, top: 0.055, bottom: 0.08 };
/** A group wider than the card is fitted by its HEIGHT, and may run this
 *  much past the width it would otherwise be held to — the outer pieces
 *  crop at the card's edge, like a photograph's frame, rather than the
 *  whole group shrinking to a strip across the middle of the card. */
const STUDIO_OVERFLOW = 0.1;
/** How far past the card's own face the studio case is drawn: enough that
 *  the camera's slight rise never shows its edge inside the card. */
const CASE_OVERSCAN = 1.06;

// ── THE HOVER ───────────────────────────────────────────────────────────
//
// A physical answer, not a brighter one. Hover used to raise every light
// and the exposure with it, which read as the work going pale — white
// washed over the artwork rather than anything happening to it. The light
// now stays exactly where it is and the OBJECTS respond: the group opens
// out in depth (the nearest pieces come forward, the furthest settle
// back), every piece rises a little and turns toward the reader as its
// resting tilt relaxes, and the group follows the pointer further — so
// the layers visibly separate as the hand moves. It arrives on a spring
// with a small overshoot, so it lands like something with weight, and
// leaves critically damped, so letting go never wobbles.
/** Depth the group opens by, in world units, back piece to front piece. */
const HOVER_DEPTH = 1.15;
/** How far each piece rises. */
const HOVER_RISE = 0.1;
/** How much of the studio's resting tilt each piece lets go of. */
const HOVER_STRAIGHTEN = 0.6;
/** The group's pointer-follow while hovered, over the resting values. */
const HOVER_PARALLAX = 1.6;
/** Spring: angular frequency (rad/s) and damping ratio, in and out. */
const HOVER_OMEGA = 15;
const HOVER_ZETA_IN = 0.6;
const HOVER_ZETA_OUT = 1;

/** A soft radial gradient on a canvas, as a texture. Stops are [t, rgba]. */
function radialTexture(
  THREE: typeof THREEModule,
  stops: [number, string][],
  cx = 0.5,
  cy = 0.5
) {
  const N = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(N * cx, N * cy, 0, N * cx, N * cy, N * 0.5);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return new THREE.CanvasTexture(canvas);
}

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
  // In the studio the case runs past the card's edges (see CASE_OVERSCAN),
  // so the card's edge is the case's own back and no rim is left inside.
  const half = (opt.lightbox as number) * (opt.studio ? CASE_OVERSCAN : 1);
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

  // THE STUDIO'S BACKDROP: the overhead spot's own glow on the back of
  // the case, brightest high in the middle and gone by the sides — the
  // warm haze the reference's pieces float against.
  if (opt.studio) {
    const tex = radialTexture(
      THREE,
      [
        [0, "rgba(255,168,78,0.36)"],
        [0.35, "rgba(200,112,40,0.17)"],
        [0.7, "rgba(110,56,18,0.04)"],
        [1, "rgba(0,0,0,0)"],
      ],
      0.5,
      0.5
    );
    if (tex) {
      const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 2.3, half * 2.3),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      haze.position.set(0, half * 0.42, 0.01);
      box.add(haze);
    }
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
  opt.studio = !!opt.studio && opt.lightbox != null;
  // THE CASE IS THE CARD. On the ring the case used to stand inside the
  // card at about two thirds of its width, leaving a dark margin and a
  // second, smaller box inside the card's own edge. In the studio its
  // opening is now the card's whole face at the case's depth — so the fit,
  // the stones and the haze, which all measure from it, fill the card.
  if (opt.studio) {
    opt.lightbox = (opt.camZ + 1.62) * Math.tan((opt.fov * Math.PI) / 360);
  }
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

  // THE STUDIO'S LIGHT. The front key stays near white and carries the
  // artwork's own colour; the warmth is all in the two added sources — a
  // spot from overhead, which also throws the pool on the floor, and a
  // gold rim from behind, which catches every top and side edge and runs
  // along the glossy floor towards the lens.
  let spot: import("three").SpotLight | null = null;
  let rimLight: import("three").DirectionalLight | null = null;
  if (opt.studio) {
    spot = new THREE.SpotLight(0xffc68e, 5.2, 0, 0.46, 1, 0);
    spot.position.set(0, 5.4, 1.3);
    spot.target.position.set(0, -0.2, 0.3);
    scene.add(spot, spot.target);
    rimLight = new THREE.DirectionalLight(0xffb05e, 4);
    // Steep, so its sheen on the glossy floor lands behind the group
    // rather than as a lit band across the whole front of the case.
    rimLight.position.set(0.4, 4.4, -4.2);
    scene.add(rimLight);
  }


  const group = new THREE.Group();
  scene.add(group);
  /** The pieces themselves — fitted to the case in studio mode, while the
   *  floor and the stones stay where the case puts them. */
  const content = new THREE.Group();
  group.add(content);

  // A real surface, not a bare shadow catcher: with the group this close to
  // filling the card, objects standing over an invisible plane read as
  // floating in the case rather than set down in it. See makeFadedFloor for
  // why it fades rather than ending at a horizon.
  group.add(
    makeFadedFloor(THREE, {
      size: 7,
      y: opt.floorY,
      // Studio: dark and glossy, so the rim light runs along it.
      color: opt.studio ? 0x0c0a08 : 0x100e0c,
      core: opt.studio ? 0.26 : 0.18,
      roughness: opt.studio ? 0.32 : 0.5,
      metalness: opt.studio ? 0.3 : 0.18,
    })
  );
  // THE POOL: the overhead spot landing on the floor under the group,
  // warm and soft-edged, the floor's brightest place.
  if (opt.studio) {
    const tex = radialTexture(THREE, [
      [0, "rgba(255,176,96,0.34)"],
      [0.3, "rgba(214,128,56,0.14)"],
      [0.65, "rgba(120,62,24,0.03)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    if (tex) {
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.7),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, opt.floorY + 0.004, 0.35);
      group.add(pool);
    }
  }

  // Never in the studio: the ring's cards are the work alone now, with
  // nothing at their base competing with it.
  if (opt.rocks && !opt.studio) {
    const placements: RockPlacement[] = Array.isArray(opt.rocks) ? opt.rocks : DEFAULT_ROCKS;
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

  // AN ENVIRONMENT, where this scene's materials need one to be materials
  // at all — see SpatialCardOptions.environment.
  let envCancelled = false;
  let releaseEnv: (() => void) | null = null;
  if (opt.environment) {
    const intensity = opt.environment;
    void import("three/examples/jsm/environments/RoomEnvironment.js")
      .then(({ RoomEnvironment }) => {
        if (envCancelled || disposed) return;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
        pmrem.dispose();
        scene.environment = target.texture;
        scene.environmentIntensity = intensity;
        releaseEnv = () => {
          scene.environment = null;
          target.texture.dispose();
        };
      })
      .catch(() => {
        // No environment is the old look, not a broken one.
      });
  }
  // Applied to the group itself rather than to each object, so hover,
  // parallax and every authored position keep their relationship exactly.
  if (opt.contentScale !== 1 && !opt.studio) group.scale.setScalar(opt.contentScale);

  /** What each material was authored as, before the arrival fade touched
   *  it — so the fade can put it back rather than flattening it. */
  const authored = new Map<
    import("three").Material,
    { transparent: boolean; opacity: number }
  >();

  /** Per-object focus, eased. Keyed by the item's own id. */
  const focusAmount = new Map<string, number>();

  type Loaded = {
    item: T;
    node: import("three").Object3D;
    /** Where it rests: the authored pose, plus the studio's float/tilt. */
    pos: [number, number, number];
    rot: [number, number, number];
    /** The studio's own added tilt (x, z) — what hover relaxes. */
    tilt: [number, number];
    /** Front-to-back rank, -0.5 (furthest) .. 0.5 (nearest). */
    depth: number;
  };
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
        content.add(holder);
        const k = loaded.length;
        const pos: [number, number, number] = opt.studio
          ? [item.pos[0], item.pos[1] + STUDIO_FLOAT_Y[k % STUDIO_FLOAT_Y.length], item.pos[2]]
          : [...item.pos];
        const rot: [number, number, number] = opt.studio
          ? [
              item.rot[0] + STUDIO_TILT_X[k % STUDIO_TILT_X.length],
              item.rot[1],
              item.rot[2] + STUDIO_TILT_Z[k % STUDIO_TILT_Z.length],
            ]
          : [...item.rot];
        holder.position.set(...pos);
        holder.rotation.set(...rot);
        const tilt: [number, number] = opt.studio
          ? [STUDIO_TILT_X[k % STUDIO_TILT_X.length], STUDIO_TILT_Z[k % STUDIO_TILT_Z.length]]
          : [0, 0];
        loaded.push({ item, node: holder, pos, rot, tilt, depth: 0 });
      }
      // Rank by resting depth, so hover can open the group out front to back.
      const byZ = [...loaded].sort((a, b) => a.pos[2] - b.pos[2]);
      byZ.forEach((l, i) => {
        l.depth = byZ.length > 1 ? i / (byZ.length - 1) - 0.5 : 0.5;
      });
      if (opt.studio) fitToCase();
      compositionReadyAt = performance.now();
    }
  );

  /**
   * THE FIT. Scales and moves the pieces (never the case, the floor or the
   * stones) until their projected bounds fill the case's opening to
   * STUDIO_FIT, measured on the rest pose through the actual camera. A few
   * passes, because scaling about the origin also moves the group.
   */
  function fitToCase() {
    const half = opt.lightbox as number;
    const v = new THREE.Vector3();
    camera.updateMatrixWorld();
    const ndc = (x: number, y: number, z: number) => v.set(x, y, z).project(camera).clone();
    const a = ndc(-half, -half, -1.62);
    const b = ndc(half, half, -1.62);
    const W = b.x - a.x;
    const H = b.y - a.y;
    const tx0 = a.x + W * STUDIO_FIT.side;
    const tx1 = b.x - W * STUDIO_FIT.side;
    const ty0 = a.y + H * STUDIO_FIT.bottom;
    const ty1 = b.y - H * STUDIO_FIT.top;
    const box = new THREE.Box3();
    const measure = () => {
      content.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zc = 0;
      for (const { node } of loaded) {
        box.setFromObject(node, true);
        zc += (box.min.z + box.max.z) / 2;
        for (let c = 0; c < 8; c++) {
          const p = ndc(
            c & 1 ? box.max.x : box.min.x,
            c & 2 ? box.max.y : box.min.y,
            c & 4 ? box.max.z : box.min.z
          );
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
          y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
        }
      }
      return { x0, x1, y0, y1, zc: zc / Math.max(1, loaded.length) };
    };
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    for (let pass = 0; pass < 4; pass++) {
      let m = measure();
      const k = Math.min(
        ((tx1 - tx0) / (m.x1 - m.x0)) * (1 + STUDIO_OVERFLOW),
        (ty1 - ty0) / (m.y1 - m.y0)
      );
      content.scale.multiplyScalar(k);
      m = measure();
      const d = camera.position.z - m.zc;
      content.position.x += (((tx0 + tx1) / 2 - (m.x0 + m.x1) / 2) * tanH * d * camera.aspect);
      content.position.y += (((ty0 + ty1) / 2 - (m.y0 + m.y1) / 2) * tanH * d);
    }
  }

  // Sized off the HOST, not the window: a ring card that has rotated out
  // of range is kept mounted but hidden (display: none), and a window
  // resize while it is hidden would have sized it to 1x1 and left it
  // there. The observer skips the hidden, zero-size state and catches
  // the moment the card is shown again at its real size.
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

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
  let hoverVel = 0;
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
    // THE SPRING (see THE HOVER). Integrated in small fixed steps so a
    // long frame cannot make it overshoot further than it is meant to.
    const zeta = wanted > 0.5 ? HOVER_ZETA_IN : HOVER_ZETA_OUT;
    for (let rem = dt / 1000; rem > 0; rem -= 1 / 120) {
      const st = Math.min(rem, 1 / 120);
      const acc = HOVER_OMEGA * HOVER_OMEGA * (wanted - hover) - 2 * zeta * HOVER_OMEGA * hoverVel;
      hoverVel += acc * st;
      hover += hoverVel * st;
    }
    if (Math.abs(wanted - hover) < 0.001 && Math.abs(hoverVel) < 0.01) {
      hover = wanted;
      hoverVel = 0;
    }

    if (wrapper) {
      const cs = getComputedStyle(wrapper);
      const tx = parseFloat(cs.getPropertyValue("--pointer-from-left")) || 0.5;
      const ty = parseFloat(cs.getPropertyValue("--pointer-from-top")) || 0.5;
      const kp = 1 - Math.exp(-dt / opt.pointerTau);
      px += (tx - px) * kp;
      py += (ty - py) * kp;
    }

    const h = reduced ? 0 : hover;
    // Hover distances are in world units; the pieces live inside `content`,
    // which the studio fit has scaled.
    const inv = 1 / (content.scale.x || 1);

    const arriveT =
      compositionReadyAt == null
        ? 0
        : Math.min(1, (now - compositionReadyAt) / opt.compositionArriveMs);
    const arrive = arriveT * arriveT * (3 - 2 * arriveT);

    for (const { item, node, pos, rot, tilt, depth } of loaded) {
      // THE ARRIVAL FADE, and putting back exactly what it found.
      //
      // This used to end by forcing every material it had touched to
      // transparent = false, opacity = 1 — which is right for artwork that
      // was opaque to begin with and destroys anything that was not. A
      // clear bottle's glass is authored at 28% opacity; switched to
      // opaque it renders as white plastic, which is precisely what the
      // Logos card's bottles looked like. Each material's own two values
      // are remembered the first time it is faded and restored when the
      // fade is over, so a material ends the way it was authored.
      if (arrive < 1) {
        node.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const mat = m as import("three").MeshStandardMaterial;
            if (!mat) continue;
            if (!authored.has(mat)) {
              authored.set(mat, { transparent: mat.transparent, opacity: mat.opacity });
            }
            const was = authored.get(mat)!;
            mat.transparent = true;
            mat.opacity = was.opacity * arrive;
          }
        });
      } else if (authored.size) {
        node.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const mat = m as import("three").MeshStandardMaterial;
            const was = mat && authored.get(mat);
            if (!was) continue;
            mat.transparent = was.transparent;
            mat.opacity = was.opacity;
            authored.delete(mat);
          }
        });
      }
      // FOCUS, eased here rather than tweened from outside — see focusRef.
      let f = focusAmount.get(String(item.id)) ?? 0;
      if (opt.focusRef) {
        const target = opt.focusRef.current === item.id ? 1 : 0;
        f += (target - f) * (1 - Math.exp(-dt / 260));
        focusAmount.set(String(item.id), f);
      }
      // Forward and up for the one in focus, a touch back for the rest:
      // attention rather than a jump.
      const fy = 0.12 * f;
      const fz = 0.42 * f - (opt.focusRef ? 0.1 * (1 - f) : 0);

      node.position.set(
        pos[0] + item.lift[0] * h,
        pos[1] + (item.lift[1] + HOVER_RISE * inv) * h + fy + (1 - arrive) * 0.22,
        pos[2] +
          (item.lift[2] + opt.groupLiftZ * item.parallax + HOVER_DEPTH * depth * inv) * h +
          fz
      );
      node.rotation.set(
        rot[0] + (item.turn[0] - tilt[0] * HOVER_STRAIGHTEN) * h,
        rot[1] + item.turn[1] * h,
        rot[2] + (item.turn[2] - tilt[1] * HOVER_STRAIGHTEN) * h
      );
      if (opt.focusRef) {
        node.scale.setScalar(item.scale * (1 + 0.05 * f - 0.03 * (1 - f)));
      }
    }

    group.rotation.y = (px - 0.5) * 2 * opt.parallaxYaw * HOVER_PARALLAX * h;
    group.rotation.x = -(py - 0.5) * 2 * opt.parallaxPitch * HOVER_PARALLAX * h;

    // The light does NOT answer hover (see THE HOVER): only the card's
    // place on the ring dims it.
    const lum = lumRef.current;
    key.intensity = 2.1 * lum;
    fill.intensity = 0.5 * lum;
    bounce.intensity = 0.28 * lum;
    ambient.intensity = 0.42 * lum;
    if (spot) spot.intensity = 5.2 * lum;
    if (rimLight) rimLight.intensity = 4 * lum;

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    envCancelled = true;
    releaseEnv?.();
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
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
    // dispose() frees three's own resources but leaves the browser's
    // WebGL context alive until garbage collection, and Chrome keeps only
    // about sixteen: the ring's cards remount as they rotate, so contexts
    // piled up until the browser started killing the OLDEST ones — the
    // moth, a bulb, a card still on screen — which then went blank or had
    // to rebuild. Released here, the count stays at what is on screen.
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
