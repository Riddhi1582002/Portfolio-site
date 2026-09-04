import HeroVideoBackground from "./components/HeroVideoBackground";
import HeroSection from "./components/HeroSection";
import FilmstripEntry from "./components/FilmstripEntry";

export default function Home() {
  return (
    <div>
      <HeroVideoBackground />
      <HeroSection />
      <FilmstripEntry />
    </div>
  );
}
