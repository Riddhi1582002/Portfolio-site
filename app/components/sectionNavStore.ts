// What the homepage tells the section navigation: which of the three
// sections the journey is in, and whether the navigation should be on
// screen at all right now. A module-level store rather than context — the
// navigation lives outside the ScrollSmoother content the homepage renders
// into, so it cannot be a descendant of it.

import type { HomeSectionKey } from "./homeSections";

export type SectionNavState = { section: HomeSectionKey | null; show: boolean };

let state: SectionNavState = { section: null, show: true };
const listeners = new Set<() => void>();

// A reel overlay (project index or viewer) is open, on whichever page. It
// owns the corners then — its own CLOSE and DETAILS sit top right — so the
// navigation steps out of its way everywhere, not only on the homepage.
let overlay = false;
export function setSectionNavOverlay(open: boolean) {
  if (open === overlay) return;
  overlay = open;
  for (const l of listeners) l();
}
export function getSectionNavOverlay(): boolean {
  return overlay;
}

export function setSectionNavState(next: SectionNavState) {
  if (next.section === state.section && next.show === state.show) return;
  state = next;
  for (const l of listeners) l();
}

export function getSectionNavState(): SectionNavState {
  return state;
}

export function subscribeSectionNav(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
