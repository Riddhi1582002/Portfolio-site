"use client";

// A scroll track with a pinned viewport, handing its children a single
// 0..1 progress.
//
// One listener, one rAF, one eased value — the same smoothing the hero
// uses, so every section on the page scrubs with the same feel and a wheel
// notch never advances a section in a visible step.
//
// `?<name>Progress=<n>` in the URL pins the value, so any frame of any
// section can be captured exactly rather than scrolled to approximately.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SMOOTHER_ACTIVE } from "./SmoothScroll";

const SMOOTH_TAU = 0.09;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function PinnedSection({
  lengthVh,
  name,
  children,
  background = "#000",
}: {
  /** Total track height. The pinned pane is 100vh of it. */
  lengthVh: number;
  /** Used for the debug query parameter, e.g. name="reels" -> ?reelsProgress= */
  name: string;
  children: (progress: number) => ReactNode;
  background?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const targetRef = useRef(0);
  const smoothRef = useRef(0);
  const primedRef = useRef(false);

  useEffect(() => {
    const pinned = new URLSearchParams(window.location.search).get(`${name}Progress`);
    const pinnedValue = pinned === null ? null : Number(pinned);
    if (pinnedValue !== null && Number.isFinite(pinnedValue)) {
      const id = requestAnimationFrame(() => setProgress(clamp01(pinnedValue)));
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
      targetRef.current = total > 0 ? clamp01(-rect.top / total) : 0;
      if (!primedRef.current) {
        primedRef.current = true;
        smoothRef.current = targetRef.current;
        setProgress(targetRef.current);
      }
    };
    const onScroll = () => {
      if (scrollRaf == null) scrollRaf = requestAnimationFrame(measure);
    };
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // See SmoothScroll: one smoother, not two in series.
      const k = SMOOTHER_ACTIVE ? 1 : 1 - Math.exp(-dt / SMOOTH_TAU);
      const next = smoothRef.current + (targetRef.current - smoothRef.current) * k;
      smoothRef.current =
        Math.abs(targetRef.current - next) < 0.0002 ? targetRef.current : next;
      setProgress(smoothRef.current);
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
  }, [name]);

  return (
    <div
      ref={trackRef}
      data-section={name}
      style={{ position: "relative", height: `${lengthVh}vh`, zIndex: 1 }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background,
        }}
      >
        {children(progress)}
      </div>
    </div>
  );
}
