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
import Link from "next/link";
import PublicationsIndexDisplay, {
  INDEX_PUBLICATIONS,
} from "./PublicationsIndexDisplay";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const NARROW_BREAKPOINT = 860;

export default function PublicationsIndexView() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePos, setActivePos] = useState<{ x: number; y: number } | null>(null);
  const [narrow, setNarrow] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < NARROW_BREAKPOINT);
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
  // finished easing in. Nothing to hand off to yet — each publication's own
  // presentation is a later pass — so this only logs the moment a reader
  // has chosen a project cleanly enough to act on; a future pass replaces
  // the body with `router.push` (or equivalent) to that publication's page.
  const onFocusComplete = useCallback((id: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[publications] would open project presentation: ${id}`);
    }
  }, []);

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
          it is (from the file's own name): nothing else about these five
          is known, so nothing else is claimed. */}
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
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {activePub.medium}
          </div>
        </div>
      )}

      {/* TOP: back link + restrained page title. Small on purpose — the
          arrangement is the page, this is just identification. */}
      <div
        style={{
          position: "absolute",
          top: "clamp(18px, 3.5vh, 34px)",
          left: "clamp(18px, 4vw, 48px)",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Back
        </Link>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(13px, 1.1vw, 16px)",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.82)",
          }}
        >
          Publications
        </h1>
      </div>

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
