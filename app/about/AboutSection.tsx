"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import {
  NAME_FLIP_FONT,
  NAME_FLIP_ID,
  hasPendingNameFlip,
  takePendingNameFlip,
} from "../lib/nameFlip";
import "../components/hero-fonts.css";
import HoverCard from "../components/HoverCard";
import ToolToggle from "../components/ToolToggle";

gsap.registerPlugin(Flip);

const SANS = "'Neue Montreal', system-ui, sans-serif";
const NAME_FLIP_DURATION = 0.75;
// Deliberately well above the hero name's 46px rest size so the Flip reads
// as a grow, not just a reposition; clamped so it still fits at 320px.
const ABOUT_HEADER_SIZE = "clamp(34px, 7vw, 72px)";

// The header is ONE text layer, at the same weight as the hero name.
//
// It used to be two stacked layers — the hero's 500 and the header's 700 —
// crossfading, so the name appeared to gain weight as it landed. The
// wrapper box matched, which made it look fine when you measured boxes,
// but the glyphs inside did not: the two weights differ by 22px of ink
// across "Riddhi Thakkar", and per-character offsets reach 20px by the
// last letter. For the ~330ms both layers were above 0.15 opacity you saw
// both sets of letterforms at once — the visible doubling.
//
// Neue Montreal has no fvar table in any of the static woff2 weights, so
// the weight could not be tweened continuously either. One weight, one
// layer, no doubling: the Flip is then purely a change of size and
// position, which is what it is for.
function AboutHeader() {
  const wrapRef = useRef<HTMLDivElement>(null);

  // A LAYOUT effect, not an effect: this has to run before the browser
  // paints /about. Deferring it (as the old promise-based version did)
  // meant the header painted at its natural final geometry for a couple
  // of frames — first in the fallback face, then in Neue Montreal — and
  // only then snapped back to the hero's position to start animating.
  useLayoutEffect(() => {
    const state = takePendingNameFlip();
    const wrap = wrapRef.current;
    if (!wrap || !state) return;

    let ctx: gsap.Context | null = null;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // Promote for the duration: the wrapper is scaled from the hero's
        // 46px to the header's clamp(34px,7vw,72px), and without a layer
        // the text is re-rasterised at a new scale every frame. Released
        // on completion so it does not hold a layer for the page's life.
        gsap.set(wrap, { willChange: "transform" });
        Flip.from(state, {
          targets: wrap,
          duration: NAME_FLIP_DURATION,
          // Decelerating arrival rather than in-out: power2.inOut eases at
          // both ends, which on a long travel reads as a hesitation in the
          // middle.
          ease: "power3.out",
          scale: true,
          onComplete: () => gsap.set(wrap, { willChange: "auto" }),
        });
      });
    };

    // The hero warms this exact face before navigating (warmNameFlipFont),
    // so the check normally passes synchronously and the flip starts in
    // this layout pass. The promise path is only a fallback for browsers
    // without the Font Loading API or a face that failed to warm.
    let fontReady = false;
    try {
      fontReady = document.fonts.check(NAME_FLIP_FONT, "Riddhi Thakkar");
    } catch {
      fontReady = false;
    }
    if (fontReady) run();
    else document.fonts.ready.then(run);

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-flip-id={NAME_FLIP_ID}
      className="relative inline-block"
      style={{ backfaceVisibility: "hidden" }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontSize: ABOUT_HEADER_SIZE,
          fontWeight: 500,
          letterSpacing: "0.005em",
          color: "#fff",
        }}
      >
        Riddhi Thakkar
      </span>
    </div>
  );
}

// All six tools. Supplied 512x512 transparent PNGs — `slug` names the
// file in public/icons. Nothing here is video any more: no poster frames,
// no rest-position extraction, no webm/mp4 pair, no watermark crop.
// Captions describe the tool's role — placeholder wording, easy to swap.
type Tool = { name: string; src: string; caption: string };

