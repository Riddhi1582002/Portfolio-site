"use client";

// INFORMATIONAL DESIGN — the EIPL jacket, and the leaflets it holds.
//
// THE WHOLE PAGE IS ONE PHYSICAL OBJECT doing one physical thing:
//
//   closed jacket -> opens -> the leaflets come UP OUT of the pocket ->
//   they settle into a carousel -> they go back down INTO the pocket ->
//   closed jacket.
//
// HOW "INSIDE" IS ACTUALLY ACHIEVED, since this is the part that decides
// whether the whole thing reads as real: the pocket band across the
// bottom of the inside spread (see JACKET.pocketTop) is drawn as its own
// layer, cropped out of the supplied artwork, and it sits at a HIGHER
// z-index than the leaflets. A leaflet at rest is parked with its body
// behind that band — genuinely occluded by it, not merely overlapping —
// and leaves by translating upward until it clears the band's top edge.
// Nothing fades in, nothing arrives from off-screen, and nothing is ever
// drawn behind the jacket: the only way a leaflet can appear is by rising
// out of the opening it was stored in.
//
// Every transform here is GSAP, on the same timeline system the rest of
// the site uses. No second animation library, and the drag is a plain
// pointer handler feeding the same tween engine.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  INFORMATIONAL_DESIGN,
  JACKET,
  LEAFLETS,
  type Leaflet,
} from "./informationalDesignAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** How far apart the carousel's leaflets sit, as a share of one's width. */
const STEP = 0.78;
/** Snap duration, and the reveal's own per-leaflet stagger. */
const SNAP_MS = 520;
const STAGGER = 0.075;

type Phase = "closed" | "open";

