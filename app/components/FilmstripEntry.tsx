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
// Note on z-order: the video layer is painted above ART rather than behind
// it. With it behind, ART's crossbar stroke is opaque white and covers it,
// so video could only show through by also masking ART — a second mask,
// which the spec rules out. Clipped to the aperture, the video covers
// nothing except the inside of the aperture, so ART still reads as the
// foreground and is itself completely untouched.
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

// Static checkpoint. The scroll drive replaces this once approved.
const PORTAL_PROGRESS = 0;

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
// Where the native frame settles. It is anchored on the A, not on the
// stage centre: the aperture starts inside the A's crossbar, so a frame
// centred mid-stage would not contain the opening at all and progress 0
// would show nothing through it. Keeping the frame over the letter is
// also what makes the match cut work — the reel is behind the A the whole
// time, and the aperture only decides how much of it you can see.
const COUNTER_BOX = bbox(COUNTER_STAGE);
const FRAME_CENTRE: Pt = {
  x: (COUNTER_BOX.minX + COUNTER_BOX.maxX) / 2,
  y: (COUNTER_BOX.minY + COUNTER_BOX.maxY) / 2,
};
// The native frame settles at this height; width follows from the video's
// own ratio, so a portrait reel stays portrait on a wide viewport.
const FINAL_HEIGHT = STAGE_H * 0.78;

const ART_DEEP_G = 0.5 * GLOW_STRENGTH;

export default function FilmstripEntry() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState(false);
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

  const onMeta = () => {
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
  };

  const crossbarChild = { d: CROSSBAR_PATH, transform: PORTAL_TRANSFORM };
  const geo = getPortalGeometry(PORTAL_PROGRESS, {
    counter: COUNTER_STAGE,
    crossbar: crossbarChild,
    centre: PORTAL_CENTRE,
    videoAspect,
    stageCentre: FRAME_CENTRE,
    finalHeight: FINAL_HEIGHT,
  });

  // The video is FIXED: always drawn at its settled native-ratio size and
  // position. Only the window over it changes. It is never scaled to the
  // aperture and never stretched.
  const videoH = FINAL_HEIGHT;
  const videoW = videoH * videoAspect;
  const videoLeft = FRAME_CENTRE.x - videoW / 2;
  const videoTop = FRAME_CENTRE.y - videoH / 2;

  const seed = seedRect(COUNTER_STAGE, videoAspect);

  return (
    <div style={{ position: "relative", height: `${SCROLL_LENGTH_VH}vh`, zIndex: 1 }}>
      <div
        style={{
          position: "relative",
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
              opacity: artOpacity(PORTAL_PROGRESS),
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
              opacity: videoOpacity(PORTAL_PROGRESS),
            }}
          >
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
                portalProgress {PORTAL_PROGRESS.toFixed(3)}  phase {geo.phase}
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
