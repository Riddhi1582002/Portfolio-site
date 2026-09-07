import HeroVideoBackground from "./components/HeroVideoBackground";
import HeroSection from "./components/HeroSection";
import {
  PencilSectionWrapper,
  CanvasSectionWrapper,
} from "./components/StageFourWrappers";

export default function Home() {
  return (
    <div>
      <HeroVideoBackground />


      {/* ONE pinned pane for the hero, the strip and the cord. They were
          three consecutive pinned sections, and consecutive sticky panes
          always overlap during the hand-off — both on screen at once,
          which is what put a second strip under the first and a third
          under that. One pane, one progress, no hand-off. */}
      <HeroSection />


      {/* The pencil beat, and the match cut out of it: a dark disc on the
          placeholder grows past the frame and the page is inside it. */}
      <PencilSectionWrapper />

      {/* The infinite canvas. A plane the reader drags, with ART on it
          behind the work; the last stretch of scroll flies into the
          wordmark and the page returns to the hero. */}
      <CanvasSectionWrapper />
    </div>
  );
}
