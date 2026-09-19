"use client";

// THE REELS PROJECT INDEX.
//
// Opened from a REELS card. A calm, editorial full-screen split: project
// index/title/meta/description/count on the left, the selected video's
// supplied thumbnail large on the right with a WATCH cue over it, a
// thumbnail index along the bottom for multi-video projects, and
// prev/next-project navigation next to it.
//
// WATCH is a stub integration point for the immersive viewer that comes
// next, not a player — this page's own state (which project, which
// video) is exactly what that viewer will need to return to.
//
// Mount/unmount mirrors the contact popup and toast elsewhere in
// HeroSection: two flags so the panel can enter and exit with a real
// transition instead of popping in place, and only actually unmounts once
// the exit transition has finished.

import { useEffect, useRef, useState } from "react";
import type { Reel } from "./ReelStrip";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function ReelProjectView({
  reels,
  openIndex,
  onClose,
  onNavigate,
  selectedVideo,
  onSelectVideo,
  onWatch,
  sans,
}: {
  reels: Reel[];
  /** Index into `reels`, or null when the panel should be closed. */
  openIndex: number | null;
  onClose: () => void;
  /** Jump to another reel by index (used by prev/next project). */
  onNavigate: (index: number) => void;
  /** Lifted to HeroSection so the immersive viewer (opened via WATCH)
      and this page always agree on which video is selected. */
  selectedVideo: number;
  onSelectVideo: (index: number) => void;
  onWatch: () => void;
  sans: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // The reel actually on screen. Kept through the exit transition even
  // after `openIndex` goes back to null, so the panel doesn't go blank an
  // instant before it fades out.
  const [displayIndex, setDisplayIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // THE ENTRANCE ANIMATION'S OWN CANCELLATION — see the identical comment
  // in ReelVideoViewer.tsx for the full explanation. Short version: the
  // double-rAF below is only cleaned up when the effect re-runs, which
  // needs `mounted` to flip — and `mounted` does not flip to false until
  // `onTransitionEnd` fires, well after a close is requested. A pending
  // chain from opening can therefore still fire in that window and force
  // `shown` back to true, silently reopening an already-closed panel.
  const entranceRafIdsRef = useRef<[number, number]>([0, 0]);
  const closeTokenRef = useRef(0);
  const cancelEntrance = () => {
    cancelAnimationFrame(entranceRafIdsRef.current[0]);
    cancelAnimationFrame(entranceRafIdsRef.current[1]);
    closeTokenRef.current++;
  };

  // Reacting to the `openIndex` prop, not to a local event, so this is the
  // documented "adjust state during render" escape hatch rather than an
  // effect: state (not a ref — refs can't be read during render) remembers
  // the last prop value seen, and the branch below only runs on the
  // render where it actually changed. Opening (or navigating to another
  // project) resets to video 01 (HeroSection owns that reset, since
  // `selectedVideo` is lifted there — this only tracks mount/exit), and
  // closing only starts the exit — `displayIndex`/`mounted` stay put so
  // the panel keeps showing its last content while it fades out.
  const [prevOpenIndex, setPrevOpenIndex] = useState<number | null>(null);
  if (prevOpenIndex !== openIndex) {
    const wasOpen = prevOpenIndex != null;
    setPrevOpenIndex(openIndex);
    if (openIndex != null) {
      setDisplayIndex(openIndex);
      // Only a fresh open (from fully closed) needs the below-rest ->
      // shown flip; swapping to another project while already open must
      // leave `shown` at true; setting it false here would fade the
      // panel out with nothing to bring it back, since the entrance
      // effect below only re-fires when `mounted` itself flips.
      if (!wasOpen) {
        setMounted(true);
        setShown(false);
      }
    } else if (wasOpen) {
      setShown(false);
    }
  }

  // The actual cancellation (see `cancelEntrance`'s own comment above) has
  // to live in an effect, not the render-time block above: refs cannot be
  // read during render. Keyed directly on the `openIndex` PROP rather than
  // on `wasOpen`/`shown` so it fires on the same commit as the render-time
  // close above, not a render later.
  useEffect(() => {
    if (openIndex == null) cancelEntrance();
  }, [openIndex]);

  // Double rAF entrance, same trick as the contact popup and the toast:
  // mount below-rest/invisible on one frame, only flip to the resting
  // state on the next so the browser has something to transition from.
  // Only re-fires when `mounted` itself flips false -> true (a fresh
  // open), not on a prev/next content swap while already shown — and it
  // does flip back to false, via the panel's own onTransitionEnd below
  // once the close fade finishes, so `mounted` really does cycle on every
  // open/close pair rather than only ever going true once.
  useEffect(() => {
    if (!mounted) return;
    const token = closeTokenRef.current;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        // Stale if a close happened after this chain started and before
        // it got here — see `closeTokenRef`'s own comment above.
        if (closeTokenRef.current === token) setShown(true);
      });
      entranceRafIdsRef.current[1] = raf2;
    });
    entranceRafIdsRef.current = [raf1, 0];
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [mounted]);

  // Escape closes; a click on the scrim (not the panel itself) closes too.
  useEffect(() => {
    if (openIndex == null) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, onClose]);

  if (!mounted || displayIndex == null) return null;
  const reel = reels[displayIndex];
  const videos = reel.videos ?? [];
  const video = videos[selectedVideo] ?? videos[0];

  // Only reels that currently have videos are real, navigable projects —
  // one with none yet has nothing to show in this view. The list is
  // linear, not circular: the first project has no Prev, the last has no
  // Next, and neither wraps around to the other end.
  const navigable = reels
    .map((r, i) => (r.videos && r.videos.length > 0 ? i : -1))
    .filter((i) => i !== -1);
  const pos = navigable.indexOf(displayIndex);
  const prevIndex = pos > 0 ? navigable[pos - 1] : null;
  const nextIndex = pos !== -1 && pos < navigable.length - 1 ? navigable[pos + 1] : null;

  const t = clamp01(shown ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reel.title}
      data-reel-modal-scroll
      onClick={(e) => {
        if (e.target === panelRef.current) onClose();
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && !shown) {
          setMounted(false);
          setDisplayIndex(null);
        }
      }}
      ref={panelRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(6,6,7,0.97)",
        backdropFilter: "blur(6px)",
        opacity: t,
        transition: "opacity 420ms cubic-bezier(0.16,1,0.3,1)",
        display: "flex",
        flexDirection: "column",
        fontFamily: sans,
        color: "#fff",
        padding: "clamp(20px, 4vw, 56px)",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          transform: shown ? "translateY(0) scale(1)" : "translateY(10px) scale(0.99)",
          transition: "transform 420ms cubic-bezier(0.16,1,0.3,1)",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          // No minHeight:0 override: this column's natural content height
          // (a long description plus a full thumbnail index can genuinely
          // exceed one screen) is what should decide its size. With it
          // capped at exactly the dialog's own height instead, taller
          // content didn't push the dialog's own scroll — it overflowed
          // straight through the row below it, text painted over
          // thumbnails rather than the page simply scrolling to fit.
        }}
      >
        {/* TOP: Close only — no origin label, per an earlier explicit
            design decision that the project page should not carry a
            "Reels" label in the top-left. */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "9px 20px",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {/* THE SPLIT: project info on the left, the selected video large
            on the right. A row rather than a stack, so the text reads
            beside the work instead of pushing it further down the page —
            the layout this page is short on room to spare without. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "clamp(28px, 5vw, 72px)",
            marginTop: "clamp(20px, 3.5vh, 40px)",
            flex: 1,
          }}
        >
          {/* LEFT: index within the real projects, title, whatever of its
              own data the project actually has (meta/description), and
              the video count. Nothing here is invented — a project with
              no description simply has no paragraph. */}
          <div style={{ flex: "1 1 300px", maxWidth: 420 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.42)",
              }}
            >
              {String(pos + 1).padStart(2, "0")} / {String(navigable.length).padStart(2, "0")}
            </div>
            <h2
              style={{
                margin: 0,
                marginTop: 14,
                fontSize: "clamp(28px, 3.6vw, 52px)",
                fontWeight: 500,
                letterSpacing: "0.005em",
                lineHeight: 1.08,
                color: "#fff",
              }}
            >
              {reel.title}
            </h2>
            <div
              style={{
                marginTop: 8,
                fontSize: "clamp(12px, 0.95vw, 15px)",
                fontWeight: 300,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {reel.meta}
            </div>
            {reel.description && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: "clamp(16px, 1.3vw, 21px)",
                  lineHeight: 1.7,
                  fontWeight: 300,
                  letterSpacing: "0.03em",
                  color: "rgba(255,255,255,0.72)",
                  maxWidth: "42ch",
                }}
              >
                {reel.description}
              </p>
            )}
            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {videos.length} {videos.length === 1 ? "video" : "videos"}
            </div>
          </div>

          {/* RIGHT: the selected video. Confident, but capped well short
              of the column's own width — a poster this size shouldn't
              read as "the whole page," only as the most prominent single
              thing on it, balanced against the left column and the
              thumbnail index below rather than crowding both out. Portrait
              pieces (Bhajan Clubbing's 9:16 footage) are capped further
              still, on width, so they read as portrait video rather than
              a poster blown up to fill the column. */}
          <div
            style={{
              flex: "1 1 340px",
              // No minHeight:0 here either (see the split row above, for
              // the same reason): it let this column shrink to match
              // whatever height the LEFT column's text happened to need,
              // which for a short description (Bhajan Clubbing's two
              // sentences) was far less than a 9:16 video wants — the
              // video ended up capped by that borrowed short height
              // instead of by its own maxWidth/maxHeight, rendering it
              // tiny regardless of how generous those caps were.
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {video && (
              <div
                style={{
                  position: "relative",
                  // Landscape drives off height:100% (of its row) with a
                  // definite maxHeight ceiling — a percentage that DOES
                  // resolve, since the row's own height ends up settled
                  // through the outer flex layout regardless. Portrait
                  // drives off an explicit, viewport-relative WIDTH
                  // instead (not "auto" — an auto width on a box with no
                  // actual content, just an absolutely-positioned image
                  // inside it, shrink-to-fits to nothing) so its height,
                  // derived from that definite width via aspect-ratio, is
                  // a real, unambiguous sizing need — one the flex layout
                  // can actually grow the row (and, if needed, the whole
                  // scrollable panel) to fit, rather than a percentage
                  // referencing a row height that was not yet settled.
                  height: reel.ratio >= 1 ? "100%" : "auto",
                  width: reel.ratio >= 1 ? "100%" : "min(100%, 42vh)",
                  // A fixed ceiling rather than a share of the column: on a
                  // wide desktop split the column itself is most of the
                  // page, and a percentage of THAT is still "almost full
                  // width." Capping the pixel size directly is what keeps
                  // this prominent without dominating — and on a narrow
                  // stacked layout, where there is no sidebar left to
                  // crowd, "min(100%, ...)" still lets it fill what little
                  // width there is instead of shrinking twice over.
                  maxWidth: reel.ratio >= 1 ? "min(100%, 640px)" : undefined,
                  maxHeight: reel.ratio >= 1 ? "min(100%, 46vh)" : "min(100%, 80vh)",
                  aspectRatio: String(reel.ratio),
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.09)",
                  boxShadow: "0 0 60px rgba(255,255,255,0.08), 0 30px 90px rgba(0,0,0,0.6)",
                  background:
                    "linear-gradient(150deg, #191a1e 0%, #111216 55%, #0a0b0d 100%)",
                }}
              >
                {video.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnail}
                    alt=""
                    // A project can list a dozen or more videos; decoding
                    // every thumbnail at once is work the reader has not
                    // asked for yet.
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    draggable={false}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%)",
                  }}
                />
                <button
                  type="button"
                  onClick={onWatch}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    borderRadius: 999,
                    padding: "16px 34px",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Watch
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: the video index (multi-video only) in its own row,
            thumbnails large enough to actually read as previews, each
            with its number below rather than lettered over the art. */}
        {videos.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: "clamp(14px, 2vw, 26px)",
              flexWrap: "wrap",
              marginTop: "clamp(20px, 4vh, 40px)",
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            {videos.map((v, i) => {
              const selected = i === selectedVideo;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVideo(i)}
                  aria-current={selected}
                  aria-label={`Video ${i + 1}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      // Landscape thumbnails are sized off their WIDTH
                      // (clamp(150-232px)), with the aspect ratio giving a
                      // modest ~85-130px height. Portrait ones (Bhajan
                      // Clubbing) need the SAME clamp applied to whichever
                      // dimension it actually constrains — for 9:16 that's
                      // the height, not the width; sizing off width the
                      // same way made each thumbnail ~410px tall, which
                      // ate most of the panel's vertical budget and left
                      // the split row above (and the selected video in it)
                      // squeezed down to a sliver.
                      width: reel.ratio >= 1 ? "clamp(150px, 14vw, 232px)" : "auto",
                      height: reel.ratio >= 1 ? "auto" : "clamp(150px, 14vw, 232px)",
                      aspectRatio: String(reel.ratio),
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#111216",
                      border: selected
                        ? "2px solid rgba(255,255,255,0.9)"
                        : "1px solid rgba(255,255,255,0.16)",
                      opacity: selected ? 1 : 0.55,
                      transition: "opacity 180ms ease, border-color 180ms ease",
                    }}
                  >
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail}
                        alt=""
                        draggable={false}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: sans,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: selected ? "#fff" : "rgba(255,255,255,0.42)",
                      borderBottom: selected
                        ? "1px solid rgba(255,255,255,0.85)"
                        : "1px solid transparent",
                      paddingBottom: 2,
                      transition: "color 180ms ease, border-color 180ms ease",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* PROJECT NAVIGATION, in its own row so Prev/Next always land in
            the bottom corners regardless of whether the video index above
            rendered. Linear, not circular: at either end, the unavailable
            direction simply isn't rendered rather than sitting there
            disabled. */}
        <div
          style={{
            display: "flex",
            marginTop: videos.length > 1 ? "clamp(16px, 3vh, 28px)" : "clamp(20px, 4vh, 40px)",
            paddingTop: videos.length > 1 ? 0 : 22,
            borderTop: videos.length > 1 ? "none" : "1px solid rgba(255,255,255,0.09)",
          }}
        >
          {prevIndex != null && (
            <button
              type="button"
              onClick={() => onNavigate(prevIndex)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: sans,
                fontSize: "clamp(14px, 1.1vw, 17px)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <span style={{ fontSize: "1.3em" }} aria-hidden>
                ←
              </span>
              Prev project
            </button>
          )}
          {nextIndex != null && (
            <button
              type="button"
              onClick={() => onNavigate(nextIndex)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: "auto",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: sans,
                fontSize: "clamp(14px, 1.1vw, 17px)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Next project
              <span style={{ fontSize: "1.3em" }} aria-hidden>
                →
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
