"use client";

// INFORMATIONAL DESIGN — the EIPL jacket, and the leaflets it holds.
//
// ONE PHYSICAL OBJECT, ONE CONTINUOUS MECHANISM:
//
//   closed jacket -> the cover folds open on its spine -> the leaflets
//   rise out of the pocket and fan out like a hand of cards -> a name for
//   each one appears underneath -> choosing a name draws that leaflet out
//   from under the front one in the fan and brings it forward -> clicking
//   it turns it over, front to back and back again -> "back" reverses the
//   whole path into the exact place in the fan it came from -> the fan
//   closes, the leaflets go down into the pocket -> closed.
//
// HOW "INSIDE" IS REAL HERE: the band across the bottom of the supplied
// inside spread — the machinery photograph and the navy panel — IS the
// pocket. It is drawn a second time as its own layer ABOVE the leaflets,
// so the foot of every leaflet in the fan is genuinely behind it. The fan
// is solved so that every leaflet crosses the band's top edge inside the
// right-hand panel: nothing ever shows below that line where there is no
// pocket to be in.
//
// NOTHING EVER CHANGES CONTAINER. Every leaflet lives in one slot for the
// whole life of the page — stored, fanned and picked are transforms of
// that same element, so "back to its exact place in the fan" is the same
// numbers the fan was built from, not a re-layout.
//
// ORDER IS DEPTH. The leaflets, the pocket flap and the cover share one 3D
// space, each at its own distance from the lens (see zFan and the Z_
// constants), so what hides what is the browser's own depth sort: a
// leaflet is behind the flap in the pocket and passes in front of the
// others only as it actually comes nearer.
//
// GSAP only, on the site's existing timeline system.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ProjectRail from "./ProjectRail";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import gsap from "gsap";
import { INFORMATIONAL_DESIGN, JACKET, LEAFLETS } from "./informationalDesignAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

// THE FAN, as the reference photograph of the real jacket has it: sheets
// nearly the jacket's full height, the front one standing upright over the
// right panel, the others turned about their own bottom-left corner — low
// in the pocket, behind the flap — so their heads swing out over the left
// panel, the back one furthest.
// Measured off the reference: the back sheet's head reaches about a third
// of the way into the spread, every foot stays inside the jacket, and the
// bottom edges of all of them are behind the flap.
const FAN_FROM = -26;
const FAN_TO = 0;
/** The pivot, as a fraction of a leaflet: low on its left edge. */
const PIVOT_X = 0;
const PIVOT_Y = 1;
/** The fan's own offset in the pocket, as fractions of the jacket height. */
const FAN_DX = -0.02;
const FAN_Y = 0.026;
/** A leaflet's height, as a share of the jacket's: nearly as tall as it,
 *  the way a sheet in a folder stands. Re-solve the fan if this changes. */
const LEAF_H = 0.96;
/** How far a chosen leaflet slides up out of its place in the stack, along
 *  its own length, before it comes forward — a share of its height. */
const EXTRACT = 0.14;
/** How far a leaflet lifts in the fan when its name is pointed at. */
const LIFT = 0.035;
/** How dark the room goes behind a leaflet that is being read. */
const SCRIM = 0.62;

// REAL DEPTH, NOT STACKING ORDER. Every part of the object sits at its own
// distance from the lens (px, towards the reader), and the browser's own
// 3D sorting decides what hides what — so a leaflet coming forward passes
// in front of the others continuously, the moment it is actually nearer,
// instead of jumping to the top of a z-index. The inside face is the back
// (0); the leaflets stand in front of it, back to front; the pocket flap
// is in front of them all; a leaflet being read comes well forward of
// everything; the cover is in front while shut and lies behind the
// leaflets, on the left panel, once open.
const zFan = (i: number) => 2 + i * 1.2;
const Z_FLAP = 2 + LEAFLETS.length * 1.2 + 2;
const Z_SCRIM = 40;
const Z_PICKED = 120;
const Z_COVER_SHUT = 60;
const Z_COVER_OPEN = -1;

const EASE_OUT = "power3.out";
const EASE_IO = "power2.inOut";

type Phase = "closed" | "open" | "picked";
type Pose = { x: number; y: number; rotation: number; scale: number };

const N = LEAFLETS.length;

