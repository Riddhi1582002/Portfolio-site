"use client";

// INFORMATIONAL DESIGN — the EIPL jacket, and the leaflets it holds.
//
// ONE PHYSICAL OBJECT, ONE CONTINUOUS MECHANISM:
//
//   closed jacket -> the cover folds open on its spine -> the leaflets
//   rise out of the pocket -> they settle into a short horizontal run ->
//   one is picked up, comes to the centre and opens out into its two
//   actual pages -> it goes back to the exact place it came from -> the
//   run gathers -> the leaflets go back down into the pocket -> closed.
//
// HOW "INSIDE" IS REAL HERE, since that is what decides whether any of
// this reads: the band across the bottom of the supplied inside spread —
// the machinery photograph and the navy panel — IS the pocket. It is
// drawn a second time as its own layer ABOVE the leaflets, so a stored
// leaflet is genuinely occluded by it. A leaflet can only appear by
// travelling up through that opening, and can only disappear by going
// back down through it.
//
// NOTHING EVER CHANGES CONTAINER. Every leaflet lives in one slot for the
// whole life of the page — stored, carousel and centred are three
// transforms of that same element, so "back to its exact carousel
// position" is not a re-layout, it is the same tween run backwards. That
// is also why nothing fades: fading is what you reach for when the thing
// on screen is not the thing you started with.
//
// The second page opens out from BEHIND the first rather than replacing
// it, so front and back are two real sheets being separated, not one
// sheet flipping.
//
// GSAP only, on the site's existing timeline system.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import TransitionLink from "./TransitionLink";
import gsap from "gsap";
import { INFORMATIONAL_DESIGN, JACKET, LEAFLETS } from "./informationalDesignAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** Carousel spacing, as a share of one leaflet's width. Restrained: the
 *  neighbours sit close enough to read as one short run of sheets. */
// How far apart the leaflets stand in the run, as a share of one leaflet's
// width. At 0.62 each sheet buried well over a third of the next and the
// collection read as a deck being shuffled; at 0.86 they overlap by a
// hand's width — enough to be a collection rather than a row of separate
// things, little enough that every neighbour is legible.
const STEP = 0.86;
/** Gap between a centred leaflet's two pages, same units. */
const PAGE_GAP = 0.04;

const EASE_OUT = "power3.out";
const EASE_IO = "power2.inOut";

type Phase = "closed" | "open" | "centred";

