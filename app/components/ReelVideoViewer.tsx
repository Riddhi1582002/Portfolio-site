"use client";

// THE IMMERSIVE VIDEO VIEWER.
//
// Every source is a plain MP4 hosted on Cloudflare R2, played with a native
// <video> element — no host player, no iframe, no chrome to mask. Every
// control on screen — play/pause, restart, progress, prev/next video,
// details, back — is our own restrained UI, same as before; only what sat
// underneath it changed. Opened either from the project index's WATCH
// button (a multi-video project) or directly from a REELS card (a
// single-video project skips the project index entirely) — either way this
// component only needs to know which reel and which of its videos, both
// owned by HeroSection so the project index (if any) stays in sync
// underneath.
//
// Mount/unmount mirrors ReelProjectView: two flags so the panel enters
// and exits with a real transition, only actually unmounting once the
// exit transition finishes. The <video> element itself is created once
// per "open session" (keyed on `mounted`) and told to load a different
// source in place whenever `videoIndex` changes, which is what keeps
// prev/next feeling like the same viewer rather than a reopen.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Reel } from "./ReelStrip";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export default function ReelVideoViewer({
  reels,
  reelIndex,
  videoIndex,
  onVideoChange,
  onClose,
  sans,
}: {
  reels: Reel[];
  /** Which reel is open in the viewer, or null when it should be closed. */
  reelIndex: number | null;
  /** Index into that reel's `videos` array. */
  videoIndex: number;
  /** Prev/Next video — never changes `reelIndex`, only this. */
  onVideoChange: (index: number) => void;
  onClose: () => void;
  sans: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // Bumped on every fresh open (see `!wasOpen` below) so the entrance
  // effect can key off it instead of off `mounted`, which is set true once
  // and never reset — a `[mounted]` dependency only ever fired the
  // entrance on the very first WATCH; every reopen after the first close
  // set `shown` to false with nothing left to flip it back to true, so the
  // panel stayed permanently invisible and unclickable (but still "open"
  // as far as the page's own scroll lock was concerned) from the second
  // WATCH click onward.
  const [openSession, setOpenSession] = useState(0);
  const [displayReelIndex, setDisplayReelIndex] = useState<number | null>(null);
  // The one <video> element, kept mounted and reused across the whole
  // "open session" (Prev/Next, reopen) the same way the single YT.Player
  // instance used to be — a native <video> has no equivalent hazard
  // against recreating it, but rendering it once and swapping its `src`
  // is simpler and keeps this exactly as unintrusive to the rest of the
  // component (mount/unmount, entrance/exit) as the iframe host was.
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);

  // THE ENTRANCE ANIMATION'S OWN CANCELLATION — a real bug, confirmed live:
  // the double-rAF below (`raf1`/`raf2`) is only ever cleaned up when the
  // EFFECT ITSELF re-runs, which needs `mounted` or `openSession` to
  // change — and closing the panel changes neither (`mounted` is set once
  // and never reset; `openSession` only increments on a FRESH open). A
  // close issued before that pending chain's final callback has fired
  // therefore left it free to fire anyway, moments later, forcing `shown`
  // back to `true` and silently reopening an already-closed panel — its
  // full-viewport `pointer-events: auto` then sat on top of everything
  // underneath it, which is what made ReelProjectView's Next Project
  // button unclickable after a fast Back.
  //
  // Two layers, not one: `entranceRafIdsRef` lets the close branch below
  // cancel the pending frames directly and immediately, and
  // `closeTokenRef` is the actual guarantee — bumped on every close, and
  // compared against what the chain captured when it started, so even a
  // callback that already slipped past cancellation (a frame boundary is
  // enough) is a no-op rather than a reopen.
  const entranceRafIdsRef = useRef<[number, number]>([0, 0]);
  const closeTokenRef = useRef(0);
  const cancelEntrance = () => {
    cancelAnimationFrame(entranceRafIdsRef.current[0]);
    cancelAnimationFrame(entranceRafIdsRef.current[1]);
    closeTokenRef.current++;
  };

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recentlyActive, setRecentlyActive] = useState(true);
  const [activity, setActivity] = useState(0);
  const bumpActivity = useCallback(() => {
    setRecentlyActive(true);
    setActivity((v) => v + 1);
  }, []);

  // Same "adjust state during render" pattern as ReelProjectView: react to
  // the `reelIndex` prop only on the render where it actually changed.
  const [prevReelIndex, setPrevReelIndex] = useState<number | null>(null);
  if (prevReelIndex !== reelIndex) {
    const wasOpen = prevReelIndex != null;
    setPrevReelIndex(reelIndex);
    if (reelIndex != null) {
      setDisplayReelIndex(reelIndex);
      if (!wasOpen) {
        setMounted(true);
        setShown(false);
        setDetailsOpen(false);
        setOpenSession((v) => v + 1);
      }
    } else if (wasOpen) {
      setShown(false);
    }
  }

  // The actual cancellation (see `cancelEntrance`'s own comment above) has
  // to live in an effect, not the render-time block above: refs cannot be
  // read during render. Keyed directly on the `reelIndex` PROP rather than
  // on `wasOpen`/`shown` so it fires on the same commit as the render-time
  // close above, not a render later.
  useEffect(() => {
    if (reelIndex == null) cancelEntrance();
  }, [reelIndex]);

  // Keyed off `openSession`, not `mounted` alone — see openSession's own
  // comment above for why `[mounted]` on its own only fired this once.
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
  }, [mounted, openSession]);

  // Escape closes, independent of the project index's own Escape handler
  // (a single-video project reaches this viewer without that one ever
  // having opened).
  useEffect(() => {
    if (reelIndex == null) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reelIndex, onClose]);

  const reel = displayReelIndex != null ? reels[displayReelIndex] : null;
  const videos = reel?.videos ?? [];
  const video = videos[videoIndex];
  const videoSrc = video?.src ?? null;

  // Reset the per-video UI (ready/playing/time/error) the instant the
  // video actually changes — during render, the same "adjust state on a
  // changed value" pattern ReelProjectView uses for its own project
  // switches, so the player-creation effect below only ever has to talk
  // to the external YT API, never to reset local UI state itself.
  const videoKey = video ? `${displayReelIndex}:${videoIndex}` : null;
  const [lastVideoKey, setLastVideoKey] = useState<string | null>(null);
  // The loading mask (below) stays up a little past `ready` — see its own
  // effect — but always comes back the instant the video itself changes,
  // reset here in the same "adjust state during render" pass as the rest
  // of this per-video UI.
  const [maskVisible, setMaskVisible] = useState(true);
  if (videoKey !== lastVideoKey) {
    setLastVideoKey(videoKey);
    if (videoKey != null) {
      setReady(false);
      setPlaying(false);
      setCurrentTime(0);
      setErrorMsg(videoSrc ? null : "This video couldn't be loaded.");
      setMaskVisible(true);
      // DETAILS describes the PROJECT, but it is opened against whatever
      // video is on screen, and leaving it open across a Prev/Next left
      // the panel expanded — and the panel scrolled to — while the thing
      // above it changed underneath. Closing it here puts every video
      // change back on the same footing as a fresh open.
      setDetailsOpen(false);
    }
  }

  // THE LOADING STATE — and only that.
  //
  // The piece's own thumbnail stands in for the picture until there is a
  // picture, then fades.
  //
  // Still keyed to `playing` rather than `ready`, because `ready` fires
  // before the browser has painted a frame and dropping the cover then
  // flashes black; the grace afterwards is now just long enough to cover
  // that first paint rather than long enough to outlast an animation.
  //
  // A SECOND, LONGER TIMER covers the case `playing` never arrives at
  // all — autoplay blocked by browser policy despite being muted (rare,
  // but real on some mobile browsers/embedded webviews), or any other
  // silent stall. Without this the mask — and the "Loading…" label — sat
  // over the frame forever, which is indistinguishable from the viewer
  // being broken. Revealing the paused first frame instead lets the
  // reader see the piece and press Play themselves, same as any other
  // paused video.
  useEffect(() => {
    if (!ready || playing) return;
    const t = window.setTimeout(() => setMaskVisible(false), 4000);
    return () => window.clearTimeout(t);
  }, [ready, playing, videoKey]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setMaskVisible(false), 350);
    return () => window.clearTimeout(t);
  }, [playing, videoKey]);

  // Whenever the panel becomes visible again, make sure it is actually
  // playing and re-cover the frame while that resumes.
  //
  // The element-creation effect below only reloads the source when
  // `videoSrc` itself changes — reopening the SAME video after a close
  // (the common "watch it again" / accidental double WATCH-click path)
  // leaves `videoSrc` unchanged, so that effect does nothing, and the only
  // thing that had happened on close was the pause effect below calling
  // pause(). Without this, a reopen landed on a bare paused frame —
  // looking exactly like "WATCH did nothing" — instead of picking the
  // video back up. Re-arming `maskVisible` here too covers that resume the
  // same way a fresh load is covered.
  //
  // The mask reset is done during render (the same "adjust state on a
  // changed value" pattern the rest of this file uses), not inside the
  // effect below — a setState call synchronous in an effect body forces an
  // extra cascading render. The effect is left to do only what actually
  // has to be an effect: the imperative call out to the element.
  const [prevShownForResume, setPrevShownForResume] = useState(shown);
  if (prevShownForResume !== shown) {
    setPrevShownForResume(shown);
    if (shown) setMaskVisible(true);
  }
  useEffect(() => {
    if (!shown) return;
    videoRef.current?.play().catch(() => {
      // Blocked autoplay on resume — the paused-frame fallback above
      // covers this; the reader presses Play themselves.
    });
  }, [shown]);

  // Load a fresh source into the ONE <video> element whenever the
  // selected video changes — Prev/Next within a reel, or a completely
  // different reel opened later — rather than mounting a new element each
  // time, the same "one instance, swapped in place" idiom the removed
  // YT.Player used, kept for the same reason: the element and its buffered
  // network state live for as long as the tab does; see the visibility
  // effect below for how closing just pauses it instead of tearing it
  // down.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    el.load();
    // Unmuted first, not muted-first: opening this viewer (the WATCH/REELS
    // click) and choosing Prev/Next are both real user gestures, and most
    // browsers' autoplay policy allows unmuted playback started directly
    // from one. Muting unconditionally regardless of that gesture is what
    // the brief calls out as the thing to stop doing — the reader should
    // hear the piece without having to find the mute button first.
    el.muted = false;
    setMuted(false);
    const playAttempt = el.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        // Only reached where the browser blocks unmuted autoplay outright
        // (some mobile browsers, embedded webviews, a visitor's own
        // browser setting) — fall back to muted so playback still starts
        // rather than sitting stalled, but this is a fallback taken once
        // per such block, not a silent permanent switch: the state stays
        // visible on the mute button, and the reader's next click on it,
        // also a real gesture, restores audio immediately.
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {
          // Blocked even muted (rarer still) — the loading-mask fallback
          // timer above reveals the paused frame either way.
        });
      });
    }
  }, [videoSrc]);

  // Pause (never unmount) the instant the panel starts closing — the fade
  // is still playing, but the audience for the audio has already left.
  useEffect(() => {
    if (!shown) videoRef.current?.pause();
  }, [shown]);

  // Poll current time/duration while a video exists. A native <video>
  // fires `timeupdate` on its own, but only every 250ms or so and not
  // reliably enough to gate the transport buttons' first paint — polling
  // keeps this on the exact same clock the removed IFrame version used.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const el = videoRef.current;
      if (!el) return;
      setCurrentTime(el.currentTime);
      setDuration(el.duration || 0);
    }, 250);
    return () => window.clearInterval(id);
  }, [ready]);

  // Controls fade after a few seconds of inactivity. `recentlyActive`
  // only ever tracks that timer; whether controls are actually forced
  // visible (paused, or Details open) is a plain derived value below, not
  // something this effect needs to set — so its body only ever schedules
  // or clears a timeout, never resets UI state directly.
  useEffect(() => {
    const t = window.setTimeout(() => setRecentlyActive(false), 3000);
    return () => window.clearTimeout(t);
  }, [activity]);
  const controlsVisible = !playing || detailsOpen || recentlyActive;

  // DETAILS lives below the fold (see the render below), so opening it has
  // to bring itself into view rather than leave the reader to notice the
  // dialog got taller. Closing returns to the player.
  //
  // Driven off THIS PANEL's own scrollTop, never `scrollIntoView`.
  // scrollIntoView walks up and scrolls every scrollable ancestor it needs
  // to, the document included — which, on a page whose scroll position IS
  // the whole sequence's playhead, means opening DETAILS could quietly
  // move the beat underneath the viewer and leave somewhere else showing
  // on close. Scrolling the panel element directly cannot reach past it.
  // The section's own offsetTop is exactly the stage's height (the dialog
  // is `position: fixed`, so it is the offset parent), so this needs no
  // measurement of its own.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (detailsOpen) {
      const top = detailsSectionRef.current?.offsetTop ?? 0;
      panel.scrollTo({ top, behavior: "smooth" });
    } else {
      panel.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [detailsOpen]);

  if (!mounted || !reel) return null;

  const isLandscape = reel.ratio >= 1;
  const canPrev = videoIndex > 0;
  const canNext = videoIndex < videos.length - 1;
  const t = clamp01(shown ? 1 : 0);

  const togglePlay = () => {
    const el = videoRef.current;
    // `ready` — commands issued before the element has processed the
    // current source are the same class of hazard the old IFrame API had.
    if (!el || !ready) return;
    if (playing) el.pause();
    else el.play().catch(() => {});
  };
  const restart = () => {
    const el = videoRef.current;
    if (!el || !ready) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  };
  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted((v) => !v);
  };
  const seek = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !ready || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = clamp01((e.clientX - rect.left) / rect.width);
    el.currentTime = fraction * duration;
    setCurrentTime(fraction * duration);
  };

  const progressFraction = duration > 0 ? clamp01(currentTime / duration) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!shown}
      aria-label={`${reel.title} — video ${videoIndex + 1} of ${videos.length}`}
      ref={panelRef}
      data-reel-modal-scroll
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        // A soft centre-weighted wash rather than flat black — the frame
        // this player sits in reads as composed instead of as an edge with
        // nothing beyond it.
        background:
          "radial-gradient(120% 120% at 50% 50%, #101114 0%, #08080a 55%, #000 100%)",
        opacity: t,
        transition: "opacity 380ms cubic-bezier(0.16,1,0.3,1)",
        // The panel is never unmounted on close any more (see the
        // player-creation effect above) — only faded out and left
        // non-interactive, the same idiom the control bars below already
        // use for their own show/hide.
        pointerEvents: shown ? "auto" : "none",
        fontFamily: sans,
        color: "#fff",
        // The details panel (below) is appended AFTER the stage rather
        // than drawn over it, so open content can make this dialog taller
        // than one viewport — this is what lets the reader scroll down to
        // it instead of it covering the video. `data-reel-modal-scroll`
        // (see HeroSection's own wheel/touch lock) is what lets a wheel
        // event actually reach this scroll instead of being swallowed by
        // the page-wide lock. `overscrollBehavior: contain` is what keeps
        // that safe with DETAILS closed, when this element has nothing of
        // its own left to scroll: without it, a wheel event landing here
        // (now that the page-wide lock steps aside for it) would chain
        // straight through to the page underneath the moment it hits this
        // element's scroll boundary — which, at exactly 100vh of content,
        // is immediately — and silently resume scrolling the track behind
        // the open viewer.
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      <div
        onPointerMove={bumpActivity}
        onClick={bumpActivity}
        style={{
          // Was `position: absolute; inset: 0`, sized off the dialog above
          // it. Now a normal-flow block instead, but still pinned to
          // EXACTLY one viewport height (not min-height) so opening
          // DETAILS below it can never resize or reflow the player itself
          // — only the dialog around it grows and becomes scrollable.
          //
          // `dvh`, not `vh`: on a phone `100vh` is the viewport with the
          // browser's own chrome COLLAPSED, so a stage sized in vh runs
          // taller than what is actually on screen and pushes the bottom
          // control bar underneath the address bar — the transport is
          // there, and cannot be reached.  `dvh` tracks the viewport that
          // actually exists right now.
          position: "relative",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          padding: "clamp(16px, 3vw, 40px)",
          boxSizing: "border-box",
        }}
      >
        {/* THE VIDEO. Dominant, aspect-ratio true to its source — the
            same landscape-wide / portrait-capped rule as the project
            index's own media, just given more of the frame here. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              height: "100%",
              width: isLandscape ? "100%" : "auto",
              maxWidth: isLandscape ? "100%" : "min(100%, 62vh)",
              maxHeight: isLandscape ? "min(100%, 88vh)" : "94%",
              aspectRatio: String(reel.ratio),
              borderRadius: 6,
              overflow: "hidden",
              background: "#050505",
              border: "1px solid rgba(255,255,255,0.08)",
              // The same restrained premium glow the rest of the site's
              // cards carry, so the player reads as composed within the
              // frame rather than as a flat rectangle floating on black.
              boxShadow:
                "0 0 70px rgba(255,255,255,0.05), 0 40px 110px rgba(0,0,0,0.75)",
            }}
          >
            <video
              ref={videoRef}
              src={videoSrc ?? undefined}
              poster={video?.thumbnail}
              playsInline
              // "metadata", not "auto": this element is only ever given a
              // source when a video is actually about to play (see the
              // load/play effect below, which calls .play() immediately),
              // so "auto" bought nothing there and cost something when
              // autoplay is blocked — a browser can keep buffering well
              // ahead of a paused, blocked-autoplay video under "auto",
              // which is exactly the "downloading the whole file before
              // playback" this is meant to avoid. "metadata" fetches just
              // enough to know duration/dimensions; calling .play() is
              // what actually starts the real, progressive/byte-range
              // media fetch either way, so first-frame latency in the
              // normal (unblocked) path is unchanged.
              preload="metadata"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                // "contain", not "cover": the wrapper is already sized to
                // this reel's own aspect ratio (see `aspectRatio` above),
                // so a source that matches it exactly fills the box either
                // way — contain is what keeps a source that does not match
                // exactly (a pixel-aspect rounding difference) from ever
                // cropping into the actual footage.
                objectFit: "contain",
                background: "#050505",
                pointerEvents: "none",
              }}
              onLoadedData={() => setReady(true)}
              onPlay={() => {
                setReady(true);
                setPlaying(true);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => setErrorMsg("This video can't be played here.")}
            />
            {/* An OPAQUE mask, not just a label: the video's own first
                frame does not paint until playback actually starts, and a
                transparent overlay would leave a flash of the empty black
                element showing through behind the text. Solid until ready,
                then a plain
                fade rather than an abrupt unmount. */}
            {!errorMsg && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // The selected video's own thumbnail, not a flat colour
                  // — the reader sees the actual piece immediately instead
                  // of a blank wait, and the dark wash keeps the "Loading…"
                  // label legible over it.
                  backgroundImage: video?.thumbnail
                    ? `linear-gradient(rgba(5,5,5,0.6), rgba(5,5,5,0.6)), url(${video.thumbnail})`
                    : undefined,
                  backgroundColor: "#050505",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: maskVisible ? 1 : 0,
                  transition: "opacity 400ms ease",
                  pointerEvents: "none",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Loading…
              </div>
            )}
            {errorMsg && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  textAlign: "center",
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{errorMsg}</div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.3)",
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
                  Back
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TOP: Back / Details. */}
        <div
          style={{
            position: "absolute",
            top: "clamp(16px, 3vw, 40px)",
            left: "clamp(16px, 3vw, 40px)",
            right: "clamp(16px, 3vw, 40px)",
            zIndex: 2,
            display: "flex",
            justifyContent: "space-between",
            opacity: controlsVisible ? 1 : 0,
            transition: "opacity 300ms ease",
            // `shown` too, not just `controlsVisible`: CSS pointer-events
            // is not purely inherited — a child set to `auto` overrides an
            // ancestor's `none`, so without this the dialog's own
            // `pointerEvents: shown ? "auto" : "none"` did nothing to stop
            // THIS bar (controlsVisible is almost always true regardless
            // of `shown`) from still catching clicks meant for whatever
            // sits underneath a closed viewer.
            pointerEvents: shown && controlsVisible ? "auto" : "none",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 6px rgba(0,0,0,0.8)",
            }}
          >
            <span aria-hidden>←</span> Back
          </button>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-pressed={detailsOpen}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 999,
              padding: "7px 16px",
              cursor: "pointer",
              fontFamily: sans,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#fff",
            }}
          >
            Details
          </button>
        </div>

        {/* BOTTOM: progress, time, transport, video number. */}
        <div
          style={{
            position: "absolute",
            left: "clamp(16px, 3vw, 40px)",
            right: "clamp(16px, 3vw, 40px)",
            bottom: "clamp(16px, 3vw, 36px)",
            zIndex: 2,
            opacity: controlsVisible ? 1 : 0,
            transition: "opacity 300ms ease",
            // See the matching comment on the TOP bar above.
            pointerEvents: shown && controlsVisible ? "auto" : "none",
          }}
        >
          <div
            onPointerDown={seek}
            style={{
              position: "relative",
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.22)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progressFraction * 100}%`,
                borderRadius: 2,
                background: "rgba(255,255,255,0.9)",
              }}
            />
          </div>

          {/* The transport itself, as one coherent bar rather than a loose
              row of icons — a big central play/pause with its own restful
              ring, prev/next either side of it, restart and mute as the
              cluster's own two satellites, the same set of controls as
              before just read as one grouped instrument instead of eight
              things scattered along a line. */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(14,15,18,0.55)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.6)",
                minWidth: 80,
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div
              style={{
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "clamp(10px, 2vw, 20px)",
              }}
            >
              <button type="button" onClick={restart} aria-label="Restart" style={transportSatelliteStyle}>
                ↺
              </button>
              {canPrev ? (
                <button
                  type="button"
                  onClick={() => onVideoChange(videoIndex - 1)}
                  aria-label="Previous video"
                  style={transportRingStyle}
                >
                  ⏮
                </button>
              ) : (
                <span aria-hidden style={transportRingSpacerStyle} />
              )}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                style={playButtonStyle}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              {canNext ? (
                <button
                  type="button"
                  onClick={() => onVideoChange(videoIndex + 1)}
                  aria-label="Next video"
                  style={transportRingStyle}
                >
                  ⏭
                </button>
              ) : (
                <span aria-hidden style={transportRingSpacerStyle} />
              )}
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                aria-pressed={muted}
                style={transportSatelliteStyle}
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.6)",
                minWidth: 80,
                textAlign: "right",
              }}
            >
              {String(videoIndex + 1).padStart(2, "0")} / {String(videos.length).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {/* DETAILS: the project's own data, nothing invented. Appended BELOW
          the player/control bar as ordinary page content — not an overlay
          drawn on top of the video — so opening it never covers playback;
          the stage above is pinned to a fixed 100dvh (see its own comment)
          so this section only ever extends the dialog, never resizes or
          reflows the player. Scrolled into view on open (see the effect
          above) since it starts below the fold on most screens. Closing it
          (the DETAILS button again, or Escape) returns to the same video,
          exactly as before. */}
      {detailsOpen && (
        <div
          ref={detailsSectionRef}
          style={{
            position: "relative",
            padding: "0 clamp(16px, 3vw, 40px) clamp(28px, 4vw, 48px)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: 620,
              margin: "0 auto",
              padding: "clamp(20px, 3vw, 32px)",
              borderRadius: 16,
              background: "rgba(10,10,12,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(10px)",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "clamp(20px, 2.4vw, 28px)",
                fontWeight: 500,
                letterSpacing: "0.005em",
              }}
            >
              {reel.title}
            </h3>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
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
                  marginTop: 14,
                  fontSize: "clamp(14px, 1.1vw, 16px)",
                  lineHeight: 1.65,
                  fontWeight: 300,
                  letterSpacing: "0.02em",
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                {reel.description}
              </p>
            )}
            <div
              style={{
                marginTop: 14,
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
        </div>
      )}
    </div>
  );
}

// The transport cluster's three tiers, smallest to largest — a satellite
// icon (restart, mute), a ringed prev/next, and the big central
// play/pause with its own resting glow. Same restrained language as the
// rest of the site (a soft white glow, never a colour), just given more
// presence than a bare row of glyphs.
const transportSatelliteStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 6,
  cursor: "pointer",
  color: "rgba(255,255,255,0.85)",
  fontSize: 16,
  lineHeight: 1,
};

const transportRingStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff",
  cursor: "pointer",
  padding: 0,
  fontSize: 15,
  lineHeight: 1,
};

// Holds the prev/next slot's width at either end of a project, so the
// play button stays dead centre in the cluster whether or not that side's
// button is rendered — a missing prev/next should not visibly recentre
// the whole transport.
const transportRingSpacerStyle: CSSProperties = {
  width: 38,
  height: 38,
  display: "inline-block",
};

const playButtonStyle: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.1)",
  border: "1.5px solid rgba(255,255,255,0.55)",
  boxShadow: "0 0 0 4px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.16)",
  color: "#fff",
  cursor: "pointer",
  padding: 0,
  fontSize: 20,
  lineHeight: 1,
};
