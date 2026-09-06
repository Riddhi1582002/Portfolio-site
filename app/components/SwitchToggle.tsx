"use client";

// The supplied switch artwork, driven as a real ON/OFF control.
//
// The source is a 121-frame APNG that plays a full round trip —
// Creative -> AI -> back to Creative — and loops forever. An <img> cannot
// be seeked, paused or reversed, and its acTL asks for infinite looping,
// so it is resampled to a 25-frame transparent sprite sheet and stepped
// from JS instead. That gives exactly what a toggle needs: stop on a
// frame, never loop, and run the motion backwards to come back.
//
// Frames 0..12 are the artwork's own OFF -> ON move; 12..24 are its own
// ON -> OFF move. Both directions are the artist's animation, not a
// reversed playback of one half.
//
// The switch IS the control: no wrapper button, no label, no overlay.
// Sized entirely from CSS (--switch-width), transparent, proportions kept.

import { useEffect, useRef, useState } from "react";

const SPRITE_URL = "/ui/switch-sprite.png";
const COLS = 5;
const ROWS = 5;
const FRAME_COUNT = 25;
// The frame where the artwork has settled into its ON state.
const ON_INDEX = 12;
const FRAME_MS = 26;
// Native frame size, for the aspect ratio only — the rendered size comes
// from CSS.
const FRAME_W = 190;
const FRAME_H = 70;

export default function SwitchToggle({
  on,
  onChange,
  label,
  className = "",
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — the artwork carries no text a screen reader can read. */
  label: string;
  className?: string;
}) {
  const [frame, setFrame] = useState(on ? ON_INDEX : 0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  // Where the walk is heading, and whether one is running. Kept in refs so
  // mounting does not look like a state change: on first render the switch
  // simply sits on its resting frame.
  const targetRef = useRef(on ? ON_INDEX : 0);
  const prevOnRef = useRef(on);

  useEffect(() => {
    if (prevOnRef.current === on) return;
    prevOnRef.current = on;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      targetRef.current = on ? ON_INDEX : 0;
      const id = requestAnimationFrame(() => setFrame(on ? ON_INDEX : 0));
      return () => cancelAnimationFrame(id);
    }

    // Turning on walks 0..12. Turning off carries on through the artwork's
    // own return move, 12..24, then settles on 0 — which is the same
    // picture as 24. The index only ever increases, so neither direction is
    // a reversed playback of the other.
    targetRef.current = on ? ON_INDEX : FRAME_COUNT - 1;

    const step = (ts: number) => {
      if (ts - lastRef.current >= FRAME_MS) {
        lastRef.current = ts;
        setFrame((f) => {
          if (f === targetRef.current) return f;
          const next = f + 1;
          if (next >= FRAME_COUNT) return 0;
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [on]);

  // Stop the walk once it has arrived, and settle the OFF state on frame 0.
  useEffect(() => {
    if (frame !== targetRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (!on && frame === FRAME_COUNT - 1) {
      targetRef.current = 0;
      const id = requestAnimationFrame(() => setFrame(0));
      return () => cancelAnimationFrame(id);
    }
  }, [frame, on]);

  const col = frame % COLS;
  const row = Math.floor(frame / COLS);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`switch-toggle ${className}`.trim()}
      style={{
        // Editable in one place; height follows the artwork's ratio.
        width: "var(--switch-width, 190px)",
        aspectRatio: `${FRAME_W} / ${FRAME_H}`,
        padding: 0,
        border: "none",
        background: `url(${SPRITE_URL}) no-repeat`,
        backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
        cursor: "pointer",
        display: "block",
      }}
    />
  );
}
