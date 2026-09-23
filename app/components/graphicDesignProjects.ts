// THE GRAPHIC DESIGN PROJECTS, in the order the ring shows them.
//
// One table, so a project's number, its place on the ring and where its
// Back goes can never disagree. `card` is the ring slot (0-based) the
// project's card sits in; the numbering skips 05, whose slot on the ring
// is held empty, exactly as the approved order lists it:
//
//   01 Publications  02 Campaigns / Social  03 Logos
//   04 Informational Design  06 Posters  07 Applications
//   08 Reception Screen  09 Comics — Post Production

export type GdProject = { number: string; card: number; title: string; href: string };

export const GD_PROJECTS = {
  publications: { number: "01", card: 0, title: "Publications", href: "/publications" },
  campaigns: { number: "02", card: 1, title: "Campaigns / Social", href: "/campaigns" },
  logos: { number: "03", card: 2, title: "Logos", href: "/logos" },
  informationalDesign: {
    number: "04",
    card: 3,
    title: "Informational Design",
    href: "/informational-design",
  },
  posters: { number: "06", card: 5, title: "Posters", href: "/posters" },
  applications: { number: "07", card: 6, title: "Applications", href: "/applications" },
  receptionScreen: {
    number: "08",
    card: 7,
    title: "Reception Screen",
    href: "/reception-screen",
  },
  comics: { number: "09", card: 8, title: "Comics — Post Production", href: "/ai-comics" },
} satisfies Record<string, GdProject>;

/** Back from a project: the ring, opened on the card that project was
 *  opened from — never the first card. */
export const gdBackHref = (p: GdProject) => `/work/graphic-design?card=${p.card}`;

// ── WHERE BACK GOES ─────────────────────────────────────────────────────
//
// The ring lives in two places: inside the homepage's journey, and on its
// own category page. A project opened from the JOURNEY must go back into
// the journey — at its card — or the reader is stranded on a page that
// ends with the ring and can never scroll on to Art. The ring records
// which one opened a project; Back reads it.
export const GD_ORIGIN_KEY = "gdOrigin";
/** Beyond this a remembered origin is stale: the reader went elsewhere. */
const GD_ORIGIN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** The homepage's own param: open the journey on this ring card. */
export const HOME_GD_PARAM = "gd";

export function rememberGdOrigin(card: number) {
  try {
    sessionStorage.setItem(
      GD_ORIGIN_KEY,
      JSON.stringify({
        from: window.location.pathname === "/" ? "home" : "category",
        card,
        at: Date.now(),
      })
    );
  } catch {
    // Storage blocked: Back falls back to the category page, at the card.
  }
}

/** Back for project `p`, resolved against where it was opened from. */
export function resolveGdBackHref(p: GdProject): string {
  try {
    const raw = sessionStorage.getItem(GD_ORIGIN_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { from?: string; card?: number; at?: number };
      if (
        o.from === "home" &&
        o.card === p.card &&
        typeof o.at === "number" &&
        Date.now() - o.at < GD_ORIGIN_MAX_AGE_MS
      ) {
        return `/?${HOME_GD_PARAM}=${p.card}`;
      }
    }
  } catch {
    // See rememberGdOrigin.
  }
  return gdBackHref(p);
}

/**
 * Where ring card `k` is square to the lens, as a share of the cord
 * section's own progress: CordSection hands the arc its progress from
 * 0.51 on, and ArcCarousel turns that into a rotation from -2.6 to
 * 9 - 1 + 2.6 cards. Shared by the category page and the homepage, so the
 * two can never open the ring on different cards for the same number.
 */
export function ringCardProgress(k: number): number {
  const CORD_ARC_START = 0.51;
  const ARC_LEAD = 2.6;
  const ARC_CARD_COUNT = 9;
  return (
    CORD_ARC_START +
    ((ARC_LEAD + k) / (ARC_CARD_COUNT - 1 + ARC_LEAD * 2)) * (1 - CORD_ARC_START)
  );
}
