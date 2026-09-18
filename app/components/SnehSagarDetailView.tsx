"use client";

// THE SNEH SAGAR PROJECT PAGE.
//
// Structure follows the supplied reference closely: a top identification
// band (square preview + the other publications), a main viewer (title/
// metadata/description left, the current page large and centred with its
// neighbours softened behind it, an accent line right, zoom/overview
// controls under it), and a lower band (overview grid, a mobile preview,
// a compact recap). The reference governs placement, proportion and
// hierarchy only — not typography (this page uses the site's own Neue
// Montreal throughout, never the reference's serif/script) and not
// content: every word here is either this project's own real metadata or
// text drawn directly from the supplied PDF (the dedication poem on its
// second page is what the "accent" column shows), never invented.
//
// THE PAGES ARE THE SUPPLIED PDF, RASTERISED — all 37 of them (see
// public/publications/sneh-sagar/pages), not a placeholder count. No
// page-flip animation, no 3D book mockup: a plain crossfade between
// flat images is what keeps "the actual publication pages are the hero"
// rather than a viewer effect competing with them.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INDEX_PUBLICATIONS } from "./publicationsData";

const SANS = "'Neue Montreal', system-ui, sans-serif";
const PAGE_COUNT = 37;
const PAGE_ASPECT = 1240 / 1523;
const pageSrc = (n: number) => `/publications/sneh-sagar/pages/page-${String(n).padStart(2, "0")}.jpg`;

const COVER_SRC: Record<string, string> = {
  "sneh-sagar": "/images/publications/sneh-sagar-front.jpg",
  excledge: "/images/publications/excel-edge-front.jpg",
  mining: "/images/publications/mining-front.jpg",
  handbook: "/images/publications/employee-handbook-front.jpg",
  policy: "/images/publications/policy-front.jpg",
};

// The dedication, verbatim from the PDF's own second page — real content,
// not reference copy, standing in for the reference's own "accent" column.
const DEDICATION = [
  "Turn these pages with gentlest care,",
  "A lifetime of love is woven right there.",
  "Through quiet strength and unwavering grace,",
  "Her warmth lights up every single space.",
  "Walk through her journey, inspiring and true",
  "A heart this rare touches all of us, too.",
];

const DESCRIPTION =
  "Sneha Sagar is a tribute book created by her children to celebrate the life and spirit of their mother. The book brings together letters, memories, photographs and small details from the people whose lives she has touched. I designed the book, shaping the words and images into a warm, personal and handcrafted visual narrative that reflects her generosity, strength and quiet impact. These are selected pages from the book.";

const CLOSING_LINE = "Some lives leave behind more than memories.";

