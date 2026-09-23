"use client";

// THE PROJECT HEADER — Back, number, title, description — in the one place
// every graphic-design project page puts it: a left column at the top
// left, exactly as the Publications project pages have it. Built once, so
// no project can position or size this block differently.
//
// Whatever a page adds below the description (its own status, view
// switches, metadata) comes in as children, under the same four lines.
// Below 900px the column becomes the top of the page, full width.
//
// Three variants, one position. "rail" is the Publications column itself,
// for work that wants the full height beside it. "block" is the same box,
// same inset and same type at the same top-left corner, with the page's
// work running full width underneath — for wide work (16:9 screens, a
// long case study) that a column would squeeze. "overlay" is the block
// laid over a full-bleed scene.

import { useEffect, useState, type ReactNode } from "react";
import TransitionLink from "./TransitionLink";
import { resolveGdBackHref, type GdProject } from "./graphicDesignProjects";

const SANS = "'Neue Montreal', system-ui, sans-serif";

export default function ProjectRail({
  number,
  title,
  description,
  backHref,
  children,
  variant = "rail",
  gd,
}: {
  number: string;
  title: ReactNode;
  description?: ReactNode;
  backHref: string;
  children?: ReactNode;
  variant?: "rail" | "block" | "overlay";
  /** A graphic-design project: Back then returns to wherever its ring
   *  card was opened from — the homepage journey or the category page. */
  gd?: GdProject;
}) {
  const [href, setHref] = useState(backHref);
  useEffect(() => {
    if (!gd) return;
    // After mount: the origin lives in this visit's sessionStorage, which
    // the static export cannot know about at build time.
    const id = requestAnimationFrame(() => setHref(resolveGdBackHref(gd)));
    return () => cancelAnimationFrame(id);
  }, [gd]);
  return (
    <aside
      className={`pr-rail pr-${variant}`}
      data-project-rail={variant}
      style={{ fontFamily: SANS }}
    >
      <TransitionLink href={href} className="pr-back" historyBack={!!gd}>
        <span aria-hidden>←</span> Back
      </TransitionLink>
      <div>
        <div className="pr-num">{number}</div>
        <h1 className="pr-title">{title}</h1>
      </div>
      {description ? <p className="pr-desc">{description}</p> : null}
      {children}
      <style>{`
        .pr-rail {
          width: clamp(270px, 27vw, 380px);
          flex: 0 0 auto;
          align-self: flex-start;
          position: sticky; top: 0;
          height: 100dvh;
          box-sizing: border-box;
          border-right: 1px solid rgba(255,255,255,0.08);
          padding: clamp(20px, 3.4vh, 38px) clamp(20px, 2.2vw, 36px);
          display: flex; flex-direction: column; gap: 20px;
          overflow-y: auto; scrollbar-width: none;
          color: #fff; background: #000;
          z-index: 2;
        }
        .pr-rail::-webkit-scrollbar { width: 0; height: 0; }
        .pr-block, .pr-overlay {
          position: relative; height: auto; align-self: auto;
          border-right: none; background: none; overflow: visible;
        }
        .pr-overlay { position: absolute; top: 0; left: 0; z-index: 5; }
        .pr-back {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.62); text-decoration: none;
          align-self: flex-start;
        }
        .pr-num {
          font-size: 11px; font-weight: 500; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 10px;
        }
        .pr-title {
          margin: 0; font-size: clamp(26px, 2.4vw, 40px); font-weight: 500;
          letter-spacing: -0.01em; line-height: 1.08;
        }
        .pr-desc {
          margin: 0; font-size: 13px; line-height: 1.7; font-weight: 300;
          color: rgba(255,255,255,0.68);
        }
        @media (max-width: 900px) {
          .pr-block, .pr-overlay { border-bottom: none; }
          .pr-rail {
            width: 100%; height: auto; position: static; align-self: stretch;
            border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08);
            overflow: visible;
          }
          .pr-block { position: relative; }
          .pr-overlay { position: absolute; width: auto; right: 0; }
        }
      `}</style>
    </aside>
  );
}
