// THE POSTERS — the supplied quote posters, as delivered.
//
// Eighteen, numbered by their own filenames from 01 to 20. There is no 05
// and no 12 in what was supplied, and the numbering is kept exactly as it
// is rather than closed up: the number on a poster is the maker's, and
// renumbering the set to hide a gap would be inventing a sequence.
//
// Every poster is 4:5 and is shown at 4:5 — whole, uncropped, never
// recoloured. Seventeen are the supplied 1080 x 1350 files byte for byte;
// 13 arrived at 7620 x 9525, the same ratio exactly, and is served scaled
// proportionally to the others' size.
//
// No titles. The words on these posters are handwritten into the artwork,
// and a caption restating them would be a transcription standing in for
// the thing itself — so a poster is referred to by its number and nothing
// else.

export type Poster = {
  id: string;
  /** The maker's own number, as a two-digit label. */
  no: string;
  src: string;
  w: number;
  h: number;
};

const NUMBERS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];

export const POSTERS: Poster[] = NUMBERS.map((n) => {
  const no = String(n).padStart(2, "0");
  return { id: `poster-${no}`, no, src: `/posters/${no}.jpg`, w: 1080, h: 1350 };
});

export const POSTER_ASPECT = 1080 / 1350;

export const POSTERS_CONTENT = {
  number: "06",
  title: "Posters",
  /** Supplied, approved copy. Reproduced exactly. */
  description:
    "A collection of original quote posters rooted in the most human form of expression — handwritten thoughts, personal words and imperfect ideas. Each piece transforms a thought into a distinct visual language, using typography, imagery, colour and texture to capture a different mood and feeling.",
};
