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
// TWO WAYS OF READING, decided by what the thing physically is:
//
//   IMAGE CAROUSEL — Sneh Sagar, ExcelEDGE, the handbook, the policy
//   documents, and any single-sheet document. The pages sit side by side
//   on one track and slide; a drag moves the track under the hand and
//   lets go onto the nearest page. No fold, no curl, no crossfade.
//
//   BOOKLET — the company brochures only. Each is a set of two-page
//   printed spreads, the first of which is the outside of the sheet: back
//   cover LEFT, front cover RIGHT. So the booklet opens closed on the
//   right half of that first spread alone; each leaf turns over on the
//   central spine; and after the last interior spread the last leaf
//   closes it onto the left half of the same first spread — the back
//   cover. Cover, interiors, back cover: the order a folded sheet has.
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

/** One thing the reader looks at: one supplied image — or, in a brochure
 *  booklet, one HALF of a supplied spread (the covers). */
type View = { pages: string[]; labels: number[]; half?: "left" | "right" };

function buildViews(doc: PublicationDoc): View[] {
  return doc.pages.map((p, i) => ({ pages: [p], labels: [i + 1] }));
}

// ── THE BOOKLET ─────────────────────────────────────────────────────────
//
// States 0..N for N supplied spreads: 0 is closed on its front cover
// (right half of spread 1), k is lying open at spread k+1, N is closed on
// its back cover (left half of spread 1).
function buildBookletViews(doc: PublicationDoc): View[] {
  const n = doc.pages.length;
  const v: View[] = [{ pages: [doc.pages[0]], labels: [1], half: "right" }];
  for (let k = 1; k < n; k++) v.push({ pages: [doc.pages[k]], labels: [k + 1] });
  v.push({ pages: [doc.pages[0]], labels: [1], half: "left" });
  return v;
}
type Half = { src: string; half: "left" | "right" } | null;
/** What lies on the left-hand side of the spine in state `s`. */
const leftOf = (pages: string[], s: number): Half =>
  s === 0 ? null : { src: pages[s < pages.length ? s : 0], half: "left" };
/** What lies on the right-hand side of the spine in state `s`. */
const rightOf = (pages: string[], s: number): Half =>
  s < pages.length ? { src: pages[s], half: "right" } : null;
/** A closed booklet is one page wide, and it is that page that sits on the
 *  stage's centre — so the whole book is carried half a page sideways
 *  while it is shut, and comes back as the cover opens. Percent of the
 *  book's own (two-page) width. */
