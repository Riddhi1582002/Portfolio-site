// A SHEET OF PAPER THAT ACTUALLY BENDS.
//
// Adapted from the technique in Meng To's Sketchbook
// (threeui.com/css/sketchbook, github.com/MengTo/sketchbook): the turning
// leaf is not one rotated rectangle but a CHAIN OF NESTED STRIPS, each
// rotated a little further than the one before it, so the surface's
// tangent sweeps through an arc and the page curves the way paper curves.
// Only the geometry is borrowed. None of that project's notebook styling,
// paper texture, loupe or warm palette comes with it — this sheet is lit
// for a dark editorial page and is meant to be barely noticed.
//
// WHY A CHAIN AND NOT A CURVE. CSS cannot bend a single element, so the
// arc has to be built out of flat pieces. Nesting them is what makes it
// cheap: each strip is positioned at its parent's far edge (`left: 100%`)
// and rotated by a FIXED small angle, so the browser composes the whole
// arc from one number. Turning the page means writing two CSS custom
// properties, not recomputing eighteen transforms.
//
// THE ANGLES.
//   theta = SWING * t     how far the leaf has swung
//
// SWING IS NOT 180 DEGREES, and that is the one real departure from the
// reference. Sketchbook turns a leaf between two page slots, so the whole
// half-circle is on screen: the sheet leaves the right-hand page and lands
// on the left-hand one. This viewer shows ONE page, so the leaf is clipped
// the moment it passes edge-on — a 180-degree swing spent its whole second
// half invisible, which made the back half of every drag do nothing. The
// swing stops just past vertical instead, so the entire gesture is motion
// you can see.
//   beta  = BETA*sin(PI*t)  the curl, zero at both ends and most in the
//                           middle — a page is flat when it is lying down
//                           and flat again when it has landed
//
// BETA IS SMALLER HERE THAN IN THE REFERENCE, for the same reason SWING
// is. The curl is added to the root's angle, so a deep curl tips the
// spine past vertical early — and past vertical, in a one-page viewer,
// means gone. At the reference's curl the leaf had left the frame by
// forty per cent of the turn. These numbers keep the spine under vertical
// until about three quarters through, which is what keeps the bend on
// screen for the part of the gesture that is meant to show it.
//   tt = theta + beta     the root strip's angle
//   td = 2*beta / N       how much each strip adds to the one before it
//
// WHERE THE ARTWORK COMES FROM. Every strip carries the SAME two images
// as backgrounds and shows its own slice of them by offset, so the sheet
// is one continuous picture across all eighteen pieces rather than
// eighteen cropped images. The front samples the outgoing page rightward
// from the spine; the back samples the incoming page leftward from ITS
// spine, which is the opposite edge — that mirroring is the whole reason
// the reverse of a turning sheet reads the right way round.
//
// The leaf pivots on its LEFT edge, so past 90 degrees it lies to the left
// of the spine and the host's own overflow clips it. That is deliberate:
// it is why the incoming page beneath is never shown twice.

export type PageBendOptions = {
  /** The element the leaf is added to. Must establish 3D context. */
  host: HTMLElement;
  /** The page box, in the host's own unscaled layout coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Front is what faces the reader at t=0; back is its reverse. */
  frontSrc: string;
  backSrc: string;
  /** Strips in the chain. Fewer on a phone — the arc is smaller there. */
  strips?: number;
  /** Peak curl in radians. Restrained on purpose. */
  beta?: number;
  /** Total swing in radians. Just past vertical — see the note above.
   *  A two-page booklet passes Math.PI: there the leaf has a left-hand
   *  page to land on, so the whole half-circle is on screen. */
  swing?: number;
  /**
   * Which HALF of a two-page printed spread each face carries, where the
   * supplied image is a spread rather than a single page. Omitted, a face
   * shows its whole image, exactly as before.
   */
  frontHalf?: "left" | "right";
  backHalf?: "left" | "right";
  zIndex?: number;
};

