"use client";

// THE MOTH.
//
// One creature, one lifetime. It is loaded once, it flies continuously,
// and nothing in this file ever resets its position, its velocity, its
// rotation, its behavioural state or its wing phase — not at a section
// boundary, not during a transition, not on the way home from the gallery.
// Every "arrival" the reader sees is the camera arriving, not the moth
// being placed.
//
// WHERE IT LIVES. The site's beats are DOM, and their camera moves are
// transforms on that DOM (see mothStage.ts). This layer is a single
// three.js canvas over the pane whose own camera sits still at the origin
// looking down -Z, with the world scaled so that one world unit is one
// CSS pixel on the content plane. The DOM's camera moves are converted
// into a camera TRANSLATION and applied to the moth's position in the
// opposite direction — which is the same thing as the camera moving past
// a creature that is standing still in the world. That is what makes the
// A push and the gallery's flight home real fly-bys: the moth is simply
// in the way, and the camera goes past it.
//
// WHAT IT READS. Nothing is duplicated for it. The bulb, ART, the cards
// and the narration are found as the elements the existing beats already
// render — by the data attributes they already carry — and their current
// on-screen box and their current brightness are what pull on the moth
// and what light it. There is no second bulb, no second ART, no extra
// visible light anywhere in the document.
//
// WHAT IT COSTS. One renderer, one scene, one rAF loop, three meshes, four
// lights that fall on nothing but the moth. The vectors are allocated once
// at the top of the loop's closure and reused; the DOM is measured on a
// throttle rather than per frame; there is no raycasting and no physics
// engine. Collisions are a point-in-rectangle test against boxes that have
// already been measured for the attraction pass.

import { useEffect, useRef } from "react";
import {
  cutMothContinuity,
  mothDebug,
  mothStage,
  type MothPhase,
} from "./mothStage";

const MODEL_URL = "/model/moth-final.glb";

// ── TUNING ──────────────────────────────────────────────────────────────
// Everything the creature is, in one block.

/** Visual wingspan: ~4vw, held between 40 and 80px. */
export const MOTH_SIZE = { VW: 4, MIN_PX: 40, MAX_PX: 80 };
/**
 * How much bigger than MOTH_SIZE the moth is ever allowed to LOOK. The
 * camera comes within a few dozen pixels of it twice in the sequence, and
 * true perspective there would fill the frame with a wing. The two
 * intentional passes are allowed the top of this range — that is the brief
 * detailed view — and nothing else ever gets near it.
 */
const MOTH_CLOSE_PASS_MAX = 3.2;
// HOW THE CREATURE ANSWERS THE LIGHT IT IS GIVEN.
//
// The asset is a photographic scan of a real moth: dark brown scales with
// pale streaks, authored to be read in daylight. Dropped into a room that
// is almost entirely black and lit by one warm source, its midtones sat
// on the floor and the whole animal read as a hole in the page — not dim,
// exactly, but flat, and a flat shape is not a moth.
//
// These two are the fix, and neither of them adds a photon: the albedo is
// lifted so the scan's own tonal range lands where the eye can use it, and
// the roughness is capped so the surface actually catches a highlight off
// the sources already in the scene. The texture's structure — every scale,
// vein and streak — is preserved in proportion, the shadow side still
// falls away to nothing, and the directional response near the bulb is the
// same physics it always was, simply read against a body that has tone in
// it. Filmic tone mapping rolls the pale streaks off rather than clipping
// them, which is what lets the gain go this far without going chalky.
const MOTH_ALBEDO_GAIN = 1.72;
const MOTH_ROUGHNESS_CAP = 0.74;

// Beats/sec at an ordinary cruise. Was 9.4, which is closer to what a real
// moth does and read on screen as a frantic blur — at this size the eye
// resolves the stroke rather than the creature, and the whole point of it
// is to be calm. Slow enough to read as a wingbeat, fast enough to never
// look like it is gliding.
const WING_FLAP_SPEED = 4.2;
const WING_FLAP_AMPLITUDE = 0.95; // radians at the hinge, full stroke
const WING_FLAP_VARIATION = 0.24; // how much amplitude/rate wander
const WING_ASYMMETRY = 0.07; // the two wings are never quite the same

const WANDER_SPEED = 172; // px/sec on the content plane
const WANDER_VARIATION = 0.62; // how irregular that speed is
// How fast the drifting heading itself turns. Halved from 0.42: at that
// rate the creature changed its mind every three seconds or so and never
// got far from wherever it started, which read as fussing about one corner
// of the frame. The same speed over a heading held twice as long is a
// crossing rather than a circuit — no faster, just further.
const WANDER_TURN = 0.22;
// HABITUATION. The longer it has been working one particular surface, the
// less that surface pulls; the pull comes back while it is away. This is
// not a change to the hierarchy — the bulb still outranks ART, ART the
// cards, the cards the narration, and every base strength below is
// untouched — it is what stops the strongest source in the room from being
// a permanent tether, and it is the single reason the flight now covers
// the scene instead of orbiting the nearest card.
const DWELL_BEFORE_ROAM = 4.5; // seconds near one surface before it palls
const ROAM_RELIEF = 0.82; // how much of that surface's pull it can take

const ATTRACTION_RADIUS = 660; // px, at full brightness; dimmer reaches less
const BULB_ATTRACTION_STRENGTH = 1.0;
const ART_ATTRACTION_STRENGTH = 0.74;
const CARD_ATTRACTION_STRENGTH = 0.34;
const NARRATION_ATTRACTION_STRENGTH = 0.13;

const HOVER_RADIUS = 118; // clearance held outside a source's own radius
const ORBIT_VARIATION = 0.62; // sideways share of the approach — no orbits
// HOW OFTEN IT COMMITS.
//
// A moth does not hold a polite distance from a light for ever. It circles,
// and every so often it stops circling and goes in — which is the whole
// reason the bulb has to be treated as hot and a card has to be bumpable
// at all. Without this the hold radius below is a perfect no-fly sphere and
// the creature can NEVER touch anything, which measured out at exactly
// zero contacts over five minutes at the bulb.
//
// It is a threshold on the same wandering drift the rest of the flight is
// made of, so the moments it commits in are irregular and unrepeatable
// rather than timed. At 0.78 of a signal whose amplitude is 1 it happens
// for a few seconds at a time, a few times a minute.
const COMMIT_THRESHOLD = 0.78;
/** How far inside a source's own radius a committed approach aims. */
const COMMIT_HOLD = 0.5;

const CARD_COLLISION_RADIUS = 30; // px of depth either side of a card's face
const BULB_COLLISION_RADIUS = 0.27; // share of the bulb's box: its glass
// How long a perch on NARRATION lasts. A line is a place to rest for a
// moment, not to settle on: the spec for the cards is different and is
// handled where the take-off is decided — a moth on a card stays with the
// card for as long as the card is in the composition.
const PERCH_DURATION = 3.6;
// The longest a perch on a CARD lasts. The rule for a card is "stay with
// it while it is in the composition", and while the reader is scrolling
// that is a handful of seconds — the cards come and go. A reader who
// STOPS, though, leaves that card on screen indefinitely, and a creature
// that never moves again is not the "remains subtly alive" the rest of
// this file is built around. So the stay is bounded: long enough that it
// reads as settling on the work, short enough that a stopped reader sees
// it leave and fly again.
const CARD_PERCH_MAX = 12;
const BULB_RECOVERY_DURATION = 1.7;

