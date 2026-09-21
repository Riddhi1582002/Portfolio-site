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
//   book              a set of selected pages, dragged through one at a time
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
// EVERY FORMAT IS READ ONE PAGE AT A TIME, and a page change is a
// horizontal slide — never a fold, a curl or a crossfade. Not one of
// these is a bound volume: Sneh Sagar is a set of selected pages, a
// brochure's page is a printed spread already, and a newsletter, a
// handbook and a policy document are read a sheet at a time. Pages can
// also be dragged through directly, which is the same slide under the
// reader's own hand.
//
// ZOOM AND NAVIGATION ARE INDEPENDENT ON PURPOSE. The controls, the
// arrows and the thumbnails all sit OUTSIDE the transformed surface, so
// zooming never takes navigation away: the reader can zoom in, turn the
// page, zoom further, and come back to fit without ever being trapped
// inside a modal that owns the whole screen.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import TransitionLink from "./TransitionLink";
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
// HOW EACH FORMAT TURNS.
//
// The move is the same idea for all of them — the artefact stays put and
// the next sheet is laid over it from its own edge — but the SIZE of it is
// a property of what is being read, and forcing one publication's motion
// onto the others is how a viewer stops belonging to the thing in it.
//
//   travel  how far the arriving sheet moves behind its own leading edge,
//           as a share of the stage's width. Small: this is the weight of
//           the sheet, not a journey across the screen.
//   lift    how much larger the arriving sheet starts. A printed spread
//           is lifted off the pile and set down, so it comes from slightly
//           nearer the reader; a single sheet barely does.
//   recede  how far the covered sheet settles back under it.
//   dim     how far the covered sheet falls into shadow.
type TurnProfile = { ms: number; travel: number; lift: number; recede: number; dim: number };

const TURN: Record<string, TurnProfile> = {
  // SNEH SAGAR — a set of selected pages, read one at a time. The book
  // holds absolutely still and the next page arrives across it: the least
  // travel of any of them, the least lift, and a shallow settle, so what
  // changes is the page and not the object.
  book: { ms: 560, travel: 0.06, lift: 1.0, recede: 0.988, dim: 0.62 },
  // BROCHURES — every supplied page is already a printed spread, and a
  // spread is a physically bigger thing to move. It comes off the pile
  // with a real lift and layers over the one before it; the covered spread
  // drops further back and further into shadow, which is the depth the
  // reference reads as.
  spreadCollection: { ms: 620, travel: 0.085, lift: 1.045, recede: 0.965, dim: 0.5 },
  // THE NEWSLETTER — a sheet, not a spread: a smaller lift than a
  // brochure, a longer edge travel than the book.
  page: { ms: 560, travel: 0.075, lift: 1.022, recede: 0.978, dim: 0.56 },
  // POLICY DOCUMENTS — read, not browsed. The quietest of the four: almost
  // no lift, the shortest travel, and the covered sheet barely moves.
  collection: { ms: 500, travel: 0.05, lift: 1.012, recede: 0.99, dim: 0.66 },
};

/** One thing the reader looks at. A brochure's page is already a printed
 *  spread, so a "page" here is always exactly one supplied image. */
type View = { pages: string[]; labels: number[] };

