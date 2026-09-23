"use client";

// THE CURSOR — desktop only, and deliberately small.
//
// A 5px dot on the pointer and a thin 26px ring that follows it a hair
// behind. Over something that can be opened, dragged, viewed or backed
// out of, the ring opens a little and a one-word label sits beside it;
// over any other link or button it only opens a little. That is all: no
// magnetism, no blend tricks, no large disc.
//
// What the pointer is over comes from the page: the nearest `data-cursor`
// attribute, or — for the two surfaces that hit-test for themselves, the
// homepage ring and the Publications index — whatever they report through
// app/lib/cursor. It never exists on a touch or coarse pointer, and the
// native cursor is only hidden once this one is actually on screen.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cursorContext, onCursorContext, type CursorLabel } from "../lib/cursor";

type State = "idle" | "link" | CursorLabel;

const LABELS: Record<CursorLabel, string> = {
  open: "Open",
  drag: "Drag",
  view: "View",
  back: "Back",
};

const INTERACTIVE = "a[href], button, [role='button'], summary, label[for]";

export default function ContextCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ring = ringRef.current;
    const dot = dotRef.current;
    const label = labelRef.current;
    if (!root || !ring || !dot || !label) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const html = document.documentElement;

    // A short follow: long enough to read as a ring trailing the dot, short
    // enough that the pointer never feels like it is sliding on ice.
    const ringX = gsap.quickTo(ring, "x", { duration: still.matches ? 0 : 0.08, ease: "power2.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: still.matches ? 0 : 0.08, ease: "power2.out" });

    let shown = false;
    let state: State = "idle";
    let locked: State | null = null;
    let lastTarget: Element | null = null;
    let lastX = -1;
    let lastY = -1;
    let scrollRaf = 0;

    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      root.style.opacity = on ? "1" : "0";
      html.classList.toggle("cc-on", on);
    };

    const stateFor = (target: Element | null): State => {
      const reported = cursorContext();
      if (reported) return reported;
      if (!target) return "idle";
      const tagged = target.closest<HTMLElement>("[data-cursor]");
      const tag = tagged?.dataset.cursor as CursorLabel | "none" | undefined;
      if (tag && tag !== "none" && tag in LABELS) return tag;
      if (tag === "none") return "idle";
      return target.closest(INTERACTIVE) ? "link" : "idle";
    };

    const apply = (next: State) => {
      const s = locked ?? next;
      if (s === state) return;
      state = s;
      root.dataset.state = s;
      if (s !== "idle" && s !== "link") label.textContent = LABELS[s];
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches) return;
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      if (!shown) gsap.set(ring, { x: e.clientX, y: e.clientY });
      ringX(e.clientX);
      ringY(e.clientY);
      show(true);
      lastX = e.clientX;
      lastY = e.clientY;
      lastTarget = e.target instanceof Element ? e.target : null;
      apply(stateFor(lastTarget));
    };
    // The page moving under a still pointer changes what it is over
    // without any pointer event — the gallery arriving under it, say.
    const onScroll = () => {
      if (!shown || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        lastTarget = document.elementFromPoint(lastX, lastY);
        apply(stateFor(lastTarget));
      });
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      root.dataset.pressed = "";
      // A press that starts a drag keeps saying DRAG for the whole drag,
      // even as the pointer passes over something else on the way.
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("[data-cursor='drag']") && state !== "back") locked = "drag";
      apply(stateFor(t));
    };
    const onUp = () => {
      delete root.dataset.pressed;
      locked = null;
      // Not the event's target: a drag surface holding pointer capture is
      // the target of every move until release, whatever is under it.
      if (lastX >= 0) lastTarget = document.elementFromPoint(lastX, lastY);
      apply(stateFor(lastTarget));
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) show(false);
    };
    const onReported = () => apply(stateFor(lastTarget));
    const onFine = () => {
      if (!fine.matches) show(false);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onLeave);
    fine.addEventListener("change", onFine);
    const offReported = onCursorContext(onReported);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      document.removeEventListener("mouseout", onLeave);
      fine.removeEventListener("change", onFine);
      offReported();
      html.classList.remove("cc-on");
    };
  }, []);

  return (
    <div ref={rootRef} className="cc" data-state="idle" aria-hidden style={{ opacity: 0 }}>
      <div ref={ringRef} className="cc-pos">
        <div className="cc-ring" />
        <span ref={labelRef} className="cc-label" />
      </div>
      <div ref={dotRef} className="cc-pos">
        <div className="cc-dot" />
      </div>
    </div>
  );
}
