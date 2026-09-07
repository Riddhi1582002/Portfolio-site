import HeroVideoBackground from "./components/HeroVideoBackground";
import SmoothScroll from "./components/SmoothScroll";
import HeroSection from "./components/HeroSection";

export default function Home() {
  return (
    <div>
      {/* OUTSIDE the smooth wrapper. ScrollSmoother transforms the content,
          and a transformed ancestor becomes the containing block for
          position:fixed — inside it this backdrop would scroll away. */}
      <HeroVideoBackground />

      <SmoothScroll>
        {/* ONE pinned pane for the whole sequence: the hero, the strip,
            the cord and bulb, the descent into the iris, and the gallery.
            They were separate pinned sections, and consecutive pinned
            panes always overlap during the hand-off — both on screen at
            once, which is what put a second strip under the first. It is
            also what makes the pull-back out of the iris possible at all:
            the gallery has to be able to open on the exact frame the
            previous beat ended on, and it cannot if a section boundary
            falls between them. One pane, one progress, no hand-off. */}
        <HeroSection />
      </SmoothScroll>
    </div>
  );
}
