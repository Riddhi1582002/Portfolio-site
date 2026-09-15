"use client";

// THE PUBLICATIONS INDEX — the five publications as one large, spatial
// arrangement that IS the navigation. No UI cards: the physical objects
// themselves are what a reader points at and clicks.
//
// Loading, materials and the lighting philosophy are reused wholesale from
// the Publications card (see PublicationsDisplay.tsx) — same module-scope
// GLTFLoader/cache (so a reader who has already seen the card pays nothing
// to load this page, and one who lands here first warms the card for free),
// same three-light "lit display case" rig, same ACES tone mapping. What
// differs is everything about the COMPOSITION: a much larger, asymmetric
// arrangement built for a full page rather than one square card, and —
// because there are five independently choosable objects here rather than
// one group that rises together — per-object hover via raycasting instead
// of one CSS-var read off a single wrapping card.
//
// Each publication's own material is CLONED before it enters this page's
// scene (see `instance.traverse` below). `Object3D.clone(true)` shares
// geometry AND material by reference with the cached processed root — fine
// for geometry (nothing here ever mutates a vertex), but this page dims
// non-active publications by mutating `material.opacity`, and the cached
// root's material is the SAME object the hero card's own instances clone
// from. Without cloning, hovering here would leave the shared material
// faded and bleed into the card next time it mounts. Textures are still
// shared (never mutated), so they are not cloned, only disposed on unmount
// the same safe, per-renderer-context way the card already does.

import { useEffect, useRef } from "react";
import { PUBLICATIONS as CARD_PUBLICATIONS, loadRoot, getLoader } from "./PublicationsDisplay";

const D = Math.PI / 180;

type Placement = {
  scale: number;
  pos: [number, number, number];
  rot: [number, number, number];
};

export type IndexPublication = {
  id: string;
  title: string;
  /** The one real, non-invented fact available about each file: what kind
   *  of document it is, taken from the asset's own filename. */
  medium: string;
  /** Hover/focus strength, 0..1 — the one number that gives Sneh Sagar the
   *  strongest lift and Policy the subtlest, the same way `parallax` sets
   *  the card's own hover hierarchy. */
  emphasis: number;
  wide: Placement;
  narrow: Placement;
};

// Asymmetric, compact, with real overlap — not a grid. The group sits right
// of centre on a wide frame (the title and index text occupy the left third
// of the page, see PublicationsIndexView), with Sneh Sagar dominant and
// forward, ExcelEDGE clearly second, and Mining/Handbook/Policy receding in
// both scale and depth behind them. `narrow` is a genuinely different,
// more vertically stacked arrangement for portrait screens rather than a
// scaled-down copy of `wide` — see the file banner on why that matters.
export const INDEX_PUBLICATIONS: IndexPublication[] = [
  {
    id: "sneh-sagar",
    title: "Sneh Sagar",
    medium: "Book",
    emphasis: 1,
    wide: { scale: 3.2, pos: [0.5, -0.05, 0.55], rot: [-3 * D, 6 * D, -2 * D] },
    narrow: { scale: 2.3, pos: [-0.05, -0.6, 0.55], rot: [-3 * D, 5 * D, -2 * D] },
  },
  {
    id: "excledge",
    title: "ExcelEDGE",
    medium: "Newsletter",
    emphasis: 0.75,
    wide: { scale: 1.1, pos: [1.6, -0.15, 0.25], rot: [-2 * D, -11 * D, 2.5 * D] },
    narrow: { scale: 0.95, pos: [1.15, -1.0, 0.0], rot: [-2 * D, -9 * D, 2.5 * D] },
  },
  {
    id: "mining",
    title: "Mining",
    medium: "Booklet",
    emphasis: 0.5,
    wide: { scale: 0.82, pos: [-1.9, 0.7, -0.75], rot: [-4 * D, 16 * D, -5 * D] },
    narrow: { scale: 0.85, pos: [-1.5, 0.5, -0.35], rot: [-4 * D, 13 * D, -5 * D] },
  },
  {
    id: "handbook",
    title: "Employee Handbook",
    medium: "Handbook",
    emphasis: 0.4,
    wide: { scale: 0.68, pos: [3.3, 0.55, -1.0], rot: [-4 * D, -16 * D, 4 * D] },
    narrow: { scale: 0.68, pos: [1.5, 1.0, -0.6], rot: [-4 * D, -13 * D, 4 * D] },
  },
  {
    id: "policy",
    title: "Policy",
    medium: "Policy Document",
    emphasis: 0.3,
    wide: { scale: 0.68, pos: [1.3, 1.55, -1.1], rot: [-5 * D, 5 * D, -2.5 * D] },
    narrow: { scale: 0.55, pos: [0.15, 1.75, -0.85], rot: [-5 * D, 4 * D, -2.5 * D] },
  },
];

const FOV = 28;
const CAM_Z = 12.5;
const CAM_Y = 0.15;

