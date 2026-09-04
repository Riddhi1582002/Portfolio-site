// Portal aperture geometry. Every aperture state is CALCULATED from one
// portalProgress value — nothing is morphed. There is exactly one clipPath
// in the DOM; this module decides what geometry goes inside it.
//
// Three phases, one continuous progress:
//   crossbar slot -> A's triangular negative space -> native video frame
//
// The crossbar and the counter are both real Dream Avenue outline geometry
// (artGeometry.ts, plus COUNTER_POLY below, which is the A glyph's own
// inner subpath — the enclosed triangle between the two legs, the apex and
// the crossbar swash). Neither is an approximation and neither is ever
// painted; they exist only as clip geometry.
//
// The expansion mechanism is polygon clipping, not interpolation between
// unrelated paths: a disc grows from the crossbar centre and the region
// being revealed is (shape AND disc), recomputed from scratch at every
// progress value. That is why the point counts never have to line up.

// Counter of the A, flattened from the glyph's inner subpath, in font
// units (same space as CROSSBAR_PATH). Apex (288,80), feet (174,414) and
// (435,508); its lower boundary is the top edge of the crossbar swash.
export const COUNTER_POLY: number[] = [288.00,80.00,435.00,508.00,430.14,500.44,425.07,493.02,419.78,485.75,414.27,478.64,408.56,471.71,402.64,464.97,396.51,458.43,390.19,452.11,383.65,446.02,376.92,440.17,370.00,434.58,362.88,429.25,355.56,424.21,348.05,419.45,340.36,415.01,332.48,410.89,324.42,407.10,316.17,403.66,307.75,400.57,299.14,397.86,290.37,395.54,281.41,393.61,272.29,392.09,263.00,391.00,259.33,390.67,255.60,390.42,251.79,390.27,247.94,390.20,244.03,390.24,240.09,390.38,236.13,390.62,232.15,390.96,228.16,391.42,224.17,392.00,220.20,392.69,216.25,393.50,212.33,394.44,208.45,395.50,204.62,396.70,200.85,398.04,197.15,399.51,193.53,401.12,190.00,402.89,186.56,404.80,183.24,406.86,180.03,409.08,176.95,411.46,174.00,414.00];

export const PHASE_1_END = 0.2;
export const PHASE_2_END = 0.55;

export type PortalPhase = "crossbar" | "counter" | "video";

export type ClipChild = {
  /** Path data. */
  d: string;
  /** Present only on the crossbar child, which stays in font units. */
  transform?: string;
};

export type Pt = { x: number; y: number };

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function polyToPath(pts: Pt[]): string {
  if (pts.length < 3) return "";
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  return d + "Z";
}

/**
 * Sutherland-Hodgman: clip a (possibly concave) subject polygon against a
 * convex clipper. Used with a regular n-gon standing in for the growing
 * disc, so the result is the part of the shape the disc has reached.
 */
function clipToConvex(subject: Pt[], clipper: Pt[]): Pt[] {
  // A degenerate clipper has no edges with direction, so every half-plane
  // test returns 0, every point counts as inside, and the subject comes
  // back untouched — the exact opposite of clipping it away to nothing.
  // At progress = PHASE_1_END that silently opened the whole frame in one
  // jump instead of starting it from zero.
  if (clipper.length < 3) return [];
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i];
    const b = clipper[(i + 1) % clipper.length];
    // Inside = left of the directed edge a->b (clipper wound CCW in SVG's
    // y-down space means this is a consistent half-plane test).
    const side = (p: Pt) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const sCur = side(cur);
      const sPrev = side(prev);
      if (sCur >= 0) {
        if (sPrev < 0) out.push(intersect(prev, cur, sPrev, sCur));
        out.push(cur);
      } else if (sPrev >= 0) {
        out.push(intersect(prev, cur, sPrev, sCur));
      }
    }
  }
  return out;
}

