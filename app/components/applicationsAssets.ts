// WHAT THE APPLICATIONS PROJECT IS MADE OF.
//
// Plain, no "use client": the static route at app/applications reads this
// on the server the same way publicationsContent.ts is read.
//
// CURATED, NOT COMPLETE. Fifteen chemical mockups were supplied; nine are
// used. The selection keeps all three container types the range actually
// has — drum, jerrycan, PP bag — so the collection reads as a product
// system rather than a wall of the same blue object, and the ones left
// out are the near-duplicates of ones kept (Poly Aluminium Chloride next
// to Sodium Silicate, Formaldehyde next to Liquid Ammonia, LABSA and
// Sorbitol next to Sulphuric Acid, Activated Carbon and Aluminium
// Sulphate next to Caustic Soda Flakes). Nothing is shown twice and
// nothing is shown only because it exists.
//
// EVERY NAME HERE IS READ OFF THE ARTWORK. The product names are set in
// type on the packaging in the supplied mockups; the workplace pieces
// carry their own titles. Nothing is inferred, dated or attributed.

export type ApplicationPiece = {
  id: string;
  src: string;
  /** Printed on the piece itself. Never a description of it. */
  label: string;
  /** Native aspect, width / height — the box each piece is given is the
   *  one its own pixels ask for, so nothing is ever cropped or stretched. */
  aspect: number;
};

/** Where a piece sits in its section's twelve-column field, per breakpoint:
 *  `[startColumn, columnSpan, row]`, plus the downward stagger in px that
 *  gives the row its depth. Placement is explicit rather than auto-flowed
 *  so the arrangement is the same composition at every load.
 *
 *  TWO RULES HOLD THE FIELD TOGETHER, and both came out of looking at it.
 *  A row never pairs spans more than about one step apart: a span-3 plate
 *  beside a span-6 one is twice as short, and the 460px of nothing left
 *  under it read as a hole rather than as space. And every row reaches
 *  column 12, so the right-hand edge stays a line instead of fraying —
 *  the air in the composition is put where it was meant to be, in the
 *  gaps BETWEEN pieces, not left over at the margin. */
export type Placement = {
  lg: [number, number, number];
  md: [number, number, number];
  /** Downward offset at lg / md. Always positive: a negative one would eat
   *  into the row gap above and is how a staggered grid starts colliding. */
  offLg: number;
  offMd: number;
  /** Below 640px everything is one column; this is the share of that
   *  column the piece takes, and which edge it sits against. */
  smWidth: number;
  smAlign: "start" | "end";
};

export type PlacedPiece = ApplicationPiece & Placement;

const CHEM = (id: string, label: string, aspect = 1024 / 1280) => ({
  id,
  src: `/applications/chemical/${id}.jpg`,
  label,
  aspect,
});

/** THE OPENING. One drum, alone and large — the dominant piece the whole
 *  page starts from, not the first cell of a grid. */
export const OPENING: ApplicationPiece = CHEM(
  "sodium-hypochlorite",
  "Sodium Hypochlorite"
);

/** THE COLLECTION. Eight more, at four distinct sizes and four depths. */
export const CHEMICAL: PlacedPiece[] = [
  { ...CHEM("hydrochloric-acid", "Hydrochloric Acid"),
    lg: [1, 6, 1], md: [1, 3, 1], offLg: 0,   offMd: 0,  smWidth: 0.84, smAlign: "start" },
  { ...CHEM("sulphuric-acid", "Sulphuric Acid"),
    lg: [8, 5, 1], md: [4, 3, 1], offLg: 70,  offMd: 56, smWidth: 1,    smAlign: "end" },
  { ...CHEM("sodium-metabisulphite", "Sodium Metabisulphite", 1024 / 1281),
    lg: [1, 4, 2], md: [1, 6, 2], offLg: 0,   offMd: 0,  smWidth: 0.9,  smAlign: "end" },
  { ...CHEM("nitric-acid", "Nitric Acid"),
    lg: [9, 4, 2], md: [1, 3, 3], offLg: 90,  offMd: 0,  smWidth: 0.72, smAlign: "start" },
  { ...CHEM("sodium-silicate", "Sodium Silicate"),
    lg: [1, 5, 3], md: [4, 3, 3], offLg: 70,  offMd: 48, smWidth: 1,    smAlign: "start" },
  { ...CHEM("caustic-soda-flakes", "Caustic Soda Flakes", 1024 / 1281),
    lg: [7, 6, 3], md: [1, 6, 4], offLg: 0,   offMd: 0,  smWidth: 0.78, smAlign: "end" },
  { ...CHEM("liquid-ammonia", "Liquid Ammonia"),
    lg: [2, 4, 4], md: [1, 3, 5], offLg: 70,  offMd: 0,  smWidth: 0.72, smAlign: "start" },
  { ...CHEM("sles", "SLES"),
    lg: [8, 5, 4], md: [4, 3, 5], offLg: 0,   offMd: 40, smWidth: 1,    smAlign: "end" },
];

