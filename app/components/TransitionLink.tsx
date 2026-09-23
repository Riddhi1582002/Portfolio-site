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
  onNavigate,
  historyBack,
  ariaCurrent,
}: {
  href: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
  /** Runs on a real click, just before the page starts to close. */
  onNavigate?: () => void;
  /**
   * A BACK link: when the page before this one in the history IS `href`,
   * go back to it rather than loading it again — the browser can then
   * restore it exactly as it was left (its 3D scenes already built, its
   * carousel where it was) instead of rebuilding it from nothing.
   */
  historyBack?: boolean;
  ariaCurrent?: "page";
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    onNavigate?.();
    if (historyBack && previousPageIs(href)) {
      pageOut(() => window.history.back());
      return;
    }
    pageOut(() => window.location.assign(href));
  };
  return (
    <a href={href} style={style} className={className} onClick={onClick} aria-current={ariaCurrent}>
      {children}
    </a>
  );
}

/** Whether the page this one was opened from is exactly `href`. */
function previousPageIs(href: string): boolean {
  try {
    if (window.history.length < 2 || !document.referrer) return false;
    const prev = new URL(document.referrer);
    const want = new URL(href, window.location.href);
    return (
      prev.origin === want.origin &&
      prev.pathname === want.pathname &&
      prev.search === want.search
    );
  } catch {
    return false;
  }
}
