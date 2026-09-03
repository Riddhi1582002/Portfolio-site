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

# Responsive self-check widths

The Playwright pass in the visual/UI checklist above must test these
viewport widths, not just one: **320, 360, 390, 414, 768, 834, 1024, 1280,
1440, 1920, 2560**, plus **740×360 landscape**. No visual task is complete
until all of them have been checked — a pass at one or two sizes (even a
fine-grained scroll/state sweep at that size) says nothing about the
others; mixing viewport-relative units across axes (e.g. sizing one
element in `vw` while positioning another in `vh`) is a common way a fix
that's clean at one width silently breaks at another.

Paired heights (portrait unless noted), for a reproducible run — these are
real device viewport sizes, not arbitrary:

| Width | Height | Device class |
|-------|--------|---------------|
| 320   | 568    | iPhone SE |
| 360   | 800    | Common Android phone |
| 390   | 844    | iPhone 12/13/14 |
| 414   | 896    | iPhone 11/XR |
| 768   | 1024   | iPad portrait |
| 834   | 1194   | iPad Air/Pro portrait |
| 1024  | 768    | iPad landscape / small laptop |
| 1280  | 800    | Laptop |
| 1440  | 900    | Laptop |
| 1920  | 1080   | Desktop FHD |
| 2560  | 1440   | Desktop QHD |
| 740   | 360    | Phone, landscape (explicit) |
