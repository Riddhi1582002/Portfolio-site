"use client";

// THE card hover treatment for the whole site.
//
// A 3D pointer tilt, and the glare strips the tilt produces at the corners.
// That is the whole effect. There is deliberately NO glow, halo or spotlight
// tracking the cursor: the cursor sets the tilt angle, and the light is a
// consequence of the angle, the way it is on a real tilted panel.
//
// Wrap anything in it — a photograph, a reel thumbnail, a placeholder block
// — and it gets the same treatment, so cards read as one material across
// every section.
//
// No new dependencies: React refs, one rAF loop, CSS custom properties.

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import "./hover-card.css";

const ENTER_TRANSITION_MS = 180;

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v: number, precision = 3) => parseFloat(v.toFixed(precision));

type Engine = {
  setTarget: (x: number, y: number) => void;
  toCenter: () => void;
  getCurrent: () => { x: number; y: number; tx: number; ty: number };
  cancel: () => void;
};

export default function HoverCard({
  children,
  className = "",
  /** Aspect ratio of the card box, as width/height. */
  aspect = 1,
  radius,
  style,
}: {
  children: ReactNode;
  className?: string;
  aspect?: number;
  radius?: number | string;
  style?: CSSProperties;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const makeEngine = (): Engine => {
    let rafId: number | null = null;
    let running = false;
    let lastTs = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    const TAU = 0.14;

    const write = (x: number, y: number) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap) return;
      const width = shell.clientWidth || 1;
      const height = shell.clientHeight || 1;
      const percentX = clamp((100 / width) * x);
      const percentY = clamp((100 / height) * y);
      const centerX = percentX - 50;
      const centerY = percentY - 50;
      // How far from centre the pointer is, 0..1 — the strips brighten with
      // this rather than with the pointer's absolute position, so the light
      // is a property of the tilt and not a cursor-following glow.
      const tilt = clamp(Math.hypot(centerX, centerY) / 50, 0, 1);

      const props: Record<string, string> = {
        "--pointer-from-top": `${percentY / 100}`,
        "--pointer-from-left": `${percentX / 100}`,
        "--rotate-x": `${round(-(centerX / 5))}deg`,
        "--rotate-y": `${round(centerY / 4)}deg`,
        "--tilt-amount": `${round(tilt)}`,
      };
      for (const [k, v] of Object.entries(props)) wrap.style.setProperty(k, v);
    };

    const step = (ts: number) => {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const k = 1 - Math.exp(-dt / TAU);
      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      write(currentX, currentY);
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        rafId = requestAnimationFrame(step);
      } else {
        running = false;
        lastTs = 0;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    };

    return {
      setTarget(x, y) {
        targetX = x;
        targetY = y;
        start();
      },
      toCenter() {
        const shell = shellRef.current;
        if (!shell) return;
        this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
      },
      getCurrent: () => ({ x: currentX, y: currentY, tx: targetX, ty: targetY }),
      cancel() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        running = false;
        lastTs = 0;
      },
    };
  };

  const getEngine = useCallback(() => {
    engineRef.current ??= makeEngine();
    return engineRef.current;
  }, []);

  const offsets = (evt: PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      const { x, y } = offsets(event, shell);
      getEngine().setTarget(x, y);
    },
    [getEngine]
  );

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      shell.classList.add("active", "entering");
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = window.setTimeout(() => {
        shell.classList.remove("entering");
      }, ENTER_TRANSITION_MS);
      const { x, y } = offsets(event, shell);
      getEngine().setTarget(x, y);
    },
    [getEngine]
  );

  const onPointerLeave = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const engine = getEngine();
    engine.toCenter();
    const settle = () => {
      const { x, y, tx, ty } = engine.getCurrent();
      if (Math.hypot(tx - x, ty - y) < 0.6) {
        shell.classList.remove("active");
        leaveRafRef.current = null;
      } else {
        leaveRafRef.current = requestAnimationFrame(settle);
      }
    };
    if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
    leaveRafRef.current = requestAnimationFrame(settle);
  }, [getEngine]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    // No tilt on coarse pointers: there is no hover to respond to.
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) {
      return;
    }
    shell.addEventListener("pointerenter", onPointerEnter);
    shell.addEventListener("pointermove", onPointerMove);
    shell.addEventListener("pointerleave", onPointerLeave);
    return () => {
      shell.removeEventListener("pointerenter", onPointerEnter);
      shell.removeEventListener("pointermove", onPointerMove);
      shell.removeEventListener("pointerleave", onPointerLeave);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
      engineRef.current?.cancel();
      shell.classList.remove("entering", "active");
    };
  }, [getEngine, onPointerEnter, onPointerMove, onPointerLeave]);

  return (
    <div
      ref={wrapRef}
      className={`hc-wrapper ${className}`.trim()}
      style={
        {
          "--card-aspect": String(aspect),
          ...(radius != null
            ? { "--card-radius": typeof radius === "number" ? `${radius}px` : radius }
            : {}),
          ...style,
        } as CSSProperties
      }
    >
      <div ref={shellRef} className="hc-shell">
        <section className="hc-card">
          <div className="hc-content">{children}</div>
          <div className="hc-glare" aria-hidden />
          <div className="hc-sheen" aria-hidden />
        </section>
      </div>
    </div>
  );
}