function intersect(p: Pt, q: Pt, sp: number, sq: number): Pt {
  const t = sp / (sp - sq);
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

// Below this the polygon is smaller than a pixel at any stage scale and
// its edges start collapsing; treat it as no disc at all.
const MIN_DISC_R = 0.01;

function disc(cx: number, cy: number, r: number, segments = 72): Pt[] {
  if (!(r > MIN_DISC_R)) return [];
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function rectPoly(cx: number, cy: number, w: number, h: number): Pt[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
}

export function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function maxRadius(from: Pt, pts: Pt[]) {
  return Math.max(...pts.map((p) => Math.hypot(p.x - from.x, p.y - from.y)));
}

export type PortalInput = {
  /** Counter polygon, already mapped into stage units. */
  counter: Pt[];
  /** Crossbar path + transform — constant, always exact. */
  crossbar: ClipChild;
  /** Centre the aperture grows from: the crossbar's centre, in stage units. */
  centre: Pt;
  /** videoWidth / videoHeight of whatever reel is loaded. Never hardcoded. */
  videoAspect: number;
  /** Stage centre and the height the native frame settles at. */
  stageCentre: Pt;
  finalHeight: number;
};

export type PortalGeometry = {
  phase: PortalPhase;
  children: ClipChild[];
  /** Reported for the debug overlay. */
  discRadius: number;
  /** Native-ratio frame the aperture is resolving into, at this progress. */
  videoRect: { cx: number; cy: number; w: number; h: number } | null;
  /**
   * 0 until phase 3, then 0 -> 1 as the frame settles into composition.
   *
   * A centred portrait frame cannot contain the A: at 920x1080 the widest
   * a centred frame can be inside a 1920x1080 stage is 920px (x 500-1420),
   * and the A's crossbar is at x 312-522. Reaching it would need a 1296px
   * wide centred frame, which at native ratio is 1521px tall against a
   * 1080px stage — it would have to be cropped. So the footage sits over
   * the letter while the aperture is the letter, and travels into
   * composition once the frame has separated from it. The caller moves the
   * media by exactly this fraction, so the aperture never leaves it and
   * the media is never scaled, stretched or cropped.
   */
  travel?: number;
};

// How much bigger the seed frame is than the box that merely contains the
// counter. At 1.0 the seed is the counter's own bounding box, so phase 2
// has nothing to travel and the beat reads as a dead spot; this gives it
// real distance to open through while leaving phase 3 the larger move.
const SEED_GROWTH = 1.35;

/**
 * The seed frame: a rectangle at the video's NATIVE aspect ratio, sized
 * from the counter it grows out of. Phase 2 resolves the A's interior into
 * this, so the frame arrives already correctly proportioned rather than as
 * a generic 16:9 box that later has to be corrected.
 */
export function seedRect(counter: Pt[], aspect: number) {
  const b = bbox(counter);
  const w0 = b.maxX - b.minX;
  const h0 = b.maxY - b.minY;
  const h = Math.max(h0, w0 / aspect) * SEED_GROWTH;
  return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, w: h * aspect, h };
}

export function getPortalGeometry(progress: number, input: PortalInput): PortalGeometry {
  const p = clamp01(progress);
  const { counter, crossbar, centre, videoAspect, stageCentre, finalHeight } = input;
  const seed = seedRect(counter, videoAspect);

  if (p < PHASE_1_END) {
    // PHASE 1 — the crossbar stays exactly itself and the counter opens up
    // around it. At p = 0 the disc has zero radius, so the aperture is the
    // crossbar path and nothing else.
    const t = easeOutCubic(clamp01(p / PHASE_1_END));
    const r = t * maxRadius(centre, counter);
    const opened = r > 0 ? clipToConvex(counter, disc(centre.x, centre.y, r)) : [];
    return {
      phase: "crossbar",
      children: opened.length >= 3 ? [crossbar, { d: polyToPath(opened) }] : [crossbar],
      discRadius: r,
      videoRect: null,
    };
  }

  if (p < PHASE_2_END) {
    // PHASE 2 — the counter is fully open; the native-ratio frame now
    // grows out through it. A rectangle growing about its own centre, not
    // a disc clipped against the rectangle: the disc version rounded off
    // the top and read as a teardrop rather than as a frame forming.
    // Unioned with the counter, so the aperture is never smaller than the
    // A's interior and the corners simply fill in around it.
    const t = easeInOutCubic(clamp01((p - PHASE_1_END) / (PHASE_2_END - PHASE_1_END)));
    const children: ClipChild[] = [{ d: polyToPath(counter) }];
    const w = seed.w * t;
    const h = seed.h * t;
    if (w > 1 && h > 1) {
      children.push({ d: polyToPath(rectPoly(seed.cx, seed.cy, w, h)) });
    }
    return { phase: "counter", children, discRadius: 0, videoRect: seed };
  }

  // PHASE 3 — a plain computed rectangle at the video's native ratio,
  // growing from the seed to its settled size and drifting to the stage
  // centre. The ratio is held throughout: height drives, width follows.
  const t = easeInOutCubic(clamp01((p - PHASE_2_END) / (1 - PHASE_2_END)));
  const h = lerp(seed.h, finalHeight, t);
  const w = h * videoAspect;
  const cx = lerp(seed.cx, stageCentre.x, t);
  const cy = lerp(seed.cy, stageCentre.y, t);
  return {
    phase: "video",
    children: [{ d: polyToPath(rectPoly(cx, cy, w, h)) }],
    discRadius: 0,
    videoRect: { cx, cy, w, h },
    travel: t,
  };
}

/**
 * ART fades on the same progress. It is never scaled, rotated or distorted.
 *
 * It holds through phase 1 and most of phase 2 — while the aperture is
 * still the letter's own interior, the A *is* the frame, and taking it
 * away early left the middle of the transition as a bare rectangle with
 * no typography anywhere. It is gone by the time the frame separates from
 * the letter and travels.
 */
export function artOpacity(progress: number) {
  return 1 - clamp01((clamp01(progress) - 0.22) / 0.38);
}

/**
 * Video reveal opacity — the gentle emergence over phase 1, on the same
 * single progress.
 *
 * This is only safe because an opaque black fill is painted inside the
 * aperture underneath the video (see FilmstripEntry). Without it, a
 * partially transparent video lets ART's own white crossbar show *through*
 * the opening and blend with the footage, so the aperture reads as grey
 * letterform rather than as video emerging.
 */
export function videoOpacity(progress: number) {
  return 0.35 + 0.65 * easeOutCubic(clamp01(clamp01(progress) / PHASE_1_END));
}
