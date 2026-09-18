"use client";

// A PUBLICATION'S OWN PAGE — the plain shell four of the five publications
// use (Sneh Sagar's is its own, much larger build; see
// SnehSagarDetailView). What is actually known about ExcelEDGE, Mining,
// the Handbook and Policy is a title, a medium and a cover — nothing else
// is invented here to fill the page out. No subtitle under the title: the
// medium label already says what kind of piece this is.
//
// NORMAL DOCUMENT FLOW, not a fixed 100dvh box with absolutely positioned
// regions — that was this file's first draft, copied from the spatial
// index page's own layout, and it was the wrong pattern to borrow: that
// page's absolute positioning exists because a full-bleed 3D scene sits
// behind it and everything else has to float over that scene. This page
// has no scene, only flat content, and the fixed box clipped rather than
// scrolled once the cover, title and "other publications" row together
// needed more height than a short viewport (740x360 landscape) had —
// the title rendered PARTLY BEHIND the cover's own bottom edge. A plain
// stacked flow, the same shape SnehSagarDetailView already uses
// successfully, simply grows the page and lets it scroll instead.
//
// Reached by clicking the publication on /publications (see
// PublicationsIndexView's onFocusComplete) or directly by URL.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { INDEX_PUBLICATIONS } from "./publicationsData";

const SANS = "'Neue Montreal', system-ui, sans-serif";

const COVER_SRC: Record<string, string> = {
  "sneh-sagar": "/images/publications/sneh-sagar-front.jpg",
  excledge: "/images/publications/excel-edge-front.jpg",
  mining: "/images/publications/mining-front.jpg",
  handbook: "/images/publications/employee-handbook-front.jpg",
  policy: "/images/publications/policy-front.jpg",
};

export default function PublicationDetailView({ slug }: { slug: string }) {
  const router = useRouter();
  const pub = INDEX_PUBLICATIONS.find((p) => p.id === slug);
  const cover = COVER_SRC[slug];
  const others = INDEX_PUBLICATIONS.filter((p) => p.id !== slug);

  if (!pub) return null;

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ minHeight: "100dvh", fontFamily: SANS }}
    >
      {/* TOP: back + section label. */}
      <div
        style={{
          padding: "clamp(18px, 3.5vh, 34px) clamp(18px, 4vw, 48px) 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
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
      </div>

      {/* MAIN: cover on the left, identification on the right — the same
          two-thing hierarchy the reference's own main viewer has (a large
          page, a plain information column beside it), scaled down to what
          these four pieces actually have to show. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(32px, 6vw, 96px)",
          padding: "clamp(48px, 8vh, 96px) clamp(24px, 6vw, 80px)",
          flexWrap: "wrap",
        }}
      >
        {cover && (
          <div
            style={{
              position: "relative",
              width: "min(70vw, 320px)",
              aspectRatio: "3 / 4",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 90px rgba(255,255,255,0.05), 0 50px 120px rgba(0,0,0,0.8)",
              flex: "0 0 auto",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a
                plain cover crop, not an optimizable content image; the
                site's other static art already renders this way. */}
            <img
              src={cover}
              alt={`${pub.title} cover`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        <div style={{ flex: "0 1 480px", minWidth: 260 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 3.6vw, 52px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.08,
            }}
          >
            {pub.title}
          </h1>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {pub.medium}
          </div>
        </div>
      </div>

      {/* BOTTOM: the other four, each a way into its own page — the same
          cross-navigation the reference's "other project cards" row gives,
          built from the same data and cover images this page itself uses. */}
      <div
        style={{
          padding: "0 clamp(18px, 4vw, 48px) clamp(32px, 6vh, 56px)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            marginBottom: 12,
          }}
        >
          Other Publications
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {others.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => router.push(`/publications/${o.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8,
                padding: "8px 14px 8px 8px",
                cursor: "pointer",
                color: "#fff",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  overflow: "hidden",
                  flex: "0 0 auto",
                  background: "#111",
                }}
              >
                {COVER_SRC[o.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={COVER_SRC[o.id]}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {o.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
