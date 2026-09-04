"use client";

// Hero -> REELS portal. STATIC CHECKPOINT: portalProgress is pinned to 0.
// No GSAP, no scroll drive, no phase progression yet.
//
// Compositing rule, unchanged from the approved architecture:
//   - ART is foreground and is never masked, clipped, scaled or distorted.
//   - The reel video sits behind it and is the only clipped thing.
//   - The crossbar/counter geometry is never painted as artwork; it exists
//     only inside <clipPath>.
//
// DELIBERATE DEVIATION from the written architecture: the video layer is
// painted ABOVE ART, not behind it. The spec's "foreground ART, REELS
// behind" assumes the aperture is a hole in the glyph, but the A's
// crossbar is *ink*, not a counter — there is nothing to see through from
// behind, because the crossbar stroke is opaque white and simply covers
// whatever sits under it. Painting the video behind would need a second
// mask on ART to punch the crossbar out, which the spec rules out.
//
// Clipped to a crossbar-sized aperture, the video covers nothing except
// the inside of that aperture, so ART still reads as the foreground and
// its own geometry is never touched. This is the correction that makes
// the one-clip-path rule work on ink rather than on a counter.
//
// There is exactly ONE clipPath. Its contents come from getPortalGeometry(),
// which CALCULATES the aperture for the current progress. Nothing is morphed
// and MorphSVGPlugin is not used.

import { useEffect, useRef, useState } from "react";
import {
  ART_SCALE_DEEP,
  ART_Y_DEEP,
  GLOW_STRENGTH,
  STAGE_H,
  STAGE_W,
} from "./HeroSection";
import { ART_VIEWBOX, CROSSBAR_CENTER, CROSSBAR_PATH, LETTER_PATHS } from "./artGeometry";
import {
  COUNTER_POLY,
  PHASE_1_END,
  PHASE_2_END,
  artOpacity,
  bbox,
  getPortalGeometry,
  polyToPath,
  rectPoly,
  seedRect,
  videoOpacity,
  type Pt,
} from "./portalGeometry";

const SCROLL_LENGTH_VH = 220;

// Time constant for easing the rendered progress toward the raw scroll
// position. A wheel notch is a discrete jump; scrubbing an aperture
// straight off scrollY makes it grow in visible steps.
const PORTAL_SMOOTH_TAU = 0.09;

// One font unit (upm 1000) in stage units, at the hero's ART size.
const ART_FONT_PX = 462 * ART_SCALE_DEEP;
const UNIT = ART_FONT_PX / 1000;
const ART_W = ART_VIEWBOX.width * UNIT;
const ART_X = STAGE_W / 2 - ART_W / 2;
const ART_BASELINE = 540 + ART_Y_DEEP - ((462 * 0.86) / 2) * ART_SCALE_DEEP + 0.68 * ART_FONT_PX;
const ART_Y = ART_BASELINE - ART_VIEWBOX.height * UNIT;

// Places font-unit geometry into stage coordinates.
const PORTAL_TRANSFORM = `translate(${ART_X} ${ART_Y}) scale(${UNIT})`;
const toStage = (x: number, y: number): Pt => ({ x: ART_X + x * UNIT, y: ART_Y + y * UNIT });

const COUNTER_STAGE: Pt[] = [];
for (let i = 0; i < COUNTER_POLY.length; i += 2) {
  COUNTER_STAGE.push(toStage(COUNTER_POLY[i], COUNTER_POLY[i + 1]));
}
const PORTAL_CENTRE = toStage(CROSSBAR_CENTER.x, CROSSBAR_CENTER.y);
const COUNTER_BOX = bbox(COUNTER_STAGE);
const STAGE_CENTRE: Pt = { x: STAGE_W / 2, y: STAGE_H / 2 };
// The native frame settles at this height; width follows from the video's
// own ratio, so a portrait reel stays portrait on a wide viewport.
const FINAL_HEIGHT = STAGE_H * 0.78;

