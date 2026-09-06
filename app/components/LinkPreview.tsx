"use client";

// Hover preview for an inline link: a floating card that rises above the
// link and leans toward the cursor.
//
// The supplied component was a Framer one built on framer-motion
// (AnimatePresence, useMotionValue, useSpring, useTransform). This project
// is GSAP + ScrollTrigger only and framer-motion is explicitly ruled out,
// so the same behaviour is rebuilt on what is already here: a CSS
// transition for the rise, and the same critically damped follow used by
// HoverCard for the lean, written to a custom property.
//
// The `originalImage` path — fetching a screenshot of the destination from
// a third-party API — is deliberately not carried over. It sends the
// visitor's browser to an external service on hover, and this site is a
// static export with no need for it. Pass an `image` instead.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// How far the card leans, in px, at the extremes of the link's width.
const LEAN_PX = 44;
const TAU = 0.12;

export default function LinkPreview({
  children,
  image,
  alt,
  previewWidth = 300,
  previewHeight = 186,
  radius = 12,
  className = "",
  style,
}: {
  children: ReactNode;
  image: string;
  alt: string;
  previewWidth?: number;
  previewHeight?: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    // Hover-only affordance: on a touch device the card would either never
    // appear or appear stuck, and it carries no information the link does
    // not already give. Deferred a frame so the first paint matches the
    // server's markup.
    const id = requestAnimationFrame(() =>
      setEnabled(window.matchMedia("(hover: hover) and (pointer: fine)").matches)
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // Self-scheduling loop. Declared as a plain function held in a ref so it
  // can request its own next frame without referencing itself before it is
  // initialised.
  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(function frame(ts) {
      const host = hostRef.current;
      if (!host) return;
      if (lastRef.current === 0) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      const k = 1 - Math.exp(-dt / TAU);
      currentRef.current += (targetRef.current - currentRef.current) * k;
      host.style.setProperty("--lean", `${currentRef.current.toFixed(2)}px`);
      if (Math.abs(targetRef.current - currentRef.current) > 0.1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        lastRef.current = 0;
      }
    });
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const host = hostRef.current;
    if (!host || !enabled) return;
    const rect = host.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
    targetRef.current = (Math.min(1, Math.max(0, ratio)) - 0.5) * 2 * LEAN_PX;
    startLoop();
  };

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return (
    <span
      ref={hostRef}
      className={className}
      style={{ position: "relative", display: "inline-block", ...style }}
      onMouseEnter={enabled ? () => setHovered(true) : undefined}
      onMouseLeave={enabled ? () => setHovered(false) : undefined}
      onMouseMove={enabled ? onMove : undefined}
    >
      {children}

      {enabled && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 16px)",
            width: previewWidth,
            height: previewHeight,
            marginLeft: -previewWidth / 2,
            borderRadius: radius,
            overflow: "hidden",
            background: "#000",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            zIndex: 10,
            display: "block",
            opacity: hovered ? 1 : 0,
            transform: `translateX(var(--lean, 0px)) translateY(${hovered ? "0px" : "12px"}) scale(${hovered ? 1 : 0.94})`,
            transition:
              "opacity 220ms cubic-bezier(0.2,0.8,0.3,1), transform 320ms cubic-bezier(0.2,0.8,0.3,1)",
            willChange: "transform, opacity",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={alt}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </span>
      )}
    </span>
  );
}
