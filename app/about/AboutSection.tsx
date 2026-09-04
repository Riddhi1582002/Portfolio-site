"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import {
  NAME_FLIP_FONT,
  NAME_FLIP_ID,
  hasPendingNameFlip,
  takePendingNameFlip,
} from "../lib/nameFlip";
import "../components/hero-fonts.css";

gsap.registerPlugin(Flip);

const SANS = "'Neue Montreal', system-ui, sans-serif";
const NAME_FLIP_DURATION = 0.75;
// Deliberately well above the hero name's 46px rest size so the Flip reads
// as a grow, not just a reposition; clamped so it still fits at 320px.
const ABOUT_HEADER_SIZE = "clamp(34px, 7vw, 72px)";

// Neue Montreal isn't a variable font (no fvar table in any of the
// static woff2 weights), so the hero-name-weight -> header-weight
// change can't be tweened live — two stacked static-weight layers
// crossfade instead, while the wrapper's position/size comes from Flip.
function AboutHeader() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const heroWeightRef = useRef<HTMLSpanElement>(null);
  const headerWeightRef = useRef<HTMLSpanElement>(null);

  // A LAYOUT effect, not an effect: this has to run before the browser
  // paints /about. Deferring it (as the old promise-based version did)
  // meant the header painted at its natural final geometry for a couple
  // of frames — first in the fallback face, then in Neue Montreal — and
  // only then snapped back to the hero's position to start animating.
  // That front-of-transition pop was visible on every run.
  useLayoutEffect(() => {
    const state = takePendingNameFlip();
    if (!wrapRef.current || !heroWeightRef.current || !headerWeightRef.current) {
      return;
    }
    if (!state) {
      // Direct load of /about (no hero flip in progress) — no animation.
      gsap.set(headerWeightRef.current, { opacity: 1 });
      gsap.set(heroWeightRef.current, { opacity: 0 });
      return;
    }
    gsap.set(headerWeightRef.current, { opacity: 0 });
    gsap.set(heroWeightRef.current, { opacity: 1 });

    const wrap = wrapRef.current;
    const heroWeight = heroWeightRef.current;
    const headerWeight = headerWeightRef.current;

    let ctx: gsap.Context | null = null;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // Promote the flipped wrapper for the duration. It is scaled from
        // the hero's 46px to the header's clamp(34px,7vw,72px), and
        // without a layer the text is re-rasterised at a new scale every
        // frame. Dropped again on completion so it does not hold a layer
        // for the life of the page.
        gsap.set(wrap, { willChange: "transform" });
        const tl = gsap.timeline({
          onComplete: () => gsap.set(wrap, { willChange: "auto" }),
        });
        tl.add(
          Flip.from(state, {
            targets: wrap,
            duration: NAME_FLIP_DURATION,
            // Decelerating arrival rather than in-out: power2.inOut eases
            // at both ends, which on a long travel reads as a hesitation
            // in the middle.
            ease: "power3.out",
            scale: true,
          }),
          0
        );
        tl.to(heroWeight, { opacity: 0, duration: NAME_FLIP_DURATION, ease: "power1.inOut" }, 0);
        tl.to(headerWeight, { opacity: 1, duration: NAME_FLIP_DURATION, ease: "power1.inOut" }, 0);
      });
    };

    // The hero warms this exact face before navigating (warmNameFlipFont),
    // so the check normally passes synchronously and the flip starts in
    // this layout pass. The promise path is only a fallback for browsers
    // without the Font Loading API or a font that failed to warm; there,
    // measuring against the fallback face and having it swap mid-flight
    // is still the worse option.
    let fontReady = false;
    try {
      fontReady = document.fonts.check(NAME_FLIP_FONT, "Riddhi Thakkar");
    } catch {
      fontReady = false;
    }
    if (fontReady) {
      run();
    } else {
      document.fonts.ready.then(run);
    }

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  const shared = {
    fontFamily: SANS,
    fontSize: ABOUT_HEADER_SIZE,
    letterSpacing: "0.005em",
    color: "#fff",
  };

  return (
    <div
      ref={wrapRef}
      data-flip-id={NAME_FLIP_ID}
      className="relative inline-block"
      style={{ backfaceVisibility: "hidden" }}
    >
      <span ref={headerWeightRef} style={{ ...shared, fontWeight: 700 }}>
        Riddhi Thakkar
      </span>
      <span
        ref={heroWeightRef}
        className="pointer-events-none absolute inset-0"
        style={{ ...shared, fontWeight: 500, opacity: 0 }}
      >
        Riddhi Thakkar
      </span>
    </div>
  );
}

