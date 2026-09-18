"use client";

// THE SNEH SAGAR PROJECT PAGE.
//
// Rebuilt against the project's 16:9 reference layout: an Other
// Publications strip at the top, a main viewer where the current page is
// the largest thing on the page, and a page-overview glimpse below it.
// Earlier drafts of this file also carried a phone-frame "mobile preview"
// mock, a standalone square page-6 crop next to the Back link, a floating
// dedication-poem column beside the viewer, and the project description
// repeated a second time in the lower band — none of those are in the
// reference and each one was competing with the actual pages for
// attention, so none of them are rebuilt here. What's kept: the strip,
// the overview grid, prev/next + thumbnail navigation, and one project
// description, stated once.
//
// THE PAGES ARE THE SUPPLIED PDF, RASTERISED — all 37 of them (see
// public/publications/sneh-sagar/pages). Page changes and thumbnail
// clicks crossfade through the existing GSAP system (the same library
// ArcCarousel's own transitions use) rather than swapping the <img> src
// outright, so a page change reads as one page settling into place, not a
// flash cut.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { INDEX_PUBLICATIONS } from "./publicationsData";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const PAGE_COUNT = 37;
const PAGE_ASPECT = 1240 / 1523;
const pageSrc = (n: number) => `/publications/sneh-sagar/pages/page-${String(n).padStart(2, "0")}.jpg`;

const COVER_SRC: Record<string, string> = {
  "sneh-sagar": "/images/publications/sneh-sagar-front.jpg",
  excledge: "/images/publications/excel-edge-front.jpg",
  mining: "/images/publications/mining-front.jpg",
  handbook: "/images/publications/employee-handbook-front.jpg",
  policy: "/images/publications/policy-front.jpg",
};

// The exact facts as given, and nothing beyond them: a tribute book made
// by the children for their mother; letters, messages, memories,
// photographs and small details from the people whose lives she touched
// were gathered and compiled — that compilation done by Riddhi together
// with the daughter; the book itself designed single-handedly by Riddhi,
// shaping what was collected into a personal, handcrafted narrative.
const DESCRIPTION =
  "Sneh Sagar is a tribute book created by the children for their mother, celebrating her life and spirit. Letters, messages, memories, photographs and small details from people whose lives she touched were collected and compiled into the book — the compilation done by Riddhi together with the daughter. Riddhi designed the entire book single-handedly, shaping the collected words, memories and images into a personal, warm, handcrafted visual narrative.";

// Stepped zoom, not a binary in/out toggle — 100% (fit) through 275%.
const ZOOM_LEVELS = [1, 1.5, 2, 2.75];
const PAGE_TRANSITION_MS = 550;