// Supporting constants for the above.
const MAX_SPEED = 430;
const STEER_RESPONSE = 2.1; // how fast desired velocity is actually taken up
const DRAG = 0.55;
const BANK_GAIN = 0.0042;
const BANK_MAX = 0.85;
const NOMINAL_DEPTH = 0.82; // share of the camera's distance to the content
// The band it ordinarily flies in, as a share of the camera's distance to
// the content plane. Chosen so that plain perspective across the whole
// band already lands inside the 40-80px clamp: it is the flight that keeps
// the moth the right size, and the clamp below is only the guarantee.
const DEPTH_MIN = 0.5;
const DEPTH_MAX = 1.12;
const BUMP_RECOVERY_DURATION = 0.75;
const TAKEOFF_DURATION = 0.7;
// Seconds before it will consider settling again. Raised from 9: with the
// stillness gate in place a settled beat leaves the opportunity open
// indefinitely, and at 9 against a stay of up to CARD_PERCH_MAX the
// creature spent three quarters of its time sitting down. The flight is
// the thing; the rest is punctuation.
const PERCH_COOLDOWN = 22;
const PERCH_CHANCE = 0.55; // per second, while in reach of somewhere to sit
// How long it has to have been in a beat before it will settle in it. A
// creature that lands the moment it arrives reads as placed; one that
// flies the scene first and then finds somewhere to sit reads as having
// chosen. It is a gate on OPPORTUNITY, not a schedule: what actually
// decides a landing is still passing close to a surface with the dice in
// its favour.
const REST_SETTLE_SECONDS = 4;
// WHAT "STILL" MEANS, and how long it has to last.
//
// A rest is not something the creature decides on a timer — it is
// something the SCENE offers. While the reader is scrolling, the camera is
// travelling or the cards are still rearranging themselves, there is
// nowhere steady to put your feet down and the moth simply keeps flying.
// The measure is the composition's own: the average screen-space movement
// of the surfaces the moth can see, taken between scans.
//
// The bar has to sit between the site's idle micro-motion and its real
// motion, and measurement put those further apart than they look: page
// one's breathing wordmark reads 4-31px/s (the scale breath moves a
// full-width box's corners, so it is larger than the drift alone), while
// a reader actually scrolling reads a median of 418px/s. At this value a
// breathing hero counts as still, which to a reader it plainly is, and
// anything the reader is actually driving does not.
const COMPOSITION_STILL_PX = 48; // px/sec, averaged over the visible surfaces
const REST_STILL_SECONDS = 3; // how long that has to hold before it may land
const NARRATION_PERCH_LIMIT = 2; // once or twice in the whole experience
const BULB_AVOID_COOLDOWN = 5.5; // it does not touch the hot thing twice
const FOV = 40;
// How close to the lens the creature is still drawn. Past this it is at or
// behind the camera — the far side of a fly-by — and drawing it there is
// not a picture of anything: the geometry straddles the near plane and
// rasterises across the whole frame for nothing. It is not hidden, faded
// or reset; it is simply behind the camera, and it flies back around.
const NEAR_CLIP_PX = 34;
// THE CANVAS IS A TILE, not a layer.
//
// A full-viewport transparent WebGL canvas is re-cleared and re-composited
// over the page every frame whether or not anything in it moved, and that
// alone — with an empty scene in it — was the single most expensive thing
// this feature did: measured on this machine it took the page from 60fps
// to 16 before the moth was even drawn. The creature is never more than a
// couple of hundred pixels across, so the canvas is a small square that
// follows it, and the camera renders exactly the sub-rectangle of its own
// frustum that the square covers (`setViewOffset`). The picture is
// identical; the fill is an order of magnitude smaller.
//
// Sized off MOTH_SIZE so it always has room for the widest the creature is
// allowed to look, plus a margin for the body at full stretch.
const TILE_MARGIN_PX = 72;

// Behaviour states.
const WANDER = 0;
const ATTRACTED = 1;
const HOVER = 2;
const PERCH = 3;
const BUMP_RECOVERY = 4;
const HOT_BULB_RECOVERY = 5;
const TAKEOFF = 6;

// Source kinds, in attraction priority order.
const K_BULB = 0;
const K_ART = 1;
const K_CARD = 2;
const K_NARR = 3;
const SRC_PULL = [
  BULB_ATTRACTION_STRENGTH,
  ART_ATTRACTION_STRENGTH,
  CARD_ATTRACTION_STRENGTH,
  NARRATION_ATTRACTION_STRENGTH,
];
// How much each source LIGHTS the moth, as distinct from how much it pulls
// on it. The bulb is the room's light; ART and the cards are secondary;
// narration is barely a glow on white type.
const SRC_LIGHT = [1.0, 0.42, 0.3, 0.1];
const SRC_COLOUR = [0xffb45a, 0xd6e4ff, 0xe6edff, 0xffffff];
// HOW BRIGHT A SOURCE IS, and how its light thins out with distance.
//
// None of these sources is a point. The bulb is a glass envelope the best
// part of a screen across, ART is a wordmark a thousand pixels wide, a
// card is a lit rectangle. An inverse-square point light standing in for
// one of those is right in the far field and badly wrong in the near
// field, where it goes to infinity: the first version of this blew a wing
// out to flat white the moment the moth came near the letter. So the
// DIRECTION of the light is a real point in space at the source's own
// middle — that is what shapes the creature, and it has to be physical —
// while its MAGNITUDE follows an area source's: a plateau across the
// source's own extent, halving at LIGHT_HALF_DIST beyond it. The intensity
// handed to the light is that irradiance multiplied back up by the moth's
// own distance squared, so three's inverse-square falloff resolves to
// exactly the number intended.
const LIGHT_PEAK = 16; // irradiance against a full-brightness source's face
const LIGHT_HALF_DIST = 210; // px: where it has fallen to half of that

const SELECTORS: [string, number][] = [
  // The bulb, in the cord beat and in the descent past it.
  ['[data-bulb-host],[data-pencil="bulb"]', K_BULB],
  // ART, on page one and behind the gallery.
  ['[data-art],[data-canvas="art"]', K_ART],
  // Every card the site draws, whatever beat it belongs to.
  [
    '[data-arc-card],[data-depth-card],[data-strip-card],[data-pencil="card"],[data-canvas="piece"]',
    K_CARD,
  ],
  // Narration, wherever it speaks.
  ['[data-narration],[data-pencil="narration"]', K_NARR],
];
/** Per-kind cap, so a gallery cell's worth of images cannot flood the pool. */
const SRC_CAP = [2, 3, 14, 4];
const SRC_POOL = 24;
/** How often the composition is re-measured, in seconds. */
const SCAN_INTERVAL = 0.09;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/**
 * Smooth, non-repeating drift. Three incommensurable rates summed: there
 * is no period short enough to read as a loop, and no step anywhere in it
 * — which is what keeps the flight from looking either robotic or jittery.
 */
const drift = (t: number, seed: number) =>
  Math.sin(t * 0.73 + seed) * 0.6 +
  Math.sin(t * 1.31 + seed * 2.13) * 0.29 +
  Math.sin(t * 2.17 + seed * 3.71) * 0.11;

/**
 * One wingbeat, as a function of phase.
 *
 * Not a sine: a moth's downstroke is the fast half and the recovery is the
 * slow one. Warping the argument by a fraction of its own sine is what
 * gives the beat that snap — one expression, no keyframes, and it stays
 * smooth and periodic so the phase can run for ever.
 */
const stroke = (ph: number) => Math.sin(ph + 0.42 * Math.sin(ph));

/** A critically-damped spring's state: where it is, and how fast. */
type Spring = { x: number; v: number };

/**
 * One step of a critically-damped spring, in place.
 *
 * This is the only easing used for the moth's short physical reactions —
 * recoil, landing, take-off, banking, the recovery after a bump. It is an
 * integrator, not a tween: it can be interrupted on any frame and it
 * carries its own velocity through, which is exactly what a scripted tween
 * cannot do. It mutates rather than returning, because it is called three
 * times a frame for the life of the page.
 */
function springStep(s: Spring, target: number, stiffness: number, dt: number) {
  const damping = 2 * Math.sqrt(stiffness);
  s.v += ((target - s.x) * stiffness - s.v * damping) * dt;
  s.x += s.v * dt;
}

