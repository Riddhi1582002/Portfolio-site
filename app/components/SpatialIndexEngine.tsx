"use client";

// THE REUSABLE SPATIAL PROJECT-INDEX ENGINE.
//
// Extracted from what was originally Publications-only code in
// PublicationsIndexDisplay.tsx: a full-page arrangement of real 3D objects
// that IS the navigation — raycast hover (synced with an outside text
// index), click-to-select, a receding/dimming response for whatever is NOT
// active, and a short focus transition that hands off to wherever a
// selected object's own presentation lives. Publications is the first
// Graphic Design category to use it; nothing below refers to a book or a
// publication, so a later category (Campaigns, Branding, ...) supplies its
// own `items` and `loadRoot` — posters, identity pieces, presentation
// screens, whatever the category's real objects are — and gets the same
// arrangement grammar, the same hover/recede/focus language, for free.
//
// What stays OUT of this file, same as SpatialCardEngine next door:
// fetching/decoding/caching and per-asset material fixups. This file only
// ever receives already-loadable `Object3D` roots and a wide/narrow
// placement per object.

import type * as THREEModule from "three";

export type SpatialIndexPlacement = {
  scale: number;
  pos: [number, number, number];
  rot: [number, number, number];
};

/** The shape any spatial-index item must supply. `id` is the identity a
 *  caller's own hover/select state and text index are keyed on. */
export type SpatialIndexObject = {
  id: string;
  /** Hover/focus response strength, 0..1 — the hero of a composition gets
   *  the strongest lift, the smallest supporting piece the subtlest. */
  emphasis: number;
  wide: SpatialIndexPlacement;
  narrow: SpatialIndexPlacement;
};

export type SpatialIndexCallbacks = {
  /** Reported whenever the raycaster itself finds (or loses) a hovered
   *  object, so a caller's own text index can highlight in return. */
  onHoverObject: (id: string | null) => void;
  onSelectObject: (id: string) => void;
  /** Fired once, when the click-focus transition for the selected object
   *  finishes easing in — the hand-off point to that object's own
   *  presentation. */
  onFocusComplete: (id: string) => void;
  /** Screen-space position of the active (hovered ?? selected) object's
   *  anchor point, for a metadata label — null when nothing is active. */
  onActiveScreenPos: (pos: { x: number; y: number } | null) => void;
};

export type SpatialIndexRefs = {
  /** Externally hovered id (e.g. from a text index), read every frame via a
   *  ref so this engine never has to be re-mounted on a hover change. */
  hoveredIdRef: { current: string | null };
  selectedIdRef: { current: string | null };
  narrowRef: { current: boolean };
};

export type SpatialIndexOptions = {
  fov: number;
  camZ: number;
  camY: number;
  camNear: number;
  camFar: number;
  hoverLiftZ: number;
  hoverLiftY: number;
  hoverTurnX: number;
  hoverTurnY: number;
  hoverInTau: number;
  hoverOutTau: number;
  /** How far a non-active object recedes (pushed back in Z) while
   *  something else is hovered/selected. */
  recedeZ: number;
  recedeOpacityHover: number;
  recedeOpacitySelect: number;
  /** The click transition: how much further forward and how much larger
   *  the selected object grows, and how long that takes before
   *  `onFocusComplete` fires. */
  focusExtraZ: number;
  focusScale: number;
  focusMs: number;
  compositionArriveMs: number;
};

export const DEFAULT_SPATIAL_INDEX_OPTIONS: SpatialIndexOptions = {
  fov: 28,
  camZ: 12.5,
  camY: 0.15,
  camNear: 8,
  camFar: 18,
  hoverLiftZ: 1.05,
  hoverLiftY: 0.16,
  hoverTurnX: 2 * (Math.PI / 180),
  hoverTurnY: -5 * (Math.PI / 180),
  hoverInTau: 190,
  hoverOutTau: 130,
  recedeZ: 0.22,
  recedeOpacityHover: 0.72,
  recedeOpacitySelect: 0.34,
  focusExtraZ: 1.15,
  focusScale: 1.07,
  focusMs: 520,
  compositionArriveMs: 480,
};

/**
 * Mounts the whole index — renderer, lights, group, floor, per-object
 * raycast hover/click, the recede/focus response, and the composition
 * arrival — into `host`, and returns a cleanup function. Synchronous, same
 * contract as `mountSpatialCard`.
 */
