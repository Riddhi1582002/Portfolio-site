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
// The three panes are pinned by ScrollTrigger now rather than by
// `position: sticky`, which is what this needed: sticky does not survive
// inside ScrollSmoother's transformed content, but ScrollTrigger's pinning
// is itself transform-based and composes with it.
//
// The scroll-driven beats read this and skip their own easing, so the page
// is smoothed exactly once.
export const SMOOTHER_ACTIVE = true;

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