export default function InformationalDesignView() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [active, setActive] = useState(0);
  const [flipped, setFlipped] = useState(false);
  /** The names appear once the fan has settled, not while it is opening. */
  const [chipsIn, setChipsIn] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  /** The whole folded object, so the group can sit centred in both states. */
  const jacketRef = useRef<HTMLDivElement>(null);
  const fixedRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const coverFaceRefs = useRef<(HTMLElement | null)[]>([]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const busyRef = useRef(false);
  const phaseRef = useRef<Phase>("closed");
  const activeRef = useRef(0);
  const flippedRef = useRef(false);
  /** What was asked for while something else was still moving. */
  const pendingRef = useRef<number | "close" | null>(null);

  const picked = phase === "picked";

  // ── THE OBJECT'S MEASUREMENTS ────────────────────────────────────────
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = box.w > 0 && box.w < 760;
  // THE JACKET IS ONE FOLDED SHEET, and the box it lives in is always the
  // full spread — two panels wide — because the fold does not change the
  // sheet's size, only which half of it you can see. Closed, the object
  // occupies the RIGHT panel and the left one is empty; the group is
  // shifted right by half a panel so it still sits centred on the stage.
  // Open, the cover has swung into the left panel and the shift is zero.
  // As large as the stage allows: the open spread's width, and the height
  // with room above for the heads of the fanned leaflets, which stand a
  // little proud of the jacket's top edge.
  const jacketH = Math.max(
    140,
    Math.min(box.h * 0.84, (box.w * 0.97) / (JACKET.spreadW / JACKET.spreadH), 820)
  );
  const panelW = jacketH * (JACKET.panelW / JACKET.panelH);
  const spreadW = jacketH * (JACKET.spreadW / JACKET.spreadH);
  const closedShift = -panelW / 2;
  // A leaflet keeps its own A4 proportion exactly, always.
  const leafH = jacketH * LEAF_H;
  const leafW = leafH * (LEAFLETS[0].w / LEAFLETS[0].h);
  /** A slot's own left edge in the right panel: centred in it. */
  const slotLeft = panelW / 2 - leafW / 2;

  // STORED: sitting on the floor of the pocket, which is the jacket's own
  // bottom edge. A leaflet is taller than the band is deep — that is true
  // of the real object — so its head stands above the band and its body is
  // behind it. Nothing is visible while the jacket is shut because the
  // cover is over it; this is the state the cover opens ONTO.
  const storedY = jacketH - leafH - jacketH * 0.015;
  // PICKED: the chosen leaflet in the middle of the stage, big enough to
  // read. The slot sits at the top of the jacket box and is shorter than
  // it, so centring it means moving it DOWN by half the difference; and the
  // open spread's middle is half a panel left of the pocket's.
  const pickScale = Math.max(
    1,
    Math.min((box.h * 0.94) / leafH, (box.w * 0.9) / leafW, narrow ? 1.5 : 1.7)
  );

  const storedPose: Pose = { x: 0, y: storedY, rotation: 0, scale: 1 };
  const pickedPose: Pose = {
    x: -panelW / 2,
    y: (jacketH - leafH) / 2,
    rotation: 0,
    scale: pickScale,
  };

  /**
   * Leaflet `i` in the fan. GSAP turns a slot about its own centre, so the
   * turn about the pivot is done by hand: the centre is carried round the
   * pivot, and the slot is moved to where the centre ends up.
   */
  const fanPose = useCallback(
    (i: number): Pose => {
      const th = FAN_FROM + ((FAN_TO - FAN_FROM) * i) / Math.max(1, N - 1);
      const r = (th * Math.PI) / 180;
      const left = slotLeft + FAN_DX * jacketH;
      const top = FAN_Y * jacketH;
      const px = left + PIVOT_X * leafW;
      const py = top + PIVOT_Y * leafH;
      const dx = left + leafW / 2 - px;
      const dy = top + leafH / 2 - py;
      const cx = px + dx * Math.cos(r) - dy * Math.sin(r);
      const cy = py + dx * Math.sin(r) + dy * Math.cos(r);
      return { x: cx - (slotLeft + leafW / 2), y: cy - leafH / 2, rotation: th, scale: 1 };
    },
    [slotLeft, jacketH, leafW, leafH]
  );

  /** A fan pose moved along the leaflet's own "up" by `d` pixels. */
  const raise = (p: Pose, d: number): Pose => {
    const r = (p.rotation * Math.PI) / 180;
    return { ...p, x: p.x + Math.sin(r) * d, y: p.y - Math.cos(r) * d };
  };

  // ── HELPERS ──────────────────────────────────────────────────────────
  const slots = () => slotRefs.current.filter(Boolean) as HTMLDivElement[];
  const scrimRef = useRef<HTMLDivElement>(null);

  // Everything that can be asked for mid-motion is queued rather than
  // dropped, and run the moment the object comes to rest.
  const runRef = useRef<(next: number | "close") => void>(() => {});
  const settle = useCallback(() => {
    busyRef.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next != null) runRef.current(next);
  }, []);

  // ── OPEN ─────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    if (busyRef.current || phaseRef.current !== "closed") return;
    busyRef.current = true;
    phaseRef.current = "open";
    setPhase("open");
    const s = slots();
    const tl = gsap.timeline({
      onComplete: () => {
        setChipsIn(true);
        settle();
      },
    });

    // 1. THE FRONT LEAF BENDS BACK ON THE FOLD — one turn about one edge,
    //    and the object slides back to centre as it widens, tied together
    //    so the fold stays put on screen while the cover swings off it.
    //    Past its spine the cover drops under the leaflets, which are about
    //    to fan out over its inside face.
    if (coverRef.current) {
      // It swings back from in front of everything to lie behind the
      // leaflets on the left panel — the depth travels with the turn.
      tl.to(coverRef.current, { rotateY: -180, z: Z_COVER_OPEN, duration: 0.88, ease: EASE_IO }, 0);
    }
    if (jacketRef.current) {
      tl.to(jacketRef.current, { x: 0, duration: 0.88, ease: EASE_IO }, 0);
    }
    // 2. The leaflets lift in the pocket together, still upright, the band
    //    in front of them the whole way.
    tl.to(
      s,
      {
        x: FAN_DX * jacketH,
        y: FAN_Y * jacketH,
        rotation: 0,
        duration: 0.46,
        ease: EASE_OUT,
        stagger: 0.03,
      },
      0.56
    );
    // 3. And open into the fan about the one point in the pocket, the back
    //    ones going furthest over.
    tl.to(
      s,
      {
        x: (i: number) => fanPose(i).x,
        y: (i: number) => fanPose(i).y,
        rotation: (i: number) => fanPose(i).rotation,
        duration: 0.8,
        ease: EASE_OUT,
        stagger: 0.035,
      },
      0.86
    );
  }, [fanPose, jacketH, settle]);

  // ── DRAW ONE OUT / PUT IT BACK ───────────────────────────────────────
  const pick = useCallback(
    (i: number) => {
      if (phaseRef.current !== "open") return;
      if (busyRef.current) {
        pendingRef.current = i;
        return;
      }
      const el = slotRefs.current[i];
      if (!el) return;
      busyRef.current = true;
      phaseRef.current = "picked";
      activeRef.current = i;
      flippedRef.current = false;
      setActive(i);
      setFlipped(false);
      setPhase("picked");
      const tl = gsap.timeline({ onComplete: settle });
      // 1. OUT OF ITS PLACE. It slides up along its own length, at its own
      //    depth in the stack — still behind every leaflet in front of it
      //    and still behind the flap, the way a sheet is drawn out of a
      //    hand of them.
      const out = raise(fanPose(i), EXTRACT * leafH);
      tl.to(el, { x: out.x, y: out.y, duration: 0.55, ease: "sine.inOut" }, 0);
      // 2. TOWARDS THE READER. From there it comes forward and round to the
      //    middle, rising in depth the whole way, so it passes in front of
      //    the others only as it actually gets nearer than they are — one
      //    continuous path, overlapping the draw, nothing faded and nothing
      //    jumping to the top.
      tl.to(
        el,
        { ...pickedPose, z: Z_PICKED, duration: 1.0, ease: "power3.inOut" },
        0.32
      );
      if (scrimRef.current) {
        tl.to(scrimRef.current, { opacity: SCRIM, duration: 0.7, ease: "power1.out" }, 0.45);
      }
    },
    [fanPose, pickedPose.x, pickedPose.y, pickedPose.scale, leafH, settle] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const unpick = useCallback(() => {
    if (phaseRef.current !== "picked" || busyRef.current) return;
    const i = activeRef.current;
    const el = slotRefs.current[i];
    if (!el) return;
    busyRef.current = true;
    phaseRef.current = "open";
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase("open");
        settle();
      },
    });
    let t = 0;
    // Front side up first: it goes back into the fan the way it came out.
    const flip = flipRefs.current[i];
    if (flippedRef.current && flip) {
      flippedRef.current = false;
      setFlipped(false);
      tl.to(flip, { rotateY: 0, duration: 0.56, ease: EASE_IO }, 0);
      t = 0.34;
    }
    // Exactly the reverse: back from the reader to just above its own
    // place, sinking in depth as it goes, so the leaflets in front of it
    // close over it again as it passes behind them...
    const own = fanPose(i);
    const out = raise(own, EXTRACT * leafH);
    tl.to(
      el,
      { x: out.x, y: out.y, rotation: own.rotation, scale: 1, z: zFan(i), duration: 1.0, ease: "power3.inOut" },
      t
    );
    if (scrimRef.current) {
      tl.to(scrimRef.current, { opacity: 0, duration: 0.6, ease: "power1.inOut" }, t + 0.2);
    }
    // ...and down along its own length into the stack it came out of.
    tl.to(el, { x: own.x, y: own.y, duration: 0.55, ease: "sine.inOut" }, t + 0.78);
  }, [fanPose, leafH, settle]);

  // ── TURN IT OVER ─────────────────────────────────────────────────────
  // A real turn: one sheet, front on one face and back on the other.
  const turn = useCallback(() => {
    if (phaseRef.current !== "picked" || busyRef.current) return;
    const flip = flipRefs.current[activeRef.current];
    if (!flip) return;
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    gsap.to(flip, { rotateY: next ? 180 : 0, duration: 0.8, ease: EASE_IO, overwrite: true });
  }, []);

  // ── CLOSE ────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    if (phaseRef.current === "picked") {
      // Back into the fan first, so the gather always starts from the
      // same shape.
      pendingRef.current = "close";
      unpick();
      return;
    }
    if (busyRef.current || phaseRef.current !== "open") return;
    busyRef.current = true;
    phaseRef.current = "closed";
    setChipsIn(false);
    const s = slots();
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase("closed");
        setActive(0);
        settle();
      },
    });
    // 1. The fan closes back into one upright stack...
    tl.to(
      s,
      {
        x: FAN_DX * jacketH,
        y: FAN_Y * jacketH,
        rotation: 0,
        duration: 0.52,
        ease: EASE_IO,
        stagger: { each: 0.03, from: "end" },
      },
      0
    );
    // 2. ...which goes back down into the pocket...
    tl.to(
      s,
      { x: 0, y: storedY, duration: 0.5, ease: "power2.in", stagger: { each: 0.03, from: "end" } },
      0.5
    );
    // 3. ...and the front leaf bends back over them on the same fold,
    //    coming back over the leaflets as it passes its spine.
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: 0, z: Z_COVER_SHUT, duration: 0.86, ease: EASE_IO }, 0.72);
    }
    if (jacketRef.current) {
      tl.to(jacketRef.current, { x: closedShift, duration: 0.86, ease: EASE_IO }, 0.72);
    }
  }, [storedY, jacketH, closedShift, unpick, settle]);

  // What a chosen name does depends on what is already out.
  const choose = useCallback(
    (i: number) => {
      // On a phone the names sit below the object; bring the stage back
      // into view so the draw-out is seen, not just its result.
      const st = stageRef.current?.getBoundingClientRect();
      if (st && (st.top < 0 || st.bottom > window.innerHeight)) {
        stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (busyRef.current) {
        pendingRef.current = i;
        return;
      }
      if (phaseRef.current === "open") pick(i);
      else if (phaseRef.current === "picked" && i !== activeRef.current) {
        pendingRef.current = i;
        unpick();
      }
    },
    [pick, unpick]
  );

  useEffect(() => {
    runRef.current = (next) => {
      if (next === "close") close();
      else choose(next);
    };
  }, [close, choose]);

  // Pointing at a name lifts its leaflet a little in the fan.
  const hover = (i: number, on: boolean) => {
    if (busyRef.current || phaseRef.current !== "open") return;
    const el = slotRefs.current[i];
    if (!el) return;
    const p = on ? raise(fanPose(i), LIFT * jacketH) : fanPose(i);
    gsap.to(el, { x: p.x, y: p.y, duration: 0.32, ease: "power2.out", overwrite: true });
  };

  // ── PARKING ──────────────────────────────────────────────────────────
  // Re-park on any size change so every state is the same picture at any
  // viewport, and so a resize cannot strand a leaflet mid-air.
  useLayoutEffect(() => {
    const s = slots();
    if (!s.length) return;
    const p = phaseRef.current;
    const a = activeRef.current;
    s.forEach((el, i) => {
      const isPicked = p === "picked" && i === a;
      const pose = p === "closed" ? storedPose : isPicked ? pickedPose : fanPose(i);
      gsap.set(el, { ...pose, z: isPicked ? Z_PICKED : zFan(i) });
      const flip = flipRefs.current[i];
      if (flip) {
        gsap.set(flip, {
          transformPerspective: 2400,
          rotateY: isPicked && flippedRef.current ? 180 : 0,
        });
      }
    });
    if (bandRef.current) gsap.set(bandRef.current, { z: Z_FLAP });
    if (scrimRef.current) gsap.set(scrimRef.current, { z: Z_SCRIM, opacity: p === "picked" ? SCRIM : 0 });
    // THE FOLDED OBJECT ITSELF — shut, one panel shifted half a panel left
    // to sit on the stage's centre; open, the whole spread, no shift.
    if (jacketRef.current) {
      gsap.set(jacketRef.current, { x: p === "closed" ? closedShift : 0 });
    }
    if (coverRef.current) {
      gsap.set(coverRef.current, {
        rotateY: p === "closed" ? 0 : -180,
        z: p === "closed" ? Z_COVER_SHUT : Z_COVER_OPEN,
      });
    }
  }, [storedY, pickedPose.x, pickedPose.y, pickedPose.scale, fanPose, closedShift, box.w, box.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phaseRef.current === "picked") unpick();
      else if (phaseRef.current === "open") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unpick, close]);

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS, minHeight: "100dvh" }}>
      <div className="id-shell" style={{ display: "flex", minHeight: "100dvh" }}>
        <ProjectRail
          number={GD_PROJECTS.informationalDesign.number}
          title={INFORMATIONAL_DESIGN.title}
          description={INFORMATIONAL_DESIGN.description}
          backHref={gdBackHref(GD_PROJECTS.informationalDesign)}
          gd={GD_PROJECTS.informationalDesign}
        >
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={eyebrowStyle}>
              {phase === "closed"
                ? "Closed"
                : picked
                  ? `${active + 1} / ${N} · ${flipped ? "Back" : "Front"}`
                  : `${N} leaflets`}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", minHeight: 20 }}>
              {picked ? LEAFLETS[active].title : ""}
            </div>
          </div>
        </ProjectRail>

        {/* ── THE OBJECT ────────────────────────────────────────────── */}
        <main
          className="id-main"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            padding: "clamp(18px, 3vh, 34px) clamp(16px, 2.2vw, 32px)",
            gap: 16,
          }}
        >
          <div className="id-row">
          <div
            ref={stageRef}
            // Handles for the measurement pass: which phase the run is in
            // and which leaflet it is on, read straight off the DOM rather
            // than inferred from where things happen to have landed.
            data-id-phase={phase}
            data-id-active={active}
            data-id-flipped={flipped ? "1" : "0"}
            style={{
              position: "relative",
              flex: "1 1 auto",
              minHeight: narrow ? "58vh" : "min(76vh, 700px)",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              perspective: 2000,
              // The run is wider than the jacket on purpose; it is clipped
              // here so it can never widen the document itself.
              //
              // CLIP, not HIDDEN, and the difference is not cosmetic.
              // `overflow: hidden` still makes this a scroll CONTAINER —
              // it just hides the scrollbar — so when a leaflet out at the
              // end of the run is clicked, the browser scrolls it into
              // view. Measured at 390px wide: the stage ended up at
              // scrollLeft 114 and scrollTop 84, which slid the whole
              // composition under the clip with no scrollbar to put it
              // back. That is what made the centred spread hang off the
              // left edge, BACK land 22px from where the leaflet left, and
              // the closed jacket sit 84px higher than it started.
              // `overflow: clip` clips without ever becoming scrollable.
              overflow: "clip",
            }}
          >
            <div
              ref={jacketRef}
              // THE JACKET OPENS WHERE IT IS. Closed, the whole object is
              // the control — clicking it does what "Open the jacket" below
              // does — rather than the line under it being the only way in.
              onClick={phase === "closed" ? open : undefined}
              data-cursor={phase === "closed" ? "open" : undefined}
              style={{
                cursor: phase === "closed" ? "pointer" : undefined,
                // CENTRED BY POSITION, not by the stage's flexbox.
                //
                // The open spread is two panels wide and on a phone that is
                // wider than the stage. `justify-content: center` will not
                // centre an item it cannot fit: browsers fall back to
                // start-alignment rather than let content overflow off the
                // start edge, where it could never be scrolled to. Measured
                // at 390px, that put the whole object 78px right of where
                // it belonged, which is why a leaflet opened for reading
                // ran off the right-hand edge. Half the box, offset by half
                // its own width, cannot do that.
                position: "absolute",
                left: "50%",
                top: "50%",
                marginLeft: -spreadW / 2,
                marginTop: -jacketH / 2,
                width: spreadW,
                height: jacketH,
                transformStyle: "preserve-3d",
              }}
            >
              {/* 1. THE FIXED LEAF — the half that never moves.
                     ─────────────────────────────────────────────────────
                     A folder is ONE SHEET with a fold down the middle. The
                     supplied outside spread is back cover LEFT, front
                     cover RIGHT; folding it puts the front cover face-out
                     over the back one, with the fold at the closed
                     object's LEFT edge. So the leaf that stays put is the
                     one whose OUTSIDE is the back cover — and its inside
                     face is the RIGHT half of the supplied inside spread,
                     because looking at the inside of a sheet swaps left
                     and right. That is why this shows the right half and
                     the cover's reverse (below) shows the left: it is the
                     same sheet, seen from the other side.

                     It sits in the RIGHT panel, which is where the closed
                     object is. */}
              <div
                ref={fixedRef}
                style={{
                  position: "absolute",
                  left: panelW,
                  top: 0,
                  width: panelW,
                  height: "100%",
                  transformStyle: "preserve-3d",
                  borderRadius: 3,
                  boxShadow: "0 40px 90px rgba(0,0,0,0.75)",
                }}
              >
                {/* The inside face: the right half of the inside spread,
                    shown by giving the image the spread's width and
                    sliding it a panel to the left. Not a crop of the file
                    and not a second asset — the same supplied spread, with
                    one half of it outside the box. */}
                <div style={{ position: "absolute", inset: 0, overflow: "clip", borderRadius: 3 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={JACKET.inside}
                    alt=""
                    style={{
                      position: "absolute",
                      left: -panelW,
                      top: 0,
                      width: spreadW,
                      // Tailwind's preflight caps every img at max-width
                      // 100%, which quietly squeezed this spread-wide
                      // image back down into its panel-wide box — so both
                      // halves of the inside spread were being drawn into
                      // the space for one, at half scale, instead of one
                      // half being clipped out.
                      maxWidth: "none",
                      height: "100%",
                      objectFit: "fill",
                      backfaceVisibility: "hidden",
                    }}
                  />
                </div>
                {/* And its outside: the back cover, facing away. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={JACKET.backCover}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    borderRadius: 3,
                  }}
                />
              </div>

              {/* 2. THE LEAFLETS — in front of the inside face and behind
                     the pocket flap, by depth, which is what makes them
                     stored. */}
              <div
                style={{
                  position: "absolute",
                  // IN THE POCKET, which is in the fixed leaf.
                  left: panelW,
                  top: 0,
                  width: panelW,
                  height: "100%",
                  pointerEvents: "none",
                  // Part of the jacket's one 3D space, so each leaflet's
                  // own depth sorts it against the flap and the cover.
                  transformStyle: "preserve-3d",
                }}
              >
                {LEAFLETS.map((l, i) => {
                  const isPicked = picked && i === active;
                  return (
                    <div
                      key={l.id}
                      ref={(el) => {
                        slotRefs.current[i] = el;
                      }}
                      data-id-slot={i}
                      style={{
                        position: "absolute",
                        left: slotLeft,
                        top: 0,
                        width: leafW,
                        height: leafH,
                        transformOrigin: "50% 50%",
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                        pointerEvents: phase === "closed" ? "none" : "auto",
                      }}
                    >
                      {/* ONE SHEET, TWO FACES. The turn is a real one:
                          front on this side, back on the reverse, and the
                          sheet goes over about its own vertical centre. */}
                      <div
                        ref={(el) => {
                          flipRefs.current[i] = el;
                        }}
                        style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (phaseRef.current === "open") choose(i);
                            else if (isPicked) turn();
                          }}
                          aria-label={
                            isPicked
                              ? `${l.title} — turn over`
                              : `${l.title} — take out`
                          }
                          tabIndex={phase === "closed" || (picked && !isPicked) ? -1 : 0}
                          style={{
                            position: "absolute",
                            inset: 0,
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: phase === "closed" ? "default" : "pointer",
                            WebkitTapHighlightColor: "transparent",
                            transformStyle: "preserve-3d",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={l.pages[0]}
                            alt={`${l.title}, front`}
                            draggable={false}
                            style={{
                              ...faceStyle,
                              boxShadow: isPicked
                                ? "0 30px 80px rgba(0,0,0,0.75)"
                                : "0 14px 34px rgba(0,0,0,0.6)",
                            }}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={l.pages[1]}
                            alt={`${l.title}, back`}
                            draggable={false}
                            style={{
                              ...faceStyle,
                              transform: "rotateY(180deg)",
                              boxShadow: "0 30px 80px rgba(0,0,0,0.75)",
                            }}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. THE POCKET FLAP, in front of the leaflets — and only
                     the flap: the navy shape of the supplied inside spread,
                     cut to its own outline (straight left edge, rounded
                     top-left corner, measured off the artwork). Drawn a
                     second time, over the leaflets and at the same place
                     as the face behind them, so a leaflet in the pocket is
                     genuinely behind it. Nothing else of the spread is in
                     front of them: no band, no slit. */}
              <div
                ref={bandRef}
                aria-hidden
                data-id-flap=""
                style={{
                  position: "absolute",
                  left: panelW,
                  width: panelW,
                  top: 0,
                  height: "100%",
                  overflow: "clip",
                  pointerEvents: "none",
                  clipPath: `inset(${JACKET.pocketTop * 100}% 0 0 ${JACKET.pocketLeft * 100}% round ${(
                    JACKET.pocketRadius * jacketH
                  ).toFixed(1)}px 0 3px 0)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={JACKET.inside}
                  alt=""
                  style={{
                    position: "absolute",
                    left: -panelW,
                    top: 0,
                    width: spreadW,
                    maxWidth: "none",
                    height: "100%",
                    objectFit: "fill",
                  }}
                />
              </div>

              {/* The room behind a leaflet being read: a dark veil in front
                  of the jacket and the rest of the fan, and behind the one
                  leaflet that has come forward. */}
              <div
                ref={scrimRef}
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "-30% -20%",
                  background: "#000",
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />

              {/* 4. THE MOVING LEAF — the front cover, hinged on the fold.
                     ─────────────────────────────────────────────────────
                     It occupies the RIGHT panel, exactly over the fixed
                     leaf, and its hinge is its own LEFT edge — which is
                     the fold, at the spread's centre line. It stays there:
                     nothing about opening moves this panel sideways. It
                     only turns, about that one edge, and at 180 degrees it
                     is lying flat in the left panel, face down, which is
                     where an opened folder's front cover actually is.

                     Two faces of one panel. Front: the supplied front
                     cover. Reverse: the LEFT half of the inside spread —
                     the other half of the sheet whose right half the fixed
                     leaf carries. Drawn pre-rotated so it reads the right
                     way round once the panel has turned over. */}
              <div
                ref={coverRef}
                style={{
                  position: "absolute",
                  left: panelW,
                  top: 0,
                  width: panelW,
                  height: "100%",
                  // z-index is GSAP's: over the leaflets while shut, under
                  // them once it has turned past the spine. And no opacity
                  // here, ever — opacity on a preserve-3d element flattens
                  // it, which would show the cover's face mirrored. The
                  // two faces dim instead.
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  pointerEvents: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={(el) => {
                    coverFaceRefs.current[0] = el;
                  }}
                  src={JACKET.frontCover}
                  alt="EIPL jacket"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    backfaceVisibility: "hidden",
                    borderRadius: 3,
                    boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                  }}
                />
                {/* The reverse of the same panel: the inside spread's
                    LEFT half, which is what this leaf shows once it has
                    turned over. */}
                <div
                  ref={(el) => {
                    coverFaceRefs.current[1] = el;
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "clip",
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    borderRadius: 3,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={JACKET.inside}
                    alt=""
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: spreadW,
                      // Tailwind's preflight caps every img at max-width
                      // 100%, which quietly squeezed this spread-wide
                      // image back down into its panel-wide box — so both
                      // halves of the inside spread were being drawn into
                      // the space for one, at half scale, instead of one
                      // half being clipped out.
                      maxWidth: "none",
                      height: "100%",
                      objectFit: "fill",
                    }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* THE NAMES — one per leaflet, the way you choose one: a column
              to the right of the object, so the object gets the room. The
              space is kept even while they are hidden: if it appeared with
              them the stage would shrink mid-motion and re-size the jacket
              under the leaflets that are moving in it. */}
          <div
            data-id-chips
            className="id-chips"
            style={{ pointerEvents: chipsIn ? "auto" : "none" }}
          >
            {LEAFLETS.map((l, i) => {
              const on = picked && i === active;
              return (
                <button
                  key={l.id}
                  type="button"
                  data-id-chip={i}
                  aria-pressed={on}
                  tabIndex={chipsIn ? 0 : -1}
                  onClick={() => choose(i)}
                  onMouseEnter={() => hover(i, true)}
                  onMouseLeave={() => hover(i, false)}
                  onFocus={() => hover(i, true)}
                  onBlur={() => hover(i, false)}
                  style={{
                    ...chipStyle(on),
                    opacity: chipsIn ? 1 : 0,
                    transform: chipsIn ? "none" : "translateX(10px)",
                    transition: `opacity 360ms ease ${chipsIn ? i * 45 : 0}ms, transform 420ms cubic-bezier(0.22,1,0.36,1) ${chipsIn ? i * 45 : 0}ms, background 240ms ease, color 240ms ease, border-color 240ms ease`,
                  }}
                >
                  {l.title}
                </button>
              );
            })}
          </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              alignItems: "center",
              minHeight: 24,
              flexWrap: "wrap",
            }}
          >
            {phase === "closed" && (
              <button type="button" onClick={open} style={controlStyle}>
                Open the jacket
              </button>
            )}
            {phase === "open" && (
              <>
                <button type="button" onClick={close} style={controlStyle}>
                  Put the leaflets back
                </button>
                <span className="id-sep" aria-hidden style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span style={{ ...eyebrowStyle, color: "rgba(255,255,255,0.35)" }}>
                  Choose a leaflet
                </span>
              </>
            )}
            {picked && (
              <>
                <button type="button" onClick={unpick} style={controlStyle}>
                  <span aria-hidden>←</span> Back to the leaflets
                </button>
                <span className="id-sep" aria-hidden style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <button type="button" onClick={turn} style={{ ...controlStyle, color: "rgba(255,255,255,0.5)" }}>
                  {flipped ? "Turn to the front" : "Turn it over"}
                </button>
              </>
            )}
          </div>

        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .id-shell { flex-direction: column !important; }
        }
        .id-row { display: flex; flex: 1 1 auto; gap: clamp(20px, 2.4vw, 40px); min-height: 0; }
        .id-row > [data-id-phase] { flex: 1 1 auto; }
        .id-chips {
          flex: 0 0 clamp(190px, 15vw, 240px);
          display: flex; flex-direction: column; justify-content: center; align-items: stretch;
          gap: 10px;
        }
        .id-chips [data-id-chip] { text-align: left; }
        @media (max-width: 1100px) {
          .id-row { flex-direction: column; }
          .id-chips {
            flex: 0 0 auto; flex-direction: row; flex-wrap: wrap; justify-content: center;
            max-width: 920px; width: 100%; margin: 0 auto;
          }
          .id-chips [data-id-chip] { text-align: center; }
        }
        @media (max-width: 480px) {
          .id-sep { display: none; }
          [data-id-chip] { font-size: 10px !important; padding: 8px 10px !important; }
        }
      `}</style>
    </div>
  );
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
};


const controlStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.78)",
};

const faceStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "fill",
  display: "block",
  borderRadius: 2,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

function chipStyle(on: boolean): React.CSSProperties {
  return {
    fontFamily: SANS,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
    padding: "9px 13px",
    borderRadius: 2,
    border: `1px solid ${on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.22)"}`,
    background: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.03)",
    color: on ? "#000" : "rgba(255,255,255,0.8)",
    cursor: "pointer",
  };
}