export default function SnehSagarDetailView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const others = useMemo(() => INDEX_PUBLICATIONS.filter((p) => p.id !== "sneh-sagar"), []);

  const goTo = useCallback((n: number) => {
    setPage(Math.min(PAGE_COUNT, Math.max(1, n)));
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (overviewOpen) {
        if (ev.key === "Escape") setOverviewOpen(false);
        return;
      }
      if (ev.key === "ArrowLeft") goTo(page - 1);
      else if (ev.key === "ArrowRight") goTo(page + 1);
      else if (ev.key === "Escape" && zoomed) setZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo, overviewOpen, zoomed]);

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ fontFamily: SANS, minHeight: "100dvh" }}
    >
      {/* ── TOP: square preview + the other publications ──────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "clamp(24px, 4vw, 56px)",
          padding: "clamp(20px, 3.5vh, 40px) clamp(20px, 4vw, 56px) clamp(28px, 4vh, 48px)",
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/publications"
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Back
          </Link>
          {/* The square preview — a real fragment of the book (its own
              dedication page), the same still-photograph role the
              reference's own square card plays, not a redrawn icon. */}
          <div
            style={{
              width: "clamp(140px, 16vw, 220px)",
              aspectRatio: "1 / 1",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 60px rgba(255,255,255,0.04), 0 30px 70px rgba(0,0,0,0.7)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageSrc(6)}
              alt="Sneh Sagar"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }}
            />
          </div>
        </div>

        <div
          aria-hidden
          style={{ alignSelf: "stretch", width: 1, background: "rgba(255,255,255,0.1)", minHeight: 120 }}
        />

        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(13px, 1.1vw, 16px)",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
            }}
          >
            Publications
          </h2>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Other publications in this section
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
            {[{ id: "sneh-sagar", title: "Sneh Sagar" }, ...others].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => p.id !== "sneh-sagar" && router.push(`/publications/${p.id}`)}
                aria-current={p.id === "sneh-sagar"}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "center",
                  width: 74,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: p.id === "sneh-sagar" ? "default" : "pointer",
                  color: "#fff",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 8,
                    overflow: "hidden",
                    border:
                      p.id === "sneh-sagar"
                        ? "1.5px solid rgba(255,255,255,0.6)"
                        : "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={COVER_SRC[p.id]}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    textAlign: "center",
                    color: p.id === "sneh-sagar" ? "#fff" : "rgba(255,255,255,0.55)",
                    lineHeight: 1.2,
                    maxWidth: 74,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}
                >
                  {p.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN VIEWER ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          padding: "clamp(28px, 4.5vh, 56px) clamp(20px, 4vw, 56px)",
          display: "grid",
          gridTemplateColumns: "minmax(200px, 260px) minmax(0, 1fr) minmax(160px, 220px)",
          gap: "clamp(20px, 3vw, 48px)",
          alignItems: "center",
        }}
        className="sneh-main-grid"
      >
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {String(page).padStart(2, "0")} / {String(PAGE_COUNT).padStart(2, "0")}
          </div>
        </div>

        {/* LEFT: title/metadata/description — no subtitle beneath the
            title, per the site-wide rule for every publication page. */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 3.2vw, 46px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
            }}
          >
            Sneh Sagar
          </h1>
          <div style={{ marginTop: 18, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <dl style={{ margin: "18px 0 0", display: "grid", gap: 6 }}>
            {[
              ["Type", "Tribute Book"],
              ["Role", "Design"],
              ["Year", "2024"],
              ["Pages shown", `${PAGE_COUNT} (selected)`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <dt style={{ width: 86, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {k}
                </dt>
                <dd style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.68)",
              fontWeight: 300,
            }}
          >
            {DESCRIPTION}
          </p>
          <div style={{ marginTop: 18, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {CLOSING_LINE}
          </p>
        </div>

        {/* CENTRE: the current page, its immediate neighbours softened
            behind it at either edge — the same depth relationship the
            reference has, built from this same page set rather than a
            separate illustration. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            style={navArrowStyle("left")}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= PAGE_COUNT}
            aria-label="Next page"
            style={navArrowStyle("right")}
          >
            ›
          </button>

          <div
            style={{
              position: "relative",
              width: "min(100%, 46vh)",
              aspectRatio: String(PAGE_ASPECT),
            }}
          >
            {[page - 1, page + 1].map((n) =>
              n >= 1 && n <= PAGE_COUNT ? (
                <div
                  key={n}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "6%",
                    bottom: "6%",
                    [n < page ? "left" : "right"]: "-6%",
                    width: "94%",
                    borderRadius: 6,
                    overflow: "hidden",
                    filter: "blur(3px) brightness(0.55)",
                    zIndex: 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pageSrc(n)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : null
            )}
            <div
              onClick={() => setZoomed((v) => !v)}
              style={{
                position: "relative",
                zIndex: 2,
                width: "100%",
                height: "100%",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 0 90px rgba(255,255,255,0.05), 0 50px 120px rgba(0,0,0,0.8)",
                cursor: "zoom-in",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={page}
                src={pageSrc(page)}
                alt={`Sneh Sagar, page ${page}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: the dedication, real PDF copy. */}
        <div style={{ fontSize: "clamp(13px, 1.05vw, 16px)", fontStyle: "italic", color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          {DEDICATION.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
          <button type="button" onClick={() => setZoomed((v) => !v)} style={controlLinkStyle}>
            Zoom {zoomed ? "−" : "+"}
          </button>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <button type="button" onClick={() => setOverviewOpen(true)} style={controlLinkStyle}>
            Overview
          </button>
        </div>
      </div>

      {/* ── LOWER: overview glimpse / mobile preview / recap ───────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 0.9fr 1fr",
          gap: "clamp(20px, 3vw, 40px)",
          padding: "0 clamp(20px, 4vw, 56px) clamp(48px, 7vh, 88px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 8,
          paddingTop: "clamp(28px, 4vh, 48px)",
        }}
        className="sneh-lower-grid"
      >
        <div>
          <div style={sectionLabelStyle}>Overview</div>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 12, cursor: "pointer" }}
            onClick={() => setOverviewOpen(true)}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={n}
                src={pageSrc(n)}
                alt=""
                style={{ width: "100%", aspectRatio: String(PAGE_ASPECT), objectFit: "cover", borderRadius: 3, opacity: n === page ? 1 : 0.55 }}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={sectionLabelStyle}>Mobile preview</div>
          <div
            style={{
              marginTop: 12,
              width: "min(100%, 170px)",
              border: "6px solid #1a1a1a",
              borderRadius: 22,
              background: "#000",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ position: "relative", aspectRatio: String(PAGE_ASPECT * 0.62), overflow: "hidden", borderRadius: 16, background: "#000" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pageSrc(page)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 8,
                  fontSize: 9,
                  color: "rgba(255,255,255,0.85)",
                  display: "flex",
                  justifyContent: "space-between",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                <span>Sneh Sagar</span>
                <span>
                  {page}/{PAGE_COUNT}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={sectionLabelStyle}>Sneh Sagar</div>
          <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", fontWeight: 300 }}>
            {DESCRIPTION}
          </p>
        </div>
      </div>

      {/* ── OVERVIEW MODE ───────────────────────────────────────────── */}
      {overviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sneh Sagar — page overview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(4,4,5,0.97)",
            overflowY: "auto",
            padding: "clamp(24px, 4vh, 48px) clamp(20px, 4vw, 56px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
              Overview — {PAGE_COUNT} pages
            </div>
            <button type="button" onClick={() => setOverviewOpen(false)} style={controlLinkStyle}>
              Close ×
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
            {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  goTo(n);
                  setOverviewOpen(false);
                }}
                style={{
                  padding: 0,
                  border: n === page ? "1.5px solid rgba(255,255,255,0.7)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageSrc(n)} alt={`Page ${n}`} style={{ width: "100%", display: "block", aspectRatio: String(PAGE_ASPECT), objectFit: "cover" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ZOOM ─────────────────────────────────────────────────────── */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomed(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4vh 4vw",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pageSrc(page)}
            alt={`Sneh Sagar, page ${page}`}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 4 }}
          />
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .sneh-main-grid { grid-template-columns: 1fr !important; }
          .sneh-lower-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function navArrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    [side]: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
}

const controlLinkStyle: React.CSSProperties = {
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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
};