const CREATIVE_TOOLS: Tool[] = [
  { name: "After Effects", src: "/icons/after-effects.png", caption: "Motion graphics and compositing" },
  { name: "Illustrator", src: "/icons/illustrator.png", caption: "Vector artwork and layout" },
  { name: "Photoshop", src: "/icons/photoshop.png", caption: "Image retouching and composites" },
  { name: "Premiere Pro", src: "/icons/premiere-pro.png", caption: "Video editing and colour" },
  { name: "Affinity", src: "/icons/affinity.png", caption: "Design and photo editing" },
  { name: "Filmora", src: "/icons/filmora.png", caption: "Fast-turnaround video edits" },
];

// Captions are placeholder wording, easy to swap.
// Claude is one tile: Code, Design and Chat are named in its caption
// rather than repeated as separate logos.
const AI_TOOLS: Tool[] = [
  { name: "ChatGPT", src: "/icons/ai/chatgpt.png", caption: "Drafting and ideation" },
  { name: "Claude", src: "/icons/ai/claude.png", caption: "Claude Code, Design and Chat" },
  { name: "Gemini", src: "/icons/ai/gemini.png", caption: "Research and drafting" },
  { name: "Kimi", src: "/icons/ai/kimi.png", caption: "Long-context reading" },
  { name: "NotebookLM", src: "/icons/ai/notebooklm.png", caption: "Source-grounded notes" },
  { name: "Perplexity", src: "/icons/ai/perplexity.png", caption: "Cited research" },
  { name: "Google AI Studio", src: "/icons/ai/google-ai-studio.png", caption: "Prompt prototyping" },
  { name: "Adobe Firefly", src: "/icons/ai/adobe-firefly.png", caption: "Generative image work" },
  { name: "Leonardo AI", src: "/icons/ai/leonardo.png", caption: "Concept imagery" },
  { name: "Moda", src: "/icons/ai/moda.png", caption: "Design generation" },
  { name: "Frameo", src: "/icons/ai/frameo.png", caption: "Frame and layout work" },
  { name: "Gamma", src: "/icons/ai/gamma.png", caption: "Decks and one-pagers" },
  { name: "Runway", src: "/icons/ai/runway.png", caption: "Generative video" },
  { name: "Kling AI", src: "/icons/ai/kling.png", caption: "Video generation" },
  { name: "Hailuo AI", src: "/icons/ai/hailuo.png", caption: "Video generation" },
  { name: "Pictory AI", src: "/icons/ai/pictory.png", caption: "Long-form to short-form" },
  { name: "Google Flow", src: "/icons/ai/google-flow.png", caption: "Cinematic generation" },
  { name: "ElevenLabs", src: "/icons/ai/elevenlabs.png", caption: "Voice and narration" },
  { name: "Suno", src: "/icons/ai/suno.png", caption: "Music and scoring" },
  { name: "Adobe Enhance Speech", src: "/icons/ai/adobe-enhance-speech.png", caption: "Dialogue cleanup" },
  { name: "Replit", src: "/icons/ai/replit.png", caption: "Prototyping in-browser" },
  { name: "Lovable", src: "/icons/ai/lovable.png", caption: "App scaffolding" },
  { name: "Netlify", src: "/icons/ai/netlify.png", caption: "Deploys and hosting" },
  { name: "Meshy.ai", src: "/icons/ai/meshy.png", caption: "3D asset generation" },
];



// Marquee geometry, in px. Fixed rather than fluid so the loop distance is
// exact and so late-loading images can never shift the layout underneath
// the name Flip landing on this page.
const TILE_SIZE = 148;
// Snapped to the Photoshop icon's own outline, measured off its alpha
// channel: the artwork occupies x 0-511 and y 6-504 of the 512px canvas —
// a rounded rectangle 512x499 — and its corner reaches the box edge 76px
// in, i.e. 14.8% of the side. Every tile takes that shape, so the frame
// sits exactly on the icon's edge instead of around it.
const TILE_H = Math.round((TILE_SIZE * 499) / 512);
// Every tile is cut to the Photoshop icon's silhouette.
const SHAPE_MASK = "/icons/photoshop.png";
const TILE_GAP = 22;
// Vertical breathing room inside the marquee's overflow:hidden window.
// The window has to clip HORIZONTALLY — that is what makes the track a
// window rather than a page-wide overflow — but the hover glow and the
// hover lift both extend well past the tile vertically, and at the old
// 10px they were sliced off flat above and below. Padding opens the box,
// the equal negative margin takes the space back out of the layout.
const TRACK_BLEED = 78;
const TILE_STEP = TILE_SIZE + TILE_GAP;
// One full lap is exactly one copy of the list — tile N+1 of the doubled
// track lands where tile 1 started, gap included, so the wrap is invisible.
// One lap is exactly one copy of whichever list is showing, so the wrap is
// invisible for both. Computed per-list rather than baked in.
const loopPx = (count: number) => count * TILE_STEP;
// Constant velocity, in px per second. Deliberately slow: this is ambient
// motion, not a control the reader has to keep up with.
const MARQUEE_SPEED_PX_S = 22;

