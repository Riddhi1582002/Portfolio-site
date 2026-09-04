"use client";

// Pointer-tilt + holographic shine treatment for the About portrait.
//
// Adapted from ProfileCard. Kept: the 3D pointer tilt with its critically
// damped follow, the shine/glare layers, the behind-glow. Removed
// outright: the whole pc-user-info block (mini avatar, handle, status,
// contact button) and the name/title plate — this is a photograph getting
// a hover treatment, not a social card, and the About page already has the
// name as its own header.
//
// No new dependencies: plain React refs, one rAF loop, CSS custom
// properties. Nothing here reaches for a motion library.

import { useCallback, useEffect, useRef } from "react";
import "./PhotoCard.css";

const ENTER_TRANSITION_MS = 180;
const INITIAL_DURATION_MS = 1200;
const INITIAL_X_OFFSET = 70;
const INITIAL_Y_OFFSET = 60;

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v: number, precision = 3) => parseFloat(v.toFixed(precision));
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

type Engine = {
  setImmediate: (x: number, y: number) => void;
  setTarget: (x: number, y: number) => void;
  toCenter: () => void;
  beginInitial: (ms: number) => void;
  getCurrent: () => { x: number; y: number; tx: number; ty: number };
  cancel: () => void;
};

export default function PhotoCard({
  avatarUrl,
  alt,
  className = "",
}: {
  avatarUrl: string;
  alt: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);

  // The engine owns mutable animation state (current/target position, the
  // rAF handle). It lives in a ref built once on first access rather than
  // in a useMemo closure: reassigning closure variables after render is
  // exactly what the React compiler warns about, and a ref is the
  // sanctioned place for state React must not track.
  const engineRef = useRef<Engine | null>(null);
  const makeEngine = (): Engine => {
    let rafId: number | null = null;
    let running = false;
    let lastTs = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const DEFAULT_TAU = 0.14;
    const INITIAL_TAU = 0.6;
    let initialUntil = 0;

    const setVarsFromXY = (x: number, y: number) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap) return;

      const width = shell.clientWidth || 1;
      const height = shell.clientHeight || 1;
      const percentX = clamp((100 / width) * x);
      const percentY = clamp((100 / height) * y);
      const centerX = percentX - 50;
      const centerY = percentY - 50;

      const properties: Record<string, string> = {
        "--pointer-x": `${percentX}%`,
        "--pointer-y": `${percentY}%`,
        "--background-x": `${adjust(percentX, 0, 100, 35, 65)}%`,
        "--background-y": `${adjust(percentY, 0, 100, 35, 65)}%`,
        "--pointer-from-center": `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        "--pointer-from-top": `${percentY / 100}`,
        "--pointer-from-left": `${percentX / 100}`,
        "--rotate-x": `${round(-(centerX / 5))}deg`,
        "--rotate-y": `${round(centerY / 4)}deg`,
      };
      for (const [k, v] of Object.entries(properties)) wrap.style.setProperty(k, v);
    };

    const step = (ts: number) => {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU;
      const k = 1 - Math.exp(-dt / tau);
      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      setVarsFromXY(currentX, currentY);

      const stillFar =
        Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;
      if (stillFar) {
        rafId = requestAnimationFrame(step);
      } else {
        // The original also kept spinning while the document had focus,
        // which meant an idle rAF loop running for the life of the page.
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
      setImmediate(x, y) {
        currentX = x;
        currentY = y;
        setVarsFromXY(currentX, currentY);
      },
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
      beginInitial(ms) {
        initialUntil = performance.now() + ms;
        start();
      },
      getCurrent() {
        return { x: currentX, y: currentY, tx: targetX, ty: targetY };
      },
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
    const checkSettle = () => {
      const { x, y, tx, ty } = engine.getCurrent();
      if (Math.hypot(tx - x, ty - y) < 0.6) {
        shell.classList.remove("active");
        leaveRafRef.current = null;
      } else {
        leaveRafRef.current = requestAnimationFrame(checkSettle);
      }
    };
    if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
    leaveRafRef.current = requestAnimationFrame(checkSettle);
  }, [getEngine]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    // Coarse pointers get no tilt: there is no hover on touch, and the
    // device-orientation path the original offered is a permission prompt
    // for a decorative effect.
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) {
      return;
    }

    shell.addEventListener("pointerenter", onPointerEnter);
    shell.addEventListener("pointermove", onPointerMove);
    shell.addEventListener("pointerleave", onPointerLeave);

    const engine = getEngine();
    engine.setImmediate((shell.clientWidth || 0) - INITIAL_X_OFFSET, INITIAL_Y_OFFSET);
    engine.toCenter();
    engine.beginInitial(INITIAL_DURATION_MS);

    return () => {
      shell.removeEventListener("pointerenter", onPointerEnter);
      shell.removeEventListener("pointermove", onPointerMove);
      shell.removeEventListener("pointerleave", onPointerLeave);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
      engine.cancel();
      shell.classList.remove("entering", "active");
    };
  }, [getEngine, onPointerEnter, onPointerMove, onPointerLeave]);

  return (
    <div ref={wrapRef} className={`pc-card-wrapper ${className}`.trim()}>
      <div className="pc-behind" />
      <div ref={shellRef} className="pc-card-shell">
        <section className="pc-card">
          <div className="pc-inside">
            <div className="pc-shine" />
            <div className="pc-glare" />
            <div className="pc-content pc-avatar-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="avatar" src={avatarUrl} alt={alt} loading="lazy" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
