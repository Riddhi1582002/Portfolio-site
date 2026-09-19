"use client";

// VIDEO, on its own route.
//
// The strip is the unmodified ReelStrip the homepage beat used, driven by
// the same progress value; what has changed is what is underneath it,
// which is nothing. Its project index and immersive viewer come from the
// shared useReelOverlays hook, so opening a reel, stepping between
// projects, and the scroll-freeze behind an open overlay behave exactly as
// they do on the homepage.

import CategoryStage from "./CategoryStage";
import ReelStrip, { REELS } from "./ReelStrip";
import ReelProjectView from "./ReelProjectView";
import ReelVideoViewer from "./ReelVideoViewer";
import useReelOverlays from "./useReelOverlays";

const SANS = "'Neue Montreal', system-ui, sans-serif";

/** The homepage beat's own length, so the strip scrubs at its usual pace. */
const REELS_VH = 900;

export default function VideoCategoryView() {
  const {
    reelOpenIndex,
    viewerReelIndex,
    selectedVideo,
    setSelectedVideo,
    openReel,
    closeReel,
    navigateReel,
    watchVideo,
    closeViewer,
  } = useReelOverlays();

  return (
    <CategoryStage lengthVh={REELS_VH}>
      {(progress) => (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
            <ReelStrip progress={progress} onOpenReel={openReel} />
          </div>

          {/* Both return null on their own when nothing is open. */}
          <ReelProjectView
            reels={REELS}
            openIndex={reelOpenIndex}
            onClose={closeReel}
            onNavigate={navigateReel}
            selectedVideo={selectedVideo}
            onSelectVideo={setSelectedVideo}
            onWatch={watchVideo}
            sans={SANS}
          />
          <ReelVideoViewer
            reels={REELS}
            reelIndex={viewerReelIndex}
            videoIndex={selectedVideo}
            onVideoChange={setSelectedVideo}
            onClose={closeViewer}
            sans={SANS}
          />
        </>
      )}
    </CategoryStage>
  );
}
