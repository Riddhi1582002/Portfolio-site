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
    // NOT a wrapping label. A label that contains the input forwards its
    // own activation to that input, so a click landing on the input itself
    // was counted twice against the controlled checkbox and the pill
    // toggled on but never back off. The container is an inert span; the
    // input takes clicks on the pill natively, and the text is a separate
    // non-wrapping label pointing at it by id — one activation each.
    <span className="tt-label">
      {/* The accent travels with the state rather than being passed in:
          there are exactly two categories, and the control is the thing
          that knows which one is showing. */}
      <span className="tt-toggle" data-accent={on ? "ai" : "creative"}>
        <input
          id={id}
          className="tt-state"
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="tt-indicator" />
      </span>
      <label className="tt-text" htmlFor={id}>
        {labelText}
      </label>
    </span>
  );
}
