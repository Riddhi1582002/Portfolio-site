// THE EIPL JACKET AND THE LEAFLETS IT HOLDS — the supplied files, as
// delivered.
//
// THE PHYSICAL OBJECT, which every part of this project reproduces rather
// than reinterprets:
//
//   the jacket is a two-panel folder. Its OUTSIDE is one spread (back
//   cover left, front cover right) and its INSIDE is another. Across the
//   bottom of the inside runs a band — a machinery photograph on the left
//   and the navy Excelsource panel on the right — and that band is the
//   POCKET. It is attached at its bottom and sides and open along its top
//   edge, so a leaflet drops into it FROM ABOVE and is then held with its
//   lower portion hidden behind the band.
//
// The pocket therefore sits UNDER the cover, as part of the inside face;
// it is not a flap lying on top of anything. POCKET_TOP below is where
// that band's top edge falls in the inside spread, measured off the
// supplied artwork, and it is what every "inside the jacket" clip and
// occlusion in this project is built from.
//
// The two jacket spreads are rasterised from the supplied jacket PDF; the
// front and back covers are its outside spread's own two halves, cut on
// the fold. Nothing is redrawn, recoloured or composited.

export type Leaflet = {
  id: string;
  /** The department, exactly as the project names it. */
  title: string;
  /** Front and back, in the supplied order. */
  pages: string[];
  w: number;
  h: number;
};

const LEAFLET_W = 1571;
const LEAFLET_H = 2222;

function leaflet(id: string, title: string): Leaflet {
  const base = `/informational-design/leaflets/${id}`;
  return {
    id,
    title,
    pages: [`${base}/page-01.jpg`, `${base}/page-02.jpg`],
    w: LEAFLET_W,
    h: LEAFLET_H,
  };
}

/** The nine departmental leaflets, in the order the project lists them. */
export const LEAFLETS: Leaflet[] = [
  leaflet("metering-solutions", "Metering Solutions"),
  leaflet("chemsource", "Chemsource"),
  leaflet("edible-oil-refineries", "Solutions for Edible Oil Refineries"),
  leaflet("electricals", "Excelsource Electricals"),
  leaflet("energy-audit-heat-pump", "Energy Audit & Heat Pump Solutions"),
  leaflet("exports-epc", "Exports / EPC"),
  leaflet("filtration", "Excelsource Filtration"),
  leaflet("gnss", "GNSS & Data Collection Solutions"),
  leaflet("hvac", "HVAC Solutions"),
];

export const JACKET = {
  /** One panel of the folder, closed. */
  frontCover: "/informational-design/jacket/front-cover.jpg",
  backCover: "/informational-design/jacket/back-cover.jpg",
  /** Both panels, open — the face the pocket is part of. */
  inside: "/informational-design/jacket/spread-02.jpg",
  /** A single panel's own width/height, and so the closed jacket's shape. */
  panelW: 1410,
  panelH: 1866,
  /** The open spread's shape. */
  spreadW: 2820,
  spreadH: 1866,
  /**
   * Where the pocket band's top edge sits, as a fraction of the inside
   * spread's height, measured on the supplied artwork. Everything below
   * this line is in front of a stored leaflet; everything above it is
   * open, which is why a leaflet leaves upward.
   */
  pocketTop: 0.6,
} as const;

/**
 * NOT APPROVED COPY — no description for this project has been supplied,
 * so this states only what the supplied artwork itself shows: a jacket, a
 * set of one-page departmental leaflets, and the pocket that holds them.
 * It claims nothing about dates, clients, scope or role. Replace this one
 * string with the approved text when it exists; nothing else reads it.
 */
export const INFORMATIONAL_DESIGN = {
  title: "Informational Design",
  description:
    "A printed jacket for EIPL that holds a set of one-page departmental leaflets. Each leaflet covers a single part of the business, and the jacket keeps them together as one piece of company literature — the leaflets drop into the pocket inside the cover and can be taken out and read on their own.",
} as const;
