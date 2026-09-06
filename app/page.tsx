import HeroVideoBackground from "./components/HeroVideoBackground";
import HeroSection from "./components/HeroSection";
import ReelSection from "./components/ReelSection";
import CordSectionWrapper from "./components/CordSectionWrapper";

export default function Home() {
  return (
    <div>
      <HeroVideoBackground />

      {/* One hero, one ART. The camera push into the A and the card stack
          arriving out of the depths both live inside this section's own
          pinned stage. */}
      <HeroSection />

      {/* REELS. The stack from the hero spreads into the strip here; one
          scroll brings the next piece into focus. 8 pieces at ~1 scroll
          each, plus the spread at the front. */}
      <ReelSection />

      {/* REELS -> LAYERS. The camera rolls 90 degrees so the strip is seen
          edge-on as one continuous line, travels down it through two
          narration beats, and arrives at the bulb. */}
      <CordSectionWrapper />

      {/* NEXT: LAYERS. The arc of work around the bulb, then the pencil
          beat, the eye match cut and the infinite canvas. Plugs in here. */}
    </div>
  );
}