/**
 * Where the fixed video frame sits. The video never moves and never
 * scales — only the window over it changes — so this one rectangle has to
 * satisfy two constraints at once:
 *
 *   1. contain every aperture the transition ever opens (the crossbar,
 *      the counter, and the seed frame), or the opening would show black
 *      backdrop where there is no video to reveal;
 *   2. sit wholly inside the stage, so the settled frame reads as a
 *      correctly-proportioned frame rather than one running off an edge.
 *
 * Centring it mid-stage fails (1): the aperture opens inside the A, which
 * is left of centre, so a centred frame does not contain it. Centring it
 * on the A fails (2). So the frame starts from the A and is clamped into
 * the band where both hold.
 */
function frameCentre(seed: { cx: number; cy: number; w: number; h: number }, w: number, h: number): Pt {
  const clamp = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
  const apertureBox = {
    minX: Math.min(COUNTER_BOX.minX, seed.cx - seed.w / 2),
    maxX: Math.max(COUNTER_BOX.maxX, seed.cx + seed.w / 2),
    minY: Math.min(COUNTER_BOX.minY, seed.cy - seed.h / 2),
    maxY: Math.max(COUNTER_BOX.maxY, seed.cy + seed.h / 2),
  };
  const wantX = (COUNTER_BOX.minX + COUNTER_BOX.maxX) / 2;
  const wantY = (COUNTER_BOX.minY + COUNTER_BOX.maxY) / 2;
  return {
    x: clamp(wantX, Math.max(w / 2, apertureBox.maxX - w / 2), Math.min(STAGE_W - w / 2, apertureBox.minX + w / 2)),
    y: clamp(wantY, Math.max(h / 2, apertureBox.maxY - h / 2), Math.min(STAGE_H - h / 2, apertureBox.minY + h / 2)),
  };
}

const ART_DEEP_G = 0.5 * GLOW_STRENGTH;