export default function SnehSagarDetailView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const others = useMemo(() => INDEX_PUBLICATIONS.filter((p) => p.id !== "sneh-sagar"), []);

  const zoom = ZOOM_LEVELS[zoomIdx];

  // ── PAGE CHANGE, CROSSFADED VIA GSAP ────────────────────────────────
  // `page` is the authoritative current page; `prevPage` is only set for
  // the duration of a transition, to give the outgoing image something to
  // render and fade from. transitioningRef blocks a second change (arrow,
  // thumbnail, keyboard) from starting mid-fade, the same guard
  // ArcCarousel's own click transition uses.
  const [prevPage, setPrevPage] = useState<number | null>(null);
  const transitioningRef = useRef(false);
  const mountedRef = useRef(false);
  const mainImgRef = useRef<HTMLImageElement>(null);
  const prevImgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (n: number) => {
      const clamped = Math.min(PAGE_COUNT, Math.max(1, n));
      if (clamped === page || transitioningRef.current) return;
      transitioningRef.current = true;
      setPrevPage(page);
      setPage(clamped);
      setPan({ x: 0, y: 0 });
    },
    [page]
  );

  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (prevPage === null) return;
    const mainImg = mainImgRef.current;
    const prevImg = prevImgRef.current;
    if (mainImg) gsap.set(mainImg, { opacity: 0, scale: 1.035 });
    if (prevImg) gsap.set(prevImg, { opacity: 1, scale: 1 });
    const tl = gsap.timeline({
      onComplete: () => {
        transitioningRef.current = false;
        setPrevPage(null);
      },
    });
    const dur = PAGE_TRANSITION_MS / 1000;
    if (prevImg) tl.to(prevImg, { opacity: 0, duration: dur, ease: "power2.inOut" }, 0);
    if (mainImg) tl.to(mainImg, { opacity: 1, scale: 1, duration: dur, ease: "power2.out" }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── ZOOM ─────────────────────────────────────────────────────────────
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || scale <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  // Re-clamping lives in these three handlers, not in an effect watching
  // `zoomIdx` — zoomIdx only ever changes here, so there's nothing an
  // effect would be "synchronizing with" that this doesn't already know
  // in the same event; clampPan already collapses to {0,0} at scale 1.
  const zoomIn = useCallback(() => {
    const next = Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1);
    setZoomIdx(next);
    setPan((p) => clampPan(p.x, p.y, ZOOM_LEVELS[next]));
  }, [zoomIdx, clampPan]);
  const zoomOut = useCallback(() => {
    const next = Math.max(0, zoomIdx - 1);
    setZoomIdx(next);
    setPan((p) => clampPan(p.x, p.y, ZOOM_LEVELS[next]));
  }, [zoomIdx, clampPan]);
  const resetZoom = useCallback(() => {
    setZoomIdx(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const dragState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (zoomIdx === 0) return;
    dragState.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    setPan(clampPan(dragState.current.panX + dx, dragState.current.panY + dy, zoom));
  };
  const onPointerUp = () => {
    dragState.current = null;
    setDragging(false);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (overviewOpen) {
        if (ev.key === "Escape") setOverviewOpen(false);
        return;
      }
      if (ev.key === "ArrowLeft") goTo(page - 1);
      else if (ev.key === "ArrowRight") goTo(page + 1);
      else if (ev.key === "Escape" && zoomIdx > 0) resetZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo, overviewOpen, zoomIdx, resetZoom]);

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ fontFamily: SANS, minHeight: "100dvh" }}
    >
      {/* ── TOP: Back + Other Publications strip ────────────────────── */}
      <div
        style={{
          padding: "clamp(20px, 3.5vh, 40px) clamp(20px, 4vw, 56px) clamp(28px, 4vh, 48px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Link
          href="/publications"
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

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
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
            </h2>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Other publications in this section
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[{ id: "sneh-sagar", title: "Sneh Sagar" }, ...others].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => p.id !== "sneh-sagar" && router.push(`/publications/${p.id}`)}
                aria-current={p.id === "sneh-sagar"}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "center",
                  width: 74,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: p.id === "sneh-sagar" ? "default" : "pointer",
                  color: "#fff",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 8,
                    overflow: "hidden",
                    border:
                      p.id === "sneh-sagar"
                        ? "1.5px solid rgba(255,255,255,0.6)"
                        : "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={COVER_SRC[p.id]}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    textAlign: "center",
                    color: p.id === "sneh-sagar" ? "#fff" : "rgba(255,255,255,0.55)",
                    lineHeight: 1.2,
                    maxWidth: 74,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}
                >
                  {p.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN VIEWER: title/metadata/description, then the page ──── */}
      <div
        style={{
          position: "relative",
          padding: "clamp(28px, 4.5vh, 56px) clamp(20px, 4vw, 56px)",
          display: "grid",
          gridTemplateColumns: "minmax(220px, 300px) minmax(0, 1fr)",
          gap: "clamp(24px, 4vw, 64px)",
          alignItems: "center",
        }}
        className="sneh-main-grid"
      >
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {String(page).padStart(2, "0")} / {String(PAGE_COUNT).padStart(2, "0")}
          </div>
        </div>

        {/* LEFT: title/metadata/description — no subtitle beneath the
            title, per the site-wide rule for every publication page, and
            this is the ONLY place the description appears on the page. */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 3.2vw, 46px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
            }}
          >
            Sneh Sagar
          </h1>
          <div style={{ marginTop: 18, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <dl style={{ margin: "18px 0 0", display: "grid", gap: 6 }}>
            {[
              ["Type", "Tribute Book"],
              ["Role", "Design"],
              ["Year", "2026"],
              ["Pages", `${PAGE_COUNT} selected`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <dt style={{ width: 86, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {k}
                </dt>
                <dd style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.68)",
              fontWeight: 300,
            }}
          >
            {DESCRIPTION}
          </p>
        </div>

        {/* RIGHT/CENTRE: the current page — substantially larger than the
            info column beside it, with its immediate neighbours softened
            behind it, prev/next arrows, and pan-while-zoomed. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            style={navArrowStyle("left")}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= PAGE_COUNT}
            aria-label="Next page"
            style={navArrowStyle("right")}
          >
            ›
          </button>

          <div
            style={{
              position: "relative",
              width: "min(100%, 64vh)",
              aspectRatio: String(PAGE_ASPECT),
            }}
          >
            {[page - 1, page + 1].map((n) =>
              n >= 1 && n <= PAGE_COUNT ? (
                <div
                  key={n}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "6%",
                    bottom: "6%",
                    [n < page ? "left" : "right"]: "-6%",
                    width: "94%",
                    borderRadius: 6,
                    overflow: "hidden",
                    filter: "blur(3px) brightness(0.55)",
                    zIndex: 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pageSrc(n)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : null
            )}
            <div
              ref={viewportRef}
              style={{
                position: "relative",
                zIndex: 2,
                width: "100%",
                height: "100%",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 0 90px rgba(255,255,255,0.05), 0 50px 120px rgba(0,0,0,0.8)",
                touchAction: zoomIdx > 0 ? "none" : "auto",
                cursor: zoomIdx > 0 ? (dragging ? "grabbing" : "grab") : "default",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {prevPage !== null && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={prevImgRef}
                  src={pageSrc(prevPage)}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    zIndex: 1,
                  }}
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={mainImgRef}
                src={pageSrc(page)}
                alt={`Sneh Sagar, page ${page}`}
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "50% 50%",
                  transition: dragging ? "none" : "transform 320ms ease",
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomIdx === 0}
              style={{ ...controlLinkStyle, opacity: zoomIdx === 0 ? 0.35 : 1, cursor: zoomIdx === 0 ? "default" : "pointer" }}
            >
              Zoom −
            </button>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", minWidth: 42, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              style={{
                ...controlLinkStyle,
                opacity: zoomIdx === ZOOM_LEVELS.length - 1 ? 0.35 : 1,
                cursor: zoomIdx === ZOOM_LEVELS.length - 1 ? "default" : "pointer",
              }}
            >
              Zoom +
            </button>
            {zoomIdx > 0 && (
              <button type="button" onClick={resetZoom} style={controlLinkStyle}>
                Fit
              </button>
            )}
          </div>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <button type="button" onClick={() => setOverviewOpen(true)} style={controlLinkStyle}>
            Overview
          </button>
        </div>
      </div>

      {/* ── LOWER: page-overview glimpse ─────────────────────────────── */}
      <div
        style={{
          padding: "0 clamp(20px, 4vw, 56px) clamp(48px, 7vh, 88px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 8,
          paddingTop: "clamp(28px, 4vh, 48px)",
        }}
      >
        <div style={sectionLabelStyle}>Overview</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 8,
            marginTop: 14,
            cursor: "pointer",
          }}
          onClick={() => setOverviewOpen(true)}
        >
          {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={n}
              src={pageSrc(n)}
              alt=""
              style={{ width: "100%", aspectRatio: String(PAGE_ASPECT), objectFit: "cover", borderRadius: 3, opacity: n === page ? 1 : 0.55 }}
            />
          ))}
        </div>
      </div>

      {/* ── OVERVIEW MODE ───────────────────────────────────────────── */}
      {overviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sneh Sagar — page overview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(4,4,5,0.97)",
            overflowY: "auto",
            padding: "clamp(24px, 4vh, 48px) clamp(20px, 4vw, 56px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
              Overview — {PAGE_COUNT} pages
            </div>
            <button type="button" onClick={() => setOverviewOpen(false)} style={controlLinkStyle}>
              Close ×
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
            {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  goTo(n);
                  setOverviewOpen(false);
                }}
                style={{
                  padding: 0,
                  border: n === page ? "1.5px solid rgba(255,255,255,0.7)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageSrc(n)} alt={`Page ${n}`} style={{ width: "100%", display: "block", aspectRatio: String(PAGE_ASPECT), objectFit: "cover" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .sneh-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function navArrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    [side]: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
}

const controlLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.75)",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
};
