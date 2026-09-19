// EVERY PUBLICATION'S OWN WORDS AND OWN PAGES — plain, no "use client",
// for the same boundary reason publicationsData.ts is plain: the static
// route at app/publications/[slug] reads this on the server.
//
// The copy here is supplied, approved text, reproduced exactly. Nothing is
// paraphrased, nothing is filled in, and no field exists that the brief did
// not give a value for — Sneh Sagar carries no MADE FOR because it was made
// for a family rather than a client, and no publication carries a ROLE line
// at all.
//
// THE VIEWER IS PART OF THE DATA, not a per-page decision, because the
// right viewer is a property of the artefact: a tribute book opens as
// facing pages, a brochure's every PDF page is already one printed spread,
// a newsletter and a handbook are read a portrait page at a time, and
// "policy documents" is a shelf of several separate documents before it is
// any one document's pages. See PublicationViewer for how each is drawn.

export type PublicationDoc = {
  id: string;
  title: string;
  /** How many pages this document's own page set holds. */
  pageCount: number;
  /** Built from the count — see pagesOf(). */
  pages: string[];
};

export type PublicationViewerSpec =
  /** A bound book: a cover, then facing-page spreads built from single pages. */
  | { kind: "book"; doc: PublicationDoc }
  /** One portrait page at a time. */
  | { kind: "page"; doc: PublicationDoc }
  /** Several documents, each read a portrait page at a time, chosen first. */
  | { kind: "collection"; docs: PublicationDoc[] }
  /** Several documents whose every PDF page is ALREADY one printed spread. */
  | { kind: "spreadCollection"; docs: PublicationDoc[] };

export type PublicationContent = {
  title: string;
  /** TYPE — */
  type: string;
  /** MADE FOR — omitted entirely where the brief gives none. */
  madeFor?: string;
  /** YEAR — omitted entirely where the brief gives none. */
  year?: string;
  /** PAGES — omitted entirely where the brief gives none. */
  pages?: string;
  description: string;
  viewer: PublicationViewerSpec;
};

/** `/publications/<base>/page-01.jpg` … in the order they were rasterised. */
function pagesOf(base: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${base}/page-${String(i + 1).padStart(2, "0")}.jpg`
  );
}

function doc(id: string, title: string, base: string, pageCount: number): PublicationDoc {
  return { id, title, pageCount, pages: pagesOf(base, pageCount) };
}

const SNEH_SAGAR = doc(
  "sneh-sagar",
  "Sneh Sagar",
  "/publications/sneh-sagar/pages",
  37
);

export const PUBLICATION_CONTENT: Record<string, PublicationContent> = {
  "sneh-sagar": {
    title: "Sneh Sagar",
    type: "Tribute Book",
    year: "2026",
    pages: "37 selected",
    description:
      "Sneh Sagar is a tribute book I created with the children for their mother’s 80th birthday, bringing together the memories, letters, messages, photographs and personal stories of the people whose lives she touched. The material was collected and compiled by me together with her daughter, before I shaped it into a single visual narrative. I designed the entire book single-handedly, from organising the collected material to developing the visual language, layouts and final artwork.",
    viewer: { kind: "book", doc: SNEH_SAGAR },
  },

  excledge: {
    title: "ExcelEDGE",
    type: "Company Newsletter",
    madeFor: "Excelsource",
    description:
      "ExcelEDGE is a company newsletter I designed for Excelsource to bring together company stories, updates and achievements across the organisation. I developed the editorial structure and visual language to create a publication that feels engaging, organised and easy to navigate while maintaining consistency with the company’s identity.",
    viewer: {
      kind: "page",
      doc: doc("excledge", "ExcelEDGE", "/publications/excledge/pages", 16),
    },
  },

  mining: {
    title: "Company Brochures",
    type: "Corporate Brochures",
    madeFor: "Excelsource",
    description:
      "A series of corporate brochures I designed for Excelsource to present the company’s work, capabilities and projects across numerous departments through editorial structure and visual storytelling. The brochures were developed as part of the company’s visual standardisation process, establishing a more consistent visual language across its communications while keeping each department’s information clear and distinct.",
    // Every page of these two PDFs is one complete printed spread already —
    // back cover left, front cover right on page one — so a page here is a
    // spread and is never split, reordered or reconstructed.
    viewer: {
      kind: "spreadCollection",
      docs: [
        doc("mining", "Mining", "/publications/brochures/mining/pages", 6),
        doc(
          "turnkey-projects",
          "Turnkey Projects",
          "/publications/brochures/turnkey-projects/pages",
          11
        ),
      ],
    },
  },

  handbook: {
    title: "Employee Handbook",
    type: "Employee Handbook",
    madeFor: "Excelsource",
    description:
      "An employee handbook I designed for Excelsource to bring together essential information, guidelines and resources for its employees in one clear and approachable publication. I structured the information and visual hierarchy to make the handbook easy to navigate while creating a consistent experience across the document.",
    viewer: {
      kind: "page",
      doc: doc("handbook", "Employee Handbook", "/publications/handbook/pages", 19),
    },
  },

  policy: {
    title: "Policy Documents",
    type: "Policy Documents",
    madeFor: "Excelsource + Sister Company",
    description:
      "A collection of policy documents I designed for Excelsource and its sister company, keeping each organisation’s visual language in mind while creating a clear and consistent system for communicating important information. I structured the documents to make policies straightforward to read, navigate and reference while maintaining visual consistency across the collection.",
    viewer: {
      kind: "collection",
      docs: [
        doc("posh", "POSH", "/publications/policy/posh", 8),
        doc(
          "pat-on-the-back-award",
          "Pat-on-the-back Award Policy",
          "/publications/policy/pat-on-the-back-award",
          4
        ),
        doc(
          "travel-and-accommodation",
          "Travel and Accommodation Policy",
          "/publications/policy/travel-and-accommodation",
          3
        ),
        doc("tb-conveyance", "TB Conveyance", "/publications/policy/tb-conveyance", 2),
        doc("tb-referral", "TB Referral", "/publications/policy/tb-referral", 4),
      ],
    },
  },
};

/** Cover art, used by the cross-navigation strip every publication page has. */
export const COVER_SRC: Record<string, string> = {
  "sneh-sagar": "/images/publications/sneh-sagar-front.jpg",
  excledge: "/images/publications/excel-edge-front.jpg",
  mining: "/images/publications/mining-front.jpg",
  handbook: "/images/publications/employee-handbook-front.jpg",
  policy: "/images/publications/policy-front.jpg",
};

/** The order the publications are listed in, everywhere they are listed. */
export const PUBLICATION_ORDER = [
  "sneh-sagar",
  "excledge",
  "mining",
  "handbook",
  "policy",
] as const;