// All six tools, wired from the correctly-identified clips. The row is
// built from stills now, not video: `slug` names the PNG in public/icons,
// extracted at t=2.0s (the fully-drawn frame) with the jitter.video
// watermark cropped out. Captions describe the tool's role — placeholder
// wording, easy to swap.
const SKILLS = [
  { name: "After Effects", slug: "After-Effects", caption: "Motion graphics and compositing" },
  { name: "Illustrator", slug: "Illustrator", caption: "Vector artwork and layout" },
  { name: "Photoshop", slug: "Photoshop", caption: "Image retouching and composites" },
  { name: "Premiere Pro", slug: "Premiere-Pro", caption: "Video editing and colour" },
  { name: "Affinity", slug: "affinity", caption: "Design and photo editing" },
  { name: "Filmora", slug: "filmora", caption: "Fast-turnaround video edits" },
];

const SKILLS_COUNT = SKILLS.length;

// Marquee geometry, in px. Fixed rather than fluid so the loop distance is
// exact and so late-loading images can never shift the layout underneath
// the name Flip landing on this page.
const TILE_SIZE = 168;
const TILE_GAP = 20;
const TILE_STEP = TILE_SIZE + TILE_GAP;
// One full lap is exactly one copy of the list — tile N+1 of the doubled
// track lands where tile 1 started, gap included, so the wrap is invisible.
const MARQUEE_LOOP_PX = SKILLS_COUNT * TILE_STEP;
// Constant velocity, in px per second. Deliberately slow: this is ambient
// motion, not a control the reader has to keep up with.
const MARQUEE_SPEED_PX_S = 22;
const MARQUEE_DURATION_S = MARQUEE_LOOP_PX / MARQUEE_SPEED_PX_S;

// Ken-burns drift on the photo. 0.08 was measurably working (1.00 -> 1.08
// across the page) but too small to read as motion on a page with only a
// few hundred px of scroll, which is why the photo looked static.
const KEN_BURNS_RANGE = 0.16;

// Locked About copy, one string per paragraph, verbatim as supplied.
const ABOUT_BODY: string[] = [
  "Who am I?",
  "Not staging an existential crisis mid-portfolio, don't worry.",
  "I love to ideate and bring ideas to life, in whatever medium I get the chance to work in. With a degree in English Literature and a University First Rank, years of professional video editing and graphic design experience, hundreds of pieces written and more canvases than I can count painted and sketched over — every one of them proof that I know what it takes to take an idea from someone's head onto a screen, a page, or a canvas. My work spans promotional videos, corporate projects, personal event coverage, social media content, and visual storytelling for digital comics.",
  "And, because it's become impossible to ignore at this point, I've also worked with AI tools for image and video generation.",
  "Looking forward to working together, if this sounds like the kind of collaborator you need for your next project.",
  "Ba-bye!",
];

// Label for the icon row — deliberately not part of ABOUT_BODY, so it
// reads as a caption for the row rather than another prose paragraph.
const SKILLS_LABEL = "My software skills cover:";