/** The letterhead is the dominant piece and the second sheet sits lower
 *  and smaller behind its eyeline; the mug closes the section across the
 *  middle. Both sheets are A4 at 2480x3508 and stay at that proportion. */
export const CORPORATE: PlacedPiece[] = [
  { id: "letterhead-01", src: "/applications/corporate/letterhead-01.jpg",
    label: "Letterhead", aspect: 2480 / 3508,
    lg: [1, 6, 1], md: [1, 4, 1], offLg: 0,   offMd: 0,   smWidth: 1,    smAlign: "start" },
  { id: "letterhead-02", src: "/applications/corporate/letterhead-02.jpg",
    label: "Letterhead", aspect: 2480 / 3508,
    lg: [8, 5, 1], md: [5, 2, 1], offLg: 130, offMd: 170, smWidth: 0.78, smAlign: "end" },
  { id: "mug", src: "/applications/corporate/mug.png",
    label: "Mug", aspect: 1376 / 768,
    lg: [3, 10, 2], md: [1, 6, 2], offLg: 0,  offMd: 0,   smWidth: 1,    smAlign: "start" },
];

/**
 * THE WORKPLACE PIECES ARE WHERE THEY WERE PUT. Both were supplied with
 * the reception-screen additions and are already on disk under
 * /reception-screen; a second copy under /applications would be the same
 * two files twice, and moving them would break the page that has them.
 * The Pat-on-the-Back award leads because it is the stronger piece.
 */
export const WORKPLACE: PlacedPiece[] = [
  { id: "pat-on-the-back", src: "/reception-screen/pat-on-the-back.jpg",
    label: "Pat-on-the-Back Award", aspect: 16 / 9,
    lg: [1, 10, 1], md: [1, 6, 1], offLg: 0, offMd: 0, smWidth: 1,    smAlign: "start" },
  { id: "posh", src: "/reception-screen/posh.jpg",
    label: "POSH Training at EIPL", aspect: 16 / 9,
    lg: [6, 7, 2], md: [2, 5, 2], offLg: 0, offMd: 0, smWidth: 0.88, smAlign: "end" },
];

/** Two banners at 4:1 — the proportion of the surface they were made for,
 *  so they are drawn wide and never boxed into something squarer. */
export const DIGITAL: PlacedPiece[] = [
  { id: "banner-01", src: "/applications/digital/banner-01.jpg",
    label: "LinkedIn banner", aspect: 4,
    lg: [1, 9, 1], md: [1, 6, 1], offLg: 0, offMd: 0, smWidth: 1,    smAlign: "start" },
  { id: "banner-02", src: "/applications/digital/banner-02.jpg",
    label: "LinkedIn banner", aspect: 4,
    lg: [4, 9, 2], md: [1, 6, 2], offLg: 0, offMd: 0, smWidth: 1,    smAlign: "end" },
];

export type ApplicationSection = {
  index: string;
  title: string;
  pieces: PlacedPiece[];
};

/** The four categories, in the order the brief fixes them. */
export const SECTIONS: ApplicationSection[] = [
  { index: "01", title: "Chemical Packaging", pieces: CHEMICAL },
  { index: "02", title: "Corporate Applications", pieces: CORPORATE },
  { index: "03", title: "Workplace & Events", pieces: WORKPLACE },
  { index: "04", title: "Digital Applications", pieces: DIGITAL },
];

export const SUBTITLE = "Commercial / Physical Applications";

/** Supplied, approved copy. Reproduced exactly. */
export const DESCRIPTION =
  "A selection of commercial and physical applications developed across EIPL’s communication and branding work — translating visual systems into tangible formats, from chemical packaging and industrial materials to corporate stationery, workplace applications and event collateral.";
