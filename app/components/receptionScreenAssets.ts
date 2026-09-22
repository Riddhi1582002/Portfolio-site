// THE SUPPLIED RECEPTION SCREEN FILES, AS DELIVERED.
//
// One body of work, in one sequence — there are no categories here and no
// subsections. Static pieces and motion pieces sit in the same list, in
// the order the supplied filenames give, because that ordering is part of
// what was delivered: the numbered series 001 / 002 / 003 first, then the
// pieces named separately, in the order they were listed.
//
// Two of the six are hosted on Cloudflare R2 rather than shipped with the
// site (they exceeded the upload limit) and are used at their EXISTING R2
// object keys — nothing here re-uploads or renames them. They carry
// `kind: "video"` and an absolute R2 URL built by the same helper the
// reels use; everything else is a local file under /reception-screen.
//
// Every piece is 16:9 and is used at that ratio, never cropped or padded
// into another one.

const R2_BASE = "https://pub-0ddc522dfc834a90ab7c556775e1dd6f.r2.dev";
const r2 = (object: string) =>
  `${R2_BASE}/${object.split("/").map(encodeURIComponent).join("/")}`;

/**
 * WHERE AN R2 VIDEO MIGHT ACTUALLY BE.
 *
 * These two were requested at `TV/…`, the folder they were described in.
 * But every other video on this site that plays from this same bucket —
 * all thirty-odd reels — is stored at the bucket's ROOT, and the supplied
 * TV archive itself carries a `TV/` folder, so whether that folder name
 * survived the upload as a key prefix is exactly the thing that decides
 * whether these load. A 404 on the one form is a black rectangle.
 *
 * So both forms are offered, the named one first, as <source> children:
 * the browser's own resource selection tries each in order and moves on
 * from a failed one by itself. Same bucket, same objects, native <video>,
 * nothing re-uploaded — and whichever key is real, it plays.
 */
function r2Candidates(object: string): string[] {
  const base = object.split("/").pop() as string;
  return object === base ? [r2(object)] : [r2(object), r2(base)];
}

export type ReceptionPiece = {
  id: string;
  kind: "image" | "video";
  src: string;
  /** For a motion piece, every URL it may be served at, tried in order by
   *  the browser's own <source> selection — see r2Candidates. */
  sources?: string[];
  /** A still for a motion piece: the <video>'s poster, and the texture the
   *  card stages it with, since a card is a still composition. */
  poster?: string;
  w: number;
  h: number;
};

export const RECEPTION_PIECES: ReceptionPiece[] = [
  {
    id: "rs-001",
    kind: "video",
    src: "/reception-screen/001.mp4",
    poster: "/reception-screen/001-poster.jpg",
    w: 1920,
    h: 1080,
  },
  {
    // Already on R2 — mapped, not re-uploaded.
    id: "rs-002",
    kind: "video",
    src: r2("TV/002.mp4"),
    sources: r2Candidates("TV/002.mp4"),
    w: 1920,
    h: 1080,
  },
  {
    id: "rs-003",
    kind: "image",
    src: "/reception-screen/003.png",
    w: 5760,
    h: 3240,
  },
  {
    id: "rs-01",
    kind: "image",
    src: "/reception-screen/01.jpg",
    w: 1920,
    h: 1080,
  },
  {
    // The supplied name carries spaces; served under a URL-safe spelling.
    // Same file, same pixels.
    id: "rs-quote-02",
    kind: "image",
    src: "/reception-screen/quote-poster-02.jpg",
    w: 1920,
    h: 1080,
  },
  {
    // Already on R2 — mapped, not re-uploaded. The space in the object key
    // is real and is encoded, not renamed.
    id: "rs-reception-02",
    kind: "video",
    src: r2("TV/reception vdo 02.mp4"),
    sources: r2Candidates("TV/reception vdo 02.mp4"),
    w: 1920,
    h: 1080,
  },
  // SUPPLIED LATER, and appended rather than interleaved: the numbered
  // series above fixes its own order, and these two carry no number to
  // place them by. Putting them anywhere inside it would be a guess about
  // sequence that nothing supplied supports.
  {
    id: "rs-pat-on-the-back",
    kind: "image",
    src: "/reception-screen/pat-on-the-back.jpg",
    w: 1920,
    h: 1080,
  },
  {
    id: "rs-posh",
    kind: "image",
    src: "/reception-screen/posh.jpg",
    w: 1920,
    h: 1080,
  },
];

/** What a still composition can actually stage: the images, plus a motion
 *  piece's own poster frame where one was extracted. In sequence order, so
 *  the card shows this work in the order the work is in. */
export const RECEPTION_CARD_PIECES = RECEPTION_PIECES.map((p) =>
  p.kind === "image" ? p.src : p.poster
).filter((s): s is string => Boolean(s));
