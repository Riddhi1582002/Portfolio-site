"use client";

// GRAPHIC DESIGN, on its own route.
//
// CordSection unmodified — the same cord, bulb and card carousel the
// homepage beat ran, on the same scroll length. The cards' own links out
// (Publications, Campaigns/Social, Informational Design, the Reception
// screen) are unchanged; each of those pages comes back here.

import CategoryStage from "./CategoryStage";
import CordSection from "./CordSection";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** The homepage beat's own length, so the carousel scrubs at its pace. */
const CORD_VH = 1200;

// WHERE THIS CATEGORY OPENS: on the carousel, with the first card square
// to the lens — not at the top of the track, which is the cord descending
// and the bulb arriving, and not wherever a previous visit happened to
// leave off.
//
// Derived rather than typed in, from the two numbers that decide it:
// CordSection hands the arc its own progress from ARC_START onward, and
// ArcCarousel turns that into a ring rotation that runs from -ARC_LEAD to
// ARC_CARD_COUNT - 1 + ARC_LEAD. Card 0 is square to the lens when that
// rotation reaches 0. If either constant is retuned, this follows.
const CORD_ARC_START = 0.51;
const ARC_LEAD = 2.6;
const ARC_CARD_COUNT = 9;
const FIRST_CARD_ARC_P = ARC_LEAD / (ARC_CARD_COUNT - 1 + ARC_LEAD * 2);
const OPEN_AT = CORD_ARC_START + FIRST_CARD_ARC_P * (1 - CORD_ARC_START);

export default function GraphicDesignCategoryView() {
  return (
    <CategoryStage lengthVh={CORD_VH} startProgress={OPEN_AT}>
      {(progress) => <CordSection progress={progress} sans={SANS} visible />}
    </CategoryStage>
  );
}
