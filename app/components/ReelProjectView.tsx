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
  sans,
}: {
  reels: Reel[];
  /** Index into `reels`, or null when the panel should be closed. */
  openIndex: number | null;
  onClose: () => void;
  /** Jump to another reel by index (used by prev/next project). */
  onNavigate: (index: number) => void;
  sans: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // The reel actually on screen. Kept through the exit transition even
  // after `openIndex` goes back to null, so the panel doesn't go blank an
  // instant before it fades out.
  const [displayIndex, setDisplayIndex] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reacting to the `openIndex` prop, not to a local event, so this is the
  // documented "adjust state during render" escape hatch rather than an
  // effect: state (not a ref — refs can't be read during render) remembers
  // the last prop value seen, and the branch below only runs on the
  // render where it actually changed. Opening (or navigating to another
  // project) resets straight to video 01, and closing only starts the
  // exit — `displayIndex`/`mounted` stay put so the panel keeps showing
  // its last content while it fades out.
  const [prevOpenIndex, setPrevOpenIndex] = useState<number | null>(null);
  if (prevOpenIndex !== openIndex) {
    const wasOpen = prevOpenIndex != null;
    setPrevOpenIndex(openIndex);
    if (openIndex != null) {
      setDisplayIndex(openIndex);
      setSelectedVideo(0);
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

  // Double rAF entrance, same trick as the contact popup and the toast:
  // mount below-rest/invisible on one frame, only flip to the resting
  // state on the next so the browser has something to transition from.
  // Only re-fires when `mounted` itself flips false -> true (a fresh
  // open), not on a prev/next content swap while already shown.
  useEffect(() => {
    if (!mounted) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(true));
    });
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
  // one with none yet (e.g. Excelsource, still pending its footage) has
  // nothing to show in this view, and r8 is explicitly unused/reserved.
  const navigable = reels
    .map((r, i) => (r.videos && r.videos.length > 0 ? i : -1))
    .filter((i) => i !== -1);
  const pos = navigable.indexOf(displayIndex);
  const prevIndex =
    pos === -1 ? null : navigable[(pos - 1 + navigable.length) % navigable.length];
  const nextIndex = pos === -1 ? null : navigable[(pos + 1) % navigable.length];

  const t = clamp01(shown ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reel.title}
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
          minHeight: 0,
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
            minHeight: 0,
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

          {/* RIGHT: the selected video. Landscape pieces take the wide,
              confident presentation this page has room for; portrait
              pieces (Bhajan Clubbing's 9:16 footage) are capped on width
              instead so they read as portrait video, not as a poster
              blown up to fill the column. */}
          <div
            style={{
              flex: "1 1 420px",
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {video && (
              <div
                style={{
                  position: "relative",
                  height: "100%",
                  width: reel.ratio >= 1 ? "100%" : "auto",
                  maxWidth: reel.ratio >= 1 ? "100%" : "min(100%, 48vh)",
                  maxHeight: reel.ratio >= 1 ? "min(100%, 74vh)" : "100%",
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
                  onClick={() => {
                    // Integration point for the immersive video viewer
                    // (next step) — intentionally a no-op for now. It will
                    // own play/pause, restart, time, prev/next-video and
                    // back; this page only has to remember `displayIndex`
                    // and `selectedVideo` for it to return to, which it
                    // already keeps regardless of what WATCH does.
                  }}
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

        {/* BOTTOM: video index (multi-video only, thumbnails now rather
            than bare numbers) + project navigation, given enough size and
            weight of its own to balance against the media above it. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 20,
            marginTop: "clamp(20px, 4vh, 40px)",
            paddingTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flex: "1 1 auto" }}>
            {videos.length > 1 &&
              videos.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVideo(i)}
                  aria-current={i === selectedVideo}
                  aria-label={`Video ${i + 1}`}
                  style={{
                    position: "relative",
                    width: 84,
                    aspectRatio: String(reel.ratio),
                    borderRadius: 8,
                    overflow: "hidden",
                    padding: 0,
                    cursor: "pointer",
                    background: "#111216",
                    border:
                      i === selectedVideo
                        ? "2px solid rgba(255,255,255,0.9)"
                        : "1px solid rgba(255,255,255,0.14)",
                    opacity: i === selectedVideo ? 1 : 0.55,
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
                  <span
                    style={{
                      position: "absolute",
                      left: 5,
                      bottom: 4,
                      fontFamily: sans,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      color: "#fff",
                      textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
          </div>

          <div style={{ display: "flex", gap: 32 }}>
            <button
              type="button"
              onClick={() => prevIndex != null && onNavigate(prevIndex)}
              disabled={prevIndex == null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                padding: 0,
                cursor: prevIndex != null ? "pointer" : "default",
                fontFamily: sans,
                fontSize: "clamp(14px, 1.1vw, 17px)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: prevIndex != null ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
              }}
            >
              <span style={{ fontSize: "1.3em" }} aria-hidden>
                ←
              </span>
              Prev project
            </button>
            <button
              type="button"
              onClick={() => nextIndex != null && onNavigate(nextIndex)}
              disabled={nextIndex == null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                padding: 0,
                cursor: nextIndex != null ? "pointer" : "default",
                fontFamily: sans,
                fontSize: "clamp(14px, 1.1vw, 17px)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: nextIndex != null ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
              }}
            >
              Next project
              <span style={{ fontSize: "1.3em" }} aria-hidden>
                →
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
