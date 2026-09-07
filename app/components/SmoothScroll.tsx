"use client";

// GSAP ScrollSmoother, wrapping the page.
//
// The site already scrubbed everything off one scroll value that this
// component's siblings ease themselves (HeroSection and PinnedSection each
// ran their own exponential smoothing in a rAF loop). Stacking
// ScrollSmoother on top of that would be two smoothers in series, which is
// exactly the trailing, floaty feel we are trying to remove — so those
// internal easings are switched off while this is mounted, and the smoothing
// is done once, here. See SMOOTHER_ACTIVE below.
//
// The page keeps the browser's own scrollbar: ScrollSmoother leaves the
// document scrolling natively and transforms the content to lag behind it.
//
// position:fixed does NOT survive inside the transformed content — a
// transformed ancestor becomes the containing block — so the fixed video
// backdrop is rendered OUTSIDE the wrapper by app/page.tsx and is not this
// component's child.

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

/**
 * Whether the page is being smoothed here. The scroll-driven sections read
 * this and skip their own easing so the two cannot compound.
 */
// FALSE until the pins are converted. ScrollSmoother translates
// #smooth-content, and `position: sticky` does not survive inside a
// transformed container — measured at scrollY 4000, the hero's pane sat at
// top:-4000 instead of 0, i.e. every pinned beat scrolled away. The whole
// sequence is built on those panes, so this stays off rather than ship a
// site where nothing pins. The supported fix is to replace the three
// sticky panes with ScrollTrigger `pin: true`, which IS transform-based
// and composes with ScrollSmoother; that is a separate change.
export const SMOOTHER_ACTIVE = false;

// Conservative on purpose. High enough to take the step out of a wheel
// notch, low enough that the page never feels like it is catching up.
const SMOOTH_SECONDS = 0.72;

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const created = useRef(false);

  useEffect(() => {
    if (created.current) return;
    created.current = true;

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    // Touch devices keep native scrolling: a smoothed transform fights
    // momentum scrolling and makes drag surfaces feel detached.
    const smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: SMOOTH_SECONDS,
      smoothTouch: 0,
      // No data-speed / data-lag anywhere on this site; leaving effects off
      // keeps ScrollSmoother from walking the DOM looking for them.
      effects: false,
      normalizeScroll: false,
      ignoreMobileResize: true,
    });

    ScrollTrigger.refresh();

    return () => {
      smoother?.kill();
      created.current = false;
    };
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  );
}
