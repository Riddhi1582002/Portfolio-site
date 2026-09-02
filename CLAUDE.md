@AGENTS.md

# Visual/UI task completion checklist

Before marking any visual/UI task complete:

1. Run a Playwright pass that checks the bounding boxes of all elements at
   each scroll/state checkpoint. Flag any unintended overlaps or spacing
   under `1rem` (16px).
2. Self-critique the resulting screenshots using the `design:design-critique`
   skill, looking specifically for cramped spacing, poor hierarchy, or
   competing elements. This skill ships in the `design` plugin (marketplace:
   `knowledge-work-plugins`) — if it isn't enabled for the session, invoking
   it fails with "Unknown skill". Enable the `design` plugin first; if it
   can't be enabled, fall back to the same critique manually (hierarchy,
   spacing, competing elements) and say so explicitly in the report.
3. Only report the task complete once both checks pass. Show what was
   checked (checkpoints measured, findings, and how they were resolved) in
   the response.

# Spec-to-assertion rule

Whenever a spec describes a size, position, or visibility requirement (e.g.
"should exceed viewport," "should not overlap," "should fade to 0
opacity"), write an actual Playwright assertion that measures it —
`getBoundingClientRect()`, computed `opacity`, etc. — and confirms pass or
fail. Never just report that a constant was changed or describe what
should happen; run the measurement and show the real numbers against the
requirement (e.g. "width 1539px > viewport 1280px: pass", not "increased
the scale factor").
