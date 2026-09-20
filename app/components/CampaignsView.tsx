"use client";

// THE CAMPAIGNS / SOCIAL PROJECT PAGE.
//
// Eighteen months of work in four groups, in the order the brief fixes:
// Departments / Info, Employee & Company, Carousels, Other Campaigns. The
// groups are tabs rather than a single endless scroll because they are
// four different kinds of communication, and the reference shows them
// read one at a time.
//
// NO GLOBAL NAVIGATION. There is a Back link to the gallery this project
// belongs to and nothing else: no site menu, no section list, no
// dashboard chrome. The work is the page.
//
// EVERY PIECE KEEPS ITS OWN PROPORTIONS. The grid is a column layout, not
// a set of fixed tiles, so a 1:1 post, a 4:5 post and a 16:9 poster each
// occupy the box their own pixels ask for. Nothing is cropped to make a
// tidier grid, and no caption, title or invented date is drawn over any
// artwork.
//
// A CAROUSEL IS ONE PIECE. Each supplied PDF is a single LinkedIn
// carousel; its pages are its slides. It is never split into separate
// posts, its preview shows the real first slide at a size you can read,
// and opening it shows every slide in order at its own proportions.

import { useCallback, useEffect, useMemo, useState } from "react";
import TransitionLink from "./TransitionLink";
import {
  CAROUSELS,
  DEPT_POSTS,
  EMPLOYEE_POSTS,
  OTHER_POSTS,
  type CampaignCarousel,
  type CampaignItem,
} from "./campaignsAssets";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const DESCRIPTION =
  "18 months of LinkedIn content planning and creative development for EIPL, creating distinct visual directions for different departments, information needs and communication goals. The work spans departmental and informational posts, employee and internal communications, and campaigns created for other companies, with each visual approach shaped around the purpose and audience of the communication.";

type TabKey = "dept" | "employee" | "carousels" | "other";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dept", label: "Departments / Info" },
  { key: "employee", label: "Employee & Company" },
  { key: "carousels", label: "Carousels" },
  { key: "other", label: "Other Campaigns" },
];

const IMAGE_SETS: Record<Exclude<TabKey, "carousels">, CampaignItem[]> = {
  dept: DEPT_POSTS,
  employee: EMPLOYEE_POSTS,
  other: OTHER_POSTS,
};

/** What the lightbox is currently showing: a run of images, and where in
 *  it we are. A carousel and a group of posts are the same shape here. */
type Lightbox = { items: string[]; index: number; carousel: boolean };

