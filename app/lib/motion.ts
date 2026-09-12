// The site's easing vocabulary.
//
// WHY THIS FILE EXISTS.
//
// Every beat on this page was eased with easeInOut* — a curve whose
// derivative is ZERO at both ends. On its own that is the right shape for
// an isolated movement. Chained back to back it is the whole problem: each
// beat decelerates to a complete standstill before the next one starts
// moving from a standstill of its own, so the sequence reads as a row of
// separate animations handing over at rest rather than as one continuous
// move. Every seam on the page has a full stop in it.
//
// Nothing here changes WHAT any beat does or where it lands. It changes
// whether a beat still has speed in it at the frame it hands over, and
// whether the beat that takes over starts with that speed already in hand.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Normalised progress of `v` across [a, b], clamped. */
export const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
export const easeInSine = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * An ease that accelerates the whole way and leaves at `k` times the
 * move's own average speed. For a movement that is meant to be ABSORBED
 * by whatever comes next rather than to come to rest — a camera flying
 * through a thing, not stopping in front of it.
 */
export const easeInPow = (k: number) => (t: number) => Math.pow(clamp01(t), k);

/**
 * MOMENTUM CARRIED IN AND OUT.
 *
 * Re-parametrises an ease onto the slice [from, to] of its own curve and
 * renormalises, so the result still runs exactly 0 -> 1 across 0 -> 1 but
 * is entered at the base curve's speed at `from` and left at its speed at
 * `to`. `from > 0` means the movement is already travelling on its first
 * frame — it inherits the speed of whatever handed over to it. `to < 1`
 * means it is still travelling on its last frame — it hands its own speed
 * on instead of parking.
 *
 * The landing value is unchanged (f(1) === 1 by construction), so a pose
 * that two beats agree on stays pixel-identical; only the approach to it
 * changes.
 */
export function carry(
  base: (t: number) => number,
  from = 0,
  to = 1
): (t: number) => number {
  const lo = base(from);
  const hi = base(to);
  const range = hi - lo || 1;
  return (t: number) => (base(from + (to - from) * clamp01(t)) - lo) / range;
}