// Locked About copy, verbatim as supplied. Split by ROLE rather than
// reworded: the first line is the section's label, the second is the
// intro that carries the voice, and the rest is body copy. Nothing here
// is edited — only which element renders it.
const ABOUT_LABEL = "Who am I?";
const ABOUT_INTRO = "Not staging an existential crisis mid-portfolio, don't worry.";
const ABOUT_BODY: string[] = [
  "I love to ideate and bring ideas to life, in whatever medium I get the chance to work in. With a degree in English Literature and a University First Rank, years of professional video editing and graphic design experience, hundreds of literature pieces written and more canvases than I can count painted and sketched over - every one of them is proof that I know what it takes to take an idea from someone's head onto a screen, a page, or a canvas. My work spans promotional videos, corporate projects, personal event coverage, social media content, and visual storytelling for digital comics.",
  "And, because it's become impossible to ignore at this point, I've also worked with AI tools for image and video generation.",
  "Looking forward to working together, if this sounds like the kind of collaborator you need for your next project.",
  "Ba-bye!",
];

// Every block the reveal cascade drives, in reading order.
const ABOUT_PARAS: string[] = [ABOUT_INTRO, ...ABOUT_BODY];

// Label for the icon row — deliberately not part of ABOUT_BODY, so it
// reads as a caption for the row rather than another prose paragraph.
const SKILLS_LABEL = "MY TOOLKIT COVERS";

// One page margin and one measure, used by every section so they all sit
// on the same invisible vertical grid.
const PAGE_X = "px-6 sm:px-10 lg:px-16";
const PAGE_MAX = "mx-auto w-full max-w-[1500px]";

// Editorial scale. The name is the only display-size element; everything
// below it is deliberately smaller and further apart in size, so the
// hierarchy comes from type rather than from whitespace.
const LABEL_STYLE = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: "clamp(15px, 1.32vw, 21px)",
  letterSpacing: "0.17em",
  textTransform: "uppercase",
  color: "#fff",
} as const;

// The two category accents, as "r, g, b". Same values the toggle's own
// halo uses, so the switch and the tiles it controls agree.
const CREATIVE_ACCENT = "255, 92, 176";
const AI_ACCENT = "56, 224, 255";

