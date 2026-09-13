"use client";

// THE REELS PROJECT INDEX.
//
// Opened from a REELS card that has videos. A calm, editorial full-screen
// panel — project title/description/count on the left, the selected
// video's supplied thumbnail on the right with a WATCH cue over it, a
// numbered index along the bottom for multi-video projects, and
// prev/next-project navigation next to it.
//
// This is the first UI step only: WATCH is a stub integration point for
// the immersive viewer that comes next, not a player.
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
        {/* TOP: origin label + close. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Reels
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "8px 18px",
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

        {/* LEFT / CENTRE-RIGHT: project info + selected video. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "clamp(24px, 4vw, 64px)",
            marginTop: "clamp(24px, 5vh, 56px)",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ flex: "1 1 280px", maxWidth: 420 }}>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(24px, 3vw, 40px)",
                fontWeight: 500,
                letterSpacing: "0.01em",
                lineHeight: 1.1,
              }}
            >
              {reel.title}
            </h2>
            {reel.description && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: "clamp(14px, 1.1vw, 16px)",
                  lineHeight: 1.6,
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.72)",
                  maxWidth: "42ch",
                }}
              >
                {reel.description}
              </p>
            )}
            <div
              style={{
                marginTop: 22,
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

          <div
            style={{
              flex: "2 1 420px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 0,
            }}
          >
            {video && (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 720,
                  aspectRatio: String(reel.ratio),
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.09)",
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
                    // (next step) — intentionally a no-op for now.
                  }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    borderRadius: 999,
                    padding: "14px 30px",
                    color: "#fff",
                    fontSize: 13,
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

        {/* BOTTOM: video index (multi-video only) + project navigation. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginTop: "clamp(20px, 4vh, 40px)",
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {videos.length > 1 &&
              videos.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVideo(i)}
                  aria-current={i === selectedVideo}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: sans,
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    color:
                      i === selectedVideo ? "#fff" : "rgba(255,255,255,0.4)",
                    borderBottom:
                      i === selectedVideo
                        ? "1px solid rgba(255,255,255,0.8)"
                        : "1px solid transparent",
                    paddingBottom: 4,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              ))}
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <button
              type="button"
              onClick={() => prevIndex != null && onNavigate(prevIndex)}
              disabled={prevIndex == null}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: prevIndex != null ? "pointer" : "default",
                fontFamily: sans,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              ← Prev project
            </button>
            <button
              type="button"
              onClick={() => nextIndex != null && onNavigate(nextIndex)}
              disabled={nextIndex == null}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: nextIndex != null ? "pointer" : "default",
                fontFamily: sans,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Next project →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
