import HeroVideoBackground from "./components/HeroVideoBackground";
import HeroSection from "./components/HeroSection";
import ReelSection from "./components/ReelSection";

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

      {/* NEXT: REELS -> LAYERS. The 90-degree roll onto the cord, the two
          narration beats down it, and the bulb. Plugs in here. */}
    </div>
  );
}