// Hover: base deltas at emphasis = 1, scaled per publication by its own
// `emphasis`. Restrained on purpose — a physical lift and a believable
// turn, not a fan-out.
const HOVER_LIFT_Z = 1.05;
const HOVER_LIFT_Y = 0.16;
const HOVER_TURN_X = 2 * D;
const HOVER_TURN_Y = -5 * D;
const HOVER_IN_TAU = 190;
const HOVER_OUT_TAU = 130;

// A non-active publication, while something else is hovered or selected,
// recedes a little (pushed back in Z) and dims — enough to read as "not the
// one being looked at" without disappearing; every publication must stay
// identifiable per the brief.
const RECEDE_Z = 0.22;
const RECEDE_OPACITY_HOVER = 0.72;
const RECEDE_OPACITY_SELECT = 0.34;

// The click transition: short and elegant, not cinematic. The selected
// object pulls further forward and grows slightly; everything else fades
// harder than plain hover-recede. `FOCUS_MS` is how long that takes before
// the "enter project" hook actually fires.
const FOCUS_EXTRA_Z = 1.15;
const FOCUS_SCALE = 1.07;
export const FOCUS_MS = 520;

const COMPOSITION_ARRIVE_MS = 480;

export default function PublicationsIndexDisplay({
  hoveredId,
  onHoverObject,
  selectedId,
  onSelectObject,
  onFocusComplete,
  onActiveScreenPos,
  narrow,
}: {
  /** Externally hovered id (e.g. from the text index), or null. Read every
   *  frame via a ref so this component never re-renders on hover changes. */
  hoveredId: string | null;
  /** Reported up when the raycaster itself finds (or loses) a hovered
   *  object, so the text index can highlight in return. */
  onHoverObject: (id: string | null) => void;
  selectedId: string | null;
  onSelectObject: (id: string) => void;
  /** Fired once, when the click-focus transition for `selectedId` finishes
   *  easing in — the navigation/transition hook this pass builds, ready to
   *  be wired to a real destination once each publication has one. */
  onFocusComplete: (id: string) => void;
  /** Screen-space position of the currently active (hovered ?? selected)
   *  object's anchor point, for the metadata label — null when nothing is
   *  active. Only called when the position actually moves or the id
   *  changes, never every frame. */
  onActiveScreenPos: (pos: { x: number; y: number } | null) => void;
  narrow: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hoveredIdRef = useRef(hoveredId);
  const selectedIdRef = useRef(selectedId);
  const narrowRef = useRef(narrow);
  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    narrowRef.current = narrow;
  }, [narrow]);

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
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      // Near/far bounded tightly around where this composition actually
      // sits (camera at CAM_Z~12.5, objects within roughly 8-14 units of
      // it, even lifted) rather than the card's 0.1-60: at the card's much
      // wider ratio the depth buffer starves of precision way out here,
      // and two near-coincident surfaces a few hundredths of a unit apart
      // — a book's front cover and its own page block, for instance — lose
      // the depth test to whichever one the GPU rounds to be "closer",
      // regardless of which one actually is. This is a genuine z-fighting
      // bug, not a viewing-angle one: it reproduced even dead centre and
      // perfectly square to the camera.
      const camera = new THREE.PerspectiveCamera(FOV, 1, 8, 18);
      camera.position.set(0, CAM_Y, CAM_Z);
      camera.lookAt(0, 0, 0);

      // Same lit-display-case rig as the card: warm key from above/front,
      // cool fill opposite, low warm bounce standing in for a surface
      // throwing light back up.
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
        pub: IndexPublication;
        holder: import("three").Object3D;
        meshes: import("three").Mesh[];
      };
      const loaded: Loaded[] = [];
      const clonedMaterials: import("three").Material[] = [];
      const sharedTextures = new Set<import("three").Texture>();
      let compositionReadyAt: number | null = null;

      const cardSpecById = new Map(CARD_PUBLICATIONS.map((p) => [p.id, p]));

      Promise.all(
        INDEX_PUBLICATIONS.map((pub) => {
          const cardSpec = cardSpecById.get(pub.id);
          if (!cardSpec) return Promise.resolve(null);
          return loadRoot(cardSpec).then((root) => ({ pub, root }));
        })
      ).then((results) => {
        if (disposed) return;
        for (const r of results) {
          if (!r) continue;
          const { pub, root } = r;
          const instance = root.clone(true);
          const meshes: import("three").Mesh[] = [];
          instance.traverse((o) => {
            const mesh = o as import("three").Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as import("three").MeshStandardMaterial;
            if (mat?.map) sharedTextures.add(mat.map);
            // Cloned so this page's own opacity/dim mutations never touch
            // the cached root's shared material (see file banner).
            const own = mat.clone();
            mesh.material = own;
            clonedMaterials.push(own);
            meshes.push(mesh);
          });
          const holder = new THREE.Group();
          holder.add(instance);
          holder.userData.pubId = pub.id;
          const p = narrowRef.current ? pub.narrow : pub.wide;
          holder.scale.setScalar(p.scale);
          holder.position.set(...p.pos);
          holder.rotation.set(...p.rot);
          group.add(holder);
          loaded.push({ pub, holder, meshes });
        }
        compositionReadyAt = performance.now();
      });

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
      const ndc = new THREE.Vector2(-2, -2); // off-screen until first move
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
          if (o.userData?.pubId) return o.userData.pubId as string;
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

      // A read-only handle for the verification harness.
      (host as HTMLElement & { __pubIndex?: unknown }).__pubIndex = {
        camera,
        scene,
        group,
        loaded,
        three: THREE,
        renderer,
      };

      let last = performance.now();
      let rayHoverId: string | null = null;
      let lastScreenX = -1e9,
        lastScreenY = -1e9;
      const hoverAmount = new Map<string, number>(); // per-id eased 0..1
      let focusFiredFor: string | null = null;

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const now = performance.now();
        const dt = Math.min(250, Math.max(1, now - last));
        last = now;

        // Raycast (mouse only — touch selects by tap, not hover) and report
        // changes up so the text index can highlight in return.
        if (!coarse && pointerInside && loaded.length) {
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(
            loaded.map((l) => l.holder),
            true
          );
          let id: string | null = null;
          if (hits.length) {
            for (let o: import("three").Object3D | null = hits[0].object; o; o = o.parent) {
              if (o.userData?.pubId) {
                id = o.userData.pubId as string;
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
          compositionReadyAt == null ? 0 : Math.min(1, (now - compositionReadyAt) / COMPOSITION_ARRIVE_MS);
        const arrive = arriveT * arriveT * (3 - 2 * arriveT);

        for (const { pub, holder, meshes } of loaded) {
          const isActive = pub.id === activeId;
          const wanted = isActive ? 1 : 0;
          const prev = hoverAmount.get(pub.id) ?? 0;
          const tau = wanted > prev ? HOVER_IN_TAU : HOVER_OUT_TAU;
          let h = prev + (wanted - prev) * (1 - Math.exp(-dt / tau));
          if (Math.abs(wanted - h) < 0.004) h = wanted;
          hoverAmount.set(pub.id, h);
          const hEase = h * h * (3 - 2 * h);

          const anyActive = activeId != null;
          const receding = anyActive && !isActive ? 1 : 0;
          // Recede eases at the same rate as hover (reuse `h`-style follower
          // via a second map key) — simple exponential toward target is
          // plenty for a subtle dim/push, no separate easing curve needed.
          const recedeKey = `${pub.id}:r`;
          const prevR = hoverAmount.get(recedeKey) ?? 0;
          let r = prevR + (receding - prevR) * (1 - Math.exp(-dt / 220));
          if (Math.abs(receding - r) < 0.004) r = receding;
          hoverAmount.set(recedeKey, r);

          let f = 0;
          if (selected === pub.id) {
            const focusKey = `${pub.id}:f`;
            const prevF = hoverAmount.get(focusKey) ?? 0;
            f = prevF + (1 - prevF) * (1 - Math.exp(-dt / (FOCUS_MS * 0.6)));
            if (1 - f < 0.004) f = 1;
            hoverAmount.set(focusKey, f);
            if (f >= 1 && focusFiredFor !== pub.id) {
              focusFiredFor = pub.id;
              onFocusComplete(pub.id);
            }
          } else {
            // Selection moved elsewhere (or cleared) — re-arm so choosing
            // this same publication again fires a fresh completion.
            hoverAmount.delete(`${pub.id}:f`);
            if (focusFiredFor === pub.id) focusFiredFor = null;
          }

          const p = narrowRef.current ? pub.narrow : pub.wide;
          const receOpacityFloor = selected ? RECEDE_OPACITY_SELECT : RECEDE_OPACITY_HOVER;

          holder.position.set(
            p.pos[0],
            p.pos[1] + HOVER_LIFT_Y * pub.emphasis * hEase + (1 - arrive) * 0.3,
            p.pos[2] +
              HOVER_LIFT_Z * pub.emphasis * hEase +
              FOCUS_EXTRA_Z * f -
              RECEDE_Z * r
          );
          holder.rotation.set(
            p.rot[0] + HOVER_TURN_X * pub.emphasis * hEase,
            p.rot[1] + HOVER_TURN_Y * pub.emphasis * hEase,
            p.rot[2]
          );
          holder.scale.setScalar(p.scale * (1 + (FOCUS_SCALE - 1) * f));

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

        // Report the active object's screen position for the metadata
        // label, only when it actually changed.
        if (activeId) {
          const found = loaded.find((l) => l.pub.id === activeId);
          if (found) {
            // The object's actual TOP edge, not its centre — the centre
            // anchor put the label over the middle of the cover once a
            // hovered/focused object grew a good deal larger than its
            // resting size. A fresh world-space box is cheap here since
            // this branch only ever runs for the one active object.
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

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        host.removeEventListener("click", onClick as EventListener);
        // Geometry is shared with the cache root — never disposed here.
        for (const t of sharedTextures) t.dispose();
        for (const m of clonedMaterials) m.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch((err) => {
      console.error("PublicationsIndexDisplay:", err);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [onHoverObject, onSelectObject, onFocusComplete, onActiveScreenPos]);

  return <div ref={hostRef} data-publications-index style={{ width: "100%", height: "100%" }} />;
}
