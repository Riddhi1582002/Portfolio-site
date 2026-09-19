"use client";

// THE SECOND HALF OF THE WIPE, on whatever page the first half led to.
//
// Mounted once in the root layout, so every destination is covered: the
// project pages, the category routes, and anything added later. It does
// nothing at all unless the page before it actually raised a curtain.
//
// The cover itself is already on screen before this runs — an inline
// script in the document head sets data-curtain on <html> and a rule in
// globals.css paints it, because a React effect is several frames too late
// and those frames are exactly the flash of unmasked page the curtain
// exists to prevent. All this does is hand that cover over to a real
// element GSAP can move, and move it.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { curtainIn, takeCurtainIntent } from "../lib/curtain";

export default function Curtain() {
  // Keyed on the path, not mounted once: this lives in the root layout,
  // which survives a client-side route change, so a once-only effect would
  // only ever run for the first page of a visit. The intent flag is
  // consumed when it is read, so a path change with no curtain behind it
  // does nothing.
  const pathname = usePathname();
  useEffect(() => {
    const covered =
      document.documentElement.getAttribute("data-curtain") === "1";
    if (!takeCurtainIntent() && !covered) return;
    // The GSAP panel goes up FIRST and the CSS cover comes down second, in
    // that order and in the same frame: reversed, there is one frame with
    // neither on screen.
    curtainIn();
    document.documentElement.removeAttribute("data-curtain");
  }, [pathname]);
  return null;
}
