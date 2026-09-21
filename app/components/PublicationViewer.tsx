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
import { createPageBend, type PageBendHandle } from "./pageBend";
import {
  COVER_SRC,
  PUBLICATION_CONTENT,
  PUBLICATION_ORDER,
  type PublicationDoc,
} from "./publicationsContent";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** Deep enough to read set type on a rasterised A4 page, not just to peer. */
const ZOOM_LEVELS = [1, 1.6, 2.4, 3.6, 5];
// HOW MUCH EACH FORMAT BENDS.
//
// The motion is the same for all of them — the sheet pivots on its spine
// and curves away — but HOW FAR it curves is a property of the paper. A
// printed spread off a brochure is a bigger, floppier thing than a policy
// sheet, and giving them all one number is how a viewer stops belonging
// to the thing inside it.
//
//   beta    peak curl in radians, at the middle of the turn. Small
//           numbers read as stiff card; larger ones as a limp page.
type BendProfile = { beta: number };

const BEND: Record<string, BendProfile> = {
  // SNEH SAGAR — selected pages of a tribute book, held flat and turned
  // with care. Barely more than a stiffened lift.
  book: { beta: 0.32 },
  // BROCHURES — every supplied page is already a printed spread, and a
  // spread is the largest, most flexible sheet here. It carries the
  // deepest curl of the four.
  spreadCollection: { beta: 0.42 },
  // THE NEWSLETTER — a sheet, not a spread.
  page: { beta: 0.36 },
  // POLICY DOCUMENTS — read, not browsed. The stiffest and quietest.
  collection: { beta: 0.3 },
};

/** A turn in flight. `auto` marks one started by an arrow or a key, which
 *  commits itself; a dragged turn waits for the hand to let go. */