// Placeholder easing until the LAYERS section's poster-arc reveal curve
// exists to match against (flagged to the user — see chat).
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function SkillTile({
  skill,
  hovered,
  loadImage,
  onHover,
  onLeave,
}: {
  skill: (typeof SKILLS)[number];
  hovered: boolean;
  /** False until the name transition is done — see SkillsCarousel. */
  loadImage: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`frame-glow${hovered ? " frame-glow--active" : ""} relative shrink-0 overflow-hidden rounded-2xl bg-black`}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        transform: hovered ? "scale(1.06)" : "scale(1)",
        transition: "transform 320ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {loadImage && (
        <Image
          src={`/icons/${skill.slug}.png`}
          alt={skill.name}
          width={360}
          height={360}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

// Continuous constant-velocity marquee. Deliberately CSS-driven rather
// than JS-driven: a linear `translate3d` keyframe animation runs on the
// compositor at a fixed px/s, so it cannot be stepped, cannot drift, and
// cannot be perturbed by anything on the main thread.
//
// It is also completely decoupled from the pointer. The track's animation
// is never paused, never restarted, and never reads mouse position;
// hovering a tile only sets `hovered`, which drives the caption. The old
// implementation stepped the track on a setInterval and paused that
// interval on hover, which is what made stray mouse movement over the row
// nudge the scroll position.
//
// The track holds the list twice and travels exactly one copy's width
// (MARQUEE_LOOP_PX, gap included) before restarting, so the frame at the
// wrap is pixel-identical to the frame at the start — no tile is ever cut
// in half at the loop point. The window is wide enough for the full list,
// and the edges are feathered rather than hard-cut so a tile entering or
// leaving reads as a fade, not a clipped frame.
function SkillsCarousel() {
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  // Twelve 360x360 PNGs (six tools, listed twice) decode on the main
  // thread. Measured, that is ~0.95s of task time, and when the page is
  // reached by clicking the hero name it lands inside the 750ms name
  // Flip, which is one of the two things that stalled it. Holding them
  // back until the transition is over costs nothing visually — the tiles
  // already have their frame and their reserved box — and gives the flip
  // an idle main thread.
  const [loadImages, setLoadImages] = useState(() => !hasPendingNameFlip());
  useEffect(() => {
    if (loadImages) return;
    const id = window.setTimeout(
      () => setLoadImages(true),
      NAME_FLIP_DURATION * 1000 + 120
    );
    return () => window.clearTimeout(id);
  }, [loadImages]);
  const active = hoveredTile == null ? null : SKILLS[hoveredTile % SKILLS_COUNT];

  return (
    <div>
      <div
        style={{
          overflow: "hidden",
          // Vertical room for the hover scale (1.06 on a 168px tile) so
          // overflow:hidden crops the track horizontally, not the tile.
          paddingBlock: 8,
          marginBlock: -8,
          // Feathered edges: without these the window's own boundary is a
          // hard cut, which is what read as "the last icon is chopped off".
          maskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
        }}
      >
        <div
          className="skills-marquee flex w-max"
          style={{
            gap: TILE_GAP,
            animationDuration: `${MARQUEE_DURATION_S}s`,
            willChange: "transform",
          }}
        >
          {[...SKILLS, ...SKILLS].map((s, i) => (
            <SkillTile
              key={`${s.slug}-${i}`}
              skill={s}
              // Keyed on the tile's own index, not its name: the track
              // holds the list twice, so matching on name lit up the
              // duplicate copy at the same time.
              hovered={hoveredTile === i}
              loadImage={loadImages}
              onHover={() => setHoveredTile(i)}
              onLeave={() => setHoveredTile(null)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes skills-marquee-scroll {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-${MARQUEE_LOOP_PX}px, 0, 0); }
        }
        .skills-marquee {
          animation-name: skills-marquee-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .skills-marquee { animation: none; }
        }
      `}</style>

      {/* Fixed height so revealing a caption never reflows the page.
          mt-7 rather than mt-5: the marquee window carries 8px of vertical
          padding (room for the hover scale) that the caption would
          otherwise eat into, leaving under 16px between the two boxes. */}
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

export default function AboutSection() {
  const photoRef = useRef<HTMLDivElement>(null);
  const bodyRevealRef = useRef<HTMLDivElement>(null);
  const skillsRevealRef = useRef<HTMLDivElement>(null);
  const backRevealRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;

        const photoEl = photoRef.current;
        if (photoEl) {
          const scale = 1 + easeInOutSine(frac) * KEN_BURNS_RANGE;
          photoEl.style.transform = `scale(${scale})`;
        }

        const bodyEl = bodyRevealRef.current;
        if (bodyEl) {
          const t = easeInOutSine(viewportRevealT(bodyEl));
          bodyEl.style.opacity = String(t);
          bodyEl.style.transform = `translateY(${(1 - t) * REVEAL_TRANSLATE_Y}px)`;
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

  return (
    <div className="min-h-screen bg-black px-6 py-24 text-white sm:px-12">
      <div className="mx-auto max-w-5xl">
        {/* Header is its own centered row — deliberately not beside the
            photo, so the Flip lands it on the page's horizontal centre. */}
        <div className="flex justify-center">
          <AboutHeader />
        </div>

        {/* Body copy sits left of the corner-placed photo on sm+, stacked
            above it below that. Renders nothing while ABOUT_BODY is empty,
            so the photo row keeps its current layout until copy arrives. */}
        <div className="mt-14 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-end sm:gap-12">
          {ABOUT_BODY.length > 0 && (
            <div ref={bodyRevealRef} className="max-w-prose flex-1" style={{ opacity: 0 }}>
              {ABOUT_BODY.map((para, i) => (
                <p
                  key={i}
                  className="text-white/75"
                  style={{
                    fontFamily: SANS,
                    fontWeight: 300,
                    fontSize: "clamp(15px, 1.15vw, 18px)",
                    lineHeight: 1.7,
                    letterSpacing: "0.022em",
                    marginTop: i === 0 ? 0 : "1.1em",
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          )}

          <div className="frame-glow frame-glow--photo relative aspect-square w-[clamp(180px,60vw,280px)] shrink-0 self-center overflow-hidden rounded-2xl sm:self-start sm:w-[clamp(220px,26vw,340px)]">
            <div ref={photoRef} className="h-full w-full" style={{ willChange: "transform" }}>
              <Image
                src="/photo/riddhi-photo.jpg"
                alt="Riddhi Thakkar"
                width={680}
                height={680}
                className="h-full w-full object-cover"
                priority={false}
              />
            </div>
          </div>
        </div>

        <div ref={skillsRevealRef} className="mt-16 sm:mt-24" style={{ opacity: 0 }}>
          <p
            className="mb-6 text-white/55"
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: "clamp(13px, 1vw, 15px)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {SKILLS_LABEL}
          </p>

          <SkillsCarousel />
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
