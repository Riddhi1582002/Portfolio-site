"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const SKILLS = [
  { name: "After Effects", src: "/icons/After-Effects.webm" },
  { name: "Illustrator", src: "/icons/Illustrator.mp4" },
  { name: "Photoshop", src: "/icons/Photoshop.webm" },
  { name: "Premiere Pro", src: "/icons/Premiere-Pro.webm" },
];

// Placeholder easing until the LAYERS section's poster-arc reveal curve
// exists to match against (flagged to the user — see chat).
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function SkillTile({ name, src }: { name: string; src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = true;
    v.play().catch(() => {});
    setActive(true);
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
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
        src={src}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      />
      <span
        className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs tracking-wide text-white/60"
        style={{ fontFamily: SANS }}
      >
        {name}
      </span>
    </div>
  );
}

export default function AboutSection() {
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = photoRef.current;
        if (!el) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        const scale = 1 + easeInOutSine(frac) * 0.08;
        el.style.transform = `scale(${scale})`;
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
        <div className="flex flex-col-reverse items-start gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p
            className="text-sm tracking-wide text-white/60"
            style={{ fontFamily: SANS }}
          >
            About — coming soon
          </p>

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

        <div className="mt-16 grid grid-cols-2 gap-4 sm:mt-24 sm:grid-cols-4 sm:gap-6">
          {SKILLS.map((s) => (
            <SkillTile key={s.name} name={s.name} src={s.src} />
          ))}
        </div>

        <Link
          href="/"
          className="mt-16 inline-block text-sm text-white/80 underline"
          style={{ fontFamily: SANS }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
