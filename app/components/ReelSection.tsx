"use client";

// Client wrapper for the REELS strip.
//
// PinnedSection hands its children a progress value through a render prop,
// and a function cannot cross the server/client boundary — page.tsx is a
// Server Component. Composing the two here keeps the callback entirely on
// the client and leaves page.tsx as a plain list of sections.

import PinnedSection from "./PinnedSection";
import ReelStrip, { REELS } from "./ReelStrip";

// One scroll per piece, plus one at the front for the stack spreading out.
const LENGTH_VH = 100 + (REELS.length + 1) * 100;

export default function ReelSection() {
  return (
    <PinnedSection lengthVh={LENGTH_VH} name="reels">
      {(p) => <ReelStrip progress={p} />}
    </PinnedSection>
  );
}
