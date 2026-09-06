"use client";

// Neumorphic pill toggle, built to the supplied CSS.
//
// The geometry, shadows and the cubic-bezier(0.85, 0.05, 0.18, 1.35)
// overshoot are taken verbatim: a 60x30 pill, an indicator twice its width
// sliding between -75% and 25%. Only the surrounding page rules from the
// snippet (body { height: 100vh; background: #ecf0f3 }) are left out —
// those belong to the demo page it came from, not to a component.
//
// The palette is the snippet's own light neumorphic set, so the control
// reads as a physical object on the black page rather than as another
// glowing white element. Change --toggle-surface / --toggle-shadow to
// darken it.
//
// The input is a real checkbox: it is focusable, it toggles with the
// keyboard, and it exposes checked state to assistive tech without any
// aria plumbing.

import "./tool-toggle.css";

export default function ToolToggle({
  on,
  onChange,
  labelText,
  id = "tool-toggle",
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  labelText: string;
  id?: string;
}) {
  return (
    <label className="tt-label" htmlFor={id}>
      <span className="tt-toggle">
        <input
          id={id}
          className="tt-state"
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="tt-indicator" />
      </span>
      <span className="tt-text">{labelText}</span>
    </label>
  );
}
