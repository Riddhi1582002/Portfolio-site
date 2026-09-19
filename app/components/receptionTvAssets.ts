// THE SUPPLIED RECEPTION TV FILES, AS DELIVERED.
//
// One body of work, in one sequence — there are no categories here and no
// subsections. Static pieces and motion pieces sit in the same list, in
// the order the supplied filenames give, because that ordering is part of
// what was delivered.
//
// The two pieces hosted on Cloudflare R2 rather than shipped in the ZIP
// (they exceeded the upload limit) are part of THIS sequence, at their own
// filename's position in it — not a separate project and not appended to
// the end. They are marked `kind: "video"` and carry an absolute R2 URL;
// everything else is a local still.
//
// Every piece is 16:9 and is used at that ratio, never cropped or padded
// into another one.

export type ReceptionPiece = {
  /** The supplied file's own leading number, which fixes its position. */
  n: number;
  kind: "image" | "video";
  src: string;
  w: number;
  h: number;
};

export const RECEPTION_PIECES: ReceptionPiece[] = [];

/** The pieces the homepage card stages, front-most last. */
export const RECEPTION_CARD_PIECES = RECEPTION_PIECES.filter((p) => p.kind === "image").slice(0, 4);