export default function InformationalDesignView() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [active, setActive] = useState(0);
  const [inspect, setInspect] = useState<{ leaflet: Leaflet; page: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const jacketRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const busyRef = useRef(false);
  const phaseRef = useRef<Phase>("closed");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── LAYOUT NUMBERS ───────────────────────────────────────────────────
  // One leaflet's on-screen width, and the pocket geometry derived from
  // the same box, so the artwork and the mechanism can never disagree.
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The jacket, closed, is one panel; open, it is the two-panel spread.
  const jacketH = Math.min(box.h * 0.82, 520);
  const closedW = jacketH * (JACKET.panelW / JACKET.panelH);
  const openW = jacketH * (JACKET.spreadW / JACKET.spreadH);
  // A leaflet is smaller than the panel that holds it, and keeps its own
  // A4 proportion exactly.
  const leafH = jacketH * 0.74;
  const leafW = leafH * (LEAFLETS[0].w / LEAFLETS[0].h);
  // STORED: the leaflet's lower edge is down inside the band (the band's
  // top is at JACKET.pocketTop of the jacket's height, and leafH is tall
  // enough that a leaflet parked at -8px reaches into it), while its very
  // top edge stands a few pixels proud of the jacket's own top edge —
  // which is the only part of it the closed jacket shows.
  const storedY = -8;
  // RAISED: high enough that the whole leaflet has cleared the band's top
  // edge, so it has visibly come OUT of the opening rather than slid
  // around behind anything.
  const raisedY = -jacketH * 0.2;

  // ── THE REVEAL AND ITS REVERSE ───────────────────────────────────────
  const open = useCallback(() => {
    if (busyRef.current || phaseRef.current === "open") return;
    busyRef.current = true;
    phaseRef.current = "open";
    setPhase("open");
    const slots = slotRefs.current.filter(Boolean) as HTMLDivElement[];
    const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });
    // 1. The jacket opens: the cover swings off the inside face it was
    //    lying against, around its own spine.
    if (coverRef.current) {
      tl.to(
        coverRef.current,
        { rotateY: -164, duration: 0.72, ease: "power3.inOut" },
        0
      );
    }
    // 2. The leaflets rise out of the opening, one after the next. They
    //    are already in the DOM, already in the pocket — this only moves
    //    them, which is why none of them fades or arrives from a side.
    tl.to(
      slots,
      {
        y: raisedY,
        duration: 0.62,
        ease: "power2.out",
        stagger: STAGGER,
      },
      0.34
    );
    // …and only once each is out of the pocket does the stack open into
    // the row. Fanning while still inside would read as passing through
    // the jacket's own walls.
    tl.to(
      slots,
      {
        x: (i: number) => i * leafW * STEP,
        duration: 0.66,
        ease: "power3.out",
        stagger: STAGGER,
      },
      0.5
    );
    // 3. And the rail they are on slides to centre the first one.
    if (railRef.current) {
      tl.to(railRef.current, { x: 0, duration: 0.7, ease: "power3.out" }, 0.34);
    }
  }, [raisedY, leafW]);

  const close = useCallback(() => {
    if (busyRef.current || phaseRef.current === "closed") return;
    busyRef.current = true;
    phaseRef.current = "closed";
    const slots = slotRefs.current.filter(Boolean) as HTMLDivElement[];
    const tl = gsap.timeline({
      onComplete: () => {
        busyRef.current = false;
        setPhase("closed");
        setActive(0);
      },
    });
    // Exactly the reverse, and in the reverse order: the leaflets go back
    // down into the pocket first, then the cover closes over them.
    if (railRef.current) {
      tl.to(railRef.current, { x: 0, duration: 0.42, ease: "power2.inOut" }, 0);
    }
    tl.to(
      slots,
      { x: 0, duration: 0.5, ease: "power2.inOut", stagger: { each: STAGGER, from: "end" } },
      0
    );
    tl.to(
      slots,
      { y: storedY, duration: 0.5, ease: "power2.in", stagger: { each: STAGGER, from: "end" } },
      0.26
    );
    if (coverRef.current) {
      tl.to(coverRef.current, { rotateY: 0, duration: 0.66, ease: "power3.inOut" }, 0.4);
    }
  }, [storedY]);

  // Park every leaflet in the pocket on mount and whenever the box
  // changes, so the closed state is the same picture at any size.
  useLayoutEffect(() => {
    const slots = slotRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!slots.length) return;
    gsap.set(slots, {
      y: phaseRef.current === "open" ? raisedY : storedY,
      x: phaseRef.current === "open" ? (i: number) => i * leafW * STEP : 0,
    });
  }, [storedY, raisedY, leafW, box.w, box.h]);

  // ── THE CAROUSEL ─────────────────────────────────────────────────────
  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.min(LEAFLETS.length - 1, Math.max(0, i));
      setActive(clamped);
      if (railRef.current) {
        gsap.to(railRef.current, {
          x: -clamped * leafW * STEP,
          duration: SNAP_MS / 1000,
          ease: "power3.out",
        });
      }
    },
    [leafW]
  );

  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (inspect) {
        if (e.key === "Escape") setInspect(null);
        else if (e.key === "ArrowLeft") setInspect((v) => (v ? { ...v, page: Math.max(0, v.page - 1) } : v));
        else if (e.key === "ArrowRight")
          setInspect((v) => (v ? { ...v, page: Math.min(v.leaflet.pages.length - 1, v.page + 1) } : v));
        return;
      }
      if (e.key === "ArrowLeft") goTo(active - 1);
      else if (e.key === "ArrowRight") goTo(active + 1);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, active, goTo, close, inspect]);

  // Drag with momentum: the pointer moves the rail directly, and letting
  // go carries the throw into the snap rather than stopping dead.
  const drag = useRef<{ x: number; railX: number; t: number; vx: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "open" || !railRef.current) return;
    gsap.killTweensOf(railRef.current);
    drag.current = {
      x: e.clientX,
      railX: (gsap.getProperty(railRef.current, "x") as number) || 0,
      t: performance.now(),
      vx: 0,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !railRef.current) return;
    const dx = e.clientX - d.x;
    const now = performance.now();
    if (now > d.t) {
      d.vx = dx / (now - d.t);
      d.t = now;
      d.x = e.clientX;
      d.railX = (gsap.getProperty(railRef.current, "x") as number) + dx;
    }
    gsap.set(railRef.current, { x: d.railX });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !railRef.current) return;
    const x = (gsap.getProperty(railRef.current, "x") as number) || 0;
    // Where the throw would carry it, then the nearest leaflet to that.
    const projected = x + d.vx * 180;
    goTo(Math.round(-projected / (leafW * STEP)));
  };

  const stageMinH = "min(78vh, 560px)";

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS, minHeight: "100dvh" }}>
      <div className="id-shell" style={{ display: "flex", minHeight: "100dvh" }}>
        {/* ── LEFT: number, title, description. Nothing else. ───────── */}
        <aside
          className="id-rail"
          style={{
            width: "clamp(280px, 27vw, 390px)",
            flex: "0 0 auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "clamp(22px, 3.6vh, 40px) clamp(20px, 2.4vw, 40px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Link href="/?to=graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </Link>
          <div>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>04</div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(27px, 2.6vw, 44px)",
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

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={eyebrowStyle}>
              {phase === "closed" ? "Closed" : `${active + 1} / ${LEAFLETS.length}`}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", minHeight: 20 }}>
              {phase === "open" ? LEAFLETS[active].title : ""}
            </div>
          </div>
        </aside>

        {/* ── THE OBJECT ────────────────────────────────────────────── */}
        <main
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            padding: "clamp(20px, 3.4vh, 38px) clamp(18px, 3vw, 48px)",
            gap: 18,
          }}
        >
          <div
            ref={stageRef}
            style={{
              position: "relative",
              flex: "1 1 auto",
              minHeight: stageMinH,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              perspective: 1800,
              // The row of leaflets is deliberately wider than the jacket
              // — that is what a carousel is — so it is clipped HERE, at
              // the stage, rather than being allowed to push the document
              // sideways. Without this the page itself grew to the width
              // of nine leaflets at every viewport.
              overflow: "hidden",
            }}
          >
            {/* The jacket and everything stored in it share one box, so
                the pocket's opening and the leaflets' rest position are
                the same measurement. */}
            <div
              ref={jacketRef}
              style={{
                position: "relative",
                width: phase === "open" ? openW : closedW,
                height: jacketH,
                transition: "width 720ms cubic-bezier(0.65,0,0.35,1)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* 1. THE INSIDE FACE, with the pocket as part of it. */}
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
                  opacity: phase === "open" ? 1 : 0,
                  transition: "opacity 320ms ease 260ms",
                  borderRadius: 3,
                  boxShadow: "0 40px 90px rgba(0,0,0,0.75)",
                }}
              />

              {/* 2. THE LEAFLETS, between the inside face and the pocket
                     band — which is what makes them stored rather than
                     placed. Each sits in its own slot on a rail. */}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  overflow: "visible",
                  touchAction: phase === "open" ? "pan-y" : "auto",
                  cursor: phase === "open" ? "grab" : "default",
                }}
              >
                <div
                  ref={railRef}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: 0,
                    height: "100%",
                  }}
                >
                  {LEAFLETS.map((l, i) => {
                    const isActive = i === active;
                    return (
                      <div
                        key={l.id}
                        ref={(el) => {
                          slotRefs.current[i] = el;
                        }}
                        style={{
                          position: "absolute",
                          left: -leafW / 2,
                          top: 0,
                          width: leafW,
                          height: leafH,
                          zIndex: isActive ? 3 : 2,
                          willChange: "transform",
                        }}
                      >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          // Depth: the active one forward and full size,
                          // its neighbours a little smaller and set back.
                          // On its OWN element — GSAP drives x/y on the
                          // slot above, and one transform cannot carry
                          // both without them clobbering each other.
                          transform: `scale(${isActive ? 1 : 0.88})`,
                          transformOrigin: "50% 50%",
                          transition:
                            "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease",
                          opacity: phase === "open" ? (isActive ? 1 : 0.72) : 1,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (phase !== "open") return;
                            if (i !== active) goTo(i);
                            else setInspect({ leaflet: l, page: 0 });
                          }}
                          aria-label={l.title}
                          style={{
                            display: "block",
                            width: "100%",
                            height: "100%",
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: phase === "open" ? "pointer" : "default",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={l.pages[0]}
                            alt=""
                            draggable={false}
                            style={{
                              width: "100%",
                              height: "100%",
                              // The leaflet box is cut to the artwork's own
                              // ratio, so "fill" here cannot distort it.
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. THE POCKET BAND — the bottom of the supplied inside
                     spread, drawn again ON TOP of the leaflets. This one
                     layer is what occludes them, and so what makes the
                     jacket a container rather than a backdrop. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${JACKET.pocketTop * 100}%`,
                  bottom: 0,
                  zIndex: 4,
                  overflow: "hidden",
                  opacity: phase === "open" ? 1 : 0,
                  transition: "opacity 320ms ease 260ms",
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
                {/* The opening itself: a soft shadow along the band's top
                    edge, where a stored leaflet disappears into it. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 16,
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))",
                  }}
                />
              </div>

              {/* 4. THE COVER, lying on the inside face until it swings
                     open around the spine. Above everything while closed,
                     which is why nothing inside is visible yet. */}
              <div
                ref={coverRef}
                style={{
                  position: "absolute",
                  left: phase === "open" ? "50%" : 0,
                  top: 0,
                  width: closedW,
                  height: "100%",
                  zIndex: 6,
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                  transition: "left 720ms cubic-bezier(0.65,0,0.35,1)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={JACKET.frontCover}
                  alt="EIPL jacket"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    display: "block",
                    borderRadius: 3,
                    boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                  }}
                />
              </div>

              {/* While closed, the stored leaflets show only as edges
                  above the jacket's own top edge — enough to say the
                  jacket holds something, no more. */}
              {phase === "closed" && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "8%",
                    right: "8%",
                    top: -10,
                    height: 12,
                    zIndex: 5,
                    display: "flex",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        display: "block",
                        width: `${28 - i * 4}%`,
                        height: 12 - i * 2,
                        borderRadius: "2px 2px 0 0",
                        background: "linear-gradient(to bottom, #efefec, #cfcfc9)",
                        boxShadow: "0 -3px 10px rgba(0,0,0,0.45)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Arrows: one leaflet at a time, and only once it is open. */}
            {phase === "open" && !inspect && (
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

          {/* Minimal controls: the one action the object affords. */}
          <div style={{ display: "flex", justifyContent: "center", gap: 18, alignItems: "center", minHeight: 24 }}>
            {phase === "closed" ? (
              <button type="button" onClick={open} style={controlStyle}>
                Open the jacket
              </button>
            ) : (
              <>
                <button type="button" onClick={close} style={controlStyle}>
                  Put the leaflets back
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span style={{ ...eyebrowStyle, color: "rgba(255,255,255,0.35)" }}>
                  Drag, or click a leaflet to read it
                </span>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── INSPECTION: the leaflet itself, large and undistorted. ──── */}
      {inspect && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={inspect.leaflet.title}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(3,3,4,0.96)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "clamp(16px, 2.6vh, 28px) clamp(18px, 3vw, 40px)",
              gap: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setInspect(null)}
              style={{ ...controlStyle, display: "inline-flex", gap: 8 }}
            >
              <span aria-hidden>←</span> Back
            </button>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
              {inspect.leaflet.title}
            </span>
            <span style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>
              {inspect.page + 1} / {inspect.leaflet.pages.length}
            </span>
          </div>
          <div
            style={{
              position: "relative",
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 clamp(52px, 8vw, 110px) clamp(18px, 3vh, 34px)",
            }}
          >
            <button
              type="button"
              onClick={() => setInspect((v) => (v ? { ...v, page: Math.max(0, v.page - 1) } : v))}
              disabled={inspect.page === 0}
              aria-label="Previous page"
              style={arrowStyle("left", inspect.page === 0)}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setInspect((v) =>
                  v ? { ...v, page: Math.min(v.leaflet.pages.length - 1, v.page + 1) } : v
                )
              }
              disabled={inspect.page === inspect.leaflet.pages.length - 1}
              aria-label="Next page"
              style={arrowStyle("right", inspect.page === inspect.leaflet.pages.length - 1)}
            >
              ›
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={inspect.leaflet.pages[inspect.page]}
              alt={inspect.leaflet.title}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                boxShadow: "0 40px 110px rgba(0,0,0,0.8)",
              }}
            />
          </div>
        </div>
      )}

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
    [side]: "clamp(6px, 2vw, 26px)",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 21,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.25 : 1,
    display: "grid",
    placeItems: "center",
  };
}