type Turn = { dir: 1 | -1; from: number; to: number; auto: boolean };

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
  /** This publication's own curl — see BEND. */
  const bendProfile = BEND[content?.viewer.kind ?? "page"] ?? BEND.page;

  const views = useMemo(() => (activeDoc ? buildViews(activeDoc) : []), [activeDoc]);

  const [viewIndex, setViewIndex] = useState(0);
  const [turn_, setTurn] = useState<Turn | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const turningRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const currentLayerRef = useRef<HTMLDivElement>(null);
  /** The 3D context the bending leaf is added to. */
  const layerHostRef = useRef<HTMLDivElement>(null);
  const bendRef = useRef<PageBendHandle | null>(null);
  /** The live turn position, kept off React so a drag can write it every
   *  frame without re-rendering the page underneath. */
  const tRef = useRef(0);
  const turnRef = useRef<Turn | null>(null);

  const view = views[viewIndex];
  // While a turn is in flight the page on the stage is not necessarily the
  // current one — see the turn block below.
  const beneathView =
    (turn_ ? views[turn_.dir === 1 ? turn_.to : turn_.from] : view) ?? view;
  const viewIndexRef = useRef(viewIndex);
  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);

  // ── TURNING: THE SHEET ACTUALLY BENDS ─────────────────────────────────
  //
  // What this replaces slid the incoming page in behind an opening clip.
  // It was honest about POSITION — the artefact never moved — but a sheet
  // that arrives by being un-masked is not a sheet arriving. It had no
  // thickness and no reverse, and at any speed it read as a slideshow
  // wipe laid over a photograph of a page.
  //
  // The leaf is a real curved surface now. The geometry is in pageBend.ts,
  // adapted from Meng To's Sketchbook: a chain of nested strips whose
  // tangent sweeps through an arc, so the page bends progressively across
  // its width instead of pivoting like a flat door. What matters here is
  // that the leaf pivots on the SPINE — its left edge — which gives the
  // two directions their shapes:
  //
  //   next   the outgoing page IS the leaf. It bends away to the left and
  //          uncovers the incoming page, which was lying beneath it all
  //          along.
  //   prev   the incoming page is the leaf, starting folded back off-frame
  //          and coming down over the page being left behind.
  //
  // One number drives both. `t` runs 0 (flat over the page) to 1 (turned
  // fully away), forward for next and backward for prev, which is why a
  // drag can be handed straight to it and why commit and revert are the
  // same tween to different ends.
  //
  // THE REVERSE CARRIES THE OTHER PAGE. The back of the sheet you are
  // turning is the next page of the document — these are printed pages in
  // order, so that is literally true — and pageBend samples it from the
  // opposite edge so it reads the right way round once flipped. Past 90
  // degrees the leaf lies to the left of the spine and the stage's own
  // overflow clips it, which is what stops the incoming page ever being
  // visible twice at once.
  const beginTurn = useCallback(
    (dir: 1 | -1, auto: boolean) => {
      if (turningRef.current) return false;
      const from = viewIndexRef.current;
      const to = from + dir;
      if (to < 0 || to >= views.length) return false;
      turningRef.current = true;
      tRef.current = dir === 1 ? 0 : 1;
      const t: Turn = { dir, from, to, auto };
      // Written here, not in an effect: useLayoutEffect builds the leaf
      // and may commit it in the same tick, and it reads this.
      turnRef.current = t;
      setTurn(t);
      return true;
    },
    [views.length]
  );

  /** Run the turn to its end (commit) or back where it came from. */
  const settle = useCallback((commit: boolean) => {
    const t = turnRef.current;
    if (!t) return;
    const bend = bendRef.current;
    const target = commit === (t.dir === 1) ? 1 : 0;
    const finish = () => {
      if (commit) {
        setViewIndex(t.to);
        viewIndexRef.current = t.to;
        setPan({ x: 0, y: 0 });
      }
      turnRef.current = null;
      setTurn(null);
      turningRef.current = false;
    };
    if (!bend) {
      finish();
      return;
    }
    const o = { v: tRef.current };
    gsap.to(o, {
      v: target,
      // Whatever is left of the turn, at a steady tempo — a page half
      // pulled over should not take as long as one starting from flat.
      duration: Math.max(0.26, Math.abs(target - o.v) * 0.66),
      ease: "power3.out",
      onUpdate: () => {
        tRef.current = o.v;
        bend.setT(o.v);
      },
      onComplete: finish,
    });
  }, []);

  // THE LEAF ITSELF. Built once per turn, from the page box the beneath
  // layer is actually rendering at — measured in layout coordinates, not
  // screen ones, so it stays correct while the stage is zoomed.
  useLayoutEffect(() => {
    if (!turn_) return;
    const host = layerHostRef.current;
    const img = currentLayerRef.current?.querySelector("img");
    const frontSrc = (turn_.dir === 1 ? views[turn_.from] : views[turn_.to])?.pages[0];
    const backSrc = (turn_.dir === 1 ? views[turn_.to] : views[turn_.from])?.pages[0];
    if (!host || !(img instanceof HTMLImageElement) || !frontSrc || !backSrc) {
      turningRef.current = false;
      turnRef.current = null;
      setTurn(null);
      return;
    }
    const bend = createPageBend({
      host,
      x: img.offsetLeft,
      y: img.offsetTop,
      width: img.offsetWidth,
      height: img.offsetHeight,
      frontSrc,
      backSrc,
      beta: bendProfile.beta,
      zIndex: 6,
    });
    bend.setT(tRef.current);
    bendRef.current = bend;
    if (turn_.auto) settle(true);
    return () => {
      bend.destroy();
      bendRef.current = null;
    };
  }, [turn_, views, settle, bendProfile.beta]);

  const goToView = useCallback(
    (next: number) => {
      if (!views.length || turningRef.current) return;
      const clamped = Math.min(views.length - 1, Math.max(0, next));
      const cur = viewIndexRef.current;
      if (clamped === cur) return;
      if (Math.abs(clamped - cur) === 1) {
        beginTurn(clamped > cur ? 1 : -1, true);
        return;
      }
      // A jump of more than one page is not a page turn. Bending a single
      // sheet to cross ten of them would be a lie about the document, so
      // the thumbnails and the overview simply go there.
      setViewIndex(clamped);
      viewIndexRef.current = clamped;
      setPan({ x: 0, y: 0 });
    },
    [views.length, beginTurn]
  );

  // Switching documents inside a collection starts that document at its
  // own first page rather than carrying the previous one's position over.
  const selectDoc = useCallback(
    (i: number) => {
      if (i === docIndex || turningRef.current) return;
      // Not a page turn — a different document. Bending a sheet out of one
      // brochure into another would claim they are bound together.
      setDocIndex(i);
      setViewIndex(0);
      viewIndexRef.current = 0;
      setPan({ x: 0, y: 0 });
    },
    [docIndex]
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
  // in, a drag pans the page; at fit, it takes hold of the sheet's edge
  // and bends it. Both are the same gesture doing the obvious thing at
  // that zoom.
  //
  // THE HAND DRIVES THE TURN DIRECTLY. The drag does not "trigger" an
  // animation when it ends — it writes the leaf's angle every frame, and
  // letting go only decides which end the remainder runs to. Which half
  // of the page was grabbed picks the direction, the way it does on a
  // real one.
  const panRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragRef = useRef<{
    dir: 1 | -1;
    x0: number;
    w: number;
    moved: number;
    vel: number;
    tPrev: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoomIdx > 0) {
      panRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (turningRef.current) return;
    // No text selection and no native image drag: either one makes the
    // browser cancel the pointer mid-gesture and take the turn with it.
    e.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const dir: 1 | -1 = (e.clientX - rect.left) / rect.width > 0.5 ? 1 : -1;
    if (!beginTurn(dir, false)) return;
    dragRef.current = {
      dir,
      x0: e.clientX,
      w: rect.width,
      moved: 0,
      vel: 0,
      tPrev: performance.now(),
    };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pr = panRef.current;
    if (pr) {
      setPan(clampPan(pr.panX + (e.clientX - pr.x), pr.panY + (e.clientY - pr.y), zoom));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    // Pulling left turns forward. The leaf follows the hand across about
    // two thirds of the page's width, so a full turn is a deliberate
    // gesture rather than a flick of the wrist.
    const adv = Math.max(0, Math.min(1, (d.dir === 1 ? -dx : dx) / (d.w * 0.62)));
    const t = d.dir === 1 ? adv : 1 - adv;
    const now = performance.now();
    d.vel = (t - tRef.current) / Math.max(0.001, (now - d.tPrev) / 1000);
    d.tPrev = now;
    tRef.current = t;
    bendRef.current?.setT(t);
  };

  const endDrag = () => {
    if (panRef.current) {
      panRef.current = null;
      setDragging(false);
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    setDragging(false);
    // A tap on one side of the page turns it, the way tapping the edge of
    // a book does.
    if (d.moved < 6) {
      settle(true);
      return;
    }
    // Past the halfway mark, or thrown hard enough that stopping it would
    // feel like the page being taken back out of your hand.
    const progress = d.dir === 1 ? tRef.current : 1 - tRef.current;
    const speed = d.dir === 1 ? d.vel : -d.vel;
    settle(progress > 0.42 || (speed > 1.1 && progress > 0.12));
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
          <div
            className="pub-stagerow"
            style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
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
              className="pub-stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              onDragStart={(e) => e.preventDefault()}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                maxWidth: isWidePage ? "min(100%, 150vh)" : isBook ? "min(100%, 132vh)" : "min(100%, 62vh)",
                margin: "0 auto",
                overflow: "hidden",
                perspective: 2200,
                touchAction: "pan-y",
                userSelect: "none",
                WebkitUserSelect: "none",
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
                ref={layerHostRef}
              >
                {/* ONE PAGE IS DRAWN, and it is whichever one is lying
                    underneath the leaf: the page being turned TO while
                    going forward, the page being left behind while going
                    back. The leaf itself is not React's — pageBend adds it
                    to this same 3D context, because a drag writes its
                    angle every frame and nothing here should re-render. */}
                <div ref={currentLayerRef} style={layerStyle}>
                  {renderPages(beneathView)}
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
          /* !important, like every other rule in this block, because
             .pub-main carries an inline min-height of 0 — the thing that
             lets it shrink inside the desktop flex column. A stylesheet
             rule loses to that, so without this the main column had no
             height at all on a phone, the artefact row collapsed to zero
             and the page being read was invisible. */
          .pub-main { min-height: 78dvh !important; }
          /* AND THE ROW INSIDE IT NEEDS A HEIGHT OF ITS OWN. The stage is
             height:100%, which against an auto-height parent resolves to
             nothing, and the page image inside is height:100% of THAT — so
             the whole artefact collapsed to a zero-high box and a reader on
             a phone saw the rail, the controls and the thumbnails with
             nothing between them. Growing to fill the column only works
             while the column has spare room to give. */
          .pub-stagerow { min-height: 56dvh !important; }
          /* The stage is told its height outright rather than inheriting a
             percentage of a row that only has a MIN height: a percentage
             against a parent whose height is still auto resolves to auto,
             which is the collapse described above all over again. */
          .pub-stage { height: 56dvh !important; }
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
