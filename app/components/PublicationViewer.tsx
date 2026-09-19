"use client";

// ONE PUBLICATION'S OWN PAGE — and one viewer that takes the shape of
// whatever it is looking at.
//
// The editorial frame is identical for all five (left rail: back, number,
// title, description, metadata, and — where there is more than one
// document — the document list; main: the artefact large, its own
// prev/next, a thumbnail strip of what it actually contains, and the zoom
// controls). What changes is the ARTEFACT, because the right way to read
// one is a property of the thing itself:
//
//   book              a cover, then facing-page spreads, turned like pages
//   page              one portrait page at a time
//   collection        several documents, each read a page at a time
//   spreadCollection  several documents whose every supplied page is
//                     ALREADY one printed spread (back cover left, front
//                     cover right), so a "page" here is never split in two
//
// Every image on screen is a supplied page, rasterised from the supplied
// PDF. Nothing is recreated, re-typeset or reordered, and no metadata line
// exists that the approved copy did not give.
//
// ZOOM AND NAVIGATION ARE INDEPENDENT ON PURPOSE. The controls, the
// arrows and the thumbnails all sit OUTSIDE the transformed surface, so
// zooming never takes navigation away: the reader can zoom in, turn the
// page, zoom further, and come back to fit without ever being trapped
// inside a modal that owns the whole screen.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  COVER_SRC,
  PUBLICATION_CONTENT,
  PUBLICATION_ORDER,
  type PublicationDoc,
} from "./publicationsContent";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** Deep enough to read set type on a rasterised A4 page, not just to peer. */
const ZOOM_LEVELS = [1, 1.6, 2.4, 3.6, 5];
const TURN_MS = 620;

/** One thing the reader looks at: a single page, or a facing pair. */
type View = { pages: string[]; labels: number[] };

function buildViews(doc: PublicationDoc, kind: "book" | "single"): View[] {
  if (kind === "single") {
    return doc.pages.map((p, i) => ({ pages: [p], labels: [i + 1] }));
  }
  // A bound book: the cover stands alone, then every following pair of
  // pages faces each other exactly as they do in the object itself.
  const views: View[] = [{ pages: [doc.pages[0]], labels: [1] }];
  for (let i = 1; i < doc.pages.length; i += 2) {
    const pair = doc.pages.slice(i, i + 2);
    views.push({ pages: pair, labels: pair.map((_, k) => i + k + 1) });
  }
  return views;
}

