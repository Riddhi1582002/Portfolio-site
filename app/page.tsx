import HeroVideoBackground from "./components/HeroVideoBackground";
import HeroSection from "./components/HeroSection";

export default function Home() {
  return (
    <div>
      <HeroVideoBackground />
      {/* One hero, one ART. The ART -> REELS transition happens inside
          HeroSection's own pinned stage — there is no second ART section
          and no separate portal section below it. */}
      <HeroSection />
    </div>
  );
}
