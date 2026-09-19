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

export default function GraphicDesignCategoryView() {
  return (
    <CategoryStage lengthVh={CORD_VH}>
      {(progress) => <CordSection progress={progress} sans={SANS} visible />}
    </CategoryStage>
  );
}
