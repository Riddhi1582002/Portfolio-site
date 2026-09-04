"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { NAME_FLIP_ID, takePendingNameFlip } from "../lib/nameFlip";
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

  useEffect(() => {
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

    // Wait for fonts before measuring. The header is Neue Montreal at
    // clamp(34px,7vw,72px); if it is still in the fallback when Flip
    // measures the landing geometry, the webfont swapping mid-flight
    // changes the target box underneath the animation, which is the
    // single biggest source of jank here.
    let ctx: gsap.Context | null = null;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled || !wrapRef.current) return;
      ctx = gsap.context(() => {
        const tl = gsap.timeline();
        tl.add(
          Flip.from(state, {
            targets: wrapRef.current,
            duration: NAME_FLIP_DURATION,
            // Decelerating arrival rather than in-out: power2.inOut eases
            // at both ends, which on a long travel reads as a hesitation
            // in the middle.
            ease: "power3.out",
            scale: true,
          }),
          0
        );
        tl.to(heroWeightRef.current, { opacity: 0, duration: NAME_FLIP_DURATION, ease: "power1.inOut" }, 0);
        tl.to(headerWeightRef.current, { opacity: 1, duration: NAME_FLIP_DURATION, ease: "power1.inOut" }, 0);
      });
    });

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
    <div ref={wrapRef} data-flip-id={NAME_FLIP_ID} className="relative inline-block">
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

// Carousel geometry, in px. Fixed rather than fluid so the track can be
// stepped by a known amount and so late-loading images can never shift
// the layout underneath the name Flip landing on this page.
const TILE_SIZE = 168;
const TILE_GAP = 20;
const TILE_STEP = TILE_SIZE + TILE_GAP;
const CAROUSEL_STEP_MS = 2600;
const CAROUSEL_SLIDE_MS = 700;

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
  onHover,
}: {
  skill: (typeof SKILLS)[number];
  hovered: boolean;
  onHover: (name: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(skill.name)}
      onMouseLeave={() => onHover(null)}
      className={`frame-glow${hovered ? " frame-glow--active" : ""} relative shrink-0 overflow-hidden rounded-2xl bg-black`}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        transform: hovered ? "scale(1.06)" : "scale(1)",
        transition: "transform 320ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <Image
        src={`/icons/${skill.slug}.png`}
        alt={skill.name}
        width={360}
        height={360}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function SkillsCarousel() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  // Auto-advance, paused while a tile is hovered so its caption can
  // actually be read.
  useEffect(() => {
    if (hovered) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), CAROUSEL_STEP_MS);
    return () => window.clearInterval(id);
  }, [hovered]);

  // The track holds the list twice, so stepping onto the first tile of
  // the second copy looks identical to the first tile of the first —
  // which is the frame where the position resets with the transition
  // switched off, making the loop seamless.
  useEffect(() => {
    if (index !== SKILLS.length) return;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, CAROUSEL_SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [index]);

  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const active = SKILLS.find((s) => s.name === hovered) ?? null;

  return (
    <div>
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            gap: TILE_GAP,
            transform: `translateX(${-index * TILE_STEP}px)`,
            transition: animate ? `transform ${CAROUSEL_SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)` : "none",
          }}
        >
          {[...SKILLS, ...SKILLS].map((s, i) => (
            <SkillTile
              key={`${s.slug}-${i}`}
              skill={s}
              hovered={hovered === s.name}
              onHover={setHovered}
            />
          ))}
        </div>
      </div>

      {/* Fixed height so revealing a caption never reflows the page. */}
      <div style={{ height: 58 }} className="mt-5">
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
