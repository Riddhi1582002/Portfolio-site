// THE LOGOS PROJECT — the supplied identities and the objects they live on.
//
// Every mark here is the SUPPLIED artwork. Nothing is redrawn, recoloured
// or re-set: the GLBs arrived with each identity already applied as a
// texture, so the branding on the bottle, the bottle beside it, the tanker
// and the card is the designer's own file, not a recreation of it. The
// flat lockups below are the same marks again, supplied separately, shown
// next to the object each one is applied to — so a reader sees the
// identity and its real-world application together.
//
// FOUR PROJECTS, and only four. The supplied archive also carries marks
// for brands the brief does not list; naming them here would be inventing
// a project, so they are left out.
//
// No description, client or date is stated for any of these beyond what
// the brief itself gives, which is a name and a category.

export type LogoProject = {
  id: string;
  /** The brand, exactly as the brief names it. */
  title: string;
  /** The brief's own category word. */
  category: string;
  /** What the identity is applied to, in the brief's own words. */
  mockup: string;
  /** The supplied object, with the identity already on it. */
  glb: string;
  /** The supplied flat lockup. */
  logo: string;
};

export const LOGO_PROJECTS: LogoProject[] = [
  {
    id: "clear-wave",
    title: "Clear Wave",
    category: "Beverage",
    mockup: "Mineral water bottle",
    glb: "/model/logos/clear-wave.glb",
    logo: "/logos/clear-wave.jpg",
  },
  {
    id: "fruit-rush",
    title: "Fruit Rush",
    category: "Beverage",
    mockup: "Juice bottle",
    glb: "/model/logos/fruit-rush.glb",
    logo: "/logos/fruit-rush.jpg",
  },
  {
    id: "mel",
    title: "MEL",
    category: "Energy",
    mockup: "Tanker rear",
    glb: "/model/logos/mel-tanker.glb",
    logo: "/logos/mel.png",
  },
  {
    id: "orient-industries",
    title: "Orient Industries",
    category: "Industrial",
    mockup: "Business card",
    glb: "/model/logos/orient-card.glb",
    logo: "/logos/orient-industries.jpg",
  },
];

/**
 * THE COMPOSED STILL LIFE, as supplied — all four objects in one file, in
 * the arrangement the designer staged them in. Used for the homepage card
 * and for the project page's hero, because re-placing four objects that
 * already stand in a composition is how a staged photograph becomes a
 * scattering of props.
 */
export const LOGOS_SCENE = "/model/logos/logos-scene.glb";

export const LOGOS = {
  title: "Logos",
  description:
    "Distinct identities for diverse industries — crafted to communicate purpose, build recognition and create lasting impact.",
  note:
    "A collection of logo and brand identity projects across industries, each designed with a clear vision, strong visual language and real-world application.",
} as const;