export default function InformationalDesignView() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [active, setActive] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  /** The whole folded object, so the group can sit centred in both states. */
  const jacketRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const backRefs = useRef<(HTMLDivElement | null)[]>([]);
  const busyRef = useRef(false);
  const phaseRef = useRef<Phase>("closed");
  const activeRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const centredActive = phase === "centred";

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
  // Nothing about this animates a WIDTH: growing a box sideways is what
  // made the two supplied spreads read as unrelated flat cards.
  const jacketH = Math.max(180, Math.min(box.h * 0.8, narrow ? 340 : 500));
  const panelW = jacketH * (JACKET.panelW / JACKET.panelH);
  const spreadW = jacketH * (JACKET.spreadW / JACKET.spreadH);
  /** The shut object occupies the RIGHT panel of the spread's box, so its
   *  middle is half a panel right of the box's middle. The group is moved
   *  the other way by that much to put it back on the stage's centre. */
  const closedShift = -panelW / 2;
  // A leaflet keeps its own A4 proportion exactly, always.
  const leafH = jacketH * 0.72;
  const leafW = leafH * (LEAFLETS[0].w / LEAFLETS[0].h);
  const step = leafW * STEP;
  const pageGap = leafW * PAGE_GAP;

  // STORED: sitting on the floor of the pocket, which is the jacket's own
  // bottom edge. A leaflet is taller than the band is deep — that is true
  // of the real object — so its head stands above the band and its body is
  // behind it. Nothing is visible while the jacket is shut because the
  // cover is over it; this is the state the cover opens ONTO.
  const storedY = jacketH - leafH - jacketH * 0.015;
  // RAISED: lifted clear of the band, foot just overlapping its top edge,
  // so it reads as having come out of the opening it was in rather than
  // having been somewhere else all along.
  const raisedY = JACKET.pocketTop * jacketH - leafH - jacketH * 0.04;
  // CENTRED: the picked-up leaflet sits in the middle of the stage, big
  // enough to read, with room for its second page beside it.
  const centredScale = Math.max(
    1,
    Math.min(
      (box.h * 0.9) / leafH,
      // Both pages, side by side, have to fit the stage — the binding
      // measurement, and the one that was missing when the spread ran off
      // the right-hand edge.
      (box.w * 0.9) / (leafW * 2 + pageGap),
      narrow ? 1.3 : 1.75
    )
  );
  // The slot sits at the TOP of the jacket box and is shorter than it, so
  // centring the picked-up sheet in the stage means moving it DOWN by half
  // the difference — not up. Up is what clipped the spread against the
  // stage's own top edge.
  const centredY = (jacketH - leafH) / 2;

  // ── HELPERS ──────────────────────────────────────────────────────────
  const slots = () => slotRefs.current.filter(Boolean) as HTMLDivElement[];

  /** Where a slot sits in the carousel run, before any centring. */
  const slotX = useCallback((i: number) => i * step, [step]);

  /**
   * The rail offset that puts leaflet `i` in the middle of the STAGE.
   *
   * The rail hangs at the centre of the RIGHT panel, because that is where
   * the pocket is and a leaflet has to come out of the pocket. Once the
   * run is out and open, though, it is the thing being looked at and
   * belongs on the stage's own centre line — which is half a panel to the
   * left of where it started. That half-panel is the lift itself: the
   * stack rises out of the pocket and comes forward onto the centre, one
   * move, rather than fanning out where it happened to be stored.
   */
  const railX = useCallback(
    (i: number) => -i * step - panelW / 2,
    [step, panelW]
  );

  // ── OPEN ─────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    if (busyRef.current || phaseRef.current !== "closed") return;
    busyRef.current = true;
    phaseRef.current = "open";
    setPhase("open");
    const s = slots();
    const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });

    // 1. THE FRONT LEAF BENDS BACK ON THE FOLD. One turn about one edge —
    //    the fold, at the spread's centre — and nothing slides. It is a
    //    real two-sided panel: the front cover on the face you have been
    //    looking at, the inside spread's left half on its reverse, so at
    //    the end it is lying open with the interior showing rather than
    //    having disappeared.
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: -180, duration: 0.88, ease: EASE_IO }, 0);
    }
    // 1b. And the object slides back to centre as it widens. Closed, it is
    //     one panel and sits in the right half of the spread's box with a
    //     half-panel shift keeping it centred on the stage; open, it is
    //     two panels and the shift is gone. The two are tied together so
    //     the FOLD stays put on screen while the cover swings off it —
    //     which is what makes it read as hinged rather than translated.
    if (jacketRef.current) {
      tl.to(jacketRef.current, { x: 0, duration: 0.88, ease: EASE_IO }, 0);
    }
    // 2. The leaflets rise out of the pocket, as a stack: one short
    //    stagger, no overshoot, no fan yet. They are being lifted, not
    //    thrown, and the pocket band is still in front of them the whole
    //    way up, so they are coming OUT of it.
    tl.to(
      s,
      { y: raisedY, duration: 0.72, ease: EASE_OUT, stagger: 0.05 },
      0.54
    );
    // 3. Only once out do they open into the run, which is what keeps the
    //    movement from reading as passing through the jacket's walls.
    tl.to(
      s,
      { x: (i: number) => slotX(i), duration: 0.74, ease: EASE_OUT, stagger: 0.04 },
      0.86
    );
    if (railRef.current) {
      tl.to(railRef.current, { x: railX(0), duration: 0.74, ease: EASE_OUT }, 0.86);
    }
  }, [raisedY, slotX, railX]);

  // ── CLOSE ────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    if (busyRef.current || phaseRef.current === "closed") return;
    busyRef.current = true;
    const s = slots();
    const wasCentred = phaseRef.current === "centred";
    phaseRef.current = "closed";
    const tl = gsap.timeline({
      onComplete: () => {
        busyRef.current = false;
        setPhase("closed");
        setActive(0);
      },
    });
    // If one was centred it first goes back to the run, so the gather
    // always starts from the same shape.
    if (wasCentred) {
      const el = slotRefs.current[activeRef.current];
      const back = backRefs.current[activeRef.current];
      if (back) tl.to(back, { x: 0, duration: 0.34, ease: EASE_IO }, 0);
      if (el) {
        tl.to(
          el,
          { x: slotX(activeRef.current), y: raisedY, scale: 1, duration: 0.46, ease: EASE_IO },
          0.08
        );
      }
    }
    const t0 = wasCentred ? 0.4 : 0;
    // 1. The run gathers back into a single stack over the opening.
    tl.to(
      s,
      { x: 0, duration: 0.5, ease: EASE_IO, stagger: { each: 0.04, from: "end" } },
      t0
    );
    if (railRef.current) {
      tl.to(railRef.current, { x: 0, duration: 0.5, ease: EASE_IO }, t0);
    }
    // 2. And slides back DOWN INTO the pocket — the same travel as the
    //    rise, reversed, with the band in front of them throughout, so
    //    they go into the opening rather than behind the artwork.
    tl.to(
      s,
      { y: storedY, duration: 0.56, ease: "power2.in", stagger: { each: 0.04, from: "end" } },
      t0 + 0.28
    );
    // 3. The front leaf bends back over them on the same fold, and the
    //    object narrows to one panel again — the shift returning as the
    //    cover comes back, exactly as they left together.
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: 0, duration: 0.86, ease: EASE_IO }, t0 + 0.52);
    }
    if (jacketRef.current) {
      tl.to(
        jacketRef.current,
        { x: closedShift, duration: 0.86, ease: EASE_IO },
        t0 + 0.52
      );
    }
  }, [storedY, raisedY, slotX, closedShift]);

  // ── PICK ONE UP / PUT IT BACK ────────────────────────────────────────
  const centre = useCallback(
    (i: number) => {
      if (busyRef.current || phaseRef.current !== "open") return;
      busyRef.current = true;
      phaseRef.current = "centred";
      setPhase("centred");
      const el = slotRefs.current[i];
      const back = backRefs.current[i];
      const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });
      if (el) {
        // It travels from its own place in the run to the middle — the
        // same element, so putting it back lands on the same numbers.
        tl.to(
          el,
          {
            x: slotX(i) - ((leafW + pageGap) * centredScale) / 2,
            y: centredY,
            scale: centredScale,
            duration: 0.72,
            ease: EASE_OUT,
          },
          0
        );
      }
      if (railRef.current) {
        tl.to(railRef.current, { x: railX(i), duration: 0.72, ease: EASE_OUT }, 0);
      }
      // The second page comes out from behind the first rather than
      // replacing it: two sheets being separated, never one turning over.
      if (back) {
        tl.to(back, { x: leafW + pageGap, duration: 0.62, ease: EASE_OUT }, 0.28);
      }
    },
    [slotX, railX, leafW, pageGap, centredScale, centredY]
  );

  const uncentre = useCallback(
    (i: number) => {
      if (busyRef.current || phaseRef.current !== "centred") return;
      busyRef.current = true;
      phaseRef.current = "open";
      setPhase("open");
      const el = slotRefs.current[i];
      const back = backRefs.current[i];
      const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });
      // Exactly the reverse: the pages close back together first, then it
      // returns to its own slot in the run.
      if (back) tl.to(back, { x: 0, duration: 0.42, ease: EASE_IO }, 0);
      if (el) {
        tl.to(
          el,
          { x: slotX(i), y: raisedY, scale: 1, duration: 0.6, ease: EASE_IO },
          0.14
        );
      }
    },
    [slotX, raisedY]
  );

  // ── PARKING ──────────────────────────────────────────────────────────
  // Re-park on any size change so every state is the same picture at any
  // viewport, and so a resize cannot strand a leaflet mid-air.
  useLayoutEffect(() => {
    const s = slots();
    if (!s.length) return;
    const p = phaseRef.current;
    const a = activeRef.current;
    s.forEach((el, i) => {
      const centredOne = p === "centred" && i === a;
      gsap.set(el, {
        x: centredOne
          ? slotX(i) - ((leafW + pageGap) * centredScale) / 2
          : p === "closed"
            ? 0
            : slotX(i),
        y: p === "closed" ? storedY : centredOne ? centredY : raisedY,
        scale: centredOne ? centredScale : 1,
      });
      const back = backRefs.current[i];
      if (back) gsap.set(back, { x: centredOne ? leafW + pageGap : 0 });
    });
    if (railRef.current) {
      gsap.set(railRef.current, { x: p === "closed" ? 0 : railX(a) });
    }
    // THE FOLDED OBJECT ITSELF. Shut, it is one panel sitting in the right
    // half of the spread's box, so the group is moved half a panel left to
    // put it back on the stage's centre; open, it is the whole spread and
    // there is nothing to correct. Parked here as well as animated —
    // without this the very first frame of a visit had the jacket a half
    // panel right of where closing it again would put it, so the state you
    // started in and the state you came back to were not the same one.
    if (jacketRef.current) {
      gsap.set(jacketRef.current, { x: p === "closed" ? closedShift : 0 });
    }
    if (coverRef.current) {
      gsap.set(coverRef.current, { rotateY: p === "closed" ? 0 : -180 });
    }
  }, [
    storedY,
    raisedY,
    centredY,
    centredScale,
    leafW,
    pageGap,
    slotX,
    railX,
    closedShift,
    box.w,
    box.h,
  ]);

  // ── CAROUSEL NAVIGATION ──────────────────────────────────────────────
  const goTo = useCallback(
    (i: number) => {
      if (phaseRef.current !== "open") return;
      const clamped = Math.min(LEAFLETS.length - 1, Math.max(0, i));
      setActive(clamped);
      if (railRef.current) {
        gsap.to(railRef.current, { x: railX(clamped), duration: 0.56, ease: EASE_OUT });
      }
    },
    [railX]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (p === "centred") {
        if (e.key === "Escape") uncentre(activeRef.current);
        return;
      }
      if (p !== "open") return;
      if (e.key === "ArrowLeft") goTo(activeRef.current - 1);
      else if (e.key === "ArrowRight") goTo(activeRef.current + 1);
      else if (e.key === "Escape") close();
      else if (e.key === "Enter") centre(activeRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, close, centre, uncentre]);

  // Drag with momentum, carried into the snap rather than stopping dead.
  const drag = useRef<{ x: number; railX: number; t: number; vx: number; moved: boolean } | null>(
    null
  );
  // Which pointer the stage has captured, if any. Capture is taken only
  // once a drag has actually started, never on pointer-down — and that is
  // not a refinement. A captured pointer retargets the CLICK that follows
  // it to the capturing element, so with capture taken on press the
  // leaflets' own buttons never received a click at all: a leaflet could
  // be dragged past, and could not be opened.
  const captured = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "open" || !railRef.current) return;
    gsap.killTweensOf(railRef.current);
    drag.current = {
      x: e.clientX,
      railX: (gsap.getProperty(railRef.current, "x") as number) || 0,
      t: performance.now(),
      vx: 0,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !railRef.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3 && !d.moved) {
      d.moved = true;
      // Now it is a drag, so the pointer is worth holding on to: the hand
      // can leave the stage and the run still follows it.
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        captured.current = e.pointerId;
      } catch {
        // Capture can be refused (the pointer is already gone); the drag
        // simply ends at the stage's edge instead of following past it.
      }
    }
    const now = performance.now();
    if (now > d.t) {
      d.vx = dx / (now - d.t);
      d.t = now;
      d.x = e.clientX;
      d.railX = ((gsap.getProperty(railRef.current, "x") as number) || 0) + dx;
    }
    gsap.set(railRef.current, { x: d.railX });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (captured.current != null) {
      try {
        (e.currentTarget as Element).releasePointerCapture(captured.current);
      } catch {
        // Already released with the pointer itself.
      }
      captured.current = null;
    }
    if (!d || !railRef.current) return;
    if (!d.moved) return;
    const x = (gsap.getProperty(railRef.current, "x") as number) || 0;
    goTo(Math.round(-(x + d.vx * 170) / step));
  };
  const draggedRef = drag;

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS, minHeight: "100dvh" }}>
      <div className="id-shell" style={{ display: "flex", minHeight: "100dvh" }}>
        {/* ── LEFT: number, title, description. ─────────────────────── */}
        <aside
          className="id-rail"
          style={{
            width: "clamp(270px, 26vw, 380px)",
            flex: "0 0 auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "clamp(20px, 3.4vh, 38px) clamp(18px, 2.3vw, 38px)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <TransitionLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <div>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>04</div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(25px, 2.5vw, 42px)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.08,
              }}
            >
              {INFORMATIONAL_DESIGN.title}
            </h1>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.75,
              fontWeight: 300,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {INFORMATIONAL_DESIGN.description}
          </p>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={eyebrowStyle}>
              {phase === "closed" ? "Closed" : `${active + 1} / ${LEAFLETS.length}`}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", minHeight: 20 }}>
              {phase === "closed" ? "" : LEAFLETS[active].title}
            </div>
          </div>
        </aside>

        {/* ── THE OBJECT ────────────────────────────────────────────── */}
        <main
          className="id-main"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            padding: "clamp(18px, 3vh, 34px) clamp(16px, 3vw, 46px)",
            gap: 16,
          }}
        >
          <div
            ref={stageRef}
            // Handles for the measurement pass: which phase the run is in
            // and which leaflet it is on, read straight off the DOM rather
            // than inferred from where things happen to have landed.
            data-id-phase={phase}
            data-id-active={active}
            style={{
              position: "relative",
              flex: "1 1 auto",
              minHeight: narrow ? "56vh" : "min(74vh, 560px)",
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
              style={{
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
                style={{
                  position: "absolute",
                  left: panelW,
                  top: 0,
                  width: panelW,
                  height: "100%",
                  transformStyle: "preserve-3d",
                  opacity: centredActive ? 0.3 : 1,
                  transition: "opacity 420ms ease",
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

              {/* 2. THE LEAFLETS — between the inside face and the pocket
                     band, which is what makes them stored. */}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                  position: "absolute",
                  // IN THE POCKET, which is in the fixed leaf — so the run
                  // starts from the right panel and not from the middle of
                  // a spread that is not open yet.
                  left: panelW,
                  top: 0,
                  width: panelW,
                  height: "100%",
                  // Above the cover and the band once a leaflet has been
                  // picked up — a slot's own z-index only orders it within
                  // THIS layer, so without this the cover painted over it.
                  zIndex: centredActive ? 9 : 2,
                  touchAction: phase === "open" ? "pan-y" : "auto",
                  cursor: phase === "open" ? "grab" : "default",
                }}
              >
                <div ref={railRef} style={{ position: "absolute", left: "50%", top: 0, width: 0, height: "100%" }}>
                  {LEAFLETS.map((l, i) => {
                    const isActive = i === active;
                    const isCentred = centredActive && isActive;
                    return (
                      <div
                        key={l.id}
                        ref={(el) => {
                          slotRefs.current[i] = el;
                        }}
                        // A handle for the measurement pass, which checks
                        // that BACK returns a leaflet to the exact box it
                        // left and that closing restores the initial state.
                        data-id-slot={i}
                        style={{
                          position: "absolute",
                          left: -leafW / 2,
                          top: 0,
                          width: leafW,
                          height: leafH,
                          transformOrigin: "50% 50%",
                          zIndex: isCentred ? 9 : isActive ? 4 : 3,
                          willChange: "transform",
                          // FULLY OPAQUE, always — a leaflet is a printed
                          // sheet and a printed sheet is not translucent.
                          // Depth in the run is carried by overlap and by
                          // scale, never by fading the neighbours out,
                          // which is what made the collection read as
                          // ghosts of itself. The one exception is while
                          // a leaflet is being READ: the rest step back
                          // out of the way rather than competing with it.
                          opacity: centredActive && !isCentred ? 0.12 : 1,
                          transition: "opacity 380ms ease",
                        }}
                      >
                        {/* WHICH DEPARTMENT THIS ONE IS.
                            The rail already names the leaflet at the
                            centre, but a run of nine covers is a set of
                            thumbnails, and a thumbnail you cannot name
                            without first sliding it to the middle is not
                            doing a thumbnail's job. The name rides the
                            slot, so it travels with its own leaflet.

                            ABOVE, not below: below is where the jacket's
                            own inside spread and the pocket band are, and
                            a caption there would be printed over the
                            artwork. It goes while a leaflet is being read,
                            where the rail names it anyway and the slot's
                            own scale would blow the type up with it. */}
                        <div
                          aria-hidden
                          style={{
                            position: "absolute",
                            bottom: "100%",
                            left: 0,
                            right: 0,
                            marginBottom: 12,
                            textAlign: "center",
                            fontSize: 10,
                            fontWeight: 500,
                            letterSpacing: "0.13em",
                            textTransform: "uppercase",
                            lineHeight: 1.35,
                            color: isActive
                              ? "rgba(255,255,255,0.8)"
                              : "rgba(255,255,255,0.34)",
                            opacity: phase === "open" ? 1 : 0,
                            transition: "opacity 320ms ease, color 320ms ease",
                            pointerEvents: "none",
                          }}
                        >
                          {l.title}
                        </div>

                        {/* THE BACK PAGE, behind the front until the
                            leaflet is picked up. */}
                        <div
                          ref={(el) => {
                            backRefs.current[i] = el;
                          }}
                          style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 1,
                            willChange: "transform",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={l.pages[1]}
                            alt={`${l.title}, back`}
                            draggable={false}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "fill",
                              display: "block",
                              borderRadius: 2,
                              boxShadow: "0 18px 44px rgba(0,0,0,0.66)",
                            }}
                          />
                        </div>

                        {/* THE FRONT PAGE. */}
                        <button
                          type="button"
                          onClick={() => {
                            if (draggedRef.current?.moved) return;
                            if (phaseRef.current === "centred") {
                              if (isActive) uncentre(i);
                              return;
                            }
                            if (phaseRef.current !== "open") return;
                            if (i !== active) goTo(i);
                            else centre(i);
                          }}
                          aria-label={l.title}
                          style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 2,
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: phase === "closed" ? "default" : "pointer",
                            WebkitTapHighlightColor: "transparent",
                            // Depth in the run: the one in the middle full
                            // size, its neighbours a touch smaller and set
                            // back. Never applied to the centred one, whose
                            // own scale GSAP owns.
                            transform: isCentred ? "none" : `scale(${isActive ? 1 : 0.9})`,
                            transformOrigin: "50% 50%",
                            transition: "transform 520ms cubic-bezier(0.22,1,0.36,1)",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={l.pages[0]}
                            alt={l.title}
                            draggable={false}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "fill",
                              display: "block",
                              borderRadius: 2,
                              boxShadow: isActive
                                ? "0 26px 60px rgba(0,0,0,0.72)"
                                : "0 16px 36px rgba(0,0,0,0.6)",
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. THE POCKET, drawn over the leaflets — which is the
                     whole of what makes them STORED rather than lying on
                     top of the artwork. The band is the bottom strip of
                     the same inside spread, same right half, so its edge
                     lines up with the face behind it exactly. It is never
                     hidden: the pocket is part of the inside face, and
                     with the cover shut the cover is over both. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: panelW,
                  width: panelW,
                  top: `${JACKET.pocketTop * 100}%`,
                  bottom: 0,
                  zIndex: 5,
                  overflow: "clip",
                  opacity: centredActive ? 0.3 : 1,
                  transition: "opacity 420ms ease",
                  borderRadius: "0 0 3px 3px",
                  pointerEvents: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={JACKET.inside}
                  alt=""
                  style={{
                    position: "absolute",
                    left: -panelW,
                    top: `-${(JACKET.pocketTop / (1 - JACKET.pocketTop)) * 100}%`,
                    width: spreadW,
                    maxWidth: "none",
                    height: `${100 / (1 - JACKET.pocketTop)}%`,
                    objectFit: "fill",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 14,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.46), rgba(0,0,0,0))",
                  }}
                />
              </div>

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
                  zIndex: 7,
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  transition: "opacity 420ms ease",
                  opacity: centredActive ? 0.3 : 1,
                  pointerEvents: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
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

            {/* Arrows: one at a time, and only while the run is the thing
                being looked at. */}
            {phase === "open" && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(active - 1)}
                  disabled={active === 0}
                  aria-label="Previous leaflet"
                  style={arrowStyle("left", active === 0)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => goTo(active + 1)}
                  disabled={active === LEAFLETS.length - 1}
                  aria-label="Next leaflet"
                  style={arrowStyle("right", active === LEAFLETS.length - 1)}
                >
                  ›
                </button>
              </>
            )}
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
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span style={{ ...eyebrowStyle, color: "rgba(255,255,255,0.35)" }}>
                  Drag, or click a leaflet to open it
                </span>
              </>
            )}
            {phase === "centred" && (
              <button type="button" onClick={() => uncentre(active)} style={controlStyle}>
                <span aria-hidden>←</span> Back to the set
              </button>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .id-shell { flex-direction: column !important; }
          .id-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
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

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.62)",
  textDecoration: "none",
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

function arrowStyle(side: "left" | "right", disabled: boolean): React.CSSProperties {
  return {
    position: "absolute",
    [side]: "clamp(4px, 1.6vw, 22px)",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 12,
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 20,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.25 : 1,
    display: "grid",
    placeItems: "center",
  };
}
