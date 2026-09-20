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
import CurtainLink from "./CurtainLink";
import gsap from "gsap";
import { INFORMATIONAL_DESIGN, JACKET, LEAFLETS } from "./informationalDesignAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** Carousel spacing, as a share of one leaflet's width. Restrained: the
 *  neighbours sit close enough to read as one short run of sheets. */
const STEP = 0.62;
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
  // The jacket: one panel closed, the two-panel spread open.
  const jacketH = Math.max(180, Math.min(box.h * 0.8, narrow ? 340 : 500));
  const closedW = jacketH * (JACKET.panelW / JACKET.panelH);
  const openW = jacketH * (JACKET.spreadW / JACKET.spreadH);
  // A leaflet keeps its own A4 proportion exactly, always.
  const leafH = jacketH * 0.72;
  const leafW = leafH * (LEAFLETS[0].w / LEAFLETS[0].h);
  const step = leafW * STEP;
  const pageGap = leafW * PAGE_GAP;

  // STORED: the leaflet reaches down into the band, and only its head
  // stands proud of the jacket's top edge.
  const storedY = -6;
  // RAISED: clear of the band's top edge, so it has visibly come out of
  // the opening it was in.
  const raisedY = -jacketH * 0.17;
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

  /** The rail offset that puts leaflet `i` in the middle of the stage. */
  const railX = useCallback((i: number) => -i * step, [step]);

  // ── OPEN ─────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    if (busyRef.current || phaseRef.current !== "closed") return;
    busyRef.current = true;
    phaseRef.current = "open";
    setPhase("open");
    const s = slots();
    const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });

    // 1. The cover folds open on the spine. It is a real two-sided panel
    //    (front cover on one face, back cover on the other), so it ends
    //    lying open to the left rather than vanishing.
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: -180, duration: 0.86, ease: EASE_IO }, 0);
    }
    // 2. The leaflets rise out of the pocket. Short stagger, no overshoot:
    //    they are being lifted, not thrown.
    tl.to(
      s,
      { y: raisedY, duration: 0.7, ease: EASE_OUT, stagger: 0.055 },
      0.42
    );
    // 3. Only once out do they open into the run, which is what keeps the
    //    movement from reading as passing through the jacket's walls.
    tl.to(
      s,
      { x: (i: number) => slotX(i), duration: 0.72, ease: EASE_OUT, stagger: 0.045 },
      0.62
    );
    if (railRef.current) {
      tl.to(railRef.current, { x: railX(0), duration: 0.72, ease: EASE_OUT }, 0.62);
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
    // 2. And drops back down into the pocket.
    tl.to(
      s,
      { y: storedY, duration: 0.52, ease: "power2.in", stagger: { each: 0.04, from: "end" } },
      t0 + 0.26
    );
    // 3. The cover folds back over them.
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: 0, duration: 0.8, ease: EASE_IO }, t0 + 0.46);
    }
  }, [storedY, raisedY, slotX]);

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
  }, [storedY, raisedY, centredY, centredScale, leafW, pageGap, slotX, railX, box.w, box.h]);

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
          <CurtainLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </CurtainLink>
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
              style={{
                position: "relative",
                width: phase === "closed" ? closedW : openW,
                height: jacketH,
                transition: "width 860ms cubic-bezier(0.65,0,0.35,1)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* 1. THE INSIDE FACE. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={JACKET.inside}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "fill",
                  opacity: phase === "closed" ? 0 : centredActive ? 0.3 : 1,
                  transition: "opacity 420ms ease",
                  borderRadius: 3,
                  boxShadow: "0 40px 90px rgba(0,0,0,0.75)",
                }}
              />

              {/* 2. THE LEAFLETS — between the inside face and the pocket
                     band, which is what makes them stored. */}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                  position: "absolute",
                  inset: 0,
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
                          // On the SLOT, so both of the sheet's pages dim
                          // together; on the front page alone it left the
                          // back one at full brightness.
                          opacity:
                            phase === "closed" || isActive || isCentred
                              ? 1
                              : centredActive
                                ? 0.1
                                : 0.68,
                          transition: "opacity 380ms ease",
                        }}
                      >
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

              {/* 3. THE POCKET BAND, drawn over the leaflets. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${JACKET.pocketTop * 100}%`,
                  bottom: 0,
                  zIndex: 5,
                  overflow: "hidden",
                  opacity: phase === "closed" ? 0 : centredActive ? 0.3 : 1,
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
                    left: 0,
                    top: `-${(JACKET.pocketTop / (1 - JACKET.pocketTop)) * 100}%`,
                    width: "100%",
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

              {/* 4. THE COVER — a real two-sided panel folding on its
                     spine, so it ends lying open rather than vanishing. */}
              <div
                ref={coverRef}
                style={{
                  position: "absolute",
                  left: phase === "closed" ? 0 : "50%",
                  top: 0,
                  width: closedW,
                  height: "100%",
                  zIndex: 7,
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  transition: "left 860ms cubic-bezier(0.65,0,0.35,1), opacity 420ms ease",
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
                {/* The other face of the same panel. */}
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
