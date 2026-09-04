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
const NAME_FLIP_DURATION = 0.6;
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
    const tl = gsap.timeline();
    tl.add(
      Flip.from(state, {
        targets: wrapRef.current,
        duration: NAME_FLIP_DURATION,
        ease: "power2.inOut",
        scale: true,
      }),
      0
    );
    tl.to(heroWeightRef.current, { opacity: 0, duration: NAME_FLIP_DURATION, ease: "power2.inOut" }, 0);
    tl.to(headerWeightRef.current, { opacity: 1, duration: NAME_FLIP_DURATION, ease: "power2.inOut" }, 0);
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

// Each clip is served as both VP9/webm and H.264/mp4 so every browser gets
// one it can decode (the original set was 3 webm + 1 mp4, and the lone mp4
// failed to demux anywhere without H.264). `slug` also names the poster.
const SKILLS = [
  { name: "After Effects", slug: "After-Effects" },
  { name: "Illustrator", slug: "Illustrator" },
  { name: "Photoshop", slug: "Photoshop" },
  { name: "Premiere Pro", slug: "Premiere-Pro" },
];

// These clips animate their icon in from an empty frame, so frame 0 is
// solid black — which is why pausing at 0 rendered four black tiles. The
// icon is fully drawn (letterforms included) around 2s, before the outro
// starts dissolving it again, so that's both the poster frame and the
// frame the video rests on once it has been played.
const ICON_REST_TIME = 2.0;

// Placeholder easing until the LAYERS section's poster-arc reveal curve
// exists to match against (flagged to the user — see chat).
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function SkillTile({ name, slug }: { name: string; slug: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = true;
    v.currentTime = 0;
    v.play().catch(() => {});
    setActive(true);
  };

  // Rests on the fully-drawn frame rather than frame 0 (which is blank),
  // so the tile matches its poster instead of going black after a hover.
  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = ICON_REST_TIME;
    } catch {
      // seeking before metadata is ready throws in some browsers; the
      // poster is still showing at that point, so there's nothing to fix.
    }
    setActive(false);
  };

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (canHover) return;
    const el = tileRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else stop();
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={tileRef}
      onMouseEnter={play}
      onMouseLeave={stop}
      className={`frame-glow${active ? " frame-glow--active" : ""} relative aspect-square w-full overflow-hidden rounded-2xl bg-black`}
    >
      <video
        ref={videoRef}
        poster={`/icons/${slug}.png`}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      >
        <source src={`/icons/${slug}.webm`} type="video/webm" />
        <source src={`/icons/${slug}.mp4`} type="video/mp4" />
      </video>
      <span
        className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs tracking-wide text-white/60"
        style={{ fontFamily: SANS }}
      >
        {name}
      </span>
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
          const scale = 1 + easeInOutSine(frac) * 0.08;
          photoEl.style.transform = `scale(${scale})`;
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

        <div className="mt-14 flex justify-center sm:justify-end">
          <div className="frame-glow relative aspect-square w-[clamp(180px,60vw,280px)] shrink-0 overflow-hidden rounded-2xl sm:w-[clamp(220px,26vw,340px)]">
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

        <div
          ref={skillsRevealRef}
          className="mt-16 grid grid-cols-2 gap-4 sm:mt-24 sm:grid-cols-4 sm:gap-6"
          style={{ opacity: 0 }}
        >
          {SKILLS.map((s) => (
            <SkillTile key={s.name} name={s.name} slug={s.slug} />
          ))}
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