export default function CampaignsView() {
  const [tab, setTab] = useState<TabKey>("dept");
  const [box, setBox] = useState<Lightbox | null>(null);

  const images = tab === "carousels" ? null : IMAGE_SETS[tab];

  const openImages = useCallback((set: CampaignItem[], index: number) => {
    setBox({ items: set.map((i) => i.src), index, carousel: false });
  }, []);
  const openCarousel = useCallback((c: CampaignCarousel) => {
    setBox({ items: c.slides, index: 0, carousel: true });
  }, []);

  const step = useCallback((delta: number) => {
    setBox((b) => {
      if (!b) return b;
      const next = b.index + delta;
      if (next < 0 || next >= b.items.length) return b;
      return { ...b, index: next };
    });
  }, []);

  useEffect(() => {
    if (!box) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBox(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [box, step]);

  const carousels = useMemo(() => CAROUSELS, []);

  return (
    <div className="relative w-full bg-black text-white" style={{ fontFamily: SANS, minHeight: "100dvh" }}>
      <div className="cs-shell" style={{ display: "flex", minHeight: "100dvh" }}>
        {/* ── LEFT RAIL: back, title, description. Nothing else. ─────── */}
        <aside
          className="cs-rail"
          style={{
            width: "clamp(280px, 28vw, 400px)",
            flex: "0 0 auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "clamp(22px, 3.6vh, 40px) clamp(20px, 2.4vw, 40px)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* Back goes to the gallery this project sits in — the homepage's
              Graphic Design beat — not to the top of the homepage. */}
          <TransitionLink href="/work/graphic-design" style={backLinkStyle}>
            <span aria-hidden>←</span> Back
          </TransitionLink>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 2.7vw, 46px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.08,
            }}
          >
            Campaigns /<br />
            Social
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.75,
              fontWeight: 300,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {DESCRIPTION}
          </p>
        </aside>

        {/* ── MAIN ──────────────────────────────────────────────────── */}
        <main
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            padding: "clamp(22px, 3.6vh, 40px) clamp(18px, 3vw, 48px) clamp(48px, 7vh, 88px)",
          }}
        >
          <div
            role="tablist"
            aria-label="Campaigns and social work"
            style={{ display: "flex", gap: "clamp(18px, 2.6vw, 44px)", flexWrap: "wrap", marginBottom: "clamp(22px, 3.4vh, 40px)" }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0 0 7px",
                  cursor: "pointer",
                  fontFamily: SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: tab === t.key ? "#fff" : "rgba(255,255,255,0.42)",
                  borderBottom:
                    tab === t.key ? "1px solid rgba(255,255,255,0.85)" : "1px solid transparent",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {images && (
            <div className="cs-grid">
              {images.map((item, i) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => openImages(images, i)}
                  style={tileStyle}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt=""
                    width={item.w}
                    height={item.h}
                    loading="lazy"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </button>
              ))}
            </div>
          )}

          {tab === "carousels" && (
            <div className="cs-grid cs-grid--wide">
              {carousels.map((c) => (
                <button key={c.id} type="button" onClick={() => openCarousel(c)} style={tileStyle}>
                  {/* The stacked edges behind the first slide are what make
                      a carousel read as a carousel at a glance — the piece
                      itself is the real first slide at full size, never a
                      shrunken generic PDF thumbnail. */}
                  <span style={{ position: "relative", display: "block" }}>
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: "10px -9px -9px 10px",
                        border: "1px solid rgba(255,255,255,0.16)",
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    />
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: "5px -5px -5px 5px",
                        border: "1px solid rgba(255,255,255,0.22)",
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.05)",
                      }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.slides[0]}
                      alt=""
                      width={c.w}
                      height={c.h}
                      loading="lazy"
                      style={{ position: "relative", width: "100%", height: "auto", display: "block", borderRadius: 2 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 10,
                        bottom: 10,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.62)",
                        border: "1px solid rgba(255,255,255,0.26)",
                        fontSize: 10.5,
                        letterSpacing: "0.1em",
                        color: "#fff",
                      }}
                    >
                      1 / {c.slides.length}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── THE VIEWER ─────────────────────────────────────────────── */}
      {box && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={box.carousel ? "Carousel" : "Post"}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(3,3,4,0.96)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "clamp(16px, 2.6vh, 28px) clamp(18px, 3vw, 40px)" }}>
            <button type="button" onClick={() => setBox(null)} style={{ ...controlStyle, display: "inline-flex", gap: 8 }}>
              <span aria-hidden>←</span> Back
            </button>
            <span style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>
              {box.index + 1} / {box.items.length}
            </span>
          </div>

          <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 clamp(52px, 8vw, 110px) clamp(18px, 3vh, 34px)" }}>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={box.index === 0}
              aria-label="Previous"
              style={arrowStyle("left", box.index === 0)}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={box.index === box.items.length - 1}
              aria-label="Next"
              style={arrowStyle("right", box.index === box.items.length - 1)}
            >
              ›
            </button>
            {/* contain, never cover: the whole piece, at its own ratio. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={box.items[box.index]}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
                boxShadow: "0 40px 110px rgba(0,0,0,0.8)",
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        .cs-grid {
          column-count: 3;
          column-gap: clamp(12px, 1.4vw, 22px);
        }
        .cs-grid--wide { column-count: 2; }
        @media (max-width: 1500px) { .cs-grid { column-count: 3; } }
        @media (max-width: 1100px) { .cs-grid { column-count: 2; } .cs-grid--wide { column-count: 1; } }
        @media (max-width: 900px) {
          .cs-shell { flex-direction: column !important; }
          .cs-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
        }
        @media (max-width: 560px) { .cs-grid { column-count: 1; } }
      `}</style>
    </div>
  );
}

const tileStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 0,
  margin: "0 0 clamp(12px, 1.4vw, 22px)",
  background: "none",
  border: "none",
  borderRadius: 3,
  overflow: "visible",
  cursor: "pointer",
  breakInside: "avoid",
  WebkitTapHighlightColor: "transparent",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.62)",
  textDecoration: "none",
};

const controlStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.75)",
};

function arrowStyle(side: "left" | "right", disabled: boolean): React.CSSProperties {
  return {
    position: "absolute",
    [side]: "clamp(8px, 2vw, 30px)",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 3,
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 22,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.22 : 1,
    display: "grid",
    placeItems: "center",
  };
}