export default function MothLayer({ reduced = false }: { reduced?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

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
      // The same filmic response the bulb is rendered with, so a moth lit
      // by that bulb rolls off the same way rather than clipping to white
      // as it comes in close.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Raised from 1.18. The creature is the only thing in this canvas,
      // so the exposure is the creature's alone — it lifts its midtones
      // off the black without touching a light, and ACES keeps the
      // highlights near the bulb where they were.
      renderer.toneMappingExposure = 1.42;
      const canvas = renderer.domElement;
      host.appendChild(canvas);
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.display = "block";
      canvas.style.visibility = "hidden";
      canvas.style.willChange = "transform";

      const scene = new THREE.Scene();
      // The camera does not move and does not turn. Everything the site's
      // own cameras do is applied to the WORLD instead — see the delta
      // handling in the loop — which is what keeps this canvas' geometry
      // and the DOM's geometry describing the same space.
      const camera = new THREE.PerspectiveCamera(FOV, 1, 4, 12000);
      camera.position.set(0, 0, 0);

      let vw = window.innerWidth;
      let vh = window.innerHeight;
      /** Camera-to-content-plane distance, in px. 1 world unit = 1 px there. */
      let D0 = vh / 2 / Math.tan((FOV * Math.PI) / 360);

      // ── THE LIGHT RIG ───────────────────────────────────────────────
      // Four lights, one per kind of source, moved to whichever instance
      // of that kind is nearest and dimmed to what that instance is
      // actually doing on screen. They illuminate the moth and nothing
      // else — there is no other geometry in this scene — so the document
      // gains no second bulb and no second glow.
      const lights = SRC_COLOUR.map((c) => {
        const l = new THREE.PointLight(c, 0, 0, 2);
        l.visible = false;
        scene.add(l);
        return l;
      });
      // Enough that the shadow side is a shape rather than a hole. Any
      // more and the moth stops responding to the bulb at all.
      const ambient = new THREE.AmbientLight(0x8296bb, 0.07);
      scene.add(ambient);

      // Something for the wing membranes and the body's contours to catch
      // a specular on. Painted, tiny, and scaled with how lit the room
      // actually is, so an unlit beat cannot leave the moth shining.
      //
      // It carries three sources now, not one. A single warm key left every
      // surface facing away from it at a flat near-black, which is what made
      // the creature read as a silhouette cut out of the page rather than as
      // an object: a dim cool fill opposite the key separates the shadow
      // side from the background, and a faint bounce underneath catches the
      // undersides of the wings. All of it is REFLECTED — the moth emits
      // nothing, and the whole rig still dims with the room below.
      const envCanvas = document.createElement("canvas");
      envCanvas.width = 256;
      envCanvas.height = 128;
      const ectx = envCanvas.getContext("2d")!;
      const eg = ectx.createLinearGradient(0, 0, 0, 128);
      eg.addColorStop(0, "#20242c");
      eg.addColorStop(0.5, "#0c0e12");
      eg.addColorStop(1, "#050607");
      ectx.fillStyle = eg;
      ectx.fillRect(0, 0, 256, 128);
      ectx.filter = "blur(18px)";
      const lamp = (cx: number, cy: number, r: number, colour: string) => {
        const g = ectx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, colour);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ectx.fillStyle = g;
        ectx.fillRect(0, 0, 256, 128);
      };
      lamp(70, 30, 70, "rgba(255,246,230,0.72)");   // key
      lamp(190, 52, 76, "rgba(150,176,216,0.3)");   // cool fill, opposite
      lamp(128, 120, 90, "rgba(120,132,152,0.16)"); // bounce, underneath
      ectx.filter = "none";
      const envTex = new THREE.CanvasTexture(envCanvas);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromEquirectangular(envTex);
      envTex.dispose();
      scene.environment = envRT.texture;

      // ── THE MOTH ────────────────────────────────────────────────────
      // `moth` carries the creature's position and its attitude; `norm`
      // inside it carries the GLB's own normalisation (centred, scaled to
      // a unit wingspan, turned so its head is along -Z). The asset's own
      // geometry, origins and hinges are untouched.
      const moth = new THREE.Group();
      moth.visible = false;
      scene.add(moth);
      const norm = new THREE.Group();
      moth.add(norm);

      let wingL: import("three").Object3D | null = null;
      let wingR: import("three").Object3D | null = null;
      const wingLBase = new THREE.Quaternion();
      const wingRBase = new THREE.Quaternion();
      const surfaces: {
        mat: import("three").MeshStandardMaterial;
        env: number;
      }[] = [];
      // The body and both wings share one glTF material, and the wing
      // material is built FROM it, so the tonal work below has to happen
      // exactly once however many meshes arrive at it.
      const toned = new Set<import("three").Material>();
      let loaded = false;

      new GLTFLoader().load(MODEL_URL, (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        wingL = root.getObjectByName("Wing_L") ?? null;
        wingR = root.getObjectByName("Wing_R") ?? null;
        if (wingL) wingLBase.copy(wingL.quaternion);
        if (wingR) wingRBase.copy(wingR.quaternion);

        root.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
          const isWing = o === wingL || o === wingR;
          const prepare = (raw: import("three").Material) => {
            const src = raw as import("three").MeshStandardMaterial;
            if (!src) return raw;
            if (!toned.has(src)) {
              toned.add(src);
              // Multiplied, not replaced: whatever base colour the asset
              // carries keeps its hue and its relative values.
              src.color.multiplyScalar(MOTH_ALBEDO_GAIN);
              // A cap on the roughness MAP's multiplier, so the scan's own
              // variation across the wings and the thorax survives — the
              // dull parts stay duller than the sleek ones, all of it just
              // that bit more willing to take a highlight.
              src.roughness = Math.min(src.roughness ?? 1, MOTH_ROUGHNESS_CAP);
            }
            if (!isWing) {
              // The body keeps the material the asset shipped with. Only
              // its reflection strength is taken over, so it can be dimmed
              // with the room.
              src.envMapIntensity = 0.34;
              surfaces.push({ mat: src, env: 0.34 });
              return src;
            }
            // The wings keep the same maps and the same base colour — the
            // texture is the asset's — but get a sheen term, which is how
            // a thin scaled membrane behaves: it scatters a soft, wide
            // highlight along the surface and lights up at its edges when
            // a source is behind or beside it. Without it the wings read
            // as flat card at every angle.
            const wingMat = new THREE.MeshPhysicalMaterial({
              map: src.map,
              normalMap: src.normalMap,
              roughnessMap: src.roughnessMap,
              metalnessMap: src.metalnessMap,
              color: src.color,
              roughness: src.roughness,
              metalness: src.metalness,
              side: THREE.DoubleSide,
              transparent: false,
              // A scaled membrane scatters a wide, soft highlight across
              // its surface and lights up along its edges. Pushed up and
              // tightened from 0.55/0.62: it is what gives the wings their
              // own tone in the dark instead of a flat shape, and it costs
              // nothing but a term in a shader that was already compiled.
              sheen: 0.78,
              sheenRoughness: 0.44,
              sheenColor: new THREE.Color(0xfff0d8),
            });
            if (src.normalScale) wingMat.normalScale.copy(src.normalScale);
            wingMat.envMapIntensity = 0.46;
            surfaces.push({
              mat: wingMat as unknown as import("three").MeshStandardMaterial,
              env: 0.46,
            });
            return wingMat as unknown as import("three").Material;
          };
          // Assigned back in the SHAPE it came in. A single-primitive glTF
          // mesh has no geometry groups, and a mesh whose material is an
          // array without groups to index them draws nothing at all — the
          // moth was in the scene, correctly lit, and invisible.
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(prepare)
            : prepare(mesh.material);
        });

        // Normalise to a unit WINGSPAN — the asset's own X extent — so
        // MOTH_SIZE means the thing it says it means at every viewport.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const span = Math.max(1e-4, size.x);
        root.scale.setScalar(1 / span);
        root.position.set(-centre.x / span, -centre.y / span, -centre.z / span);
        norm.add(root);
        // Which end is the head, settled against the geometry rather than
        // guessed: the body's last slice along +Z is 0.54 wide and 0.04
        // tall with nothing at all near its centre line — two flat prongs
        // spread apart, which is the antennae. The thorax (the thickest
        // slices, and where the wing hinges sit) is just behind it and the
        // abdomen tapers away to -Z. So the asset already faces +Z, which
        // is the axis three's lookAt aims, and the flight code can point
        // the group straight down its own velocity with no turn here.
        // Compile the shaders and upload the textures NOW, while the
        // page is still loading, rather than on the first frame the moth
        // happens to fly into shot. A MeshPhysical shader with a sheen
        // term and three 2048px maps is not free to prepare, and paying
        // for it lazily put a visible hitch wherever the creature first
        // appeared — which, since it flies, was a different place every
        // time. Measured in the software rasteriser this container runs,
        // that hitch was seconds long; on a GPU it is milliseconds. Either
        // way it belongs at load.
        // `compile` walks the VISIBLE scene, so the creature has to be in
        // it for its shaders to be the ones that get built; the loop takes
        // the visibility back on its very next frame.
        moth.visible = true;
        renderer.compile(scene, camera);
        moth.visible = false;
        loaded = true;
      });

      // ── SOURCES ─────────────────────────────────────────────────────
      // Measured from the document on a throttle and held in a pool that
      // is allocated once. Nothing here is created per frame.
      type Src = {
        kind: number;
        x: number;
        y: number;
        z: number;
        r: number;
        lum: number;
        el: Element | null;
        left: number;
        top: number;
        right: number;
        bottom: number;
      };
      const sources: Src[] = Array.from({ length: SRC_POOL }, () => ({
        kind: 0,
        x: 0,
        y: 0,
        z: 0,
        r: 0,
        lum: 0,
        el: null,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }));
      let srcCount = 0;
      let scanClock = SCAN_INTERVAL;
      // Where each surface was at the previous scan, so the composition's
      // own movement can be measured without asking the page for anything
      // it is not already being asked. Parallel arrays, allocated once.
      const prevEl: (Element | null)[] = new Array(SRC_POOL).fill(null);
      const prevLeft = new Float64Array(SRC_POOL);
      const prevTop = new Float64Array(SRC_POOL);
      let prevCount = -1;
      /** The composition's average screen movement, px/sec. */
      let compositionMotion = Infinity;

      /** How bright a source currently is: what the beat itself says. */
      const lumOf = (el: Element) => {
        const tagged = el.getAttribute("data-lum");
        if (tagged != null) {
          const v = parseFloat(tagged);
          return Number.isFinite(v) ? clamp01(v) : 0;
        }
        const inline = (el as HTMLElement).style.opacity;
        if (inline === "") return 1;
        const v = parseFloat(inline);
        return Number.isFinite(v) ? clamp01(v) : 1;
      };

      /** Screen box -> a point and a radius in the moth's own world. */
      const place = (s: Src, rect: DOMRect, kind: number) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        s.kind = kind;
        // One world unit is one pixel on the content plane, so a screen
        // offset from the frame's centre is a world offset one for one.
        s.x = cx - vw / 2;
        s.y = -(cy - vh / 2);
        s.z = -D0;
        const minSide = Math.min(rect.width, rect.height);
        s.r =
          kind === K_BULB
            ? minSide * BULB_COLLISION_RADIUS
            : kind === K_ART
              // ART's ELEMENT is a full-width centred line; its box says
              // nothing about how wide the three letters actually are, and
              // taking the box's short side put the hold radius inside the
              // wordmark — on a phone the creature held station on the T.
              // The line box's height tracks the face size exactly, and
              // this wordmark is about 1.7 of its height wide, so half of
              // that is the letters' own reach from their centre.
              ? rect.height * 0.85
              : kind === K_NARR
                ? rect.height * 0.5
                : minSide * 0.5;
        s.left = rect.left;
        s.top = rect.top;
        s.right = rect.right;
        s.bottom = rect.bottom;
      };

      const scan = (elapsed: number) => {
        srcCount = 0;
        let moved = 0;
        let matched = 0;
        // Only a little beyond the frame. The gallery's composition runs
        // well past the window on every side, and a wider margin than this
        // had the creature chasing an image it could see and the reader
        // could not — it sat hovering just off the left edge for minutes.
        const marginX = vw * 0.12;
        const marginY = vh * 0.12;
        for (const [selector, kind] of SELECTORS) {
          let taken = 0;
          const found = document.querySelectorAll(selector);
          for (let i = 0; i < found.length; i++) {
            if (taken >= SRC_CAP[kind] || srcCount >= SRC_POOL) break;
            const el = found[i];
            const lum = lumOf(el);
            if (lum < 0.04) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) continue;
            if (
              rect.right < -marginX ||
              rect.left > vw + marginX ||
              rect.bottom < -marginY ||
              rect.top > vh + marginY
            )
              continue;
            const at = srcCount++;
            const s = sources[at];
            place(s, rect, kind);
            s.lum = lum;
            s.el = el;
            // Same surface as last time, in the same slot? Then the
            // difference between the two boxes is how far the composition
            // carried it.
            if (prevEl[at] === el) {
              moved +=
                Math.abs(rect.left - prevLeft[at]) + Math.abs(rect.top - prevTop[at]);
              matched++;
            }
            prevEl[at] = el;
            prevLeft[at] = rect.left;
            prevTop[at] = rect.top;
            taken++;
          }
        }
        // A surface arriving or leaving is the composition changing too, so
        // a different count reads as movement rather than as stillness.
        compositionMotion =
          matched > 0 && srcCount === prevCount
            ? moved / matched / Math.max(1e-3, elapsed)
            : Infinity;
        prevCount = srcCount;
      };

      // ── THE CREATURE'S STATE ────────────────────────────────────────
      // Created once, mutated forever. Nothing below ever re-initialises
      // any of it.
      const pos = new THREE.Vector3();
      const vel = new THREE.Vector3();
      const desired = new THREE.Vector3();
      const accel = new THREE.Vector3();
      const tmpA = new THREE.Vector3();
      const tmpB = new THREE.Vector3();
      const tmpC = new THREE.Vector3();
      const lookTarget = new THREE.Vector3();
      const aim = new THREE.Object3D();
      const bankQ = new THREE.Quaternion();
      const flapQ = new THREE.Quaternion();
      const zAxis = new THREE.Vector3(0, 0, 1);

      // THE ENTRY. Off the side of the frame, at a random height, a random
      // depth, heading in at a random angle and a random speed — so no two
      // sessions watch the same moth arrive.
      //
      // It starts JUST outside the frame rather than a screen-width beyond
      // it, and with real speed on: from 0.62-0.82 of a half-viewport out,
      // at a dawdling 130-250px/s, the fly-in took the better part of ten
      // seconds and the reader had usually started scrolling before the
      // creature was ever in shot. It still enters from outside, under its
      // own power, on its own heading — it simply does not have most of a
      // screen to cross first.
      // The side is an even coin toss, as it has to be. What is chosen to
      // match it is the SEED: the wander's opening heading is this seed's
      // own, and it takes over from the entry velocity a moment after the
      // creature appears — so a seed that points back out of frame, or
      // merely along the edge, is redrawn rather than followed. That is
      // what used to leave some arrivals loitering off the side for the
      // better part of ten seconds. If no draw qualifies, the entry
      // velocity carries it in on its own exactly as it did before.
      const fromLeft = Math.random() < 0.5;
      let seed = Math.random() * 40;
      /** How much of this seed's opening heading points INTO the frame. */
      const inward = () =>
        Math.cos(drift(0, seed) * Math.PI) * (fromLeft ? 1 : -1);
      for (let i = 0; i < 24 && inward() < 0.35; i++) seed = Math.random() * 40;
      const entryDepth = D0 * (0.62 + Math.random() * 0.42);
      // Just outside the FRAME, whatever depth it came in at. Stating the
      // start in world units instead meant a shallow entry began most of a
      // second screen-width out and a deep one began almost on the edge:
      // the same number of pixels, wildly different journeys. Scaling by
      // the depth is what makes "off the side of the screen" mean the same
      // thing every time, while the depth itself stays random and so does
      // how large it reads when it first appears.
      const entryScreen = entryDepth / D0;
      const entryMargin = vw * (0.05 + Math.random() * 0.12);
      const entryY = (0.5 - Math.random()) * vh * 0.62;
      pos.set(
        (fromLeft ? -1 : 1) * (vw / 2 + entryMargin) * entryScreen,
        entryY * entryScreen,
        -entryDepth
      );
      const entryAngle = (Math.random() - 0.5) * 0.8;
      vel.set(
        (fromLeft ? 1 : -1) * Math.cos(entryAngle),
        Math.sin(entryAngle) * 0.5,
        (Math.random() - 0.5) * 0.5
      )
        .normalize()
        .multiplyScalar(WANDER_SPEED * (1.15 + Math.random() * 0.6));

      let state = WANDER;
      let stateT = 0;
      let wingPhase = Math.random() * Math.PI * 2;
      const bankS: Spring = { x: 0, v: 0 };
      const perchS: Spring = { x: 0, v: 0 };
      let flutter = 0; // extra, irregular wingbeat after a shock
      let perchEl: Element | null = null;
      let perchIsBrief = false;
      let perchOx = 0.5;
      let perchOy = 0;
      let perchCooldown = 4;
      // How long it has been in the beat that owns the frame. Reset on a
      // cut, never on anything the creature itself does.
      let sceneT = 0;
      // How long the composition AND the camera have both been holding
      // still. Reset by either of them moving; never by anything the
      // creature itself does.
      let stillT = 0;
      let narrationPerches = 0;
      let bulbCooldown = 0;
      let sinceBump = 0;
      // Which surface it has been working, and for how long — see
      // DWELL_BEFORE_ROAM.
      let dwellEl: Element | null = null;
      let dwellT = 0;
      let clock = 0;
      let bumps = 0;
      let bulbHits = 0;
      let perches = 0;
      // Camera continuity. `lastKey` is which shot we were in; `lastScale`
      // and the lateral pair are where its camera was. A change of key is a
      // cut: the camera did not travel, so nothing is applied.
      let lastPhase: MothPhase | "" = "";
      let lastEpoch = -1;
      let lastDist = 0;
      let lastCamX = 0;
      let lastCamY = 0;

      /** The moth's current apparent wingspan target, in px. */
      const sizePx = () =>
        Math.min(MOTH_SIZE.MAX_PX, Math.max(MOTH_SIZE.MIN_PX, (vw * MOTH_SIZE.VW) / 100));

      let tile = 1;
      const resize = () => {
        const r = host.getBoundingClientRect();
        vw = Math.max(1, r.width);
        vh = Math.max(1, r.height);
        D0 = vh / 2 / Math.tan((FOV * Math.PI) / 360);
        // Room for the widest the creature is ever allowed to look — the
        // close-pass ceiling — with the body's own reach either side of it.
        tile = Math.min(
          Math.max(vw, vh),
          Math.round(sizePx() * MOTH_CLOSE_PASS_MAX * 2 + TILE_MARGIN_PX)
        );
        renderer.setSize(tile, tile, false);
        canvas.style.width = `${tile}px`;
        canvas.style.height = `${tile}px`;
        camera.aspect = vw / vh;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      let shown = false;
      let last = performance.now();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
        last = now;
        clock += dt;
        stateT += dt;
        sinceBump += dt;
        perchCooldown = Math.max(0, perchCooldown - dt);
        bulbCooldown = Math.max(0, bulbCooldown - dt);
        flutter = Math.max(0, flutter - dt * 1.6);

        // ── THE CAMERA MOVED, SO THE WORLD MOVED ──────────────────────
        const phase = mothStage.phase;
        const epoch = mothStage.epoch;
        const scale = Math.max(0.01, mothStage.cameraScale);
        const dist = D0 / scale;
        let cameraMoved = false;
        if (phase === lastPhase && epoch === lastEpoch) {
          // One continuous shot: the camera's travel since the last frame
          // is exactly the change in its distance to the content plane,
          // and the moth — which is standing still in the world — comes
          // toward the lens by that much. Clamped, because a beat that
          // hands over mid-move must not fling it across the room.
          const forward = clamp(lastDist - dist, -D0 * 0.4, D0 * 0.4);
          cameraMoved =
            Math.abs(forward) > 0.5 ||
            Math.abs(mothStage.cameraX - lastCamX) > 0.5 ||
            Math.abs(mothStage.cameraY - lastCamY) > 0.5;
          pos.z += forward;
          pos.x -= clamp(mothStage.cameraX - lastCamX, -vw, vw);
          pos.y += clamp(mothStage.cameraY - lastCamY, -vh, vh);
        }
        sceneT = phase === lastPhase && epoch === lastEpoch ? sceneT + dt : 0;
        stillT =
          !cameraMoved && compositionMotion < COMPOSITION_STILL_PX ? stillT + dt : 0;
        lastPhase = phase;
        lastEpoch = epoch;
        lastDist = dist;
        lastCamX = mothStage.cameraX;
        lastCamY = mothStage.cameraY;

        scanClock += dt;
        if (scanClock >= SCAN_INTERVAL) {
          scan(scanClock);
          scanClock = 0;
        }

        if (!loaded) return;

        // ── WHAT IS PULLING ───────────────────────────────────────────
        // Brightness reaches: a bright source is felt from further away
        // than a dim one, and a source that is fading loses its hold
        // smoothly rather than being dropped.
        let bestW = 0;
        let best: Src | null = null;
        accel.set(0, 0, 0);
        // While the A's counter is the thing to be around, it STANDS IN
        // for ART rather than competing with it — the counter is part of
        // the wordmark, and two pulls aimed at different points of the
        // same letter left the creature hovering between them, a couple of
        // hundred pixels outside the negative space it was meant to be in.
        const counterOwnsArt = mothStage.aStaging > 0.25;
        // How tired it is of the surface it has been working. Applied
        // inside the loop, so a source it has had enough of genuinely
        // loses to one it has not, rather than being picked and then
        // discounted.
        const boredom = clamp01(dwellT / DWELL_BEFORE_ROAM) * ROAM_RELIEF;
        for (let i = 0; i < srcCount; i++) {
          const s = sources[i];
          if (s.kind === K_BULB && bulbCooldown > 0) continue;
          if (s.kind === K_ART && counterOwnsArt) continue;
          tmpA.set(s.x - pos.x, s.y - pos.y, s.z - pos.z);
          const d = tmpA.length();
          const reach = ATTRACTION_RADIUS * (0.45 + 0.85 * s.lum) + s.r;
          if (d > reach || d < 1e-3) continue;
          const falloff = 1 - d / reach;
          const w =
            SRC_PULL[s.kind] *
            s.lum *
            falloff *
            falloff *
            (s.el === dwellEl ? 1 - boredom : 1);
          if (w > bestW) {
            bestW = w;
            best = s;
          }
        }

        // Time served on whichever surface it is currently working, and
        // the interest coming back once it has left.
        if (best && best.el === dwellEl) {
          dwellT = Math.min(DWELL_BEFORE_ROAM * 1.6, dwellT + dt);
        } else {
          dwellT = Math.max(0, dwellT - dt * 0.55);
          if (dwellT <= 0 && best) dwellEl = best.el;
        }

        // The A's negative space, before the camera ever gets there. It is
        // ART's own pull, aimed at the counter rather than at the whole
        // wordmark — the moth is drawn there by the same light, and it is
        // simply already in the letter when the push begins.
        let staging: { x: number; y: number; z: number; r: number } | null = null;
        if (mothStage.aStaging > 0.01 && mothStage.aCounterR > 1) {
          staging = {
            x: mothStage.aCounterX - vw / 2,
            y: -(mothStage.aCounterY - vh / 2),
            // In FRONT of the wordmark: the letter is on the content
            // plane, and a creature between the lens and the letter is
            // what the camera can actually fly past.
            z: -D0 * 0.74,
            r: mothStage.aCounterR,
          };
        }

        // Is a camera actually travelling this frame? The two intentional
        // passes are the only times it is, and a few things below behave
        // differently during them.
        const closePassing = scale > 1.05;

        // ── THE STATE MACHINE ─────────────────────────────────────────
        // Every transition below leaves position, velocity, rotation and
        // wing phase exactly where they were; only what the moth WANTS
        // changes, and even that is taken up over time by the steering.
        const speedWander =
          WANDER_SPEED *
          (1 + WANDER_VARIATION * drift(clock * 0.6, seed)) *
          (reduced ? 0.62 : 1);

        if (state === PERCH) {
          // Still there? A card that has left the composition, or a line
          // that has faded, is no longer somewhere to sit.
          let stillThere = false;
          if (perchEl && perchEl.isConnected) {
            const r = perchEl.getBoundingClientRect();
            stillThere =
              lumOf(perchEl) > 0.12 &&
              r.width > 2 &&
              r.bottom > 0 &&
              r.top < vh &&
              r.right > 0 &&
              r.left < vw;
            if (stillThere) {
              // The anchor rides the element: the cards move, and a moth
              // sitting on one moves with it rather than hanging in the
              // air where it landed.
              const ax = r.left + r.width * perchOx;
              const ay = r.top + r.height * perchOy;
              tmpB.set(
                ax - vw / 2 + Math.sin(clock * 1.7 + seed) * 2.2,
                -(ay - vh / 2) + Math.cos(clock * 2.3 + seed) * 1.6,
                -D0 + 8
              );
            }
          }
          // A camera that has started travelling ends the sit too. The
          // hero's narration is inside the composition the push scales, so
          // a moth still holding onto it would be carried at the letter's
          // speed rather than flying — which is precisely the thing this
          // creature never does.
          // A camera about to travel ends the sit, and so does the A's
          // counter starting to call: the creature has to be flying to be
          // anywhere near the letter before the push, and the staging pull
          // is deliberately ignored while it is perched.
          if (closePassing || mothStage.aStaging > 0.3) stillThere = false;
          // A card is somewhere to STAY — the moth rides it for as long as
          // it is part of the composition, and leaves when the card does.
          // A line of narration is somewhere to pause, and it pauses
          // briefly.
          const overstayed = stateT > (perchIsBrief ? PERCH_DURATION : CARD_PERCH_MAX);
          if (!stillThere || overstayed) {
            state = TAKEOFF;
            stateT = 0;
            perchEl = null;
            // Up and out, off the surface — the push a moth actually
            // gives, not a fade.
            vel.set(
              (Math.random() - 0.5) * 120,
              90 + Math.random() * 70,
              40 + Math.random() * 60
            );
          } else {
            // The landing and the sit are a spring, so the settle has a
            // little give in it and can be interrupted at any frame.
            springStep(perchS, 1, 30, dt);
            pos.lerp(tmpB, clamp01(perchS.x * dt * 9));
            vel.multiplyScalar(Math.exp(-6 * dt));
          }
        }

        if (state !== PERCH) springStep(perchS, 0, 30, dt);

        if (state === WANDER || state === ATTRACTED || state === HOVER) {
          if (bestW > 0.05 && best) {
            state = state === HOVER ? HOVER : ATTRACTED;
          } else if (state === ATTRACTED) {
            state = WANDER;
          }
        }

        // ── STEERING ──────────────────────────────────────────────────
        desired.set(0, 0, 0);
        if (state === PERCH) {
          desired.set(0, 0, 0);
        } else if (state === HOT_BULB_RECOVERY) {
          // Frantic: the heading itself thrashes, fast, and settles.
          const k = 1 - clamp01(stateT / BULB_RECOVERY_DURATION);
          desired
            .set(
              drift(clock * 6.5, seed) + vel.x * 0.004,
              drift(clock * 7.3, seed + 9) + vel.y * 0.004,
              drift(clock * 5.9, seed + 17) * 0.5
            )
            .normalize()
            .multiplyScalar(speedWander * (1 + 1.3 * k));
          if (stateT > BULB_RECOVERY_DURATION) {
            state = WANDER;
            stateT = 0;
          }
        } else if (state === BUMP_RECOVERY) {
          const k = 1 - clamp01(stateT / BUMP_RECOVERY_DURATION);
          desired
            .copy(vel)
            .normalize()
            .add(tmpC.set(drift(clock * 4.1, seed + 3), drift(clock * 4.7, seed + 5), 0).multiplyScalar(0.6 * k))
            .normalize()
            .multiplyScalar(speedWander * (0.7 + 0.5 * k));
          if (stateT > BUMP_RECOVERY_DURATION) {
            state = WANDER;
            stateT = 0;
          }
        } else if (state === TAKEOFF) {
          desired
            .copy(vel)
            .normalize()
            .multiplyScalar(speedWander * 1.15);
          if (stateT > TAKEOFF_DURATION) {
            state = WANDER;
            stateT = 0;
          }
        } else if (best && (state === ATTRACTED || state === HOVER)) {
          tmpA.set(best.x - pos.x, best.y - pos.y, best.z - pos.z);
          const d = Math.max(1, tmpA.length());
          tmpA.multiplyScalar(1 / d);
          // Circling, or going in? See COMMIT_THRESHOLD. A source it has
          // just been burned by is off the table either way.
          const committed =
            drift(clock * 0.13, seed + 61) > COMMIT_THRESHOLD &&
            !(best.kind === K_BULB && bulbCooldown > 0);
          const hold = committed ? best.r * COMMIT_HOLD : HOVER_RADIUS + best.r;
          // A sideways term that itself wanders, so the approach curves
          // and the hold never closes into a circle.
          tmpC
            // The sideways term carries a real component along the view
            // axis now (was 0.5): an orbit built only out of x and y stays
            // in the source's own plane, which is why the creature used to
            // circle a card at one distance from the reader for minutes.
            // Tilted out of that plane it comes toward and falls away as
            // it goes round, which is most of what "it moves in depth"
            // actually looks like.
            .set(-tmpA.y, tmpA.x, drift(clock * 0.9, seed + 11) * 1.1)
            .normalize()
            .multiplyScalar(ORBIT_VARIATION * (0.6 + 0.5 * drift(clock * 0.45, seed + 21)));
          const radial = d > hold ? 1 : -(1 - d / hold) * 1.4;
          desired
            .copy(tmpA)
            .multiplyScalar(radial)
            .add(tmpC)
            .normalize()
            .multiplyScalar(speedWander * (d > hold ? 1 : 0.45));
          if (d < hold * 1.15) {
            state = HOVER;
            // Somewhere to sit? Only sometimes, never twice running, and
            // not until it has been in this beat long enough to have found
            // the surface rather than arrived on it. Every surface the site
            // actually draws counts — the cards of the strip, the fan and
            // the arc, the images of the gallery, a line of narration, and
            // the wordmark itself — so a rest is wherever the flight
            // happens to bring it, not a place it was sent.
            if (
              perchCooldown <= 0 &&
              !closePassing &&
              sceneT > REST_SETTLE_SECONDS &&
              stillT > REST_STILL_SECONDS &&
              best.kind !== K_BULB &&
              Math.random() < PERCH_CHANCE * dt &&
              !(best.kind === K_NARR && narrationPerches >= NARRATION_PERCH_LIMIT)
            ) {
              let px: number;
              let py: number;
              if (best.kind === K_ART) {
                // ART's element is a full-width centred line, so a share of
                // its BOX would land the creature out in the black beside
                // the word. The letters reach about 0.85 of the line box's
                // height either side of its middle; this puts it on the top
                // edge of that ink, where it rests on the letterforms
                // rather than across them.
                const w = Math.max(1, best.right - best.left);
                const reach = ((best.bottom - best.top) * 0.85) / w;
                px = 0.5 + (Math.random() - 0.5) * 1.7 * reach;
                py = 0.03;
              } else if (best.kind === K_NARR) {
                // An edge, and never the middle of the line: it may sit
                // across a letter, it may not sit across the sentence.
                px = Math.random() < 0.5 ? 0.06 + Math.random() * 0.14 : 0.8 + Math.random() * 0.14;
                py = Math.random() < 0.5 ? 0.08 : 0.92;
              } else {
                // The edge of the card, not the face of the work — and
                // never its bottom edge, which is where every card on this
                // site carries its caption.
                const edge = Math.floor(Math.random() * 3);
                px = edge === 0 ? 0.04 : edge === 1 ? 0.96 : 0.2 + Math.random() * 0.6;
                py = edge === 2 ? 0.04 : 0.12 + Math.random() * 0.52;
              }
              // Where that actually puts it, on screen. A gallery image can
              // straddle the top of the window, and settling on the edge of
              // one that is half out of frame is a rest nobody sees — the
              // creature simply disappears for a dozen seconds. If the spot
              // is not in the picture, it does not land there and carries
              // on flying; a later pass will offer a better one.
              const ax = best.left + (best.right - best.left) * px;
              const ay = best.top + (best.bottom - best.top) * py;
              if (
                ax > vw * 0.05 &&
                ax < vw * 0.95 &&
                ay > vh * 0.06 &&
                ay < vh * 0.94
              ) {
                state = PERCH;
                stateT = 0;
                perches++;
                perchEl = best.el;
                // A card is somewhere to stay; type is somewhere to pause.
                perchIsBrief = best.kind !== K_CARD;
                perchCooldown = PERCH_COOLDOWN;
                perchOx = px;
                perchOy = py;
                if (best.kind === K_NARR) narrationPerches++;
              }
            }
          } else if (d > hold * 1.6) {
            state = ATTRACTED;
          }
        } else {
          // Wandering: a heading that turns of its own accord, a speed
          // that is never quite steady, and the occasional near-stop.
          const a = drift(clock * WANDER_TURN, seed) * Math.PI;
          const b = drift(clock * WANDER_TURN * 0.77, seed + 7) * 0.55;
          const pause = clamp01(drift(clock * 0.23, seed + 31) * 1.6 + 0.75);
          desired
            .set(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b) * 0.7)
            .normalize()
            .multiplyScalar(speedWander * (0.12 + 0.88 * pause));
        }

        // The A's negative space pulls on top of whatever else is going
        // on, so the moth drifts into the letter over several seconds
        // rather than being sent there.
        if (staging && state !== PERCH) {
          tmpA.set(staging.x - pos.x, staging.y - pos.y, staging.z - pos.z);
          const d = Math.max(1, tmpA.length());
          const hold = staging.r * 0.55;
          tmpA.multiplyScalar((d > hold ? 1 : -0.6) / d);
          desired.addScaledVector(tmpA, speedWander * 2.3 * mothStage.aStaging);
        }

        // A soft pull back toward the frame when it has drifted well out
        // of the shot, and away from the lens when it has come too close
        // to it. Neither is a leash: both are weak enough that the moth
        // can and does leave frame for a while.
        const depth = -pos.z;
        if (depth < DEPTH_MIN * D0 || depth > DEPTH_MAX * D0) {
          const want = clamp(depth, DEPTH_MIN * D0, DEPTH_MAX * D0);
          desired.z += clamp((-want - pos.z) * 0.9, -160, 160);
        }
        const k = D0 / Math.max(40, depth);
        const sx = vw / 2 + pos.x * k;
        const sy = vh / 2 - pos.y * k;
        if (sx < -vw * 0.12 || sx > vw * 1.12 || sy < -vh * 0.12 || sy > vh * 1.12) {
          desired.x += clamp(-pos.x * 0.6, -190, 190);
          desired.y += clamp(-pos.y * 0.6, -190, 190);
        }
        // Behind the lens after a fly-by: it turns and comes back, at its
        // own pace, under its own power.
        if (pos.z > -DEPTH_MIN * D0 * 0.5) {
          desired.z -= 220;
        }

        // ── COLLISIONS ────────────────────────────────────────────────
        // Only where the flight already goes. Nothing below fires unless
        // the moth is genuinely inside the thing.
        if (state !== PERCH) {
          for (let i = 0; i < srcCount; i++) {
            const s = sources[i];
            if (s.kind === K_BULB) {
              tmpA.set(s.x - pos.x, s.y - pos.y, s.z - pos.z);
              const d = tmpA.length();
              if (d < s.r && bulbCooldown <= 0 && s.lum > 0.15) {
                // HOT. Straight back off it, hard, and it will not come
                // near the thing again for a while.
                tmpA.multiplyScalar(-1 / Math.max(1, d));
                vel.copy(tmpA).multiplyScalar(MAX_SPEED * 0.86);
                vel.x += (Math.random() - 0.5) * 120;
                vel.y += (Math.random() - 0.5) * 120;
                state = HOT_BULB_RECOVERY;
                stateT = 0;
                bulbHits++;
                flutter = 1;
                bulbCooldown = BULB_AVOID_COOLDOWN;
                bankS.x = clamp(bankS.x + (Math.random() - 0.5) * 1.6, -BANK_MAX, BANK_MAX);
              }
              continue;
            }
            if (s.kind !== K_CARD || sinceBump < 1.2) continue;
            // A card is a flat face at the content plane: the moth has to
            // be within a wingspan of that plane AND over the card.
            if (Math.abs(depth - D0) > CARD_COLLISION_RADIUS) continue;
            if (sx < s.left || sx > s.right || sy < s.top || sy > s.bottom) continue;
            // A glance off it, not a rebound: most of the speed is kept
            // and the heading is knocked sideways.
            const push = vel.z > 0 ? -1 : 1;
            vel.z = push * Math.abs(vel.z) * 0.55 - push * 110;
            vel.x += (Math.random() - 0.5) * 140;
            vel.y += 40 + Math.random() * 70;
            state = BUMP_RECOVERY;
            stateT = 0;
            sinceBump = 0;
            bumps++;
            flutter = 0.7;
            bankS.x = clamp(bankS.x + (Math.random() - 0.5) * 1.1, -BANK_MAX, BANK_MAX);
            break;
          }
        }

        // ── INTEGRATE ─────────────────────────────────────────────────
        if (state === PERCH) {
          vel.multiplyScalar(Math.exp(-7 * dt));
        } else {
          accel.copy(desired).sub(vel).multiplyScalar(STEER_RESPONSE);
          vel.addScaledVector(accel, dt);
          vel.multiplyScalar(Math.exp(-DRAG * dt));
          const sp = vel.length();
          if (sp > MAX_SPEED) vel.multiplyScalar(MAX_SPEED / sp);
          pos.addScaledVector(vel, dt);
        }

        // Where it ended up THIS frame. The steering and the collision
        // tests above ran against where it was when they were asked; the
        // size, the tile and the reported numbers have to be about where
        // it actually is, or the square it is drawn in trails it by a
        // frame of travel — up to twenty pixels at full speed.
        const nowDepth = -pos.z;
        const nowK = D0 / Math.max(8, nowDepth);
        const nowSx = vw / 2 + pos.x * nowK;
        const nowSy = vh / 2 - pos.y * nowK;

        // ── ATTITUDE ──────────────────────────────────────────────────
        const speed = vel.length();
        if (speed > 6) {
          lookTarget.copy(pos).add(vel);
          aim.position.copy(pos);
          aim.lookAt(lookTarget);
          // Slerped, so a change of heading is a turn rather than a snap,
          // and slower while perched so the sit stays still.
          moth.quaternion.slerp(aim.quaternion, clamp01(dt * (state === PERCH ? 2 : 5.5)));
        }
        // Banking: it leans into the turn it is making. A spring, so the
        // lean builds and recovers instead of tracking the maths exactly.
        // How hard it is being turned, measured across its OWN right
        // axis rather than the world's, so the lean is the lean of the
        // creature and not of the screen.
        const turn = tmpC.set(1, 0, 0).applyQuaternion(moth.quaternion).dot(accel);
        const bankTarget = clamp(
          -turn * BANK_GAIN + drift(clock * 0.8, seed + 13) * 0.12,
          -BANK_MAX,
          BANK_MAX
        );
        springStep(bankS, state === PERCH ? 0 : bankTarget, 26, dt);
        bankQ.setFromAxisAngle(zAxis, bankS.x);
        moth.quaternion.multiply(bankQ);

        // ── WINGS ─────────────────────────────────────────────────────
        // They never stop: flying, hovering, perched, bumped, recovering,
        // and through every camera move.
        const flapRate =
          WING_FLAP_SPEED *
          (reduced ? 0.72 : 1) *
          (1 + WING_FLAP_VARIATION * drift(clock * 0.85, seed + 41)) *
          (state === PERCH ? 0.62 : 1) *
          (1 + flutter * 0.5);
        wingPhase += flapRate * Math.PI * 2 * dt;
        if (wingPhase > Math.PI * 4) wingPhase -= Math.PI * 4;
        const amp =
          WING_FLAP_AMPLITUDE *
          (state === PERCH ? 0.34 : 1) *
          (1 + WING_FLAP_VARIATION * drift(clock * 0.65, seed + 53)) *
          (1 + flutter * 0.3);
        if (wingL) {
          flapQ.setFromAxisAngle(zAxis, stroke(wingPhase) * amp * (1 + WING_ASYMMETRY));
          wingL.quaternion.copy(wingLBase).multiply(flapQ);
        }
        if (wingR) {
          flapQ.setFromAxisAngle(
            zAxis,
            -stroke(wingPhase + WING_ASYMMETRY * 0.6) * amp * (1 - WING_ASYMMETRY)
          );
          wingR.quaternion.copy(wingRBase).multiply(flapQ);
        }

        // ── SIZE ──────────────────────────────────────────────────────
        // A fixed physical size, and perspective does the rest — but with
        // a floor and a ceiling on what that is ever allowed to LOOK like.
        // The ceiling lifts only while a camera is actually travelling
        // (the push into the A, the flight home through the gallery),
        // which is the one time the reader is meant to see more of the
        // creature than its silhouette; the rest of the time the moth is
        // between 40 and 80px of wingspan whatever the camera is doing.
        const target = sizePx();
        const world = target * NOMINAL_DEPTH;
        const apparent = world * nowK;
        const allowed = clamp(
          apparent,
          MOTH_SIZE.MIN_PX,
          closePassing ? target * MOTH_CLOSE_PASS_MAX : MOTH_SIZE.MAX_PX
        );
        const capped = allowed / Math.max(1e-3, apparent);
        moth.scale.setScalar(world * capped);
        moth.position.copy(pos);
        moth.visible = nowDepth > NEAR_CLIP_PX;

        // ── LIGHT ─────────────────────────────────────────────────────
        // Each rig light goes to the nearest instance of its kind and
        // carries that instance's own brightness. The moth is lit from
        // where the light actually is, so the side facing the bulb is the
        // side that brightens and the far side falls away — and all of it
        // changes continuously as it flies and turns.
        let roomLit = 0;
        for (let kind = 0; kind < 4; kind++) {
          let nearest: Src | null = null;
          let nd = Infinity;
          for (let i = 0; i < srcCount; i++) {
            const s = sources[i];
            if (s.kind !== kind) continue;
            const d = tmpA.set(s.x - pos.x, s.y - pos.y, s.z - pos.z).lengthSq();
            if (d < nd) {
              nd = d;
              nearest = s;
            }
          }
          const l = lights[kind];
          if (!nearest) {
            l.visible = false;
            if (kind === K_BULB) mothDebug.lightBulb = 0;
            else if (kind === K_ART) mothDebug.lightArt = 0;
            else if (kind === K_CARD) mothDebug.lightCard = 0;
            else mothDebug.lightNarr = 0;
            continue;
          }
          l.visible = true;
          // The source's own middle, pulled toward the moth's side of the
          // content plane so a big soft source does not light it from
          // behind the wall it is painted on.
          l.position.set(nearest.x, nearest.y, nearest.z + nearest.r * 0.55);
          const soft = Math.max(nearest.r, LIGHT_HALF_DIST);
          const irradiance =
            (nearest.lum * SRC_LIGHT[kind] * LIGHT_PEAK) / (1 + nd / (soft * soft));
          l.intensity = irradiance * Math.max(1, nd);
          roomLit = Math.max(roomLit, irradiance);
          if (kind === K_BULB) mothDebug.lightBulb = irradiance;
          else if (kind === K_ART) mothDebug.lightArt = irradiance;
          else if (kind === K_CARD) mothDebug.lightCard = irradiance;
          else mothDebug.lightNarr = irradiance;
        }
        // The reflections dim with the room, so an unlit beat cannot leave
        // the moth carrying studio highlights it has no source for.
        // The FLOOR is what a creature in a dark room still has: the
        // little the surround reflects back at it. Raised from 0.12 —
        // below that the shadow side collapsed into the page and the moth
        // read as a cut-out. It is still reflection, and it still rises
        // with the room, so the directional response near the bulb and
        // near ART is unchanged.
        const room = clamp(0.26 + roomLit * 0.12, 0.26, 1.2);
        for (const s of surfaces) s.mat.envMapIntensity = s.env * room;
        ambient.intensity = 0.12 * (0.45 + 0.55 * room);

        mothDebug.frame++;
        mothDebug.x = pos.x;
        mothDebug.y = pos.y;
        mothDebug.z = pos.z;
        mothDebug.depth = nowDepth;
        mothDebug.vx = vel.x;
        mothDebug.vy = vel.y;
        mothDebug.vz = vel.z;
        mothDebug.speed = speed;
        mothDebug.screenX = nowSx;
        mothDebug.screenY = nowSy;
        mothDebug.wingspanPx = apparent * capped;
        mothDebug.state = state;
        tmpC.set(0, 0, 1).applyQuaternion(moth.quaternion);
        mothDebug.fwdX = tmpC.x;
        mothDebug.fwdY = tmpC.y;
        mothDebug.fwdZ = tmpC.z;
        mothDebug.wingPhase = wingPhase;
        mothDebug.bank = bankS.x;
        mothDebug.pull = bestW;
        mothDebug.pullKind = best ? best.kind : -1;
        mothDebug.sources = srcCount;
        mothDebug.motion = compositionMotion;
        mothDebug.stillT = stillT;
        mothDebug.bumps = bumps;
        mothDebug.bulbHits = bulbHits;
        mothDebug.perches = perches;
        mothDebug.narrationPerches = narrationPerches;
        mothDebug.loaded = loaded;
        mothDebug.phase = mothStage.phase;
        mothDebug.camScale = scale;
        mothDebug.camX = mothStage.cameraX;
        mothDebug.camY = mothStage.cameraY;
        mothDebug.aStaging = mothStage.aStaging;
        mothDebug.drawn = moth.visible;

        // The tile goes where the creature is. When it is behind the lens
        // — the far side of a fly-by — there is nothing in the square, so
        // the square is taken off the page rather than cleared sixty times
        // a second. The moth is still flying; this is only the window.
        if (!moth.visible) {
          if (shown) {
            shown = false;
            // `visibility`, not `display`: the creature crosses the lens
            // plane on a fly-by and can sit near it for a few frames, and
            // toggling `display` there invalidates layout on every one of
            // them. This takes the square out of the picture without
            // taking it out of the page.
            canvas.style.visibility = "hidden";
          }
          return;
        }
        if (!shown) {
          shown = true;
          canvas.style.visibility = "visible";
        }
        const tx = nowSx - tile / 2;
        const ty = nowSy - tile / 2;
        canvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
        // The camera's frustum is the whole viewport's; this renders the
        // square of it the tile is sitting over, so what is drawn is
        // exactly what a full-frame render would have put there.
        camera.setViewOffset(vw, vh, tx, ty, tile, tile);
        renderer.render(scene, camera);
      };
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __moth?: typeof mothDebug }).__moth = mothDebug;
      }
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        envRT.texture.dispose();
        pmrem.dispose();
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
        cutMothContinuity();
      };
    })().catch((err) => {
      // Decoration, not content: a refused WebGL context must not take the
      // page with it, but a silent failure reads as "the moth never came".
      console.error("MothLayer:", err);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      data-moth-layer
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
      }}
    />
  );
}