const shiftOf = (n: number, s: number) => (s === 0 ? -25 : s === n ? 25 : 0);
const BOOK_ASPECT = 1985 / 1404;

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
  // The ACTIVE DOCUMENT decides its own page shape, falling back to the
  // publication's kind where it does not say — see `doc` in
  // publicationsContent.
  const isWidePage = activeDoc?.wide ?? content?.viewer.kind === "spreadCollection";
  /** Only a printed brochure — a set of spreads — is a booklet. A single
   *  portrait sheet inside the brochures collection is not. */
  const isBooklet =
    content?.viewer.kind === "spreadCollection" &&
    activeDoc?.wide !== false &&
    (activeDoc?.pages.length ?? 0) >= 2;
  /** This publication's own curl — see BEND. */
  const bendProfile = BEND[content?.viewer.kind ?? "page"] ?? BEND.page;

  const views = useMemo(
    () => (activeDoc ? (isBooklet ? buildBookletViews(activeDoc) : buildViews(activeDoc)) : []),
    [activeDoc, isBooklet]
  );
  const spreads = useMemo(() => activeDoc?.pages ?? [], [activeDoc]);
  const lastState = spreads.length;

  const [viewIndex, setViewIndex] = useState(0);
  const [turn_, setTurn] = useState<Turn | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const turningRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  /** The 3D context the booklet (and its turning leaf) lives in. */
  const layerHostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  /** The carousel's track. */
  const trackRef = useRef<HTMLDivElement>(null);
  const bendRef = useRef<PageBendHandle | null>(null);
  /** The live turn position, kept off React so a drag can write it every
   *  frame without re-rendering the page underneath. */
  const tRef = useRef(0);
  const turnRef = useRef<Turn | null>(null);

  const view = views[viewIndex];
  const viewIndexRef = useRef(viewIndex);
  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);

  // The stage's size, for the booklet's own box: a two-page spread fitted
  // inside it, never cropped.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isBooklet]);
  const bookW = Math.max(0, Math.min(stageBox.w, stageBox.h * BOOK_ASPECT));
  const bookH = bookW / BOOK_ASPECT;

  // ── THE BOOKLET: A LEAF TURNS ON THE SPINE ────────────────────────────
  //
  // The leaf is pageBend's chain of nested strips, pivoting on its LEFT
  // edge — which here is the booklet's central fold — through a full half
  // circle, so it leaves the right-hand page and lands flat on the left.
  // Its front is the right half of the spread being left; its back is the
  // left half of the spread arriving, which is what the reverse of that
  // printed sheet genuinely carries. Beneath it lie the left page that is
  // staying and the right page being uncovered, so nothing is ever drawn
  // twice and nothing fades through anything.
  //
  // One number drives it: `t` 0 (lying on the right) to 1 (landed on the
  // left), forward for next and backward for prev.
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
      // Whatever is left of the turn, at a steady tempo; a whole leaf
      // over the spine is a longer journey than a one-page slide.
      duration: Math.max(0.3, Math.abs(target - o.v) * 1.05),
      ease: "power2.inOut",
      onUpdate: () => {
        tRef.current = o.v;
        bend.setT(o.v);
      },
      onComplete: finish,
    });
  }, []);

  // THE LEAF ITSELF, built once per turn over the right-hand page box.
  useLayoutEffect(() => {
    if (!turn_ || !isBooklet) return;
    const book = bookRef.current;
    const a = Math.min(turn_.from, turn_.to);
    const front = rightOf(spreads, a);
    const back = leftOf(spreads, a + 1);
    if (!book || !front || !back || !book.offsetWidth) {
      turningRef.current = false;
      turnRef.current = null;
      setTurn(null);
      return;
    }
    const w = book.offsetWidth / 2;
    const h = book.offsetHeight;
    const bend = createPageBend({
      host: book,
      x: w,
      y: 0,
      width: w,
      height: h,
      frontSrc: front.src,
      backSrc: back.src,
      frontHalf: front.half,
      backHalf: back.half,
      beta: bendProfile.beta,
      swing: Math.PI,
      zIndex: 6,
    });
    const s0 = shiftOf(lastState, a);
    const s1 = shiftOf(lastState, a + 1);
    const handle: PageBendHandle = {
      setT(t: number) {
        bend.setT(t);
        // The book slides onto the centre as its cover opens, and off it
        // again as the last leaf closes it — with the leaf, not after it.
        const e = t * t * (3 - 2 * t);
        gsap.set(book, { xPercent: s0 + (s1 - s0) * e });
      },
      destroy: () => bend.destroy(),
    };
    handle.setT(tRef.current);
    bendRef.current = handle;
    if (turn_.auto) settle(true);
    return () => {
      bend.destroy();
      bendRef.current = null;
    };
  }, [turn_, isBooklet, spreads, lastState, settle, bendProfile.beta]);

  // At rest the booklet sits where its state puts it.
  useLayoutEffect(() => {
    if (!isBooklet || turnRef.current || !bookRef.current) return;
    gsap.set(bookRef.current, { xPercent: shiftOf(lastState, viewIndex) });
  }, [isBooklet, viewIndex, lastState, bookW]);

  // ── THE CAROUSEL: ONE TRACK, SLIDING ──────────────────────────────────
  const slideTo = useCallback(
    (i: number, instant = false) => {
      const clamped = Math.min(views.length - 1, Math.max(0, i));
      const tr = trackRef.current;
      if (tr) {
        if (instant) gsap.set(tr, { xPercent: -100 * clamped, x: 0 });
        else
          gsap.to(tr, {
            xPercent: -100 * clamped,
            x: 0,
            duration: 0.72,
            ease: "power3.out",
            overwrite: true,
          });
      }
      if (clamped !== viewIndexRef.current) {
        setViewIndex(clamped);
        viewIndexRef.current = clamped;
        setPan({ x: 0, y: 0 });
      }
    },
    [views.length]
  );

  // A different document starts on its own first page, placed, not slid.
  useLayoutEffect(() => {
    if (isBooklet || !trackRef.current) return;
    gsap.set(trackRef.current, { xPercent: -100 * viewIndexRef.current, x: 0 });
  }, [isBooklet, docIndex]);

  const goToView = useCallback(
    (next: number) => {
      if (!views.length || turningRef.current) return;
      const clamped = Math.min(views.length - 1, Math.max(0, next));
      const cur = viewIndexRef.current;
      if (clamped === cur) return;
      if (!isBooklet) {
        slideTo(clamped);
        return;
      }
      if (Math.abs(clamped - cur) === 1) {
        beginTurn(clamped > cur ? 1 : -1, true);
        return;
      }
      // A jump of more than one leaf is not a page turn — turning one
      // sheet to cross ten would be a lie about the booklet — so the
      // thumbnails and the overview simply go there.
      setViewIndex(clamped);
      viewIndexRef.current = clamped;
      setPan({ x: 0, y: 0 });
    },
    [views.length, beginTurn, isBooklet, slideTo]
  );

  // Switching documents inside a collection starts that document at its
  // own first page rather than carrying the previous one's position over.
  const selectDoc = useCallback(
    (i: number) => {
      if (i === docIndex || turningRef.current) return;
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

  // ONE POINTER, decided by format and zoom: zoomed in, a drag pans the
  // page; at fit, it slides the carousel, or takes hold of the booklet's
  // leaf and turns it — writing its angle every frame, so letting go only
  // decides which end the rest of the turn runs to.
  const panRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragRef = useRef<{
    dir: 1 | -1;
    x0: number;
    w: number;
    moved: number;
    vel: number;
    tPrev: number;
  } | null>(null);
  const slideRef = useRef<{ x0: number; w: number; moved: number; vel: number; lastX: number; tPrev: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoomIdx > 0) {
      panRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (turningRef.current) return;
    // No text selection and no native image drag: either one makes the
    // browser cancel the pointer mid-gesture.
    e.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    if (!isBooklet) {
      if (trackRef.current) gsap.killTweensOf(trackRef.current);
      slideRef.current = {
        x0: e.clientX,
        w: rect.width,
        moved: 0,
        vel: 0,
        lastX: e.clientX,
        tPrev: performance.now(),
      };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    // Which half of the open booklet was taken hold of picks the way it
    // turns; a closed one can only open the way it opens.
    const cur = viewIndexRef.current;
    const dir: 1 | -1 =
      cur === 0 ? 1 : cur === lastState ? -1 : (e.clientX - rect.left) / rect.width > 0.5 ? 1 : -1;
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
    const sl = slideRef.current;
    if (sl) {
      let dx = e.clientX - sl.x0;
      sl.moved = Math.max(sl.moved, Math.abs(dx));
      const cur = viewIndexRef.current;
      // Past either end the track gives, but only a little.
      if ((cur === 0 && dx > 0) || (cur === views.length - 1 && dx < 0)) dx *= 0.3;
      const now = performance.now();
      const dt = Math.max(1, now - sl.tPrev);
      sl.vel = sl.vel * 0.6 + (((e.clientX - sl.lastX) / dt) * 1000) * 0.4;
      sl.lastX = e.clientX;
      sl.tPrev = now;
      if (trackRef.current) gsap.set(trackRef.current, { x: dx });
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    // Pulling left turns forward. A leaf crosses the whole spread, so the
    // hand crosses most of the stage to take it all the way over.
    const adv = Math.max(0, Math.min(1, (d.dir === 1 ? -dx : dx) / (d.w * 0.7)));
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
    const sl = slideRef.current;
    if (sl) {
      slideRef.current = null;
      setDragging(false);
      const x = trackRef.current ? (gsap.getProperty(trackRef.current, "x") as number) || 0 : 0;
      const fresh = performance.now() - sl.tPrev < 90;
      const projected = x + (fresh ? sl.vel * 0.18 : 0);
      const step = Math.abs(projected) > sl.w * 0.18 ? (projected < 0 ? 1 : -1) : 0;
      slideTo(viewIndexRef.current + step);
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    setDragging(false);
    // A tap on one side of the booklet turns it, the way tapping the edge
    // of a book does.
    if (d.moved < 6) {
      settle(true);
      return;
    }
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

  // The booklet counts its own states — cover, spreads, back cover.
  const pageLabel = isBooklet
    ? String(viewIndex + 1).padStart(2, "0")
    : String(view.labels[0]).padStart(2, "0");
  const pageTotal = String(isBooklet ? views.length : activeDoc.pageCount).padStart(2, "0");

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

  /** A thumbnail's picture: a whole page, or half of a spread. */
  const thumb = (v: View, sizing: React.CSSProperties) =>
    v.half ? (
      <span
        key={v.pages[0] + v.half}
        style={{ ...sizing, display: "block", aspectRatio: "1985 / 2808", overflow: "hidden", position: "relative", flex: "0 0 auto" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.pages[0]}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: v.half === "right" ? "-100%" : 0,
            width: "200%",
            height: "100%",
            maxWidth: "none",
            display: "block",
          }}
        />
      </span>
    ) : (
      v.pages.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" style={{ ...sizing, display: "block", minWidth: 0 }} />
      ))
    );

  // ONE PAGE OF THE BOOKLET: half of a supplied spread, on its side of the
  // spine. The edge away from the spine carries the stack of pages still
  // on that side; the edge at the spine carries the fold's shadow.
  const bookletPage = (h: Half, side: "left" | "right", stack: number) => {
    if (!h) return null;
    const layers = Math.min(5, Math.max(0, stack));
    const edge = Array.from({ length: layers }, (_, k) => {
      const d = (k + 1) * 1.6;
      const c = 214 - k * 22;
      return `${side === "left" ? -d : d}px ${d * 0.4}px 0 rgb(${c},${c - 3},${c - 8})`;
    });
    return (
      <div
        key={side}
        data-booklet-page={side}
        style={{
          position: "absolute",
          top: 0,
          left: side === "left" ? 0 : "50%",
          width: "50%",
          height: "100%",
          overflow: "hidden",
          background: "#f4f2ee",
          boxShadow: [...edge, "0 40px 90px rgba(0,0,0,0.7)"].join(", "),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={h.src}
          alt={`${activeDoc.title}, ${h.half === "right" && side === "right" && viewIndex === 0 ? "front cover" : h.half === "left" && viewIndex === lastState ? "back cover" : "page"}`}
          draggable={false}
          style={{
            position: "absolute",
            top: 0,
            left: h.half === "right" ? "-100%" : 0,
            width: "200%",
            height: "100%",
            maxWidth: "none",
            display: "block",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              side === "left"
                ? "linear-gradient(to left, rgba(0,0,0,0.26), rgba(0,0,0,0.06) 5%, rgba(0,0,0,0) 12%)"
                : "linear-gradient(to right, rgba(0,0,0,0.26), rgba(0,0,0,0.06) 5%, rgba(0,0,0,0) 12%)",
          }}
        />
      </div>
    );
  };
  // What lies under the leaf: while a turn is in flight, the left page
  // that stays and the right page being uncovered; at rest, the state.
  const restA = turn_ ? Math.min(turn_.from, turn_.to) : viewIndex;
  const leftHalf = leftOf(spreads, restA);
  const rightHalf = rightOf(spreads, turn_ ? restA + 1 : viewIndex);
  const leftStack = turn_ ? restA : viewIndex;
  const rightStack = lastState - (turn_ ? restA + 1 : viewIndex);

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
              {pageLabel} / {pageTotal}
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
              // A closed booklet opens with a click on its cover (see
              // endDrag's tap); the cursor says so.
              data-cursor={isBooklet && viewIndex === 0 ? "open" : "drag"}
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
              {isBooklet ? (
                <div
                  ref={layerHostRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformStyle: "preserve-3d",
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "50% 50%",
                    transition: dragging ? "none" : "transform 340ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  {/* THE BOOKLET. Its box is the two-page spread fitted to
                      the stage; the leaf pageBend adds is not React's, so a
                      drag can write its angle every frame. */}
                  <div
                    ref={bookRef}
                    data-booklet
                    data-booklet-state={viewIndex}
                    style={{
                      position: "absolute",
                      left: (stageBox.w - bookW) / 2,
                      top: (stageBox.h - bookH) / 2,
                      width: bookW,
                      height: bookH,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {bookletPage(leftHalf, "left", leftStack)}
                    {bookletPage(rightHalf, "right", rightStack)}
                  </div>
                </div>
              ) : (
                // THE CAROUSEL. Every page on one track, each a stage wide;
                // only the page being read takes the zoom.
                <div
                  ref={trackRef}
                  data-pub-track
                  style={{ position: "absolute", inset: 0, display: "flex", willChange: "transform" }}
                >
                  {views.map((v, i) => (
                    <div
                      key={v.pages.join("|")}
                      data-pub-slide={i}
                      style={{ flex: "0 0 100%", height: "100%", position: "relative", overflow: "hidden" }}
                    >
                      <div
                        style={{
                          ...layerStyle,
                          transform:
                            i === viewIndex ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : "none",
                          transformOrigin: "50% 50%",
                          transition: dragging ? "none" : "transform 340ms cubic-bezier(0.22,1,0.36,1)",
                        }}
                      >
                        {renderPages(v)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                key={v.pages.join("|") + (v.half ?? "")}
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
                {thumb(v, { height: "100%", width: "auto" })}
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
                key={v.pages.join("|") + (v.half ?? "")}
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
                {thumb(v, { width: "100%" })}
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