export type PageBendHandle = {
  /** 0 = lying flat over the page, 1 = fully turned away. */
  setT(t: number): void;
  destroy(): void;
};

const DEG = 180 / Math.PI;
/** How far each strip's face runs under the next one, in px. */
const SEAM = 2;

/** Enough pieces for the arc to read as a curve, not a fan.
 *
 *  Scaled to the page, because what shows is the STEP between neighbouring
 *  strips, not their number: a brochure spread nearly a thousand pixels
 *  across needs more of them than a phone-width sheet to keep each step
 *  below the eye's notice. */
export function stripCountFor(width: number): number {
  if (width < 520) return 12;
  if (width < 900) return 18;
  return 24;
}

export function createPageBend(opt: PageBendOptions): PageBendHandle {
  const N = Math.max(4, opt.strips ?? stripCountFor(opt.width));
  const BETA = opt.beta ?? 0.38;
  const SWING = opt.swing ?? 1.78;
  const W = opt.width;
  const H = opt.height;
  const sw = W / N;

  const curl = document.createElement("div");
  curl.setAttribute("data-page-bend", "");
  Object.assign(curl.style, {
    position: "absolute",
    left: `${opt.x}px`,
    top: `${opt.y}px`,
    width: `${W}px`,
    height: `${H}px`,
    transformOrigin: "left center",
    transformStyle: "preserve-3d",
    pointerEvents: "none",
    zIndex: String(opt.zIndex ?? 5),
    willChange: "transform",
  } as Partial<CSSStyleDeclaration>);

  type Piece = { shF: HTMLElement; shB: HTMLElement; glF: HTMLElement; glB: HTMLElement };
  const pieces: Piece[] = [];

  let host: HTMLElement = curl;
  for (let i = 0; i < N; i++) {
    const strip = document.createElement("div");
    Object.assign(strip.style, {
      position: "absolute",
      top: "0",
      height: "100%",
      width: `${sw}px`,
      transformOrigin: "left center",
      transformStyle: "preserve-3d",
      // The first strip sits at the spine; each later one hangs off the
      // far edge of the strip before it, which is what makes the chain.
      left: i === 0 ? "0" : "100%",
      // ONE INHERITED NUMBER DRIVES THE WHOLE ARC. Every strip past the
      // root reads the same --td off the curl, so bending the sheet is a
      // single custom-property write rather than eighteen transforms.
      transform: i === 0 ? "" : "rotateY(var(--td, 0deg))",
    } as Partial<CSSStyleDeclaration>);

    const face = (back: boolean) => {
      const half = back ? opt.backHalf : opt.frontHalf;
      // A half is the same sampling over an image twice the leaf's width,
      // shifted a leaf-width along when it is the right-hand half.
      const shift = half === "right" ? -W : 0;
      const f = document.createElement("div");
      Object.assign(f.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        left: "0",
        // OVERLAP, so the seams never open. At 0.75px the overlap was less
        // than a device pixel at most zooms and adjacent strips — each
        // rotated a little differently — let hairlines of the page beneath
        // flicker through as the leaf turned. The overlapping pixels are
        // the neighbour's own (the background runs on continuously), so a
        // wider overlap cannot be seen; the shading below runs over the overlap
        // too, holding the strip's end tone there.
        right: `-${SEAM}px`,
        backfaceVisibility: "hidden",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${half ? W * 2 : W}px ${H}px`,
        backgroundImage: `url("${back ? opt.backSrc : opt.frontSrc}")`,
        // FRONT samples the outgoing page rightward from the spine at x=0.
        // BACK samples the incoming page leftward from its own spine, which
        // after the flip is the far edge at x=W.
        backgroundPositionX: back ? `${(i + 1) * sw - W + shift}px` : `${-i * sw + shift}px`,
        transform: back ? "rotateY(180deg)" : "",
      } as Partial<CSSStyleDeclaration>);
      return f;
    };

    const front = face(false);
    const back = face(true);

    // Shading rides ON the face so it curves with it. Two layers: the
    // shadow that deepens as a strip turns away from the light, and a
    // soft gloss that only appears while the sheet is actually lifted.
    const shade = (flip: boolean) => {
      const s = document.createElement("div");
      Object.assign(s.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        left: "0",
        right: "0",
        pointerEvents: "none",
        // Over the whole face, overlap included — an unshaded overlap is a
        // light hairline at every seam once the sheet darkens. The ramp is
        // pinned to the strip's own width; the overlap holds its end tone,
        // which is the neighbour's start tone, so the seam cannot show.
        background: flip
          ? `linear-gradient(90deg, rgba(4,4,6,var(--a2,0)) 0px, rgba(4,4,6,var(--a1,0)) ${sw}px)`
          : `linear-gradient(90deg, rgba(4,4,6,var(--a1,0)) 0px, rgba(4,4,6,var(--a2,0)) ${sw}px)`,
      } as Partial<CSSStyleDeclaration>);
      return s;
    };
    const gloss = (flip: boolean) => {
      const g = document.createElement("div");
      Object.assign(g.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        left: "0",
        right: "0",
        pointerEvents: "none",
        mixBlendMode: "soft-light",
        // A GRADIENT, not a level. A flat value per strip steps at every
        // seam, and eighteen steps of light across a page is exactly the
        // banding the nested-strip trick exists to avoid.
        background: flip
          ? `linear-gradient(90deg, rgba(255,255,255,var(--g2,0)) 0px, rgba(255,255,255,var(--g1,0)) ${sw}px)`
          : `linear-gradient(90deg, rgba(255,255,255,var(--g1,0)) 0px, rgba(255,255,255,var(--g2,0)) ${sw}px)`,
      } as Partial<CSSStyleDeclaration>);
      return g;
    };
    const shF = shade(false);
    const shB = shade(true);
    const glF = gloss(false);
    const glB = gloss(true);
    front.appendChild(shF);
    front.appendChild(glF);
    back.appendChild(shB);
    back.appendChild(glB);

    strip.appendChild(front);
    strip.appendChild(back);
    host.appendChild(strip);
    host = strip;
    pieces.push({ shF, shB, glF, glB });
  }

  opt.host.appendChild(curl);

  let lastT = -1;
  function setT(t: number) {
    const c = Math.min(1, Math.max(0, t));
    if (c === lastT) return;
    lastT = c;
    const theta = SWING * c;
    // Flat at both ends: a page is flat lying down and flat again once it
    // has landed, and it is only bent while it is actually being moved.
    const lift = Math.sin(Math.PI * c);
    const beta = BETA * lift;
    const tt = theta + beta;
    const td = (2 * beta) / N;

    curl.style.transform = `rotateY(${(-tt * DEG).toFixed(3)}deg)`;
    curl.style.setProperty("--td", `${(td * DEG).toFixed(4)}deg`);
    for (let i = 0; i < N; i++) {
      const p = pieces[i];
      // How squarely this strip still faces the reader, at each of its
      // edges — the shadow is the gradient between the two.
      const l1 = Math.abs(Math.cos(tt - i * td));
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
      const a1 = ((1 - l1) * 0.55).toFixed(3);
      const a2 = ((1 - l2) * 0.55).toFixed(3);
      p.shF.style.setProperty("--a1", a1);
      p.shF.style.setProperty("--a2", a2);
      p.shB.style.setProperty("--a1", a1);
      p.shB.style.setProperty("--a2", a2);
      const g1 = (lift * l1 * l1 * 0.3).toFixed(3);
      const g2 = (lift * l2 * l2 * 0.3).toFixed(3);
      p.glF.style.setProperty("--g1", g1);
      p.glF.style.setProperty("--g2", g2);
      p.glB.style.setProperty("--g1", g1);
      p.glB.style.setProperty("--g2", g2);
    }
  }

  setT(0);

  return {
    setT,
    destroy() {
      curl.remove();
    },
  };
}