export default function FilmstripEntry() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState(false);
  // THE single master progress. Aperture geometry, ART opacity, video
  // reveal opacity and the final handoff are all functions of this one
  // value. There is one scroll listener in this component and no other
  // progress variable anywhere in the portal.
  const [portalProgress, setPortalProgress] = useState(0);
  const targetRef = useRef(0);
  const smoothRef = useRef(0);
  const primedRef = useRef(false);
  // Read off the loaded media rather than hardcoded, so a reel with a
  // different native ratio works without touching this file. 920/1080
  // until metadata arrives.
  const [videoAspect, setVideoAspect] = useState(920 / 1080);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setDebug(new URLSearchParams(window.location.search).get("debugPortal") === "true")
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      if (stageRef.current) stageRef.current.style.transform = `scale(${scale})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // One listener writes the raw target; one rAF loop eases the rendered
  // value toward it. `?portalProgress=<n>` pins it instead, so a given
  // frame can be captured exactly rather than scrolled to approximately.
  useEffect(() => {
    const pinned = new URLSearchParams(window.location.search).get("portalProgress");
    const pinnedValue = pinned === null ? null : Number(pinned);
    if (pinnedValue !== null && Number.isFinite(pinnedValue)) {
      const id = requestAnimationFrame(() =>
        setPortalProgress(Math.min(1, Math.max(0, pinnedValue)))
      );
      return () => cancelAnimationFrame(id);
    }

    let raf = 0;
    let scrollRaf: number | null = null;
    const measure = () => {
      scrollRaf = null;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      targetRef.current = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      if (!primedRef.current) {
        primedRef.current = true;
        smoothRef.current = targetRef.current;
        setPortalProgress(targetRef.current);
      }
    };
    const onScroll = () => {
      if (scrollRaf == null) scrollRaf = requestAnimationFrame(measure);
    };
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt / PORTAL_SMOOTH_TAU);
      const next = smoothRef.current + (targetRef.current - smoothRef.current) * k;
      smoothRef.current = Math.abs(targetRef.current - next) < 0.0002 ? targetRef.current : next;
      setPortalProgress(smoothRef.current);
      raf = requestAnimationFrame(tick);
    };
    measure();
    raf = requestAnimationFrame(tick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const onMeta = () => {
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
  };

  const videoH = FINAL_HEIGHT;
  const videoW = videoH * videoAspect;
  const seed = seedRect(COUNTER_STAGE, videoAspect);
  const FRAME_CENTRE = frameCentre(seed, videoW, videoH);

  const crossbarChild = { d: CROSSBAR_PATH, transform: PORTAL_TRANSFORM };
  const geo = getPortalGeometry(portalProgress, {
    counter: COUNTER_STAGE,
    crossbar: crossbarChild,
    centre: PORTAL_CENTRE,
    videoAspect,
    // Where the frame settles: the middle of the stage. See the note on
    // PortalGeometry.travel for why it cannot simply live there.
    stageCentre: STAGE_CENTRE,
    finalHeight: FINAL_HEIGHT,
  });

  // The media is drawn at one size for the whole transition — its native
  // ratio at the settled height — and is never scaled, stretched or
  // cropped. Through phases 1 and 2 it is also completely stationary,
  // sitting over the letter so the aperture has real footage to reveal.
  //
  // In phase 3, once the frame has separated from the A, media and
  // aperture travel together by the same fraction into the composed
  // centre. They move in lockstep, so the aperture never runs off the
  // footage and what you see is always the same video, just more of it.
  const travel = geo.travel ?? 0;
  const videoCentreX = FRAME_CENTRE.x + (STAGE_CENTRE.x - FRAME_CENTRE.x) * travel;
  const videoCentreY = FRAME_CENTRE.y + (STAGE_CENTRE.y - FRAME_CENTRE.y) * travel;
  const videoLeft = videoCentreX - videoW / 2;
  const videoTop = videoCentreY - videoH / 2;

  return (
    <div ref={trackRef} style={{ position: "relative", height: `${SCROLL_LENGTH_VH}vh`, zIndex: 1 }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={stageRef}
          style={{ position: "relative", width: STAGE_W, height: STAGE_H, flexShrink: 0 }}
        >
          {/* The one and only clipPath. Its children are recomputed from
              portalProgress; they are never painted. */}
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
            <defs>
              <clipPath id="reelsPortal" clipPathUnits="userSpaceOnUse">
                {geo.children.map((c, i) => (
                  <path key={i} d={c.d} transform={c.transform} />
                ))}
              </clipPath>
            </defs>
          </svg>

          {/* ART — untouched. No mask, no clip, no scale, no duplicate path. */}
          <svg
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            width={STAGE_W}
            height={STAGE_H}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: "none",
              opacity: artOpacity(portalProgress),
            }}
            aria-label="ART"
          >
            <g
              transform={PORTAL_TRANSFORM}
              fill="#fff"
              style={{
                filter: `drop-shadow(0 0 ${2 * ART_DEEP_G}px rgba(255,255,255,0.9)) drop-shadow(0 0 ${8 * ART_DEEP_G}px rgba(255,255,255,0.6)) drop-shadow(0 0 ${20 * ART_DEEP_G}px rgba(255,255,255,0.35))`,
              }}
            >
              <path d={LETTER_PATHS.A} />
              <path d={LETTER_PATHS.R} />
              <path d={LETTER_PATHS.T} />
            </g>
          </svg>

          {/* The reel, at its native ratio, fixed. The clip-path is the one
              and only reveal rule. */}
          <div
            id="reels-layer"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              clipPath: "url(#reelsPortal)",
            }}
          >
            {/* Opaque black inside the aperture, under the video. This is
                what lets the video fade in gently over phase 1: without
                it, a partly transparent video lets ART's own white
                crossbar show through the opening and blend with the
                footage, and the aperture reads as grey letterform rather
                than as video emerging out of the dark. */}
            <div style={{ position: "absolute", inset: 0, background: "#000" }} />
            <video
              ref={videoRef}
              id="reel-video"
              autoPlay
              muted
              loop
              playsInline
              onLoadedMetadata={onMeta}
              style={{
                position: "absolute",
                left: videoLeft,
                top: videoTop,
                width: videoW,
                height: videoH,
                objectFit: "cover",
                opacity: videoOpacity(portalProgress),
              }}
            >
              {/* PLACEHOLDER REEL — synthetic 920x1080 clip, not final
                  content. The supplied hero clip could not stand in here:
                  it is almost entirely black (peak luma 64/255, content
                  only at the frame edges), so nothing would be visible
                  through a crossbar-thin aperture and there would be no
                  way to tell real clipping from a painted shape. Replace
                  both files with the real showreel; nothing in this
                  component hardcodes its size — the aspect ratio is read
                  from the loaded media.
                  VP9 first: H.264 is not decodable in every browser used
                  to verify this. */}
              <source src="/video/reel-1.webm" type="video/webm" />
              <source src="/video/reel-1.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Debug only — never part of the clipPath, absent when off. */}
          {debug && (
            <svg
              viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
              width={STAGE_W}
              height={STAGE_H}
              style={{ position: "absolute", inset: 0, zIndex: 9, pointerEvents: "none" }}
            >
              {/* original crossbar geometry */}
              <path d={CROSSBAR_PATH} transform={PORTAL_TRANSFORM} fill="none" stroke="#f00" strokeWidth={2} />
              {/* A negative-space boundary */}
              <path d={polyToPath(COUNTER_STAGE)} fill="none" stroke="#0f0" strokeWidth={2} strokeDasharray="10 6" />
              {/* current computed aperture */}
              {geo.children.map((c, i) => (
                <path key={i} d={c.d} transform={c.transform} fill="none" stroke="#0ff" strokeWidth={3} />
              ))}
              {/* native video-frame boundary (seed + settled, both native ratio) */}
              <path d={polyToPath(rectPoly(seed.cx, seed.cy, seed.w, seed.h))} fill="none" stroke="#ff0" strokeWidth={2} strokeDasharray="14 8" />
              <path d={polyToPath(rectPoly(FRAME_CENTRE.x, FRAME_CENTRE.y, videoW, videoH))} fill="none" stroke="#ff8c00" strokeWidth={2} strokeDasharray="4 6" />
              {/* portal centre */}
              <circle cx={PORTAL_CENTRE.x} cy={PORTAL_CENTRE.y} r={7} fill="#f0f" />
              {geo.discRadius > 0 && (
                <circle cx={PORTAL_CENTRE.x} cy={PORTAL_CENTRE.y} r={geo.discRadius} fill="none" stroke="#f0f" strokeWidth={1} strokeDasharray="6 6" />
              )}
              <text x={40} y={56} fill="#0f0" fontSize={26} fontFamily="monospace">
                portalProgress {portalProgress.toFixed(3)}  phase {geo.phase}
              </text>
              <text x={40} y={90} fill="#0f0" fontSize={22} fontFamily="monospace">
                phases 0-{PHASE_1_END} crossbar / -{PHASE_2_END} counter / -1 video
              </text>
              <text x={40} y={120} fill="#0f0" fontSize={22} fontFamily="monospace">
                clip children {geo.children.length}  disc r {geo.discRadius.toFixed(1)}  aspect {videoAspect.toFixed(4)}
              </text>
              <text x={40} y={150} fill="#0f0" fontSize={22} fontFamily="monospace">
                counter bbox {(COUNTER_BOX.maxX - COUNTER_BOX.minX).toFixed(0)}x{(COUNTER_BOX.maxY - COUNTER_BOX.minY).toFixed(0)}  frame {videoW.toFixed(0)}x{videoH.toFixed(0)}
              </text>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
