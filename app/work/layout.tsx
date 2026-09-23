"use client";

// The three category pages share the section navigation, with the page's
// own section marked. Project pages do not carry it: they end in BACK.

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SectionNav from "../components/SectionNav";
import type { HomeSectionKey } from "../components/homeSections";

const SECTION: Record<string, HomeSectionKey> = {
  "/work/video": "video",
  "/work/graphic-design": "graphic-design",
  "/work/art": "art",
};

export default function WorkLayout({ children }: { children: ReactNode }) {
  const path = (usePathname() ?? "").replace(/\/$/, "");
  return (
    <>
      {children}
      <SectionNav current={SECTION[path] ?? null} />
    </>
  );
}
