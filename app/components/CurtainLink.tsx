"use client";

// A LINK THAT LEAVES THE WAY THE CARDS ARRIVE.
//
// Going in from a card is a curtain; coming back out used to be a hard
// cut, which made the two directions feel like different sites. This is
// the same wipe, on a plain anchor: the panel sweeps up over the page, the
// navigation happens behind it, and the destination carries the edge off
// (every page does, via the root layout's Curtain).
//
// Deliberately a real navigation rather than a client transition — the
// pages this joins own WebGL contexts, pinned ScrollTriggers and per-frame
// clocks, and handing between them in the client leaves one alive under
// the other. A modified click (new tab, middle button) falls through to
// the browser's own handling untouched.

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { curtainOut } from "../lib/curtain";

export default function CurtainLink({
  href,
  style,
  className,
  children,
}: {
  href: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    curtainOut(() => window.location.assign(href));
  };
  return (
    <a href={href} style={style} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
