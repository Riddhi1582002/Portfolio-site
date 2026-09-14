"use client";

// THE IMMERSIVE VIDEO VIEWER.
//
// YouTube is only the host: `controls: 0` turns off its own chrome, and
// everything the viewer shows — play/pause, restart, progress, prev/next
// video, details, back — is our own restrained UI on top of a bare
// <iframe>. Opened either from the project index's WATCH button (a
// multi-video project) or directly from a REELS card (a single-video
// project skips the project index entirely) — either way this component
// only needs to know which reel and which of its videos, both owned by
// HeroSection so the project index (if any) stays in sync underneath.
//
// Mount/unmount mirrors ReelProjectView: two flags so the panel enters
// and exits with a real transition, only actually unmounting once the
// exit transition finishes. The YT.Player itself is created once per
// "open session" (keyed on `mounted`) and told to load a different video
// in place — via `loadVideoById`, not a fresh iframe — whenever
// `videoIndex` changes, which is what keeps prev/next feeling like the
// same viewer rather than a reopen.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Reel } from "./ReelStrip";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return shorts[1];
    const v = u.searchParams.get("v");
    if (v) return v;
    return null;
  } catch {
    return null;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// The minimal slice of the YouTube IFrame Player API this viewer uses.
type YTPlayerInstance = {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(videoId: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
  // Undocumented but long-standing IFrame API method: forces the captions
  // module out of the player. `cc_load_policy: 0` (set below) only tells
  // YouTube not to load captions BY DEFAULT — some videos carry
  // creator/auto-translate settings that turn them on anyway, ignoring
  // that flag. unloadModule is the one lever that removes them regardless
  // of why they turned on, so it is called on every point captions could
  // reappear (ready, a state change, and a fresh loadVideoById), not just
  // once at creation.
  unloadModule?(moduleName: string): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number>;
      events?: {
        onReady?: (e: { target: YTPlayerInstance }) => void;
        onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
        onError?: (e: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    // The script can fail outright (network/ad-block/offline) or simply
    // never call back — neither should leave the viewer stuck on
    // "Loading…" forever, so both are treated as a load failure and the
    // cached promise is cleared to let a later retry (closing and
    // reopening the viewer) try again from scratch.
    const timeout = window.setTimeout(() => {
      ytApiPromise = null;
      reject(new Error("Timed out loading the YouTube player."));
    }, 10000);
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      prevReady?.();
      if (window.YT) resolve(window.YT);
      else {
        ytApiPromise = null;
        reject(new Error("YouTube player failed to initialise."));
      }
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      window.clearTimeout(timeout);
      ytApiPromise = null;
      reject(new Error("Failed to load the YouTube player."));
    };
    document.head.appendChild(tag);
  });
  return ytApiPromise;
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
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
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

  // Keyed off `openSession`, not `mounted` alone — see openSession's own
  // comment above for why `[mounted]` on its own only fired this once.
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
  // Pure derivation, not state: parsing the URL can't itself need a
  // render-triggered reset.
  const videoId = video ? extractYouTubeId(video.src) : null;

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
      setErrorMsg(videoId ? null : "This video couldn't be loaded.");
      setMaskVisible(true);
    }
  }

  // The loading mask stays up a little past actual playback starting, not
  // just past `ready`: YouTube's own cued/playing-state chrome (title
  // card, channel avatar, "watch on YouTube") sits on the iframe for a few
  // seconds after the player begins playing, and that chrome — the
  // channel identity this viewer is meant to keep out of sight — is
  // exactly what a short mask keyed to `ready` alone was letting through,
  // since `ready` fires before the browser has actually painted a frame.
  // Gated on `playing` rather than `ready`: if autoplay is slow to
  // actually start (buffering, a blocked first attempt), the mask stays up
  // through that too instead of dropping early onto a paused, chrome-on
  // frame. A fixed extra beat covers YouTube's own chip animation without
  // an ongoing overlay sitting over live playback indefinitely.
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setMaskVisible(false), 3000);
    return () => window.clearTimeout(t);
  }, [playing, videoKey]);

  // Whenever the panel becomes visible again, make sure it is actually
  // playing and re-cover the frame while that resumes.
  //
  // The player-creation effect above only calls loadVideoById when
  // `videoId` itself changes — reopening the SAME video after a close (the
  // common "watch it again" / accidental double WATCH-click path) leaves
  // `videoId` unchanged, so that effect does nothing, and the only thing
  // that had happened on close was the pause effect below calling
  // pauseVideo(). Without this, a reopen landed on a bare paused frame —
  // looking exactly like "WATCH did nothing" — instead of picking the
  // video back up. Re-arming `maskVisible` here too covers that resume the
  // same way a fresh load is covered, so YouTube's own paused-state chrome
  // never gets a frame to show through on either.
  //
  // The mask reset is done during render (the same "adjust state on a
  // changed value" pattern the rest of this file uses), not inside the
  // effect below — a setState call synchronous in an effect body forces an
  // extra cascading render. The effect is left to do only what actually
  // has to be an effect: the imperative call out to the player.
  const [prevShownForResume, setPrevShownForResume] = useState(shown);
  if (prevShownForResume !== shown) {
    setPrevShownForResume(shown);
    if (shown) setMaskVisible(true);
  }
  useEffect(() => {
    if (shown) playerRef.current?.playVideo();
  }, [shown]);

  // Create the player ONCE EVER per page session, then swap videos in
  // place — via `loadVideoById`, never a fresh iframe — for every open
  // after that, whether that is Prev/Next within a reel or a completely
  // different reel opened later. Repeatedly destroying and recreating the
  // YT.Player on every close/reopen is what made the viewer occasionally
  // glitch badly enough to need a page reload; the player and its iframe
  // now live for as long as the tab does; see the visibility effect below
  // for how closing just pauses and hides it instead of tearing it down.
  useEffect(() => {
    if (!videoId) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      // Captions can turn back on with a newly loaded video even though
      // this same player had them stripped for the last one — see
      // unloadModule's own comment on the type above.
      try {
        playerRef.current.unloadModule?.("captions");
      } catch {
        // Non-essential.
      }
      return;
    }

    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current || playerRef.current) return;
        const player = new YT.Player(hostRef.current, {
          // Without these the IFrame API defaults to a fixed 640x390 iframe
          // and — since creating the player REPLACES the host element
          // rather than filling it — the CSS on that host (position:
          // absolute; inset:0) goes with it. The result is a small,
          // conventional embed sitting at the top-left of its container
          // instead of filling the composed frame this viewer builds for
          // it, so both dimensions are pinned to 100% here and the iframe's
          // own inline style is reasserted below as a second guarantee.
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            fs: 0,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              try {
                const iframe = e.target.getIframe();
                iframe.setAttribute(
                  "allow",
                  "autoplay; encrypted-media; picture-in-picture"
                );
                iframe.style.position = "absolute";
                iframe.style.inset = "0";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = "0";
              } catch {
                // Non-essential; playback still works without it.
              }
              try {
                e.target.unloadModule?.("captions");
              } catch {
                // Non-essential.
              }
              setReady(true);
              // Muted first: unmuted autoplay is blocked outright by most
              // browsers unless the visitor has already interacted with
              // this exact site, and a blocked autoplay leaves the video
              // sitting on YouTube's own paused/cued frame — thumbnail,
              // channel card and all — which is exactly the "YouTube
              // branding" chrome this viewer is meant to keep out of
              // sight. Muted autoplay is universally allowed, so the
              // video always actually starts; the mute button lets the
              // reader turn sound on with their own click, which is a
              // real user gesture and always permitted.
              e.target.mute();
              setMuted(true);
              e.target.playVideo();
            },
            onStateChange: (e) => {
              if (cancelled) return;
              setPlaying(e.data === YT.PlayerState.PLAYING);
              // Replaying (seek-to-0 restart, or simply resuming after a
              // pause) is one of the points captions can silently turn
              // back on — reasserted here rather than only at creation.
              try {
                e.target.unloadModule?.("captions");
              } catch {
                // Non-essential.
              }
            },
            onError: () => {
              if (cancelled) return;
              setErrorMsg("This video can't be played here.");
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setErrorMsg("This video couldn't be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Pause (never destroy) the instant the panel starts closing — the fade
  // is still playing, but the audience for the audio has already left.
  useEffect(() => {
    if (!shown) playerRef.current?.pauseVideo();
  }, [shown]);

  // The one and only teardown: a real unmount of this component (the page
  // itself navigating away), not a close. Opening/closing the viewer never
  // reaches this.
  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    []
  );

  // Poll current time/duration while a player exists — the IFrame API has
  // no timeupdate event, only getters.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime());
      setDuration(player.getDuration());
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

  // DETAILS lives below the fold on most screens (see the render below),
  // so opening it needs to actually bring it into view rather than leave
  // the reader to notice the dialog grew and scroll down themselves.
  // Closing scrolls back to the top, landing back on the player rather
  // than wherever the reader happened to be scrolled to.
  useEffect(() => {
    if (detailsOpen) {
      detailsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [detailsOpen]);

  if (!mounted || !reel) return null;

  const isLandscape = reel.ratio >= 1;
  const canPrev = videoIndex > 0;
  const canNext = videoIndex < videos.length - 1;
  const t = clamp01(shown ? 1 : 0);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };
  const restart = () => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0, true);
    player.playVideo();
  };
  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  };
  const seek = (e: ReactPointerEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = clamp01((e.clientX - rect.left) / rect.width);
    player.seekTo(fraction * duration, true);
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
          position: "relative",
          height: "100vh",
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
            <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
            {/* An OPAQUE mask, not just a label: YouTube's own cued-state
                chrome (its title card, thumbnail and logo) sits on the
                iframe the instant it is created, well before `onReady`, and
                a transparent overlay would leave that showing through
                behind the text — exactly the branding this viewer is
                meant to keep out of sight. Solid until ready, then a plain
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
                  // label (and, incidentally, whatever native chrome the
                  // iframe shows before playback starts) legible and out
                  // of the way underneath it.
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
            pointerEvents: controlsVisible ? "auto" : "none",
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
            pointerEvents: controlsVisible ? "auto" : "none",
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
          the stage above is pinned to a fixed 100vh (see its own comment)
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
