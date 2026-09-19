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
  { file: "rock.glb", pos: [2.05, -1.09, 0.15], rot: [-0.3, 1.4, 0.5], scale: 0.088 },
  { file: "rock.glb", pos: [-1.1, -1.17, 0.95], rot: [0.4, 2.3, 0.2], scale: 0.1 },
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
};

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
    // supplied rock.glb both times, just a different scale/rotation/
    // position, per the brief's "use the same supplied GLB at different
    // scale/rotation/position rather than different rock files." Async —
    // see addRocks — so this fires and forgets rather than blocking the
    // rest of the synchronous setup.
    // The renderer goes in so the stones get an environment to reflect —
    // scoped to them alone, so nothing else in this case changes. See
    // addRocks and getStoneEnvironment.
    void addRocks(THREE, group, placements, renderer);
  }

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