export default function PublicationViewer({ slug }: { slug: string }) {
  const router = useRouter();
  const content = PUBLICATION_CONTENT[slug];

  // ── WHICH DOCUMENT ────────────────────────────────────────────────────
  const docs = useMemo<PublicationDoc[]>(() => {
    if (!content) return [];
    const v = content.viewer;
    return v.kind === "collection" || v.kind === "spreadCollection" ? v.docs : [v.doc];
  }, [content]);
  const [docIndex, setDocIndex] = useState(0);
  const activeDoc = docs[docIndex];
  const isCollection =
    content?.viewer.kind === "collection" || content?.viewer.kind === "spreadCollection";
  const isBook = content?.viewer.kind === "book";
  // A brochure page is a printed spread already, so it is drawn wide;
  // a book's facing pair is drawn as two pages meeting at a gutter.
  const isWidePage = content?.viewer.kind === "spreadCollection";

  const views = useMemo(
    () => (activeDoc ? buildViews(activeDoc, isBook ? "book" : "single") : []),
    [activeDoc, isBook]
  );

  const [viewIndex, setViewIndex] = useState(0);
  const [prevView, setPrevView] = useState<{ view: View; dir: 1 | -1 } | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const turningRef = useRef(false);
  const mountedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const currentLayerRef = useRef<HTMLDivElement>(null);
  const prevLayerRef = useRef<HTMLDivElement>(null);

  const view = views[viewIndex];

  // ── TURNING ───────────────────────────────────────────────────────────
  const goToView = useCallback(
    (next: number) => {
      if (!views.length) return;
      const clamped = Math.min(views.length - 1, Math.max(0, next));
      if (clamped === viewIndex || turningRef.current) return;
      turningRef.current = true;
      setPrevView({ view: views[viewIndex], dir: clamped > viewIndex ? 1 : -1 });
      setViewIndex(clamped);
      setPan({ x: 0, y: 0 });
    },
    [viewIndex, views]
  );

  // The turn itself. Not a crossfade: the outgoing leaf swings away around
  // the gutter while the incoming one swings in from the other side, which
  // is what makes a page change read as the object moving rather than as
  // one picture being replaced by another. Single-page and spread formats
  // use the same move with a shallower angle, so the whole system feels
  // like one publication family rather than two viewers.
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!prevView) return;
    const incoming = currentLayerRef.current;
    const outgoing = prevLayerRef.current;
    const dir = prevView.dir;
    const swing = isBook ? 52 : 26;
    const done = () => {
      turningRef.current = false;
      setPrevView(null);
    };
    if (!incoming && !outgoing) {
      done();
      return;
    }
    const tl = gsap.timeline({ onComplete: done });
    const dur = TURN_MS / 1000;
    if (outgoing) {
      gsap.set(outgoing, {
        transformOrigin: dir === 1 ? "0% 50%" : "100% 50%",
        zIndex: 3,
      });
      tl.to(
        outgoing,
        { rotateY: dir === 1 ? -swing : swing, opacity: 0, duration: dur * 0.62, ease: "power2.in" },
        0
      );
    }
    if (incoming) {
      gsap.set(incoming, {
        transformOrigin: dir === 1 ? "100% 50%" : "0% 50%",
        rotateY: dir === 1 ? swing * 0.7 : -swing * 0.7,
        opacity: 0,
        zIndex: 2,
      });
      tl.to(
        incoming,
        { rotateY: 0, opacity: 1, duration: dur * 0.8, ease: "power2.out" },
        dur * 0.2
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewIndex, docIndex]);

  // Switching documents inside a collection starts that document at its
  // own first page rather than carrying the previous one's position over.
  const selectDoc = useCallback(
    (i: number) => {
      if (i === docIndex) return;
      setPrevView(views[viewIndex] ? { view: views[viewIndex], dir: 1 } : null);
      setDocIndex(i);
      setViewIndex(0);
      setPan({ x: 0, y: 0 });
      turningRef.current = true;
    },
    [docIndex, viewIndex, views]
  );

  // ── ZOOM + PAN ────────────────────────────────────────────────────────
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  const setZoom = useCallback(
    (next: number) => {
      const clamped = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, next));
      setZoomIdx(clamped);
      setPan((p) => clampPan(p.x, p.y, ZOOM_LEVELS[clamped]));
    },
    [clampPan]
  );

  const dragState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (zoomIdx === 0) return;
    dragState.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    setPan(clampPan(d.panX + (e.clientX - d.x), d.panY + (e.clientY - d.y), zoom));
  };
  const endDrag = () => {
    dragState.current = null;
    setDragging(false);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (overviewOpen) {
        if (ev.key === "Escape") setOverviewOpen(false);
        return;
      }
      if (ev.key === "ArrowLeft") goToView(viewIndex - 1);
      else if (ev.key === "ArrowRight") goToView(viewIndex + 1);
      else if (ev.key === "Escape" && zoomIdx > 0) setZoom(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToView, viewIndex, zoomIdx, setZoom, overviewOpen]);

  if (!content || !activeDoc || !view) return null;

  const others = PUBLICATION_ORDER.filter((id) => id !== slug);
  const number = String(PUBLICATION_ORDER.indexOf(slug as never) + 1).padStart(2, "0");
  const metadata: [string, string][] = [
    ["Type", content.type],
    ...(content.madeFor ? ([["Made for", content.madeFor]] as [string, string][]) : []),
    ...(content.year ? ([["Year", content.year]] as [string, string][]) : []),
    ...(content.pages ? ([["Pages", content.pages]] as [string, string][]) : []),
  ];

  const pageLabel = view.labels.length > 1
    ? `${String(view.labels[0]).padStart(2, "0")}–${String(view.labels[view.labels.length - 1]).padStart(2, "0")}`
    : String(view.labels[0]).padStart(2, "0");

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    backfaceVisibility: "hidden",
  };

  const renderPages = (v: View) => (
    <>
      {v.pages.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${activeDoc.title}, page ${v.labels[i]}`}
          draggable={false}
          style={{
            height: "100%",
            width: "auto",
            maxWidth: v.pages.length > 1 ? "50%" : "100%",
            objectFit: "contain",
            display: "block",
            // The gutter: two facing pages meet, and the inner edge of
            // each carries the shadow a real spine casts.
            boxShadow:
              v.pages.length > 1
                ? i === 0
                  ? "inset -26px 0 40px -28px rgba(0,0,0,0.85), 0 40px 90px rgba(0,0,0,0.7)"
                  : "inset 26px 0 40px -28px rgba(0,0,0,0.85), 0 40px 90px rgba(0,0,0,0.7)"
                : "0 40px 100px rgba(0,0,0,0.75)",
          }}
        />
      ))}
    </>
  );

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ fontFamily: SANS, minHeight: "100dvh" }}
    >
      {/* One viewport tall, and the reading surface never scrolls away:
          the rail takes its own scrollbar when a collection's document
          list makes it taller than the screen, rather than pushing the
          publication itself off the bottom. Below 900px the shell is a
          normal stacked document again — see the media query. */}
      <div className="pub-shell" style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
        {/* ── LEFT RAIL ─────────────────────────────────────────────── */}
        <aside
          className="pub-rail"
          style={{
            width: "clamp(270px, 27vw, 380px)",
            flex: "0 0 auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "clamp(20px, 3.4vh, 38px) clamp(20px, 2.2vw, 36px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          <Link href="/publications" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </Link>

          <div>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>{number}</div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(26px, 2.4vw, 40px)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.08,
              }}
            >
              {content.title}
            </h1>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              fontWeight: 300,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {content.description}
          </p>

          <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

          <dl style={{ margin: 0, display: "grid", gap: 7 }}>
            {metadata.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <dt style={{ width: 82, flex: "0 0 auto", ...eyebrowStyle }}>{k}</dt>
                <dd style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>{v}</dd>
              </div>
            ))}
          </dl>

          {isCollection && (
            <div>
              <div style={{ ...eyebrowStyle, marginBottom: 12 }}>
                Select a {content.viewer.kind === "spreadCollection" ? "brochure" : "document"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {docs.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => selectDoc(i)}
                    aria-current={i === docIndex}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "#fff",
                      textAlign: "left",
                      width: 92,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: "100%",
                        aspectRatio: content.viewer.kind === "spreadCollection" ? "3 / 2" : "1 / 1.414",
                        overflow: "hidden",
                        borderRadius: 3,
                        border:
                          i === docIndex
                            ? "1.5px solid rgba(255,255,255,0.75)"
                            : "1px solid rgba(255,255,255,0.14)",
                        background: "#111",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.pages[0]}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                      />
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 7,
                        fontSize: 11.5,
                        color: i === docIndex ? "#fff" : "rgba(255,255,255,0.55)",
                        lineHeight: 1.3,
                      }}
                    >
                      {d.title}
                      <span style={{ display: "block", color: "rgba(255,255,255,0.38)" }}>
                        {d.pageCount} pages
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "auto" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>Other publications</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {others.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => router.push(`/publications/${id}`)}
                  aria-label={PUBLICATION_CONTENT[id]?.title}
                  title={PUBLICATION_CONTENT[id]?.title}
                  style={{
                    width: 42,
                    height: 42,
                    padding: 0,
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "#111",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={COVER_SRC[id]}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── MAIN ──────────────────────────────────────────────────── */}
        <main
          className="pub-main"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "clamp(20px, 3.4vh, 38px) clamp(18px, 3vw, 48px) clamp(18px, 2.6vh, 30px)",
            gap: "clamp(12px, 2vh, 22px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
            <div>
              <div style={{ fontSize: "clamp(15px, 1.4vw, 21px)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {activeDoc.title}
              </div>
              <div style={{ ...eyebrowStyle, marginTop: 4 }}>
                {activeDoc.pageCount} pages
              </div>
            </div>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>
              {pageLabel} / {String(activeDoc.pageCount).padStart(2, "0")}
            </div>
          </div>

          {/* THE ARTEFACT. Arrows sit outside the zoom surface so they
              keep working at every zoom level. */}
          <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => goToView(viewIndex - 1)}
              disabled={viewIndex <= 0}
              aria-label="Previous page"
              style={arrowStyle("left", viewIndex <= 0)}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goToView(viewIndex + 1)}
              disabled={viewIndex >= views.length - 1}
              aria-label="Next page"
              style={arrowStyle("right", viewIndex >= views.length - 1)}
            >
              ›
            </button>

            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                maxWidth: isWidePage ? "min(100%, 150vh)" : isBook ? "min(100%, 132vh)" : "min(100%, 62vh)",
                margin: "0 auto",
                overflow: "hidden",
                perspective: 2200,
                touchAction: zoomIdx > 0 ? "none" : "auto",
                cursor: zoomIdx > 0 ? (dragging ? "grabbing" : "grab") : "default",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformStyle: "preserve-3d",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "50% 50%",
                  transition: dragging ? "none" : "transform 340ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                {prevView && (
                  <div ref={prevLayerRef} style={layerStyle}>
                    {renderPages(prevView.view)}
                  </div>
                )}
                <div ref={currentLayerRef} style={layerStyle}>
                  {renderPages(view)}
                </div>
              </div>
            </div>
          </div>

          {/* CONTROLS + THUMBNAILS. Both outside the zoom surface. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setZoom(zoomIdx - 1)}
              disabled={zoomIdx === 0}
              style={{ ...controlStyle, opacity: zoomIdx === 0 ? 0.35 : 1 }}
            >
              Zoom −
            </button>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", minWidth: 46, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(zoomIdx + 1)}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              style={{ ...controlStyle, opacity: zoomIdx === ZOOM_LEVELS.length - 1 ? 0.35 : 1 }}
            >
              Zoom +
            </button>
            {zoomIdx > 0 && (
              <button type="button" onClick={() => setZoom(0)} style={controlStyle}>
                Fit
              </button>
            )}
            <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
            <button type="button" onClick={() => setOverviewOpen(true)} style={controlStyle}>
              Overview
            </button>
            {zoomIdx > 0 && (
              <span style={{ ...eyebrowStyle, color: "rgba(255,255,255,0.35)" }}>
                Navigation works while zoomed
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "none",
            }}
          >
            {views.map((v, i) => (
              <button
                key={v.pages.join("|")}
                type="button"
                onClick={() => goToView(i)}
                aria-label={`Go to page ${v.labels.join("–")}`}
                aria-current={i === viewIndex}
                style={{
                  flex: "0 0 auto",
                  padding: 0,
                  background: "none",
                  borderRadius: 3,
                  overflow: "hidden",
                  cursor: "pointer",
                  border:
                    i === viewIndex
                      ? "1.5px solid rgba(255,255,255,0.8)"
                      : "1px solid rgba(255,255,255,0.12)",
                  opacity: i === viewIndex ? 1 : 0.62,
                  height: "clamp(56px, 9vh, 92px)",
                  display: "flex",
                }}
              >
                {v.pages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    style={{ height: "100%", width: "auto", display: "block" }}
                  />
                ))}
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────── */}
      {overviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeDoc.title} — overview`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(4,4,5,0.97)",
            overflowY: "auto",
            padding: "clamp(24px, 4vh, 48px) clamp(20px, 4vw, 56px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div style={eyebrowStyle}>
              {activeDoc.title} — {activeDoc.pageCount} pages
            </div>
            <button type="button" onClick={() => setOverviewOpen(false)} style={controlStyle}>
              Close ×
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${isWidePage ? 220 : 130}px, 1fr))`,
              gap: 14,
            }}
          >
            {views.map((v, i) => (
              <button
                key={v.pages.join("|")}
                type="button"
                onClick={() => {
                  goToView(i);
                  setOverviewOpen(false);
                }}
                style={{
                  padding: 0,
                  background: "none",
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  display: "flex",
                  border:
                    i === viewIndex
                      ? "1.5px solid rgba(255,255,255,0.7)"
                      : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {v.pages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" style={{ width: "100%", display: "block", minWidth: 0 }} />
                ))}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .pub-shell ::-webkit-scrollbar { width: 0; height: 0; }
        @media (max-width: 900px) {
          .pub-shell {
            flex-direction: column !important;
            height: auto !important;
            min-height: 100dvh;
            overflow: visible !important;
          }
          .pub-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            overflow: visible !important;
          }
          .pub-main { min-height: 78dvh; }
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
  color: "rgba(255,255,255,0.75)",
};

function arrowStyle(side: "left" | "right", disabled: boolean): React.CSSProperties {
  return {
    position: "absolute",
    [side]: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 4,
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
