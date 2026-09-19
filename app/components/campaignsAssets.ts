// THE SUPPLIED CAMPAIGNS / SOCIAL FILES, AS DELIVERED.
//
// Generated from the supplied ZIPs and checked in as data so nothing about
// the set is decided at runtime. Two rules are baked into the order here
// and must stay that way:
//
//   * A file whose name BEGINS with a number is a numbered post, and the
//     numbered posts come first, in their own numeric order.
//   * Everything else follows, in a stable order of its own.
//
// Nothing is renumbered, omitted, duplicated or invented. The only change
// made to any supplied file is its extension: the delivered .jfif files
// are ordinary JPEGs that no web server has a media type for, so they are
// served as .jpg, and names carrying characters a URL cannot hold (a '#'
// truncates a path at the fragment) are reduced to the same name in a
// URL-safe form. Every image's own pixels, proportions and position in the
// sequence are untouched.
//
// `w`/`h` are each file's real pixel size, carried so a grid can reserve
// the right box for a piece before it loads and never crop or letterbox it.

export type CampaignItem = { src: string; w: number; h: number };
export type CampaignCarousel = { id: string; slides: string[]; w: number; h: number };

/** DEPARTMENTS / INFO — EIPL company information and department posts. */
export const DEPT_POSTS: CampaignItem[] = [
  { src: "/campaigns/dept/001.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/002.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/003.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/004.jpg", w: 800, h: 1422 },
  { src: "/campaigns/dept/1754466207479.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1756462022019.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1756463136332.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1759985631908.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1761545351429.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1762158015221.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1764584897649.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1764823816964.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1764824652134.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1764825364342.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1764825464297.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1767329536125.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1770028581656.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1773720751306.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1773912736107.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1773913151822.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1773913621580.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1779507557128.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1780762054979.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1780762603889.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1783919334989.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1785841329869.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1785841666304.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1785844294453.jpg", w: 800, h: 800 },
  { src: "/campaigns/dept/1785844615744.jpg", w: 800, h: 800 },
];

/** EMPLOYEE & COMPANY — hiring, milestones, POSH, internal communications. */
export const EMPLOYEE_POSTS: CampaignItem[] = [
  { src: "/campaigns/employee/001.png", w: 1800, h: 1800 },
  { src: "/campaigns/employee/002.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/002.png", w: 1890, h: 1890 },
  { src: "/campaigns/employee/003.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/004.png", w: 2430, h: 2430 },
  { src: "/campaigns/employee/005.png", w: 2430, h: 2430 },
  { src: "/campaigns/employee/006.png", w: 2430, h: 2430 },
  { src: "/campaigns/employee/15-aug.jpg", w: 3375, h: 3375 },
  { src: "/campaigns/employee/28-years.jpg", w: 1500, h: 1500 },
  { src: "/campaigns/employee/ganesh-chaturthi-copy.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/independence-day-02.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/medical-02.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/pat-on-the-back-award-02.jpg", w: 2250, h: 2250 },
  { src: "/campaigns/employee/posh-copy.jpg", w: 1080, h: 1080 },
  { src: "/campaigns/employee/we-u2019re.png", w: 1485, h: 1485 },
  { src: "/campaigns/employee/your-paragraph-text-1.png", w: 1485, h: 1485 },
];

/** OTHER CAMPAIGNS — social and campaign work for non-EIPL companies. */
export const OTHER_POSTS: CampaignItem[] = [
  { src: "/campaigns/other/001.jpg", w: 1080, h: 1350 },
  { src: "/campaigns/other/002.png", w: 3456, h: 4928 },
  { src: "/campaigns/other/003.jpg", w: 1920, h: 1080 },
  { src: "/campaigns/other/004.jpg", w: 1080, h: 1350 },
  { src: "/campaigns/other/005.jpg", w: 1080, h: 1350 },
  { src: "/campaigns/other/24-6.jpg", w: 960, h: 720 },
  { src: "/campaigns/other/final-post.png", w: 1080, h: 1080 },
  { src: "/campaigns/other/the-satsang-project-invitation-poster-widescreen-02.png", w: 4128, h: 2304 },
];

/** CAROUSELS — each supplied PDF is ONE piece; its pages are its slides,
 *  in the order the PDF holds them. A carousel is never split into
 *  separate posts. */
export const CAROUSELS: CampaignCarousel[] = [
  {
    id: "001",
    w: 1688,
    h: 1688,
    slides: [
      "/campaigns/carousels/001/slide-01.jpg",
      "/campaigns/carousels/001/slide-02.jpg",
      "/campaigns/carousels/001/slide-03.jpg",
      "/campaigns/carousels/001/slide-04.jpg",
      "/campaigns/carousels/001/slide-05.jpg",
    ],
  },
  {
    id: "002",
    w: 1502,
    h: 1502,
    slides: [
      "/campaigns/carousels/002/slide-01.jpg",
      "/campaigns/carousels/002/slide-02.jpg",
      "/campaigns/carousels/002/slide-03.jpg",
      "/campaigns/carousels/002/slide-04.jpg",
      "/campaigns/carousels/002/slide-05.jpg",
    ],
  },
  {
    id: "003",
    w: 1688,
    h: 1688,
    slides: [
      "/campaigns/carousels/003/slide-01.jpg",
      "/campaigns/carousels/003/slide-02.jpg",
      "/campaigns/carousels/003/slide-03.jpg",
      "/campaigns/carousels/003/slide-04.jpg",
      "/campaigns/carousels/003/slide-05.jpg",
      "/campaigns/carousels/003/slide-06.jpg",
      "/campaigns/carousels/003/slide-07.jpg",
    ],
  },
  {
    id: "004",
    w: 851,
    h: 851,
    slides: [
      "/campaigns/carousels/004/slide-01.jpg",
      "/campaigns/carousels/004/slide-02.jpg",
      "/campaigns/carousels/004/slide-03.jpg",
      "/campaigns/carousels/004/slide-04.jpg",
      "/campaigns/carousels/004/slide-05.jpg",
      "/campaigns/carousels/004/slide-06.jpg",
    ],
  },
  {
    id: "005",
    w: 1502,
    h: 1502,
    slides: [
      "/campaigns/carousels/005/slide-01.jpg",
      "/campaigns/carousels/005/slide-02.jpg",
      "/campaigns/carousels/005/slide-03.jpg",
      "/campaigns/carousels/005/slide-04.jpg",
      "/campaigns/carousels/005/slide-05.jpg",
      "/campaigns/carousels/005/slide-06.jpg",
      "/campaigns/carousels/005/slide-07.jpg",
      "/campaigns/carousels/005/slide-08.jpg",
      "/campaigns/carousels/005/slide-09.jpg",
    ],
  },
];
