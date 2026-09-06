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
const TILE_SIZE = 168;
// Snapped to the Photoshop icon's own outline, measured off its alpha
// channel: the artwork occupies x 0-511 and y 6-504 of the 512px canvas —
// a rounded rectangle 512x499 — and its corner reaches the box edge 76px
// in, i.e. 14.8% of the side. Every tile takes that shape, so the frame
// sits exactly on the icon's edge instead of around it.
const TILE_H = Math.round((TILE_SIZE * 499) / 512);
// Every tile is cut to the Photoshop icon's silhouette.
const SHAPE_MASK = "/icons/photoshop.png";
const TILE_GAP = 20;
const TILE_STEP = TILE_SIZE + TILE_GAP;
// One full lap is exactly one copy of the list — tile N+1 of the doubled
// track lands where tile 1 started, gap included, so the wrap is invisible.
// One lap is exactly one copy of whichever list is showing, so the wrap is
// invisible for both. Computed per-list rather than baked in.
const loopPx = (count: number) => count * TILE_STEP;
// Constant velocity, in px per second. Deliberately slow: this is ambient
// motion, not a control the reader has to keep up with.
const MARQUEE_SPEED_PX_S = 22;
const durationS = (count: number) => loopPx(count) / MARQUEE_SPEED_PX_S;

// Locked About copy, one string per paragraph, verbatim as supplied.
const ABOUT_BODY: string[] = [
  "Who am I?",
  "Not staging an existential crisis mid-portfolio, don't worry.",
  "I love to ideate and bring ideas to life, in whatever medium I get the chance to work in. With a degree in English Literature and a University First Rank, years of professional video editing and graphic design experience, hundreds of literature pieces written and more canvases than I can count painted and sketched over - every one of them is proof that I know what it takes to take an idea from someone's head onto a screen, a page, or a canvas. My work spans promotional videos, corporate projects, personal event coverage, social media content, and visual storytelling for digital comics.",
  "And, because it's become impossible to ignore at this point, I've also worked with AI tools for image and video generation.",
  "Looking forward to working together, if this sounds like the kind of collaborator you need for your next project.",
  "Ba-bye!",
];

// Label for the icon row — deliberately not part of ABOUT_BODY, so it
// reads as a caption for the row rather than another prose paragraph.
const SKILLS_LABEL = "MY TOOLKIT COVERS";