export function mountSpatialIndex<T extends SpatialIndexObject>(
  host: HTMLDivElement,
  THREE: typeof THREEModule,
  items: T[],
  loadRoot: (item: T) => Promise<import("three").Object3D>,
  callbacks: SpatialIndexCallbacks,
  refs: SpatialIndexRefs,
  options: Partial<SpatialIndexOptions> = {}
): () => void {
  const opt = { ...DEFAULT_SPATIAL_INDEX_OPTIONS, ...options };
  const { onHoverObject, onSelectObject, onFocusComplete, onActiveScreenPos } = callbacks;
  const { hoveredIdRef, selectedIdRef, narrowRef } = refs;
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
  // Near/far bounded tightly around where this composition actually sits —
  // at a wider default range the depth buffer starves of precision this far
  // out, and two near-coincident surfaces (an object's own front cover and
  // its page block, say) lose the depth test to whichever the GPU rounds to
  // be "closer," regardless of which actually is.
  const camera = new THREE.PerspectiveCamera(opt.fov, 1, opt.camNear, opt.camFar);
  camera.position.set(0, opt.camY, opt.camZ);
  camera.lookAt(0, 0, 0);

  // Same lit-display-case rig as SpatialCardEngine: warm key from
  // above/front, cool fill opposite, low warm bounce standing in for a
  // surface throwing light back up.
  const key = new THREE.DirectionalLight(0xfff4e2, 2.1);
  key.position.set(2.4, 4.6, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 26;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
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

  const group = new THREE.Group();
  scene.add(group);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.4;
  floor.receiveShadow = true;
  group.add(floor);

  type Loaded = {
    item: T;
    holder: import("three").Object3D;
    meshes: import("three").Mesh[];
  };
  const loaded: Loaded[] = [];
  const clonedMaterials: import("three").Material[] = [];
  const sharedTextures = new Set<import("three").Texture>();
  let compositionReadyAt: number | null = null;

  Promise.all(items.map((item) => loadRoot(item).then((root) => ({ item, root })))).then(
    (results) => {
      if (disposed) return;
      for (const { item, root } of results) {
        const instance = root.clone(true);
        const meshes: import("three").Mesh[] = [];
        instance.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as import("three").MeshStandardMaterial;
          if (mat?.map) sharedTextures.add(mat.map);
          // Cloned so this index's own opacity/dim mutations never touch a
          // cached root's shared material (which some other view — a card
          // showing the same object — clones its own instances from).
          const own = mat.clone();
          mesh.material = own;
          clonedMaterials.push(own);
          meshes.push(mesh);
        });
        const holder = new THREE.Group();
        holder.add(instance);
        holder.userData.spatialId = item.id;
        const p = narrowRef.current ? item.narrow : item.wide;
        holder.scale.setScalar(p.scale);
        holder.position.set(...p.pos);
        holder.rotation.set(...p.rot);
        group.add(holder);
        loaded.push({ item, holder, meshes });
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
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(host);

  // ── POINTER: raycast for per-object hover and click. ──────────────
  const coarse = window.matchMedia("(hover: none)").matches;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);
  let pointerInside = false;

  const setNdcFromEvent = (ev: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  };
  const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse") return;
    pointerInside = true;
    setNdcFromEvent(ev);
  };
  const onPointerLeave = () => {
    pointerInside = false;
  };
  const pickAt = (ev: PointerEvent): string | null => {
    setNdcFromEvent(ev);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      loaded.map((l) => l.holder),
      true
    );
    if (!hits.length) return null;
    for (let o: import("three").Object3D | null = hits[0].object; o; o = o.parent) {
      if (o.userData?.spatialId) return o.userData.spatialId as string;
    }
    return null;
  };
  const onClick = (ev: PointerEvent) => {
    const id = pickAt(ev);
    if (id) onSelectObject(id);
  };
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("click", onClick as EventListener);

  // A read-only handle for verification harnesses.
  (host as HTMLElement & { __spatialIndex?: unknown }).__spatialIndex = {
    camera,
    scene,
    group,
    loaded,
    three: THREE,
    renderer,
  };

  let last = performance.now();
  let raf = 0;
  let rayHoverId: string | null = null;
  let lastScreenX = -1e9,
    lastScreenY = -1e9;
  const hoverAmount = new Map<string, number>();
  let focusFiredFor: string | null = null;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min(250, Math.max(1, now - last));
    last = now;

    // Raycast (mouse only — touch selects by tap, not hover) and report
    // changes up so a caller's own text index can highlight in return.
    if (!coarse && pointerInside && loaded.length) {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(
        loaded.map((l) => l.holder),
        true
      );
      let id: string | null = null;
      if (hits.length) {
        for (let o: import("three").Object3D | null = hits[0].object; o; o = o.parent) {
          if (o.userData?.spatialId) {
            id = o.userData.spatialId as string;
            break;
          }
        }
      }
      if (id !== rayHoverId) {
        rayHoverId = id;
        onHoverObject(id);
      }
    } else if (rayHoverId !== null && (!pointerInside || coarse)) {
      rayHoverId = null;
      onHoverObject(null);
    }

    const activeId = selectedIdRef.current ?? hoveredIdRef.current;
    const selected = selectedIdRef.current;

    const arriveT =
      compositionReadyAt == null ? 0 : Math.min(1, (now - compositionReadyAt) / opt.compositionArriveMs);
    const arrive = arriveT * arriveT * (3 - 2 * arriveT);

    for (const { item, holder, meshes } of loaded) {
      const isActive = item.id === activeId;
      const wanted = isActive ? 1 : 0;
      const prev = hoverAmount.get(item.id) ?? 0;
      const tau = wanted > prev ? opt.hoverInTau : opt.hoverOutTau;
      let h = prev + (wanted - prev) * (1 - Math.exp(-dt / tau));
      if (Math.abs(wanted - h) < 0.004) h = wanted;
      hoverAmount.set(item.id, h);
      const hEase = h * h * (3 - 2 * h);

      const anyActive = activeId != null;
      const receding = anyActive && !isActive ? 1 : 0;
      const recedeKey = `${item.id}:r`;
      const prevR = hoverAmount.get(recedeKey) ?? 0;
      let r = prevR + (receding - prevR) * (1 - Math.exp(-dt / 220));
      if (Math.abs(receding - r) < 0.004) r = receding;
      hoverAmount.set(recedeKey, r);

      let f = 0;
      if (selected === item.id) {
        const focusKey = `${item.id}:f`;
        const prevF = hoverAmount.get(focusKey) ?? 0;
        f = prevF + (1 - prevF) * (1 - Math.exp(-dt / (opt.focusMs * 0.6)));
        if (1 - f < 0.004) f = 1;
        hoverAmount.set(focusKey, f);
        if (f >= 1 && focusFiredFor !== item.id) {
          focusFiredFor = item.id;
          onFocusComplete(item.id);
        }
      } else {
        // Selection moved elsewhere (or cleared) — re-arm so choosing this
        // same object again fires a fresh completion.
        hoverAmount.delete(`${item.id}:f`);
        if (focusFiredFor === item.id) focusFiredFor = null;
      }

      const p = narrowRef.current ? item.narrow : item.wide;
      const receOpacityFloor = selected ? opt.recedeOpacitySelect : opt.recedeOpacityHover;

      holder.position.set(
        p.pos[0],
        p.pos[1] + opt.hoverLiftY * item.emphasis * hEase + (1 - arrive) * 0.3,
        p.pos[2] +
          opt.hoverLiftZ * item.emphasis * hEase +
          opt.focusExtraZ * f -
          opt.recedeZ * r
      );
      holder.rotation.set(
        p.rot[0] + opt.hoverTurnX * item.emphasis * hEase,
        p.rot[1] + opt.hoverTurnY * item.emphasis * hEase,
        p.rot[2]
      );
      holder.scale.setScalar(p.scale * (1 + (opt.focusScale - 1) * f));

      const targetOpacity = arrive < 1 ? arrive : 1 - (1 - receOpacityFloor) * r;
      for (const mesh of meshes) {
        const mat = mesh.material as import("three").MeshStandardMaterial;
        if (!mat) continue;
        if (targetOpacity < 0.999) {
          mat.transparent = true;
          mat.opacity = targetOpacity;
        } else if (mat.transparent) {
          mat.transparent = false;
          mat.opacity = 1;
        }
      }
    }

    // Report the active object's screen position for a metadata label, only
    // when it actually changed.
    if (activeId) {
      const found = loaded.find((l) => l.item.id === activeId);
      if (found) {
        // The object's actual TOP edge, not its centre — the centre anchor
        // puts a label over the middle of the cover once a hovered/focused
        // object has grown a good deal larger than its resting size.
        const box = new THREE.Box3().setFromObject(found.holder);
        const anchor = new THREE.Vector3(
          (box.min.x + box.max.x) / 2,
          box.max.y,
          (box.min.z + box.max.z) / 2
        );
        anchor.project(camera);
        const w = host.clientWidth || 1;
        const h2 = host.clientHeight || 1;
        const sx = (anchor.x * 0.5 + 0.5) * w;
        const sy = (-anchor.y * 0.5 + 0.5) * h2;
        if (Math.hypot(sx - lastScreenX, sy - lastScreenY) > 1.5) {
          lastScreenX = sx;
          lastScreenY = sy;
          onActiveScreenPos({ x: sx, y: sy });
        }
      }
    } else if (lastScreenX !== -1e9) {
      lastScreenX = -1e9;
      lastScreenY = -1e9;
      onActiveScreenPos(null);
    }

    const lum = 1 + 0.1 * (hoverAmount.get(activeId ?? "") ?? 0);
    key.intensity = 2.1 * lum;
    fill.intensity = 0.5 * lum;
    bounce.intensity = 0.28 * lum;
    ambient.intensity = 0.42 * lum;

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("resize", resize);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerleave", onPointerLeave);
    host.removeEventListener("click", onClick as EventListener);
    // Geometry is shared with a cache root — never disposed here.
    for (const t of sharedTextures) t.dispose();
    for (const m of clonedMaterials) m.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
