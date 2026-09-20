"use client";

// A LINK THAT LEAVES THE WAY EVERY PAGE ARRIVES.
//
// Going in from a card and coming back out are the same move, in opposite
// directions: the page closes to its centre line, the navigation happens
// behind it, and the destination opens from the same line. See
// app/lib/pageTransition.ts.
//
// Deliberately a real navigation rather than a client transition — the
// pages this joins own WebGL contexts, pinned ScrollTriggers and per-frame
// clocks, and handing between them in the client leaves one alive under
// the other. A modified click (new tab, middle button) falls through to
// the browser's own handling untouched.

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { pageOut } from "../lib/pageTransition";

export default function TransitionLink({
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
    pageOut(() => window.location.assign(href));
  };
  return (
    <a href={href} style={style} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