// Placeholder easing until the LAYERS section's poster-arc reveal curve
// exists to match against (flagged to the user — see chat).
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function ToolTile({
  tool,
  hovered,
  loadImage,
  onHover,
  onLeave,
}: {
  tool: Tool;
  hovered: boolean;
  /** False until the name transition is done — see ToolsCarousel. */
  loadImage: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    // Outer element carries the glow. drop-shadow follows the ALPHA of what
    // it filters, so the glow traces the icon's silhouette exactly — a
    // box-shadow or a border would draw the tile's rectangle instead and
    // leave bright residue sitting in the corners the squircle does not
    // reach. Nothing here paints a background or a border for the same
    // reason: outside the silhouette there is nothing at all.
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="relative shrink-0"
      style={{
        width: TILE_SIZE,
        height: TILE_H,
        filter: hovered
          ? "drop-shadow(0 0 14px rgba(255,255,255,0.42)) drop-shadow(0 0 34px rgba(255,255,255,0.22))"
          : "drop-shadow(0 0 10px rgba(255,255,255,0.16))",
        transform: hovered ? "scale(1.06)" : "scale(1)",
        transition:
          "transform 320ms cubic-bezier(0.4,0,0.2,1), filter 320ms ease",
      }}
    >
      <div
        className="h-full w-full overflow-hidden"
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
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}

// Continuous constant-velocity marquee, one per tool category.
//
// CSS-driven on purpose: a linear translate3d keyframe runs on the
// compositor at a fixed px/s, so it cannot be stepped, cannot drift and
// cannot be perturbed by the main thread. It is also completely decoupled
// from the pointer — hovering a tile only sets which caption shows; it
// never nudges the scroll.
//
// The track holds the list twice and travels exactly one copy's width
// (gap included) before restarting, so the wrap frame is identical to the
// start frame and no tile is ever cut at the loop point. The window edges
// are feathered rather than hard-cut.
function ToolsCarousel({ tools, idPrefix }: { tools: Tool[]; idPrefix: string }) {
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

  const active = hoveredTile == null ? null : tools[hoveredTile % tools.length];
  const anim = `${idPrefix}-marquee`;

  return (
    <div>
      <div
        style={{
          overflow: "hidden",
          // Vertical room for the hover scale so overflow:hidden crops the
          // track horizontally, not the tile.
          paddingBlock: 10,
          marginBlock: -10,
          maskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
        }}
      >
        <div
          className={`${anim} flex w-max`}
          style={{
            gap: TILE_GAP,
            animationDuration: `${durationS(tools.length)}s`,
            willChange: "transform",
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
              onHover={() => setHoveredTile(i)}
              onLeave={() => setHoveredTile(null)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ${anim}-scroll {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-${loopPx(tools.length)}px, 0, 0); }
        }
        .${anim} {
          animation-name: ${anim}-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .${anim} { animation: none; }
        }
      `}</style>

      {/* Fixed height so revealing a caption never reflows the page. */}
      <div style={{ height: 58 }} className="mt-7">
        <div
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0) scale(1)" : "translateY(6px) scale(0.98)",
            transition: "opacity 320ms ease, transform 320ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 17,
              letterSpacing: "0.02em",
              color: "#fff",
              textShadow: active ? "0 0 18px rgba(255,255,255,0.45)" : "none",
              transition: "text-shadow 320ms ease",
            }}
          >
            {active?.name ?? "\u00a0"}
          </p>
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 300,
              fontSize: 14,
              letterSpacing: "0.03em",
              color: "rgba(255,255,255,0.6)",
              marginTop: 4,
            }}
          >
            {active?.caption ?? "\u00a0"}
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
              (raw - i * REVEAL_STAGGER) / (1 - REVEAL_STAGGER * (ABOUT_BODY.length - 1));
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
    <div className="min-h-screen bg-black px-4 py-24 text-white sm:px-6 lg:px-8">
      {/* Wider than the old max-w-5xl: 1024px left very large gutters
            on desktop and cut the marquee window short, so fewer icons were
            visible than there was room for. */}
        <div className="mx-auto max-w-[1600px]">
        {/* Header is its own centered row — deliberately not beside the
            photo, so the Flip lands it on the page's horizontal centre. */}
        <div className="flex justify-center">
          <AboutHeader />
        </div>

        {/* Body copy sits left of the corner-placed photo on sm+, stacked
            above it below that. Renders nothing while ABOUT_BODY is empty,
            so the photo row keeps its current layout until copy arrives. */}
        {/* justify-between, not justify-end: the copy starts at the
            container's left edge so its margin lines up with the
            "MY TOOLKIT COVERS" heading below. */}
        <div className="mt-14 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
          {ABOUT_BODY.length > 0 && (
            <div ref={bodyRevealRef} className="max-w-prose flex-1">
              {ABOUT_BODY.map((para, i) => (
                <p
                  key={i}
                  ref={(el) => {
                    paraRefs.current[i] = el;
                  }}
                  className="text-white/75"
                  style={{
                    fontFamily: SANS,
                    fontWeight: 300,
                    fontSize: "clamp(15px, 1.15vw, 18px)",
                    lineHeight: 1.7,
                    letterSpacing: "0.045em",
                    marginTop: i === 0 ? 0 : "1.1em",
                    // Starts hidden; the scroll handler above drives it.
                    opacity: 0,
                    willChange: "opacity, transform",
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* Tilt plus the glare strips the tilt produces. The same
              treatment every card and placeholder on the site gets. */}
          <HoverCard
            className="w-[clamp(180px,60vw,280px)] shrink-0 self-center sm:self-start sm:w-[clamp(220px,26vw,340px)]"
            aspect={1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/photo/riddhi-photo.jpg" alt="Riddhi Thakkar" loading="lazy" />
          </HoverCard>
        </div>

        <div ref={skillsRevealRef} className="mt-16 sm:mt-24" style={{ opacity: 0 }}>
          <p
            className="text-white"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: "clamp(14px, 1.1vw, 17px)",
              letterSpacing: "0.08em",
            }}
          >
            {SKILLS_LABEL}
          </p>

          {/* Below the heading, on its own row. */}
          <div className="mb-8 mt-4">
            <ToolToggle
              on={showAiTools}
              onChange={setShowAiTools}
              labelText={showAiTools ? "AI tools" : "Creative tools"}
            />
          </div>

          {/* Both lists stay mounted so neither re-decodes its images when
              the switch is flipped back. */}
          <div style={{ display: showAiTools ? "none" : "block" }}>
            <ToolsCarousel tools={CREATIVE_TOOLS} idPrefix="creative" />
          </div>
          <div style={{ display: showAiTools ? "block" : "none" }}>
            <ToolsCarousel tools={AI_TOOLS} idPrefix="ai" />
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
