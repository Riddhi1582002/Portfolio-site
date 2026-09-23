"use client";

// THE MEDIUMS BAR — Gallery, then each medium in the order the brief lists
// them. On /work/art it switches between the field and a medium's grid;
// on the homepage's gallery (the end of the journey) it is the same bar,
// and picking a medium opens that medium's collection on /work/art.

/** In the order the brief lists them, not by how many pieces each holds:
 *  this is a contents page, and a contents page keeps its own order. */
const MEDIUMS = [
  "Graphite/Charcoal",
  "Pen art",
  "Oils",
  "Acrylics",
  "Soft pastels",
  "Digital art",
] as const;

export function isArtMedium(m: string): boolean {
  return (MEDIUMS as readonly string[]).includes(m);
}

export default function ArtMediumBar({
  active,
  onSelect,
  style,
}: {
  /** The medium showing, or null for the gallery itself. */
  active: string | null;
  onSelect: (medium: string | null) => void;
  style?: React.CSSProperties;
}) {
  return (
    <>
      <nav className="ag-bar" aria-label="Mediums" style={style}>
        <button
          type="button"
          className={`ag-tab${active === null ? " on" : ""}`}
          onClick={() => onSelect(null)}
        >
          Gallery
        </button>
        <span className="ag-sep" aria-hidden />
        {MEDIUMS.map((m) => (
          <button
            key={m}
            type="button"
            className={`ag-tab${active === m ? " on" : ""}`}
            onClick={() => onSelect(m)}
          >
            {m}
          </button>
        ))}
      </nav>
      <style>{`
        .ag-bar {
          /* ABOVE the Back link, which sits at z-index 40 and is rendered
             after this, so at equal depth it won and swallowed the clicks
             on the tabs it overlapped. */
          position: absolute; z-index: 41;
          top: clamp(16px, 2.4vh, 30px); left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: clamp(10px, 1.2vw, 20px);
          padding: 8px clamp(12px, 1.4vw, 20px);
          max-width: min(94vw, 1180px);
          overflow-x: auto; scrollbar-width: none;
          border-radius: 999px;
          background: rgba(10,10,12,0.66);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.09);
        }
        .ag-bar::-webkit-scrollbar { display: none; }
        /* The centred bar keeps its own width, so on anything narrower
           than about a small laptop its left edge reaches back past where
           the Back link sits and the two collide — measured overlapping at
           768 and at 740 landscape. Stacking order stops it swallowing the
           clicks; only moving it off that line stops them sharing it. */
        @media (max-width: 860px) {
          .ag-bar { top: calc(clamp(18px, 3.5vh, 34px) + 32px); }
        }
        .ag-tab {
          flex: 0 0 auto;
          border: 0; background: none; padding: 4px 2px; cursor: pointer;
          font: inherit; font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.46);
          transition: color .3s ease;
          white-space: nowrap;
        }
        .ag-tab:hover { color: rgba(255,255,255,0.82); }
        .ag-tab.on { color: #fff; }
        .ag-sep { flex: 0 0 auto; width: 1px; height: 13px; background: rgba(255,255,255,0.16); }

      `}</style>
    </>
  );
}
