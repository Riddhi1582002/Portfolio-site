// AI COMICS — project 08.
//
// Eleven supplied files: nine long vertical strips (800px wide, 9–13k tall)
// and two pages the files call "4.3 001" and "4.3 002". Those two are
// 2480 x 3508 — A4 portrait — and are shown at that proportion; nothing is
// cropped to a different one.
//
// `full` is the supplied file, byte for byte. `wall` is the same image
// scaled down (Lanczos, nothing else) for the looping wall, where a strip
// is a few dozen pixels wide and ten 10,000px files would be a 28MB
// landing page. The viewer always opens `full`.
//
// No titles, dates or captions were supplied, so none are shown. The
// order is the supplied files': the numbered strips, with the two-page
// piece kept together as page one then page two.

export type Comic = {
  id: string;
  /** The supplied file name, for the record. */
  file: string;
  w: number;
  h: number;
  full: string;
  wall: string;
  /** A long vertical strip, read by scrolling — as opposed to a page. */
  strip: boolean;
};

function comic(id: string, file: string, w: number, h: number): Comic {
  return {
    id,
    file,
    w,
    h,
    full: `/ai-comics/full/${id}.jpg`,
    wall: `/ai-comics/wall/${id}.jpg`,
    strip: h / w > 3,
  };
}

export const COMICS: Comic[] = [
  comic("strip-1", "Strip 1.jpg", 800, 10987),
  comic("01-4", "01 (4).jpg", 800, 10000),
  comic("02-1", "02 (1).jpg", 800, 10000),
  comic("02-2", "02 (2).jpg", 800, 10000),
  comic("4-3-001", "4.3 001.jpg", 2480, 3508),
  comic("4-3-002", "4.3 002.jpg", 2480, 3508),
  comic("strip-3", "Strip 3.jpg", 800, 9737),
  comic("04", "04.jpg", 800, 10000),
  comic("strip-4", "strip 4.jpg", 800, 13432),
  comic("05", "05.jpg", 800, 9237),
  comic("05-1", "05 (1).jpg", 800, 10000),
];

/** The two pages of the one two-page piece. */
export const PAGE_ONE = "4-3-001";
export const PAGE_TWO = "4-3-002";

export const AI_COMICS_CONTENT = {
  number: "08",
  title: "AI Comics",
} as const;

/** Where NEXT PROJECT goes: the graphic-design ring, opened on card 9. */
export const NEXT_PROJECT_HREF = "/work/graphic-design?card=8";
