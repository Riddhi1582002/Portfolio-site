// THE CURSOR'S CONTEXT, for the places that do their own hit-testing.
//
// Most of the site says what the pointer is over with a `data-cursor`
// attribute on the element (see ContextCursor). Two surfaces cannot: the
// ring of cards on the homepage, whose 3D-transformed cards the browser
// does not hit-test reliably, and the Publications index, whose objects
// live inside one WebGL canvas. They work out what is under the pointer
// themselves and report it here, each under its own key so one clearing
// its state never wipes another's.

export type CursorLabel = "open" | "drag" | "view" | "back";

const sources = new Map<string, CursorLabel>();
const listeners = new Set<() => void>();

/** Sets (or, with null, clears) what `source` says the pointer is over. */
export function setCursorContext(source: string, label: CursorLabel | null) {
  const had = sources.get(source) ?? null;
  if (had === label) return;
  if (label) sources.set(source, label);
  else sources.delete(source);
  for (const fn of listeners) fn();
}

/** The label any source is currently reporting, if one is. */
export function cursorContext(): CursorLabel | null {
  for (const label of sources.values()) return label;
  return null;
}

export function onCursorContext(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
