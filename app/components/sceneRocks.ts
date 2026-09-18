"use client";

// THE MINERAL PROPS.
//
// Both Publications scenes — the card's compact still life and the index
// page's wide floor display — stage the publications against dark angular
// stones, the way the references do: something with real weight in the
// foreground for the printed pieces to read against. They are environmental
// props, never focal points, so they share one very dark, fully rough
// material and one shape generator rather than each engine growing its own.
//
// The shape is a bare icosahedron with its vertices pushed in and out by a
// deterministic hash of their own index — the same seed always produces the
// same stone, so a scene composed against one does not shift between loads.

import type * as THREEModule from "three";

export type RockPlacement = {
  radius: number;
  pos: [number, number, number];
  rot: [number, number, number];
  /** Per-axis stretch, so one generator yields both a broken boulder and a
   *  low flat slab. Defaults to uniform. */
  scale?: [number, number, number];
  /** Seeds the vertex jitter — two stones with different seeds are
   *  different stones, the same seed is the same stone every load. */
  seed: number;
};

/**
 * Adds one stone per placement to `parent`, sharing a single material
 * across all of them, and returns that material so the caller can dispose
 * it (the geometries are per-stone and disposed by the caller's own scene
 * walk).
 */
export function addRocks(
  THREE: typeof THREEModule,
  parent: import("three").Object3D,
  placements: RockPlacement[]
): import("three").MeshStandardMaterial {
  // Dark, but not so dark the facets stop catching the key: at near-black
  // with no specular at all a stone reads as a hole cut in the floor rather
  // than as a solid sitting on it.
  // These stones stand in the shadow of the publications they support, so
  // almost all the light reaching them is fill and bounce. Their albedo has
  // to sit well above the value they are meant to READ at, or they resolve
  // to flat black silhouettes with no facets in them at all.
  const material = new THREE.MeshStandardMaterial({
    color: 0x5e574f,
    roughness: 0.82,
    metalness: 0.06,
  });
  for (const { radius, pos, rot, scale, seed } of placements) {
    // One subdivision, not a bare icosahedron: twenty flat faces read as a
    // low-poly prop, eighty jittered ones read as broken stone.
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const attr = geo.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i);
      const n = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
      // Enough to break the sphere, not so much that the subdivided faces
      // spike apart and read as shattered crystal rather than stone.
      v.multiplyScalar(1 + (n - Math.floor(n) - 0.5) * 0.22);
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    attr.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  return material;
}

/**
 * A dark, faintly glossy ground plane whose own alpha falls off radially.
 *
 * A plain opaque plane is only usable where the camera looks far enough
 * DOWN that the plane's far edge leaves the frame. Both of these scenes sit
 * close to level with the group, so an opaque plane draws its far edge as a
 * hard horizon straight across the composition. Fading the plane's alpha
 * out around the group instead gives the contact and the sheen of a real
 * surface with no edge to see — the surface simply stops being lit, the way
 * a table in a dark room does.
 */
export function makeFadedFloor(
  THREE: typeof THREEModule,
  {
    size,
    y,
    color,
    /** Fraction of the plane's radius that stays fully opaque before the
     *  falloff starts — i.e. how much floor the composition gets to stand
     *  on. The fade has to begin outside the group, or the ground drops
     *  away under the pieces at the ends of it. */
    core,
    roughness,
    metalness,
  }: {
    size: number;
    y: number;
    color: number;
    core: number;
    roughness: number;
    metalness: number;
  }
): import("three").Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Weighted hard toward the centre: perspective crushes the far half of
  // the plane into a thin band near the horizon, so a linear falloff in
  // plane-space still reads as an edge on screen.
  const at = (t: number) => core + (1 - core) * t;
  g.addColorStop(0, "#ffffff");
  g.addColorStop(core, "#ffffff");
  g.addColorStop(at(0.35), "#7a7a7a");
  g.addColorStop(at(0.7), "#101010");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const alphaMap = new THREE.CanvasTexture(canvas);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      alphaMap,
      transparent: true,
      // Left out of the depth buffer so the stones and the publications
      // standing ON it are never sorted behind their own ground.
      depthWrite: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.receiveShadow = true;
  return floor;
}
