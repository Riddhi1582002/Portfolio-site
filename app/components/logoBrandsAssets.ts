// THE LOGO BRANDS — the supplied logo variants and their mockup boards.
//
// Source of truth: the two supplied archives (logos_01.zip, logos_02.zip),
// one folder per brand, each holding the logo variants and a mockups
// folder. Every mockup is a finished presentation board — the same scene,
// lighting and layout for every variant of a brand, differing only in the
// logo applied to it — so choosing a variant shows that variant's board.
//
// `board` is the supplied mockup file, byte for byte. `card` is the same
// image resampled (Lanczos, nothing else) for the grid. `logo` is the
// supplied logo file resampled for its small disc, and `disc` is that
// file's own background colour (white under the transparent marks), so
// the disc continues the ground the logo was drawn on.
//
// VARIANT ↔ BOARD. Paired by what each board actually shows, not by file
// number: the numbers agree for every brand except Fruit Rush, whose
// mockups 02 and 03 carry logos 03 and 02.
//
// Shaap Shaap was supplied with one logo and one mockup, and has exactly
// that — no variants are invented to fill its row.

export type LogoVariant = {
  logo: string;
  disc: string;
  board: string;
  card: string;
  w: number;
  h: number;
};

export type LogoBrand = {
  id: string;
  name: string;
  descriptor: string;
  variants: LogoVariant[];
};

export const LOGO_BRANDS: LogoBrand[] = [
  {
    id: "orient-industries",
    name: "Orient Industries",
    descriptor: "INDUSTRIAL MANUFACTURING & ENGINEERING",
    variants: [
      { logo: "/logos/brands/orient-industries/logo-01.jpg", disc: "#ffffff", board: "/logos/brands/orient-industries/board-01.png", card: "/logos/brands/orient-industries/board-01-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/orient-industries/logo-02.jpg", disc: "#ffffff", board: "/logos/brands/orient-industries/board-02.png", card: "/logos/brands/orient-industries/board-02-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/orient-industries/logo-03.jpg", disc: "#ffffff", board: "/logos/brands/orient-industries/board-03.png", card: "/logos/brands/orient-industries/board-03-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/orient-industries/logo-04.jpg", disc: "#ffffff", board: "/logos/brands/orient-industries/board-04.png", card: "/logos/brands/orient-industries/board-04-card.jpg", w: 1492, h: 1054 },
    ],
  },
  {
    id: "fruit-rush",
    name: "Fruit Rush",
    descriptor: "JUICE & FRUIT BEVERAGE SUB-BRAND",
    variants: [
      { logo: "/logos/brands/fruit-rush/logo-01.jpg", disc: "#101010", board: "/logos/brands/fruit-rush/board-01.png", card: "/logos/brands/fruit-rush/board-01-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/fruit-rush/logo-02.jpg", disc: "#101010", board: "/logos/brands/fruit-rush/board-02.png", card: "/logos/brands/fruit-rush/board-02-card.jpg", w: 2425, h: 1713 },
      { logo: "/logos/brands/fruit-rush/logo-03.jpg", disc: "#101010", board: "/logos/brands/fruit-rush/board-03.png", card: "/logos/brands/fruit-rush/board-03-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/fruit-rush/logo-04.jpg", disc: "#101010", board: "/logos/brands/fruit-rush/board-04.png", card: "/logos/brands/fruit-rush/board-04-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/fruit-rush/logo-05.jpg", disc: "#0f0f0f", board: "/logos/brands/fruit-rush/board-05.png", card: "/logos/brands/fruit-rush/board-05-card.jpg", w: 1492, h: 1054 },
    ],
  },
  {
    id: "clear-wave",
    name: "Clear Wave",
    descriptor: "BOTTLED DRINKING WATER",
    variants: [
      { logo: "/logos/brands/clear-wave/logo-01.jpg", disc: "#081444", board: "/logos/brands/clear-wave/board-01.png", card: "/logos/brands/clear-wave/board-01-card.jpg", w: 2984, h: 2107 },
      { logo: "/logos/brands/clear-wave/logo-02.jpg", disc: "#081444", board: "/logos/brands/clear-wave/board-02.png", card: "/logos/brands/clear-wave/board-02-card.jpg", w: 2984, h: 2107 },
      { logo: "/logos/brands/clear-wave/logo-03.jpg", disc: "#081444", board: "/logos/brands/clear-wave/board-03.png", card: "/logos/brands/clear-wave/board-03-card.jpg", w: 1492, h: 1054 },
    ],
  },
  {
    id: "mercury-energy",
    name: "Mercury Energy",
    descriptor: "ENERGY SOLUTIONS & INFRASTRUCTURE",
    variants: [
      { logo: "/logos/brands/mercury-energy/logo-01.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-01.png", card: "/logos/brands/mercury-energy/board-01-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-02.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-02.png", card: "/logos/brands/mercury-energy/board-02-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-03.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-03.png", card: "/logos/brands/mercury-energy/board-03-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-04.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-04.png", card: "/logos/brands/mercury-energy/board-04-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-05.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-05.png", card: "/logos/brands/mercury-energy/board-05-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-06.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-06.png", card: "/logos/brands/mercury-energy/board-06-card.jpg", w: 1492, h: 1054 },
      { logo: "/logos/brands/mercury-energy/logo-07.png", disc: "#ffffff", board: "/logos/brands/mercury-energy/board-07.png", card: "/logos/brands/mercury-energy/board-07-card.jpg", w: 1492, h: 1054 },
    ],
  },
  {
    id: "lng-express",
    name: "LNG Express",
    descriptor: "LNG LOGISTICS & TRANSPORTATION",
    variants: [
      { logo: "/logos/brands/lng-express/logo-01.jpg", disc: "#002e4f", board: "/logos/brands/lng-express/board-01.png", card: "/logos/brands/lng-express/board-01-card.jpg", w: 1491, h: 1055 },
      { logo: "/logos/brands/lng-express/logo-02.jpg", disc: "#002e4f", board: "/logos/brands/lng-express/board-02.png", card: "/logos/brands/lng-express/board-02-card.jpg", w: 1491, h: 1055 },
      { logo: "/logos/brands/lng-express/logo-03.jpg", disc: "#ffffff", board: "/logos/brands/lng-express/board-03.png", card: "/logos/brands/lng-express/board-03-card.jpg", w: 1491, h: 1055 },
      { logo: "/logos/brands/lng-express/logo-04.jpg", disc: "#011e62", board: "/logos/brands/lng-express/board-04.png", card: "/logos/brands/lng-express/board-04-card.jpg", w: 1491, h: 1055 },
    ],
  },
  {
    id: "shaap-shaap",
    name: "Shaap Shaap",
    descriptor: "ENERGY DRINK SUB-BRAND",
    variants: [
      { logo: "/logos/brands/shaap-shaap/logo-01.jpg", disc: "#ff9027", board: "/logos/brands/shaap-shaap/board-01.png", card: "/logos/brands/shaap-shaap/board-01-card.jpg", w: 1492, h: 1054 },
    ],
  },
];