// Placeholder easing until the LAYERS section's poster-arc reveal curve
// exists to match against (flagged to the user — see chat).
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function ToolTile({
  tool,
  hovered,
  loadImage,
  accent,
  onHover,
  onLeave,
}: {
  tool: Tool;
  hovered: boolean;
  /** False until the name transition is done — see ToolsCarousel. */
  loadImage: boolean;
  /** "r, g, b" of the active category's accent. */
  accent: string;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    // Outer element carries the depth and the glow. drop-shadow follows the
    // ALPHA of what it filters, so both trace the icon's silhouette exactly
    // — a box-shadow or a border would draw the tile's rectangle instead
    // and leave bright residue sitting in the corners the squircle does not
    // reach. Nothing here paints a background or a border for the same
    // reason: outside the silhouette there is nothing at all.
    //
    // Resting is not flat: a cast shadow below and a faint rim put the tile
    // on a surface. Hover adds lift, a little scale, a deeper cast and a
    // soft halo in the section's accent — restrained, and no gloss.
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="relative shrink-0"
      style={{
        width: TILE_SIZE,
        height: TILE_H,
        // Two cast shadows at rest, not one: a tight contact shadow just
        // under the tile and a wider, softer one further down. That pair is
        // what reads as a solid object on a surface — a single mid-blur
        // shadow reads as a sticker. Hover deepens both and adds the
        // atmospheric halo in the category's accent.
        filter: hovered
          ? `drop-shadow(0 4px 6px rgba(0,0,0,0.6)) drop-shadow(0 20px 34px rgba(0,0,0,0.7)) drop-shadow(0 0 18px rgba(255,255,255,0.32)) drop-shadow(0 0 54px rgba(${accent},0.34))`
          : "drop-shadow(0 2px 3px rgba(0,0,0,0.6)) drop-shadow(0 9px 17px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(255,255,255,0.14))",
        transform: hovered ? "translateY(-9px) scale(1.05)" : "translateY(0) scale(1)",
        transition:
          "transform 340ms cubic-bezier(0.22,0.7,0.24,1), filter 340ms ease",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          // The Photoshop icon's own alpha is the tile's shape. A
          // border-radius could not do this: the icon is a squircle, not a
          // rounded rectangle, so a radius left slack at the corners at any
          // value. Masking with the artwork snaps to the real silhouette.
          WebkitMaskImage: `url(${SHAPE_MASK})`,
          maskImage: `url(${SHAPE_MASK})`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
      >
        {loadImage && (
          // Plain <img> by request. Fixed-size static PNGs, and the export
          // build has no image optimiser, so next/image adds nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.src}
            alt={tool.name}
            width={512}
            height={512}
            decoding="async"
            // Without this, pressing on a tile and moving starts Chrome's
            // native image drag-and-drop. The browser then fires
            // pointercancel on the very first move, which ended the
            // marquee gesture a frame after it began and handed the line
            // to the throw momentum instead of to the pointer.
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}

        {/* Surface: a specular sheen falling from the top-left and a
            grounding shade at the bottom. Both live INSIDE the mask, so
            they follow the squircle rather than sitting in a rectangle
            over it, and neither is strong enough to read as gloss. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(155deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 28%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)",
            opacity: hovered ? 0.8 : 1,
            transition: "opacity 340ms ease",
          }}
        />
        {/* A one-pixel inner rim, brighter along the top edge. This is what
            gives the tile an edge to catch light on. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: hovered
              ? "inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(0,0,0,0.34)"
              : "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)",
            transition: "box-shadow 340ms ease",
          }}
        />
      </div>
    </div>
  );
}

// Continuous constant-velocity marquee, one per tool category — and
// draggable.
//
// It used to be a CSS keyframe animation. That could not be dragged: a
// running animation owns `transform`, so any value written from a pointer
// handler is overwritten on the next compositor frame. The track is now
// driven from one rAF loop that owns the transform outright, which makes
// the two behaviours the same mechanism rather than two fighting ones:
//
//   offset += (drift + throw) * dt
//
// Untouched, `throw` is 0 and the line moves at the constant drift it
// always did. Dragging writes the offset directly and records velocity;
// letting go seeds `throw` with it and decays it back to nothing, so the
// line eases out of the reader's gesture and back into its own drift
// without a seam.
//
// The track holds the list twice and the offset wraps at exactly one
// copy's width (gap included), so the wrap frame is identical to the start
// frame and no tile is ever cut at the loop point.
function ToolsCarousel({
  tools,
  idPrefix,
  accent,
  active: sectionActive,
}: {
  tools: Tool[];
  idPrefix: string;
  accent: string;
  /** False while this category is the hidden one. */
  active: boolean;
}) {
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  // Twelve-plus PNGs decode on the main thread, and when this page is
  // reached by clicking the hero name that lands inside the 750ms name
  // Flip. Held back until the transition is over.
  const [loadImages, setLoadImages] = useState(() => !hasPendingNameFlip());
  useEffect(() => {
    if (loadImages) return;
    const id = window.setTimeout(
      () => setLoadImages(true),
      NAME_FLIP_DURATION * 1000 + 120
    );
    return () => window.clearTimeout(id);
  }, [loadImages]);

  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  // Extra velocity from a throw, in px/s. Decays to 0, leaving the drift.
  const throwRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const loop = loopPx(tools.length);

  useEffect(() => {
    if (!sectionActive) return;
    const track = trackRef.current;
    if (!track) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!draggingRef.current) {
        const drift = reduced ? 0 : MARQUEE_SPEED_PX_S;
        offsetRef.current += (drift + throwRef.current) * dt;
        // Frame-rate independent decay: the throw is gone in about a
        // second however fast the display refreshes.
        throwRef.current *= Math.exp(-dt / 0.32);
        if (Math.abs(throwRef.current) < 1) throwRef.current = 0;
      }

      offsetRef.current = ((offsetRef.current % loop) + loop) % loop;
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, sectionActive]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore secondary buttons so a right-click never grabs the line.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    draggingRef.current = true;
    throwRef.current = 0;
    lastXRef.current = e.clientX;
    lastTRef.current = performance.now();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastXRef.current;
    const dt = Math.max(0.001, (now - lastTRef.current) / 1000);
    lastXRef.current = e.clientX;
    lastTRef.current = now;
    // Dragging right reveals earlier tiles, so the offset decreases.
    offsetRef.current -= dx;
    // Velocity, smoothed across moves and clamped. A single short frame
    // gives an enormous instantaneous dx/dt, and taken raw that flings the
    // line across several laps on release.
    const instant = Math.max(-2400, Math.min(2400, -dx / dt));
    throwRef.current = throwRef.current * 0.6 + instant * 0.4;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const activeTool = hoveredTile == null ? null : tools[hoveredTile % tools.length];

  return (
    <div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Belt and braces alongside draggable={false} on the images: any
        // native drag starting inside the track would cancel the pointer.
        onDragStart={(e) => e.preventDefault()}
        style={{
          overflow: "hidden",
          // Opens the window vertically so the hover lift and the glow are
          // not sliced off; the negative margin gives the space back to the
          // layout so the row still sits where the grid puts it.
          paddingBlock: TRACK_BLEED,
          marginBlock: -TRACK_BLEED,
          // The negative margin pulls this box UP over the heading row —
          // that is what gives the glow its room — but the box is also the
          // drag surface, so it was sitting on top of the toggle and the
          // heading and swallowing every click on them. (elementsFromPoint
          // at the pill's centre returned this div first and the checkbox
          // second.) Pointer events move to the track below, which is the
          // cards themselves: the bleed becomes transparent to clicks and
          // the drag still starts wherever a reader would actually grab.
          pointerEvents: "none",
          maskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
          cursor: dragging ? "grabbing" : "grab",
          // Horizontal drags belong to the line, vertical ones to the page.
          touchAction: "pan-y",
        }}
      >
        <div
          ref={trackRef}
          className="flex w-max"
          style={{
            gap: TILE_GAP,
            willChange: "transform",
            // The window above is pointer-events:none; the cards take the
            // events and they bubble back up to its drag handlers.
            pointerEvents: "auto",
            // Without this a drag selects the alt text of every tile it
            // passes over.
            userSelect: "none",
          }}
        >
          {[...tools, ...tools].map((t, i) => (
            <ToolTile
              key={`${t.name}-${i}`}
              tool={t}
              // Keyed on index, not name: the track holds the list twice,
              // so matching on name lit the duplicate at the same time.
              hovered={hoveredTile === i}
              loadImage={loadImages}
              accent={accent}
              onHover={() => setHoveredTile(i)}
              onLeave={() => setHoveredTile(null)}
            />
          ))}
        </div>
      </div>

      {/* Fixed height so revealing a caption never reflows the page. */}
      <div style={{ height: 58 }} className="mt-8">
        <div
          style={{
            opacity: activeTool ? 1 : 0,
            transform: activeTool ? "translateY(0) scale(1)" : "translateY(6px) scale(0.98)",
            transition: "opacity 320ms ease, transform 320ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: "0.02em",
              color: "#fff",
              textShadow: activeTool ? `0 0 18px rgba(${accent},0.55)` : "none",
              transition: "text-shadow 320ms ease",
            }}
          >
            {activeTool?.name ?? "\u00a0"}
          </p>
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 300,
              fontSize: 13,
              letterSpacing: "0.03em",
              color: "rgba(255,255,255,0.6)",
              marginTop: 4,
            }}
          >
            {activeTool?.caption ?? "\u00a0"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Provisional per-block scroll reveal. There's no filmstrip label-swap
// mechanism to copy exact numbers from yet (REELS doesn't exist in the
// codebase) — this is a placeholder using the same easeInOutSine curve
// everything else on this page already uses, flagged for reconciliation
// once the real filmstrip values exist. Progress is each element's own
// position relative to the viewport (not a whole-page scroll fraction),
// so it still works on a page whose content barely scrolls at all.
const REVEAL_TRANSLATE_Y = 24;

function viewportRevealT(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const start = vh; // element's top at the bottom edge of the viewport
  const end = vh * 0.75; // "revealed" once its top has reached 75% up
  return Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
}

// Confirmed reveal for About body copy: each paragraph fades up as it
// enters the viewport, staggered block to block. Deliberately NOT the
// grey-to-white clip-mask line reveal the hero narration uses — that
// treatment stays specific to the hero.
const REVEAL_STAGGER = 0.09; // of the reveal window, per paragraph

export default function AboutSection() {
  const bodyRevealRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  // Which tool category the switch is showing. A real boolean, so it can
  // drive anything else that needs it later.
  const [showAiTools, setShowAiTools] = useState(false);
  // Until the intro has played, the scroll handler leaves the paragraphs
  // alone. Without this, everything already above the fold at load is
  // simply "revealed" with no motion at all — there is nothing for it to
  // scroll into — and only the last block ever animates.
  const introDoneRef = useRef(false);
  const skillsRevealRef = useRef<HTMLDivElement>(null);
  const backRevealRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Each paragraph on its own progress, offset by its index, so the
        // block reads as a cascade rather than one slab appearing.
        // The guard belongs to the paragraphs only. It used to sit above
        // this whole callback, which meant the skills block and the back
        // link never got their opacity set either — they stayed at the
        // inline 0 until some later scroll happened to run after the intro
        // had finished, and often that never came.
        if (introDoneRef.current) {
          paraRefs.current.forEach((para, i) => {
            if (!para) return;
            const raw = viewportRevealT(para);
            const shifted =
              (raw - i * REVEAL_STAGGER) / (1 - REVEAL_STAGGER * (ABOUT_PARAS.length - 1));
            const t = easeInOutSine(Math.min(1, Math.max(0, shifted)));
            para.style.opacity = String(t);
            para.style.transform = `translateY(${(1 - t) * REVEAL_TRANSLATE_Y}px)`;
          });
        }

        const skillsEl = skillsRevealRef.current;
        if (skillsEl) {
          const t = easeInOutSine(viewportRevealT(skillsEl));
          skillsEl.style.opacity = String(t);
          skillsEl.style.transform = `translateY(${(1 - t) * REVEAL_TRANSLATE_Y}px)`;
        }

        const backEl = backRevealRef.current;
        if (backEl) {
          const t = easeInOutSine(viewportRevealT(backEl));
          backEl.style.opacity = String(t);
          backEl.style.transform = `translateY(${(1 - t) * REVEAL_TRANSLATE_Y}px)`;
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Intro pass: fade the body copy up once on arrival, staggered block to
  // block, then hand over to the scroll handler. Held back while the name
  // Flip is running so the two do not compete for the same frames.
  useEffect(() => {
    const paras = paraRefs.current.filter((el): el is HTMLParagraphElement => el != null);
    if (!paras.length) return;
    const delay = hasPendingNameFlip() ? NAME_FLIP_DURATION + 0.1 : 0.15;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        paras,
        { opacity: 0, y: REVEAL_TRANSLATE_Y },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.11,
          delay,
          onComplete: () => {
            introDoneRef.current = true;
            // Re-run the scroll pass now that the guard has lifted.
            window.dispatchEvent(new Event("scroll"));
            paras.forEach((el) => {
              el.style.willChange = "auto";
            });
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className={`min-h-screen bg-black py-24 text-white ${PAGE_X}`}>
      {/* ONE page margin and ONE measure. Every section below sits inside
          this container, so the name, the About column, the toolkit
          heading and the card line all align to the same vertical grid. */}
      <div className={PAGE_MAX}>
        {/* Header is its own centered row — deliberately not beside the
            photo, so the Flip lands it on the page's horizontal centre. */}
        <div className="flex justify-center">
          <AboutHeader />
        </div>

        {/* About: label and copy on the left, portrait on the right.
            items-start, so the photo hangs from the top of the text block
            rather than floating at its centre; the small top offset lands
            it beside the intro line rather than beside the label. */}
        {/* A real two-column grid rather than two narrow flex children
            pushed apart by justify-between. The row still spans the same
            container, and both outer edges still land on the page grid —
            what changed is where the space inside it goes: the columns
            take it and the gap gives it up, so the portrait sits beside
            the copy instead of across a void from it. */}
        <div className="mt-20 flex flex-col gap-12 sm:mt-24 sm:grid sm:grid-cols-[minmax(0,1.78fr)_minmax(0,1fr)] sm:items-start sm:gap-[clamp(32px,4vw,72px)]">
          <div ref={bodyRevealRef} className="min-w-0">
            <p style={LABEL_STYLE}>{ABOUT_LABEL}</p>

            {ABOUT_PARAS.map((para, i) => (
              <p
                key={i}
                ref={(el) => {
                  paraRefs.current[i] = el;
                }}
                style={{
                  fontFamily: SANS,
                  // The intro is the mid-tier the page was missing: bigger
                  // than body copy, lighter than the name, and the only
                  // thing between them. Body copy sits well below it so the
                  // step is unmistakable.
                  fontWeight: i === 0 ? 400 : 300,
                  fontSize:
                    i === 0
                      ? "clamp(19px, 1.62vw, 26px)"
                      : "clamp(16px, 1.2vw, 20px)",
                  lineHeight: i === 0 ? 1.42 : 1.78,
                  letterSpacing: i === 0 ? "0.005em" : "0.045em",
                  color: i === 0 ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.7)",
                  marginTop: i === 0 ? "0.7em" : i === 1 ? "1.5em" : "1.15em",
                  // Starts hidden; the scroll handler above drives it.
                  opacity: 0,
                  willChange: "opacity, transform",
                }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* Tilt plus the glare strips the tilt produces. The same
              treatment every card and placeholder on the site gets. */}
          <HoverCard
            className="w-[clamp(180px,58vw,260px)] shrink-0 self-center sm:w-full sm:self-start"
            aspect={1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/photo/riddhi-photo.jpg" alt="Riddhi Thakkar" loading="lazy" />
          </HoverCard>
        </div>

        {/* The toolkit is the page's second section, not a separate block
            dropped much lower down: the gap here is a section break, close
            to the one under the name, rather than the old near-double. */}
        <div ref={skillsRevealRef} className="mt-20 sm:mt-24" style={{ opacity: 0 }}>
          {/* Heading and control share one row: label on the page's left
              margin, the switch and its label pushed to the right edge of
              the same grid. */}
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
            <p style={LABEL_STYLE}>{SKILLS_LABEL}</p>
            <ToolToggle
              on={showAiTools}
              onChange={setShowAiTools}
              labelText={showAiTools ? "AI tools" : "Creative tools"}
            />
          </div>

          {/* The card line sits directly under the heading row and spans
              the container's full width. Both lists stay mounted so
              neither re-decodes its images when the switch is flipped
              back; only the visible one runs its rAF loop. */}
          <div className="mt-12" style={{ display: showAiTools ? "none" : "block" }}>
            <ToolsCarousel
              tools={CREATIVE_TOOLS}
              idPrefix="creative"
              accent={CREATIVE_ACCENT}
              active={!showAiTools}
            />
          </div>
          <div className="mt-12" style={{ display: showAiTools ? "block" : "none" }}>
            <ToolsCarousel
              tools={AI_TOOLS}
              idPrefix="ai"
              accent={AI_ACCENT}
              active={showAiTools}
            />
          </div>
        </div>

        <Link
          ref={backRevealRef}
          href="/"
          className="mt-16 inline-block text-sm text-white/80 underline"
          style={{ fontFamily: SANS, opacity: 0 }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
