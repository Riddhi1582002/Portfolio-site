"use client";

// The bulb, rendered from the supplied GLB.
//
// three.js only — no react-three-fiber. The scene is a camera, the loaded
// model, and the lighting rig; there is no scene graph to reconcile, so a
// renderer wrapper would be a second dependency for nothing.
//
// Everything is created on mount and disposed on unmount, and the loop
// only runs while the element is on screen — a WebGL context spinning
// behind a section the reader has scrolled past is pure battery cost.
//
// `litness` (0..1) drives the emissive strength and the light intensity,
// so the bulb dimming as the arc of work appears, and lighting again when
// it leaves, is one number the caller owns.
//
// ORIENTATION: the model is hung UPSIDE DOWN. Its former lower edge — the
// glass tip — is now the top and is what the white line comes down to
// meet. The flip lives on the model itself and the idle spin lives on a
// parent pivot, so the spin stays about the vertical however the model is
// turned.
//
// REALISM. The GLB carries real materials — a transmissive Glass and Bulb
// Glass at ior 1.45, a metal Filament, an LED, brass Base Metal — so the
// job here is to light them like glass rather than to paint a glow on
// top:
//   * filmic tone mapping, so the hot filament rolls off instead of
//     clipping to a flat white blob;
//   * an image-based environment, so the glass and the brass have
//     something to reflect — without one, a transmissive material has no
//     specular detail at all and reads as grey plastic;
//   * the point light sits at the filament's OWN measured centre inside
//     the glass, so the falloff through the envelope is real;
//   * only the filament and LED are emissive. Making the glass emissive
//     is what used to flatten it into a pale shape.

import { useEffect, useRef } from "react";

const MODEL_URL = "/model/bulb.glb";

