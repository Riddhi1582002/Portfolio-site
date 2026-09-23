"use client";

// GRAPHIC DESIGN, on its own route.
//
// CordSection unmodified — the same cord, bulb and card carousel the
// homepage beat ran, on the same scroll length. The cards' own links out
// (Publications, Campaigns/Social, Informational Design, the Reception
// screen) are unchanged; each of those pages comes back here.

import { useEffect, useState } from "react";
import CategoryStage from "./CategoryStage";
import CordSection from "./CordSection";
import { preloadBulb } from "./BulbModel";
import { holdReveal } from "../lib/pageTransition";
import { HOME_GD_PARAM, isGdDirect, ringCardProgress } from "./graphicDesignProjects";

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
const ARC_CARD_COUNT = 8;
/** Where card `k` is square to the lens, as a share of the track. */
const cardAt = ringCardProgress;
const OPEN_AT = cardAt(0);

export default function GraphicDesignCategoryView() {
  // THE BULB'S BYTES, STARTED AT ONCE.
  //
  // preloadBulb existed already, but only the homepage ever called it, so
  // arriving here directly — which is what every Back link from the six
  // project pages does — meant the 2.3MB GLB and three code-split chunks
  // were not fetched until the beat itself mounted and asked for them.
  // That wait is the bulb appearing late that this route was reported
  // for. Not deferred to an idle callback the way the homepage defers it:
  // there the bulb is several screens below the fold and must not compete
  // with first paint, whereas here its beat is what the route opens on.
  useEffect(() => {
    void preloadBulb();
  }, []);

  // ?card=N opens the ring on card N (0-based) instead of the first — how
  // a project's NEXT PROJECT hands over to the one after it. Read after
  // mount: the page is a static export, so there is no request to read it
  // from on the server.
  // (startProgress is only ever read inside CategoryStage's effect, never
  // rendered, so a server value that differs cannot mismatch hydration.)
  const [openAt] = useState(() => {
    if (typeof window === "undefined") return OPEN_AT;
    const k = Number(new URLSearchParams(window.location.search).get("card"));
    return Number.isInteger(k) && k > 0 && k < ARC_CARD_COUNT ? cardAt(k) : OPEN_AT;
  });

  // ONLY A DIRECT ENTRY STAYS HERE. Opened from the homepage's links, this
  // is Graphic Design on its own, ending in Back. Arrived at any other way,
  // Graphic Design is a stretch of the homepage journey, and that is where
  // the reader is taken — at the same card — so scrolling on carries into
  // the bulb, the iris and Art instead of stopping at Back.
  const [direct, setDirect] = useState(false);
  useEffect(() => {
    if (isGdDirect()) {
      const id = requestAnimationFrame(() => setDirect(true));
      // Back from a project to a card: shut until the ring has drawn at
      // that card (see holdReveal), capped so it can never withhold it.
      const k = Number(new URLSearchParams(window.location.search).get("card"));
      if (!Number.isInteger(k) || k < 0 || k >= ARC_CARD_COUNT) return () => cancelAnimationFrame(id);
      const release = holdReveal();
      const cap = window.setTimeout(release, 1500);
      let settle = 0;
      let bulbReady = false;
      void preloadBulb().then(() => {
        bulbReady = true;
      });
      const poll = window.setInterval(() => {
        if (!bulbReady || !document.querySelector(`[data-arc-card="${k}"]`)) return;
        window.clearInterval(poll);
        settle = window.setTimeout(release, 460);
      }, 30);
      return () => {
        cancelAnimationFrame(id);
        window.clearInterval(poll);
        window.clearTimeout(cap);
        window.clearTimeout(settle);
        release();
      };
    }
    const k = Number(new URLSearchParams(window.location.search).get("card"));
    const card = Number.isInteger(k) && k >= 0 && k < ARC_CARD_COUNT ? k : 0;
    window.location.replace(`/?${HOME_GD_PARAM}=${card}`);
  }, []);

  if (!direct) return <div style={{ minHeight: "100dvh", background: "#000" }} />;

  return (
    <CategoryStage lengthVh={CORD_VH} startProgress={openAt}>
      {(progress) => <CordSection progress={progress} sans={SANS} visible />}
    </CategoryStage>
  );
}
