"use client";

// The bulb, rendered from the supplied GLB.
//
// three.js only — no react-three-fiber. The scene is a camera, the loaded
// model, and two lights; there is no scene graph to reconcile, so a
// renderer wrapper would be a second dependency for nothing.
//
// Everything is created on mount and disposed on unmount, and the loop
// only runs while the element is on screen — a WebGL context spinning
// behind a section the reader has scrolled past is pure battery cost.
//
// `litness` (0..1) drives the emissive strength and the light intensity,
// so the bulb dimming as the arc of work appears, and lighting again when
// it leaves, is one number the caller owns.

import { useEffect, useRef } from "react";

const MODEL_URL = "/model/bulb.glb";

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

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 4.2);

      const key = new THREE.PointLight(0xfff2d8, 6, 20);
      key.position.set(0, 0.2, 0.4);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0x8899bb, 0.35));

      const emissives: import("three").MeshStandardMaterial[] = [];
      let root: import("three").Object3D | null = null;

      new GLTFLoader().load(MODEL_URL, (gltf) => {
        if (disposed) return;
        root = gltf.scene;
        // Frame the model regardless of the units it was exported in.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const scale = 2.4 / Math.max(size.x, size.y, size.z || 1);
        root.scale.setScalar(scale);
        root.position.sub(centre.multiplyScalar(scale));
        root.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as import("three").MeshStandardMaterial;
          if (mat && "emissive" in mat) {
            mat.emissive = new THREE.Color(0xffd9a0);
            emissives.push(mat);
          }
        });
        scene.add(root);
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
        key.intensity = 1.2 + lit * 9;
        for (const m of emissives) m.emissiveIntensity = 0.15 + lit * 2.2;
        if (root && !reduced) root.rotation.y += 0.0016;
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
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
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