function buildViews(doc: PublicationDoc): View[] {
  return doc.pages.map((p, i) => ({ pages: [p], labels: [i + 1] }));
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
  // The ACTIVE DOCUMENT decides its own page shape, falling back to the
  // publication's kind where it does not say — see `doc` in
  // publicationsContent. A collection can hold both a landscape spread and
  // a portrait sheet, and this is the line that stops one of them being
  // drawn in the other's frame.
  const isWidePage = activeDoc?.wide ?? content?.viewer.kind === "spreadCollection";
  /** This publication's own page change — see TURN. */
  const turn = TURN[content?.viewer.kind ?? "page"] ?? TURN.page;

  const views = useMemo(() => (activeDoc ? buildViews(activeDoc) : []), [activeDoc]);

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
  const viewIndexRef = useRef(viewIndex);
  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);

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

  // THE PAGE CHANGE: A SHEET IS LAID OVER THE ONE BEFORE IT.
  //
  // What this replaces sent both sheets travelling most of the stage's
  // width in opposite directions. Whatever the easing, a whole picture
  // leaving the frame while another arrives is a slideshow: the artefact
  // itself moves, so there is nothing for the reader to hold on to, and
  // nothing about it says these two pages belong to one object.
  //
  // The artefact is ANCHORED now, and the change happens at its EDGE. The
  // incoming sheet is uncovered from its leading edge — a clip that opens
  // across it — with a short travel behind that edge so it reads as being
  // laid down rather than dissolved in. The outgoing sheet does not go
  // anywhere: it settles back a little and falls into shadow as the new
  // one covers it. That is what turning to the next page in a physical
  // document looks like, and it keeps the page in exactly the same place
  // on screen throughout, which is what makes the reading position hold.
  //
  // No rotation, no fold, no curl. Not one of these is a bound volume —
  // Sneh Sagar is a set of selected pages, a brochure's page is a printed
  // spread already, and a newsletter, a handbook and a policy document are
  // read a sheet at a time — so a page-curl would be a metaphor for
  // something that is not there.
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!prevView) return;
    const incoming = currentLayerRef.current;
    const outgoing = prevLayerRef.current;
    const dir = prevView.dir;
    const done = () => {
      turningRef.current = false;
      setPrevView(null);
      if (incoming) gsap.set(incoming, { clearProps: "clipPath,transform,filter" });
    };
    if (!incoming && !outgoing) {
      done();
      return;
    }
    const width = stageRef.current?.getBoundingClientRect().width ?? 600;
    const tl = gsap.timeline({ onComplete: done });
    const dur = turn.ms / 1000;
    if (outgoing) {
      // Stays put. Only settles back and darkens, which is what being
      // covered by something looks like.
      gsap.set(outgoing, { x: 0, zIndex: 2, scale: 1, filter: "brightness(1)" });
      tl.to(
        outgoing,
        {
          scale: turn.recede,
          filter: `brightness(${turn.dim})`,
          duration: dur,
          ease: "power2.out",
        },
        0
      );
    }
    if (incoming) {
      // Leading edge first: coming from the right (dir 1), the sheet is
      // uncovered from ITS right edge inward, so the edge that arrives is
      // the edge you would see arriving.
      const closed = dir === 1 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)";
      gsap.set(incoming, {
        zIndex: 3,
        clipPath: closed,
        x: dir === 1 ? width * turn.travel : -width * turn.travel,
        scale: turn.lift,
        transformOrigin: "50% 50%",
      });
      tl.to(
        incoming,
        {
          clipPath: "inset(0% 0% 0% 0%)",
          x: 0,
          scale: 1,
          duration: dur,
          ease: "power3.out",
        },
        0
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

  // ONE POINTER, TWO JOBS, decided by whether the page is zoomed: zoomed
  // in, a drag pans the page; at fit, it pulls the page across to the next
  // one. Both are the same gesture doing the obvious thing at that zoom.
  const dragState = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    paging: boolean;
    moved: number;
  } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (turningRef.current) return;
    dragState.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      paging: zoomIdx === 0,
      moved: 0,
    };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    d.moved = dx;
    if (d.paging) {
      // The current page follows the hand, so the slide that finishes the
      // gesture is continuous with it rather than a separate animation.
      if (currentLayerRef.current) // DAMPED, and heavily. The sheet is anchored; a drag is the reader
      // taking hold of its edge, not pushing the whole document across the
      // desk. It moves enough to answer the hand and no further, and the
      // change itself happens on release.
      gsap.set(currentLayerRef.current, {
        x: Math.max(-72, Math.min(72, dx * 0.26)),
      });
      return;
    }
    setPan(clampPan(d.panX + dx, d.panY + (e.clientY - d.y), zoom));
  };
  const endDrag = () => {
    const d = dragState.current;
    dragState.current = null;
    setDragging(false);
    if (!d?.paging) return;
    const rect = stageRef.current?.getBoundingClientRect();
    const threshold = Math.max(40, (rect?.width ?? 400) * 0.12);
    if (Math.abs(d.moved) > threshold) {
      goToView(viewIndexRef.current + (d.moved < 0 ? 1 : -1));
    } else if (currentLayerRef.current) {
      // Not far enough: it settles back where it was.
      gsap.to(currentLayerRef.current, { x: 0, duration: 0.32, ease: "power2.out" });
    }
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
          <TransitionLink href="/publications" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>

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
                        // Each document's OWN shape, so a portrait cover
                        // in a collection of spreads is not reserved a
                        // landscape box and letterboxed into it.
                        aspectRatio:
                          (d.wide ?? content.viewer.kind === "spreadCollection")
                            ? "3 / 2"
                            : "1 / 1.414",
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
                touchAction: "pan-y",
                cursor: dragging ? "grabbing" : "grab",
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
