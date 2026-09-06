"use client";

// Client wrapper for the REELS -> LAYERS cord beat. Same reason as
// ReelSection: the render prop cannot cross the server/client boundary.

import PinnedSection from "./PinnedSection";
import CordSection from "./CordSection";

const SANS = "'Neue Montreal', system-ui, sans-serif";
// roll + travel + two narration beats + the bulb arriving, then the arc of
// nine pieces turning around it at roughly one viewport of scroll per card.
const LENGTH_VH = 1200;

export default function CordSectionWrapper() {
  return (
    <PinnedSection lengthVh={LENGTH_VH} name="cord">
      {(p) => <CordSection progress={p} sans={SANS} />}
    </PinnedSection>
  );
}
