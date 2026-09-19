// THE HOMEPAGE'S OWN SECTIONS, as plain data.
//
// Split out of HeroSection so a category route can read these without
// importing the entire homepage — which would pull the hero, the reels,
// the bulb and the gallery into every category's bundle, exactly the
// coupling that isolating the categories is meant to remove.

/** The three categories, in the order the homepage lists them. */
export const HOME_SECTION_KEYS = ["video", "graphic-design", "art"] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/**
 * Each category's own route. A category is a place, not a scroll offset.
 *
 * Under /work/ rather than at the root, and not by preference: `public/`
 * already holds a `video/` folder (the hero backdrop, the reel sources)
 * and an `art/` folder (the gallery's own images), which a static export
 * copies straight into the site root. A `/video` route would have sat on
 * top of `/video/...`, and the client router's fetch for it resolved to
 * the asset directory instead of the page — clicking VIDEO did nothing at
 * all, silently. /work/<category> collides with nothing.
 */
export const HOME_SECTION_HREF: Record<HomeSectionKey, string> = {
  video: "/work/video",
  "graphic-design": "/work/graphic-design",
  art: "/work/art",
};

/**
 * THE JOURNEY, ONCE COMPLETED.
 *
 * The three category links are not a menu that is always there: they are
 * what the homepage leaves behind once the reader has been all the way
 * through it. That memory has to survive leaving for a category and coming
 * back, which is a real navigation — so sessionStorage, whose lifetime is
 * exactly this visit.
 */
export const JOURNEY_DONE_KEY = "homeJourneyComplete";
/** A category's Back sets this to say "open at the final state". */
export const HOME_FINAL_PARAM = "home";
export const HOME_FINAL_VALUE = "final";