/** A soft round additive flare, drawn once into a canvas texture. */
function flareTexture(THREE: typeof import("three")) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // A real flare is a small very bright core with a long, fast-falling
  // skirt. Even stops give you a fuzzy ball instead.
  g.addColorStop(0.0, "rgba(255,247,230,1)");
  g.addColorStop(0.06, "rgba(255,232,190,0.85)");
  g.addColorStop(0.16, "rgba(255,206,140,0.42)");
  g.addColorStop(0.36, "rgba(255,186,110,0.14)");
  g.addColorStop(0.62, "rgba(255,170,96,0.04)");
  g.addColorStop(1.0, "rgba(255,160,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A small painted equirectangular "room" for the glass and the brass to
 * reflect: a dark surround, a broad soft key above and to one side, and a
 * cooler fill opposite. Reflections are what make a transmissive material
 * read as glass, and they only need to be plausible, not detailed.
 */
function studioEnvironment(THREE: typeof import("three")) {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#20242c");
  base.addColorStop(0.45, "#0e1014");
  base.addColorStop(1, "#050608");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const lamp = (cx: number, cy: number, rx: number, ry: number, colour: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, colour);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / Math.max(rx, ry));
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  // Key, high and to the left; fill, lower and to the right; a faint
  // bounce underneath so the base is not a silhouette.
  lamp(w * 0.28, h * 0.2, 150, 90, "rgba(255,252,244,0.62)");
  lamp(w * 0.74, h * 0.34, 130, 80, "rgba(186,208,244,0.34)");
  lamp(w * 0.5, h * 0.86, 200, 70, "rgba(120,132,150,0.14)");

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export default function BulbModel({
  litness,
  reduced = false,
}: {
  litness: number;
  reduced?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The render loop reads the latest litness without the component having
  // to re-run for every scroll frame. Written in an effect, not during
  // render, so React never sees a ref mutated while rendering.
  const litRef = useRef(litness);
  useEffect(() => {
    litRef.current = litness;
  }, [litness]);

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
      // 1.5 rather than 2. The bulb is a soft object with no fine detail
      // to lose, and the transmissive glass makes every pixel expensive
      // twice over — see the resolution scale below.
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      // Transmission costs a SECOND render of the scene into a target
      // that the glass then samples. At full resolution that doubles the
      // frame, on the frame the rest of the page is already busiest.
      // Half resolution is invisible through a refracting envelope.
      const withTransmissionScale = renderer as typeof renderer & {
        transmissionResolutionScale?: number;
      };
      if ("transmissionResolutionScale" in withTransmissionScale) {
        withTransmissionScale.transmissionResolutionScale = 0.5;
      }
      // Filmic response. A tungsten filament is several stops brighter
      // than anything else in frame; with linear output it clips to a flat
      // white patch and the glass around it goes with it.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 4.2);

      // Something for the glass and the brass to reflect. Without an
      // environment a transmissive material has no specular at all and
      // the bulb reads as grey plastic.
      //
      // The map is generated here rather than imported from three's
      // RoomEnvironment: pulling in a third jsm module wedged webpack's
      // chunk loading for the GLTFLoader import above — it simply never
      // resolved, and the bulb never appeared at all. A painted equirect
      // is fewer bytes and is exactly the studio we want anyway.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = studioEnvironment(THREE);
      const envRT = pmrem.fromEquirectangular(envTex);
      envTex.dispose();
      scene.environment = envRT.texture;

      // The filament: a small bright source that will be moved to the
      // model's own filament once the GLB has loaded, so the light comes
      // from inside the glass and falls off through it.
      const filament = new THREE.PointLight(0xffb45a, 8, 9, 2);
      filament.position.set(0, 0, 0);
      scene.add(filament);

      // The visible flare around the hot spot. Additive, so it adds light
      // to the glass rather than covering it.
      const flare = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flareTexture(THREE),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          transparent: true,
          opacity: 0,
        })
      );
      flare.renderOrder = 10;
      scene.add(flare);

      // Just enough ambient that an unlit bulb is a shape rather than a
      // hole in the frame, and a cool rim so the glass keeps an edge.
      const ambient = new THREE.AmbientLight(0x8fa2c4, 0.09);
      scene.add(ambient);
      const rim = new THREE.DirectionalLight(0xcfe0ff, 0.34);
      rim.position.set(-2.2, 1.4, -1.6);
      scene.add(rim);

      // Only the hot parts are emissive.
      const emitters: import("three").MeshStandardMaterial[] = [];
      // Every material, with the reflection strength it was given, so the
      // whole rig can be dimmed together: when the filament is out there
      // is no light in this room to reflect either, and a bulb whose
      // glass keeps its studio highlights while its filament is dark
      // reads as a white plastic ornament rather than as glass.
      const surfaces: { mat: import("three").MeshPhysicalMaterial; env: number }[] = [];
      // The pivot carries the idle spin; the model itself carries the flip.
      const pivot = new THREE.Group();
      scene.add(pivot);
      let loaded = false;

      new GLTFLoader().load(MODEL_URL, (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        // Frame the model regardless of the units it was exported in.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const scale = 2.4 / Math.max(size.x, size.y, size.z || 1);
        root.scale.setScalar(scale);
        root.position.sub(centre.multiplyScalar(scale));
        // The flip goes on a PARENT, not on `root`. An object's own
        // rotation is applied before its position, so turning `root` over
        // would swing the centring offset above with it and throw the
        // model out of frame by twice that offset — which is exactly what
        // it did: the bulb ended up hanging off the bottom of its box.
        const flip = new THREE.Group();
        flip.add(root);
        flip.rotation.z = Math.PI;

        root.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const raw of mats) {
            const mat = raw as import("three").MeshPhysicalMaterial;
            if (!mat) continue;
            const name = mat.name || "";
            mat.envMapIntensity = 0.7;
            if (/glass/i.test(name)) {
              // Real glass: thin, smooth, and it must NOT glow. An
              // emissive envelope is exactly what made this read as a
              // painted white shape rather than as glass with a source
              // behind it.
              // Drawn as a transparent surface OVER the filament rather
              // than only through three's transmission pass: that pass
              // resolves the interior into a soft frosted wash, and the
              // whole point of this model is that you can see the coil
              // inside it. depthWrite off so the envelope never occludes
              // what is behind the glass.
              mat.transparent = true;
              mat.depthWrite = false;
              // The glTF gives the envelope a white base colour and full
              // opacity — fine for a transmission pass, but drawn as a
              // transparent surface that is a solid white shell, which is
              // what the unlit bulb looked like. Glass this thin barely
              // shows except at grazing angles and on its highlights.
              mat.opacity = 0.3;
              mat.roughness = 0.03;
              mat.metalness = 0;
              if ("thickness" in mat) mat.thickness = 0.35;
              if ("ior" in mat) mat.ior = 1.45;
              mat.envMapIntensity = 0.4;
            } else if (/filament|led/i.test(name)) {
              mat.emissive = new THREE.Color(/led/i.test(name) ? 0xfff0d2 : 0xffa73f);
              mat.emissiveIntensity = 0;
              mat.toneMapped = true;
              emitters.push(mat as unknown as import("three").MeshStandardMaterial);
            } else if (/metal/i.test(name)) {
              mat.roughness = Math.min(mat.roughness ?? 0.4, 0.34);
              mat.envMapIntensity = 1.1;
            }
            surfaces.push({ mat, env: mat.envMapIntensity });
          }
        });

        // Hang it upside down. Three levels on purpose: `root` is
        // centred, `flip` turns it over about that centre, and `pivot`
        // spins about the vertical whichever way up the model is.
        pivot.add(flip);

        // Put the light where the model's own filament actually is, in
        // world space, so the falloff through the glass is real. Measured
        // AFTER the flip, hence the update.
        pivot.updateMatrixWorld(true);
        const hot = new THREE.Box3();
        let found = false;
        root.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (!mats.some((m) => /filament|led/i.test((m as { name?: string })?.name || "")))
            return;
          hot.union(new THREE.Box3().setFromObject(mesh));
          found = true;
        });
        const hotCentre = found ? hot.getCenter(new THREE.Vector3()) : new THREE.Vector3();
        filament.position.copy(hotCentre);
        flare.position.copy(hotCentre);
        loaded = true;
      });

      const resize = () => {
        const r = host.getBoundingClientRect();
        const w = Math.max(1, r.width);
        const h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      // Only render while on screen.
      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { rootMargin: "10%" }
      );
      io.observe(host);

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const lit = Math.min(1, Math.max(0, litRef.current));
        // Both floors are near zero: an unlit bulb has to READ unlit. An
        // emissive floor keeps the glass glowing however far litness
        // drops, which made the dim state look merely a little warmer
        // rather than switched off.
        //
        // Inverse-square falloff means the intensity has to climb hard for
        // the glass to read as lit from inside. The curve is deliberately
        // non-linear: a real filament's output rises far faster than its
        // apparent brightness, so the last of the fade is the part that
        // reads as "coming up".
        // A dimming curve with a real OFF at the bottom of it.
        //
        // The caller drops `litness` to about 0.14 while the arc of work
        // is on screen — the bulb is meant to have handed its light over.
        // A point source inside the glass is only a few tenths of a unit
        // from it, so with inverse-square falloff even a tenth of the full
        // intensity lit the envelope to near white and the "off" bulb
        // read as a milky plastic ornament. Anything below the knee is
        // genuinely off; above it the response is squared, because a
        // filament's output climbs far faster than its apparent
        // brightness.
        const on = Math.min(1, Math.max(0, (lit - 0.16) / 0.74));
        const glow = on * on;
        filament.intensity = glow * 25;
        (flare.material as import("three").SpriteMaterial).opacity = glow * 0.8;
        flare.scale.setScalar(0.45 + on * 0.95);
        for (const m of emitters) m.emissiveIntensity = glow * 4.2;
        // The room dims with the filament, reflections included.
        const room = 0.22 + on * 0.86;
        ambient.intensity = 0.09 * room;
        rim.intensity = 0.34 * room;
        for (const s of surfaces) s.mat.envMapIntensity = s.env * room;
        if (loaded && !reduced) pivot.rotation.y += 0.0016;
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
        envRT.texture.dispose();
        pmrem.dispose();
        (flare.material as import("three").SpriteMaterial).map?.dispose();
        (flare.material as import("three").SpriteMaterial).dispose();
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
      // A WebGL context can fail to come up (blocked, lost, software
      // rasteriser refused) and the model is decoration, not content —
      // but a silent failure here reads on screen as "the bulb is gone",
      // so it is at least reported.
      console.error("BulbModel:", err);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
