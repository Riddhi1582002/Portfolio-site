"use client";

// THE PUBLICATIONS INDEX PAGE.
//
// Five publications, one large art-directed arrangement, no forced order —
// a reader points at whichever one they want, in the 3D group itself or in
// the plain text index beside it, and the two stay in sync: hovering either
// one highlights the other. See PublicationsIndexDisplay for the
// arrangement, loading and per-object hover physics; this file owns the
// page around it — title, the text index, the metadata that appears next
// to whatever is active, and the click -> short focus transition -> "open
// this project" hand-off (a hook only, see `handleFocusComplete` below —
// there is nothing to open yet).

import { useCallback, useEffect, useRef, useState } from "react";
import ProjectRail from "./ProjectRail";
import { GD_PROJECTS, gdBackHref } from "./graphicDesignProjects";
import { useRouter } from "next/navigation";
import { pageOut } from "../lib/pageTransition";
import PublicationsIndexDisplay, {
  INDEX_PUBLICATIONS,
} from "./PublicationsIndexDisplay";

const SANS = "'Neue Montreal', system-ui, sans-serif";
// WHICH ARRANGEMENT THE SPATIAL INDEX USES IS A QUESTION ABOUT THE SHAPE OF
// THE FRAME, NOT THE SIZE OF THE DEVICE. The two compositions are laid out
// in world units, so what decides whether one fits is the viewport's aspect:
// the wide display needs room across, the stacked one needs room down.
// Keyed on width alone, a phone held in landscape (740x360 — wider than it
// is tall, and barely any height) was handed the STACKED arrangement and
// piled all five publications behind the hero. Anything at all taller than
// it is wide gets the stacked one; everything else gets the wide display,
// which the engine's own fit then scales to the frame it actually has.
const NARROW_ASPECT = 1.1;

export default function PublicationsIndexView() {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePos, setActivePos] = useState<{ x: number; y: number } | null>(null);
  const [narrow, setNarrow] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < window.innerHeight * NARROW_ASPECT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Escape returns to the overview from a click-selection — there is no
  // destination to navigate back FROM yet (see the file banner), so this is
  // the only way to back out of a focused publication short of leaving the
  // page.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const onHoverObject = useCallback((id: string | null) => setHoveredId(id), []);
  const onSelectObject = useCallback((id: string) => setSelectedId(id), []);
  const onActiveScreenPos = useCallback(
    (pos: { x: number; y: number } | null) => setActivePos(pos),
    []
  );
  // THE HOOK. Fires once the click-focus transition for a publication has
  // finished easing in — the point at which the 3D object has visually
  // taken over the frame, so the route change underneath it is not a jump
  // cut. Each publication id is also its own route segment (see
  // PublicationsIndexDisplay's INDEX_PUBLICATIONS and app/publications/
  // [slug]).
  const onFocusComplete = useCallback(
    (id: string) => {
      // The same transition the ring's cards run, so index -> publication
      // is the same move as card -> index rather than a different one:
      // the focused object has taken the frame, the wipe sweeps up over
      // it, and the publication's own page carries the edge off. See
      // app/lib/pageTransition.ts.
      pageOut(() => router.push(`/publications/${id}`));
    },
    [router]
  );

  const active = hoveredId ?? selectedId;
  const activePub = active ? INDEX_PUBLICATIONS.find((p) => p.id === active) ?? null : null;

  return (
    <div
      ref={stageRef}
      className="relative w-full overflow-hidden bg-black text-white"
      style={{ height: "100dvh", fontFamily: SANS }}
      onClick={(e) => {
        // A click on the bare stage (not the canvas, not a nav item) backs
        // out of a focused selection — the same "click outside" affordance
        // as the site's other overlays.
        if (e.target === stageRef.current && selectedId) setSelectedId(null);
      }}
    >
      {/* THE ARRANGEMENT. Absolutely positioned under everything else, full
          bleed — the publications are the navigation, not an illustration
          boxed off to one side. */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <PublicationsIndexDisplay
          hoveredId={hoveredId}
          onHoverObject={onHoverObject}
          selectedId={selectedId}
          onSelectObject={onSelectObject}
          onFocusComplete={onFocusComplete}
          onActiveScreenPos={onActiveScreenPos}
          narrow={narrow}
        />
      </div>

      {/* THE METADATA. Anchored to the active object's own projected
          screen position — appearing "near the object" rather than in a
          fixed panel — offset up and left of its anchor point so it clears
          the object itself. Only ever the title and what kind of document
          it is. The kind-of-document subtitle that used to sit under the
          title here is gone: the arrangement already shows what each piece
          is, and a second line under a hovered object was labelling it
          twice. */}
      {activePub && activePos && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: activePos.x,
            top: activePos.y,
            transform: "translate(-50%, calc(-100% - 22px))",
            zIndex: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            textAlign: "center",
            opacity: 1,
            transition: "opacity 200ms ease",
          }}
        >
          <div
            style={{
              fontSize: "clamp(16px, 1.5vw, 22px)",
              fontWeight: 600,
              letterSpacing: "0.01em",
              color: "#fff",
              textShadow:
                "0 0 1px rgba(255,255,255,0.5), 0 0 18px rgba(255,255,255,0.22), 0 2px 18px rgba(0,0,0,0.6)",
            }}
          >
            {activePub.title}
          </div>
        </div>
      )}

      {/* THE PROJECT HEADER — the same block, at the same top-left place,
          as every other graphic-design project page. */}
      <ProjectRail
        variant="overlay"
        number={GD_PROJECTS.publications.number}
        title="Publications"
        backHref={gdBackHref(GD_PROJECTS.publications)}
          gd={GD_PROJECTS.publications}
      />

      {/* THE PROJECT INDEX. A plain, restrained list — not a second grid —
          linked to the arrangement in both directions: hovering an entry
          highlights its object, and (via `hoveredId`, written by the
          display's own raycaster) hovering an object highlights its
          entry. */}
      <nav
        aria-label="Publications"
        style={{
          position: "absolute",
          zIndex: 5,
          ...(narrow
            ? {
                left: "clamp(18px, 4vw, 48px)",
                right: "clamp(18px, 4vw, 48px)",
                bottom: "clamp(18px, 3.5vh, 30px)",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: "8px 18px",
              }
            : {
                left: "clamp(18px, 4vw, 48px)",
                bottom: "clamp(28px, 8vh, 72px)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }),
        }}
      >
        {INDEX_PUBLICATIONS.map((pub, i) => {
          const isActive = active === pub.id;
          return (
            <button
              key={pub.id}
              type="button"
              aria-current={isActive}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                setHoveredId(pub.id);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "mouse") return;
                setHoveredId((cur) => (cur === pub.id ? null : cur));
              }}
              onFocus={() => setHoveredId(pub.id)}
              onBlur={() => setHoveredId((cur) => (cur === pub.id ? null : cur))}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(pub.id);
              }}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: SANS,
                textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  color: isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.32)",
                  transition: "color 200ms ease",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: "clamp(13px, 1.15vw, 16px)",
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  borderBottom: isActive
                    ? "1px solid rgba(255,255,255,0.7)"
                    : "1px solid transparent",
                  paddingBottom: 2,
                  transition: "color 200ms ease, font-weight 200ms ease, border-color 200ms ease",
                }}
              >
                {pub.title}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
