"use client";

// THE SECOND HALF OF THE TRANSITION, on whatever page the first half led
// to. Mounted once in the root layout, so every destination opens the same
// way: the project pages, the category routes, and anything added later.
// It does nothing at all unless the page before it actually closed.
//
// The page is already closed before this runs — an inline script in the
// document head sets data-reveal on <html> and a rule in globals.css
// applies the closed aperture, because a React effect is several frames
// too late and those frames are exactly the flash of unmasked page the
// transition exists to prevent. All this does is hand that closed state
// over to GSAP and open it.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageIn, takeRevealIntent, REVEAL_ATTR } from "../lib/pageTransition";

export default function PageReveal() {
  // Keyed on the path, not mounted once: this lives in the root layout,
  // which survives a client-side route change, so a once-only effect would
  // only ever run for the first page of a visit. The intent flag is
  // consumed when it is read, so a path change with no transition behind
  // it does nothing.
  const pathname = usePathname();
  useEffect(() => {
    const closed = document.documentElement.getAttribute(REVEAL_ATTR) === "1";
    if (!takeRevealIntent() && !closed) return;
    pageIn();
  }, [pathname]);
  // RESTORED FROM THE BACK/FORWARD CACHE. Going Back to a page the browser
  // kept whole brings it back exactly as it was left — which is closed,
  // because the aperture shut on it on the way out. No effect above runs
  // (nothing remounts), so the aperture is opened again here.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      takeRevealIntent();
      pageIn();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}
